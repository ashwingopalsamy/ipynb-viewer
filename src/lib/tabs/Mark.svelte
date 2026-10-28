<script lang="ts">
  import Lucide from '../Lucide.svelte';
  import type { TabView } from './state.svelte';

  // What stands in front of a notebook's name in the strip and the list: busy, failed, from the web, or from this device.
  let { t }: { t: TabView } = $props();
</script>

{#if t.status === 'loading'}
  <span class="tb-spin" aria-hidden="true"></span>
{:else if t.status === 'error'}
  <span class="tb-bad" aria-hidden="true"></span>
{:else if t.web}
  <Lucide name="link" size={14} />
{:else}
  <img src="mark.svg" alt="" width="13" height="16" />
{/if}
