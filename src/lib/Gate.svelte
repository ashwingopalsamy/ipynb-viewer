<script lang="ts">
  import Glyph from './Glyph.svelte';
  import './net.css';

  let { host, url, answer }: { host: string; url: string; answer: (go: boolean, always: boolean) => void } = $props();
  let always = $state(false);
  const short = $derived(url.length > 90 ? url.slice(0, 60) + '…' + url.slice(-24) : url);
</script>

<div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
  <div class="gate-card">
    <span class="mark"><Glyph name="globe" /></span>
    <h2 id="gate-title">Fetch this notebook?</h2>
    <p>The link points to <b>{host}</b>. Fetching the notebook tells that site your address and the time. Nothing from this page is sent along.</p>
    <code>{short}</code>
    <label class="again"><input type="checkbox" onchange={(e) => (always = e.currentTarget.checked)} />Do not ask again for {host}</label>
    <div class="acts-net">
      <button class="nb go" onclick={() => answer(true, always)}>Fetch notebook</button>
      <button class="nb" onclick={() => answer(false, false)}>Cancel</button>
    </div>
  </div>
</div>
