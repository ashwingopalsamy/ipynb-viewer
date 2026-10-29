<script lang="ts">
  import Lucide from '../Lucide.svelte';
  import type { TabView } from './state.svelte';

  // What stands in front of a tab's name in the strip and the list: busy, failed, or what it holds (a notebook, a Markdown file, a
  // link). The app's own mark stands only where the chip names the app itself, before anything is open.
  let { t }: { t: Pick<TabView, 'status' | 'web' | 'name'> } = $props();
</script>

{#if t.status === 'loading'}
  <span class="tb-spin" aria-hidden="true"></span>
{:else if t.status === 'error'}
  <span class="tb-bad" aria-hidden="true"></span>
{:else if !t.name}
  <img src="mark.svg" alt="" width="13" height="16" />
{:else}
  <Lucide name={t.web ? 'link' : /\.(?:md|markdown)$/i.test(t.name) ? 'file-text' : 'notebook'} size={14} />
{/if}
