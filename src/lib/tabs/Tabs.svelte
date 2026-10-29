<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Lucide from '../Lucide.svelte';
  import Mark from './Mark.svelte';
  import { act, fit, hooks, short, strip } from './state.svelte';
  import { ui, toggle } from '../ui.svelte';
  import './tabs.css';

  // One chip per open notebook, inside the left pill (App.svelte draws the pill and the single chip it starts with). When the chips no longer fit, the count button opens the list (TabList.svelte).
  let row = $state<HTMLElement>();
  let over = $state(false);
  let before = $state(false);
  let after = $state(false);

  // a chip's name in its own type; at most 200px, a chip leaves it 134: 12 + 14 (icon) + 7 + name + 4 + 24 (close) + 5
  const FONT = '500 13px Inter, system-ui, sans-serif';
  const now = $derived(strip.list.find((t) => t.id === strip.active));
  // the strip's one tab stop: the chip being read
  const stop = $derived((now ?? strip.list[0])?.id);
  // what changes the chips' widths or places
  const shape = $derived(strip.list.map((t) => `${t.id}:${t.name}:${t.dirty}`).join('\n'));

  // Each end fades only while there is more past it.
  const measure = () => {
    if (!row) return;
    over = row.scrollWidth > row.clientWidth + 1;
    // while they overflow, no chip is wider than the strip less its fades, so the one being read always fits whole
    row.style.setProperty('--most', over ? `${Math.max(64, row.clientWidth - 48)}px` : '');
    before = row.scrollLeft > 1;
    after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  };

  // Brings a chip (the one being read, unless told) fully into view, past the fades. The row's own scroll is set: scrollIntoView would move the page around it too.
  const reveal = (chip: Element | null | undefined = row?.querySelector('.tb-chip.on')) => {
    if (!row || !(chip instanceof HTMLElement)) return;
    const pad = row.scrollWidth > row.clientWidth + 1 ? 24 : 0;
    row.scrollLeft = Math.min(Math.max(row.scrollLeft, chip.offsetLeft + chip.offsetWidth + pad - row.clientWidth), chip.offsetLeft - pad);
  };

  // A tab was picked: the chips start where the page it came from had them, so the strip does not jump; then the chip being read is brought into view.
  $effect(() => {
    strip.active;
    if (!row) return;
    row.scrollLeft = untrack(() => strip.x);
    reveal();
    measure();
  });

  $effect(() => {
    shape;
    if (!row) return;
    reveal();
    measure();
  });

  $effect(() => {
    if (!row) return;
    const watching = new ResizeObserver(() => (reveal(), measure()));
    watching.observe(row);
    return () => watching.disconnect();
  });

  // In a tab of its own, the page is shown only once its strip is drawn (host.svelte.ts), so the header never blinks empty.
  onMount(() => requestAnimationFrame(() => requestAnimationFrame(() => hooks.painted())));

  // The wheel's up and down scroll the chips sideways while they overflow.
  $effect(() => {
    const el = row;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const focus = (chip?: HTMLElement) => {
    if (!chip) return;
    chip.focus({ preventScroll: true });
    reveal(chip.closest('.tb-chip'));
  };

  // The arrows, Home and End move between chips; Enter and Space switch (the button's own); Delete and Backspace close the one in hand, and the focus moves to its neighbour first.
  function keys(e: KeyboardEvent, id: string) {
    if (!row || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const chips = [...row.querySelectorAll<HTMLElement>('.tb-go')];
    const i = chips.indexOf(e.currentTarget as HTMLElement);
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      focus(chips[i + 1] ?? chips[i - 1]);
      return act.close(id);
    }
    const to = e.key === 'ArrowRight' ? chips[i + 1] : e.key === 'ArrowLeft' ? chips[i - 1] : e.key === 'Home' ? chips[0] : e.key === 'End' ? chips[chips.length - 1] : null;
    if (to === null) return;
    e.preventDefault();
    focus(to);
  }
</script>

<div class="tb-row" class:l={before} class:r={after} bind:this={row} onscroll={measure}>
  {#each strip.list as t (t.id)}
    {@const on = t.id === strip.active}
    <div class="tb-chip" class:on class:dirty={t.dirty} class:new={Date.now() - t.born < 800}>
      <button class="tb-go" title={t.name} tabindex={t.id === stop ? 0 : -1} aria-current={on ? 'page' : undefined} onclick={() => act.go(t.id, row?.scrollLeft)} onkeydown={(e) => keys(e, t.id)}>
        <span class="tb-ico"><Mark {t} /></span><span class="tb-nm">{fit(t.name, 134, FONT)}</span>
      </button>
      <span class="tb-end">{#if t.dirty}<span class="tb-dot" title="Unsaved edits"></span>{/if}<button class="tb-x" tabindex="-1" aria-label="Close {t.name}" onclick={() => act.close(t.id)}><Lucide name="x" size={14} /></button></span>
    </div>
  {/each}
</div>
<button class="tb-all" class:over data-pop="tabs" aria-haspopup="dialog" aria-expanded={ui.pop === 'tabs'} aria-label="All open notebooks" onclick={() => toggle('tabs')}>
  <span class="tb-cur">{now ? short(now.name, 26) : ''}</span><span class="tb-n">{strip.list.length}</span><Lucide name="chevron-down" size={14} />
</button>
