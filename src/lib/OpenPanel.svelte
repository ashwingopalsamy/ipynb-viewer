<script lang="ts">
  import Pop from './Pop.svelte';
  import Icon from './Icon.svelte';
  import { ui } from './ui.svelte';
  import './settings.css';
  import './opener.css';

  // A notebook from a link typed here, or a file on this device. A link opens on a fresh page; declining the site's question keeps the open notebook on screen.
  let { onchoose }: { onchoose: () => void } = $props();

  let link = $state('');
  let status = $state('');
  let failed = $state(false);
  let busy = $state(false);
  const open = $derived(ui.pop === 'open');

  async function go() {
    const text = link.trim();
    if (!text || busy) return;
    busy = true;
    failed = false;
    status = 'Fetching the notebook';
    let leaving = false;
    try {
      leaving = await (await import('./link')).requested(text, (t) => (status = t));
      if (!leaving) status = 'Nothing was opened.';
    } catch (e) {
      failed = true;
      status = e instanceof Error ? e.message : 'That link would not open.';
    } finally {
      // the page is reloading with the link; the button stays off until it goes
      busy = leaving;
    }
  }

  function choose() {
    ui.pop = null;
    onchoose();
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && open && (ui.pop = null)}
  onpointerdown={(e) => open && !(e.target as Element).closest('.pop, [data-pop]') && (ui.pop = null)}
/>

<Pop id="open" label="Open a notebook" width={328} anchor={() => document.querySelector('[data-pop=open]')}>
  <div class="set">
    <div class="set-group">
      <form class="set-row opener-link" novalidate onsubmit={(e) => (e.preventDefault(), go())}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>
        <input type="url" inputmode="url" placeholder="Paste a link to a notebook" aria-label="Link to a notebook" autocomplete="off" spellcheck="false" bind:value={link} />
        <button type="submit" disabled={!link.trim() || busy}>Open</button>
      </form>
      <button class="sw" onclick={choose}><Icon name="open" /><span>Choose a file on this device</span></button>
    </div>
    {#if status}<p class="set-note" class:bad={failed} role="status">{status}</p>{/if}
  </div>
</Pop>
