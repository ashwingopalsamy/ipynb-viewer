/** Arrow keys inside a radio group: moves to the next option that is not disabled, wrapping at the ends. */
export function roving(e: KeyboardEvent, from: number, count: number, skip: (i: number) => boolean, pick: (i: number) => void) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!step) return;
  let to = from;
  for (let k = 0; k < count; k++) {
    to = (to + step + count) % count;
    if (!skip(to)) break;
  }
  if (to === from || skip(to)) return;
  pick(to);
  // the option that took the choice also takes focus
  queueMicrotask(() => (e.currentTarget as HTMLElement | null)?.parentElement?.querySelectorAll<HTMLElement>('[role=radio]')[to]?.focus());
  e.preventDefault();
}
