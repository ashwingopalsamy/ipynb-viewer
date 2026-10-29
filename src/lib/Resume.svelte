<script lang="ts">
  import type { Cell } from './notebook';
  import { outline } from './outline';
  import { jump, calm } from './ui.svelte';
  import './resume.css';

  let { cells, name, ready }: { cells: readonly Cell[]; name: string; ready: boolean } = $props();

  const KEY = 'resume';
  type Saved = Record<string, { cell: string; at: number }>;

  function read(): Saved {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  let offer = $state<{ cell: string; label: string } | null>(null);
  let offered = '';

  // Once the notebook is in, offer the way back to where this file was left.
  $effect(() => {
    if (!ready || offered === name) return;
    offered = name;
    const saved = read()[name];
    const at = saved ? cells.findIndex((c) => c.id === saved.cell) : -1;
    if (at < 3 || scrollY > 200) return;
    const index = new Map(cells.map((c, i) => [c.id, i]));
    const before = outline(cells).headings.filter((h) => (index.get(h.cell) ?? 0) <= at);
    offer = { cell: saved.cell, label: before.at(-1)?.text ?? '' };
  });

  let timer = 0;
  function remember() {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      offer = null;
      const el = document.elementFromPoint(Math.min(innerWidth / 2, 520), 150)?.closest('[data-cell]');
      const cell = (el as HTMLElement | null)?.dataset.cell;
      if (!cell || scrollY < 300) return;
      const all = read();
      all[name] = { cell, at: Date.now() };
      for (const k of Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(40)) delete all[k];
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch {
        // storage is blocked; nothing to remember
      }
    }, 600);
  }

  function back() {
    jump(document.querySelector(`[data-cell="${CSS.escape(offer!.cell)}"]`));
    offer = null;
  }

  // Near the end of a long notebook, the way back up: past 95% of at least three screens, and gone again below 90%, so it does not
  // flicker at the line. The notebook's title says where it leads.
  let end = $state(false);
  const title = $derived(end ? (outline(cells).headings[0]?.text ?? '') : '');
  function ending() {
    const room = document.documentElement.scrollHeight - innerHeight;
    if (!ready || room < innerHeight * 2) return void (end = false);
    const at = scrollY / room;
    if (at >= 0.95) end = true;
    else if (at < 0.9) end = false;
  }
  function top() {
    end = false;
    scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
  }

  // At the very end the footer comes up under the pill: the pill rides up with it, 12px clear, and never covers its links.
  let pill = $state<HTMLElement>();
  let rise = $state(0);
  function clear() {
    const foot = pill && document.querySelector('.made')?.getBoundingClientRect().top;
    if (!pill || foot === undefined) return void (rise = 0);
    rise = Math.max(0, innerHeight - parseFloat(getComputedStyle(pill).bottom) + 12 - foot);
  }
  // cells that draw themselves late move the footer without a scroll, so a change in the page's height counts too
  $effect(() => {
    if (!pill) return;
    clear();
    const grow = new ResizeObserver(clear);
    grow.observe(document.body);
    return () => grow.disconnect();
  });
</script>

<svelte:window onscroll={() => (remember(), ending(), clear())} onresize={clear} onkeydown={(e) => e.key === 'Escape' && ((offer = null), (end = false))} />

{#if offer}
  <button class="back" bind:this={pill} style:translate={rise ? `0 ${-rise}px` : undefined} onclick={back}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg><span>Continue reading</span>{#if offer.label}<span class="where">{offer.label}</span>{/if}</button>
{:else if end}
  <button class="back" bind:this={pill} style:translate={rise ? `0 ${-rise}px` : undefined} onclick={top}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg><span>Back to top</span>{#if title}<span class="where">{title}</span>{/if}</button>
{/if}
