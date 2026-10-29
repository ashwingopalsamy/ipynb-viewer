<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { ui, type Pop } from './ui.svelte';
  // the card's base styles arrive with the popover itself, so a card never shows unstyled while the rest loads
  import './ui.css';

  // `near` hangs the card from its trigger (right edges together, flipping above when the page ends); without it
  // the card sits under the header, centred on the trigger.
  let { id, label, width = 260, lead = true, near = false, top: first = false, bare = false, inline = false, anchor, children }: { bare?: boolean; inline?: boolean; id: Pop; label: string; width?: number; lead?: boolean; near?: boolean; top?: boolean; anchor: () => Element | null; children: Snippet } = $props();

  const open = $derived(ui.pop === id);
  let box = $state<HTMLElement>();
  let left = $state(0);
  let top = $state(0);
  let origin = $state(0);
  let up = $state(false);
  let wide = $state(0);

  // Each value is worked out first and written once: the effect that calls this must never read back what it wrote, or a card
  // narrower than it asked for (the search bar beside many tabs) would set itself off again on every run.
  function place(from: Element | null | undefined) {
    if (!box) return;
    const r = from?.getBoundingClientRect();
    // a card within a thumb of the screen's width takes all of it
    const w = innerWidth - 24 - width < 48 ? innerWidth - 24 : Math.min(width, innerWidth - 24);
    const put = (l: number, t: number, o: number, u = false, wd = w) => ((left = l), (top = t), (origin = o), (up = u), (wide = wd));
    // in the header's middle: the card takes the room between the notebooks' pill and the tools, on the header's own line
    if (inline) {
      const gapL = document.querySelector('.bar .tb')?.getBoundingClientRect().right ?? 0;
      const gapR = document.querySelector('.tools')?.getBoundingClientRect().left ?? innerWidth;
      // centred on the window when it fits there at a useful width, else in the middle of the room the pills leave
      const mid = innerWidth / 2;
      const even = Math.min(width, 2 * Math.min(mid - gapL, gapR - mid) - 24);
      if (even >= 280) return put(mid - even / 2, 8, even / 2, false, even);
      const room = gapR - gapL - 24;
      // too little room on the header's line: under the header instead, centred
      if (room < 240) return put(mid - w / 2, 64, w / 2, false, w);
      const fit = Math.min(width, room);
      return put(gapL + 12 + Math.max(0, (room - fit) / 2), 8, fit / 2, false, fit);
    }
    if (near && r) {
      const h = box.offsetHeight;
      const u = r.bottom + 8 + h > innerHeight - 12 && r.top - 8 - h > 12;
      const l = Math.min(Math.max(12, r.right - w), innerWidth - w - 12);
      return put(l, u ? r.top - 8 - h : Math.min(r.bottom + 8, innerHeight - h - 12), r.left + r.width / 2 - l, u);
    }
    // a card hung from a tool is exactly as wide as the dock it hangs from, so the two share a left edge and a right edge
    const dock = r && r.top < innerHeight / 2 && innerWidth > 720 ? from?.closest('.tools') : null;
    if (dock && r) {
      const { left: lo, right: edge } = dock.getBoundingClientRect();
      return put(lo, 64, r.left + r.width / 2 - lo, false, edge - lo);
    }
    // and a card hung from the notebooks' pill shares that pill's left edge
    const tb = r && r.top < innerHeight / 2 && innerWidth > 720 ? from?.closest('.tb') : null;
    if (tb && r) {
      const l = Math.min(Math.max(12, tb.getBoundingClientRect().left), innerWidth - w - 12);
      return put(l, 64, r.left + r.width / 2 - l);
    }
    const mid = r ? r.left + r.width / 2 : innerWidth / 2;
    const l = Math.min(Math.max(12, mid - w / 2), innerWidth - w - 12);
    // the header is 56px tall whether or not it has stepped aside; a trigger in the phone's dock opens its card upward, 12px clear of
    // the dock as a card under the header is clear of it
    const u = !!r && r.top > innerHeight / 2;
    const base = (from?.closest('.tools') ?? from)?.getBoundingClientRect().top ?? 0;
    put(l, u ? Math.max(12, base - 12 - box.offsetHeight) : 64, mid - l, u);
  }

  // A card that closes keeps what it showed until it has faded out (`ui.leaving`, read through `showing()`), so on its way out it never
  // shrinks to an empty frame; it is let go when its fade ends, the moment its visibility flips.
  let was = false;
  $effect(() => {
    if (open) {
      was = true;
      untrack(() => ui.leaving === id && (ui.leaving = null));
      return;
    }
    if (!was || !box) return;
    was = false;
    ui.leaving = id;
    const node = box;
    const done = () => untrack(() => ui.leaving === id && (ui.leaving = null));
    const end = (e: TransitionEvent) => e.target === node && e.propertyName === 'visibility' && done();
    const late = setTimeout(done, 400);
    node.addEventListener('transitionend', end);
    return () => {
      clearTimeout(late);
      node.removeEventListener('transitionend', end);
    };
  });

  // Places the card, takes focus on open, and gives it back on close.
  $effect(() => {
    if (!open || !box) return;
    const from = anchor();
    const back = document.activeElement as HTMLElement | null;
    place(from);
    (lead ? ((!first && box.querySelector<HTMLElement>('[aria-current], [role=radio][aria-checked=true]')) || box.querySelector<HTMLElement>('input, button, [role=switch]') || box) : box).focus({ preventScroll: true });
    const node = box;
    // a card hung from its trigger follows it while the page moves, and goes when the trigger leaves the screen
    const follow = () => {
      const r = from?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) ui.pop = null;
      else place(from);
    };
    if (near) addEventListener('scroll', follow, { passive: true });
    // a note appearing or going changes the card's height, and a card that opens upward must stay on its trigger
    const grow = near || (from && from.getBoundingClientRect().top > innerHeight / 2) ? new ResizeObserver(() => place(from)) : undefined;
    grow?.observe(node);
    return () => {
      removeEventListener('scroll', follow);
      grow?.disconnect();
      if (node.contains(document.activeElement)) (from instanceof HTMLButtonElement ? from : back)?.focus({ preventScroll: true });
    };
  });
</script>

<div class="pop" class:on={open} class:leaving={ui.leaving === id} class:up class:bare id="pop-{id}" role="dialog" aria-label={label} tabindex="-1" bind:this={box} style:left="{left}px" style:top="{top}px" style:width="{wide || width}px" style:--ox="{origin}px">
  {@render children()}
</div>
