import { collapseCarriageReturns, stripAnsi, type Cell, type Output } from './notebook';
import { describeData } from './mime';
import { foldBars } from './streams';
import { calm } from './trace';

// The notebook as compact Markdown, for pasting into a chat or a prompt: the text cells as written, the code in
// fences, and the outputs cut down to what a reader would look at first.

export type Detail = 'trim' | 'none' | 'full';

export interface Options {
  file: string;
  language: string | null;
  outputs: Detail;
  /** A size in tokens the text should fit, or 0 for no limit. Outputs are cut harder until it does. */
  budget?: number;
}

export interface Made {
  text: string;
  cells: number;
  /** True when some output was cut short. */
  trimmed: boolean;
  /** Pictures and interactive outputs, which cannot be put in text. */
  left: number;
  /** How hard outputs were cut to meet a budget: 0 is the usual trim, 3 is outputs left out. */
  squeezed: number;
  /** True when the budget was missed even with no outputs at all. */
  over: boolean;
}

// A long output keeps its first and last lines; a long line keeps its start; a cell keeps this much in all.
// Under a token budget the outputs are cut through these steps, harder each time.
interface Cut {
  head: number;
  tail: number;
  line: number;
  cell: number;
}
const CUTS: Cut[] = [
  { head: 12, tail: 6, line: 240, cell: 3000 },
  { head: 6, tail: 3, line: 160, cell: 1200 },
  { head: 3, tail: 2, line: 100, cell: 400 },
];

/** Pictures are named, with their size when it is cheap to know. */
function picture(data: Record<string, unknown>): string {
  for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
    const v = data[mime];
    if (typeof v !== 'string') continue;
    const kind = mime.slice(6).toUpperCase();
    if (mime === 'image/png') {
      try {
        // the size sits in the header, 16 bytes in
        const b = atob(v.slice(0, 32));
        const at = (i: number) => (b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) | (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3);
        return `[image: ${kind} ${at(16)}×${at(20)}]`;
      } catch {
        // fall through to the plain name
      }
    }
    return `[image: ${kind}]`;
  }
  return typeof data['image/svg+xml'] === 'string' ? '[image: SVG]' : '';
}

const fence = (body: string, tag = '') => {
  const run = Math.max(2, ...[...body.matchAll(/`+/g)].map((m) => m[0].length));
  const f = '`'.repeat(run + 1);
  return `${f}${tag}\n${body}\n${f}`;
};

function cut(text: string, detail: Detail, made: Made, k: Cut): string {
  if (detail === 'full') return text;
  let lines = text.split('\n').map((l) => (l.length > k.line ? ((made.trimmed = true), l.slice(0, k.line) + ' …') : l));
  if (lines.length > k.head + k.tail + 6) {
    made.trimmed = true;
    lines = [...lines.slice(0, k.head), `… ${(lines.length - k.head - k.tail).toLocaleString('en-US')} lines omitted …`, ...lines.slice(-k.tail)];
  }
  const out = lines.join('\n');
  if (out.length <= k.cell) return out;
  made.trimmed = true;
  return out.slice(0, k.cell).replace(/\n[^\n]*$/, '') + '\n…';
}

/** What a cell's outputs say, as plain text, or null when there is none. */
function outputs(list: readonly Output[], detail: Detail, made: Made, k: Cut): { text: string; error: boolean } | null {
  const parts: string[] = [];
  let error = false;
  for (const o of list) {
    if (o.type === 'error') {
      error = true;
      const head = `${o.ename}${o.evalue ? ': ' + stripAnsi(o.evalue) : ''}`;
      if (detail === 'none') parts.push(head);
      else {
        const trace = detail === 'full' ? o.traceback : (calm(o.traceback) ?? o.traceback);
        const rest = trace.map(stripAnsi).join('\n').trim();
        parts.push(rest && !rest.includes(head) ? `${head}\n${rest}` : rest || head);
      }
    } else if (detail === 'none') continue;
    else if (o.type === 'stream') {
      const t = stripAnsi(foldBars(collapseCarriageReturns(o.text))).replace(/\s+$/, '');
      if (t) parts.push(t);
    } else {
      const s = describeData(o.data);
      const pic = picture(o.data);
      const said = s.kind === 'text' && !s.chart ? (s.md ?? s.text) : '';
      if (said.trim()) parts.push(stripAnsi(said).replace(/\s+$/, ''));
      else if (pic) (parts.push(pic), made.left++);
      else if (s.kind === 'text' && s.rich) (parts.push(`[interactive output: ${s.rich}]`), made.left++);
    }
  }
  // only blank lines go from the start: the first line of a table is indented to line up with the rest
  const text = parts.join('\n').replace(/^\s*\n|\s+$/g, '');
  return text ? { text: cut(text, detail, made, k), error } : null;
}

function build(cells: readonly Cell[], o: Options, detail: Detail, k: Cut): Made {
  const made: Made = { text: '', cells: 0, trimmed: false, left: 0, squeezed: 0, over: false };
  const tag = o.language ?? '';
  const blocks: string[] = [`# ${o.file || 'Notebook'}`];
  const label = o.language ? o.language.charAt(0).toUpperCase() + o.language.slice(1) : 'Notebook';
  for (const c of cells) {
    if (c.type === 'raw') continue;
    made.cells++;
    if (c.type === 'markdown') {
      const t = c.source.trim();
      if (t) blocks.push(t);
      continue;
    }
    const code = c.source.replace(/\s+$/, '');
    if (code) blocks.push(fence(code, tag));
    const out = outputs(c.outputs, detail, made, k);
    if (out) blocks.push(`${out.error ? 'Error' : 'Output'}:\n${fence(out.text, 'text')}`);
  }
  blocks.splice(1, 0, `${o.language ? label + ' notebook' : 'Notebook'}, ${made.cells} cell${made.cells === 1 ? '' : 's'}.`);
  made.text = blocks.join('\n\n') + '\n';
  return made;
}

/** A rough count of what a language model will read: about four characters to the token. */
export const tokens = (text: string) => Math.ceil(text.length / 4);

export function toMarkdown(cells: readonly Cell[], o: Options): Made {
  if (!o.budget || o.outputs === 'none') return build(cells, o, o.outputs, CUTS[0]);
  // the reader's own choice comes first; a budget only ever cuts further
  let made = build(cells, o, o.outputs === 'full' ? 'full' : 'trim', CUTS[0]);
  for (let step = 1; tokens(made.text) > o.budget && step <= CUTS.length; step++) {
    made = step < CUTS.length ? build(cells, o, 'trim', CUTS[step]) : build(cells, o, 'none', CUTS[0]);
    made.squeezed = step;
  }
  made.over = tokens(made.text) > o.budget;
  return made;
}
