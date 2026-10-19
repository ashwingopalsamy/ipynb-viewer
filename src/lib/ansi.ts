export interface AnsiSegment {
  text: string;
  cls: string;
  style: string;
}

// eslint-disable-next-line no-control-regex
const ESCAPES = /\u001b\[([0-9;?]*)([ -/]*[@-~])|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

const hex = (n: number) => n.toString(16).padStart(2, '0');

function color256(n: number): number | string {
  if (n < 16) return n;
  if (n < 232) {
    const c = n - 16;
    const level = (x: number) => (x ? 55 + x * 40 : 0);
    return `#${hex(level(Math.floor(c / 36)))}${hex(level(Math.floor(c / 6) % 6))}${hex(level(c % 6))}`;
  }
  const v = 8 + (n - 232) * 10;
  return `#${hex(v)}${hex(v)}${hex(v)}`;
}

interface State {
  fg: number | string | null;
  bg: number | string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

const fresh = (): State => ({ fg: null, bg: null, bold: false, dim: false, italic: false, underline: false });

function apply(state: State, codes: number[]) {
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) Object.assign(state, fresh());
    else if (c === 1) state.bold = true;
    else if (c === 2) state.dim = true;
    else if (c === 3) state.italic = true;
    else if (c === 4) state.underline = true;
    else if (c === 22) state.bold = state.dim = false;
    else if (c === 23) state.italic = false;
    else if (c === 24) state.underline = false;
    else if (c >= 30 && c <= 37) state.fg = c - 30;
    else if (c >= 90 && c <= 97) state.fg = c - 90 + 8;
    else if (c >= 40 && c <= 47) state.bg = c - 40;
    else if (c >= 100 && c <= 107) state.bg = c - 100 + 8;
    else if (c === 39) state.fg = null;
    else if (c === 49) state.bg = null;
    else if (c === 38 || c === 48) {
      let value: number | string | null = null;
      if (codes[i + 1] === 5) {
        value = color256(codes[i + 2] ?? 0);
        i += 2;
      } else if (codes[i + 1] === 2) {
        value = `#${hex(codes[i + 2] ?? 0)}${hex(codes[i + 3] ?? 0)}${hex(codes[i + 4] ?? 0)}`;
        i += 4;
      }
      if (c === 38) state.fg = value;
      else state.bg = value;
    }
  }
}

function describe(s: State): { cls: string; style: string } {
  const cls: string[] = [];
  let style = '';
  if (typeof s.fg === 'number') cls.push(`fg${s.fg}`);
  else if (s.fg) style += `color:${s.fg};`;
  if (typeof s.bg === 'number') cls.push(`bg${s.bg}`);
  else if (s.bg) style += `background:${s.bg};`;
  if (s.bold) cls.push('bold');
  if (s.dim) cls.push('dim');
  if (s.italic) cls.push('italic');
  if (s.underline) cls.push('underline');
  return { cls: cls.join(' '), style };
}

/** Splits text with ANSI escapes into styled runs. Sequences other than colors and weights are dropped. */
export function parseAnsi(text: string): AnsiSegment[] {
  if (!text.includes('\u001b')) return [{ text, cls: '', style: '' }];
  const out: AnsiSegment[] = [];
  const state = fresh();
  let last = 0;
  const push = (end: number) => {
    if (end > last) out.push({ text: text.slice(last, end), ...describe(state) });
  };
  for (const m of text.matchAll(ESCAPES)) {
    push(m.index);
    last = m.index + m[0].length;
    if (m[2] === 'm') apply(state, (m[1] || '0').split(';').map((n) => Number(n) || 0));
  }
  push(text.length);
  return out;
}
