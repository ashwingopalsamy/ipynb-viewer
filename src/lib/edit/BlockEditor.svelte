<script lang="ts">
  import './edit.css';
  import { onMount } from 'svelte';
  import type { Tokens } from 'marked';
  import type { MimeBundle } from '../notebook';
  import { blockFrom, blocksOf, replaceBlock, type Block } from './blocks';
  import { blockMarkdown, blockText, plainLength, toMarkdown, type Inline } from './inline';
  import { atEdge, caretAt, fromDom, inputRule, mark, pointAt, textOffset, toDom } from './dom';
  import Toolbar, { type Cmd, type Mark, type Type } from './Toolbar.svelte';
  import { typeset } from '../math';
  import { renderMarkdown } from '../markdown';
  import { pending, rewind, session } from './session.svelte';
  import { say } from '../notice';
  import type { Caret, Follow } from './types';

  // One open block. `block` is where it sits in `source`; null with `insertAt` is a new paragraph after a block,
  // and null alone is the whole cell as text. Props are read when a key is pressed, never kept from mount.
  let {
    block,
    insertAt,
    source,
    attachments,
    mode,
    at,
    top,
    onDone,
  }: {
    block: Block | null;
    insertAt?: number;
    source: string;
    attachments: Record<string, MimeBundle>;
    mode: 'rich' | 'source';
    at: Caret | null;
    /** Where on the screen the block was when it was clicked open: it opens there. */
    top?: number;
    onDone: (next: string | null, follow?: Follow) => void;
  } = $props();

  const first = (() => ({ mode, shape: block, ghost: insertAt !== undefined, whole: block === null && insertAt === undefined, at, top }))();
  const ghost = first.ghost;
  const whole = first.whole;

  let view = $state<'rich' | 'source'>(first.mode);
  /** What the rich editor draws: the block's own kind, or a block read back from edited source. */
  let shape = $state.raw<Block | null>(first.shape);
  let caret: Caret | null = first.at;
  let srcText = '';
  let el: HTMLElement | undefined;
  let ta: HTMLTextAreaElement | undefined;
  let touched = false;
  // something was typed here, so the browser's own undo has steps of this editor's
  let input = false;
  let done = false;
  let bar: Toolbar | undefined;
  // nothing typed yet, so a new paragraph shows what it is for
  let blank = $state(ghost);

  // the text the block had when it opened, to tell an untouched source editor from a changed one
  const original = () => (whole ? source : block ? source.slice(block.start, block.end) : '');
  srcText = original();

  const tag = $derived(shape?.kind === 'heading' ? `h${(shape.token as Tokens.Heading).depth}` : shape?.kind === 'list' ? ((shape.token as Tokens.List).ordered ? 'ol' : 'ul') : 'p');
  const label = $derived(shape?.kind === 'heading' ? 'heading' : shape?.kind === 'list' ? 'list' : 'paragraph');
  // the block's kind as the toolbar names it; it has no button for the smaller headings
  const type = $derived(/^h[4-6]$/.test(tag) ? null : (tag as Type));

  function finish(next: string | null, follow?: Follow) {
    if (done) return;
    done = true;
    onDone(next, follow);
  }

  // What the rich editor holds, as the model: one run for a paragraph or heading, one per item for a list.
  function read(): { items: Inline[][]; extra: Inline[][] } {
    if (!el) return { items: [], extra: [] };
    if (shape?.kind !== 'list') return { items: [fromDom(el)], extra: [] };
    const items: Inline[][] = [];
    const extra: Inline[][] = [];
    for (const child of el.children) (child.tagName === 'LI' ? items : extra).push(fromDom(child));
    return { items, extra };
  }

  function richMarkdown(): string {
    const { items, extra } = read();
    return shape ? blockMarkdown(shape, items, extra) : toMarkdown(items[0] ?? []).trim();
  }

  function insert(md: string): string {
    const at0 = insertAt ?? 0;
    const before = source.slice(0, at0);
    const after = source.slice(at0);
    return before + (before.trim() ? '\n\n' : '') + md + (/\S/.test(after) ? '\n\n' + after.replace(/^\n+/, '') : after);
  }

  /** The cell's new source, or null when nothing changed. */
  function compute(): string | null {
    if (view === 'source') {
      const text = ta?.value ?? srcText;
      if (text === original()) return null;
      return whole ? text : replaceBlock(source, block!, text.replace(/\n+$/, ''));
    }
    // an editor taken off the page without closing (a hot reload) has nothing to read, which is not an empty block
    if (!touched || !el) return null;
    const md = richMarkdown();
    if (ghost) return md ? insert(md) : null;
    return replaceBlock(source, block!, md);
  }

  // Saving commits what is typed and opens the same block again, so the props are fresh when typing goes on.
  function flush() {
    if (done) return;
    const next = compute();
    const where: Caret = view === 'source' ? { offset: ta?.selectionStart ?? 0 } : { offset: el ? textOffset(el) : 0 };
    done = true;
    onDone(next, { to: 'same', at: where });
  }

  // A press outside this editor, judged when it comes up. One that comes up as a click (not a drag, a selection or a scroll)
  // on a text cell opens what it landed on, in this cell or another, so that once editing, one click goes anywhere; any
  // other press commits. Not before: a finger may be about to scroll (the browser reports a cancel), and a click on a link
  // or a button lands where it was pressed only if the page does not move under it between the press and the release.
  let press: { id: number; x: number; y: number; to: Element | null } | null = null;

  onMount(() => {
    const down = (e: PointerEvent) => {
      press = null;
      const t = e.target as Element;
      if ((el ?? ta)?.contains(t) || t.closest?.('.fmt')) return;
      // a right click (or the Mac's control click) opens a menu, which can keep the release from the page
      if (e.button !== 0 || e.ctrlKey) return finish(compute());
      const to = e.shiftKey || e.metaKey || e.altKey ? null : text(t, e.clientY);
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, to };
      // the mouse press a browser sends after a tap would take the focus from the editor the tap opens
      if (to && e.pointerType === 'touch') e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return;
      const { x, y, to } = press;
      press = null;
      // Text selected by dragging, to copy, stays selected. A mouse tells a drag by how far it went: a press on text selects
      // a character or two with the first pixels of any hand's drift, which is still a click. A long press on a finger
      // selects a word on purpose, and a finger may wander a little more than a mouse in a tap.
      const touch = e.pointerType === 'touch';
      const sel = getSelection();
      const dragged = (touch && sel && !sel.isCollapsed && !(el ?? ta)?.contains(sel.anchorNode)) || Math.hypot(e.clientX - x, e.clientY - y) >= (touch ? 16 : 8);
      if (!to || dragged) return finish(compute());
      hand(to, e.clientX, e.clientY);
    };
    const cancel = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return;
      press = null;
      // a finger that scrolls leaves the editor open; a mouse that began to drag text or a picture away has left it
      if (e.pointerType !== 'touch') finish(compute());
    };
    // Safari does not blur a field when the click lands on plain text
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    session.flush = flush;
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      if (session.flush === flush) session.flush = null;
    };
  });

  // Leaving the editor commits it, but switching to another window does not.
  function leave(e: FocusEvent) {
    const to = e.relatedTarget as Element | null;
    // the keys took the focus to the toolbar: the selection it will act on is kept
    if (to?.closest?.('.fmt') && el?.contains(getSelection()?.anchorNode ?? null)) kept = getSelection()!.getRangeAt(0).cloneRange();
    if (to && ((el ?? ta)?.contains(to) || to.closest?.('.fmt'))) return;
    setTimeout(() => {
      // a press that took the focus is judged when it comes up
      if (done || press || !document.hasFocus()) return;
      const now = document.activeElement;
      if (now && ((el ?? ta)?.contains(now) || now.closest('.fmt'))) return;
      finish(compute());
    }, 0);
  }

  /**
   * What a click on `t` opens: the block of a text cell it is in, or the cell when it is drawn whole or is empty. On the
   * cell around and between its blocks, the block nearest the pointer, or this editor. Null for a link, a table's sorting
   * header, a cell not drawn yet, and anything outside a text cell.
   */
  function text(t: Element, y: number): Element | null {
    const md = t.closest?.('.cell.markdown')?.querySelector(':scope > .md');
    if (!md || md.querySelector(':scope > .pending') || t.closest('a, summary, thead th')) return null;
    if (t.closest('[data-b], .placeholder')) return t;
    let near: Element | null = null;
    let far = Infinity;
    for (const c of md.children) {
      if (!c.matches('[data-b], .placeholder, .editing, .editing-src, .editing-preview')) continue;
      const r = c.getBoundingClientRect();
      const d = Math.max(r.top - y, y - r.bottom, 0);
      if (d < far) (near = c), (far = d);
    }
    // a formula's drawing under its source is part of this editor
    return near?.matches('.editing-preview') ? near.previousElementSibling : (near ?? md);
  }

  /** Commits this editor and opens what a click landed on (`to`, from `text`), with the caret on the point, kept inside the block. */
  function hand(to: Element, x: number, y: number) {
    const r = (to.closest('[data-b]') ?? to).getBoundingClientRect();
    const point = { x: Math.min(Math.max(x, r.left), r.right - 1), y: Math.min(Math.max(y, r.top + 1), r.bottom - 1) };
    const own = (el ?? ta)!;
    if (to === own) {
      // beside this block and nearer it than any other: the caret goes back into it
      own.focus({ preventScroll: true });
      if (el) place(el, { x: point.x - r.left, y: point.y - r.top });
      return;
    }
    const cell = to.closest('[data-cell]')!;
    const next = compute();
    // in this cell, a block after this one moves by the length the edit adds (read now: the props change as it is drawn)
    const end = cell.contains(own) ? (block?.end ?? insertAt ?? 0) : Infinity;
    const by = next === null ? 0 : next.length - source.length;
    finish(next, { to: 'cell', cell, ask: { target: to, point, moved: (s) => (s >= end ? s + by : s) } });
  }

  // ---- rich ----

  function place(node: HTMLElement, c: Caret | null) {
    if (!c || c === 'end' || (typeof c === 'object' && 'find' in c)) return caretAt(node, Infinity);
    if (c === 'start') return caretAt(node, 0);
    if ('offset' in c) return caretAt(node, c.offset);
    const box = node.getBoundingClientRect();
    const p = 'edge' in c ? { x: c.x, y: c.edge === 'bottom' ? box.bottom - 4 : box.top + 4 } : { x: box.left + c.x, y: box.top + c.y };
    // a point out of the window finds no text: an arrow into a block or a cell out of sight scrolls just far enough to show its line
    const top = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    const by = p.y < top ? p.y - top - 8 : p.y > innerHeight - 32 ? p.y - innerHeight + 40 : 0;
    if (by) (scrollBy({ top: by }), (p.y -= by));
    const pos = pointAt(p.x, p.y);
    if (!pos || !node.contains(pos.node)) return caretAt(node, c && 'edge' in c && c.edge === 'top' ? 0 : Infinity);
    const sel = getSelection()!;
    sel.collapse(pos.node, pos.offset);
  }

  // An editor that opens (or a caret that arrives) near the edge of the window, under the header or the keyboard's side, is scrolled into view.
  function reveal(node: HTMLElement) {
    const sel = getSelection();
    const box = (node === el && sel?.rangeCount ? sel.getRangeAt(0).getClientRects()[0] : undefined) ?? node.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    const bottom = innerHeight - 32;
    if (box.top < top) scrollBy({ top: box.top - top });
    else if (box.bottom > bottom) scrollBy({ top: box.bottom - bottom });
  }

  // Both wait for the page to be drawn for this frame: the contents list marks the headings then (in a frame it asks for
  // when the page changes, so before this one), and the room it gives a heading moves it. A block that was clicked open
  // first goes back to where it was clicked, though an editor that closed above it changed the height of the page.
  let held = first.top;
  function settle(node: HTMLElement) {
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        if (!node.isConnected) return;
        const off = held === undefined ? 0 : node.getBoundingClientRect().top - held;
        held = undefined;
        if (Math.abs(off) >= 1) scrollBy({ top: off });
        reveal(node);
      }),
    );
  }

  function build(node: Element) {
    const root = node as HTMLElement;
    el = root;
    ta = undefined;
    root.replaceChildren();
    if (shape?.kind === 'list') {
      for (const item of blockText(shape)) {
        const li = document.createElement('li');
        li.append(toDom(item, document, attachments));
        // an empty item needs a break to hold the caret
        if (!item.length) li.append(document.createElement('br'));
        root.append(li);
      }
      const list = shape.token as Tokens.List;
      if (list.ordered && typeof list.start === 'number' && list.start !== 1) root.setAttribute('start', String(list.start));
    } else if (shape) root.append(toDom(blockText(shape)[0], document, attachments));
    typeset(root);
    root.focus({ preventScroll: true });
    place(root, caret);
    settle(root);
    return {
      destroy() {
        if (el === root) el = undefined;
      },
    };
  }

  const fmt = (kind: Mark) => {
    // a heading is bold already: the browser's bold would take it off on screen while the markdown kept it
    if (kind === 'strong' && shape?.kind === 'heading') return;
    if (el && mark(el, kind, say)) touched = true;
  };

  // Enter in a paragraph or heading: the text after the caret becomes a paragraph of its own.
  function split() {
    if (!el || !block || !shape || shape.kind === 'list') return;
    const sel = getSelection();
    if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();
    // at the very start the block stays as it is and a new paragraph opens above it
    if (textOffset(el) === 0) return finish(compute(), { to: 'above', at: 'start' });
    const tail = document.createRange();
    tail.setStart(range.endContainer, range.endOffset);
    tail.setEnd(el, el.childNodes.length);
    const right = fromDom(tail.extractContents());
    const left = fromDom(el);
    const rightMd = toMarkdown(right).trim();
    touched = true;
    if (!rightMd) return finish(compute(), { to: 'ghost', at: 'start' });
    const next = replaceBlock(source, block, blockMarkdown(shape, [left]) + '\n\n' + rightMd);
    finish(next, { to: 'next', at: 'start' });
  }

  // Backspace at the start, or Delete at the end: the neighbouring paragraph or heading joins this one.
  function join(back: boolean): boolean {
    if (!el || !block || !shape || shape.kind === 'list' || !getSelection()?.isCollapsed) return false;
    const here = fromDom(el);
    if (textOffset(el) !== (back ? 0 : plainLength(here))) return false;
    const all = blocksOf(source);
    const i = all ? all.findIndex((b) => b.start === block.start) : -1;
    const other = all?.[back ? i - 1 : i + 1];
    if (!all || i < 0 || !other || (other.kind !== 'paragraph' && other.kind !== 'heading')) return false;
    const [a, b] = back ? [other, block] : [block, other];
    if (/\S/.test(source.slice(a.end, b.start))) return false;
    const mine = back ? blockText(other)[0] : here;
    const theirs = back ? here : blockText(other)[0];
    const style = back ? other : shape;
    const next = replaceBlock(source, { ...style, start: a.start, end: b.end }, blockMarkdown(style, [[...mine, ...theirs]]));
    finish(next, { to: back ? 'prev' : 'same', at: { offset: plainLength(mine) } });
    return true;
  }

  function toSource() {
    if (ghost || !block || block.kind === 'source') return;
    srcText = touched ? richMarkdown() : original();
    caret = 'end';
    view = 'source';
  }

  // Markdown typed as text: a closing `*`, `~` or backtick turns what it closes into a mark.
  let ruling = false;
  function typed(e: Event) {
    touched = true;
    input = true;
    blank = !el?.textContent;
    const ev = e as InputEvent;
    // the rule's own edits fire input too
    if (ruling || !el || ev.isComposing || ev.inputType !== 'insertText' || !ev.data) return;
    ruling = true;
    try {
      if ('*~`'.includes(ev.data)) inputRule(el, shape?.kind === 'heading');
      else if (ev.data === ' ') blockRule();
    } finally {
      ruling = false;
    }
  }

  // `# ` to `### `, `- `, `* `, `+ `, `1. ` or `1) ` typed at the very start of a paragraph turns it into a heading or a list
  function blockRule() {
    if (!el || (shape && shape.kind !== 'paragraph')) return;
    const m = fromDom(el);
    const first = m[0];
    const head = first?.t === 'text' ? first.v : '';
    const pre = /^(#{1,3}|[-*+]|1[.)])[  ]/.exec(head);
    if (!pre || textOffset(el) !== pre[0].length) return;
    become(pre[1], [[{ t: 'text', v: head.slice(pre[0].length) }, ...m.slice(1)]], 0);
  }

  /**
   * The open block drawn again as a paragraph (marker ''), a heading (`#` to `###`) or a list (`-`, `*`, `+`, `1.`, `1)`) of
   * `lines`: written as that markdown and read back, so what is drawn is the one block that will be saved. A heading
   * takes the lines as one, a paragraph keeps them apart with line breaks, and a list makes each an item.
   */
  function become(marker: string, lines: Inline[][], at: number) {
    const like = blockFrom(marker ? `${marker} x` : 'x');
    if (!like) return;
    const md = blockMarkdown(like, like.kind === 'list' ? lines : [lines.flatMap((l, i) => (i ? [BR, ...l] : l))]);
    // nothing left: an empty heading or list item still holds the caret, and a paragraph is the plain one a new paragraph is
    const found = md ? blockFrom(md) : marker ? blockFrom(`${marker} `) : null;
    if ((md || marker) && found?.kind !== like.kind) return;
    caret = { offset: at };
    blank = !md;
    touched = true;
    shape = found;
  }

  const BR: Inline = { t: 'br' };
  const MARKER: Record<Type, string> = { p: '', h1: '#', h2: '##', h3: '###', ul: '-', ol: '1.' };

  // The toolbar's paragraph, heading and list buttons. A list button pressed again takes the list away. A list's items
  // and a paragraph's lines (the runs between its line breaks) become each other.
  function retype(to: Type) {
    if (!el || view !== 'rich' || whole) return;
    if (to === type) {
      if (to !== 'ul' && to !== 'ol') return;
      to = 'p';
    }
    const { items, extra } = read();
    const list = to === 'ul' || to === 'ol';
    let lines: Inline[][] = [...items, ...extra];
    // the caret stays on its character: an item boundary is no position, a line break (or a heading's space) is one
    const from = textOffset(el);
    let at = from;
    if (shape?.kind === 'list') {
      const node = getSelection()?.anchorNode;
      const li = (node instanceof Element ? node : node?.parentElement)?.closest('li');
      if (!list && li) at += Math.max(0, [...el.children].indexOf(li));
    } else {
      lines = [[]];
      let pos = 0;
      for (const n of items[0] ?? []) {
        if (list && n.t === 'br' && pos < from) at--;
        pos += plainLength([n]);
        n.t === 'br' ? lines.push([]) : lines[lines.length - 1].push(n);
      }
    }
    become(MARKER[to], lines, at);
  }

  // the empty last item of a list, where Enter ends the list
  function endItem(): HTMLElement | null {
    const at = getSelection()?.anchorNode;
    const li = (at instanceof Element ? at : at?.parentElement)?.closest('li');
    return el && li && li === el.lastElementChild && el.children.length > 1 && !li.textContent ? li : null;
  }

  function richKey(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229 || !el) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const own = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (k === 'F10' && e.altKey) return void (own(), bar?.focus());
    if (mod && !e.altKey) {
      // these also mean something to the page or the browser (search, bookmarks), so the editor keeps them
      if (k === 'b' && !e.shiftKey) (own(), fmt('strong'));
      else if (k === 'i' && !e.shiftKey) (own(), fmt('em'));
      else if (k === 'e' && !e.shiftKey) (own(), fmt('code'));
      else if (k === 'k' && !e.shiftKey) (own(), fmt('link'));
      else if (k === 'x' && e.shiftKey) (own(), fmt('del'));
      // the browser has nothing of this editor's to take back: the edit before this one is what ⌘Z means
      else if (k === 'z' && !browser(e.shiftKey)) (own(), back(e.shiftKey));
      else if (k === '/') (own(), toSource());
      else if (k === 'Enter') (own(), finish(compute()));
      return;
    }
    if (k === 'Escape') (own(), finish(compute()));
    else if (k === 'Tab') own();
    else if (k === 'Enter' && e.shiftKey) {
      own();
      document.execCommand('insertLineBreak');
      touched = true;
    } else if (k === 'Enter' && !e.altKey) {
      if (shape?.kind === 'list') {
        // in a list the browser adds the item; an empty last item ends the list, and a new paragraph opens under it
        const item = endItem();
        if (item) (own(), item.remove(), (touched = true), finish(compute(), { to: 'ghost', at: 'start' }));
        return;
      }
      // a new paragraph with text is kept and another opens under it; Enter on an empty one closes it
      if (ghost) (own(), blank ? finish(null) : finish(compute(), { to: 'ghost', at: 'start' }));
      else if (shape) (own(), split());
    } else if ((k === 'Backspace' || k === 'Delete') && join(k === 'Backspace')) own();
    else if ((k === 'ArrowUp' || k === 'ArrowDown') && !e.shiftKey && !e.altKey && (block || blank)) {
      const up = k === 'ArrowUp';
      if (!atEdge(el, up ? 'top' : 'bottom')) return;
      const x = getSelection()?.getRangeAt(0).getClientRects()[0]?.left ?? el.getBoundingClientRect().left;
      if (onward(up, x)) own();
    }
  }

  // On the first or last line, an arrow goes on into the block above or below, and from the first or last block into
  // the text cell above or below, past any code between. A new paragraph with nothing in it (all an empty cell has) is
  // passed over the same way. False where there is nowhere to go, and the key does what it does.
  function onward(up: boolean, x: number): boolean {
    const at = { edge: up ? 'bottom' : 'top', x } as const;
    if (block) {
      const all = blocksOf(source);
      const i = all ? all.findIndex((b) => b.start === block.start) : -1;
      if (i < 0) return false;
      if (all![up ? i - 1 : i + 1]) return (finish(compute(), { to: up ? 'prev' : 'next', at }), true);
    } else if (ghost) {
      const step = (n: Element | null) => (up ? n?.previousElementSibling : n?.nextElementSibling) ?? null;
      let near = step(el ?? null);
      while (near && !near.matches('[data-b]')) near = step(near);
      if (near) return (finish(compute(), { to: 'cell', cell: near.closest('[data-cell]')!, ask: { target: near, point: null, edge: at } }), true);
    }
    const cells = [...document.querySelectorAll('.notebook > .cell')];
    const i = cells.indexOf((el ?? ta)!.closest('.cell')!);
    const cell = i < 0 ? undefined : up ? cells.slice(0, i).findLast((c) => c.matches('.markdown')) : cells.slice(i + 1).find((c) => c.matches('.markdown'));
    if (!cell) return false;
    finish(compute(), { to: 'cell', cell, ask: { target: null, point: null, edge: at } });
    return true;
  }

  function paste(e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    const sel = getSelection();
    if (!text || !el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return;
    // a web address pasted over some words makes them a link
    if (!sel.isCollapsed && /^https?:\/\/\S+$/.test(text) && document.execCommand('createLink', false, text)) return void (touched = true);
    // text with blank lines in it is several blocks: it goes in as markdown, between what comes before and after the caret
    if (ghost && /\n[ \t]*\n/.test(text)) {
      touched = true;
      return finish(insert([toMarkdown(fromDom(el)).trim(), text].filter(Boolean).join('\n\n')));
    }
    if (block && shape && shape.kind !== 'list' && /\n[ \t]*\n/.test(text)) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) range.deleteContents();
      const tail = document.createRange();
      tail.setStart(range.endContainer, range.endOffset);
      tail.setEnd(el, el.childNodes.length);
      const right = fromDom(tail.extractContents());
      const left = fromDom(el);
      const rightMd = right.length ? (left.length ? toMarkdown(right).trim() : blockMarkdown(shape, [right])) : '';
      touched = true;
      return finish(replaceBlock(source, block, [left.length ? blockMarkdown(shape, [left]) : '', text, rightMd].filter(Boolean).join('\n\n')));
    }
    if (document.execCommand('insertText', false, text)) touched = true;
  }

  const over = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function drop(e: DragEvent) {
    over(e);
    const text = e.dataTransfer?.getData('text/plain');
    if (!text || e.dataTransfer?.files.length) return;
    const p = pointAt(e.clientX, e.clientY);
    if (p && el?.contains(p.node)) getSelection()?.collapse(p.node, p.offset);
    if (document.execCommand('insertText', false, text)) touched = true;
  }

  // ---- source ----

  const size = (node: HTMLTextAreaElement) => {
    node.style.height = 'auto';
    node.style.height = node.scrollHeight + 'px';
  };

  function src(node: HTMLTextAreaElement) {
    ta = node;
    el = undefined;
    node.value = srcText;
    size(node);
    node.focus({ preventScroll: true });
    let i = 0;
    if (caret === 'end') i = node.value.length;
    else if (caret && typeof caret === 'object' && 'offset' in caret) i = Math.min(caret.offset, node.value.length);
    else if (caret && typeof caret === 'object' && 'find' in caret) i = Math.max(0, node.value.indexOf(caret.find));
    else if (caret && typeof caret === 'object' && 'edge' in caret) i = caret.edge === 'bottom' ? node.value.length : 0;
    node.setSelectionRange(i, i);
    settle(node);
    return {
      destroy() {
        if (ta === node) ta = undefined;
      },
    };
  }

  // TeX is hard to read as text, so a formula being edited is drawn under its source as it is typed
  function preview(node: HTMLElement) {
    const box = node.previousElementSibling as HTMLTextAreaElement | null;
    let frame = 0;
    const draw = () => {
      frame = 0;
      // sanitized by DOMPurify in renderMarkdown
      node.innerHTML = renderMarkdown(box?.value ?? srcText, attachments);
      typeset(node);
    };
    const queue = () => (frame ||= requestAnimationFrame(draw));
    draw();
    box?.addEventListener('input', queue);
    return {
      destroy() {
        cancelAnimationFrame(frame);
        box?.removeEventListener('input', queue);
      },
    };
  }

  // Tab indents the selected lines, one step for prose and four for code, through the browser's insert so undo still works.
  function indent(out: boolean) {
    if (!ta) return;
    const code = block?.token.type === 'code';
    const unit = code ? '    ' : '  ';
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const put = (text: string) => {
      if (!document.execCommand('insertText', false, text)) ta!.setRangeText(text, ta!.selectionStart, ta!.selectionEnd, 'end');
      size(ta!);
    };
    if (s === e && !out) return put(unit);
    const from = v.lastIndexOf('\n', s - 1) + 1;
    let to = v.indexOf('\n', e);
    if (to < 0) to = v.length;
    const lines = v.slice(from, to).split('\n').map((l) => (out ? l.replace(new RegExp(`^(?: {1,${unit.length}}|\\t)`), '') : unit + l));
    ta.setSelectionRange(from, to);
    put(lines.join('\n'));
    ta.setSelectionRange(from, from + lines.join('\n').length);
  }

  function toRich() {
    if (!ta || !block || block.kind === 'source') return;
    const found = blocksOf(ta.value);
    if (found?.length !== 1 || found[0].kind === 'source') return say('This markdown is more than one paragraph, heading or list now, so it stays as text.');
    touched = ta.value !== original();
    shape = found[0];
    caret = 'end';
    view = 'rich';
  }

  function srcKey(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.metaKey || e.ctrlKey;
    const own = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === 'F10' && e.altKey) (own(), bar?.focus());
    else if (e.key === 'Escape' || (mod && e.key === 'Enter')) (own(), finish(compute()));
    else if (mod && e.key === '/') (own(), toRich());
    else if (mod && !e.altKey && e.key.toLowerCase() === 'z' && !browser(e.shiftKey)) (own(), back(e.shiftKey));
    else if (e.key === 'Tab') (own(), indent(e.shiftKey));
    else if (mod && !e.altKey && !e.shiftKey && 'kbie'.includes(e.key.toLowerCase())) own();
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.shiftKey && !e.altKey && ta) {
      // at the very start or end of the text the arrow goes on into the block or text cell above or below, as in the rich editor
      const up = e.key === 'ArrowUp';
      const end = up ? 0 : ta.value.length;
      if (ta.selectionStart !== end || ta.selectionEnd !== end) return;
      if (onward(up, ta.getBoundingClientRect().left)) own();
    }
  }

  const files = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) over(e);
  };

  // ---- history and the toolbar ----

  /** The browser's own undo (or redo) has a step of what was typed here. */
  const browser = (forward: boolean) => input && document.queryCommandEnabled(forward ? 'redo' : 'undo');

  // Undo past what the browser holds: the edit before this one in the notebook (going forward, the one taken back last).
  // What is typed here and not yet committed is committed first, so it is what goes, and a new edit leaves nothing to put
  // back. When the edit is in this cell the editor opens again where the text changes; elsewhere it closes, and the page shows the edit.
  function back(forward: boolean) {
    const next = compute();
    const typed = next !== null && next !== source;
    const id = typed ? (forward ? null : session.active) : pending(forward);
    if (!id) return;
    const at: Caret = ghost ? 'end' : view === 'source' ? { offset: ta?.selectionStart ?? 0 } : { offset: el ? textOffset(el) : 0 };
    finish(next, id === session.active ? { to: 'near', at } : undefined);
    rewind(forward);
  }

  /** Whether undo (or redo) has anything to do here: in the browser's history of this editor, or in the notebook's. */
  function history(forward: boolean): boolean {
    if (browser(forward)) return true;
    // read only when the rest does not decide it, since it writes out the block
    const changed = () => {
      const next = compute();
      return next !== null && next !== source;
    };
    return forward ? pending(true) !== null && !changed() : pending(false) !== null || changed();
  }

  // the selection in the text when the keys took the focus to the toolbar
  let kept: Range | null = null;

  /** The focus back in the text, with the selection it had. */
  function resume() {
    const node = el ?? ta;
    if (!node || document.activeElement === node) return;
    node.focus({ preventScroll: true });
    if (el && kept && el.contains(kept.startContainer)) {
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(kept);
    }
    kept = null;
  }

  function run(cmd: Cmd) {
    if (done) return;
    resume();
    if (cmd === 'undo' || cmd === 'redo') {
      if (browser(cmd === 'redo')) document.execCommand(cmd);
      else back(cmd === 'redo');
    } else if (cmd === 'done') finish(compute());
    else if (cmd === 'source') view === 'source' ? toRich() : toSource();
    else if (cmd in MARKER) retype(cmd as Type);
    else fmt(cmd as Mark);
  }
</script>

{#if view === 'source'}
  <textarea use:src class="editing-src" class:code={block?.token.type === 'code' || block?.token.type === 'table'} rows="1" spellcheck="false" data-gramm="false" aria-label="Edit markdown source" onkeydown={srcKey} oninput={() => ((input = true), ta && size(ta))} onfocusout={leave} ondragover={files} ondrop={files}></textarea>
  {#if block?.token.type === 'blockMath'}<div class="editing-preview" aria-hidden="true" use:preview></div>{/if}
{:else}
  {#key shape}
    <svelte:element
      this={tag}
      use:build
      class="editing"
      contenteditable="true"
      role="textbox"
      tabindex="0"
      aria-multiline="true"
      aria-label="Edit {label}"
      spellcheck="true"
      onkeydown={richKey}
      data-placeholder={ghost && blank ? 'Type, or # for a heading, - for a list' : undefined}
      oninput={typed}
      onpaste={paste}
      ondrop={drop}
      ondragover={over}
      onfocusout={leave}
      onclick={(e: MouseEvent) => (e.target as Element).closest('a') && e.preventDefault()}
    ></svelte:element>
  {/key}
{/if}
<Toolbar
  bind:this={bar}
  root={() => el}
  source={view === 'source'}
  {type}
  shapes={view === 'rich' && !whole}
  flip={!ghost && !!block && block.kind !== 'source'}
  heading={shape?.kind === 'heading'}
  {history}
  {run}
  {resume}
  onleave={leave}
/>
