<script lang="ts">
  import type { Cell } from './notebook';
  import Pop from './Pop.svelte';
  import { ui, jump } from './ui.svelte';
  import { search, mark, LIMIT } from './search';
  import './search.css';

  let { cells }: { cells: readonly Cell[] } = $props();

  let q = $state('');
  let box = $state<HTMLElement>();
  const found = $derived(ui.pop === 'search' ? search(cells, q) : { hits: [], more: false });
  const typed = $derived(q.trim().length >= 2);

  function go(cell: string) {
    ui.pop = null;
    jump(() => document.querySelector(`[data-cell="${CSS.escape(cell)}"]`));
    mark(cell, q);
  }

  const rows = () => [...(box?.querySelectorAll<HTMLElement>('.hit') ?? [])];
  function keys(e: KeyboardEvent) {
    if (ui.pop !== 'search') return;
    const on = document.activeElement as HTMLElement;
    const list = rows();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const i = list.indexOf(on) + (e.key === 'ArrowDown' ? 1 : -1);
      if (i < 0) box?.querySelector<HTMLElement>('input')?.focus();
      else list[Math.min(i, list.length - 1)]?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' && on?.matches('input') && found.hits[0]) {
      go(found.hits[0].cell);
      e.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={keys} />

<Pop id="search" label="Search" width={520} anchor={() => document.querySelector('.bar')}>
  <div class="find" bind:this={box} role="search">
    <input type="search" oninput={(e) => (q = e.currentTarget.value)} onfocus={(e) => e.currentTarget.select()} placeholder="Search this notebook" aria-label="Search this notebook" autocomplete="off" spellcheck="false" />
    {#if typed}
      {#if found.hits.length}
        <ul>
          {#each found.hits as h}
            <li>
              <button class="hit" onclick={() => go(h.cell)}>
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
    {/if}
  </div>
</Pop>
