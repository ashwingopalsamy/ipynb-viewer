<script lang="ts">
  import Lucide from './Lucide.svelte';
  import { ui, toggle } from './ui.svelte';
  import { strip } from './tabs/state.svelte';
  import './opener.css';

  // With tabs showing, this opens a notebook beside the others.
  const many = $derived(strip.list.length > 1);
</script>

<!-- The control beside the file name: it opens a card that takes a link or a file on this device. -->
<button class="opener icon pill" data-pop="open" aria-haspopup="dialog" aria-expanded={ui.pop === 'open'} aria-label={many ? 'Open a notebook in a new tab' : 'Open a notebook'} data-tip={many ? 'Open a notebook in a new tab · ⌘O' : 'Open a notebook'} onclick={() => toggle('open')}>
  <Lucide name={many ? 'plus' : 'folder-open'} />
</button>
