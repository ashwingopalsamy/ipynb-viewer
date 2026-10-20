<script lang="ts">
  import Pop from './Pop.svelte';
  import Seg from './Seg.svelte';
  import Icon from './Lucide.svelte';
  import { ui } from './ui.svelte';
  import { canWebp, canCopy, convert, copyPng, EXT, fileName, fits, LABEL, load, mimeOf, save, size, type Format } from './export';
  import './export.css';
  import './settings.css';

  // The menu that hangs from a picture's save button: format, size, and where it goes.
  const SCALES = [1, 2, 3] as const;
  const webp = canWebp();
  const FORMATS: [Format, string][] = (['png', 'jpeg', ...(webp ? ['webp'] : [])] as Format[]).map((f) => [f, LABEL[f]]);

  const stored = (() => {
    try {
      const [f, s] = (localStorage.getItem('fig') ?? '').split('|');
      return { format: (FORMATS.some(([k]) => k === f) ? f : 'png') as Format, scale: SCALES.find((n) => n === Number(s)) ?? 1 };
    } catch {
      return { format: 'png' as Format, scale: 1 };
    }
  })();
  let format = $state<Format>(stored.format);
  let want = $state<number>(stored.scale);
  const remember = () => {
    try {
      localStorage.setItem('fig', `${format}|${want}`);
    } catch {
      // the choice then lasts for this visit only
    }
  };

  const fig = $derived(ui.fig);
  let img = $state<HTMLImageElement>();
  $effect(() => {
    const src = fig?.src;
    img = undefined;
    if (!src) return;
    let live = true;
    load(src).then((i) => live && (img = i), () => {});
    return () => {
      live = false;
    };
  });

  // A size the canvas cannot hold gives way to the largest one that fits.
  const room = (n: number) => !img || fits(img.naturalWidth, img.naturalHeight, n);
  const scale = $derived(SCALES.findLast((n) => n <= want && room(n)) ?? 1);
  const w = $derived(img ? Math.round(img.naturalWidth * scale) : 0);
  const h = $derived(img ? Math.round(img.naturalHeight * scale) : 0);
  const same = $derived(!!fig && scale === 1 && mimeOf(fig.src) === `image/${format}`);

  // Encoding is the slow part, so the size of the file is worked out once the choices settle.
  let weight = $state<number | null>(null);
  let cache: { key: string; blob: Promise<Blob> } | undefined;
  const make = (f: Format) => {
    const key = `${fig!.src.length}|${f}|${scale}`;
    if (cache?.key !== key) cache = { key, blob: convert(fig!.src, img!, f, scale) };
    return cache.blob;
  };
  $effect(() => {
    weight = null;
    if (!fig || !img) return;
    const f = format;
    let live = true;
    const timer = setTimeout(() => make(f).then((b) => live && (weight = b.size), () => {}), same ? 0 : 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  });

  const name = $derived(fig ? `${fileName(ui.file, fig.tag)}.${EXT[format]}` : '');
  const note = $derived(format === 'jpeg' && fig?.alpha ? 'Transparent areas turn white in a JPEG.' : scale > 1 ? 'Larger sizes enlarge the original pixels; they add no detail.' : '');

  let failed = $state('');
  async function download() {
    failed = '';
    try {
      save(await make(format), name);
      ui.pop = null;
    } catch (e) {
      failed = e instanceof Error ? e.message : 'That did not work.';
    }
  }

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy() {
    failed = '';
    try {
      await copyPng(make('png'));
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1600);
    } catch (e) {
      failed = e instanceof Error ? e.message : 'That did not work.';
    }
  }
</script>

<Pop id="figure" label="Save figure" width={288} near lead={false} anchor={() => fig?.el ?? null}>
  <div class="set">
    <div class="set-group">
      <div class="set-row"><span>Format</span><div class="set-ctl"><Seg label="Format" options={FORMATS} value={format} onchange={(v) => ((format = v), remember())} /></div></div>
      <div class="set-row"><span>Size</span><div class="set-ctl"><Seg label="Size" options={SCALES.map((n) => [n, `${n}×`] as const)} value={scale} disabled={SCALES.filter((n) => !room(n))} onchange={(v) => ((want = v), remember())} /></div></div>
    </div>
    <dl class="stats">
      <div><dt>Pixels</dt><dd>{img ? `${w.toLocaleString()} × ${h.toLocaleString()}` : '–'}</dd></div>
      <div><dt>File</dt><dd>{#key weight}<span class="roll">{weight !== null ? size(weight) : '–'}</span>{/key}</dd></div>
    </dl>
    <p class="set-note" class:bad={!!failed} role="status">{failed || note}</p>
    <div class="set-foot">
      {#if canCopy()}<button class="btn" class:done={copied} onclick={copy}><span class="ico-swap"><Icon name="copy" /><Icon name="check" /></span>{copied ? 'Copied' : format === 'png' ? 'Copy' : 'Copy PNG'}</button>{/if}
      <button class="btn solid" disabled={!img} onclick={download}><Icon name="download" />Save {LABEL[format]}</button>
    </div>
  </div>
</Pop>
