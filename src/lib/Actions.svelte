<script lang="ts">
  import Glyph from './Glyph.svelte';
  import { ui, toggle } from './ui.svelte';
  import { view } from './fold.svelte';

  const hidden = $derived(!view.code && !view.out ? 'code and outputs hidden' : !view.code ? 'code hidden' : !view.out ? 'outputs hidden' : '');
</script>

<!-- The symbols that only exist for some notebooks, and the one menu every notebook has. -->
{#if ui.sections > 1}
  <button class="icon" data-toc-toggle data-pop="toc" aria-haspopup="dialog" aria-expanded={ui.pop === 'toc'} title="Contents · t" onclick={() => toggle('toc')}><Glyph name="list" /></button>
{/if}
{#if ui.figures > 0}
  <button class="icon" aria-haspopup="dialog" aria-expanded={ui.shelf} title="Figures" onclick={() => (ui.shelf = !ui.shelf)}><Glyph name="grid" /></button>
{/if}
<button class="icon" data-pop="settings" aria-haspopup="dialog" aria-expanded={ui.pop === 'settings'} title={hidden ? `Settings · ${hidden}` : 'Settings'} onclick={() => toggle('settings')}>
  <Glyph name="sliders" />
  {#if hidden}<i class="dot"></i>{/if}
</button>
