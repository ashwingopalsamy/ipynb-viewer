<script lang="ts">
  import type { Cell } from './notebook';
  import { outline, type Heading } from './outline';
  import { ui, single, jump } from './ui.svelte';
  import Pop from './Pop.svelte';
  import './toc.css';

  let {
    cells,
    count = $bindable(0),
    chapter = $bindable(''),
  }: { cells: readonly Cell[]; count: number; chapter: string } = $props();

  // One outline in one place: tick marks along the right edge, and a popover on a phone, where the edge has no room.
  const LINE = 150;
  const ROWS = 22;
  const PITCH = 20;
  const BREAK = 14;
  const STEP = 7;
  let current = $state(-1);
  let pin = $state(false);
  let panel = $state<HTMLElement>();

  // The ticks step aside while a panel or a picture is open: they would sit under it, and nobody can use them then.
  // The contents popover is hidden past 720px, so at that width it cannot be seen and must not hide the ticks.
  let desk = $state(matchMedia('(min-width: 721px)').matches);
  $effect(() => {
    const m = matchMedia('(min-width: 721px)');
    const on = () => (desk = m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  });
  const away = $derived((!!ui.pop && !(ui.pop === 'toc' && desk)) || ui.shelf || !!ui.light || !!ui.shot);
  const found = $derived(outline(cells));
  const entries = $derived(found.headings);
  const now = $derived(entries[current]?.text ?? '');
  // The section being read, at the notebook's top level: the last such heading at or above the reading line, else the first.
  const head = $derived.by(() => {
    for (let i = Math.max(0, current); i >= 0; i--) if (!entries[i]?.depth) return entries[i]?.text ?? '';
    return entries.find((h) => !h.depth)?.text ?? '';
  });
  const at = $derived(Math.max(0, current));
  // A long outline slides under a fixed window that keeps the current row in view.
  const shift = $derived(Math.min(Math.max(0, at - (ROWS >> 1)), Math.max(0, entries.length - ROWS)));

  // Room before a heading that starts something new: a bigger step before a top-level heading, a small one
  // when the outline climbs back out of a deeper level. The ticks and the list share it.
  const lead = $derived(entries.map((h, i) => (!i ? 0 : !h.depth ? BREAK : h.depth < entries[i - 1].depth ? STEP : 0)));
  const pos = $derived.by(() => {
    let sum = 0;
    return entries.map((_, i) => i * PITCH + (sum += lead[i]));
  });
  // The rows in view run from `shift` to the end of the window; the rail keeps the tallest window's height.
  const span = (s: number) => pos[Math.min(s + ROWS, entries.length) - 1] + PITCH - pos[s];
  const height = $derived.by(() => {
    if (!entries.length) return 0;
    let h = 0;
    for (let s = 0; s <= Math.max(0, entries.length - ROWS); s++) h = Math.max(h, span(s));
    return h;
  });
  const slide = $derived(entries.length ? pos[shift] - (height - span(shift)) / 2 : 0);

  $effect(() => {
    count = entries.length;
    document.documentElement.toggleAttribute('data-toc', entries.length > 1);
    return () => document.documentElement.removeAttribute('data-toc');
  });
  // Every heading on the page says how the reader got to it (md.css draws the hairline and the room above it):
  // `top` opens a section, `out` climbs back to a shallower level, `same` stays, `in` goes deeper. `data-d` is its rank.
  // The page is read as drawn, so a heading written in HTML or setext style counts too, and quoted ones do not.
  function mark() {
    const heads = [...document.querySelectorAll<HTMLElement>('.notebook .md > :is(h1, h2, h3, h4, h5, h6)')];
    const level = (el: Element) => +el.tagName[1];
    const top = Math.min(found.top, ...heads.map(level));
    let prev = 0;
    for (const el of heads) {
      const l = level(el);
      const kind = !prev ? '' : l === top ? 'top' : l < prev ? 'out' : l === prev ? 'same' : 'in';
      if (kind) (el.dataset.h = kind), (el.dataset.d = String(Math.min(3, l - top)));
      else delete el.dataset.h;
      prev = l;
    }
  }
  let marking = 0;
  const remark = () => (marking ||= requestAnimationFrame(() => ((marking = 0), mark())));
  // Cells draw their markdown as they come into view, so the marks follow every change to the page.
  $effect(() => {
    entries;
    const page = document.querySelector('.notebook');
    if (!page || entries.length < 2) return;
    remark();
    const watch = new MutationObserver(remark);
    watch.observe(page, { childList: true, subtree: true });
    return () => {
      watch.disconnect();
      cancelAnimationFrame(marking);
      marking = 0;
      for (const el of page.querySelectorAll<HTMLElement>('[data-h]')) delete el.dataset.h;
    };
  });
  $effect(() => {
    chapter = now;
  });

  const words = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim();
  function target(i: number): Element | null {
    const h = entries[i];
    const cell = document.querySelector(`[data-cell="${CSS.escape(h.cell)}"]`);
    const heads = cell ? [...cell.querySelectorAll('h1,h2,h3,h4,h5,h6')] : [];
    // By name first: a drawn cell can hold headings the outline does not list (HTML ones, setext ones, quoted ones).
    let again = 0;
    for (let k = i - 1; k >= 0 && entries[k].cell === h.cell; k--) if (entries[k].text === h.text) again++;
    return heads.filter((el) => words(el.textContent) === h.text)[again] ?? heads[h.nth] ?? cell ?? null;
  }
  const topOf = (i: number) => target(i)?.getBoundingClientRect().top ?? Infinity;

  function locate() {
    const root = document.documentElement;
    const last = entries.length - 1;
    if (last < 0) return void (current = -1);
    let found = -1;
    if (innerHeight + scrollY >= root.scrollHeight - 4 && scrollY > 0) found = last;
    else {
      let lo = 0;
      let hi = last;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (topOf(mid) <= LINE) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
    }
    current = found;
  }

  let queued = 0;
  function queue() {
    if (!queued) queued = requestAnimationFrame(() => ((queued = 0), locate()));
  }

  $effect(() => {
    entries;
    queue();
  });

  // A popover opens with the current row in view.
  $effect(() => {
    if (ui.pop === 'toc') document.querySelector('#toc-list [aria-current]')?.scrollIntoView({ block: 'nearest' });
  });

  // The ticks are for anything wider than a phone; if the window grows past the breakpoint the popover has nothing to show.
  $effect(() => {
    const wide = matchMedia('(min-width: 721px)');
    const close = () => wide.matches && ui.pop === 'toc' && (ui.pop = null);
    wide.addEventListener('change', close);
    return () => wide.removeEventListener('change', close);
  });

  function go(i: number) {
    ui.pop = null;
    pin = false;
    // the list closes once the pointer leaves; focus left inside would keep it open for a keyboard user only
    if (panel?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    jump(() => target(i));
  }

  // A tap opens the list and a second one closes it. The mouse needs no click: hovering already opens it.
  const tap = (e: MouseEvent) => {
    if ((e as PointerEvent).pointerType !== 'mouse') pin = !pin;
  };

  // The list opens with the current row in the middle.
  function centre() {
    const row = panel?.querySelector<HTMLElement>('[aria-current], .t[tabindex="0"]');
    if (panel && row) panel.scrollTop = row.offsetTop - (panel.clientHeight - row.offsetHeight) / 2;
  }

  function keys(e: KeyboardEvent) {
    const k = e.key;
    const on = document.activeElement;
    if (k === 'Escape' && (pin || on?.closest('.rail'))) {
      pin = false;
      (on as HTMLElement).blur?.();
      return;
    }
    // From the ticks, an arrow steps into the list.
    if (on?.matches('.stack') && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft')) {
      panel?.querySelector<HTMLElement>('.t[tabindex="0"]')?.focus({ preventScroll: true });
      return e.preventDefault();
    }
    // Up and down walk the rows of whichever list has focus.
    if (on?.matches('.t') && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End')) {
      const rows = [...on.closest('nav')!.querySelectorAll<HTMLElement>('.t')].filter((r) => !r.closest('[inert]'));
      const i = rows.indexOf(on as HTMLElement);
      rows[k === 'Home' ? 0 : k === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, i + (k === 'ArrowDown' ? 1 : -1)))].focus({ preventScroll: true });
      return e.preventDefault();
    }
    if ((k !== '[' && k !== ']') || !single(e) || !entries.length) return;
    go(Math.min(entries.length - 1, Math.max(0, k === ']' ? current + 1 : current - 1)));
  }
</script>

<svelte:window onscroll={queue} onresize={queue} onkeydown={keys} onpointerdown={(e) => pin && !(e.target as Element).closest('.rail') && (pin = false)} />

{#snippet row(h: Heading, i: number)}
  {#if lead[i]}<i class="sep" class:big={!h.depth} aria-hidden="true"></i>{/if}
  <button
    class="t"
    class:top={!h.depth}
    class:near={Math.abs(i - at) === 1}
    style:--d={h.depth}
    title={h.text}
    aria-current={i === current ? 'location' : undefined}
    tabindex={i === at ? 0 : -1}
    onclick={() => go(i)}>{h.text}</button
  >
{/snippet}

{#if entries.length > 1}
  <nav class="rail" class:pin class:away aria-label="Contents" style:--span={height} style:--slide={slide} onpointerenter={centre} onfocusin={(e) => (e.target as Element).matches(':focus-visible') && centre()}>
    <button class="stack" aria-label="Contents" aria-expanded={pin} aria-controls="toc-panel" onclick={tap}>
      <span class="ticks" aria-hidden="true">
        {#each entries as h, i}
          {@const out = i < shift || i >= shift + ROWS}
          {@const edge = Math.min(shift > 0 ? i - shift + 1 : 9, shift + ROWS < entries.length ? shift + ROWS - i : 9)}
          <span class="tr" class:near={Math.abs(i - at) === 1} class:now={i === at} style:--d={h.depth} style:--y={pos[i]} style:opacity={out ? 0 : edge < 3 ? edge / 3 : undefined}>
            <span class="lbl">{h.text}</span><i class="tk"></i>
          </span>
        {/each}
      </span>
    </button>
    <div class="panel" id="toc-panel" bind:this={panel}>
      {#each entries as h, i}{@render row(h, i)}{/each}
    </div>
  </nav>
  <Pop id="toc" label="Contents" width={320} anchor={() => document.querySelector('[data-pop=toc]')}>
    <nav id="toc-list" aria-label="Contents">
      {#each entries as h, i}{@render row(h, i)}{/each}
    </nav>
  </Pop>
{/if}

{#if head}<div class="mid pill" aria-hidden="true">{#key head}<span>{head}</span>{/key}</div>{/if}
