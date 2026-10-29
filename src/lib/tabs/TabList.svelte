<script lang="ts">
  import Pop from '../Pop.svelte';
  import Lucide from '../Lucide.svelte';
  import Mark from './Mark.svelte';
  import { act, fit, here, strip, type TabView } from './state.svelte';
  import { ui } from '../ui.svelte';
  import './tabs.css';

  // Every open notebook in one list: where the chips do not fit, and on a phone. It hangs outside the header, whose layer would otherwise hold its fixed position.
  const open = $derived(ui.pop === 'tabs');
  let list = $state<HTMLElement>();

  // A long list scrolls on its own, under the row that opens another; it opens on the notebook being read.
  $effect(() => {
    if (!open || !list) return;
    const on = list.querySelector<HTMLElement>('.tb-item.on');
    if (on) list.scrollTop = on.offsetTop - (list.clientHeight - on.offsetHeight) / 2;
  });
  const line = (t: TabView) => (t.status === 'loading' ? 'Opening…' : t.status === 'error' ? 'Did not open' : t.dirty ? 'Unsaved edits' : t.web ? t.from || 'From the web' : 'On this device');

  function go(id: string) {
    ui.pop = null;
    act.go(id, here());
  }

  // Up and down move between the rows.
  function keys(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') return void (ui.pop = null);
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const picks = [...document.querySelectorAll<HTMLElement>('#pop-tabs .tb-pick')];
    const i = picks.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    picks[Math.min(picks.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
  }
</script>

<svelte:window
  onkeydown={keys}
  onpointerdown={(e) => open && !(e.target as Element).closest('.pop, [data-pop]') && (ui.pop = null)}
/>

<Pop id="tabs" label="Open notebooks" width={344} anchor={() => document.querySelector('[data-pop=tabs]')}>
  <ul class="tb-list" bind:this={list}>
    {#each strip.list as t (t.id)}
      {@const on = t.id === strip.active}
      <li class="tb-item" class:on>
        <button class="tb-pick" title={t.name} aria-current={on ? 'page' : undefined} onclick={() => go(t.id)}>
          <Mark {t} />
          <span class="tb-txt"><b>{fit(t.name, 236, '600 14px Inter, system-ui, sans-serif')}</b><small>{line(t)}</small></span>
        </button>
        <button class="tb-x" aria-label="Close {t.name}" onclick={() => act.close(t.id)}><Lucide name="x" size={14} /></button>
      </li>
    {/each}
  </ul>
  <button class="tb-foot" onclick={() => (ui.pop = 'open')}><Lucide name="plus" /><span>Open a notebook</span><kbd>⌘O</kbd></button>
</Pop>
