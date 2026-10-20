<script lang="ts">
  import { untrack } from 'svelte';
  import type { Cell } from './notebook';
  import Glyph from './Glyph.svelte';
  import { net, remoteHosts, begin, allow, deny, sites } from './netstate.svelte';
  import './net.css';

  let { cells, name, ready }: { cells: readonly Cell[]; name: string; ready: boolean } = $props();

  // Once the notebook is whole, what it asks of the web is known and the policy can be set.
  $effect(() => {
    if (!ready) return;
    const found = remoteHosts(cells);
    untrack(() => begin(name, found));
  });

  // The card lives at the top of the notebook, in the column the cells use.
  function home(node: HTMLElement) {
    document.querySelector('.notebook')?.prepend(node);
    return { destroy: () => node.remove() };
  }

  const many = $derived(net.pictures > 1);
</script>

{#if net.choice !== 'none'}
  <aside class="net" class:quiet={net.choice !== 'ask'} use:home aria-label="Pictures from the web">
    <span class="mark"><Glyph name="globe" /></span>
    {#if net.choice === 'ask'}
      <div class="say">
        <h2>{many ? `This notebook has ${net.pictures} pictures on the web.` : 'This notebook has a picture on the web.'}</h2>
        <p>They come from {sites(net.hosts)}. Loading {many ? 'them' : 'it'} tells {net.hosts.length > 1 ? 'those sites' : 'that site'} that you opened this notebook, with your address and the time. Nothing else leaves your computer.</p>
      </div>
      <div class="acts-net">
        <button class="nb go" onclick={() => allow(true)}>Load pictures</button>
        <button class="nb" onclick={() => deny()}>Keep blocked</button>
      </div>
    {:else if net.choice === 'loaded'}
      <p class="say">Pictures loaded from {sites(net.hosts)}.</p>
      <button class="nb" onclick={() => deny()}>Block again</button>
    {:else if net.lock === 2}
      <p class="say">The pictures from {sites(net.hosts)} stay off. Your browser is holding them back until this page is reloaded.</p>
    {:else}
      <p class="say">{many ? `${net.pictures} pictures` : 'One picture'} from {sites(net.hosts)} kept off.</p>
      <button class="nb" onclick={() => allow(false)}>Load</button>
    {/if}
  </aside>
{/if}
