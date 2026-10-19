<script lang="ts">
  import './export.css';
  import { ui } from './ui.svelte';

  // The button on a picture. It hands the picture to the menu; nothing is encoded until a choice is made.
  let { src, alpha, tag }: { src: string; alpha: boolean; tag: string } = $props();

  function open(e: MouseEvent & { currentTarget: HTMLElement }) {
    const el = e.currentTarget;
    if (ui.pop === 'figure' && ui.fig?.el === el) return void (ui.pop = null);
    ui.fig = { src, alpha, tag, el };
    ui.pop = 'figure';
  }
</script>

<button class="save" data-pop="figure" tabindex="-1" aria-haspopup="dialog" title="Save figure" aria-label="Save figure" onclick={open}>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4.5v10M7.8 10.8l4.2 4.2 4.2-4.2M5 19h14" />
  </svg>
</button>
