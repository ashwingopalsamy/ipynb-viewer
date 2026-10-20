// Draws a cell as a picture: its code and its output, in the reader's own look, on a canvas.
// Canvas rather than a copy of the page, so the result is the same in every browser and nothing is sent anywhere.
import { collapseCarriageReturns, stripAnsi, type ErrorOutput, type Output } from './notebook';
import { parseAnsi } from './ansi';
import { describeData } from './mime';
import { foldBars } from './streams';
import { highlight } from './highlight';
import { cols, indent, rows, wrap, type Row, type Style } from './glyphs';

export type Theme = 'light' | 'dark';
export type Backdrop = 'none' | 'mist' | 'dawn' | 'dusk' | 'ink';
export type Show = 'both' | 'code' | 'out';
export type Layout = 'stack' | 'side';
export type Pad = 'S' | 'M' | 'L';
export type Shape = 'fit' | 'wide' | 'square';

export interface Opts {
  show: Show;
  layout: Layout;
  theme: Theme;
  backdrop: Backdrop;
  pad: Pad;
  shape: Shape;
  lines: boolean;
  title: boolean;
}

/** The frames of the 16:9 and square files, before the size multiplier. */
const FRAME = { wide: [1280, 720], square: [1080, 1080] } as const;

export const BACKDROPS: readonly { id: Backdrop; label: string; a?: string; b?: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'mist', label: 'Mist', a: '#f1f3f9', b: '#c6d1e8' },
  { id: 'dawn', label: 'Dawn', a: '#ffe8d9', b: '#f1b1cf' },
  { id: 'dusk', label: 'Dusk', a: '#4f54c2', b: '#a96ed8' },
  { id: 'ink', label: 'Ink', a: '#1a1a20', b: '#383945' },
];

// ---------------------------------------------------------------------------------------------------------------
// Colours: read from the stylesheet itself, so the picture cannot drift from the reader.

export interface Palette {
  page: string;
  paper: string;
  well: string;
  well2: string;
  fg: string;
  fg2: string;
  fg3: string;
  line: string;
  danger: string;
  ok: string;
  tint: string;
  zebra: string;
  a: string[];
}

const hexRgb = (c: string): [number, number, number] => {
  const n = /^#([0-9a-f]{6})$/i.test(c) ? parseInt(c.slice(1), 16) : 0;
  return [n >> 16, (n >> 8) & 255, n & 255];
};
/** `t` of the first colour over the second, both as #rrggbb. */
export const mix = (a: string, b: string, t: number) => {
  const [x, y, z] = hexRgb(a);
  const [p, q, r] = hexRgb(b);
  return `rgb(${Math.round(x * t + p * (1 - t))},${Math.round(y * t + q * (1 - t))},${Math.round(z * t + r * (1 - t))})`;
};

const palettes = new Map<Theme, Palette>();

/** The reader's tokens for a theme. The other theme is read by switching to it and back within one task, which never paints. */
export function palette(theme: Theme): Palette {
  const known = palettes.get(theme);
  if (known) return known;
  const root = document.documentElement;
  const was = root.dataset.theme ?? 'light';
  root.dataset.theme = theme;
  const cs = getComputedStyle(root);
  // the stylesheet may be minified to #fff or hold any notation; the canvas hands every colour back as #rrggbb
  const v = (n: string) => {
    const raw = cs.getPropertyValue(`--${n}`).trim();
    const m = measure();
    m.fillStyle = '#000';
    m.fillStyle = raw;
    return m.fillStyle;
  };
  const p: Palette = {
    page: v('page'),
    paper: v('paper'),
    well: v('well'),
    well2: v('well-2'),
    fg: v('fg'),
    fg2: v('fg-2'),
    fg3: v('fg-3'),
    line: v('line'),
    danger: v('danger'),
    ok: v('ok') || '#1d8a4a',
    tint: mix(v('danger'), v('paper'), theme === 'dark' ? 0.1 : 0.07),
    zebra: mix(v('fg'), v('paper'), 0.03),
    a: Array.from({ length: 16 }, (_, i) => v(`a${i}`)),
  };
  root.dataset.theme = was;
  palettes.set(theme, p);
  return p;
}

/** The two typefaces are loaded on demand, so the page has to ask for them before a canvas can use them. */
export async function fonts() {
  const faces = ['400 13.5px "JetBrains Mono"', 'italic 400 13.5px "JetBrains Mono"', '600 13.5px "JetBrains Mono"', '400 13px Inter', '500 13px Inter', '600 13px Inter'];
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f).catch(() => []))), new Promise((done) => setTimeout(done, 2500))]);
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the cell

export interface Source {
  file: string;
  n: number | null;
  language: string | null;
  code: string;
  outputs: readonly Output[];
}

export interface Table {
  head: string[][];
  body: string[][];
  /** Columns at the left that name the row. */
  lead: number;
  num: boolean[];
  foot: string;
}

export type Block =
  | { k: 'text'; rows: Row[]; tail: Row[]; hidden: number; soft: boolean }
  | { k: 'err'; name: string; msg: string; rows: Row[] }
  | { k: 'img'; img: HTMLImageElement; alpha: boolean }
  | { k: 'tbl'; t: Table };

export interface Prepared {
  file: string;
  n: number | null;
  failed: boolean;
  code: Row[];
  blocks: Block[];
  /** Output that is interactive or not an image, a table or text: it has no picture to give. */
  skipped: boolean;
}

const CODE_CAP = 70;
const CODE_HEAD = 60;
const TEXT_CAP = 30;
const TEXT_HEAD = 20;
const TEXT_TAIL = 6;
const TABLE_ROWS = 10;

const styleOf = (cls: string, css: string): Style => {
  const s: Style = {};
  for (const c of cls.split(' ')) {
    const m = /^(fg|bg)(\d+)$/.exec(c);
    if (m) {
      if (m[1] === 'fg') s.ansi = Number(m[2]);
      else s.bg = Number(m[2]);
    } else if (c === 'bold') s.bold = true;
    else if (c === 'dim') s.dim = true;
    else if (c === 'italic') s.italic = true;
    else if (c === 'underline') s.underline = true;
  }
  const fg = /(?:^|;)color:(#[0-9a-f]{6})/i.exec(css);
  if (fg) s.rgb = fg[1];
  const bg = /background:(#[0-9a-f]{6})/i.exec(css);
  if (bg) s.bg = bg[1];
  return s;
};

const ansiRows = (text: string): Row[] => rows(parseAnsi(text).map((s) => ({ text: s.text, style: styleOf(s.cls, s.style) })));

const trim = (all: Row[]): { rows: Row[]; tail: Row[]; hidden: number } =>
  all.length > TEXT_CAP ? { rows: all.slice(0, TEXT_HEAD), tail: all.slice(-TEXT_TAIL), hidden: all.length - TEXT_HEAD - TEXT_TAIL } : { rows: all, tail: [], hidden: 0 };

const textBlock = (text: string, soft: boolean): Block => ({ k: 'text', ...trim(ansiRows(text.replace(/\s+$/, ''))), soft });

async function codeRows(source: string, language: string | null): Promise<Row[]> {
  const code = source.replace(/\s+$/, '');
  if (!code) return [];
  let html = '';
  try {
    html = await highlight(code, language);
  } catch {
    return rows([{ text: code, style: {} }]);
  }
  const box = document.createElement('template');
  box.innerHTML = html;
  const out: Row[] = [];
  for (const line of box.content.querySelectorAll('.line')) {
    const parts = [...line.childNodes].map((n) => {
      const el = n instanceof HTMLElement ? n : null;
      const style: Style = {};
      if (el) {
        const get = (p: string) => el.style.getPropertyValue(p);
        style.lc = get('--shiki-light') || undefined;
        style.dc = get('--shiki-dark') || undefined;
        style.italic = get('--shiki-light-font-style') === 'italic';
        const weight = get('--shiki-light-font-weight');
        style.bold = !!weight && weight !== 'normal' && weight !== '400';
      }
      return { text: n.textContent ?? '', style };
    });
    out.push(rows(parts)[0] ?? []);
  }
  return out;
}

function readTable(table: HTMLTableElement): Table | null {
  const head: string[][] = [];
  const body: string[][] = [];
  const num: boolean[] = [];
  let lead = 0;
  for (const tr of table.querySelectorAll('tr')) {
    const inBody = !!tr.closest('tbody');
    const cells: string[] = [];
    [...tr.children].forEach((c, k) => {
      cells.push((c.textContent ?? '').replace(/\s+/g, ' ').trim());
      for (let extra = (c as HTMLTableCellElement).colSpan - 1; extra > 0; extra--) cells.push('');
      if (inBody && c.tagName === 'TD' && c.classList.contains('n')) num[k] = true;
    });
    if (inBody) {
      if (!body.length) {
        const first = [...tr.children].findIndex((c) => c.tagName !== 'TH');
        lead = first < 0 ? tr.children.length : first;
      }
      body.push(cells);
    } else head.push(cells);
  }
  if (!body.length) return null;
  return { head, body, lead, num, foot: '' };
}

/** What the reader's table cleaner or its plain-text table finder produced, as drawable blocks. */
function fromHtml(html: string): Block[] {
  const box = document.createElement('template');
  box.innerHTML = html;
  const out: Block[] = [];
  for (const el of box.content.children) {
    if (el.matches('.tbl')) {
      const table = el.querySelector('table');
      const t = table && readTable(table);
      if (t) out.push({ k: 'tbl', t });
    } else if (el.matches('.foot')) {
      const last = out[out.length - 1];
      if (last?.k === 'tbl') last.t.foot = el.textContent ?? '';
    } else if (el.matches('pre') && el.textContent?.trim()) out.push(textBlock(el.textContent, false));
  }
  return out;
}

async function pictureOf(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Tables first (as the reader does), then plain text; text that lines up like a frame becomes one. */
async function textOrTable(text: string, soft: boolean): Promise<Block[]> {
  if (!text.includes('\u001b') && text.split('\n').length > 2) {
    const found = (await import('./tabular')).tables(text);
    if (found) return fromHtml(found);
  }
  return text.trim() ? [textBlock(text, soft)] : [];
}

async function errorBlock(o: ErrorOutput): Promise<Block> {
  const t = o.traceback;
  const last = t.length && stripAnsi(t[t.length - 1]).trimStart().startsWith(o.ename) ? t.length - 1 : t.length;
  const short = t.length > 4 ? (await import('./trace')).calm(t) : null;
  const lines = (short ? short.slice(0, 1) : t.slice(0, last)).map(stripAnsi).join('\n').replace(/\s+$/, '');
  return { k: 'err', name: o.ename, msg: stripAnsi(o.evalue), rows: lines ? rows([{ text: lines, style: {} }]).slice(0, 12) : [] };
}

export async function prepare(src: Source): Promise<Prepared> {
  const blocks: Block[] = [];
  let skipped = false;
  const [code] = await Promise.all([codeRows(src.code, src.language), fonts()]);
  for (const o of src.outputs) {
    if (o.type === 'stream') blocks.push(...(await textOrTable(foldBars(collapseCarriageReturns(o.text)), o.name === 'stderr')));
    else if (o.type === 'error') blocks.push(await errorBlock(o));
    else {
      const s = describeData(o.data);
      if (s.kind === 'image') {
        try {
          blocks.push({ k: 'img', img: await pictureOf(s.src), alpha: s.alpha });
        } catch {
          skipped = true;
        }
        continue;
      }
      const html = s.html ? (await import('./markdown')).cleanTable(s.html) : null;
      if (html) {
        const found = fromHtml(html);
        if (found.length) {
          blocks.push(...found);
          continue;
        }
      }
      const found = await textOrTable(s.chart ? '' : (s.md ?? s.text), false);
      if (s.rich && !found.some((b) => b.k === 'tbl')) skipped = true;
      blocks.push(...found);
    }
  }
  return { file: src.file, n: src.n, failed: src.outputs.some((o) => o.type === 'error'), code, blocks, skipped };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing

const PAD = { S: 28, M: 48, L: 80 } as const;
const CARD_PAD = 8;
const GAP = 8;
const INSET = 20;
const CARD_R = 18;
const PANEL_R = 10;
const TITLE_H = 36;
const CODE = { size: 13.5, lh: 22 };
const OUT = { size: 13, lh: 21 };
const ERR = { size: 12.5, lh: 20 };

const mono = (size: number, st: Style = {}) => `${st.italic ? 'italic ' : ''}${st.bold ? '600 ' : '400 '}${size}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
const sans = (size: number, weight = 400) => `${weight} ${size}px Inter, -apple-system, system-ui, sans-serif`;

let ruler: CanvasRenderingContext2D | undefined;
const measure = () => (ruler ??= document.createElement('canvas').getContext('2d')!);
const advance = (size: number) => {
  const m = measure();
  m.font = mono(size);
  return m.measureText('0').width;
};
const textWidth = (font: string, text: string) => {
  const m = measure();
  m.font = font;
  return m.measureText(text).width;
};

/** Shortens text with an ellipsis until it fits. */
function fitText(font: string, text: string, max: number): string {
  if (textWidth(font, text) <= max) return text;
  let end = text.length;
  while (end > 1 && textWidth(font, `${text.slice(0, end)}…`) > max) end--;
  return `${text.slice(0, end)}…`;
}

/** Greedy word wrap for prose in the sans face. */
function wrapWords(font: string, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/(?<=\s)/)) {
    if (line && textWidth(font, (line + word).trimEnd()) > max) {
      out.push(line.trimEnd());
      line = '';
    }
    let w = word;
    while (textWidth(font, w.trimEnd()) > max && w.length > 1) {
      let k = w.length - 1;
      while (k > 1 && textWidth(font, w.slice(0, k)) > max) k--;
      out.push(w.slice(0, k));
      w = w.slice(k);
    }
    line += w;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out.length ? out : [''];
}

/** A rounded rectangle with the continuous corner CSS calls a squircle (the superellipse of exponent 4). */
export function squircle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  const steps = 16;
  ctx.beginPath();
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= steps; i++) {
      const t = from + (i / steps) * (Math.PI / 2);
      const c = Math.cos(t);
      const s = Math.sin(t);
      ctx.lineTo(cx + r * Math.sign(c) * Math.abs(c) ** 0.5, cy + r * Math.sign(s) * Math.abs(s) ** 0.5);
    }
  };
  corner(x + r, y + r, Math.PI);
  corner(x + w - r, y + r, Math.PI * 1.5);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  ctx.closePath();
}

const colour = (st: Style, theme: Theme, pal: Palette, ink: string): string => {
  if (st.lc !== undefined || st.dc !== undefined) return (theme === 'dark' ? st.dc : st.lc) ?? ink;
  if (st.rgb) return st.rgb;
  if (st.ansi !== undefined) return pal.a[st.ansi];
  if (typeof st.bg === 'number') return pal.paper;
  return ink;
};

interface Ink {
  size: number;
  cw: number;
  theme: Theme;
  pal: Palette;
  ink: string;
}

/** One glyph per cell, so columns hold exactly and ligatures never form. */
function drawRow(ctx: CanvasRenderingContext2D, row: Row, x: number, base: number, lh: number, k: Ink) {
  let col = 0;
  let prev = x;
  let font = '';
  let fill = '';
  for (const g of row) {
    const st = g.style;
    const px = g.w === 0 ? prev : x + col * k.cw;
    if (st.bg !== undefined) {
      ctx.fillStyle = typeof st.bg === 'number' ? k.pal.a[st.bg] : st.bg;
      ctx.fillRect(px, base - lh * 0.74, g.w * k.cw, lh);
      fill = '';
    }
    if (g.ch !== ' ') {
      const f = mono(k.size, st);
      if (f !== font) ctx.font = font = f;
      const c = colour(st, k.theme, k.pal, k.ink);
      if (c !== fill) ctx.fillStyle = fill = c;
      if (st.dim) ctx.globalAlpha = 0.8;
      ctx.fillText(g.ch, px, base);
      if (st.underline) ctx.fillRect(px, base + 2, g.w * k.cw, 1);
      if (st.dim) ctx.globalAlpha = 1;
    }
    if (g.w) {
      prev = px;
      col += g.w;
    }
  }
}

/** The baseline of a line of `size`px text centred in a line box of `lh`, for a face with these metrics. */
const baseline = (y: number, lh: number, size: number, ascent: number, descent: number) => y + (lh - (ascent + descent) * size) / 2 + ascent * size;
const MONO = [1.02, 0.3] as const;
const SANS = [0.969, 0.242] as const;

interface Piece {
  w: number;
  h: number;
  /** Paints the piece with its top-left corner at (x, y). */
  paint: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

interface Panel extends Piece {
  tone: 'well' | 'well2' | 'tint';
}

export interface Scene {
  w: number;
  h: number;
  /** What was left out to keep the picture a sensible size, for the dialog to say. */
  cut: { code: number; out: number };
  skipped: boolean;
  draw: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function codePanel(p: Prepared, o: Opts, pal: Palette, inner: number, gutter: number, count: { n: number }): Panel {
  const cw = advance(CODE.size);
  const total = p.code.length;
  const shown = total > CODE_CAP ? p.code.slice(0, CODE_HEAD) : p.code;
  const hidden = total - shown.length;
  count.n += hidden;
  const room = Math.max(8, Math.floor((inner - gutter) / cw));
  const lines: { row: Row; no: number | null }[] = [];
  shown.forEach((row, i) => wrap(row, room, indent(row) + 2).forEach((r, k) => lines.push({ row: r, no: k ? null : i + 1 })));
  const h = 16 + lines.length * CODE.lh + (hidden ? 30 : 0) + 16;
  const numW = Math.max(2, String(total).length) * advance(12);
  const k: Ink = { size: CODE.size, cw, theme: o.theme, pal, ink: pal.fg };
  return {
    tone: 'well',
    w: inner + INSET * 2,
    h,
    paint(ctx, x, y) {
      ctx.textBaseline = 'alphabetic';
      lines.forEach(({ row, no }, i) => {
        const top = y + 16 + i * CODE.lh;
        if (no !== null && o.lines) {
          ctx.font = mono(12);
          ctx.fillStyle = pal.fg3;
          ctx.textAlign = 'right';
          ctx.fillText(String(no), x + INSET + numW, baseline(top, CODE.lh, 12, ...MONO));
          ctx.textAlign = 'left';
        }
        drawRow(ctx, row, x + INSET + gutter, baseline(top, CODE.lh, CODE.size, ...MONO), CODE.lh, k);
      });
      if (hidden) {
        ctx.font = sans(12.5);
        ctx.fillStyle = pal.fg3;
        ctx.fillText(`${hidden.toLocaleString()} more lines`, x + INSET + gutter, baseline(y + 16 + lines.length * CODE.lh, 30, 12.5, ...SANS));
      }
    },
  };
}

/** A table piece: the header band, zebra rows, and the columns that fit. */
function tablePiece(t: Table, inner: number, pal: Palette, cut: { n: number }): Piece {
  const hf = sans(12.5, 600);
  const bf = mono(13);
  const bodyRows = t.body.slice(0, TABLE_ROWS);
  const nCols = Math.max(...[...t.head, ...bodyRows].map((r) => r.length));
  const widths = Array.from({ length: nCols }, (_, c) => Math.ceil(Math.max(...t.head.map((r) => textWidth(hf, r[c] ?? '')), ...bodyRows.map((r) => textWidth(bf, r[c] ?? ''))) + 32));
  let keep = nCols;
  let sum = widths.reduce((a, b) => a + b, 0);
  const ELL = 44;
  if (sum > inner) {
    keep = 0;
    sum = ELL;
    while (keep < nCols && sum + widths[keep] <= inner) sum += widths[keep++];
    keep = Math.max(keep, Math.min(t.lead + 1, nCols));
    sum = widths.slice(0, keep).reduce((a, b) => a + b, 0) + ELL;
  } else sum = Math.min(sum, inner);
  const dropped = nCols - keep;
  const cutRows = t.body.length - bodyRows.length;
  cut.n += cutRows;
  const xs: number[] = [];
  let acc = 0;
  for (let c = 0; c < keep; c++) {
    xs.push(acc);
    acc += widths[c];
  }
  const ell = dropped ? acc : -1;
  const width = acc + (dropped ? ELL : 0);
  const HEAD_H = 36;
  const ROW_H = 34;
  const headH = t.head.length * HEAD_H;
  const foot = t.foot || (cutRows || dropped ? `${t.body.length.toLocaleString()} rows × ${nCols} columns` : '');
  const h = headH + bodyRows.length * ROW_H;
  return {
    w: width,
    h: h + (foot ? 24 : 0),
    paint(ctx, x, y) {
      ctx.save();
      squircle(ctx, x, y, width, h, PANEL_R);
      ctx.clip();
      ctx.fillStyle = pal.paper;
      ctx.fillRect(x, y, width, h);
      ctx.fillStyle = pal.well;
      ctx.fillRect(x, y, width, headH);
      bodyRows.forEach((_, i) => {
        if (i % 2 === 1) {
          ctx.fillStyle = pal.zebra;
          ctx.fillRect(x, y + headH + i * ROW_H, width, ROW_H);
        }
      });
      const cell = (text: string, c: number, top: number, rh: number, font: string, ink: string, right: boolean, asc: readonly [number, number], size: number) => {
        ctx.font = font;
        ctx.fillStyle = ink;
        ctx.textAlign = right ? 'right' : 'left';
        const cx = right ? x + xs[c] + widths[c] - 16 : x + xs[c] + 16;
        ctx.fillText(fitText(font, text, widths[c] - 32), cx, baseline(top, rh, size, ...asc));
      };
      t.head.forEach((r, i) => {
        for (let c = 0; c < keep; c++) if (r[c]) cell(r[c], c, y + i * HEAD_H, HEAD_H, hf, pal.fg, !!t.num[c], SANS, 12.5);
        if (dropped) {
          ctx.textAlign = 'center';
          ctx.font = hf;
          ctx.fillStyle = pal.fg3;
          ctx.fillText('…', x + ell + ELL / 2, baseline(y + i * HEAD_H, HEAD_H, 12.5, ...SANS));
        }
      });
      bodyRows.forEach((r, i) => {
        const top = y + headH + i * ROW_H;
        for (let c = 0; c < keep; c++) cell(r[c] ?? '', c, top, ROW_H, bf, c < t.lead ? pal.fg3 : pal.fg, !!t.num[c] && c >= t.lead, MONO, 13);
        if (dropped) {
          ctx.textAlign = 'center';
          ctx.font = bf;
          ctx.fillStyle = pal.fg3;
          ctx.fillText('…', x + ell + ELL / 2, baseline(top, ROW_H, 13, ...MONO));
        }
      });
      ctx.restore();
      ctx.textAlign = 'left';
      if (foot) {
        ctx.font = sans(12);
        ctx.fillStyle = pal.fg3;
        ctx.fillText(foot, x, baseline(y + h, 24, 12, ...SANS) + 2);
      }
    },
  };
}

function outPanel(p: Prepared, o: Opts, pal: Palette, inner: number, count: { n: number }): Panel {
  const cw = advance(OUT.size);
  const cwE = advance(ERR.size);
  const room = Math.max(8, Math.floor(inner / cw));
  const roomE = Math.max(8, Math.floor(inner / cwE));
  const pieces: (Piece & { err?: boolean })[] = [];
  const k = (soft: boolean): Ink => ({ size: OUT.size, cw, theme: o.theme, pal, ink: soft ? pal.fg2 : pal.fg });
  for (const b of p.blocks) {
    if (b.k === 'text') {
      const wrapped = (rs: Row[]) => rs.flatMap((r) => wrap(r, room));
      const head = wrapped(b.rows);
      const tail = wrapped(b.tail);
      count.n += b.hidden;
      const lines = head.length + tail.length;
      const h = lines * OUT.lh + (b.hidden ? 30 : 0);
      const ink = k(b.soft);
      pieces.push({
        w: inner,
        h,
        paint(ctx, x, y) {
          head.forEach((r, i) => drawRow(ctx, r, x, baseline(y + i * OUT.lh, OUT.lh, OUT.size, ...MONO), OUT.lh, ink));
          let at = y + head.length * OUT.lh;
          if (b.hidden) {
            ctx.font = sans(12.5);
            ctx.fillStyle = pal.fg3;
            ctx.fillText(`${b.hidden.toLocaleString()} lines hidden`, x, baseline(at, 30, 12.5, ...SANS));
            at += 30;
          }
          tail.forEach((r, i) => drawRow(ctx, r, x, baseline(at + i * OUT.lh, OUT.lh, OUT.size, ...MONO), OUT.lh, ink));
        },
      });
    } else if (b.k === 'err') {
      const hf = sans(14, 600);
      const bf = sans(14);
      const nameW = textWidth(hf, b.name) + 10;
      const msgLines = b.msg ? wrapWords(bf, b.msg, Math.max(120, inner - nameW)) : [];
      const trace = b.rows.flatMap((r) => wrap(r, roomE));
      const headH = Math.max(1, msgLines.length) * 21;
      const ink: Ink = { size: ERR.size, cw: cwE, theme: o.theme, pal, ink: pal.fg3 };
      pieces.push({
        err: true,
        w: inner,
        h: headH + (trace.length ? 8 + trace.length * ERR.lh : 0),
        paint(ctx, x, y) {
          ctx.font = hf;
          ctx.fillStyle = pal.danger;
          ctx.fillText(b.name, x, baseline(y, 21, 14, ...SANS));
          ctx.font = bf;
          ctx.fillStyle = pal.fg;
          msgLines.forEach((l, i) => ctx.fillText(l, x + nameW, baseline(y + i * 21, 21, 14, ...SANS)));
          trace.forEach((r, i) => drawRow(ctx, r, x, baseline(y + headH + 8 + i * ERR.lh, ERR.lh, ERR.size, ...MONO), ERR.lh, ink));
        },
      });
    } else if (b.k === 'img') {
      const pad = b.alpha ? 12 : 0;
      const nat = b.img.naturalWidth || 1;
      const scale = Math.min(1, (inner - pad * 2) / nat, 520 / (b.img.naturalHeight || 1));
      const w = Math.round(nat * scale);
      const h = Math.round((b.img.naturalHeight || 1) * scale);
      pieces.push({
        w: w + pad * 2,
        h: h + pad * 2,
        paint(ctx, x, y) {
          ctx.save();
          squircle(ctx, x, y, w + pad * 2, h + pad * 2, PANEL_R);
          ctx.clip();
          ctx.fillStyle = b.alpha ? '#f3f3f5' : '#ffffff';
          ctx.fillRect(x, y, w + pad * 2, h + pad * 2);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(b.img, x + pad, y + pad, w, h);
          // the reader softens a bright figure a little in the dark theme
          if (o.theme === 'dark' && !b.alpha) {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(x, y, w, h);
          }
          ctx.restore();
        },
      });
    } else pieces.push(tablePiece(b.t, inner, pal, count));
  }
  const GAPS = 10;
  const top = pieces[0]?.err ? 16 : 14;
  const total = pieces.reduce((n, q) => n + q.h, 0) + Math.max(0, pieces.length - 1) * GAPS;
  const onlyErr = pieces.length > 0 && pieces.every((q) => q.err);
  return {
    tone: onlyErr ? 'tint' : 'well2',
    w: inner + INSET * 2,
    h: top + total + 14,
    paint(ctx, x, y) {
      let at = y + top;
      for (const q of pieces) {
        if (q.err && !onlyErr) {
          ctx.fillStyle = pal.tint;
          ctx.fillRect(x, at - 14, inner + INSET * 2, q.h + 24);
        }
        q.paint(ctx, x + INSET, at);
        at += q.h + GAPS;
      }
    },
  };
}

/** What a block needs, in pixels, before any wrapping. */
function need(p: Prepared, gutter: number): { code: number; out: number } {
  const cwC = advance(CODE.size);
  const cwO = advance(OUT.size);
  const code = gutter + Math.max(0, ...p.code.map(cols)) * cwC;
  let out = 0;
  for (const b of p.blocks) {
    if (b.k === 'text') out = Math.max(out, Math.max(0, ...b.rows.map(cols), ...b.tail.map(cols)) * cwO);
    else if (b.k === 'err') out = Math.max(out, 420);
    else if (b.k === 'img') out = Math.max(out, b.img.naturalWidth + (b.alpha ? 24 : 0));
    else {
      const hf = sans(12.5, 600);
      const bf = mono(13);
      const nCols = Math.max(...[...b.t.head, ...b.t.body.slice(0, TABLE_ROWS)].map((r) => r.length));
      let sum = 0;
      for (let c = 0; c < nCols; c++) sum += Math.ceil(Math.max(...b.t.head.map((r) => textWidth(hf, r[c] ?? '')), ...b.t.body.slice(0, TABLE_ROWS).map((r) => textWidth(bf, r[c] ?? ''))) + 32);
      out = Math.max(out, sum);
    }
  }
  return { code, out };
}

const TONE = (pal: Palette, t: Panel['tone']) => (t === 'well' ? pal.well : t === 'tint' ? pal.tint : pal.well2);

export function scene(p: Prepared, o: Opts): Scene {
  const pal = palette(o.theme);
  const haveCode = p.code.length > 0;
  const haveOut = p.blocks.length > 0;
  const showCode = (o.show !== 'out' && haveCode) || (!haveOut && haveCode);
  const showOut = (o.show !== 'code' && haveOut) || (!haveCode && haveOut);
  const side = o.layout === 'side' && showCode && showOut;
  const cut = { n: 0 };
  const codeCut = { n: 0 };

  const digits = Math.max(2, String(p.code.length).length);
  const gutter = o.lines ? Math.ceil(digits * advance(12)) + 20 : 0;
  const want = need(p, gutter);
  const innerS = clamp(Math.max(showCode ? want.code : 0, showOut ? want.out : 0), 360, 760);
  const innerC = side ? clamp(want.code, 280, 520) : innerS;
  const innerO = side ? clamp(want.out, 280, 520) : innerS;
  const code = showCode ? codePanel(p, o, pal, innerC, gutter, codeCut) : null;
  const out = showOut ? outPanel(p, o, pal, innerO, cut) : null;
  const panels = [code, out].filter((q): q is Panel => !!q);

  const bodyW = side ? panels.reduce((n, q) => n + q.w, 0) + GAP : Math.max(...panels.map((q) => q.w));
  const bodyH = side ? Math.max(...panels.map((q) => q.h)) : panels.reduce((n, q) => n + q.h, 0) + (panels.length - 1) * GAP;
  const cardW = bodyW + CARD_PAD * 2;
  const cardH = bodyH + CARD_PAD * 2 + (o.title ? TITLE_H : 0);

  const bd = BACKDROPS.find((b) => b.id === o.backdrop)!;
  const margin = o.backdrop === 'none' ? 0 : PAD[o.pad];
  let w = cardW + margin * 2;
  let h = cardH + margin * 2;
  // A 16:9 or square file is a frame of a set size, and the card is scaled to sit in it.
  let k = 1;
  if (o.shape !== 'fit') {
    const [fw, fh] = o.shape === 'wide' ? FRAME.wide : FRAME.square;
    const m = margin || 24;
    k = clamp(Math.min((fw - m * 2) / cardW, (fh - m * 2) / cardH), 0.5, 1.4);
    w = fw;
    h = fh;
    // a card too large even at the smallest scale makes the frame grow, keeping its shape
    const needW = Math.ceil(cardW * k + m * 2);
    const needH = Math.ceil(cardH * k + m * 2);
    if (needW > w || needH > h) {
      w = Math.max(w, needW);
      h = Math.max(h, needH);
      if (w / h < fw / fh) w = Math.ceil(h * (fw / fh));
      else h = Math.ceil(w / (fw / fh));
    }
  }
  const fx = Math.round((w - cardW * k) / 2);
  const fy = Math.round((h - cardH * k) / 2);

  return {
    w,
    h,
    cut: { code: codeCut.n, out: cut.n },
    skipped: p.skipped,
    draw(ctx, s) {
      ctx.save();
      ctx.scale(s, s);
      ctx.textBaseline = 'alphabetic';
      // the backdrop: a diagonal blend with a soft light in the corner
      if (bd.a) {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, bd.a);
        g.addColorStop(1, bd.b!);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const glow = ctx.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, Math.max(w, h) * 0.8);
        glow.addColorStop(0, 'rgba(255,255,255,0.28)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      } else if (o.shape !== 'fit') {
        ctx.fillStyle = pal.page;
        ctx.fillRect(0, 0, w, h);
      }
      // the card, drawn from its own corner at its own scale
      const dark = o.theme === 'dark' || o.backdrop === 'ink' || o.backdrop === 'dusk';
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(k, k);
      const cx = 0;
      const cy = 0;
      ctx.save();
      if (bd.a) {
        // a shadow is not scaled with the drawing, so its size is worked out here
        ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(30,36,70,0.26)';
        ctx.shadowBlur = 44 * s * k;
        ctx.shadowOffsetY = 20 * s * k;
      }
      squircle(ctx, cx, cy, cardW, cardH, CARD_R);
      ctx.fillStyle = pal.paper;
      ctx.fill();
      ctx.restore();
      ctx.save();
      squircle(ctx, cx, cy, cardW, cardH, CARD_R);
      ctx.clip();
      if (o.backdrop === 'none') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = pal.line;
        ctx.stroke();
      } else if (o.theme === 'dark') {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(cx, cy, cardW, 1);
      }
      ctx.restore();

      let top = cy + CARD_PAD;
      if (o.title) {
        const f = sans(12.5, 500);
        ctx.font = f;
        ctx.fillStyle = pal.fg3;
        ctx.textAlign = 'left';
        const right = p.n === null ? 0 : textWidth(mono(12), `[${p.n}]`) + 26;
        ctx.fillText(fitText(f, p.file, cardW - CARD_PAD * 2 - 24 - right), cx + CARD_PAD + 12, baseline(top, TITLE_H, 12.5, ...SANS));
        if (p.n !== null) {
          const edge = cx + cardW - CARD_PAD - 12;
          ctx.font = mono(12);
          ctx.textAlign = 'right';
          ctx.fillText(`[${p.n}]`, edge - 14, baseline(top, TITLE_H, 12, ...MONO));
          ctx.textAlign = 'left';
          ctx.beginPath();
          ctx.arc(edge - 3, top + TITLE_H / 2, 3, 0, Math.PI * 2);
          ctx.fillStyle = p.failed ? pal.danger : pal.ok;
          ctx.fill();
        }
        top += TITLE_H;
      }
      let x = cx + CARD_PAD;
      let y = top;
      for (const q of panels) {
        const ph = q.h;
        const pw = side ? q.w : bodyW;
        ctx.save();
        squircle(ctx, x, y, pw, ph, PANEL_R);
        ctx.clip();
        ctx.fillStyle = TONE(pal, q.tone);
        ctx.fillRect(x, y, pw, ph);
        q.paint(ctx, x, y);
        ctx.restore();
        if (side) x += q.w + GAP;
        else y += q.h + GAP;
      }
      ctx.restore();
      ctx.restore();
    },
  };
}
