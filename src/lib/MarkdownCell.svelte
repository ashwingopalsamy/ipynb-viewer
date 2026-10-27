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

  // a block drawn again after its editor closes holds TeX placeholders too, so closing typesets as a new page does
  $effect(() => {
    page;
    open;
    if (root && page) typeset(root);
  });

  const activate = (next: Omit<Open, 'id'>) => {
    open = { ...next, id: ++seq };
    session.active = cell.id;
  };

  let starting = false;

  // Opens an editor: on the block under `target`, on the first block when there is no target (the `e` key), on a new
  // paragraph in a cell with nothing in it, or on the whole cell when it could not be split into blocks.
  async function begin(target: Element | null, point: { x: number; y: number } | null) {
    if (!session.on) {
      if (session.why && !session.told) {
        session.told = true;
        import('./notice').then((m) => m.say(session.why));
      }
      return;
    }
    // a block drawn again since the click is no longer in the page
    if (starting || open || !page || (target && (!root?.contains(target) || target.closest('a')))) return;
    const hit = target?.closest<HTMLElement>('[data-b]') ?? null;
    if (target && page.blocks?.length && !hit) return;
    // the TeX of the formula under the pointer, which opens the block as text with the caret on it
    const tex = target?.closest('.math')?.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? null;
    starting = true;
    try {
      if (!(await current()?.ensureBase())) return;
      Editor ??= (await import('./edit/BlockEditor.svelte')).default;
      if (!page || (target && !root?.contains(target))) return;
      const blocks = page.blocks;
      if (!blocks) return activate({ kind: 'whole', b: -1, mode: 'source', at: tex ? { find: tex } : null });
      if (!blocks.length) return activate({ kind: 'ghost', b: -1, mode: 'rich', at: 'start' });
      const b = hit ? Number(hit.dataset.b) : 0;
      if (!blocks[b]) return;
      const text = blocks[b].kind === 'source' || tex !== null;
      activate({ kind: 'block', b, mode: text ? 'source' : 'rich', at: tex ? { find: tex } : text ? null : point ? { word: point } : 'start' });
    } finally {
      starting = false;
    }
  }

  // Touch has no double-click that can be relied on, so two quick taps in one place count as one.
  let tap: { at: number; x: number; y: number } | null = null;
  function touched(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    const near = tap && e.timeStamp - tap.at < 350 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 24;
    tap = near ? null : { at: e.timeStamp, x: e.clientX, y: e.clientY };
    if (near) begin(e.target as Element, { x: e.clientX, y: e.clientY });
  }

  // The `e` key reaches the cell as an event, since the keys are handled at the window.
  $effect(() => {
    const cellEl = root?.closest('[data-cell]');
    if (!cellEl) return;
    const go = () => begin(null, null);
    cellEl.addEventListener('edit', go);
    return () => cellEl.removeEventListener('edit', go);
  });

  async function done(next: string | null, follow?: Follow) {
    const was = open;
    const before = page?.blocks?.length ?? 0;
    open = null;
    session.active = null;
    // a commit that was refused (the cell changed underneath) leaves everything closed
    const ok = next === null || commit(cell.id, cell.source, next);
    if (!follow || !was || !ok) {
      // the reader stays where they were rather than falling to the top of the page, unless they clicked on something else
      tick().then(() => {
        const now = document.activeElement;
        if (!now || now === document.body) root?.closest<HTMLElement>('[data-cell]')?.focus({ preventScroll: true });
      });
      return;
    }
    // the new source reaches this cell only when the parent flushes, so the blocks are read after that
    await tick();
    const blocks = page?.blocks ?? null;
    const kindAt = (i: number): 'rich' | 'source' => (blocks![i].kind === 'source' ? 'source' : 'rich');
    if (follow.to === 'ghost') {
      // a new paragraph that was just committed is the block after `was.b`, so the next one goes after it
      const after = Math.min(was.kind === 'ghost' ? was.b + 1 : was.b, (blocks?.length ?? 0) - 1);
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

<div class="md" bind:this={root} ondblclick={(e) => begin(e.target as Element, { x: e.clientX, y: e.clientY })} onpointerup={touched} role="presentation">
  {#if page}
    {#if open?.kind === 'whole' && Editor}
      {#key open.id}
        <Editor block={null} source={cell.source} attachments={cell.attachments} mode="source" at={open.at} onDone={done} />
      {/key}
    {:else}
      {#if open?.kind === 'ghost' && open.b === -1}{@render ghost()}{/if}
      {#if session.on && page.blocks?.length === 0 && open?.kind !== 'ghost'}
        <p class="placeholder">Empty cell · double-click to write</p>
      {/if}
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
