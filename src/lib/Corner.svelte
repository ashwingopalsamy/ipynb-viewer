<script lang="ts">
  import type { CodeCell } from './notebook';
  import { has } from './prefs.svelte';
  import { copyable, outText } from './copytext';
  import Copy from './Copy.svelte';
  import Snap from './Snap.svelte';

  // The buttons in the corner of a code or output box. Only the first box of a cell carries the camera.
  let { cell, part, snap }: { cell: CodeCell; part: 'code' | 'output'; snap: boolean } = $props();

  const copy = $derived(!has('nobtn') && (part === 'code' || copyable(cell.outputs)));
  const shoot = $derived(snap && !has('nobtn'));
</script>

{#if copy || shoot}
  <div class="acts">
    {#if shoot}<Snap {cell} />{/if}
    {#if copy}<Copy what={part} get={() => (part === 'code' ? cell.source : outText(cell.outputs))} />{/if}
  </div>
{/if}
