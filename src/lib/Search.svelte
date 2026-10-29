<script lang="ts">
  import { untrack } from 'svelte';
  import type { Cell } from './notebook';
  import Icon from './Lucide.svelte';
  import Pop from './Pop.svelte';
  import { ui, jump } from './ui.svelte';
  import { search, mark, LIMIT } from './search';
  import './search.css';

  let { cells }: { cells: readonly Cell[] } = $props();

  // On a wide window the field lives in the middle of the header, always there; on a narrower one it is the card the dock's button opens.
  const WIDE = '(min-width: 1200px)';
  let wide = $state(matchMedia(WIDE).matches);
  $effect(() => {
    const m = matchMedia(WIDE);
    const on = () => (wide = m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  });

  let q = $state('');
  let box = $state<HTMLElement>();
  let field = $state<HTMLInputElement>();
  const open = $derived(ui.pop === 'search');
  const typed = $derived(q.trim().length >= 2);
  const found = $derived(open || (wide && typed) ? search(cells, q) : { hits: [], more: false });
  // The match Enter last went to (-1 before the first), and whether the list shows: typing opens it, stepping folds it away.
  let at = $state(-1);
  let listing = $state(true);
  $effect(() => {
    q;
    untrack(() => ((at = -1), (listing = true)));
  });

  function go(cell: string) {
    ui.pop = null;
    jump(() => document.querySelector(`[data-cell="${CSS.escape(cell)}"]`));
    mark(cell, q);
  }

  // Enter and Shift+Enter walk the matches in the page, as a browser's find does; the field keeps the keyboard.
  function step(by: 1 | -1) {
    const n = found.hits.length;
    if (!n) return;
    at = at < 0 ? (by > 0 ? 0 : n - 1) : (at + by + n) % n;
    const h = found.hits[at];
    listing = false;
    jump(() => document.querySelector(`[data-cell="${CSS.escape(h.cell)}"]`), 'center');
    mark(h.cell, q);
  }

  // Esc in the field clears the query and its marks; it is caught here, before the page's own Esc only closes the card.
  function clear() {
    q = '';
    CSS.highlights?.delete('find');
    field?.blur();
    ui.pop = null;
  }

  const rows = () => [...(box?.querySelectorAll<HTMLElement>('.hit') ?? [])];
  function keys(e: KeyboardEvent) {
    if (ui.pop !== 'search') return;
    const on = document.activeElement as HTMLElement;
    const list = rows();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (wide && !listing) listing = true;
      const i = list.indexOf(on) + (e.key === 'ArrowDown' ? 1 : -1);
      if (i < 0) box?.querySelector<HTMLElement>('input')?.focus();
      else list[Math.min(i, list.length - 1)]?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' && on?.matches('input') && found.hits[0]) {
      if (wide) step(e.shiftKey ? -1 : 1);
      else go(found.hits[0].cell);
      e.preventDefault();
    }
  }

  // Out of the way while reading down (see below); never while it holds the keyboard.
  let away = $state(false);

  // The field and the card follow `ui.pop`: the search key or ⌘K brings the field the keyboard, and any other card takes it away.
  $effect(() => {
    if (!wide || !field) return;
    if (open && document.activeElement !== field) untrack(() => ((away = false), field!.focus({ preventScroll: true })));
    else if (!open && document.activeElement === field) field.blur();
  });

  // Away while reading down; back on the way up, as the page slows towards a stop, near the top, or when the pointer comes up to the header.
  $effect(() => {
    if (!wide) return;
    let y = scrollY;
    let t = performance.now();
    let settle: ReturnType<typeof setTimeout> | undefined;
    const scrolled = () => {
      const now = performance.now();
      const dy = scrollY - y;
      const v = Math.abs(dy) / Math.max(1, now - t);
      y = scrollY;
      t = now;
      clearTimeout(settle);
      if (scrollY < 80 || document.activeElement === field || dy < -4) return void (away = false);
      if (dy > 0 && v > 0.4) away = true;
      else if (away && v < 0.1) away = false;
      if (away) settle = setTimeout(() => (away = false), 160);
    };
    const near = (e: PointerEvent) => e.clientY < 72 && (away = false);
    addEventListener('scroll', scrolled, { passive: true });
    addEventListener('pointermove', near, { passive: true });
    return () => {
      clearTimeout(settle);
      removeEventListener('scroll', scrolled);
      removeEventListener('pointermove', near);
    };
  });

  const count = $derived(!typed ? '' : !found.hits.length ? 'None' : at >= 0 ? `${at + 1} of ${found.more ? `${LIMIT}+` : found.hits.length}` : found.more ? `${LIMIT}+` : String(found.hits.length));
</script>

<svelte:window onkeydown={keys} />

{#snippet results()}
  {#if found.hits.length}
    <ul>
      {#each found.hits as h, i}
        <li>
          <button class="hit" class:at={i === at} onclick={() => go(h.cell)}>
            <span class="kind">{h.kind}{h.n !== null ? ` [${h.n}]` : ''}</span>
            <span class="snip">{h.before}<mark>{h.match}</mark>{h.after}</span>
          </button>
        </li>
      {/each}
    </ul>
    {#if found.more}<p class="none">The first {LIMIT} matches. Narrow it down to see the rest.</p>{/if}
  {:else}
    <p class="none" role="status">Nothing matches that.</p>
  {/if}
{/snippet}

{#if wide}
  <!-- the header's middle: one glass pill, centred on the window -->
  <div class="find centre" class:away bind:this={box} role="search" data-pop="search" onfocusout={(e) => !box?.contains(e.relatedTarget as Node | null) && open && (ui.pop = null)}>
    <label class="field">
      <Icon name="search" />
      <input bind:this={field} type="search" bind:value={q} onfocus={(e) => (e.currentTarget.select(), (ui.pop = 'search'))} onkeydown={(e) => e.key === 'Escape' && (clear(), e.preventDefault())} placeholder="Search this notebook" aria-label="Search this notebook" autocomplete="off" spellcheck="false" />
      {#if count}<span class="n" role="status">{count}</span>{/if}
      {#if typed && found.hits.length}
        <button class="walk" type="button" aria-label="Previous match" title="Previous · ⇧Enter" onclick={() => (field?.focus(), step(-1))}><Icon name="chevron-down" /></button>
        <button class="walk next" type="button" aria-label="Next match" title="Next · Enter" onclick={() => (field?.focus(), step(1))}><Icon name="chevron-down" /></button>
      {/if}
      <kbd>{open ? 'esc' : '/'}</kbd>
    </label>
    {#if open && typed && listing}<div class="res">{@render results()}</div>{/if}
  </div>
{:else}
  <Pop id="search" label="Search" width={520} bare inline anchor={() => document.querySelector('.bar')}>
    <div class="find" bind:this={box} role="search">
      <label class="field">
        <Icon name="search" />
        <input type="search" bind:value={q} onfocus={(e) => e.currentTarget.select()} placeholder="Search this notebook" aria-label="Search this notebook" autocomplete="off" spellcheck="false" />
        {#if typed && found.hits.length}<span class="n" role="status">{found.more ? `${LIMIT}+` : found.hits.length}</span>{/if}
        <kbd>esc</kbd>
      </label>
      {#if typed}<div class="res">{@render results()}</div>{/if}
    </div>
  </Pop>
{/if}
