// Frames of a progress bar that arrive as separate lines (tqdm without a terminal, Keras and friends).
const BAR = /\d{1,3}%\|.*\|\s*\d+\/\d+|^\s*\d+\/\d+ \[|^Epoch \d+\/\d+.*\d+\/\d+/;

/** Drops every frame of a progress bar except the last of each run. */
export function foldBars(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (BAR.test(lines[i]) && i + 1 < lines.length && BAR.test(lines[i + 1])) continue;
    out.push(lines[i]);
  }
  return out.length === lines.length ? text : out.join('\n');
}

/** A text output past LIMIT lines keeps its first HEAD and last TAIL lines; the middle sits behind one row. */
export const LIMIT = 24;
export const HEAD = 12;
export const TAIL = 8;
