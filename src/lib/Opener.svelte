<script lang="ts">
  import Lucide from './Lucide.svelte';
  import { ui, toggle } from './ui.svelte';
  import './opener.css';
</script>

<!-- The control beside the file name: it opens a card that takes a link or a file on this device. -->
<button class="opener icon pill" data-pop="open" aria-haspopup="dialog" aria-expanded={ui.pop === 'open'} aria-label="Open a notebook" data-tip="Open a notebook" onclick={() => toggle('open')}>
  <Lucide name="folder-open" />
</button>
