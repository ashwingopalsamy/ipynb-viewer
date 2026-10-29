<script lang="ts">
  import { readNotebook, type Cell, type NotebookMeta } from './notebook';
  import Pop from './Pop.svelte';
  import Icon from './Lucide.svelte';
  import Seg from './Seg.svelte';
  import { ui, jump, showing } from './ui.svelte';
  import { findSecrets, redact } from './insight/secrets';
  import { needs } from './insight/needs';
  import { weigh, clean, type Strip } from './insight/weight';
  import { fileName, save, size } from './export';
  import { mark } from './search';
  import './panel.css';
  import './settings.css';

  // One sheet for what a reader of someone else's notebook wants to know, and what its author wants to check first:
  // anything that looks like a secret, what it takes to run, where its bytes are, and ways to hand it on.
  let { cells, meta, name }: { cells: readonly Cell[]; meta: NotebookMeta | null; name: string } = $props();

  const open = $derived(ui.pop === 'info');
  // what the sheet shows is worked out while it can be seen, fading out included
  const shown = $derived(showing('info'));
  // worked out only while the sheet is up: a large notebook should not be rescanned as it streams in
  const hits = $derived(shown ? findSecrets(cells) : []);
  const need = $derived(shown ? needs(cells, meta) : null);
  const weight = $derived(shown ? weigh(cells) : null);
  const secrets = $derived(hits.filter((h) => h.tier === 'secret').length);
  const label = (n: number | null, id: string) => (n !== null ? `[${n}]` : `#${cells.findIndex((c) => c.id === id) + 1}`);
  const verdict = $derived(
    hits.length
      ? `${secrets ? `${secrets} possible ${secrets === 1 ? 'secret' : 'secrets'}` : ''}${secrets && hits.length > secrets ? ' and ' : ''}${hits.length > secrets ? `${hits.length - secrets} personal ${hits.length - secrets === 1 ? 'detail' : 'details'}` : ''}`
      : 'No keys or passwords found',
  );
  // a kernel named after the language is shown once, as the kernel
  const dup = $derived(!!need?.kernel && !!need?.language && need.kernel.toLowerCase().startsWith(need.language.toLowerCase()));

  function see(cell: string, value?: string) {
    ui.pop = null;
    jump(() => document.querySelector(`[data-cell="${CSS.escape(cell)}"]`));
    if (value) mark(cell, value);
  }

  let note = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const say = (text: string) => {
    note = text;
    clearTimeout(timer);
    timer = setTimeout(() => (note = ''), 4000);
  };

  let done = $state('');
  let doneTimer: ReturnType<typeof setTimeout> | undefined;
  async function copy(text: string, ok: string, key = '') {
    try {
      await navigator.clipboard.writeText(text);
      say(ok);
      done = key;
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => (done = ''), 1600);
    } catch {
      say('The clipboard did not accept it.');
    }
  }

  function saveCopy(strip: Strip) {
    const text = clean(cells, meta, strip);
    save(new Blob([text], { type: 'application/json' }), `${fileName(name, strip === 'outputs' ? 'no-outputs' : 'no-images')}.ipynb`);
    say(`Saved ${size(new TextEncoder().encode(text).length)}.`);
  }

  async function link() {
    const { pack, LINK_MAX } = await import('./insight/share');
    for (const strip of ['images', 'outputs'] as const) {
      let text = clean(cells, meta, strip);
      if (ui.hide && hits.length) text = redact(text, hits);
      const url = `${location.origin}${location.pathname}#${await pack(text, name)}`;
      if (url.length > LINK_MAX) continue;
      return copy(url, `Link copied, ${size(url.length)}. It carries the notebook without ${strip === 'images' ? 'pictures' : 'outputs'}, and no server ever sees it.`, 'link');
    }
    say('Too large for a link, even without outputs. Save a copy and send the file.');
  }

  // The other notebook is read here and compared as the earlier version.
  function other() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ipynb,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      say(`Reading ${file.name}…`);
      try {
        const { compare } = await import('./insight/diff');
        const before = await readNotebook(file.stream());
        ui.cmp = { name: file.name, report: compare(before.cells, cells) };
        note = '';
        ui.pop = 'compare';
      } catch (e) {
        say(e instanceof Error ? e.message : 'That file would not open.');
      }
    };
    input.click();
  }

  const top = $derived(weight?.heavy[0]?.bytes || 1);
  // the file in three parts, always in this order, so a part keeps its place and its colour (panel.css)
  const parts = $derived.by(() => {
    if (!weight) return [];
    const all = weight.total || 1;
    return [
      { name: 'Pictures', bytes: weight.images, hue: 'var(--part-pic)' },
      { name: 'Other outputs', bytes: weight.outputs - weight.images, hue: 'var(--part-out)' },
      { name: 'Code and text', bytes: weight.total - weight.outputs, hue: 'var(--part-src)' },
    ].map((p) => ({ ...p, share: p.bytes / all }));
  });
  const held = $derived(parts.filter((p) => p.bytes > 0));
  const lead = $derived(held.length ? held.reduce((a, p) => (p.bytes > a.bytes ? p : a)) : null);
  const pct = (share: number) => (share > 0 && share < 0.01 ? '<1' : String(Math.round(share * 100)));
  // a heaviest cell takes the colour of what it holds
  const PICTURE = /^(?:PNG|JPEG|SVG|GIF|WEBP|BMP|AVIF)$/;
  const hue = (what: string) => (PICTURE.test(what) ? 'var(--part-pic)' : 'var(--part-out)');

  type Tab = 'share' | 'run' | 'weight';
  const TABS: [Tab, string][] = [
    ['share', 'Share'],
    ['run', 'Run'],
    ['weight', 'Weight'],
  ];
  // opens on Share, which is where a secret would be reported
  let tab = $state<Tab>('share');
</script>

<Pop id="info" label="About this notebook" width={344} lead={false} anchor={() => document.querySelector('[data-pop=info]')}>
  {#if shown}
    <div class="set">
      <div class="set-ctl wide">
        <Seg label="Notebook" options={TABS} value={tab} onchange={(t) => (tab = t)} />
      </div>
      {#key tab}
        <div class="rise">
          {#if tab === 'share'}
            <div class="set-group">
              <div class="set-row set-verdict" class:warn={hits.length}>
                <Icon name={hits.length ? 'alert' : 'shield'} />
                <span>{verdict}</span>
              </div>
              {#each hits.slice(0, 4) as h}
                <button class="set-find" onclick={() => see(h.cell, h.value)}><span>{h.kind} <small>{label(h.n, h.cell)}</small></span><code>{h.shown}</code></button>
              {/each}
              {#if hits.length}
                <button class="sw" role="switch" aria-checked={ui.hide} onclick={() => (ui.hide = !ui.hide)}><span>Hide them in copies</span><i class="track"><i class="knob"></i></i></button>
              {/if}
            </div>
            {#if hits.length > 4}<p class="set-note">and {hits.length - 4} more.</p>{/if}
            <div class="set-group">
              <button class="set-action" class:done={done === 'link'} onclick={link}><span class="ico-swap"><Icon name="link" /><Icon name="check" /></span>Copy link</button>
              <button class="set-action" onclick={other}><Icon name="compare" />Compare</button>
            </div>
            <p class="set-note">The link carries the notebook after the #, so no server sees it. Compare reads an earlier file here.</p>
          {:else if tab === 'run'}
            <div class="set-group">
              {#if need?.language && !dup}<div class="set-kv"><span>Language</span><b>{need.language}{need.version ? ` ${need.version}` : ''}</b></div>{/if}
              {#if need?.kernel}<div class="set-kv"><span>Kernel</span><b>{need.kernel}</b></div>{/if}
              {#if need?.format}<div class="set-kv"><span>Format</span><b>{need.format}</b></div>{/if}
              {#if need?.command}
                <div class="set-code"><code>{need.command}</code><button class:done={done === 'cmd'} aria-label="Copy the install command" title="Copy" onclick={() => copy(need!.command!, 'Copied the install command.', 'cmd')}><span class="ico-swap"><Icon name="copy" /><Icon name="check" /></span></button></div>
              {/if}
            </div>
            {#if need?.command}
              {#if need.installs.length}<p class="set-note">It also installs {need.installs.join(', ')} for itself.</p>{/if}
            {:else}
              <p class="set-note">{need?.installs.length ? `It installs ${need.installs.join(', ')} for itself.` : need?.language && need.language !== 'python' && need.language.toLowerCase() !== 'r' ? 'Packages are listed for Python and R notebooks.' : 'No packages beyond the standard library.'}</p>
            {/if}
          {:else if weight}
            <div class="stat">
              <b>{size(weight.total)}</b>
              <span>In all</span>
              {#if lead}<small>{pct(lead.share)}% {lead.name.toLowerCase()}</small>{/if}
            </div>
            {#if held.length}
              <div class="weigh" role="img" aria-label="Share of the file: {parts.map((p) => `${p.name.toLowerCase()} ${pct(p.share)} percent`).join(', ')}">
                {#each held as p}<i style:flex-grow={p.bytes} style:--part={p.hue} title="{p.name} · {size(p.bytes)} · {pct(p.share)}%"></i>{/each}
              </div>
              <div class="set-group">
                {#each held as p}
                  <div class="set-kv"><i class="hue" style:--part={p.hue}></i><span>{p.name}</span><b>{size(p.bytes)} · {pct(p.share)}%</b></div>
                {/each}
              </div>
            {/if}
            {#if weight.heavy.length}
              <p class="set-cat">Heaviest cells</p>
              <div class="set-group">
                {#each weight.heavy.slice(0, 3) as h}
                  <button class="set-find" onclick={() => see(h.cell)}><span>{h.what} <small>{label(h.n, h.cell)}</small></span><i class="meter" style:--part={hue(h.what)}><i style:width="{Math.max(3, (h.bytes / top) * 100)}%"></i></i><em>{size(h.bytes)}</em></button>
                {/each}
              </div>
            {/if}
            <div class="set-group">
              <button class="set-action" onclick={() => saveCopy('images')} disabled={!weight.images}><Icon name="download" />Save without pictures</button>
              <button class="set-action" onclick={() => saveCopy('outputs')} disabled={!weight.outputs}><Icon name="download" />Save without outputs</button>
            </div>
          {/if}
        </div>
      {/key}
      <p class="set-note" role="status">{note}</p>
    </div>
  {/if}
</Pop>
