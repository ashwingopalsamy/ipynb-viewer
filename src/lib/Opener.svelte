<script lang="ts">
  import Lucide from './Lucide.svelte';
  import { ui, toggle } from './ui.svelte';
</script>

<!-- The plus at the end of the notebooks' pill: it opens a card that takes a file on this device or a link, beside the notebooks already open. -->
<button class="icon tb-new" data-pop="open" aria-haspopup="dialog" aria-expanded={ui.pop === 'open'} aria-label="Open a notebook" data-tip="Open a notebook · ⌘O" onclick={() => toggle('open')}>
  <Lucide name="plus" />
</button>
