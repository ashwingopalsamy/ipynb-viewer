import type { Cell } from './notebook';

export interface Heading {
  /** Id of the markdown cell the heading lives in. */
  cell: string;
  /** Position among all headings of that cell, to find the rendered element later. */
  nth: number;
  /** 0 for the top level present in the notebook, 1 and 2 for the levels below it. */
  depth: number;
  text: string;
  /** Where the heading sits along the notebook, 0 to 1, by rough reading length. */
  at: number;
}

export interface Outline {
  headings: Heading[];
  /** The heading level (1 to 6) that counts as the top of this notebook. */
  top: number;
  /** Positions, 0 to 1, of cells that show a picture or fail. */
  figures: number[];
  errors: number[];
}

interface Raw {
  level: number;
  text: string;
}

const FENCE = /^ {0,3}(```|~~~)/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;

const plain = (s: string) =>
  s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*`~]|(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

interface Facts {
  heads: Raw[];
  weight: number;
  figure: boolean;
  error: boolean;
}

const cache = new WeakMap<Cell, Facts>();

function facts(cell: Cell): Facts {
  let f = cache.get(cell);
  if (f) return f;
  const heads: Raw[] = [];
  let weight = 1 + cell.source.split('\n').length * 0.6;
  let figure = false;
  let error = false;
  if (cell.type === 'markdown' && cell.source.includes('#')) {
    let fenced = false;
    for (const line of cell.source.split('\n')) {
      if (FENCE.test(line)) fenced = !fenced;
      else if (!fenced) {
        const m = ATX.exec(line);
        const text = m && plain(m[2]);
        if (text) heads.push({ level: m[1].length, text });
      }
    }
  } else if (cell.type === 'code') {
    for (const o of cell.outputs) {
      if (o.type === 'error') (error = true), (weight += 4);
      else if (o.type === 'stream') weight += Math.min(8, 1 + o.text.length / 90);
      else if (Object.keys(o.data).some((m) => m.startsWith('image/') && m !== 'image/svg+xml')) (figure = true), (weight += 14);
      else weight += 3;
    }
  }
  f = { heads, weight, figure, error };
  cache.set(cell, f);
  return f;
}

/** Headings in reading order (three levels at most), plus where figures and errors fall. */
export function outline(cells: readonly Cell[]): Outline {
  let top = 7;
  let total = 0;
  const list = cells.map((c) => {
    const f = facts(c);
    for (const h of f.heads) top = Math.min(top, h.level);
    const start = total;
    total += f.weight;
    return { f, start };
  });
  const headings: Heading[] = [];
  const figures: number[] = [];
  const errors: number[] = [];
  list.forEach(({ f, start }, i) => {
    const at = total ? start / total : 0;
    f.heads.forEach((h, nth) => {
      if (h.level - top <= 2) headings.push({ cell: cells[i].id, nth, depth: h.level - top, text: h.text, at });
    });
    if (f.figure) figures.push(at);
    if (f.error) errors.push(at);
  });
  return { headings, top, figures, errors };
}
