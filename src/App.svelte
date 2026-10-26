<script lang="ts">
  import { readNotebook, type Cell, type NotebookEvent, type NotebookMeta } from './lib/notebook';
  import { theme, toggleTheme } from './lib/theme.svelte';
  import CellView from './lib/Cell.svelte';
  import Icon from './lib/Icon.svelte';
  import Opener from './lib/Opener.svelte';
  import OpenPanel from './lib/OpenPanel.svelte';
  import Lucide from './lib/Lucide.svelte';
  import { blank } from './lib/blank';
  import { ui, type Pop } from './lib/ui.svelte';
  import { session, host, undo, reset, type Host } from './lib/edit/session.svelte';
  import type { Loaded } from './lib/edit/save';
  import type { Watching } from './lib/watch';

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
  let saved: Watching['saved'] | undefined;
  let tools: AbortController | undefined;
  // What the notebook on screen was read from, when it can be edited and saved back.
  let loaded: Loaded | null = null;

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
      stop = saved = undefined;
      tools?.abort();
      tools = undefined;
      loaded = null;
      session.on = false;
      session.why = '';
      session.told = false;
      session.active = null;
      session.flush = null;
      reset();
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
      const on = (event: NotebookEvent) => {
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
      };
      // a Markdown file is a notebook of one text cell
      const markdown = file instanceof File && /\.(?:md|markdown)$/i.test(file.name);
      // A notebook fetched from a link arrives as a stream that can be read once; its text is kept so edits can be patched into it and saved as a new file.
      let kept: Promise<string | null> | undefined;
      let notebook;
      if (markdown) notebook = await (await import('./lib/edit/mdfile')).readMarkdown(file as File, on);
      else {
        let body = file.stream();
        if (!(file instanceof File)) {
          const [a, b] = body.tee();
          body = a;
          kept = new Response(b).text().catch(() => null);
        }
        notebook = await readNotebook(body, on);
      }
      const text = kept ? await kept : null;
      if (mine !== run) return;
      if (notebook.cells.every(blank)) throw new Error('This notebook is empty.');
      if (fresh) begin();
      flush();
      ready = true;
      const why =
        notebook.nbformat < 4
          ? 'This notebook uses format v3, so editing is off.'
          : notebook.warnings.some((w) => w.startsWith('The file ends early'))
            ? 'This notebook is incomplete, so editing is off.'
            : file instanceof File || text !== null
              ? ''
              : 'Editing is off for this file.';
      session.why = why;
      if (!why) {
        const own = file instanceof File ? file : new File([text!], file.name, { type: 'application/json' });
        loaded = { name: own.name, file: own, handle, stamp: `${own.lastModified}:${own.size}`, text: null, bom: false, kind: markdown ? 'md' : 'ipynb', crlf: false, original: notebook.cells.map((c) => c.source) };
      }
      session.on = !!loaded;
      // without a file to write to, saving makes a copy
      session.detached = !handle;
      if (loaded) hint();
      // where the browser lets a page offer tools to an agent working with the person (WebMCP), the open notebook is offered read-only
      const mc = (document as any).modelContext ?? (navigator as any).modelContext;
      if (mc) {
        const ctl = (tools = new AbortController());
        import('./lib/agent').then((m) => m.reader(mc, ctl.signal, () => ({ cells, meta, name, language })));
      }
      document.title = `${file.name} · ipynb viewer`;
      if (handle && file instanceof File) await follow(mine, handle, file);
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

  // Said once, ever, the first time a notebook opens that can be edited.
  function hint() {
    try {
      if (localStorage.getItem('edit-hint')) return;
      localStorage.setItem('edit-hint', '1');
    } catch {
      return;
    }
    setTimeout(() => import('./lib/notice').then((m) => m.say('Double-click any text to edit it.')), 1200);
  }

  // Reads the file again whenever it changes on disk, unless edits here would be lost by it.
  async function follow(mine: number, handle: FileSystemFileHandle, file: File) {
    const { watch } = await import('./lib/watch');
    if (mine !== run) return;
    const w = watch(
      handle,
      file,
      () => cells,
      (u) => {
        cells = u.cells;
        meta = u.notebook;
        warnings = u.notebook.warnings;
        changed = u.changed;
        // what the next save patches into is the file as it is now
        if (loaded) Object.assign(loaded, { file: u.file, stamp: `${u.file.lastModified}:${u.file.size}`, text: null, original: u.cells.map((c) => c.source) });
        setTimeout(() => mine === run && (changed = new Set()), 2600);
      },
      () => session.dirty || session.active !== null,
      () => {
        session.conflict = true;
        import('./lib/notice').then((m) => m.say(`${name} changed on disk. Saving will keep both: your edits go to a new file.`));
      },
    );
    stop = w.stop;
    saved = w.saved;
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

  // Leaving a notebook with unsaved edits asks first.
  const keep = () => session.dirty && !confirm(`Discard unsaved edits to ${name}?`);

  function pick() {
    const file = picker.files?.[0];
    picker.value = '';
    if (file && !keep()) open(file);
  }

  // Where the browser allows it, keep a handle so the file can be watched.
  async function choose() {
    if (keep()) return;
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
    if (keep()) return;
    const got = await (await import('./lib/watch')).dropped(e.dataTransfer!);
    if (got) open(got.file, got.handle);
  }

  // Editing: the notebook's own file is saved back, and a committed edit can be taken back from anywhere but a field.
  const editing: Host = {
    apply(id, source) {
      cells = cells.map((c) => (c.id === id ? ({ ...c, source } as Cell) : c));
    },
    source: (id) => cells.find((c) => c.id === id)?.source,
    async ensureBase() {
      if (!loaded) return false;
      const ok = await (await import('./lib/edit/save')).readBase(loaded);
      if (!ok) import('./lib/notice').then((m) => m.say('This notebook changed on disk. Reopen it to edit.'));
      return ok;
    },
    async save(asNew = false) {
      if (!loaded || session.saving) return;
      session.flush?.();
      if (!session.dirty) return import('./lib/notice').then((m) => m.say('Nothing to save.'));
      const say = (text: string) => import('./lib/notice').then((m) => m.say(text));
      session.saving = true;
      try {
        const mod = await import('./lib/edit/save');
        if (!(await mod.readBase(loaded))) return say('Not saved: this notebook changed on disk. Your edits are still here.');
        const was = loaded.name;
        const r = await mod.save({ name: was, handle: loaded.handle, stamp: loaded.stamp, text: loaded.text!, bom: loaded.bom, kind: loaded.kind, crlf: loaded.crlf, original: loaded.original, cells }, asNew);
        if (r.how === 'none') return say('Nothing to save.');
        if (r.how === 'cancelled') return;
        if (r.how === 'failed') return say(`Not saved: ${r.why}.`);
        // the text the next save patches into is the one just written (or offered), and the sources on screen are its baseline
        loaded.text = r.text;
        loaded.original = cells.map((c) => c.source);
        if (r.how === 'in-place') {
          Object.assign(loaded, { file: r.file, stamp: `${r.file.lastModified}:${r.file.size}` });
          saved?.(r.file);
        } else if (r.how === 'as-new') {
          Object.assign(loaded, { file: r.file, handle: r.handle, name: r.name, stamp: `${r.file.lastModified}:${r.file.size}` });
          name = r.name;
          session.detached = false;
          document.title = `${r.name} · ipynb viewer`;
          stop?.();
          await follow(run, r.handle, r.file);
        }
        reset();
        const moved = r.how !== 'in-place' && r.why === 'changed' ? `${was} changed on disk, so your edits were saved as ` : '';
        say(r.how === 'in-place' ? `Saved ${r.name}` : r.how === 'as-new' ? `${moved || 'Saved as '}${r.name}` : `${moved ? moved.replace('saved as', 'downloaded as') : 'Downloaded '}${r.name}`);
      } catch (e) {
        say(`Not saved: ${e instanceof Error ? e.message : String(e)}.`);
      } finally {
        session.saving = false;
      }
    },
  };
  host(editing);

  function keys(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'o') return e.preventDefault(), choose();
    if (!session.on || !mod || e.altKey) return;
    if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      editing.save(e.shiftKey);
    } else if (e.key === 'z' && !e.shiftKey && !(e.target as Element | null)?.closest?.('input, textarea, [contenteditable]')) {
      if (undo()) e.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={keys} onbeforeunload={(e) => (session.dirty || session.saving) && e.preventDefault()} ondragenter={enter} ondragover={(e) => hasFiles(e) && e.preventDefault()} ondragleave={leave} ondrop={drop} onpaste={paste} />

<input bind:this={picker} type="file" accept=".ipynb,.json,application/json,.md,.markdown,text/markdown" hidden onchange={pick} />

<header class="bar">
  <div class="inner">
    <span class="name pill" class:idle={!name} class:two={sections > 1}>
      <span class="file"><img src="mark.svg" alt="" width="15" height="18" style="flex:none" /><span class="fname">{name || 'ipynb viewer'}</span>{#if session.dirty}<span class="dirty" title="Unsaved edits. ⌘S saves.">•</span>{/if}</span>
      {#if sections > 1}<span class="chapter"><Lucide name="heading" />{#key chapter}<span>{chapter || '\u00a0'}</span>{/key}</span>{/if}
    </span>
    <Opener />
    <div class="tools pill">
      <span class="tool-name">{tool}</span>
      {#if session.dirty}<button class="icon" aria-label="Save edits" data-tip={session.conflict || session.detached ? 'Save a copy · ⌘S' : 'Save · ⌘S'} disabled={session.saving} onclick={(e) => editing.save(e.shiftKey)}><Lucide name="save" /></button>{/if}
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
