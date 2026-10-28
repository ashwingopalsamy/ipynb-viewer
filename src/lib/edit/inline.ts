import type { Token, Tokens } from 'marked';
import type { Block } from './blocks';

type Marks = {
  raw?: string;
  /** The canonical form of the node when it was read. While it still matches, the original `raw` is written back. */
  sig?: string;
};

export type Inline =
  | { t: 'text'; v: string }
  | ({ t: 'strong' | 'em' | 'del'; c: Inline[] } & Marks)
  | ({ t: 'code'; v: string } & Marks)
  | ({ t: 'link'; href: string; title: string | null; c: Inline[] } & Marks)
  | { t: 'br'; raw?: string }
  | { t: 'atom'; raw: string };

type Gen = Tokens.Generic;

const NAMED = new Map(
  Object.entries({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™',
    mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    times: '×', deg: '°', middot: '·', bull: '•', laquo: '«', raquo: '»',
  }),
);

/** Character references in text, as the reader sees them. */
function decode(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    const known = NAMED.get(e);
    if (known !== undefined) return known;
    if (typeof document === 'undefined') return m;
    // a textarea holds text only, so this reads the reference without building anything
    const box = document.createElement('textarea');
    box.innerHTML = m;
    return box.value;
  });
}

// Indentation on a continuation line carries no meaning inside a paragraph.
const plain = (s: string) => s.replace(/\n[ \t]+/g, '\n');

function seal<T extends Inline>(n: T): T {
  if ('raw' in n && n.t !== 'br' && n.t !== 'atom') (n as Marks).sig = canonical(n, BASE);
  return n;
}

/** Marked's inline tokens as the neutral model. Marks keep the raw text they came from so an untouched one is written back as it was. */
export function fromTokens(tokens: Token[]): Inline[] {
  const out: Inline[] = [];
  const push = (n: Inline) => {
    const last = out[out.length - 1];
    if (n.t === 'text') {
      if (!n.v) return;
      if (last?.t === 'text') return void (last.v += n.v);
    }
    out.push(n);
  };
  for (const tk of tokens as Gen[]) {
    switch (tk.type) {
      case 'text':
        if (tk.tokens) fromTokens(tk.tokens).forEach(push);
        else push({ t: 'text', v: plain(decode(tk.text)) });
        break;
      case 'escape':
        push({ t: 'text', v: tk.text });
        break;
      case 'strong':
      case 'em':
      case 'del':
        push(seal({ t: tk.type, c: fromTokens(tk.tokens ?? []), raw: tk.raw }));
        break;
      case 'codespan':
        push(seal({ t: 'code', v: tk.text, raw: tk.raw }));
        break;
      case 'link':
        push(seal({ t: 'link', href: tk.href, title: tk.title ?? null, c: fromTokens(tk.tokens ?? []), raw: tk.raw }));
        break;
      case 'br':
        push({ t: 'br', raw: tk.raw });
        break;
      default:
        // math, images, raw HTML: kept exactly as written
        push({ t: 'atom', raw: tk.raw });
    }
  }
  return out;
}

interface Ctx {
  /** The text begins a line, where `#`, `>`, `1.` and friends would turn into blocks. */
  start: boolean;
  heading: boolean;
  link: boolean;
}

const BASE: Ctx = { start: false, heading: false, link: false };
const word = (c?: string) => !!c && /[\p{L}\p{N}_]/u.test(c);

// Which characters must be written with a backslash to stay literal; everything else is left alone.
function escLine(line: string, start: boolean, c: Ctx): string {
  let force = -1;
  if (start) {
    line = line.replace(/^ {4,}/, '   ');
    const at = line.search(/\S/);
    if (at >= 0) {
      const rest = line.slice(at);
      if (/^#{1,6}(?: |$)/.test(rest) || rest[0] === '>' || /^[-+](?: |$)/.test(rest) || /^(?:=+|-+)\s*$/.test(rest) || /^([-_*])( *\1){2,} *$/.test(rest)) force = at;
      else {
        const num = /^\d{1,9}([.)])(?: |$)/.exec(rest);
        if (num) force = at + num[0].indexOf(num[1]);
      }
    }
  }
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = line[i - 1];
    const next = line[i + 1];
    let esc = i === force;
    if (ch === '\\' || ch === '`' || ch === '*' || ch === '[') esc = true;
    else if (ch === ']') esc ||= c.link;
    else if (ch === '_') esc ||= !(word(prev) && word(next));
    // `$x$` is math, `$5 and $6` is two prices
    else if (ch === '$') esc ||= (next !== undefined && !/[\s\d]/.test(next)) || (prev !== undefined && !/\s/.test(prev) && !(next !== undefined && /\d/.test(next)));
    else if (ch === '<') esc ||= next !== undefined && /[A-Za-z/!?]/.test(next);
    else if (ch === '~') esc ||= prev === '~' || next === '~';
    else if (ch === '&') esc ||= /^&#?\w+;/.test(line.slice(i));
    if (ch === ' ') out += '&nbsp;';
    else out += esc ? '\\' + ch : ch;
  }
  return out;
}

function esc(v: string, c: Ctx): string {
  // spaces before a line break would read as a hard break
  v = v.replace(/ +\n/g, '\n');
  if (c.heading) v = v.replace(/\n/g, ' ');
  return v
    .split('\n')
    .map((line, i) => escLine(line, i > 0 || c.start, c))
    .join('\n');
}

// A mark cannot open or close next to a space, so the space moves outside it.
function wrap(mark: string, inner: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
}

function dest(href: string): string {
  return href === '' || /[\s()<]/.test(href) ? `<${href.replace(/[<>]/g, '\\$&')}>` : href;
}

function canonical(n: Inline, c: Ctx): string {
  switch (n.t) {
    case 'strong':
      return wrap('**', emit(n.c, { ...c, start: false }));
    case 'em':
      return wrap('*', emit(n.c, { ...c, start: false }));
    case 'del':
      return wrap('~~', emit(n.c, { ...c, start: false }));
    case 'code': {
      const v = n.v.replace(/\n/g, ' ');
      if (!v) return '';
      const run = Math.max(0, ...(v.match(/`+/g) ?? []).map((r) => r.length));
      const fence = '`'.repeat(run + 1);
      const pad = /^`|`$/.test(v) || (/^ .* $/.test(v) && v.trim() !== '') ? ' ' : '';
      return fence + pad + v + pad + fence;
    }
    case 'link': {
      const inner = emit(n.c, { ...c, start: false, link: true });
      if (!inner.trim()) return '';
      return `[${inner}](${dest(n.href)}${n.title ? ` "${n.title.replace(/"/g, '\\"')}"` : ''})`;
    }
    default:
      return '';
  }
}

function emit(nodes: Inline[], c: Ctx): string {
  let out = '';
  for (const n of nodes) {
    const here = { ...c, start: out === '' ? c.start : out.endsWith('\n') };
    if (n.t === 'text') out += esc(n.v, here);
    else if (n.t === 'br') out += c.heading ? ' ' : (n.raw ?? '\\\n');
    else if (n.t === 'atom') out += n.raw;
    else if (n.raw !== undefined && canonical(n, BASE) === n.sig) out += n.raw;
    else out += canonical(n, here);
  }
  return out;
}

/** Markdown for a run of inline nodes. Text is escaped only where it would otherwise change meaning. */
export function toMarkdown(nodes: Inline[], ctx: 'paragraph' | 'heading' = 'paragraph'): string {
  const out = emit(nodes, { start: true, heading: ctx === 'heading', link: false });
  // a closing run of # would be read as the heading's own closer
  return ctx === 'heading' && nodes[nodes.length - 1]?.t === 'text' && /(^|\s)#+$/.test(out) ? out.replace(/#+$/, '\\$&') : out;
}

/** How many caret positions the nodes span: a character each, an atom or a break as one. */
export function plainLength(nodes: Inline[]): number {
  let n = 0;
  for (const x of nodes) n += x.t === 'text' || x.t === 'code' ? x.v.length : x.t === 'br' || x.t === 'atom' ? 1 : plainLength(x.c);
  return n;
}

function itemInline(item: Tokens.ListItem): Inline[] {
  const body = (item.tokens as Gen[]).find((x) => x.type !== 'space');
  if (!body) return [];
  return fromTokens(body.tokens ?? [{ type: 'text', raw: body.raw, text: body.text } as Token]);
}

/** The editable text of a block: one run for a paragraph or heading, one per item for a list. */
export function blockText(b: Block): Inline[][] {
  const t = b.token as Gen;
  if (t.type === 'list') return (t as Tokens.List).items.map(itemInline);
  return [fromTokens(t.tokens ?? [])];
}

const trim = (s: string) => s.replace(/^\s+|\s+$/g, '');

/** A block written back in the style it had: its heading syntax, list marker, start number and looseness. An empty result means the block is gone. */
export function blockMarkdown(b: Block, items: Inline[][], extra: Inline[][] = []): string {
  const t = b.token as Gen;
  let head = '';
  if (t.type === 'heading') {
    const text = trim(toMarkdown(items[0] ?? [], 'heading'));
    if (text) {
      const lines = t.raw.replace(/\n+$/, '').split('\n');
      const under = lines.length > 1 ? /^\s*(=+|-+)\s*$/.exec(lines[lines.length - 1]) : null;
      head = under ? `${text}\n${under[1][0].repeat(Math.max(3, text.length))}` : `${'#'.repeat(t.depth)} ${text}`;
    }
  } else if (t.type === 'list') {
    const list = t as Tokens.List;
    const first = /^\s*([-+*]|\d+([.)]))/.exec(list.items[0]?.raw ?? '');
    const bullet = first && !first[2] ? first[1] : '-';
    const delim = first?.[2] ?? '.';
    const start = typeof list.start === 'number' ? list.start : 1;
    const lines: string[] = [];
    let k = 0;
    for (const it of items) {
      const text = trim(toMarkdown(it));
      if (!text) continue;
      const marker = list.ordered ? `${start + k}${delim} ` : `${bullet} `;
      lines.push(marker + text.replace(/\n/g, '\n' + ' '.repeat(marker.length)));
      k++;
    }
    head = lines.join(list.loose ? '\n\n' : '\n');
  } else {
    head = trim(toMarkdown(items[0] ?? []));
  }
  const more = extra.map((e) => trim(toMarkdown(e))).filter(Boolean);
  return [head, ...more].filter(Boolean).join('\n\n');
}
