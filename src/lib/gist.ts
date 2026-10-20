import { collapseCarriageReturns, stripAnsi, type Output } from './notebook';
import { describeData } from './mime';


function line(o: Output): string {
  if (o.type === 'error') return `${o.ename}: ${o.evalue}`;
  if (o.type === 'stream') return collapseCarriageReturns(o.text);
  const s = describeData(o.data);
  return s.kind === 'image' ? 'Figure' : s.chart ? 'Interactive output' : (s.md ?? s.text);
}

/** One line that says what a folded output holds, with a count when there are more. */
export function gist(outputs: readonly Output[]): string {
  const all = outputs.map((o) => stripAnsi(line(o)).trim().split('\n')[0]).filter(Boolean);
  return all.length ? all[0] + (all.length > 1 ? `  +${all.length - 1}` : '') : 'Output';
}

/** Says what was left out of an output and why. With a plain-text version on hand, that text is shown instead. */
export function richNote(mime: string, hasText: boolean): string {
  const [what, why] =
    mime === 'text/html'
      ? ['HTML', 'only plain markup and tables are shown, and scripts stay off']
      : mime === 'image/svg+xml'
        ? ['SVG', 'could not be read']
        : /widget|plotly|bokeh|vega/.test(mime)
          ? ['Interactive output', 'notebooks are never run here']
          : [mime, 'not supported'];
  return `${hasText ? 'Text version shown' : what + ' not shown'}${hasText ? ` (${what}: ${why})` : ` (${why})`}`;
}
