<script lang="ts">
  import './live.css';
  import Row from './Row.svelte';
  import { run } from './sandbox';

  // An output that carries scripts stays still until the reader runs it.
  let { html }: { html: string } = $props();

  let on = $state(false);
  let web = $state(false);
</script>

<div class="out sbx">
  {#if !on}
    <Row kind="cap" chev={false} lead="Run interactive output" meta="in a sandbox" onclick={() => (on = true)} />
  {:else}
    <div class="sbx-bar">
      <span>Running in a sandbox</span>
      <button aria-pressed={web} onclick={() => (web = !web)}>Web access {web ? 'on' : 'off'}</button>
      <button onclick={() => ((on = false), (web = false))}>Stop</button>
    </div>
    <div class="sbx-frame" use:run={{ html, web }}></div>
  {/if}
</div>
