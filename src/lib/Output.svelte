<script module lang="ts">
  // The buttons in a box's corner ride along with the output renderer: both load when the first cell comes near the screen.
  export { default as Corner } from './Corner.svelte';
</script>

<script lang="ts">
  import { collapseCarriageReturns, stripAnsi, type Output } from './notebook';
  import { describeData, type Shown } from './mime';
  import { foldBars, HEAD, LIMIT, TAIL } from './streams';
  import { hold } from './fold.svelte';
  import { has } from './prefs.svelte';
  import Row from './Row.svelte';
  import Save from './Save.svelte';

  // `n` and `i` say where a picture came from (the cell's run count, and its place among the outputs), for its file name.
  let { output, n = null, i = 0 }: { output: Output; n?: number | null; i?: number } = $props();

  const shown = $derived<Shown | null>(
    output.type === 'display' || output.type === 'result' ? describeData(output.data) : null,
  );
  let full = $state(false);
  let short = $state<string[] | null>(null);
  const trace = $derived.by(() => {
    if (output.type !== 'error') return [];
    const t = output.traceback;
    // The header already names the exception, so a closing line that repeats it is dropped.
    const last = t.length && stripAnsi(t[t.length - 1]).trimStart().startsWith(output.ename) ? t.length - 1 : t.length;
    return short && !full ? short.slice(0, 1) : t.slice(0, last);
  });
  const raw = $derived.by(() => {
    if (output.type === 'stream') return foldBars(collapseCarriageReturns(output.text));
    if (output.type === 'error') return trace.join('\n');
    return shown?.kind === 'text' ? shown.text : '';
  });

  let expanded = $state(false);
  let Ansi = $state<typeof import('./Ansi.svelte').default>();
  const lines = $derived(raw.split('\n'));
  const capped = $derived(output.type !== 'error' && lines.length > (has('notrim') ? 3000 : LIMIT));
  const folded = $derived(capped && !expanded);
  const head = $derived(folded ? lines.slice(0, HEAD).join('\n') : raw);
  const tail = $derived(folded ? lines.slice(-TAIL).join('\n') : '');
  const colored = $derived(raw.includes('\u001b'));

  // Long tracebacks are rare, so the logic that trims them loads only when one shows up.
  $effect(() => {
    if (output.type === 'error' && output.traceback.length > 4) {
      const lines = output.traceback;
      import('./trace').then((m) => (short = m.calm(lines)));
    }
  });
  $effect(() => {
    if (colored && !Ansi) import('./Ansi.svelte').then((m) => (Ansi = m.default));
  });

  // Tables: DataFrame HTML is cleaned down to its table; plain text that lines up as a frame becomes one too.
  // `undefined` means not decided yet, null means there is no table.
  let table = $state<string | null | undefined>(undefined);
  $effect(() => {
    const html = shown?.kind === 'text' ? shown.html : null;
    const text = raw;
    const plain = output.type !== 'error' && !colored && lines.length > 2;
    table = html || plain ? undefined : null;
    let live = true;
    if (html) import('./markdown').then((m) => live && (table = m.cleanTable(html)));
    else if (plain) import('./tabular').then((m) => live && (table = m.tables(text)));
    return () => {
      live = false;
    };
  });
  // A note says what was left out, once the table check has come back empty-handed.
  let note = $state('');
  $effect(() => {
    const rich = shown?.kind === 'text' && table === null ? shown.rich : null;
    note = '';
    if (rich) import('./gist').then((m) => (note = m.richNote(rich, !!raw.trim())));
  });

  let root = $state<HTMLElement>();
  const stderr = $derived(output.type === 'stream' && output.name === 'stderr');
</script>

{#snippet body(text: string)}
  <pre>{#if colored && Ansi}<Ansi {text} />{:else}{stripAnsi(text)}{/if}</pre>
{/snippet}

{#if shown?.kind === 'image'}
  <div class="out">
    <span class="pic">
      <img class="out-image" class:plate={shown.alpha} src={shown.src} alt="" loading="lazy" decoding="async" />
      {#if !has('nobtn')}<Save src={shown.src} alpha={shown.alpha} tag="figure{n === null ? '' : `-${n}`}{i ? `-${i + 1}` : ''}" />{/if}
    </span>
  </div>
{:else if table}
  <div class="out" class:stderr>
    <!-- sanitized to table markup, or built from escaped text -->
    {@html table}
  </div>
{:else if output.type === 'error'}
  <div class="out err">
    <p class="exc"><strong>{output.ename}</strong>{#if output.evalue}<span>{stripAnsi(output.evalue)}</span>{/if}</p>
    {#if raw.trim()}{@render body(raw)}{/if}
    {#if short}
      <Row kind="cap" open={full} lead={full ? 'Hide full traceback' : 'Show full traceback'} onclick={(e) => hold(e.currentTarget, () => (full = !full), full ? 'self' : 'cell')} />
    {/if}
  </div>
{:else if raw.trim()}
  <div class="out" class:stderr bind:this={root}>
    {@render body(head)}
    {#if folded}
      <Row kind="cap" lead="{(lines.length - HEAD - TAIL).toLocaleString()} lines hidden" onclick={(e) => hold(e.currentTarget, () => (expanded = true), 'cell')} />
      {@render body(tail)}
    {:else if capped}
      <Row kind="cap" open lead="Show fewer lines" onclick={(e) => hold(e.currentTarget, () => (expanded = false), 'self', () => root?.querySelector('.row'))} />
    {/if}
  </div>
{/if}
{#if note}<p class="note">{note}</p>{/if}
