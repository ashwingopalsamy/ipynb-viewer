<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ui, type Pop } from './ui.svelte';

  // `near` hangs the card from its trigger (right edges together, flipping above when the page ends); without it
  // the card sits under the header, centred on the trigger.
  let { id, label, width = 260, lead = true, near = false, anchor, children }: { id: Pop; label: string; width?: number; lead?: boolean; near?: boolean; anchor: () => Element | null; children: Snippet } = $props();

  const open = $derived(ui.pop === id);
  let box = $state<HTMLElement>();
  let left = $state(0);
  let top = $state(0);
  let origin = $state(0);
  let up = $state(false);
  let wide = $state(0);

  function place(from: Element | null | undefined) {
    if (!box) return;
    const r = from?.getBoundingClientRect();
    // a card within a thumb of the screen's width takes all of it
    const w = innerWidth - 24 - width < 48 ? innerWidth - 24 : Math.min(width, innerWidth - 24);
    wide = w;
    if (near && r) {
      const h = box.offsetHeight;
      up = r.bottom + 8 + h > innerHeight - 12 && r.top - 8 - h > 12;
      left = Math.min(Math.max(12, r.right - w), innerWidth - w - 12);
      top = up ? r.top - 8 - h : Math.min(r.bottom + 8, innerHeight - h - 12);
      origin = r.left + r.width / 2 - left;
      return;
    }
    const mid = r ? r.left + r.width / 2 : innerWidth / 2;
    left = Math.min(Math.max(12, mid - w / 2), innerWidth - w - 12);
    top = (document.querySelector('.bar')?.getBoundingClientRect().bottom ?? 58) + 8;
    origin = mid - left;
  }

  // Places the card, takes focus on open, and gives it back on close.
  $effect(() => {
    if (!open || !box) return;
    const from = anchor();
    const back = document.activeElement as HTMLElement | null;
    place(from);
    (lead ? (box.querySelector<HTMLElement>('[aria-current], [role=radio][aria-checked=true]') ?? box.querySelector<HTMLElement>('button, [role=switch]') ?? box) : box).focus({ preventScroll: true });
    const node = box;
    // a card hung from its trigger follows it while the page moves, and goes when the trigger leaves the screen
    const follow = () => {
      const r = from?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) ui.pop = null;
      else place(from);
    };
    if (near) addEventListener('scroll', follow, { passive: true });
    // a note appearing or going changes the card's height, and a card that opens upward must stay on its trigger
    const grow = near ? new ResizeObserver(() => place(from)) : undefined;
    grow?.observe(node);
    return () => {
      removeEventListener('scroll', follow);
      grow?.disconnect();
      if (node.contains(document.activeElement)) (from instanceof HTMLButtonElement ? from : back)?.focus({ preventScroll: true });
    };
  });
</script>

<div class="pop" class:on={open} class:up id="pop-{id}" role="dialog" aria-label={label} tabindex="-1" bind:this={box} style:left="{left}px" style:top="{top}px" style:width="{wide || width}px" style:--ox="{origin}px">
  {@render children()}
</div>
