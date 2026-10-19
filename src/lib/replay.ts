import type { Cell } from './notebook';

/**
 * Puts executed code cells in the order they ran. Markdown and unrun cells keep their places,
 * so the story around the code stays where the author wrote it.
 */
export function reorder(cells: readonly Cell[]): Cell[] {
  const ran: Cell[] = cells
    .filter((c) => c.type === 'code' && c.executionCount !== null)
    .sort((a, b) => (a.type === 'code' ? (a.executionCount ?? 0) : 0) - (b.type === 'code' ? (b.executionCount ?? 0) : 0));
  let k = 0;
  return cells.map((c) => (c.type === 'code' && c.executionCount !== null ? ran[k++] : c));
}
