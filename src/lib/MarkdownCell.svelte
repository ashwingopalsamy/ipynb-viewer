<script lang="ts">
  import type { MarkdownCell } from './notebook';
  import { typeset } from './math';

  let { cell, seen }: { cell: MarkdownCell; seen: boolean } = $props();

  let html = $state<string | null>(null);
  let root = $state<HTMLElement>();

  $effect(() => {
    if (!seen) return;
    let live = true;
    import('./markdown').then((m) => {
      if (live) html = m.renderMarkdown(cell.source, cell.attachments);
    });
    return () => {
      live = false;
    };
  });

  $effect(() => {
    if (html !== null && root) typeset(root);
  });
</script>

<div class="md" bind:this={root}>
  {#if html !== null}
    <!-- sanitized by DOMPurify in renderMarkdown -->
    {@html html}
  {:else}
    <p class="pending">{cell.source}</p>
  {/if}
</div>
