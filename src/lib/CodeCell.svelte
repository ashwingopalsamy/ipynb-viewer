<script lang="ts">
  import type { CodeCell } from './notebook';
  import { view, hold, rise } from './fold.svelte';
  import { long } from './long';
  import Row from './Row.svelte';
  import Icon from './Icon.svelte';

  let { cell, language, seen }: { cell: CodeCell; language: string | null; seen: boolean } = $props();

  // Code past this many lines opens at LEAD lines, with the rest one click away.
  const CAP = 40;
  const LEAD = 28;

  const source = $derived(cell.source.replace(/\s+$/, ''));
  const total = $derived(source ? source.split('\n').length : 0);
  const capped = $derived(total > CAP);
  const first = $derived.by(() => source.slice(0, 400).split('\n').find((l) => l.trim())?.trim() ?? '');
  const hasOut = $derived(cell.outputs.length > 0);
  const bad = $derived(cell.outputs.some((o) => o.type === 'error'));
  const tall = $derived(long(cell));
  const lines = $derived(total > 1 ? `${total} lines` : '');
  const note = $derived(bad ? 'Ended with an error' : 'Ran without errors');

  let closed = $state(false);
  let more = $state(false);
  let touched = $state(false);
  let marked = $state<string | null>(null);
  let gist = $state('');
  // Outputs are the heavy half of a notebook, so their renderer loads when the first one comes near the screen.
  let Out = $state<typeof import('./Output.svelte').default>();
  let Tools = $state<typeof import('./Output.svelte')>();
  // A one-off reveal lasts until that layer's switch is flipped again.
  let peek = $state({ code: -1, out: -1 });

  const showCode = $derived(view.code || peek.code === view.codeAt);
  const showOut = $derived(view.out || peek.out === view.outAt);
  // With both layers off, the cell is a single row, the same one a closed cell shows.
  const shut = $derived(closed || (!!source && hasOut && !showCode && !showOut));
  const rowFirst = $derived(shut || (source ? !showCode : !showOut));

  const act = (at: HTMLElement, change: () => void, keep: 'self' | 'cell' | 'fold' = 'fold') => {
    touched = true;
    hold(at, change, keep);
  };
  const open = () => {
    closed = false;
    peek = { code: view.codeAt, out: view.outAt };
  };
  const flip = () => (shut ? open() : (closed = true));

  $effect(() => {
    if (shut || (hasOut && !showOut)) import('./gist').then((m) => (gist = m.gist(cell.outputs)));
  });

  $effect(() => {
    if (seen && !shut && !Out) import('./Output.svelte').then((m) => ((Out = m.default), (Tools = m)));
  });

  $effect(() => {
    if (!seen || !source) return;
    let live = true;
    import('./highlight').then((m) => m.highlight(source, language)).then((html) => {
      if (live) marked = html;
    });
    return () => {
      live = false;
    };
  });
</script>

<div class="gutter" class:first={rowFirst}>
  <button class="handle" class:quiet={!tall && !shut} aria-expanded={!shut} title={shut ? 'Open cell' : 'Close cell'} tabindex="-1" onclick={(e) => act(e.currentTarget, flip)}>
    <Icon name="chev" />
  </button>
  {#if cell.executionCount !== null}<span class="cnt" data-st={bad ? 'err' : 'ok'} title={note}>[{cell.executionCount}]<span class="sr"> {note}</span></span>{/if}
</div>
<div class="card" class:tall={tall || shut} tabindex="-1">
  {#if shut}
    <div use:rise={touched}>
      <Row kind="closed" lead={first || gist} meta={first ? (hasOut ? gist : lines) : ''} chev={false} onclick={(e) => act(e.currentTarget, open)} />
    </div>
  {:else}
    {#if source}
      {#if showCode}
        <div class="srcbox" use:rise={touched}>
          <pre class="src" style:max-height={capped && !more ? `calc(${LEAD} * 1.65em + 32px)` : undefined}><code class:hl={marked !== null}>{#if marked !== null}<!-- shiki escapes the code -->{@html marked}{:else}{source}{/if}</code></pre>
          {#if Tools}<Tools.Corner {cell} part="code" snap />{/if}
          {#if capped}
            <Row
              kind="cap"
              well
              fade={!more}
              open={more}
              lead={more ? 'Show fewer lines' : `Show ${total - LEAD} more lines`}
              onclick={(e) => act(e.currentTarget, () => (more = !more), more ? 'self' : 'cell')}
            />
          {/if}
        </div>
      {:else}
        <div use:rise={touched}>
          <Row kind="code" lead={first} meta={lines} onclick={(e) => act(e.currentTarget, () => (peek.code = view.codeAt))} />
        </div>
      {/if}
    {/if}
    {#if hasOut}
      {#if showOut}
        <div class="outs" use:rise={touched}>
          {#if Out}{#each cell.outputs as output, i}<Out {output} n={cell.executionCount} {i} />{/each}{/if}
          {#if Tools}<Tools.Corner {cell} part="output" snap={!(source && showCode)} />{/if}
        </div>
      {:else}
        <div use:rise={touched}>
          <Row kind="layer" lead={gist || 'Output'} onclick={(e) => act(e.currentTarget, () => (peek.out = view.outAt))} />
        </div>
      {/if}
    {/if}
  {/if}
</div>
