import type { Inline } from './inline';
import type { MimeBundle } from '../notebook';
import { LINKS } from '../guard';
import { renderInline } from '../markdown';

// The editor shows the inline model as ordinary elements and reads it back after every kind of browser edit.
// An element that survives remembers the node it was made from, so an untouched mark keeps the text it was written with.
const origin = new WeakMap<Node, Inline>();

const MARKS = { strong: 'strong', em: 'em', del: 'del' } as const;

/** The model as DOM. Text keeps its soft line breaks as \n, which the editor shows as spaces, as the page does. */
export function toDom(nodes: Inline[], doc: Document, attachments: Record<string, MimeBundle> = {}): DocumentFragment {
  const out = doc.createDocumentFragment();
  for (const n of nodes) {
    let el: Node;
    if (n.t === 'text') el = doc.createTextNode(n.v);
    else if (n.t === 'br') el = doc.createElement('br');
    else if (n.t === 'code') {
      el = doc.createElement('code');
      el.textContent = n.v;
    } else if (n.t === 'atom') {
      // math, pictures and markup the editor cannot change are kept whole
      const chip = doc.createElement('span');
      chip.className = 'atom';
      chip.contentEditable = 'false';
      const html = renderInline(n.raw, attachments);
      if (/<img\b|class="math/.test(html) || html.replace(/<[^>]*>/g, '').trim()) chip.innerHTML = html;
      else {
        chip.textContent = n.raw;
        chip.classList.add('raw');
      }
      el = chip;
    } else if (n.t === 'link') {
      const a = doc.createElement('a');
      if (LINKS.test(n.href)) a.setAttribute('href', n.href);
      a.dataset.href = n.href;
      a.append(toDom(n.c, doc, attachments));
      el = a;
    } else {
      el = doc.createElement(MARKS[n.t]);
      el.appendChild(toDom(n.c, doc, attachments));
    }
    origin.set(el, n);
    out.append(el);
  }
  return out;
}

// The browser pads with non-breaking spaces where a space would collapse; a real one stays.
const tidy = (s: string) => s.replace(/​/g, '').replace(/ /g, (_, i: number) => (i === 0 || i === s.length - 1 || s[i - 1] === ' ' || s[i + 1] === ' ' ? ' ' : ' '));

function marks(el: HTMLElement): ('strong' | 'em' | 'del')[] {
  const out: ('strong' | 'em' | 'del')[] = [];
  const { fontWeight, fontStyle, textDecoration, textDecorationLine } = el.style;
  if (fontWeight === 'bold' || +fontWeight >= 600) out.push('strong');
  if (fontStyle === 'italic') out.push('em');
  if ((textDecorationLine || textDecoration).includes('line-through')) out.push('del');
  return out;
}

function walk(parent: Node, into: Inline[]) {
  for (const child of parent.childNodes) {
    if (child.nodeType === 3) {
      into.push({ t: 'text', v: tidy((child as Text).data) });
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;
    const was = origin.get(child);
    const tag = child.tagName;
    if (tag === 'BR') into.push(was?.t === 'br' ? { t: 'br', raw: was.raw } : { t: 'br' });
    else if (child.classList.contains('atom')) {
      if (was?.t === 'atom') into.push(was);
      else if (child.textContent) into.push({ t: 'text', v: child.textContent });
    } else if (tag === 'CODE') {
      const v = child.textContent ?? '';
      into.push(was?.t === 'code' && was.v === v ? { t: 'code', v, raw: was.raw, sig: was.sig } : { t: 'code', v });
    } else if (tag === 'A') {
      const c: Inline[] = [];
      walk(child, c);
      const href = child.getAttribute('href') ?? child.dataset.href ?? '';
      const same = was?.t === 'link' && was.href === href;
      into.push({ t: 'link', href, title: was?.t === 'link' ? was.title : null, c, ...(same ? { raw: was.raw, sig: was.sig } : {}) });
    } else {
      const kinds: ('strong' | 'em' | 'del')[] =
        tag === 'B' || tag === 'STRONG' ? ['strong'] : tag === 'I' || tag === 'EM' ? ['em'] : tag === 'S' || tag === 'STRIKE' || tag === 'DEL' ? ['del'] : tag === 'SPAN' || tag === 'FONT' ? marks(child) : [];
      if (tag === 'DIV' || tag === 'P') {
        // a line the browser wrapped in its own block
        if (into.length) into.push({ t: 'br' });
        walk(child, into);
      } else if (kinds.length) {
        const c: Inline[] = [];
        walk(child, c);
        let node: Inline = { t: kinds[kinds.length - 1], c } as Inline;
        const keep = was && was.t === node.t ? was : null;
        if (keep && (keep.t === 'strong' || keep.t === 'em' || keep.t === 'del')) node = { ...node, raw: keep.raw, sig: keep.sig } as Inline;
        for (let i = kinds.length - 2; i >= 0; i--) node = { t: kinds[i], c: [node] } as Inline;
        into.push(node);
      } else walk(child, into);
    }
  }
}

function tidyUp(nodes: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (n.t === 'text') {
      if (!n.v) continue;
      const last = out[out.length - 1];
      if (last?.t === 'text') last.v += n.v;
      else out.push({ t: 'text', v: n.v });
    } else if (n.t === 'strong' || n.t === 'em' || n.t === 'del' || n.t === 'link') {
      const c = tidyUp(n.c);
      if (c.length) out.push({ ...n, c } as Inline);
    } else if (n.t === 'code' && !n.v) continue;
    else out.push(n);
  }
  return out;
}

/** What the editor holds, read back as the model. The placeholder break a browser leaves at the end of a line is not text. */
export function fromDom(root: Node): Inline[] {
  const nodes: Inline[] = [];
  walk(root, nodes);
  const out = tidyUp(nodes);
  while (out[out.length - 1]?.t === 'br') out.pop();
  return out;
}

const COMMANDS = { strong: 'bold', em: 'italic', del: 'strikeThrough' } as const;

/** Applies or removes a mark on the selection, through the browser's own commands where it has them so undo keeps working. */
export function mark(root: HTMLElement, kind: 'strong' | 'em' | 'del' | 'code' | 'link', warn: (text: string) => void = () => {}): boolean {
  const sel = getSelection();
  if (!sel?.rangeCount || !root.contains(sel.anchorNode)) return false;
  if (kind !== 'code' && kind !== 'link') return document.execCommand(COMMANDS[kind]);
  const range = sel.getRangeAt(0);
  if (kind === 'code') {
    const inside = (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode!.parentElement)?.closest('code');
    if (inside && root.contains(inside)) {
      inside.replaceWith(...inside.childNodes);
      return true;
    }
    if (range.collapsed) return false;
    const code = document.createElement('code');
    code.append(range.extractContents());
    range.insertNode(code);
    sel.selectAllChildren(code);
    return true;
  }
  const at = (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode!.parentElement)?.closest('a');
  if (range.collapsed && !at) return false;
  const saved = range.cloneRange();
  const url = prompt('Link', at?.getAttribute('href') ?? '');
  if (url === null) return false;
  sel.removeAllRanges();
  sel.addRange(saved);
  if (url.trim() === '') return document.execCommand('unlink');
  if (!LINKS.test(url.trim())) {
    warn('That link was not added: only web, mail and in-page links are allowed.');
    return false;
  }
  return document.execCommand('createLink', false, url.trim());
}

const sized = (n: Node): n is HTMLElement => n instanceof HTMLElement && (n.classList.contains('atom') || n.tagName === 'BR');

/** How many caret positions `n` spans: a character each, and an atom or a break as one. */
const span = (n: Node): number => {
  if (n.nodeType === 3) return (n as Text).length;
  if (sized(n)) return 1;
  let sum = 0;
  for (const c of n.childNodes) sum += span(c);
  return sum;
};

/** Where the caret is, in the same units `caretAt` takes. */
export function textOffset(root: Node): number {
  const sel = getSelection();
  if (!sel?.rangeCount) return 0;
  const head = document.createRange();
  head.selectNodeContents(root);
  head.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  return span(head.cloneContents());
}

/** Puts the caret `offset` positions into `root`, or at its end when that is past the end. */
export function caretAt(root: Node, offset: number) {
  const sel = getSelection();
  if (!sel) return;
  const r = document.createRange();
  let left = offset;
  const find = (n: Node): boolean => {
    if (n.nodeType === 3) {
      const len = (n as Text).length;
      if (left <= len) return r.setStart(n, left), true;
      left -= len;
      return false;
    }
    if (sized(n)) {
      if (left <= 0) return r.setStartBefore(n), true;
      left -= 1;
      return false;
    }
    for (const c of n.childNodes) if (find(c)) return true;
    return false;
  };
  if (!find(root)) {
    r.selectNodeContents(root);
    r.collapse(false);
  }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** The text position under a point on the page, or null where there is none. */
export function pointAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return { node: pos.offsetNode, offset: pos.offset };
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/** True when the caret is on the first (or last) visual line of `root`, so an arrow key would leave it. */
export function atEdge(root: HTMLElement, edge: 'top' | 'bottom'): boolean {
  const sel = getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0).cloneRange();
  let box = range.getClientRects()[0];
  if (!box) {
    const near = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    box = (near ?? root).getBoundingClientRect();
  }
  const rect = root.getBoundingClientRect();
  const line = box.height || 20;
  return edge === 'top' ? box.top - rect.top < line * 0.75 : rect.bottom - box.bottom < line * 0.75;
}
