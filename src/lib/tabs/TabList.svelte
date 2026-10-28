<script lang="ts">
  import Pop from '../Pop.svelte';
  import Lucide from '../Lucide.svelte';
  import Mark from './Mark.svelte';
  import { act, strip, type TabView } from './state.svelte';
  import { ui } from '../ui.svelte';
  import './tabs.css';

  // Every open notebook in one list: where the chips do not fit, and on a phone. It hangs outside the header, whose layer would otherwise hold its fixed position.
  const open = $derived(ui.pop === 'tabs');
  const line = (t: TabView) => (t.status === 'loading' ? 'Opening…' : t.status === 'error' ? 'Did not open' : t.dirty ? 'Unsaved edits' : t.web ? 'From the web' : 'From this device');

  function go(id: string) {
    ui.pop = null;
    act.go(id);
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && open && (ui.pop = null)}
  onpointerdown={(e) => open && !(e.target as Element).closest('.pop, [data-pop]') && (ui.pop = null)}
/>

<Pop id="tabs" label="Open notebooks" width={344} anchor={() => document.querySelector('[data-pop=tabs]')}>
  <ul class="tb-list">
    {#each strip.list as t (t.id)}
      {@const on = t.id === strip.active}
      <li class="tb-item" class:on>
        <button class="tb-pick" aria-current={on ? 'page' : undefined} onclick={() => go(t.id)}>
          <Mark {t} />
          <span class="tb-txt"><b>{t.name}</b><small>{line(t)}</small></span>
        </button>
        <button class="tb-x" aria-label="Close {t.name}" onclick={() => act.close(t.id)}><Lucide name="x" size={14} /></button>
      </li>
    {/each}
  </ul>
  <button class="tb-foot" onclick={() => (ui.pop = 'open')}><Lucide name="plus" /><span>Open a notebook</span><kbd>⌘O</kbd></button>
</Pop>
