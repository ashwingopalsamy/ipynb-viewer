<script lang="ts" module>
  export { default as Actions } from './Actions.svelte';
</script>

<script lang="ts">
  import type { Cell, NotebookMeta } from './notebook';
  import './rare.css';
  import './ui.css';
  import './prefs.css';
  import { session } from './edit/session.svelte';
  import Toc from './Toc.svelte';
  import Shelf from './Shelf.svelte';
  import Resume from './Resume.svelte';
  import Menus from './Menus.svelte';
  import Net from './Net.svelte';
  import Privacy from './Privacy.svelte';
  import { reorder as order } from './replay';
  import { ui, toggle, single, jump } from './ui.svelte';
  import { has } from './prefs.svelte';
  import { spotlight } from './spot';
  import { view, setCode, setOut, hold } from './fold.svelte';

  let {
    cells,
    raw,
    meta,
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
    /** What the file says about itself: format, kernel, language. Null until the file has been read. */
    meta: NotebookMeta | null;
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
  let Pill = $state<typeof import('./Trace.svelte').default>();
  let Hand = $state<typeof import('./Handoff.svelte').default>();
  let Light = $state<typeof import('./Lightbox.svelte').default>();
  let Find = $state<typeof import('./Search.svelte').default>();
  let Info = $state<typeof import('./Insights.svelte').default>();
  let Diff = $state<typeof import('./Compare.svelte').default>();
  $effect(() => {
    if (ui.fig && !Figure) import('./Figure.svelte').then((m) => (Figure = m.default));
  });
  $effect(() => {
    if (ui.shot && !Shot) import('./Shot.svelte').then((m) => (Shot = m.default));
  });
  $effect(() => {
    if (ui.pop === 'md' && !Hand) import('./Handoff.svelte').then((m) => (Hand = m.default));
  });
  $effect(() => {
    if (ui.light && !Light) import('./Lightbox.svelte').then((m) => (Light = m.default));
  });
  $effect(() => {
    if (ui.pop === 'info' && !Info) import('./Insights.svelte').then((m) => (Info = m.default));
  });
  $effect(() => {
    if (ui.pop === 'compare' && !Diff) import('./Compare.svelte').then((m) => (Diff = m.default));
  });
  $effect(() => {
    if (ui.pop === 'search' && !Find) import('./Search.svelte').then((m) => (Find = m.default));
  });
  $effect(() => {
    if (ui.trace && !Pill) import('./Trace.svelte').then((m) => (Pill = m.default));
  });
  // Name tracing loads with the first click on a name in the code.
  const trace = () => import('./names');
  function pick(e: MouseEvent) {
    if (e.detail !== 1 || e.button !== 0 || ui.shot) return;
    const on = e.target as Element;
    if (on.matches?.('.notebook th')) import('./tables').then((m) => m.sort(on as HTMLTableCellElement));
    else if (!has('notrace') && on.closest?.('.notebook .src')) trace().then((m) => m.onClick(e, cells, language));
  }
  // a table offers its CSV once the pointer has reached it
  const near = (e: MouseEvent) => {
    const t = (e.target as Element).closest?.('.notebook table');
    if (t) import('./tables').then((m) => m.offer(t as HTMLTableElement));
  };
  $effect(() => {
    if (ui.trace && has('notrace')) trace().then((m) => m.clear());
  });
  // A new file starts clean.
  $effect(() => {
    if (!ready) (ui.replayed = false), (ui.shelf = false), (ui.light = null), (ui.pop = null), ui.trace && trace().then((m) => m.clear());
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
  // The cell the reader has picked: the one holding keyboard focus (a click on a cell focuses it), else the one at the reading line.
  const picked = () => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.notebook > [data-cell]') ?? reading();

  // The notebook is one tab stop; arrows move between its handles and rows.
  const ITEMS = '.notebook .handle:not(.quiet), .notebook .row:not(.closed), .notebook .snap, .notebook .copy, .notebook .save, .notebook .zoom';
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
    // the screenshot dialog and the picture viewer own the keyboard while they are up
    if (ui.shot || ui.light) return;
    if (e.key === 'Escape') {
      if (ui.pop) (ui.pop = null), e.preventDefault();
      else if (ui.trace) trace().then((m) => m.clear());
      else CSS.highlights?.delete('find');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === 'k') return toggle('search'), e.preventDefault();
    const on = document.activeElement as HTMLElement | null;
    if (on?.matches(ITEMS) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      const list = items();
      const i = list.indexOf(on);
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
      list[Math.min(list.length - 1, Math.max(0, to))]?.focus();
      return e.preventDefault();
    }
    if (!single(e)) return;
    const here = picked();
    if (e.key === 'c') hold(here ?? document.body, () => setCode(!view.code), 'cell');
    else if (e.key === 'o') hold(here ?? document.body, () => setOut(!view.out), 'cell');
    else if (e.key === 'x') here?.querySelector<HTMLElement>('.handle')?.click();
    else if (e.key === 's') {
      const cell = cells.find((c) => c.id === here?.dataset.cell);
      if (cell?.type !== 'code' || (!cell.source.trim() && !cell.outputs.length)) return;
      ui.shot = cell;
    }
    else if ((e.key === 'n' || e.key === 'p') && ui.trace) trace().then((m) => m.step(e.key === 'n' ? 1 : -1));
    else if (e.key === 'e' && session.on) here?.dispatchEvent(new CustomEvent('edit'));
    else if (e.key === 'm') toggle('md');
    else if (e.key === 'i') toggle('info');
    else if (e.key === '/') toggle('search');
    else if (e.key === 'f') trace().then((m) => m.fromSelection(cells, language));
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

<svelte:window onmouseover={near} onkeydown={keys} onscroll={moved} onpointerdown={away} onclick={pick} onfocusin={(e) => {
    const on = e.target as Element;
    if (on.matches?.(ITEMS)) park(on as HTMLElement);
    if (on.closest?.('.bar')) document.querySelector('.bar')?.removeAttribute('data-hush');
  }} />

<Toc {cells} bind:count={sections} bind:chapter />
<Menus />
<Net cells={raw} {name} {ready} />
<Privacy />
{#if Figure}<Figure />{/if}
{#if Shot}<Shot />{/if}
{#if Info}<Info cells={raw} {meta} {name} />{/if}
{#if Diff}<Diff cells={raw} />{/if}
{#if Pill}<Pill />{/if}
{#if Hand}<Hand cells={raw} {name} {language} />{/if}
{#if Light}<Light {cells} />{/if}
{#if Find}<Find {cells} />{/if}
<Shelf {cells} bind:count={ui.figures} bind:open={ui.shelf} />
<Resume {cells} {name} {ready} />
