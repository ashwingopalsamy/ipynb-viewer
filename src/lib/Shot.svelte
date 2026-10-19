<script lang="ts">
  import Seg from './Seg.svelte';
  import { roving } from './roving';
  import { ui } from './ui.svelte';
  import { has } from './prefs.svelte';
  import { canCopy, canWebp, copyPng, encode, EXT, fileName, fits, LABEL, save, size, type Format } from './export';
  import { BACKDROPS, palette, prepare, scene, type Backdrop, type Layout, type Opts, type Pad, type Prepared, type Scene, type Shape, type Show } from './shot';
  import './export.css';
  import './shot.css';
  import './ansi.css';

  // The dialog behind the camera button: pick what goes in, how it looks and how big it is, then save or copy.
  const webp = canWebp();
  const FORMATS: [Format, string][] = (['png', 'jpeg', ...(webp ? ['webp'] : [])] as Format[]).map((f) => [f, LABEL[f]]);
  const SCALES = [1, 2, 3] as const;

  interface Kept {
    layout: Layout;
    backdrop: Backdrop;
    pad: Pad;
    shape: Shape;
    scale: number;
    format: Format;
    title: boolean;
    theme?: 'page' | 'light' | 'dark';
    lines?: boolean;
  }
  const FALLBACK: Kept = { layout: 'stack', backdrop: 'mist', pad: 'M', shape: 'fit', scale: 2, format: 'png', title: true };
  const kept = (): Kept => {
    try {
      return { ...FALLBACK, ...JSON.parse(localStorage.getItem('shot') ?? '{}') };
    } catch {
      return FALLBACK;
    }
  };

  let k = $state<Kept>(kept());
  let show = $state<Show>('both');
  const remember = () => {
    try {
      localStorage.setItem('shot', JSON.stringify(k));
    } catch {
      // the choices then last for this visit only
    }
  };
  const set = <K extends keyof Kept>(key: K, value: Kept[K]) => {
    k[key] = value;
    remember();
  };

  // The dialog stays mounted so it can fade out; `cell` keeps what it was showing until it has gone.
  let cell = $state(ui.shot);
  const open = $derived(!!ui.shot);
  let sheet = $state<HTMLElement>();
  let prepared = $state.raw<Prepared>();
  let back: HTMLElement | null = null;

  $effect(() => {
    if (!ui.shot) {
      const gone = setTimeout(() => ((cell = null), (prepared = undefined)), 260);
      return () => clearTimeout(gone);
    }
    cell = ui.shot;
    show = 'both';
    prepared = undefined;
    back = document.activeElement as HTMLElement | null;
    const c = ui.shot;
    let live = true;
    prepare({ file: ui.file, n: c.executionCount, language: ui.lang, code: c.source, outputs: c.outputs }).then((p) => live && (prepared = p));
    queueMicrotask(() => sheet?.focus({ preventScroll: true }));
    // the page behind cannot be reached while the dialog is up
    const behind = [...document.querySelectorAll<HTMLElement>('main, .bar, .rail, .made')];
    behind.forEach((el) => (el.inert = true));
    return () => {
      live = false;
      behind.forEach((el) => (el.inert = false));
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  });

  const hasCode = $derived(!!prepared?.code.length);
  const hasOut = $derived(!!prepared?.blocks.length);
  const both = $derived(hasCode && hasOut);
  const shown = $derived<Show>(show === 'both' && !both ? (hasCode ? 'code' : 'out') : show === 'code' && !hasCode ? 'out' : show === 'out' && !hasOut ? 'code' : show);
  const page = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const theme = $derived(!k.theme || k.theme === 'page' ? page() : k.theme);
  const opts = $derived<Opts>({ show: shown, layout: both && shown === 'both' ? k.layout : 'stack', theme, backdrop: k.backdrop, pad: k.pad, shape: k.shape, lines: k.lines ?? has('ln'), title: k.title });
  const sc = $derived.by<Scene | undefined>(() => (prepared ? scene(prepared, opts) : undefined));

  const scale = $derived(SCALES.findLast((n) => n <= k.scale && (!sc || fits(sc.w, sc.h, n))) ?? 1);

  // the preview: the same drawing as the file, at a size the screen can show
  let sw = $state(0);
  let sh = $state(0);
  // (an observer rather than bind:clientWidth: that binding would pull its runtime into the core bundle)
  function watch(node: HTMLElement) {
    const look = new ResizeObserver(() => ((sw = node.clientWidth), (sh = node.clientHeight)));
    look.observe(node);
    return { destroy: () => look.disconnect() };
  }
  let canvas = $state<HTMLCanvasElement>();
  const fit = $derived(sc ? Math.min(1, (sw - 48) / sc.w, Math.max((sh - 48) / sc.h, 0.45)) : 1);
  $effect(() => {
    if (!sc || !canvas) return;
    const s = Math.min(scale, 2);
    const live = sc;
    const frame = requestAnimationFrame(() => {
      canvas!.width = Math.round(live.w * s);
      canvas!.height = Math.round(live.h * s);
      live.draw(canvas!.getContext('2d')!, s);
    });
    return () => cancelAnimationFrame(frame);
  });

  async function make(format: Format): Promise<Blob> {
    const live = sc!;
    const s = scale;
    const c = document.createElement('canvas');
    c.width = Math.round(live.w * s);
    c.height = Math.round(live.h * s);
    const ctx = c.getContext('2d')!;
    if (format === 'jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    live.draw(ctx, s);
    return encode(c, format);
  }

  // The size of the file is worked out once the choices settle.
  let weight = $state<number | null>(null);
  let cache: { key: string; blob: Promise<Blob> } | undefined;
  const key = (f: Format) => `${f}|${scale}|${JSON.stringify(opts)}|${prepared?.n}`;
  const blob = (f: Format) => {
    const id = key(f);
    if (cache?.key !== id) cache = { key: id, blob: make(f) };
    return cache.blob;
  };
  $effect(() => {
    weight = null;
    if (!sc) return;
    const f = k.format;
    let live = true;
    const timer = setTimeout(() => blob(f).then((b) => live && (weight = b.size), () => {}), 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  });

  const notes = $derived(
    [
      sc?.skipped ? 'Interactive output cannot be included.' : '',
      sc && (sc.cut.code || sc.cut.out) ? 'Long code and output are shortened.' : '',
      k.format === 'jpeg' && k.backdrop === 'none' ? 'A JPEG has no transparency, so the corners turn white.' : '',
    ].filter(Boolean),
  );

  let failed = $state('');
  async function download() {
    failed = '';
    try {
      save(await blob(k.format), `${fileName(ui.file, `cell${prepared?.n == null ? '' : `-${prepared.n}`}`)}.${EXT[k.format]}`);
    } catch (e) {
      failed = e instanceof Error ? e.message : 'That did not work.';
    }
  }
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy() {
    failed = '';
    try {
      await copyPng(blob('png'));
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1600);
    } catch (e) {
      failed = e instanceof Error ? e.message : 'That did not work.';
    }
  }

  const close = () => (ui.shot = null);
  function keys(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
  }
  const at = $derived(BACKDROPS.findIndex((b) => b.id === k.backdrop));
</script>

{#snippet switcher(label: string, on: boolean, flip: () => void)}
  <button class="sw" role="switch" aria-checked={on} onclick={flip}>
    <span>{label}</span>
    <i class="track"><i class="knob"></i></i>
  </button>
{/snippet}

<svelte:window onkeydown={(e) => open && keys(e)} />

<div class="shot" class:on={open} role="dialog" aria-modal="true" aria-label="Save cell as image" aria-hidden={!open} onpointerdown={(e) => e.target === e.currentTarget && close()}>
  <div class="dlg" tabindex="-1" bind:this={sheet}>
    <div class="stage" use:watch>
      {#if sc}
        <canvas bind:this={canvas} style:width="{Math.round(sc.w * fit)}px" style:height="{Math.round(sc.h * fit)}px" aria-label="Preview of the picture"></canvas>
      {:else if cell}
        <p class="wait">Preparing…</p>
      {/if}
    </div>
    <div class="ctl">
      <header>
        <h2>Save cell as image</h2>
        <button class="x" aria-label="Close" title="Close · esc" onclick={close}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
        </button>
      </header>
      <div class="scroll">
        <h3 class="cat">Content</h3>
        <div class="opt"><span>Show</span><Seg label="Show" options={[['both', 'Both'], ['code', 'Code'], ['out', 'Output']] as const} value={shown} disabled={[...(both ? [] : ['both']), ...(hasCode ? [] : ['code']), ...(hasOut ? [] : ['out'])] as Show[]} onchange={(v) => (show = v)} /></div>
        <div class="opt"><span>Layout</span><Seg label="Layout" options={[['stack', 'Stacked'], ['side', 'Side by side']] as const} value={opts.layout} disabled={both && shown === 'both' ? [] : ['side']} onchange={(v) => set('layout', v)} /></div>
        {@render switcher('Line numbers', opts.lines, () => set('lines', !opts.lines))}
        {@render switcher('File name and run count', k.title, () => set('title', !k.title))}

        <h3 class="cat">Style</h3>
        <div class="opt"><span>Theme</span><Seg label="Theme" options={[['page', 'Page'], ['light', 'Light'], ['dark', 'Dark']] as const} value={k.theme ?? 'page'} onchange={(v) => set('theme', v)} /></div>
        <div class="opt">
          <span>Backdrop</span>
          <div class="swatches" role="radiogroup" aria-label="Backdrop">
            {#each BACKDROPS as b, i}
              <button
                class="swatch"
                class:none={!b.a}
                role="radio"
                aria-checked={k.backdrop === b.id}
                aria-label={b.label}
                title={b.label}
                tabindex={k.backdrop === b.id ? 0 : -1}
                style:--a={b.a}
                style:--b={b.b}
                onclick={() => set('backdrop', b.id)}
                onkeydown={(e) => roving(e, at, BACKDROPS.length, () => false, (n) => set('backdrop', BACKDROPS[n].id))}
              ></button>
            {/each}
          </div>
        </div>
        <div class="opt"><span>Margin</span><Seg label="Margin" options={[['S', 'Snug'], ['M', 'Even'], ['L', 'Roomy']] as const} value={k.pad} disabled={k.backdrop === 'none' ? ['S', 'M', 'L'] : []} onchange={(v) => set('pad', v)} /></div>

        <h3 class="cat">File</h3>
        <div class="opt"><span>Shape</span><Seg label="Shape" options={[['fit', 'Fit'], ['wide', '16:9'], ['square', '1:1']] as const} value={k.shape} onchange={(v) => set('shape', v)} /></div>
        <div class="opt"><span>Size</span><Seg label="Size" options={SCALES.map((n) => [n, `${n}×`] as const)} value={scale} disabled={SCALES.filter((n) => sc && !fits(sc.w, sc.h, n))} onchange={(v) => set('scale', v)} /></div>
        <div class="opt"><span>Format</span><Seg label="Format" options={FORMATS} value={k.format} onchange={(v) => set('format', v)} /></div>
      </div>
      <footer>
        <p class="meta"><span>{#if sc}{Math.round(sc.w * scale).toLocaleString()} × {Math.round(sc.h * scale).toLocaleString()} px{/if}</span><span>{#if weight !== null}{size(weight)}{/if}</span></p>
        <p class="note" class:bad={!!failed} role="status">{failed || notes.join(' ')}</p>
        <div class="btns">
          {#if canCopy()}<button class="btn" disabled={!sc} onclick={copy}>{copied ? 'Copied' : k.format === 'png' ? 'Copy' : 'Copy PNG'}</button>{/if}
          <button class="btn solid" disabled={!sc} onclick={download}>Save {LABEL[k.format]}</button>
        </div>
      </footer>
    </div>
  </div>
</div>
