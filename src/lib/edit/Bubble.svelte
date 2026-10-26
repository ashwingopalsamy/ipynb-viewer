<script lang="ts">
  import { onMount } from 'svelte';
  import Lucide, { type Lucide as Icon } from '../Lucide.svelte';

  // The formatting toolbar over selected text, for touch and for anyone who does not know the keys.
  type Kind = 'strong' | 'em' | 'del' | 'code' | 'link';
  let { root, onmark }: { root: () => HTMLElement | undefined; onmark: (kind: Kind) => void } = $props();

  const TOOLS: { kind: Kind; icon: Icon; label: string }[] = [
    { kind: 'strong', icon: 'bold', label: 'Bold · ⌘B' },
    { kind: 'em', icon: 'italic', label: 'Italic · ⌘I' },
    { kind: 'del', icon: 'strikethrough', label: 'Strikethrough · ⌘⇧X' },
    { kind: 'code', icon: 'code', label: 'Code · ⌘E' },
    { kind: 'link', icon: 'link', label: 'Link · ⌘K' },
  ];

  let at = $state<{ x: number; y: number; below: boolean } | null>(null);
  let on = $state<Record<Kind, boolean>>({ strong: false, em: false, del: false, code: false, link: false });

  function sync() {
    const el = root();
    const sel = getSelection();
    if (!el || !sel?.rangeCount || sel.isCollapsed || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) {
      at = null;
      return;
    }
    const box = sel.getRangeAt(0).getBoundingClientRect();
    if (!box.width && !box.height) {
      at = null;
      return;
    }
    // under the selection when the header would cover it
    const below = box.top < 96;
    at = { x: box.left + box.width / 2, y: below ? box.bottom : box.top, below };
    const near = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    on = { strong: document.queryCommandState('bold'), em: document.queryCommandState('italic'), del: document.queryCommandState('strikeThrough'), code: !!near?.closest('code'), link: !!near?.closest('a') };
  }

  onMount(() => {
    document.addEventListener('selectionchange', sync);
    addEventListener('scroll', sync, true);
    return () => {
      document.removeEventListener('selectionchange', sync);
      removeEventListener('scroll', sync, true);
    };
  });

  // Kept out of the block's own markup, which is read back as text.
  function portal(node: HTMLElement) {
    document.body.append(node);
    return { destroy: () => node.remove() };
  }
</script>

{#if at}
  <div class="fmt" class:below={at.below} role="toolbar" aria-label="Format" use:portal style:left="{at.x}px" style:top="{at.y}px">
    {#each TOOLS as t}
      <button
        type="button"
        title={t.label}
        aria-label={t.label}
        aria-pressed={on[t.kind]}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => {
          onmark(t.kind);
          queueMicrotask(sync);
        }}
      >
        <Lucide name={t.icon} size={16} />
      </button>
    {/each}
  </div>
{/if}
