import type { CodeCell } from './notebook';

/** True when `s` runs past `n` lines. Stops looking as soon as it knows. */
export function over(s: string, n: number): boolean {
  let i = -1;
  while (n-- > 0) {
    i = s.indexOf('\n', i + 1);
    if (i < 0) return false;
  }
  return true;
}

/**
 * A cell is long, and earns a fold handle, when its code runs past 10 lines, its text output past 14,
 * or it shows a picture or a table. Decided from the data, never from measured height.
 */
export function long(cell: CodeCell): boolean {
  if (over(cell.source.replace(/\s+$/, ''), 10)) return true;
  for (const o of cell.outputs) {
    if (o.type === 'stream') {
      if (over(o.text.replace(/\s+$/, ''), 14)) return true;
    } else if (o.type !== 'error') {
      const d = o.data;
      if (Object.keys(d).some((m) => m.startsWith('image/') && m !== 'image/svg+xml')) return true;
      if (typeof d['text/html'] === 'string' && d['text/html'].includes('<table')) return true;
      if (typeof d['text/plain'] === 'string' && over(d['text/plain'].replace(/\s+$/, ''), 14)) return true;
    }
  }
  return false;
}
