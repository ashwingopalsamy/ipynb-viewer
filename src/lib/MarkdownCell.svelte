<script lang="ts">
  import { tick } from 'svelte';
  import type { MarkdownCell } from './notebook';
  import { typeset } from './math';
  import { session, commit, current } from './edit/session.svelte';
  import type { Caret, Follow } from './edit/types';

  let { cell, seen }: { cell: MarkdownCell; seen: boolean } = $props();

  let md = $state.raw<typeof import('./markdown')>();
  let Editor = $state.raw<typeof import('./edit/BlockEditor.svelte').default>();
  let root = $state<HTMLElement>();

  // the block that is open: `b` indexes the drawn blocks, a ghost is a new paragraph after block `after` (-1 for the start)
  type Open = { id: number; kind: 'block' | 'whole' | 'ghost'; b: number; mode: 'rich' | 'source'; at: Caret | null };
  let open = $state.raw<Open | null>(null);
  let seq = 0;

  $effect(() => {
    if (!seen || md) return;
    let live = true;
    import('./markdown').then((m) => {
      if (live) md = m;
    });
    return () => {
      live = false;
    };
  });

  // Drawn in pieces, one per block, while the notebook can be edited; the rest of the time as one.
  const page = $derived(
    md ? (session.on ? md.renderParts(cell.source, cell.attachments) : { parts: [md.renderMarkdown(cell.source, cell.attachments)], blocks: null }) : null,
  );

  $effect(() => {
    page;
    if (root && page) typeset(root);
  });

  const activate = (next: Omit<Open, 'id'>) => {
    open = { ...next, id: ++seq };
    session.active = cell.id;
  };

  async function edit(e: MouseEvent) {
    if (!session.on) {
      if (session.why) import('./notice').then((m) => m.say(session.why));
      return;
    }
    const hit = e.target as Element;
    // a block drawn again since the click is no longer in the page
    if (open || !page || !root?.contains(hit) || hit.closest('a')) return;
    const whole = page.blocks === null;
    const el = hit.closest<HTMLElement>('[data-b]');
    if (!whole && (!el || !root.contains(el))) return;
    const b = whole ? -1 : Number(el!.dataset.b);
    const [x, y] = [e.clientX, e.clientY];
    // the TeX of the formula under the pointer, which opens the block as text with the caret on it
    const tex = hit.closest('.math')?.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? null;
    if (!(await current()?.ensureBase())) return;
    Editor ??= (await import('./edit/BlockEditor.svelte')).default;
    const now = page;
    if (!root?.contains(hit) || (!whole && !now.blocks?.[b])) return;
    if (whole) return activate({ kind: 'whole', b, mode: 'source', at: tex ? { find: tex } : null });
    const source = now.blocks![b].kind === 'source' || tex !== null;
    activate({ kind: 'block', b, mode: source ? 'source' : 'rich', at: tex ? { find: tex } : source ? null : { word: { x, y } } });
  }

  async function done(next: string | null, follow?: Follow) {
    const was = open;
    const before = page?.blocks?.length ?? 0;
    open = null;
    session.active = null;
    if (next !== null) commit(cell.id, cell.source, next);
    const blocks = page?.blocks ?? null;
    if (!follow || !was) {
      // the reader stays where they were rather than falling to the top of the page
      tick().then(() => root?.closest<HTMLElement>('[data-cell]')?.focus({ preventScroll: true }));
      return;
    }
    await tick();
    const kindAt = (i: number): 'rich' | 'source' => (blocks![i].kind === 'source' ? 'source' : 'rich');
    if (follow.to === 'ghost') {
      const after = Math.min(was.b, (blocks?.length ?? 0) - 1);
      activate({ kind: 'ghost', b: after, mode: 'rich', at: follow.at });
    } else if (was.kind === 'ghost') {
      // a new paragraph that was committed is done; one that was empty opens again
      if (next === null) activate({ kind: 'ghost', b: was.b, mode: 'rich', at: follow.at });
    } else if (was.kind === 'whole' || !blocks) {
      if (was.kind === 'whole' && follow.to === 'same') activate({ kind: 'whole', b: -1, mode: 'source', at: follow.at });
    } else {
      const i = follow.to === 'next' ? was.b + 1 : follow.to === 'prev' ? was.b - 1 : was.b;
      // a block the edit split or joined elsewhere than expected is left closed
      if (blocks[i] && (follow.to !== 'same' || blocks.length === before)) activate({ kind: 'block', b: i, mode: kindAt(i), at: follow.at });
    }
  }
</script>

{#snippet ghost()}
  {#if open && Editor && page}
    {#key open.id}
      <Editor block={null} insertAt={open.b >= 0 ? page.blocks![open.b].end : 0} source={cell.source} attachments={cell.attachments} mode="rich" at={open.at} onDone={done} />
    {/key}
  {/if}
{/snippet}

<div class="md" bind:this={root} ondblclick={edit} role="presentation">
  {#if page}
    {#if open?.kind === 'whole' && Editor}
      {#key open.id}
        <Editor block={null} source={cell.source} attachments={cell.attachments} mode="source" at={open.at} onDone={done} />
      {/key}
    {:else}
      {#if open?.kind === 'ghost' && open.b === -1}{@render ghost()}{/if}
      {#each page.parts as part, i}
        {#if open?.kind === 'block' && open.b === i && Editor}
          {#key open.id}
            <Editor block={page.blocks![i]} source={cell.source} attachments={cell.attachments} mode={open.mode} at={open.at} onDone={done} />
          {/key}
        {:else}
          <!-- sanitized by DOMPurify in renderMarkdown and renderParts -->
          {@html part}
        {/if}
        {#if open?.kind === 'ghost' && open.b === i}{@render ghost()}{/if}
      {/each}
    {/if}
  {:else}
    <p class="pending">{cell.source}</p>
  {/if}
</div>
