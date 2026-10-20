<script lang="ts">
  import { ui } from './ui.svelte';
  import { clear, step } from './names';

  // The pill that says what is being traced, with a way through the cells it marks and a way out.
  // It stays mounted so it can fade, and keeps the last trace until it has gone.
  let shown = $state(ui.trace);
  $effect(() => {
    if (ui.trace) return void (shown = ui.trace);
    const gone = setTimeout(() => (shown = null), 220);
    return () => clearTimeout(gone);
  });

  const cells = (n: number) => `${n} cell${n === 1 ? '' : 's'}`;
  const said = $derived(
    shown ? `Tracing ${shown.name}: ${[shown.def.length ? `defined in ${cells(shown.def.length)}` : '', shown.use.length ? `used in ${cells(shown.use.length)}` : ''].filter(Boolean).join(', ')}.` : '',
  );
</script>

<p class="sr" role="status">{ui.trace ? said : ''}</p>
<div class="tpill" class:on={!!ui.trace} role="group" aria-label="Name tracing" inert={!ui.trace}>
  {#if shown}
    <code title={shown.name}>{shown.name}</code>
    {#if shown.def.length}<span class="key"><i></i>{shown.def.length} defined</span>{/if}
    {#if shown.use.length}<span class="key"><i class="use"></i>{shown.use.length} used</span>{/if}
    <span class="go">
      <button aria-label="Previous cell" title="Previous · p" onclick={() => step(-1)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14.5l6-6 6 6" /></svg>
      </button>
      <button aria-label="Next cell" title="Next · n" onclick={() => step(1)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6" /></svg>
      </button>
      <button aria-label="Stop tracing" title="Stop · esc" onclick={clear}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
      </button>
    </span>
  {/if}
</div>
