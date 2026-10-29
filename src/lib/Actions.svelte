<script lang="ts">
  import Lucide from './Lucide.svelte';
  import { ui, toggle } from './ui.svelte';
  import { view } from './fold.svelte';

  const hidden = $derived(!view.code && !view.out ? 'code and outputs hidden' : !view.code ? 'code hidden' : !view.out ? 'outputs hidden' : '');
</script>

<!-- The symbols that only exist for some notebooks come first, so the ones every notebook has never move; a hairline sets Settings apart. -->
{#if ui.sections > 1}
  <button class="icon" data-toc-toggle data-pop="toc" aria-haspopup="dialog" aria-expanded={ui.pop === 'toc'} aria-label="Contents" data-tip="Contents · t" onclick={() => toggle('toc')}><Lucide name="list" /></button>
{/if}
{#if ui.figures > 0}
  <button class="icon" aria-haspopup="dialog" aria-expanded={ui.shelf} aria-label="Figures" data-tip="Figures" onclick={() => (ui.shelf = !ui.shelf)}><Lucide name="image" /></button>
{/if}
<button class="icon" data-pop="search" aria-haspopup="dialog" aria-expanded={ui.pop === 'search'} aria-label="Search" data-tip="Search · /" onclick={() => toggle('search')}><Lucide name="search" /></button>
<button class="icon" data-pop="info" aria-haspopup="dialog" aria-expanded={ui.pop === 'info'} aria-label="About this notebook" data-tip="About this notebook · i" onclick={() => toggle('info')}><Lucide name="info" /></button>
<button class="icon" data-pop="md" aria-haspopup="dialog" aria-expanded={ui.pop === 'md'} aria-label="Copy as Markdown" data-tip="Copy as Markdown · m" onclick={() => toggle('md')}><Lucide name="file-text" /></button>
<i class="sep" aria-hidden="true"></i>
<button class="icon" data-pop="settings" aria-haspopup="dialog" aria-expanded={ui.pop === 'settings'} aria-label={hidden ? `Settings, ${hidden}` : 'Settings'} data-tip={hidden ? `Settings · ${hidden}` : 'Settings'} onclick={() => toggle('settings')}>
  <Lucide name="sliders" />
  {#if hidden}<i class="dot"></i>{/if}
</button>
