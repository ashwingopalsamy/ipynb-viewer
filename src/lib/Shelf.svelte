<script lang="ts">
  import type { Cell } from './notebook';
  import { figures } from './shelf';
  import { jump } from './ui.svelte';
  import './shelf.css';

  let {
    cells,
    count = $bindable(0),
    open = $bindable(false),
  }: { cells: readonly Cell[]; count: number; open: boolean } = $props();

  const list = $derived(figures(cells));
  let loaded = $state(false);
  let sheet = $state<HTMLElement>();

  $effect(() => {
    count = list.length;
  });
  $effect(() => {
    if (open) {
      loaded = true;
      sheet?.focus({ preventScroll: true });
    }
  });

  function go(cell: string) {
    open = false;
    jump(document.querySelector(`[data-cell="${CSS.escape(cell)}"]`), 'center');
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="shelf" class:on={open} role="dialog" aria-modal="true" aria-label="Figures" aria-hidden={!open} onpointerdown={(e) => e.target === e.currentTarget && (open = false)}>
  <div class="sheet" tabindex="-1" bind:this={sheet}>
    {#if loaded}
      <p class="head">Figures · {list.length}</p>
      <ul>
        {#each list as f}
          <li>
            <button onclick={() => go(f.cell)} aria-label={f.n === null ? 'Go to figure' : `Go to figure in cell ${f.n}`}>
              <img class:plate={f.alpha} src={f.src} alt="" loading="lazy" decoding="async" />
              {#if f.n !== null}<span>[{f.n}]</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
