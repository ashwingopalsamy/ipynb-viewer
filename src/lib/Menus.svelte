<script lang="ts">
  import Pop from './Pop.svelte';
  import Seg from './Seg.svelte';
  import { ui, prefs, setKeys } from './ui.svelte';
  import { view, setCode, setOut } from './fold.svelte';
  import { layout, setWidth, type Width } from './width.svelte';
  import { has, set, zoom, setZoom, SIZES } from './prefs.svelte';

  const bar = () => document.querySelector('.bar');
  const WIDTHS: [Width, string][] = [
    ['narrow', 'Narrow'],
    ['normal', 'Centered'],
    ['wide', 'Wide'],
  ];
  const keys: [string, string][] = [
    ['j k', 'Next, previous cell'],
    ['[ ]', 'Previous, next heading'],
    ['x', 'Open or close this cell'],
    ['c', 'Show or hide code'],
    ['o', 'Show or hide outputs'],
    ['s', 'Save the cell as an image'],
    ['f', 'Trace the selected name'],
    ['n p', 'Next, previous cell with it'],
    ['t', 'Contents'],
    ['m', 'Copy as Markdown'],
    ['/', 'Search'],
    ['?', 'This list'],
    ['esc', 'Close a popover'],
  ];

  const size = $derived(SIZES.indexOf(zoom()));
  const step = (by: number) => setZoom(SIZES[Math.min(SIZES.length - 1, Math.max(0, size + by))]);
</script>

{#snippet sw(label: string, on: boolean, flip: () => void, hint = '')}
  <button class="sw" role="switch" aria-checked={on} onclick={flip}>
    <span>{label}</span>
    {#if hint}<kbd>{hint}</kbd>{/if}
    <i class="track"><i class="knob"></i></i>
  </button>
{/snippet}

{#snippet flag(label: string, token: string, hint = '')}
  {@render sw(label, has(token), () => set(token, !has(token)), hint)}
{/snippet}

{#snippet flagOff(label: string, token: string)}
  {@render sw(label, !has(token), () => set(token, !has(token)))}
{/snippet}

<Pop id="settings" label="Settings" width={344} top anchor={() => document.querySelector('[data-pop=settings]')}>
  <div class="menu">
    <button class="sw find-row" onclick={() => (ui.pop = 'search')}><span>Search this notebook</span></button>
    <div role="group" aria-labelledby="cat-look">
      <h3 class="cat" id="cat-look">Appearance</h3>
      {@render flag('Serif text', 'serif')}
      {@render flagOff('Copy and save buttons', 'nobtn')}
    </div>

    <div role="group" aria-labelledby="cat-page">
      <h3 class="cat" id="cat-page">Layout</h3>
      <Seg label="Width" options={WIDTHS} value={layout.value} onchange={setWidth} />
      <div class="sw static">
        <span>Text size</span>
        <div class="step" role="group" aria-label="Text size">
          <button aria-label="Smaller text" disabled={size <= 0} onclick={() => step(-1)}><b class="s">A</b></button>
          <output>{SIZES[size]}%</output>
          <button aria-label="Larger text" disabled={size >= SIZES.length - 1} onclick={() => step(1)}><b class="l">A</b></button>
        </div>
      </div>
    </div>

    <div role="group" aria-labelledby="cat-code">
      <h3 class="cat" id="cat-code">Code</h3>
      {@render sw('Show code', view.code, () => setCode(!view.code), 'c')}
      {@render flag('Line numbers', 'ln')}
      {@render flag('Wrap long lines', 'wrap')}
      {@render flagOff('Run counts', 'nocnt')}
      {@render flagOff('Status dots', 'nodot')}
    </div>

    <div role="group" aria-labelledby="cat-out">
      <h3 class="cat" id="cat-out">Outputs</h3>
      {@render sw('Show outputs', view.out, () => setOut(!view.out), 'o')}
      {@render flagOff('Trim long outputs', 'notrim')}
      {@render sw('Load images from the web', has('remote'), () => (set('remote', !has('remote')), import('./markdown').then((m) => m.reveal())))}
      {#if ui.scrambled}{@render sw('Run order', ui.replayed, () => (ui.replayed = !ui.replayed))}{/if}
    </div>

    <div role="group" aria-labelledby="cat-read">
      <h3 class="cat" id="cat-read">Reading</h3>
      {@render flag('Spotlight', 'spot')}
      {@render flagOff('Trace names on click', 'notrace')}
      {@render flag('Hide header while scrolling', 'hush')}
      {@render flag('Calm motion', 'calm')}
      <button class="sw" onclick={() => (ui.pop = 'keys')}><span>Keyboard shortcuts</span><kbd>?</kbd></button>
    </div>
  </div>
</Pop>

<Pop id="keys" label="Keyboard shortcuts" width={320} lead={false} anchor={bar}>
  <dl class="keys">
    {#each keys as [k, what]}
      <dt>{#each k.split(' ') as one}<kbd>{one}</kbd>{/each}</dt>
      <dd>{what}</dd>
    {/each}
  </dl>
  <hr />
  {@render sw('Single-key shortcuts', prefs.keys, () => setKeys(!prefs.keys))}
</Pop>
