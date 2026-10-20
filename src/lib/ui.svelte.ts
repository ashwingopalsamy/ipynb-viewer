import type { CodeCell } from './notebook';
import type { Trace } from './names';
import type { Report } from './insight/diff';

// State shared by the toolbar, the menus and the outline. It loads with the extras, never with the core.
export type Pop = 'settings' | 'toc' | 'keys' | 'figure' | 'md' | 'search' | 'privacy' | 'info' | 'compare' | 'open';

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
  /** The picture shown full screen, and the button it was opened from. */
  light: { src: string; cell: string; el: HTMLElement } | null;
  trace: Trace | null;
  file: string;
  lang: string | null;
  /** Whether copies leave out the secrets the scan found. On unless the reader says otherwise. */
  hide: boolean;
  /** The other notebook being compared with this one, and what differs. */
  cmp: { name: string; report: Report } | null;
}>({
  pop: null,
  sections: 0,
  figures: 0,
  scrambled: false,
  replayed: false,
  shelf: false,
  fig: null,
  shot: null,
  light: null,
  trace: null,
  file: '',
  lang: null,
  hide: true,
  cmp: null,
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

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const miss = (el: Element, block: 'start' | 'center') => {
  const r = el.getBoundingClientRect();
  return block === 'center' ? r.top + r.height / 2 - innerHeight / 2 : r.top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
};

const quit = ['wheel', 'touchstart', 'keydown'];

// Scrolling the contents list (its momentum outlasts the click) is not the reader taking the page back.
const mine = (e: Event) => e.type === 'wheel' && !!(e.target as Element).closest?.('.rail, .pop');

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
    quit.forEach((t) => removeEventListener(t, stop));
  };
  const stop = (e: Event) => mine(e) || end();
  const check = () => {
    removeEventListener('scrollend', check);
    const el = find();
    if (!el?.isConnected || Math.abs(miss(el, block)) <= 4 || ++tries > 3) return end();
    el.scrollIntoView({ behavior: 'auto', block });
    wait();
  };
  const wait = () => ('onscrollend' in window ? addEventListener('scrollend', check) : (timer = setTimeout(check, 500)));
  const limit = setTimeout(end, 3000);
  quit.forEach((t) => addEventListener(t, stop, { passive: true }));
  find()?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block });
  wait();
}
