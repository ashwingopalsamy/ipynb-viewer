<script lang="ts">
  import type { Cell } from './notebook';
  import { figures, type Figure } from './shelf';
  import { jump, ui } from './ui.svelte';
  import Icon from './Lucide.svelte';
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

  // Arrows move across the grid by the column count it has at this width; Home and End go to the ends.
  function move(e: KeyboardEvent) {
    const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button.figs-tile')];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const cols = all.filter((b) => b.offsetTop === all[0].offsetTop).length || 1;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, ArrowUp: at - cols, ArrowDown: at + cols, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    all[Math.min(Math.max(to, 0), all.length - 1)].focus();
  }

  // Choosing a figure opens it at the size of the screen, the same box a picture in a cell opens.
  function show(f: Figure, el: HTMLElement) {
    open = false;
    ui.light = { src: f.src, cell: f.cell, el };
  }

  function go(cell: string) {
    open = false;
    jump(document.querySelector(`[data-cell="${CSS.escape(cell)}"]`), 'center');
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="figs-shelf" class:on={open} role="dialog" aria-modal="true" aria-label="Figures" aria-hidden={!open} onpointerdown={(e) => e.target === e.currentTarget && (open = false)}>
  <div class="figs-sheet" tabindex="-1" bind:this={sheet} style:--n={Math.min(Math.max(list.length, 1), 2)}>
    {#if loaded}
      <header class="dlg-head figs-head"><h2>Figures <span class="figs-n">{list.length}</span></h2><button class="x" aria-label="Close" title="Close · esc" onclick={() => (open = false)}><Icon name="x" /></button></header>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <ul class="figs-grid" onkeydown={move}>
        {#each list as f}
          <li class="figs-item">
            <button class="figs-tile" onclick={(e) => show(f, e.currentTarget)} aria-label={f.n === null ? 'Open figure' : `Open figure from cell ${f.n}`}>
              <span class="figs-thumb" class:figs-alpha={f.alpha}><img src={f.src} alt="" loading="lazy" decoding="async" /></span>
            </button>
            <div class="figs-row">
              <span class="figs-no">{f.n === null ? '' : `[${f.n}]`}</span>
              <button class="btn quiet figs-jump" onclick={() => go(f.cell)}>Go to cell</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
