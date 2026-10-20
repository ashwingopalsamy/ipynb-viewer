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
}

export interface Made {
  text: string;
  cells: number;
  /** True when some output was cut short. */
  trimmed: boolean;
  /** Pictures and interactive outputs, which cannot be put in text. */
  left: number;
}

// A long output keeps its first and last lines; a long line keeps its start; a cell keeps this much in all.
const HEAD = 12;
const TAIL = 6;
const LINE = 240;
const CELL = 3000;

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

function cut(text: string, detail: Detail, made: Made): string {
  if (detail === 'full') return text;
  let lines = text.split('\n').map((l) => (l.length > LINE ? ((made.trimmed = true), l.slice(0, LINE) + ' …') : l));
  if (lines.length > HEAD + TAIL + 6) {
    made.trimmed = true;
    lines = [...lines.slice(0, HEAD), `… ${(lines.length - HEAD - TAIL).toLocaleString('en-US')} lines omitted …`, ...lines.slice(-TAIL)];
  }
  const out = lines.join('\n');
  if (out.length <= CELL) return out;
  made.trimmed = true;
  return out.slice(0, CELL).replace(/\n[^\n]*$/, '') + '\n…';
}

/** What a cell's outputs say, as plain text, or null when there is none. */
function outputs(list: readonly Output[], detail: Detail, made: Made): { text: string; error: boolean } | null {
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
  return text ? { text: cut(text, detail, made), error } : null;
}

export function toMarkdown(cells: readonly Cell[], o: Options): Made {
  const made: Made = { text: '', cells: 0, trimmed: false, left: 0 };
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
    const out = outputs(c.outputs, o.outputs, made);
    if (out) blocks.push(`${out.error ? 'Error' : 'Output'}:\n${fence(out.text, 'text')}`);
  }
  blocks.splice(1, 0, `${o.language ? label + ' notebook' : 'Notebook'}, ${made.cells} cell${made.cells === 1 ? '' : 's'}.`);
  made.text = blocks.join('\n\n') + '\n';
  return made;
}

/** A rough count of what a language model will read: about four characters to the token. */
export const tokens = (text: string) => Math.ceil(text.length / 4);
