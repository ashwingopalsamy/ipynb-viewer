import type { CodeCell } from './notebook';

// State shared by the toolbar, the menus and the outline. It loads with the extras, never with the core.
export type Pop = 'settings' | 'toc' | 'keys' | 'figure';

/** The picture a reader is about to save: its data, and the button the menu hangs from. */
export interface Figure {
  src: string;
  alpha: boolean;
  /** The part of the file name that says where the picture came from. */
  tag: string;
  el: HTMLElement;
}

export const ui = $state<{
  pop: Pop | null;
  sections: number;
  figures: number;
  scrambled: boolean;
  replayed: boolean;
  shelf: boolean;
  fig: Figure | null;
  shot: CodeCell | null;
  file: string;
  lang: string | null;
}>({
  pop: null,
  sections: 0,
  figures: 0,
  scrambled: false,
  replayed: false,
  shelf: false,
  fig: null,
  shot: null,
  file: '',
  lang: null,
});

export const toggle = (id: Pop) => (ui.pop = ui.pop === id ? null : id);

// Single-key shortcuts can be turned off (WCAG 2.1.4); the choice sticks.
export const prefs = $state({ keys: true });
try {
  prefs.keys = localStorage.getItem('keys') !== 'off';
} catch {
  // storage can be blocked; the default applies
}

export function setKeys(on: boolean) {
  prefs.keys = on;
  try {
    localStorage.setItem('keys', on ? 'on' : 'off');
  } catch {
    // the choice then lasts for this visit only
  }
}

/** True when a single key should act: no modifier, not typing, and the reader has not switched them off. */
export const single = (e: KeyboardEvent) =>
  prefs.keys && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as Element).closest('input, textarea, select, [contenteditable]');

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.documentElement.dataset.pf?.includes('calm');

const miss = (el: Element, block: 'start' | 'center') => {
  const r = el.getBoundingClientRect();
  return block === 'center' ? r.top + r.height / 2 - innerHeight / 2 : r.top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
};

const quit = ['wheel', 'touchstart', 'keydown'];

/**
 * Scrolls an element into place and keeps correcting until it rests there. Cells below the screen settle their
 * real height as they arrive, so the first aim can fall short; the reader's own input ends the correction.
 */
export function jump(to: Element | null | undefined | (() => Element | null | undefined), block: 'start' | 'center' = 'start') {
  // a function is asked again on every correction, for a target that only exists once its cell has been drawn
  const find = () => (typeof to === 'function' ? to() : to);
  if (!find()) return;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    clearTimeout(timer);
    clearTimeout(limit);
    removeEventListener('scrollend', check);
    quit.forEach((t) => removeEventListener(t, end));
  };
  const check = () => {
    removeEventListener('scrollend', check);
    const el = find();
    if (!el?.isConnected || Math.abs(miss(el, block)) <= 4 || ++tries > 3) return end();
    el.scrollIntoView({ behavior: 'auto', block });
    wait();
  };
  const wait = () => ('onscrollend' in window ? addEventListener('scrollend', check) : (timer = setTimeout(check, 500)));
  const limit = setTimeout(end, 3000);
  quit.forEach((t) => addEventListener(t, end, { passive: true }));
  find()?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block });
  wait();
}
