import type { Cell } from './notebook';
import { outline } from './outline';
import { isName, scan, type Facts } from './scan';
import { ui, jump } from './ui.svelte';
import './trace.css';

// Name tracing: click a name in the code and every cell that defines it or uses it wears a ring, with the name
// itself marked in the code and a dot on the rail beside each chapter it appears in.

export interface Trace {
  name: string;
  /** Cells that define the name, in notebook order. */
  def: string[];
  /** Cells that only use it. */
  use: string[];
}

const known = new Map<string, Facts>();
const facts = (source: string, language: string | null) => {
  const key = `${language}\0${source}`;
  let f = known.get(key);
  if (!f) known.set(key, (f = scan(source, language)));
  return f;
};

export function find(cells: readonly Cell[], name: string, language: string | null): Trace {
  const def: string[] = [];
  const use: string[] = [];
  for (const c of cells) {
    if (c.type !== 'code') continue;
    const f = facts(c.source, language);
    if (f.defs.has(name)) def.push(c.id);
    else if (f.uses.has(name)) use.push(c.id);
  }
  return { name, def, use };
}

/** The name under a click, when the click landed on one in a code box. */
function wordAt(e: MouseEvent): string | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let node: Node | null | undefined;
  let at = 0;
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(e.clientX, e.clientY);
    (node = p?.offsetNode), (at = p?.offset ?? 0);
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(e.clientX, e.clientY);
    (node = r?.startContainer), (at = r?.startOffset ?? 0);
  }
  if (node?.nodeType !== Node.TEXT_NODE || !node.parentElement?.closest('.src')) return null;
  const text = node.textContent ?? '';
  let a = at;
  let b = at;
  while (a > 0 && /\w/.test(text[a - 1])) a--;
  while (b < text.length && /\w/.test(text[b])) b++;
  const word = text.slice(a, b);
  if (!isName(word) || text[a - 1] === '.') return null;
  // the caret snaps to the nearest gap, so the click has to be on the word itself
  const range = document.createRange();
  range.setStart(node, a);
  range.setEnd(node, b);
  const hit = [...range.getClientRects()].some((r) => e.clientX >= r.left - 1 && e.clientX <= r.right + 1 && e.clientY >= r.top - 1 && e.clientY <= r.bottom + 1);
  return hit ? word : null;
}

// What each chapter tick on the rail should show, kept from the moment the trace began.
let ticks: (('def' | 'use') | undefined)[] = [];
let watching: MutationObserver | undefined;
let queued = 0;

function chapters(cells: readonly Cell[], t: Trace) {
  const heads = outline(cells).headings;
  const out: (('def' | 'use') | undefined)[] = heads.map(() => undefined);
  const mark = new Map<string, 'def' | 'use'>([...t.use.map((id) => [id, 'use'] as const), ...t.def.map((id) => [id, 'def'] as const)]);
  // a cell belongs to the last heading at or before it
  const last = new Map(heads.map((h, i) => [h.cell, i]));
  let chapter = -1;
  for (const c of cells) {
    chapter = last.get(c.id) ?? chapter;
    const m = mark.get(c.id);
    if (chapter >= 0 && m && out[chapter] !== 'def') out[chapter] = m;
  }
  return out;
}

/** Marks every appearance of a name inside one code box. */
function marks(code: Element, name: string, into: Range[]) {
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  const word = new RegExp(`${name}(?!\\w)`, 'g');
  let before = '';
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = n.textContent ?? '';
    for (const m of text.matchAll(word)) {
      const prev = m.index! > 0 ? text[m.index! - 1] : before;
      if (/[\w.]/.test(prev)) continue;
      const r = document.createRange();
      r.setStart(n, m.index!);
      r.setEnd(n, m.index! + name.length);
      into.push(r);
    }
    before = text.slice(-1) || before;
  }
}

function paint() {
  const t = ui.trace;
  document.querySelectorAll('.t-def, .t-use').forEach((el) => el.classList.remove('t-def', 't-use'));
  document.querySelectorAll('.rail .tr[data-t]').forEach((el) => el.removeAttribute('data-t'));
  CSS.highlights?.delete('trace');
  if (!t) return;
  const ranges: Range[] = [];
  for (const [ids, kind] of [[t.use, 't-use'], [t.def, 't-def']] as const) {
    for (const id of ids) {
      const el = document.querySelector(`.notebook > [data-cell="${CSS.escape(id)}"]`);
      el?.classList.add(kind);
      el?.querySelectorAll('.src code').forEach((code) => marks(code, t.name, ranges));
    }
  }
  if (ranges.length && typeof Highlight !== 'undefined') CSS.highlights.set('trace', new Highlight(...ranges));
  const rows = document.querySelectorAll('.rail .tr');
  ticks.forEach((kind, i) => kind && rows[i]?.setAttribute('data-t', kind));
}

const later = () => queued || (queued = requestAnimationFrame(() => ((queued = 0), paint())));

export function start(cells: readonly Cell[], language: string | null, name: string) {
  const t = find(cells, name, language);
  ui.trace = t;
  ticks = chapters(cells, t);
  // the code arrives highlighted a little after it arrives, and cells keep coming while a file is read in
  watching ??= new MutationObserver(later);
  watching.observe(document.querySelector('.notebook')!, { childList: true, subtree: true });
  paint();
}

export function clear() {
  ui.trace = null;
  watching?.disconnect();
  cancelAnimationFrame(queued);
  queued = 0;
  paint();
}

/** A click on a name traces it; a second click on the same name lets go. */
export function onClick(e: MouseEvent, cells: readonly Cell[], language: string | null) {
  // a drag that selected something is the reader copying, not asking
  if (!getSelection()?.isCollapsed) return;
  const name = wordAt(e);
  if (!name) return;
  if (ui.trace?.name === name) clear();
  else start(cells, language, name);
}

/** The keyboard way in: select a name, then press the key. */
export function fromSelection(cells: readonly Cell[], language: string | null) {
  const s = getSelection();
  const name = s?.toString().trim() ?? '';
  if (!isName(name) || !s?.anchorNode?.parentElement?.closest('.src')) return;
  start(cells, language, name);
}

/** Moves to the next or previous cell the trace has marked, wrapping at the ends. */
export function step(dir: 1 | -1) {
  const list = [...document.querySelectorAll<HTMLElement>('.notebook > .t-def, .notebook > .t-use')];
  if (!list.length) return;
  const to = dir > 0 ? list.find((c) => c.getBoundingClientRect().top > 100) : list.findLast((c) => c.getBoundingClientRect().top < 80);
  jump(to ?? (dir > 0 ? list[0] : list[list.length - 1]));
}
