// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

export function stripAnsi(text: string): string {
  return text.includes('\u001b') ? text.replace(ANSI, '') : text;
}

/**
 * Applies terminal semantics for \r (return to column 0) and \b (step back),
 * so progress bars end up as the line a terminal would show.
 */
export function collapseCarriageReturns(text: string): string {
  if (!text.includes('\r') && !text.includes('\b')) return text;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('\r') && !line.includes('\b')) continue;
    const out: string[] = [];
    let col = 0;
    for (const ch of line) {
      if (ch === '\r') col = 0;
      else if (ch === '\b') col = Math.max(0, col - 1);
      else out[col++] = ch;
    }
    lines[i] = Array.from(out, (c) => c ?? ' ').join('');
  }
  return lines.join('\n');
}
