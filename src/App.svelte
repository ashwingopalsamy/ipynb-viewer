<script lang="ts">
  import { readNotebook, type Cell, type NotebookMeta } from './lib/notebook';
  import { theme, toggleTheme } from './lib/theme.svelte';
  import CellView from './lib/Cell.svelte';
  import Icon from './lib/Icon.svelte';
  import Opener from './lib/Opener.svelte';
  import OpenPanel from './lib/OpenPanel.svelte';
  import Lucide from './lib/Lucide.svelte';
  import { blank } from './lib/blank';
  import { ui, type Pop } from './lib/ui.svelte';

  // The home page hands over the notebook it was given: chosen, dropped, or none when a link is opened instead.
  let { file, handle }: { file?: File; handle?: FileSystemFileHandle } = $props();

  let cells = $state.raw<Cell[]>([]);
  let meta = $state.raw<NotebookMeta | null>(null);
  let warnings = $state.raw<string[]>([]);
  let name = $state('');
  let status = $state<'empty' | 'fetching' | 'ready' | 'error'>(file ? 'fetching' : 'empty');
  let detail = $state('');
  let dragging = $state(false);
  let picker: HTMLInputElement;
  let reorder = $state<typeof import('./lib/replay').reorder>();
  let replayed = $state(false);
  let ready = $state(false);
  let Extras = $state<typeof import('./lib/Extras.svelte').default>();
  let Actions = $state<typeof import('./lib/Extras.svelte').Actions>();
  let Veil = $state<typeof import('./lib/Veil.svelte').default>();
  let changed = $state.raw<ReadonlySet<string>>(new Set());
  let stop: (() => void) | undefined;

  const rows = $derived(replayed && reorder ? reorder(cells) : cells);
  const language = $derived(meta ? (meta.language ?? 'python') : null);

  // The name the dock gives the card that is open. A card with no name (the save-picture menu hangs from its picture) leaves the dock as it was.
  const TOOL: Partial<Record<Pop, string>> = { settings: 'Settings', toc: 'Contents', search: 'Search', info: 'Notebook', md: 'Markdown', privacy: 'Privacy', keys: 'Shortcuts', compare: 'Compare' };
  const tool = $derived(ui.shelf ? 'Figures' : ui.pop ? (TOOL[ui.pop] ?? '') : '');

  let sections = $state(0);
  let chapter = $state('');

  let run = 0;
  let depth = 0;

  async function open(file: Pick<File, 'name' | 'stream'>, handle?: FileSystemFileHandle) {
    const mine = ++run;
    // The notebook the reader is in stays until the new file proves to be one: its first piece is what replaces it.
    let fresh = true;
    const begin = () => {
      fresh = false;
      stop?.();
      stop = undefined;
      ready = false;
      name = file.name;
      cells = [];
      meta = null;
      warnings = [];
      detail = '';
      status = 'ready';
      import('./lib/Extras.svelte').then((m) => ((Extras = m.default), (Actions = m.Actions)));
    };

    // Cells arrive faster than frames; hand them to the view once per frame.
    let batch: Cell[] = [];
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      if (mine !== run || !batch.length) return;
      cells = cells.concat(batch);
      batch = [];
    };

    try {
      const notebook = await readNotebook(file.stream(), (event) => {
        if (mine !== run) throw new Error('superseded');
        if (fresh) begin();
        if (event.type === 'cell') {
          batch.push(event.cell);
          if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(flush);
          }
        } else if (event.type === 'warning') {
          warnings = [...warnings, event.message];
        } else {
          meta = event.meta;
        }
      });
      if (mine !== run) return;
      if (notebook.cells.every(blank)) throw new Error('This notebook is empty.');
      if (fresh) begin();
      flush();
      ready = true;
      document.title = `${file.name} · ipynb viewer`;
      if (handle && file instanceof File) {
        const { watch } = await import('./lib/watch');
        if (mine === run) {
          stop = watch(handle, file, () => cells, (u) => {
            cells = u.cells;
            meta = u.notebook;
            warnings = u.notebook.warnings;
            changed = u.changed;
            setTimeout(() => mine === run && (changed = new Set()), 2600);
          });
        }
      }
    } catch (e) {
      if (mine !== run) return;
      const why = e instanceof Error ? e.message : String(e);
      // a file that fails before anything of it was drawn leaves the reader where they were
      // an error after cells were drawn (a download that stopped) keeps what arrived and says so, rather than throwing it away
      if (!fresh) flush();
      if (!fresh && cells.length) {
        ready = true;
        warnings = [...warnings, `The rest of ${file.name} did not arrive. ${why}`];
        import('./lib/notice').then((m) => m.say(`${file.name} stopped partway. ${why}`));
      } else if (fresh && cells.length) import('./lib/notice').then((m) => m.say(`${file.name} would not open. ${why}`));
      else (status = 'error'), (detail = why);
    }
  }

  // A link in the address bar: fetched before anything else is drawn, then opened like a file from disk.
  if (/[?#](?:url|nb)=/.test(location.href)) {
    status = 'fetching';
    import('./lib/link').then((m) => m.start(location.href, (text) => (detail = text), (file) => (run ? void file.stream().cancel().catch(() => {}) : open(file)), (why) => run || ((status = 'error'), (detail = why))));
  }

  if (file) open(file, handle);

  // A link pasted on the empty screen reloads the page with it, the same way a shared link would arrive.
  const paste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (status !== 'ready' && text.includes('http')) import('./lib/link').then((m) => m.pasted(text));
  };

  function pick() {
    const file = picker.files?.[0];
    picker.value = '';
    if (file) open(file);
  }

  // Where the browser allows it, keep a handle so the file can be watched.
  async function choose() {
    if (!window.showOpenFilePicker) return picker.click();
    const got = await (await import('./lib/watch')).pick();
    if (got) open(got.file, got.handle);
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;

  function enter(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    dragging = true;
    if (!Veil) import('./lib/Veil.svelte').then((m) => (Veil = m.default));
  }

  function leave() {
    depth = Math.max(0, depth - 1);
    if (!depth) dragging = false;
  }

  async function drop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    dragging = false;
    const got = await (await import('./lib/watch')).dropped(e.dataTransfer!);
    if (got) open(got.file, got.handle);
  }
</script>

<svelte:window onkeydown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'o' && (e.preventDefault(), choose())} ondragenter={enter} ondragover={(e) => hasFiles(e) && e.preventDefault()} ondragleave={leave} ondrop={drop} onpaste={paste} />

<input bind:this={picker} type="file" accept=".ipynb,.json,application/json" hidden onchange={pick} />

<header class="bar">
  <div class="inner">
    <span class="name pill" class:idle={!name} class:two={sections > 1}>
      <span class="file"><img src="mark.svg" alt="" width="15" height="18" style="flex:none" /><span class="fname">{name || 'ipynb viewer'}</span></span>
      {#if sections > 1}<span class="chapter"><Lucide name="heading" />{#key chapter}<span>{chapter || '\u00a0'}</span>{/key}</span>{/if}
    </span>
    <Opener />
    <div class="tools pill">
      <span class="tool-name">{tool}</span>
      {#if Actions}<Actions />{/if}
      <button class="icon swap" onclick={toggleTheme} aria-label={theme.value === 'dark' ? 'Switch to light' : 'Switch to dark'} data-tip={theme.value === 'dark' ? 'Switch to light' : 'Switch to dark'}>
        <span class="glyph" class:on={theme.value === 'light'}><Lucide name="moon" /></span>
        <span class="glyph" class:on={theme.value === 'dark'}><Lucide name="sun" /></span>
      </button>
    </div>
  </div>
</header>

<OpenPanel onchoose={choose} />

{#if Extras}<Extras cells={rows} raw={cells} {meta} {name} {language} {ready} bind:sections bind:chapter bind:replayed bind:reorder />{/if}

<main>
  {#if status !== 'ready'}
    <button class="drop" onclick={choose}>
      {#if status === 'empty'}
        <strong>Jupyter notebooks, without Jupyter.</strong>
        <span>Drop a .ipynb here, or click to choose one.</span>
      {:else}
        <strong>{status === 'error' ? 'That one would not open' : 'Fetching the notebook'}</strong>
        <span>{detail || '\u00a0'}</span>
      {/if}
    </button>
  {:else}
    <div class="notebook">
      {#if warnings.length}
        <details class="notice">
          <summary><Icon name="info" />{warnings.length === 1 ? 'Opened with a warning' : `Opened with ${warnings.length} warnings`}</summary>
          <ul>{#each warnings as w}<li>{w}</li>{/each}</ul>
        </details>
      {/if}
      {#each rows as cell, i (cell.id)}
        <CellView {cell} fresh={changed.has(cell.id)} index={i} {language} />
      {/each}
    </div>
  {/if}
</main>

<a class="made" href="https://ashwingopalsamy.in" target="_blank" rel="noopener" referrerpolicy="no-referrer">
  <img src="ashwin.webp" width="22" height="22" alt="" decoding="async" />
  <span>With love by <b>Ashwin Gopalsamy</b></span>
</a>

{#if Veil}<Veil on={dragging} />{/if}
