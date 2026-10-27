<script lang="ts" module>
  export type Mark = 'strong' | 'em' | 'del' | 'code' | 'link';
  export type Type = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol';
  export type Cmd = 'undo' | 'redo' | Mark | Type | 'source' | 'done';

  const MARKS = new Set<Cmd>(['strong', 'em', 'del', 'code', 'link']);
  const TYPES = new Set<Cmd>(['p', 'h1', 'h2', 'h3', 'ul', 'ol']);

  // A bar that comes back within a moment of going (Enter, or an arrow into the next block) is the same bar: it does not rise in again.
  let gone = -Infinity;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Lucide, { type Lucide as Icon } from '../Lucide.svelte';

  // The editing toolbar, there for as long as a text cell is open, whatever the selection: history, marks, the block's
  // kind, the markdown source and Done. It never takes the focus from the text, so the selection it acts on stays put.
  let {
    root,
    source,
    type,
    shapes,
    flip,
    heading,
    history,
    run,
    resume,
    onleave,
  }: {
    /** The open editor's element. */
    root: () => HTMLElement | undefined;
    /** The block is open as markdown text. */
    source: boolean;
    type: Type | null;
    /** The block can become a paragraph, a heading or a list. */
    shapes: boolean;
    /** The block can switch between text and markdown. */
    flip: boolean;
    heading: boolean;
    history: (forward: boolean) => boolean;
    run: (cmd: Cmd) => void;
    /** Puts the focus back in the text. */
    resume: () => void;
    onleave: (e: FocusEvent) => void;
  } = $props();

  type Tool = { cmd: Cmd; icon: Icon; name: string; key?: string };
  const GROUPS: Tool[][] = [
    [
      { cmd: 'undo', icon: 'undo', name: 'Undo', key: '⌘Z' },
      { cmd: 'redo', icon: 'redo', name: 'Redo', key: '⇧⌘Z' },
    ],
    [
      { cmd: 'strong', icon: 'bold', name: 'Bold', key: '⌘B' },
      { cmd: 'em', icon: 'italic', name: 'Italic', key: '⌘I' },
      { cmd: 'del', icon: 'strikethrough', name: 'Strikethrough', key: '⌘⇧X' },
      { cmd: 'code', icon: 'code', name: 'Code', key: '⌘E' },
      { cmd: 'link', icon: 'link', name: 'Link', key: '⌘K' },
    ],
    [
      { cmd: 'p', icon: 'pilcrow', name: 'Paragraph' },
      { cmd: 'h1', icon: 'heading-1', name: 'Heading 1', key: '#' },
      { cmd: 'h2', icon: 'heading-2', name: 'Heading 2', key: '##' },
      { cmd: 'h3', icon: 'heading-3', name: 'Heading 3', key: '###' },
      { cmd: 'ul', icon: 'list', name: 'Bulleted list', key: '-' },
      { cmd: 'ol', icon: 'order', name: 'Numbered list', key: '1.' },
    ],
    [{ cmd: 'source', icon: 'hash', name: 'Markdown source', key: '⌘/' }],
    [{ cmd: 'done', icon: 'check', name: 'Done', key: 'Esc' }],
  ];
  const FLAT = GROUPS.flat();

  const NONE: Record<Mark, boolean> = { strong: false, em: false, del: false, code: false, link: false };
  let on = $state.raw<Record<Mark, boolean>>(NONE);
  let span = $state(false);
  let can = $state({ undo: false, redo: false });
  let bar: HTMLElement;
  const fresh = performance.now() - gone > 250;

  // What the selection is in, read from the page as the browser sees it.
  function sync() {
    can = { undo: history(false), redo: history(true) };
    const el = root();
    const sel = getSelection();
    if (source || !el || !sel?.rangeCount || !el.contains(sel.anchorNode)) {
      on = NONE;
      span = false;
      return;
    }
    span = !sel.isCollapsed;
    const near = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    // a heading is bold already, which is not the mark
    on = { strong: !heading && document.queryCommandState('bold'), em: document.queryCommandState('italic'), del: document.queryCommandState('strikeThrough'), code: !!near?.closest('code'), link: !!near?.closest('a') };
  }

  // the props say what the block is now; the selection and the history are read on every change
  $effect(sync);

  onMount(() => {
    document.addEventListener('selectionchange', sync);
    document.addEventListener('input', sync, true);
    return () => {
      gone = performance.now();
      document.removeEventListener('selectionchange', sync);
      document.removeEventListener('input', sync, true);
    };
  });

  const off = (cmd: Cmd): boolean => {
    if (cmd === 'undo' || cmd === 'redo') return !can[cmd];
    if (cmd === 'source') return !flip;
    if (cmd === 'done') return false;
    if (TYPES.has(cmd)) return !shapes;
    // a link or code needs some text, unless the caret is in one, which it then takes away
    return source || (cmd === 'strong' && heading) || ((cmd === 'code' || cmd === 'link') && !span && !on[cmd]);
  };

  const pressed = (cmd: Cmd): boolean | undefined => (cmd === 'source' ? source : TYPES.has(cmd) ? !source && type === cmd : MARKS.has(cmd) ? on[cmd as Mark] : undefined);

  const enabled = () => [...bar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  let at = $state(0);

  /** Alt+F10 from the text: the keys move along the bar, Esc or Tab goes back to the text. */
  export function focus() {
    const all = enabled();
    (all.find((b) => b.tabIndex === 0) ?? all[0])?.focus();
  }

  function key(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      return run(e.shiftKey ? 'redo' : 'undo');
    }
    // the page's one-key shortcuts are for reading, not for here
    if (!mod) e.stopPropagation();
    const all = enabled();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    let to = -1;
    if (e.key === 'ArrowRight') to = (i + 1) % all.length;
    else if (e.key === 'ArrowLeft') to = (i - 1 + all.length) % all.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = all.length - 1;
    else if (e.key === 'Escape' || e.key === 'Tab') (e.preventDefault(), resume());
    if (to >= 0) (e.preventDefault(), all[to]?.focus());
  }

  // Kept out of the block's own markup, which is read back as text.
  function portal(node: HTMLElement) {
    document.body.append(node);
    return { destroy: () => node.remove() };
  }
</script>

<!-- the bar never takes the focus from a click, so the text keeps its selection and its caret -->
<div
  bind:this={bar}
  class="fmt"
  class:rise={fresh}
  role="toolbar"
  aria-label="Editing"
  tabindex="-1"
  use:portal
  onpointerdown={(e) => e.preventDefault()}
  onmousedown={(e) => e.preventDefault()}
  onkeydown={key}
  onfocusin={(e) => (at = Math.max(0, FLAT.findIndex((t) => t.cmd === (e.target as HTMLElement).dataset.cmd)))}
  onfocusout={onleave}
>
  {#each GROUPS as group, g}
    {#if g}<span class="sep" aria-hidden="true"></span>{/if}
    {#each group as t}
      <button
        type="button"
        class="icon"
        data-cmd={t.cmd}
        aria-label={t.name}
        data-tip={t.key ? `${t.name} · ${t.key}` : t.name}
        aria-pressed={pressed(t.cmd)}
        disabled={off(t.cmd)}
        tabindex={FLAT[at] === t ? 0 : -1}
        onclick={() => {
          run(t.cmd);
          queueMicrotask(sync);
        }}
      >
        <Lucide name={t.icon} />
      </button>
    {/each}
  {/each}
</div>
