<script lang="ts" module>
  export { default as Actions } from './Actions.svelte';
</script>

<script lang="ts">
  import type { Cell } from './notebook';
  import './rare.css';
  import './ui.css';
  import './prefs.css';
  import Toc from './Toc.svelte';
  import Shelf from './Shelf.svelte';
  import Resume from './Resume.svelte';
  import Menus from './Menus.svelte';
  import { reorder as order } from './replay';
  import { ui, toggle, single, jump } from './ui.svelte';
  import { has } from './prefs.svelte';
  import { spotlight } from './spot';
  import { view, setCode, setOut, hold } from './fold.svelte';

  let {
    cells,
    raw,
    name,
    language,
    ready,
    sections = $bindable(0),
    chapter = $bindable(''),
    replayed = $bindable(false),
    reorder = $bindable(),
  }: {
    cells: readonly Cell[];
    /** The notebook as saved, before any replay reordering. */
    raw: readonly Cell[];
    name: string;
    language: string | null;
    ready: boolean;
    sections: number;
    chapter: string;
    replayed: boolean;
    reorder: ((cells: readonly Cell[]) => Cell[]) | undefined;
  } = $props();

  $effect(() => {
    reorder = order;
  });
  $effect(() => {
    replayed = ui.replayed;
  });
  $effect(() => {
    ui.sections = sections;
  });
  $effect(() => {
    ui.file = name;
    ui.lang = language;
  });

  // The save menu for pictures and the screenshot dialog load when the first one is asked for.
  let Figure = $state<typeof import('./Figure.svelte').default>();
  let Shot = $state<typeof import('./Shot.svelte').default>();
  $effect(() => {
    if (ui.fig && !Figure) import('./Figure.svelte').then((m) => (Figure = m.default));
  });
  $effect(() => {
    if (ui.shot && !Shot) import('./Shot.svelte').then((m) => (Shot = m.default));
  });
  // A new file starts clean.
  $effect(() => {
    if (!ready) (ui.replayed = false), (ui.shelf = false), (ui.pop = null);
  });
  // The first fold should not wait for a download.
  $effect(() => {
    import('./anchor');
  });

  // True when the counts in the gutters do not climb from top to bottom.
  $effect(() => {
    let last = 0;
    ui.scrambled = false;
    for (const c of raw) {
      if (c.type !== 'code' || c.executionCount === null) continue;
      if (c.executionCount < last) return void (ui.scrambled = true);
      last = c.executionCount;
    }
  });

  const cellsOnPage = () => [...document.querySelectorAll<HTMLElement>('.notebook > [data-cell]')];
  const reading = () => cellsOnPage().findLast((c) => c.getBoundingClientRect().top <= 140);

  // The notebook is one tab stop; arrows move between its handles and rows.
  const ITEMS = '.notebook .handle:not(.quiet), .notebook .row:not(.closed), .notebook .snap, .notebook .copy, .notebook .save';
  let stop: HTMLElement | undefined;
  const items = () => [...document.querySelectorAll<HTMLElement>(ITEMS)];
  function park(el: HTMLElement | undefined) {
    if (!el || el === stop) return;
    stop?.setAttribute('tabindex', '-1');
    stop = el;
    el.tabIndex = 0;
  }
  $effect(() => {
    if (ready) queueMicrotask(() => park(items()[0]));
  });

  function keys(e: KeyboardEvent) {
    if (e.key === 'Tab' && !(stop?.isConnected && stop.matches(ITEMS))) {
      stop = undefined;
      park(items()[0]);
    }
    // the screenshot dialog owns the keyboard while it is up
    if (ui.shot) return;
    if (e.key === 'Escape') {
      if (ui.pop) (ui.pop = null), e.preventDefault();
      return;
    }
    const on = document.activeElement as HTMLElement | null;
    if (on?.matches(ITEMS) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      const list = items();
      const i = list.indexOf(on);
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
      list[Math.min(list.length - 1, Math.max(0, to))]?.focus();
      return e.preventDefault();
    }
    if (!single(e)) return;
    const here = reading();
    if (e.key === 'c') hold(here ?? document.body, () => setCode(!view.code), 'cell');
    else if (e.key === 'o') hold(here ?? document.body, () => setOut(!view.out), 'cell');
    else if (e.key === 'x') here?.querySelector<HTMLElement>('.handle')?.click();
    else if (e.key === 's') {
      const cell = cells.find((c) => c.id === here?.dataset.cell);
      if (cell?.type !== 'code' || (!cell.source.trim() && !cell.outputs.length)) return;
      ui.shot = cell;
    }
    else if (e.key === 'j' || e.key === 'k') {
      const list = cellsOnPage();
      jump(e.key === 'j' ? list.find((c) => c.getBoundingClientRect().top > 100) : list.findLast((c) => c.getBoundingClientRect().top < 80));
    } else if (e.key === 't') {
      if (ui.sections < 2) return;
      // on a phone the list is a popover; elsewhere the ticks take focus, which opens the list, and the current row follows
      if (matchMedia('(min-width: 721px)').matches) {
        document.querySelector<HTMLElement>('.rail .stack')?.focus();
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.rail .panel .t[tabindex="0"]')?.focus({ preventScroll: true }));
      } else toggle('toc');
    } else if (e.key === '?') toggle('keys');
    else return;
    e.preventDefault();
  }

  // The header softens its edge once the page has moved, and can step aside while the reader goes down.
  let lastY = 0;
  function moved() {
    const y = scrollY;
    document.documentElement.toggleAttribute('data-scrolled', y > 8);
    if (Math.abs(y - lastY) < 6) return;
    if (has('hush')) document.querySelector('.bar')?.toggleAttribute('data-hush', y > lastY && y > 120 && !ui.pop);
    lastY = y;
  }
  // Anything that needs the header brings it back.
  $effect(() => {
    if (ui.pop) document.querySelector('.bar')?.removeAttribute('data-hush');
  });

  $effect(() => (has('spot') && ready ? spotlight() : undefined));

  function away(e: PointerEvent) {
    if (ui.pop && !(e.target as Element).closest('.pop, [data-pop]')) ui.pop = null;
  }
</script>

<svelte:window onkeydown={keys} onscroll={moved} onpointerdown={away} onfocusin={(e) => {
    const on = e.target as Element;
    if (on.matches?.(ITEMS)) park(on as HTMLElement);
    if (on.closest?.('.bar')) document.querySelector('.bar')?.removeAttribute('data-hush');
  }} />

<Toc {cells} bind:count={sections} bind:chapter />
<Menus />
{#if Figure}<Figure />{/if}
{#if Shot}<Shot />{/if}
<Shelf {cells} bind:count={ui.figures} bind:open={ui.shelf} />
<Resume {cells} {name} {ready} />
