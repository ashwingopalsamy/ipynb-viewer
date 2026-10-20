import type { Cell } from './notebook';
import { outText } from './copytext';

// Searching the notebook as the reader gave it, not the page: cells draw their text and outputs only as they come
// near the screen, so the browser's own find sees just part of a long notebook.

export interface Hit {
  cell: string;
  kind: 'Text' | 'Code' | 'Output';
  n: number | null;
  before: string;
  match: string;
  after: string;
}

export const LIMIT = 60;
const SPAN = 44;
const tidy = (s: string) => s.replace(/\s+/g, ' ');
/** A cell's text is read once; a long log is searched as far as this many characters. */
const REACH = 300_000;

interface Part {
  kind: Hit['kind'];
  text: string;
  low: string;
}
const known = new WeakMap<Cell, Part[]>();

function parts(cell: Cell): Part[] {
  let list = known.get(cell);
  if (!list) {
    const make = (kind: Hit['kind'], text: string): Part => ({ kind, text: text.slice(0, REACH), low: text.slice(0, REACH).toLowerCase() });
    list = [make(cell.type === 'code' ? 'Code' : 'Text', cell.source)];
    if (cell.type === 'code' && cell.outputs.length) list.push(make('Output', outText(cell.outputs)));
    known.set(cell, list);
  }
  return list;
}

function part(cell: Cell, p: Part, q: string, found: Hit[]) {
  const at = p.low.indexOf(q);
  if (at < 0) return;
  found.push({
    cell: cell.id,
    kind: p.kind,
    n: cell.type === 'code' ? cell.executionCount : null,
    before: tidy(p.text.slice(Math.max(0, at - SPAN), at)).trimStart(),
    match: p.text.slice(at, at + q.length),
    after: tidy(p.text.slice(at + q.length, at + q.length + SPAN * 2)).trimEnd(),
  });
}

/** The cells that hold `query`, in reading order: at most one hit for the text, one for the code and one for the output of each. */
export function search(cells: readonly Cell[], query: string): { hits: Hit[]; more: boolean } {
  const q = query.trim().toLowerCase();
  const hits: Hit[] = [];
  if (q.length < 2) return { hits, more: false };
  for (const cell of cells) {
    if (hits.length > LIMIT) break;
    for (const p of parts(cell)) part(cell, p, q, hits);
  }
  return { hits: hits.slice(0, LIMIT), more: hits.length > LIMIT };
}

const ranges = (root: Element, q: string): Range[] => {
  const found: Range[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('.gutter, .acts, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const text = node.textContent!.toLowerCase();
    for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) {
      const r = document.createRange();
      r.setStart(node, at);
      r.setEnd(node, at + q.length);
      found.push(r);
    }
  }
  return found;
};

let timers: ReturnType<typeof setTimeout>[] = [];

export function clear() {
  timers.forEach(clearTimeout);
  timers = [];
  CSS.highlights?.delete('find');
}

/**
 * Marks the query in a cell once the cell is on the page. The cell may still be drawing its text and its colours,
 * which replace the nodes, so the marks are laid again a little later.
 */
export function mark(id: string, query: string) {
  clear();
  const q = query.trim().toLowerCase();
  if (!CSS.highlights || q.length < 2) return;
  const lay = () => {
    const root = document.querySelector(`[data-cell="${CSS.escape(id)}"]`);
    const found = root ? ranges(root, q) : [];
    if (found.length) CSS.highlights.set('find', new Highlight(...found));
    return found;
  };
  for (const wait of [250, 700, 1500]) timers.push(setTimeout(lay, wait));
}
