import './tbl.css';
// Plain-text frames (what print(df) writes) become real tables when their columns line up.
export interface Block {
  head: string[];
  rows: string[][];
  /** Index of the line after the last row. */
  end: number;
}

const NUM = /^[-+]?(?:\d[\d,]*\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$|^(?:[-+]?inf|NaN|NaT|True|False|None)$/i;
// Wide frames wrap with a trailing backslash.
const WRAP = / \\$/;
// The line pandas adds under a frame it has truncated.
const FOOT = /^\[([\d,]+) rows? x ([\d,]+) columns?\]$/;
export const isNum = (s: string) => NUM.test(s.trim());

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Reads a pandas-style block whose header starts on line `at`: columns are right-aligned under their names. */
export function block(lines: string[], at: number): Block | null {
  const header = lines[at].replace(WRAP, '');
  if (!/^\s+\S/.test(header)) return null;
  const cols = [...header.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ text: m[0], end: m.index + m[0].length }));
  if (!cols.length || cols.length > 60) return null;

  const rows: string[][] = [];
  let at2 = at + 1;
  for (; at2 < lines.length; at2++) {
    const line = lines[at2].replace(WRAP, '');
    const lead = /^\S.*?(?=\s{2,}|$)/.exec(line);
    if (!lead || line.length > cols[cols.length - 1].end || lead[0].length > cols[0].end) break;
    let ok = true;
    for (let k = 0; k < cols.length - 1 && ok; k++) ok = !line[cols[k].end] || line[cols[k].end] === ' ';
    if (!ok) break;
    const cells = [lead[0]];
    let from = lead[0].length;
    for (const c of cols) {
      cells.push(line.slice(from, c.end).trim());
      from = c.end;
    }
    if (!cells.slice(1).some(Boolean)) break;
    rows.push(cells);
  }
  const counted = rows.every((r) => /^\d+$/.test(r[0]));
  if (!rows.length || (!counted && (rows.length < 2 || cols.length < 2))) return null;
  return { head: cols.map((c) => c.text), rows, end: at2 };
}

function html({ head, rows }: Block): string {
  // A column is numeric when every cell of it is.
  const num = head.map((_, k) => rows.every((r) => isNum(r[k + 1])));
  const th = (t: string, k: number) => `<th${num[k] ? ' class="n"' : ''}>${escape(t)}</th>`;
  return (
    `<div class="tbl"><table><thead><tr><th></th>${head.map(th).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr><th scope="row">${escape(r[0])}</th>${r.slice(1).map((c, k) => `<td${num[k] ? ' class="n"' : ''}>${escape(c)}</td>`).join('')}</tr>`).join('') +
    '</tbody></table></div>'
  );
}

/** The text as HTML with each table block turned into a table, or null when it holds none. */
export function tables(text: string): string | null {
  if (text.length > 400_000) return null;
  const lines = text.split('\n');
  let out = '';
  let pending: string[] = [];
  let found = false;
  const flush = () => {
    const t = pending.join('\n').replace(/^\n+|\s+$/g, '');
    if (t) out += `<pre>${escape(t)}</pre>`;
    pending = [];
  };
  for (let i = 0; i < lines.length; ) {
    const b = block(lines, i);
    const foot = found && !b ? FOOT.exec(lines[i].trim()) : null;
    if (b) {
      flush();
      out += html(b);
      found = true;
      i = b.end;
    } else if (foot) {
      flush();
      out += `<p class="foot">${foot[1]} rows × ${foot[2]} columns</p>`;
      i++;
    } else pending.push(lines[i++]);
  }
  flush();
  return found ? out : null;
}
