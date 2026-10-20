import type { Cell } from '../notebook';

// Two versions of a notebook, cell by cell: what was added, what went, what was edited, and where only the outputs
// differ (a re-run, a changed result). Cells are matched by their text, so moving through a notebook does not look like a rewrite.

export type Kind = 'added' | 'removed' | 'changed' | 'outputs';
export interface Line {
  mark: ' ' | '+' | '-';
  text: string;
}
export interface Change {
  kind: Kind;
  /** Index in the first notebook, for a cell that was there. */
  a?: number;
  /** Index in the second notebook, for a cell that is there now. */
  b?: number;
  type: Cell['type'];
  /** For an edit, the lines that differ with a little around them. */
  lines?: Line[];
  /** The text of an added or removed cell, cut short. */
  text?: string;
}
export interface Report {
  changes: Change[];
  same: number;
  added: number;
  removed: number;
  changed: number;
  outputs: number;
  /** Set when the notebooks were too large to compare in full. */
  partial: boolean;
}

const MOST_CELLS = 3000;
const MOST_LINES = 400;
const CONTEXT = 2;

const key = (c: Cell) => `${c.type}\0${c.source}`;
const outs = (c: Cell) => (c.type === 'code' ? JSON.stringify(c.outputs) : '');

/** Positions of the longest run of equal items, as pairs. */
function lcs<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * w + j] = eq(a[i], b[j]) ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (eq(a[i], b[j])) out.push([i++, j++]);
    else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) i++;
    else j++;
  }
  return out;
}

/** The lines that differ between two texts, each with a few lines of what stayed. */
export function lineDiff(before: string, after: string): Line[] {
  const x = before.split('\n').slice(0, MOST_LINES);
  const y = after.split('\n').slice(0, MOST_LINES);
  const all: Line[] = [];
  let i = 0;
  let j = 0;
  for (const [p, q] of [...lcs(x, y, (s, t) => s === t), [x.length, y.length] as [number, number]]) {
    while (i < p) all.push({ mark: '-', text: x[i++] });
    while (j < q) all.push({ mark: '+', text: y[j++] });
    if (p < x.length) all.push({ mark: ' ', text: x[i] });
    i++;
    j++;
  }
  const keep = new Set<number>();
  all.forEach((l, k) => {
    if (l.mark !== ' ') for (let d = -CONTEXT; d <= CONTEXT; d++) keep.add(k + d);
  });
  const out: Line[] = [];
  all.forEach((l, k) => {
    if (keep.has(k)) out.push(l);
    else if (out.length && out[out.length - 1].text !== '…') out.push({ mark: ' ', text: '…' });
  });
  return out;
}

const brief = (s: string) => (s.length > 600 ? s.slice(0, 600) + '…' : s);

export function compare(first: readonly Cell[], second: readonly Cell[]): Report {
  const partial = first.length > MOST_CELLS || second.length > MOST_CELLS;
  const a = partial ? first.slice(0, MOST_CELLS) : first;
  const b = partial ? second.slice(0, MOST_CELLS) : second;
  const pairs = lcs(a, b, (x, y) => key(x) === key(y));
  const r: Report = { changes: [], same: 0, added: 0, removed: 0, changed: 0, outputs: 0, partial };
  let i = 0;
  let j = 0;
  const gap = (ai: number, bj: number) => {
    // between two matches, cells of the same type that line up in order are edits of each other
    while (i < ai && j < bj && a[i].type === b[j].type) {
      r.changes.push({ kind: 'changed', a: i, b: j, type: b[j].type, lines: lineDiff(a[i].source, b[j].source) });
      r.changed++;
      i++;
      j++;
    }
    for (; i < ai; i++) (r.changes.push({ kind: 'removed', a: i, type: a[i].type, text: brief(a[i].source) }), r.removed++);
    for (; j < bj; j++) (r.changes.push({ kind: 'added', b: j, type: b[j].type, text: brief(b[j].source) }), r.added++);
  };
  for (const [p, q] of pairs) {
    gap(p, q);
    if (outs(a[p]) !== outs(b[q])) (r.changes.push({ kind: 'outputs', a: p, b: q, type: b[q].type }), r.outputs++);
    else r.same++;
    i = p + 1;
    j = q + 1;
  }
  gap(a.length, b.length);
  return r;
}
