<script lang="ts">
  import Lucide from '../Lucide.svelte';
  import Mark from './Mark.svelte';
  import { act, strip } from './state.svelte';
  import { ui, toggle } from '../ui.svelte';
  import './tabs.css';

  // One chip per open notebook, in the name pill's place. When the chips no longer fit, the count button opens the list (TabList.svelte).
  let row = $state<HTMLElement>();
  let over = $state(false);

  const bare = (name: string) => name.replace(/\.ipynb$/i, '');
  const now = $derived(strip.list.find((t) => t.id === strip.active));
  const measure = () => {
    if (row) over = row.scrollWidth > row.clientWidth + 1;
  };

  // The active chip stays in view, then the row says whether it overflows.
  $effect(() => {
    strip.active;
    strip.list;
    if (!row) return;
    row.querySelector('.tb-chip.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    measure();
  });

  $effect(() => {
    if (!row) return;
    const watching = new ResizeObserver(measure);
    watching.observe(row);
    return () => watching.disconnect();
  });

  // The header leaves the section pill less room while the strip is up.
  $effect(() => {
    document.documentElement.classList.add('tb-many');
    return () => document.documentElement.classList.remove('tb-many');
  });
</script>

<nav class="tb pill" class:over aria-label="Open notebooks">
  <div class="tb-row" bind:this={row}>
    {#each strip.list as t (t.id)}
      {@const on = t.id === strip.active}
      <div class="tb-chip" class:on class:dirty={t.dirty}>
        <button class="tb-go" aria-current={on ? 'page' : undefined} onclick={() => act.go(t.id)}><Mark {t} /><span class="tb-nm">{bare(t.name)}</span></button>
        <button class="tb-x" aria-label="Close {t.name}" onclick={() => act.close(t.id)}><Lucide name="x" size={14} /></button>
      </div>
    {/each}
  </div>
  <button class="tb-all" data-pop="tabs" aria-haspopup="dialog" aria-expanded={ui.pop === 'tabs'} aria-label="All open notebooks" onclick={() => toggle('tabs')}>
    <span class="tb-cur">{now ? bare(now.name) : ''}</span><span class="tb-n">{strip.list.length}</span><Lucide name="chevron-down" size={14} />
  </button>
</nav>
