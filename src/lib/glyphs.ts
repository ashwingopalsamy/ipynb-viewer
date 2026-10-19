// Text as a grid of cells, the way a terminal sees it: one glyph per cell, wide characters taking two.
// The screenshot painter draws from this, so wrapping and tabs behave the same as in the reader.

/** How a run of text is coloured and weighted; light and dark carry their own colours for highlighted code. */
export interface Style {
  lc?: string;
  dc?: string;
  /** An index into the 16 ANSI colours. */
  ansi?: number;
  /** A colour given outright (256-colour and truecolor escapes). */
  rgb?: string;
  bg?: number | string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  underline?: boolean;
}

export interface Glyph {
  ch: string;
  /** Columns taken: 0 for a combining mark, 2 for a wide character or an emoji. */
  w: 0 | 1 | 2;
  style: Style;
}

export type Row = Glyph[];

const WIDE: [number, number][] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f900, 0x1faff],
  [0x20000, 0x3fffd],
];

/** Columns a code point takes. Not the whole of Unicode, but what notebooks print. */
export function width(cp: number): 0 | 1 | 2 {
  if (cp < 0x300) return 1;
  if ((cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0;
  return WIDE.some(([a, b]) => cp >= a && cp <= b) ? 2 : 1;
}

export interface Part {
  text: string;
  style: Style;
}

/** Splits styled text into rows at newlines. Tabs fall on every fourth column, and carriage returns are dropped. */
export function rows(parts: readonly Part[], tab = 4): Row[] {
  const out: Row[] = [[]];
  let col = 0;
  for (const { text, style } of parts) {
    for (const ch of text) {
      if (ch === '\n') {
        out.push([]);
        col = 0;
      } else if (ch === '\r') {
        continue;
      } else if (ch === '\t') {
        const n = tab - (col % tab);
        for (let k = 0; k < n; k++) out[out.length - 1].push({ ch: ' ', w: 1, style });
        col += n;
      } else {
        const w = width(ch.codePointAt(0)!);
        out[out.length - 1].push({ ch, w, style });
        col += w;
      }
    }
  }
  return out;
}

/** The columns a row takes. */
export const cols = (row: Row) => row.reduce((n, g) => n + g.w, 0);

/**
 * Breaks a row into pieces of at most `limit` columns, at a space when one is near enough and in the middle of a word
 * when not. Later pieces start `hang` columns in, so a wrapped line of code reads as a continuation. A wide character
 * never straddles the break.
 */
export function wrap(row: Row, limit: number, hang = 0): Row[] {
  if (cols(row) <= limit) return [row];
  const out: Row[] = [];
  const indent = Math.min(hang, Math.floor(limit / 2));
  const lead = () => Array.from({ length: indent }, () => ({ ch: ' ', w: 1 as const, style: {} }));
  let line: Row = [];
  let used = 0;
  // where the next piece would begin if the line broke at its last space
  let space = -1;
  for (const g of row) {
    const floor = out.length ? indent : 0;
    if (used + g.w > limit && used > floor) {
      if (g.ch === ' ') {
        out.push(line);
        line = lead();
        used = indent;
        space = -1;
        continue;
      }
      let rest: Row = [];
      if (space > floor + limit * 0.4) {
        rest = line.slice(space);
        line = line.slice(0, space);
      }
      out.push(line);
      line = [...lead(), ...rest];
      used = indent + cols(rest);
      space = -1;
    }
    line.push(g);
    used += g.w;
    if (g.ch === ' ') space = line.length;
  }
  out.push(line);
  return out;
}

/** Leading spaces of a row, for the hanging indent of wrapped code. */
export const indent = (row: Row) => {
  let n = 0;
  while (n < row.length && row[n].ch === ' ') n++;
  return n;
};
