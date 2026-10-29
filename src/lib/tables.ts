// Tables in outputs (a pandas frame, a printed table) sort when a column header is clicked, and copy as CSV.

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const value = (row: HTMLTableRowElement, col: number) => row.cells[col]?.textContent?.trim() ?? '';
const parse = (s: string) => {
  const t = s.replace(/[,\s$€£%]/g, '');
  return NUMBER.test(t) ? parseFloat(t) : NaN;
};

/** Blanks last, numbers as numbers, anything else as words with embedded numbers in order (item 2 before item 10). */
export function cmp(x: string, y: string, dir: 1 | -1): number {
  if (!x !== !y) return x ? -1 : 1;
  const nx = parse(x);
  const ny = parse(y);
  if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * dir;
  return x.localeCompare(y, undefined, { numeric: true }) * dir;
}

/** Orders the rows by the clicked column: ascending, descending, then back as they came. Numbers sort as numbers. */
export function sort(th: HTMLTableCellElement) {
  const table = th.closest('table');
  const body = table?.tBodies[0];
  if (!table || !body || !th.closest('thead') || body.rows.length < 3) return;
  const rows = [...body.rows];
  rows.forEach((r, i) => (r.dataset.at ??= String(i)));
  const was = th.getAttribute('aria-sort');
  table.querySelectorAll('[aria-sort]').forEach((h) => h.removeAttribute('aria-sort'));
  const next = was === 'ascending' ? 'descending' : was === 'descending' ? null : 'ascending';
  const dir = next === 'descending' ? -1 : 1;
  rows.sort((a, b) => {
    if (!next) return Number(a.dataset.at) - Number(b.dataset.at);
    return cmp(value(a, th.cellIndex), value(b, th.cellIndex), dir);
  });
  if (next) th.setAttribute('aria-sort', next);
  body.append(...rows);
}

const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export const csv = (rows: readonly (readonly string[])[]) => rows.map((r) => r.map(quote).join(',')).join('\n') + '\n';

const toCsv = (table: HTMLTableElement) => csv([...table.rows].map((r) => [...r.cells].map((c) => c.textContent?.trim() ?? '')));

/** The button rows, each with the table it copies. */
const owners = new WeakMap<Element, HTMLTableElement>();

/** What a table's button row follows: the table's frame, and the line of row and column counts under it when there is one. */
function above(table: HTMLTableElement) {
  const frame = table.closest('.tbl') ?? table;
  return frame.nextElementSibling?.matches('.foot') ? frame.nextElementSibling : frame;
}

/** A quiet "Copy as CSV" button in a row under a table of four rows or more, never over its data. */
export function offer(table: HTMLTableElement) {
  const at = above(table);
  const next = at.nextElementSibling;
  if (!at.parentElement || (next && owners.get(next) === table) || table.rows.length < 4 || table.parentElement?.closest('table')) return;
  const row = document.createElement('div');
  row.className = 'csv-row';
  const b = document.createElement('button');
  b.className = 'csv';
  b.textContent = 'Copy as CSV';
  b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(table));
      b.textContent = 'Copied';
    } catch {
      b.textContent = 'Could not copy';
    }
    setTimeout(() => (b.textContent = 'Copy as CSV'), 1600);
  };
  row.append(b);
  owners.set(row, table);
  at.after(row);
}

/** Gives every table under `root` its button, and takes away the button of a table that has since been drawn again. */
export function sweep(root: ParentNode) {
  for (const row of root.querySelectorAll('.csv-row')) {
    const table = owners.get(row);
    if (!table?.isConnected || above(table).nextElementSibling !== row) row.remove();
  }
  for (const table of root.querySelectorAll('table')) offer(table);
}
