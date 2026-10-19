import { tick } from 'svelte';

// Room under the toolbar. A cell folded from far below its top comes back to rest here.
const FLOOR = 64;

/**
 * Applies `change` and scrolls by whatever the page moved, so the trigger (or its cell's top edge) stays put.
 * 'self' keeps the trigger where it was, 'cell' keeps the cell's top edge, and 'fold' does the same
 * but never leaves the cell above the screen. When the trigger gives way to a counterpart (a row that
 * folds into its opposite), `to` names it and it takes over as the anchor.
 */
export async function anchored(at: HTMLElement, change: () => void, keep: 'self' | 'cell' | 'fold' = 'self', to?: () => HTMLElement | null | undefined) {
  const cell = at.closest<HTMLElement>('[data-cell]');
  const id = cell?.dataset.cell;
  const focused = document.activeElement === at;
  const find = () => (id === undefined ? null : [...document.querySelectorAll<HTMLElement>('[data-cell]')].find((c) => c.dataset.cell === id) ?? null);
  const mark = keep === 'self' ? at : (cell ?? at);
  const before = mark.getBoundingClientRect().top;
  const root = document.scrollingElement as HTMLElement;
  root.style.overflowAnchor = 'none';
  change();
  await tick();
  const next = keep === 'self' ? to?.() : null;
  const now = next ?? (mark.isConnected ? mark : (find() ?? mark));
  const top = now.getBoundingClientRect().top;
  const want = keep === 'fold' && before < 0 ? FLOOR : before;
  if (top !== want) scrollBy(0, top - want);
  root.style.overflowAnchor = '';
  // A row that gave way to its content leaves focus nowhere; hand it to the cell's handle.
  if (focused && !at.isConnected) (to?.() ?? find()?.querySelector<HTMLElement>('.handle:not(.quiet), .row, .card'))?.focus({ preventScroll: true });
}
