<script lang="ts">
  import './edit.css';
  import { onMount } from 'svelte';
  import type { Tokens } from 'marked';
  import type { MimeBundle } from '../notebook';
  import { blockFrom, blocksOf, replaceBlock, type Block } from './blocks';
  import { blockMarkdown, blockText, plainLength, toMarkdown, type Inline } from './inline';
  import { atEdge, caretAt, fromDom, inputRule, mark, pointAt, textOffset, toDom } from './dom';
  import Bubble from './Bubble.svelte';
  import { typeset } from '../math';
  import { renderMarkdown } from '../markdown';
  import { rewind, session } from './session.svelte';
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
    onDone,
  }: {
    block: Block | null;
    insertAt?: number;
    source: string;
    attachments: Record<string, MimeBundle>;
    mode: 'rich' | 'source';
    at: Caret | null;
    onDone: (next: string | null, follow?: Follow) => void;
  } = $props();

  const first = (() => ({ mode, shape: block, ghost: insertAt !== undefined, whole: block === null && insertAt === undefined, at }))();
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
  let done = false;
  // nothing typed yet, so a new paragraph shows what it is for
  let blank = $state(ghost);

  // the text the block had when it opened, to tell an untouched source editor from a changed one
  const original = () => (whole ? source : block ? source.slice(block.start, block.end) : '');
  srcText = original();

  const tag = $derived(shape?.kind === 'heading' ? `h${(shape.token as Tokens.Heading).depth}` : shape?.kind === 'list' ? ((shape.token as Tokens.List).ordered ? 'ol' : 'ul') : 'p');
  const label = $derived(shape?.kind === 'heading' ? 'heading' : shape?.kind === 'list' ? 'list' : 'paragraph');

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
    if (!touched) return null;
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

  onMount(() => {
    // a finger that lands outside may be about to scroll, which the browser reports as a cancel, so a tap commits when it lifts
    let lift: number | null = null;
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if ((el ?? ta)?.contains(t) || t.closest?.('.fmt')) return;
      if (e.pointerType === 'touch') return void (lift = e.pointerId);
      finish(compute());
    };
    const up = (e: PointerEvent) => {
      if (lift !== e.pointerId) return;
      lift = null;
      finish(compute());
    };
    const cancel = (e: PointerEvent) => {
      if (lift === e.pointerId) lift = null;
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
    if (to && ((el ?? ta)?.contains(to) || to.closest?.('.fmt'))) return;
    setTimeout(() => {
      if (done || !document.hasFocus()) return;
      const now = document.activeElement;
      if (now && ((el ?? ta)?.contains(now) || now.closest('.fmt'))) return;
      finish(compute());
    }, 0);
  }

  // ---- rich ----

  function place(node: HTMLElement, c: Caret | null) {
    if (!c || c === 'end' || (typeof c === 'object' && 'find' in c)) return caretAt(node, Infinity);
    if (c === 'start') return caretAt(node, 0);
    if ('offset' in c) return caretAt(node, c.offset);
    let p: { x: number; y: number };
    if ('edge' in c) {
      const box = node.getBoundingClientRect();
      p = { x: c.x, y: c.edge === 'bottom' ? box.bottom - 4 : box.top + 4 };
    } else p = c as { x: number; y: number };
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
    reveal(root);
    return {
      destroy() {
        if (el === root) el = undefined;
      },
    };
  }

  const fmt = (kind: 'strong' | 'em' | 'del' | 'code' | 'link') => {
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
    const rest = toMarkdown([{ t: 'text', v: head.slice(pre[0].length) }, ...m.slice(1)]).trim();
    const found = blockFrom(`${pre[1]} ${rest}`);
    if (!found || (found.kind !== 'heading' && found.kind !== 'list')) return;
    caret = { offset: 0 };
    blank = !rest;
    shape = found;
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
    if (mod && !e.altKey) {
      // these also mean something to the page or the browser (search, bookmarks), so the editor keeps them
      if (k === 'b' && !e.shiftKey) (own(), fmt('strong'));
      else if (k === 'i' && !e.shiftKey) (own(), fmt('em'));
      else if (k === 'e' && !e.shiftKey) (own(), fmt('code'));
      else if (k === 'k' && !e.shiftKey) (own(), fmt('link'));
      else if (k === 'x' && e.shiftKey) (own(), fmt('del'));
      // nothing typed here yet, so the browser has nothing to take back: the edit before this one is what ⌘Z means
      else if (k === 'z' && !touched) (own(), finish(null), rewind(e.shiftKey));
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
    else if ((k === 'ArrowUp' || k === 'ArrowDown') && !e.shiftKey && !e.altKey && block) {
      // on the first or last line, the arrow goes on into the neighbouring block
      const up = k === 'ArrowUp';
      if (!atEdge(el, up ? 'top' : 'bottom')) return;
      const all = blocksOf(source);
      const i = all ? all.findIndex((b) => b.start === block.start) : -1;
      if (!all?.[up ? i - 1 : i + 1] || i < 0) return;
      own();
      const x = getSelection()?.getRangeAt(0).getClientRects()[0]?.left ?? el.getBoundingClientRect().left;
      finish(compute(), { to: up ? 'prev' : 'next', at: { edge: up ? 'bottom' : 'top', x } });
    }
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
    reveal(node);
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
    if (found?.length !== 1 || found[0].kind === 'source') return;
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
    if (e.key === 'Escape' || (mod && e.key === 'Enter')) (own(), finish(compute()));
    else if (mod && e.key === '/') (own(), toRich());
    else if (mod && !e.altKey && e.key.toLowerCase() === 'z' && compute() === null) (own(), finish(null), rewind(e.shiftKey));
    else if (e.key === 'Tab') (own(), indent(e.shiftKey));
    else if (mod && !e.altKey && !e.shiftKey && 'kbie'.includes(e.key.toLowerCase())) own();
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.shiftKey && !e.altKey && block && ta) {
      // at the very start or end of the text the arrow goes on into the neighbouring block, as in the rich editor
      const up = e.key === 'ArrowUp';
      const end = up ? 0 : ta.value.length;
      if (ta.selectionStart !== end || ta.selectionEnd !== end) return;
      const all = blocksOf(source);
      const i = all ? all.findIndex((b) => b.start === block.start) : -1;
      if (i < 0 || !all?.[up ? i - 1 : i + 1]) return;
      own();
      finish(compute(), { to: up ? 'prev' : 'next', at: { edge: up ? 'bottom' : 'top', x: ta.getBoundingClientRect().left } });
    }
  }

  const files = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) over(e);
  };
</script>

{#if view === 'source'}
  <textarea use:src class="editing-src" class:code={block?.token.type === 'code' || block?.token.type === 'table'} rows="1" spellcheck="false" data-gramm="false" aria-label="Edit markdown source" onkeydown={srcKey} oninput={() => ta && size(ta)} onfocusout={leave} ondragover={files} ondrop={files}></textarea>
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
  <Bubble root={() => el} onmark={fmt} heading={shape?.kind === 'heading'} />
{/if}
