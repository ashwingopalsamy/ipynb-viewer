<script lang="ts">
  import type { Cell } from './notebook';
  import { figures } from './shelf';
  import { jump, ui } from './ui.svelte';
  import Save, { tagOf } from './Save.svelte';
  import './lightbox.css';

  // A picture at the size of the screen. A click on it flips between fitting and its own pixels; the arrows walk the figures.
  let { cells }: { cells: readonly Cell[] } = $props();

  const list = $derived(figures(cells));
  const at = $derived(ui.light ? list.findIndex((f) => f.cell === ui.light!.cell && f.src === ui.light!.src) : -1);

  // The last picture stays mounted while the box fades out.
  let shown = $state(ui.light);
  let full = $state(false);
  let sheet = $state<HTMLElement>();
  $effect(() => {
    if (ui.light) {
      shown = ui.light;
      full = false;
      if (!sheet?.contains(document.activeElement)) sheet?.focus({ preventScroll: true });
      return;
    }
    const gone = setTimeout(() => (shown = null), 220);
    return () => clearTimeout(gone);
  });

  const alpha = $derived(!!shown && list.some((f) => f.src === shown!.src && f.alpha));
  const n = $derived(at >= 0 ? list[at].n : null);
  const name = $derived(n === null ? 'Figure' : `Figure from cell ${n}`);

  // The bar under the picture keeps its figure while the box fades out.
  let kept = $state(-1);
  $effect(() => {
    if (at >= 0) kept = at;
  });
  const pos = $derived(ui.light ? at : kept);
  const here = $derived(list[pos]);
  const caption = $derived([here?.n == null ? '' : `[${here.n}]`, list.length > 1 ? `${pos + 1} of ${list.length}` : ''].filter(Boolean).join(' · '));

  function close() {
    const back = ui.light?.el;
    ui.light = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }

  function step(by: number) {
    const f = list[at + by];
    if (f && ui.light) (ui.light = { ...ui.light, src: f.src, cell: f.cell }), (full = false);
  }

  // Closes the viewer and brings the figure's cell to the middle of the screen, the way the figures sheet does.
  function go(cell: string) {
    ui.light = null;
    jump(document.querySelector(`[data-cell="${CSS.escape(cell)}"]`), 'center');
  }

  function keys(e: KeyboardEvent) {
    if (!ui.light) return;
    // the save menu sits above the box: Esc closes it first, and while any card is up the arrows and Tab are its own
    if (e.key === 'Escape') (ui.pop === 'figure' ? (ui.pop = null) : close(), e.preventDefault());
    else if (ui.pop) return;
    else if (e.key === 'ArrowLeft') (step(-1), e.preventDefault());
    else if (e.key === 'ArrowRight') (step(1), e.preventDefault());
    else if (e.key === 'Tab') {
      // the box is modal, so Tab goes round inside it
      const stops = [...sheet!.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      const on = stops.indexOf(document.activeElement as HTMLElement);
      stops[(on + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
      e.preventDefault();
    }
  }

  const stage = (e: PointerEvent) => e.target === e.currentTarget && close();
</script>

<svelte:window onkeydown={keys} />

<div class="lb" class:on={!!ui.light} role="dialog" aria-modal="true" aria-label={name} aria-hidden={!ui.light}>
  <div class="lb-box" tabindex="-1" bind:this={sheet}>
    <div class="lb-view" class:full role="presentation" onpointerdown={stage}>
      {#if shown}
        <button class="lb-pic" aria-label={full ? 'Fit to screen' : 'Show at full size'} onclick={() => (full = !full)}>
          <img class:plate={alpha} src={shown.src} alt={name} decoding="async" />
        </button>
      {/if}
    </div>
    <button class="lb-x" aria-label="Close" title="Close · esc" onclick={close}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
    {#if list.length > 1 && at >= 0}
      <button class="lb-go lb-prev" aria-label="Previous figure" disabled={at === 0} onclick={() => step(-1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>
      <button class="lb-go lb-next" aria-label="Next figure" disabled={at === list.length - 1} onclick={() => step(1)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
      </button>
    {/if}
    {#if here}
      <div class="lb-bar" role="group" aria-label="Figure">
        {#if caption}<p class="lb-cap">{caption}</p>{/if}
        <Save src={here.src} alpha={here.alpha} tag={tagOf(cells, here)} label />
        <button class="btn quiet lb-jump" onclick={() => go(here.cell)}>Go to cell</button>
      </div>
    {/if}
  </div>
</div>
