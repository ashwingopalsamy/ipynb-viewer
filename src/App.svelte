<script lang="ts">
  import { readNotebook, type Cell, type NotebookMeta } from './lib/notebook';
  import { theme, toggleTheme } from './lib/theme.svelte';
  import CellView from './lib/Cell.svelte';
  import Icon from './lib/Icon.svelte';

  let cells = $state.raw<Cell[]>([]);
  let meta = $state.raw<NotebookMeta | null>(null);
  let warnings = $state.raw<string[]>([]);
  let name = $state('');
  let status = $state<'empty' | 'ready' | 'error'>('empty');
  let error = $state('');
  let dragging = $state(false);
  let picker: HTMLInputElement;
  let reorder = $state<typeof import('./lib/replay').reorder>();
  let replayed = $state(false);
  let ready = $state(false);
  let Extras = $state<typeof import('./lib/Extras.svelte').default>();
  let Actions = $state<typeof import('./lib/Extras.svelte').Actions>();
  let Veil = $state<typeof import('./lib/Veil.svelte').default>();
  let changed = $state.raw<ReadonlySet<string>>(new Set());
  let live = $state(false);
  let stop: (() => void) | undefined;

  const rows = $derived(replayed && reorder ? reorder(cells) : cells);
  const language = $derived(meta ? (meta.language ?? 'python') : null);

  let sections = $state(0);
  let chapter = $state('');

  let run = 0;
  let depth = 0;

  async function open(file: File, handle?: FileSystemFileHandle) {
    const mine = ++run;
    stop?.();
    stop = undefined;
    ready = false;
    live = !!handle;
    name = file.name;
    cells = [];
    meta = null;
    warnings = [];
    error = '';
    status = 'ready';
    import('./lib/Extras.svelte').then((m) => ((Extras = m.default), (Actions = m.Actions)));
    document.title = `${file.name} · ipynb viewer`;

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
        if (mine !== run) return;
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
      flush();
      if (!notebook.cells.length) throw new Error('This notebook has no cells.');
      ready = true;
      if (handle) {
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
      status = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }

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

<svelte:window ondragenter={enter} ondragover={(e) => hasFiles(e) && e.preventDefault()} ondragleave={leave} ondrop={drop} />

<input bind:this={picker} type="file" accept=".ipynb,.json,application/json" hidden onchange={pick} />

<header class="bar">
  <div class="inner">
    <span class="name" class:idle={!name} class:two={sections > 1}>
      <span class="file">{#if live}<i class="live" title="Updates when the file changes"></i>{/if}{name || 'ipynb viewer'}</span>
      {#if sections > 1}<span class="chapter">{#key chapter}<span>{chapter || '\u00a0'}</span>{/key}</span>{/if}
    </span>
    <div class="tools">
      {#if Actions}<Actions />{/if}
      <button class="icon" onclick={choose} title="Open">
        <Icon name="open" />
      </button>
      <button class="icon swap" onclick={toggleTheme} title={theme.value === 'dark' ? 'Light' : 'Dark'}>
        <span class="glyph" class:on={theme.value === 'light'}><Icon name="moon" /></span>
        <span class="glyph" class:on={theme.value === 'dark'}><Icon name="sun" /></span>
      </button>
    </div>
  </div>
</header>

{#if Extras}<Extras cells={rows} raw={cells} {name} {language} {ready} bind:sections bind:chapter bind:replayed bind:reorder />{/if}

<main>
  {#if status === 'empty' || status === 'error'}
    <button class="drop" onclick={choose}>
      {#if status === 'error'}
        <strong>That one would not open</strong>
        <span>{error}</span>
      {:else}
        <strong>Jupyter notebooks, without Jupyter.</strong>
        <span>Drop a .ipynb here, or click to choose one.</span>
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
  <img src="/ashwin.webp" width="28" height="28" alt="" decoding="async" />
  <span>Built by <b>Ashwin Gopalsamy</b></span>
</a>

{#if Veil}<Veil on={dragging} />{/if}
