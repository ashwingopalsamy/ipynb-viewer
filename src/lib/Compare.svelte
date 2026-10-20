<script lang="ts">
  import type { Cell } from './notebook';
  import type { Change } from './insight/diff';
  import Pop from './Pop.svelte';
  import { ui, jump } from './ui.svelte';
  import './info.css';
  import './settings.css';

  // What changed from another file to this notebook, cell by cell. Rows that point at a cell of this notebook jump to it.
  let { cells }: { cells: readonly Cell[] } = $props();

  const r = $derived(ui.cmp?.report);
  const MORE = 60;
  const WORD = { added: 'Added', removed: 'Removed', changed: 'Edited', outputs: 'Output changed' } as const;
  const TONE = { added: 'ok', removed: 'bad', changed: 'on', outputs: 'wait' } as const;

  function go(b: number | undefined) {
    const id = b === undefined ? undefined : cells[b]?.id;
    if (!id) return;
    ui.pop = null;
    jump(() => document.querySelector(`[data-cell="${CSS.escape(id)}"]`));
  }
</script>

{#snippet part(c: Change)}
  <header><span class="st" data-s={TONE[c.kind]}>{WORD[c.kind]}</span><span>{c.type === 'code' ? 'Code' : c.type === 'markdown' ? 'Text' : 'Note'}{c.b !== undefined ? ` · cell ${c.b + 1}` : c.a !== undefined ? ` · was cell ${c.a + 1}` : ''}</span></header>
            {#if c.lines}
              <pre>{#each c.lines as l}<i class={l.mark === '+' ? 'plus' : l.mark === '-' ? 'minus' : l.text === '…' ? 'dots' : ''}>{l.mark === ' ' ? ' ' : l.mark} {l.text}</i>{/each}</pre>
            {:else if c.text}
              <pre><i class={c.kind === 'added' ? 'plus' : 'minus'}>{c.text}</i></pre>
            {/if}
{/snippet}

<Pop id="compare" label="Changes" width={560} lead={false} anchor={() => document.querySelector('.bar')}>
  {#if ui.pop === 'compare' && r}
    <div class="set">
      <p class="diff-head">From <b>{ui.cmp!.name}</b> to this notebook</p>
      {#if !r.changes.length}
        <p class="set-note">No differences in {r.same} {r.same === 1 ? 'cell' : 'cells'}, code, text or outputs.</p>
      {:else}
        <p class="diff-tally">
          {#if r.added}<span class="st" data-s="ok">{r.added} added</span>{/if}{#if r.removed}<span class="st" data-s="bad">{r.removed} removed</span>{/if}{#if r.changed}<span class="st" data-s="on">{r.changed} edited</span>{/if}{#if r.outputs}<span class="st" data-s="wait">{r.outputs} with new outputs</span>{/if}<span class="st">{r.same} unchanged</span>
        </p>
        {#if r.partial}<p class="set-note">Only the first 3,000 cells of each were compared.</p>{/if}
        <div class="set-group">
          {#each r.changes.slice(0, MORE) as c}
            {#if c.b !== undefined}<button class="change" onclick={() => go(c.b)}>{@render part(c)}</button>{:else}<div class="change">{@render part(c)}</div>{/if}
          {/each}
        </div>
        {#if r.changes.length > MORE}<p class="set-note">The first {MORE} changes. {r.changes.length - MORE} more are not shown.</p>{/if}
      {/if}
    </div>
  {/if}
</Pop>
