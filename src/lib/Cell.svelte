<script lang="ts">
  import type { Cell } from './notebook';
  import { inview } from './inview';
  import MarkdownCell from './MarkdownCell.svelte';
  import CodeCell from './CodeCell.svelte';
  import { blank } from './blank';
  import { session } from './edit/session.svelte';

  let { cell, index, language, fresh = false }: { cell: Cell; index: number; language: string | null; fresh?: boolean } = $props();

  let seen = $state(false);

  // a text cell that was emptied by editing stays, so there is somewhere to write again
  const empty = $derived(blank(cell) && !(cell.type === 'markdown' && session.edited.has(cell.id)));

  // A rough content height (the cell's own padding comes on top) so the scrollbar holds still until the real layout is known.
  const height = $derived.by(() => {
    if (cell.type === 'markdown') {
      // a wrapped line costs a line of text, a blank one the gap between paragraphs
      let h = 8;
      for (const l of cell.source.split('\n')) h += l ? Math.ceil(l.length / (innerWidth < 720 ? 48 : 80)) * (l[0] === '#' ? 52 : 28) : 12;
      return h;
    }
    // the tray, then the code box (capped at 28 lines behind a row), then the output box
    const n = cell.source.trimEnd().split('\n').length;
    let h = 16 + 32 + 22.3 * (n > 40 ? 28 : n) + (n > 40 ? 36 : 0);
    if (cell.type === 'code' && cell.outputs.length) {
      h += 40;
      for (const o of cell.outputs) {
        const l = o.type === 'stream' ? o.text.trimEnd().split('\n').length : 0;
        h += o.type === 'stream' ? (l > 24 ? 456 : l * 21) : o.type === 'error' ? 84 : Object.keys(o.data).some((k) => /^image|html/.test(k)) ? 340 : 21;
      }
    }
    return h;
  });
</script>

{#if !empty}
  <article class="cell {cell.type}" class:fresh class:edited={session.edited.has(cell.id)} tabindex="-1" data-cell={cell.id} style:--h="{height}px" style:--i={Math.min(index, 10)} use:inview={() => (seen = true)}>
    {#if cell.type === 'markdown'}
      <div class="gutter"></div>
      <MarkdownCell {cell} {seen} />
    {:else if cell.type === 'code'}
      <CodeCell {cell} {language} {seen} />
    {:else}
      <div class="gutter"></div>
      <pre class="raw">{cell.source}</pre>
    {/if}
  </article>
{/if}
