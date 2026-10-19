// What the reader chose to see everywhere. Each layer has its own counter, so a one-off reveal
// ends the moment that layer's switch is flipped, and nothing else depends on the order of clicks.
export const view = $state({ code: true, out: true, codeAt: 0, outAt: 0 });

export function setCode(on: boolean) {
  view.code = on;
  view.codeAt++;
}

export function setOut(on: boolean) {
  view.out = on;
  view.outAt++;
}

/** Runs a change that reflows the page so that what the reader is looking at stays where it was. */
export async function hold(at: HTMLElement, change: () => void, keep: 'self' | 'cell' | 'fold' = 'self', to?: () => HTMLElement | null | undefined) {
  const { anchored } = await import('./anchor');
  return anchored(at, change, keep, to);
}

/** Content that appears because the reader asked for it fades up a few pixels. Content that was there at load just is. */
export function rise(node: HTMLElement, on: boolean) {
  if (!on) return;
  node.classList.add('rise');
  node.addEventListener('animationend', () => node.classList.remove('rise'), { once: true });
}
