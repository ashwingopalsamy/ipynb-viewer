<script lang="ts" module>
  // The editor loads while the page is idle, once a notebook that can be edited has drawn some text, so the first
  // double-click opens it at once and the first paint never waits for it. Not on a connection that asks to save data.
  let engine: Promise<typeof import('./edit/BlockEditor.svelte').default> | undefined;
  const load = () =>
    (engine ??= import('./edit/BlockEditor.svelte').then(
      (m) => m.default,
      // a load that failed (offline) is tried again on the next edit
      (e) => ((engine = undefined), Promise.reject(e)),
    ));
  let asked = false;
  function prefetch() {
    if (asked || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    asked = true;
    // what opening an editor also reads: the file the edits are patched into
    const go = () => void Promise.all([load(), import('./edit/save')]).catch(() => {});
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1500);
  }
  // the renderer, once any cell has it: an arrow key into a cell not drawn yet draws it without waiting
  let lib: typeof import('./markdown') | undefined;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { MarkdownCell } from './notebook';
  import { typeset } from './math';
  import { session, commit, current } from './edit/session.svelte';
  import type { Ask, Caret, Follow } from './edit/types';

  let { cell, seen }: { cell: MarkdownCell; seen: boolean } = $props();

  let md = $state.raw<typeof import('./markdown')>();
  let Editor = $state.raw<typeof import('./edit/BlockEditor.svelte').default>();
  let root = $state<HTMLElement>();

  // the block that is open: `b` indexes the drawn blocks, a ghost is a new paragraph after block `after` (-1 for the start);
  // `top` is where on the screen it was when it was clicked open
  type Open = { id: number; kind: 'block' | 'whole' | 'ghost'; b: number; mode: 'rich' | 'source'; at: Caret | null; top?: number };
  let open = $state.raw<Open | null>(null);
  let seq = 0;

  $effect(() => {
    if (!seen || md) return;
    let live = true;
    import('./markdown').then((m) => {
      lib = m;
      if (live) md = m;
    });
    return () => {
      live = false;
    };
  });

  $effect(() => {
    if (session.on && md) prefetch();
  });

  // Drawn in pieces, one per block, while the notebook can be edited; the rest of the time as one.
  const page = $derived(
    md ? (session.on ? md.renderParts(cell.source, cell.attachments, session.edited.get(cell.id)) : { parts: [md.renderMarkdown(cell.source, cell.attachments)], blocks: null }) : null,
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

  // Opens an editor: on the block under `target`, on the first block when there is no target (the `e` key) or the first or
  // last when an arrow key goes on into this cell (`after.edge`), on a new paragraph in a cell with nothing in it, or on the
  // whole cell when it could not be split into blocks. After another editor commits (`after`), the block is found again by
  // where it starts in the source, since the commit can draw it again.
  async function begin(target: Element | null, point: { x: number; y: number } | null, after?: Ask) {
    if (!session.on) {
      if (session.why && !session.told) {
        session.told = true;
        import('./notice').then((m) => m.say(session.why));
      }
      return;
    }
    const edge = after?.edge;
    // a block drawn again since the click is no longer in the page
    if (starting || open || (!page && !edge) || (target && (!root?.contains(target) || target.closest('a')))) return;
    const hit = target?.closest<HTMLElement>('[data-b]') ?? null;
    if (target && page?.blocks?.length && !hit) return;
    // the TeX of the formula under the pointer, which opens the block as text with the caret on it
    const tex = target?.closest('.math')?.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? null;
    // the block's box (the cell's, when it is not drawn in blocks), which the click is measured from and which the editor opens over
    const box = target ? (hit ?? root!).getBoundingClientRect() : null;
    const top = box?.top;
    const at: Caret | null = tex ? { find: tex } : point && box ? { x: point.x - box.left, y: point.y - box.top } : null;
    const s = hit ? page?.blocks?.[Number(hit.dataset.b)]?.start : undefined;
    starting = true;
    try {
      // the editor before has read the file already, and nothing reads it again while one is open: no wait (a frame
      // drawn between the two would show the page without either)
      if (!after && !(await current()?.ensureBase())) return;
      Editor ??= await load();
      md ??= lib ?? (await import('./markdown'));
      // the commit of the editor before reaches the page here
      await tick();
      if (!page || (target && !after && !root?.contains(target))) return;
      const blocks = page.blocks;
      if (!blocks) return activate({ kind: 'whole', b: -1, mode: 'source', at: tex ? at : (edge ?? null), top });
      if (!blocks.length) return activate({ kind: 'ghost', b: -1, mode: 'rich', at: 'start', top });
      const b = s === undefined ? (edge?.edge === 'bottom' ? blocks.length - 1 : 0) : blocks.findIndex((x) => x.start === (after?.moved?.(s) ?? s));
      if (!blocks[b]) return;
      const text = blocks[b].kind === 'source' || tex !== null;
      activate({ kind: 'block', b, mode: text ? 'source' : 'rich', at: text && !tex ? (edge ?? null) : (at ?? edge ?? 'start'), top });
    } finally {
      starting = false;
      // a block that is not found again leaves the focus on its cell, as closing an editor does
      if (after && !open) root?.closest<HTMLElement>('[data-cell]')?.focus({ preventScroll: true });
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

  // The `e` key reaches the cell as an event, since the keys are handled at the window; so does a block clicked while another is open.
  $effect(() => {
    const cellEl = root?.closest('[data-cell]');
    if (!cellEl) return;
    const go = (e: Event) => {
      const ask = (e as CustomEvent<Ask | null>).detail;
      begin(ask?.target ?? null, ask?.point ?? null, ask ?? undefined);
    };
    cellEl.addEventListener('edit', go);
    return () => cellEl.removeEventListener('edit', go);
  });

  async function done(next: string | null, follow?: Follow) {
    const was = open;
    const from = cell.source;
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
    // a block clicked while this one was open, here or in another cell, is opened by its cell, which then takes the focus
    if (follow.to === 'cell') return void follow.cell.dispatchEvent(new CustomEvent('edit', { detail: follow.ask }));
    // the new source reaches this cell only when the parent flushes, so the blocks are read after that
    await tick();
    const blocks = page?.blocks ?? null;
    const kindAt = (i: number): 'rich' | 'source' => (blocks![i].kind === 'source' ? 'source' : 'rich');
    if (follow.to === 'near') {
      // an edit here was taken back or put back: the block where the text changed opens, or the one that was open when nothing did
      if (!blocks) return void (was.kind === 'whole' && activate({ kind: 'whole', b: -1, mode: 'source', at: follow.at }));
      if (!blocks.length) return activate({ kind: 'ghost', b: -1, mode: 'rich', at: 'start' });
      const now = cell.source;
      let p = 0;
      while (p < from.length && from[p] === now[p]) p++;
      const hit = from === now ? Math.max(0, was.b) : blocks.findIndex((b) => p <= b.end);
      const i = hit < 0 || hit >= blocks.length ? blocks.length - 1 : hit;
      activate({ kind: 'block', b: i, mode: kindAt(i), at: follow.at });
    } else if (follow.to === 'ghost' || follow.to === 'above') {
      // a new paragraph that was just committed is the block after `was.b`, so the next one goes after it; above goes after the block before
      const after = follow.to === 'above' ? was.b - 1 : Math.min(was.kind === 'ghost' ? was.b + 1 : was.b, (blocks?.length ?? 0) - 1);
      activate({ kind: 'ghost', b: after, mode: 'rich', at: follow.at });
    } else if (was.kind === 'ghost') {
      // a new paragraph that was committed is done, unless saving committed it mid-sentence, and then it opens again as the block it became
      if (next === null) activate({ kind: 'ghost', b: was.b, mode: 'rich', at: follow.at });
      else if (follow.to === 'same' && blocks?.[was.b + 1]) activate({ kind: 'block', b: was.b + 1, mode: kindAt(was.b + 1), at: follow.at });
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
      <Editor block={null} insertAt={open.b >= 0 ? page.blocks![open.b].end : 0} source={cell.source} attachments={cell.attachments} mode="rich" at={open.at} top={open.top} onDone={done} />
    {/key}
  {/if}
{/snippet}

<div class="md" bind:this={root} ondblclick={(e) => begin(e.target as Element, { x: e.clientX, y: e.clientY })} onpointerup={touched} role="presentation">
  {#if page}
    {#if open?.kind === 'whole' && Editor}
      {#key open.id}
        <Editor block={null} source={cell.source} attachments={cell.attachments} mode="source" at={open.at} top={open.top} onDone={done} />
      {/key}
    {:else}
      {#if open?.kind === 'ghost' && open.b === -1}{@render ghost()}{/if}
      {#if session.on && page.blocks?.length === 0 && open?.kind !== 'ghost'}
        <p class="placeholder">Empty cell · double-click to write</p>
      {/if}
      {#each page.parts as part, i}
        {#if open?.kind === 'block' && open.b === i && Editor}
          {#key open.id}
            <Editor block={page.blocks![i]} source={cell.source} attachments={cell.attachments} mode={open.mode} at={open.at} top={open.top} onDone={done} />
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
