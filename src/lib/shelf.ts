import type { Cell } from './notebook';
import { describeData } from './mime';

export interface Figure {
  cell: string;
  /** Execution count of the cell, when it has one. */
  n: number | null;
  src: string;
  alpha: boolean;
}

/** Every raster picture a notebook shows, in reading order. */
export function figures(cells: readonly Cell[]): Figure[] {
  const found: Figure[] = [];
  for (const cell of cells) {
    if (cell.type !== 'code') continue;
    for (const o of cell.outputs) {
      if (o.type !== 'display' && o.type !== 'result') continue;
      const s = describeData(o.data);
      if (s.kind === 'image') found.push({ cell: cell.id, n: cell.executionCount, src: s.src, alpha: s.alpha });
    }
  }
  return found;
}
