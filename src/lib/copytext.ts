import { collapseCarriageReturns, stripAnsi, type Output } from './notebook';
import { describeData } from './mime';
import { foldBars } from './streams';

const asText = (o: Output): boolean => {
  if (o.type === 'stream') return !!o.text.trim();
  if (o.type === 'error') return true;
  const s = describeData(o.data);
  return s.kind === 'text' && !!s.text.trim();
};

/** True when at least one output is text a reader would want on the clipboard (a figure on its own is not). */
export const copyable = (outputs: readonly Output[]) => outputs.some(asText);

/** The outputs as plain text, in order, with the whole of every stream and traceback, folded or not. */
export function outText(outputs: readonly Output[]): string {
  const parts: string[] = [];
  for (const o of outputs) {
    if (!asText(o)) continue;
    if (o.type === 'stream') parts.push(foldBars(collapseCarriageReturns(o.text)));
    else if (o.type === 'error') parts.push([`${o.ename}: ${stripAnsi(o.evalue)}`, ...o.traceback.map(stripAnsi)].join('\n'));
    else {
      const s = describeData(o.data);
      if (s.kind === 'text') parts.push(s.text);
    }
  }
  return stripAnsi(parts.join('\n')).replace(/\s+$/, '');
}
