<script lang="ts">
  import type { Cell } from './notebook';
  import { outline } from './outline';
  import { jump } from './ui.svelte';
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
</script>

<svelte:window onscroll={remember} onkeydown={(e) => e.key === 'Escape' && (offer = null)} />

{#if offer}
  <button class="back" onclick={back}>{offer.label ? `Back to ${offer.label}` : 'Back where you left off'}</button>
{/if}
