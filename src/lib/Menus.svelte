<script lang="ts">
  import Pop from './Pop.svelte';
  import Seg from './Seg.svelte';
  import Icon, { type Lucide } from './Lucide.svelte';
  import { ui, prefs, setKeys } from './ui.svelte';
  import { layout, setWidth, type Width } from './width.svelte';
  import { has, set, zoom, setZoom, SIZES } from './prefs.svelte';
  import { net, setMode, type Mode } from './netstate.svelte';
  import './panel.css';
  import './settings.css';

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
    ['i', 'Notebook sheet'],
    ['/', 'Search'],
    ['?', 'This list'],
    ['esc', 'Close a popover'],
  ];

  const MODES: [Mode, string][] = [
    ['ask', 'Ask'],
    ['never', 'Never'],
    ['always', 'Always'],
  ];
  const HINTS = { ask: 'Asked once for each notebook that links to pictures.', never: 'Never loaded; the browser holds them back.', always: 'Loaded without asking.' };

  const runInfo = $derived(!has('nocnt') || !has('nodot'));
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

{#snippet opt(label: string, icon: Lucide, on: boolean, flip: () => void, hint = '')}
  <button class="sw" role="switch" aria-checked={on} onclick={flip}>
    <Icon name={icon} />
    <span>{label}</span>
    {#if hint}<kbd>{hint}</kbd>{/if}
    <i class="track"><i class="knob"></i></i>
  </button>
{/snippet}

<Pop id="settings" label="Settings" width={344} span lead={false} anchor={() => document.querySelector('[data-pop=settings]')}>
  <div class="set">
    <p class="set-cat">Page</p>
    <div class="set-group">
      <div class="set-row">
        <span>Width</span>
        <div class="set-ctl"><Seg label="Width" options={WIDTHS} value={layout.value} onchange={setWidth} /></div>
      </div>
      <div class="set-row">
        <span>Text size</span>
        <div class="set-ctl step" role="group" aria-label="Text size">
          <button aria-label="Smaller text" disabled={size <= 0} onclick={() => step(-1)}><b class="s">A</b></button>
          <output>{SIZES[size]}%</output>
          <button aria-label="Larger text" disabled={size >= SIZES.length - 1} onclick={() => step(1)}><b class="l">A</b></button>
        </div>
      </div>
    </div>

    <p class="set-cat">Text</p>
    <div class="set-group">
      {@render opt('Serif', 'type', has('serif'), () => set('serif', !has('serif')))}
      {@render opt('Wrap', 'wrap', has('wrap'), () => set('wrap', !has('wrap')))}
      {@render opt('Lines', 'order', has('ln'), () => set('ln', !has('ln')))}
    </div>

    <p class="set-cat">Cells</p>
    <div class="set-group">
      {@render opt('Run info', 'hash', runInfo, () => (set('nocnt', runInfo), set('nodot', runInfo)))}
      {@render opt('Trim', 'scissors', !has('notrim'), () => set('notrim', !has('notrim')))}
      {@render opt('Spotlight', 'focus', has('spot'), () => set('spot', !has('spot')))}
      {#if ui.scrambled}{@render opt('Run order', 'shuffle', ui.replayed, () => (ui.replayed = !ui.replayed))}{/if}
    </div>

    <p class="set-cat">Pictures</p>
    <div class="set-group">
      <div class="set-row">
        <span>Web pictures</span>
        <div class="set-ctl"><Seg label="Web pictures" options={MODES} value={net.mode} onchange={setMode} /></div>
      </div>
    </div>
    <p class="set-note">{HINTS[net.mode]}{net.mode !== 'never' && net.lock === 2 ? ' This page has shut them out; reload to change that.' : ''}</p>

    <div class="pills">
      <button onclick={() => (ui.pop = 'privacy')}><Icon name="shield" />Privacy</button>
      <button onclick={() => (ui.pop = 'keys')}><Icon name="keyboard" />Keys</button>
      <a href={new URL('./', document.baseURI).href}><Icon name="house" />Home</a>
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
