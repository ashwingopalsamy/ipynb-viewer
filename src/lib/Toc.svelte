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
  let current = $state(-1);
  let pin = $state(false);
  let panel = $state<HTMLElement>();

  const entries = $derived(outline(cells).headings);
  const now = $derived(entries[current]?.text ?? '');
  const at = $derived(Math.max(0, current));
  // A long outline slides under a fixed window that keeps the current row in view.
  const shift = $derived(Math.min(Math.max(0, at - (ROWS >> 1)), Math.max(0, entries.length - ROWS)));

  $effect(() => {
    count = entries.length;
    document.documentElement.toggleAttribute('data-toc', entries.length > 1);
    return () => document.documentElement.removeAttribute('data-toc');
  });
  $effect(() => {
    chapter = now;
  });

  function target(i: number): Element | null {
    const h = entries[i];
    const cell = document.querySelector(`[data-cell="${CSS.escape(h.cell)}"]`);
    return cell?.querySelectorAll('h1,h2,h3,h4,h5,h6')[h.nth] ?? cell ?? null;
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
  <button
    class="t"
    class:near={Math.abs(i - at) === 1}
    style:--d={h.depth}
    title={h.text}
    aria-current={i === current ? 'location' : undefined}
    tabindex={i === at ? 0 : -1}
    onclick={() => go(i)}>{h.text}</button
  >
{/snippet}

{#if entries.length > 1}
  <nav class="rail" class:pin aria-label="Contents" style:--rows={Math.min(ROWS, entries.length)} style:--shift={shift} onpointerenter={centre} onfocusin={centre}>
    <button class="stack" aria-label="Contents" aria-expanded={pin} aria-controls="toc-panel" onclick={tap}>
      <span class="ticks" aria-hidden="true">
        {#each entries as h, i}
          {@const out = i < shift || i >= shift + ROWS}
          {@const edge = Math.min(shift > 0 ? i - shift + 1 : 9, shift + ROWS < entries.length ? shift + ROWS - i : 9)}
          <span class="tr" class:near={Math.abs(i - at) === 1} class:now={i === at} style:--d={h.depth} style:opacity={out ? 0 : edge < 3 ? edge / 3 : undefined}>
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
