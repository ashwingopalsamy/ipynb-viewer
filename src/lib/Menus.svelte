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
  const WIDTH_ICON: Record<Width, Lucide> = { narrow: 'column-narrow', normal: 'column-centre', wide: 'column-wide' };
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
    ['e', 'Edit this cell'],
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
  let dir = $state('');
  const step = (by: number) => {
    dir = by < 0 ? 'down' : '';
    setZoom(SIZES[Math.min(SIZES.length - 1, Math.max(0, size + by))]);
  };
  const fromSettings = () => document.querySelector('[data-pop=settings]') ?? bar();
</script>

{#snippet opt(label: string, icon: Lucide, on: boolean, flip: () => void, sub: string)}
  <button class="sw" role="switch" aria-checked={on} onclick={flip}>
    <Icon name={icon} />
    <span>{label}<small>{sub}</small></span>
    <i class="track"><i class="knob"></i></i>
  </button>
{/snippet}

<Pop id="settings" label="Settings" width={344} lead={false} anchor={() => document.querySelector('[data-pop=settings]')}>
  <div class="set">
    {#snippet widthIcon(v: Width)}<Icon name={WIDTH_ICON[v]} />{/snippet}
    <p class="set-cat">Page</p>
    <div class="set-group">
      <div class="set-row">
        <span>Width</span>
        <div class="set-ctl"><Seg label="Width" options={WIDTHS} value={layout.value} onchange={setWidth} item={widthIcon} /></div>
      </div>
      <div class="set-row">
        <span>Text size</span>
        <div class="set-ctl step" role="group" aria-label="Text size">
          <button aria-label="Smaller text" disabled={size <= 0} onclick={() => step(-1)}><b class="s">A</b></button>
          <output>{#key size}<span class="roll {dir}">{SIZES[size]}%</span>{/key}</output>
          <button aria-label="Larger text" disabled={size >= SIZES.length - 1} onclick={() => step(1)}><b class="l">A</b></button>
        </div>
      </div>
    </div>

    <p class="set-cat">Text</p>
    <div class="set-group">
      {@render opt('Serif', 'type', has('serif'), () => set('serif', !has('serif')), 'Text cells in a book face')}
      {@render opt('Wrap', 'wrap', has('wrap'), () => set('wrap', !has('wrap')), 'Long code lines wrap')}
      {@render opt('Line numbers', 'order', has('ln'), () => set('ln', !has('ln')), 'Beside every line of code')}
    </div>

    <p class="set-cat">Cells</p>
    <div class="set-group">
      {@render opt('Run info', 'hash', runInfo, () => (set('nocnt', runInfo), set('nodot', runInfo)), 'Run counts beside each cell')}
      {@render opt('Trim', 'scissors', !has('notrim'), () => set('notrim', !has('notrim')), 'Shorten long outputs')}
      {@render opt('Spotlight', 'focus', has('spot'), () => set('spot', !has('spot')), 'Dim all but the cell you read')}
      {#if ui.scrambled}{@render opt('Run order', 'shuffle', ui.replayed, () => (ui.replayed = !ui.replayed), 'Cells in the order they ran')}{/if}
    </div>

    <p class="set-cat">Pictures</p>
    <div class="set-group">
      <div class="set-row">
        <span>Web pictures</span>
        <div class="set-ctl"><Seg label="Web pictures" options={MODES} value={net.mode} onchange={setMode} /></div>
      </div>
    </div>
    <p class="set-note">{HINTS[net.mode]}{net.mode !== 'never' && net.lock === 2 ? ' This page has shut them out; reload to change that.' : ''}</p>

    <div class="set-foot">
      <button class="btn quiet" onclick={() => (ui.pop = 'privacy')}><Icon name="shield" />Privacy</button>
      <button class="btn quiet" onclick={() => (ui.pop = 'keys')}><Icon name="keyboard" />Shortcuts</button>
      <a class="btn quiet" href={new URL('./', document.baseURI).href}><Icon name="house" />Home</a>
    </div>
  </div>
</Pop>

<Pop id="keys" label="Keyboard shortcuts" width={344} lead={false} anchor={fromSettings}>
  <div class="set">
    <dl class="keys">
      {#each keys as [k, what]}
        <dt>{#each k.split(' ') as one}<kbd>{one}</kbd>{/each}</dt>
        <dd>{what}</dd>
      {/each}
    </dl>
    <div class="set-group">
      {@render opt('Single-key shortcuts', 'keyboard', prefs.keys, () => setKeys(!prefs.keys), 'They stand down while you type')}
    </div>
  </div>
</Pop>
