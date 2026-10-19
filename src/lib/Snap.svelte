<script lang="ts">
  import type { CodeCell } from './notebook';
  import { ui } from './ui.svelte';

  let { cell }: { cell: CodeCell } = $props();
</script>

<button class="snap" tabindex="-1" title="Save cell as image · s" aria-label="Save cell as image" aria-haspopup="dialog" onclick={() => (ui.shot = cell)}>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4.5 9.5a3 3 0 0 1 3-3h1.2a1.5 1.5 0 0 0 1.2-.6l.7-1a1.5 1.5 0 0 1 1.2-.6h1.4a1.5 1.5 0 0 1 1.2.6l.7 1a1.5 1.5 0 0 0 1.2.6h.2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3Z" />
    <circle cx="12" cy="12.5" r="3" />
  </svg>
</button>
