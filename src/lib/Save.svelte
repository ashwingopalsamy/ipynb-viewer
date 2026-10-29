<script module lang="ts">
  import type { Cell } from './notebook';
  import { describeData } from './mime';

  /** The part of a picture's file name that says where it came from: the cell's run count, then its place among the cell's outputs. */
  export const tagFor = (n: number | null, i: number) => `figure${n === null ? '' : `-${n}`}${i ? `-${i + 1}` : ''}`;

  /** The same name for a picture found in the list of figures, so the sheet and the viewer save under the name the cell does. */
  export function tagOf(cells: readonly Cell[], f: { cell: string; n: number | null; src: string }) {
    const cell = cells.find((c) => c.id === f.cell);
    const i = cell?.type === 'code' ? cell.outputs.findIndex((o) => {
      if (o.type !== 'display' && o.type !== 'result') return false;
      const s = describeData(o.data);
      return s.kind === 'image' && s.src === f.src;
    }) : 0;
    return tagFor(f.n, Math.max(i, 0));
  }
</script>

<script lang="ts">
  import './export.css';
  import { ui } from './ui.svelte';

  // The button for a picture. It hands the picture to the menu; nothing is encoded until a choice is made.
  // Round and quiet under a picture in a cell; with `label`, a button with its word, for the sheet and the viewer.
  let { src, alpha, tag, label = false }: { src: string; alpha: boolean; tag: string; label?: boolean } = $props();

  let btn = $state<HTMLButtonElement>();

  function open(e: MouseEvent & { currentTarget: HTMLElement }) {
    const el = e.currentTarget;
    if (ui.pop === 'figure' && ui.fig?.el === el) return void (ui.pop = null);
    ui.fig = { src, alpha, tag, el };
    ui.pop = 'figure';
  }
</script>

<button
  bind:this={btn}
  class={label ? 'btn quiet save-btn' : 'save'}
  data-pop="figure"
  tabindex={label ? undefined : -1}
  aria-haspopup="dialog"
  aria-expanded={ui.pop === 'figure' && ui.fig?.el === btn}
  title={label ? undefined : 'Save figure'}
  aria-label="Save figure"
  onclick={open}
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4.5v10M7.8 10.8l4.2 4.2 4.2-4.2M5 19h14" />
  </svg>
  {#if label}Save{/if}
</button>
