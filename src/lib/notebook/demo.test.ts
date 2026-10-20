import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseNotebook, type CodeCell, type Output } from './index';
import { outline } from '../outline';
import { foldBars, LIMIT } from '../streams';
import { calm } from '../trace';
import { tables } from '../tabular';
import { long, over } from '../long';
import { findSecrets } from '../insight/secrets';
import { needs } from '../insight/needs';
import { weigh } from '../insight/weight';

// The example notebook is also the demo behind "Open Demo". Each test names a feature of the viewer and the part of the
// notebook that triggers it, so a regeneration that drops one fails here. The checks are the viewer's own functions.
// See tools/brand/README.md for the same list as a table.
const path = 'examples/cooling-coffee.ipynb';
const text = readFileSync(path, 'utf8');
const nb = parseNotebook(text);
const code = nb.cells.filter((c): c is CodeCell => c.type === 'code');
const outputs: Output[] = code.flatMap((c) => c.outputs);
const bundles = outputs.flatMap((o) => (o.type === 'display' || o.type === 'result' ? [o.data] : []));
const streams = outputs.flatMap((o) => (o.type === 'stream' ? [o] : []));

describe('the demo notebook', () => {
  it('stays small enough to open instantly, and the served copy matches', () => {
    expect(Buffer.byteLength(text)).toBeLessThan(400_000);
    expect(readFileSync('public/cooling-coffee.ipynb', 'utf8')).toBe(text);
  });

  it('runs in order, so no cell looks out of place', () => {
    const counts = code.map((c) => c.executionCount);
    expect(counts).toEqual(counts.map((_, i) => i + 1));
  });

  it('gives the contents rail chapters and sub-chapters', () => {
    const o = outline(nb.cells);
    expect(o.top).toBe(1);
    expect(o.headings.length).toBeGreaterThanOrEqual(8);
    expect(new Set(o.headings.map((h) => h.depth)).size).toBeGreaterThanOrEqual(3);
  });

  it('fills the figures shelf with several pictures, and has one vector output', () => {
    expect(bundles.filter((d) => 'image/png' in d).length).toBeGreaterThanOrEqual(4);
    expect(bundles.filter((d) => 'image/svg+xml' in d).length).toBe(1);
    expect(outline(nb.cells).figures.length).toBeGreaterThanOrEqual(4);
  });

  it('writes figure descriptions, not a bare "Figure size"', () => {
    for (const d of bundles.filter((d) => 'image/png' in d)) expect(String(d['text/plain'])).not.toMatch(/^<Figure/);
  });

  it('typesets inline and display math, including an aligned block', () => {
    const md = nb.cells.filter((c) => c.type === 'markdown').map((c) => c.source).join('\n');
    expect(md).toMatch(/\$\$/);
    expect(md).toMatch(/\\begin\{align\}/);
    expect(md).toMatch(/\| Symbol \|/);
    expect(md).toMatch(/- \[x\]/);
  });

  it('has an HTML frame long enough to sort, and a printed frame that becomes a table', () => {
    const html = bundles.map((d) => d['text/html']).find((h) => typeof h === 'string') as string;
    expect(html.match(/<tr/g)!.length).toBeGreaterThan(10);
    const printed = streams.map((s) => s.text).find((t) => /minute\s+ceramic/.test(t))!;
    expect(tables(printed)).not.toBeNull();
  });

  it('folds a progress bar to its last frame', () => {
    const bar = streams.find((s) => s.name === 'stderr')!.text;
    const folded = foldBars(bar);
    expect(folded.split('\n').length).toBeLessThan(bar.split('\n').length);
    expect(folded).toContain('100%');
  });

  it('colours output with ANSI, and folds a long listing', () => {
    expect(streams.some((s) => s.text.includes('\u001b['))).toBe(true);
    expect(streams.some((s) => over(s.text.replace(/\s+$/, ''), LIMIT))).toBe(true);
  });

  it('calms a long traceback down to the cell that failed', () => {
    const err = outputs.find((o) => o.type === 'error');
    expect(err?.type === 'error' && calm(err.traceback)).toHaveLength(2);
  });

  it('draws a markdown output', () => {
    expect(bundles.some((d) => 'text/markdown' in d)).toBe(true);
  });

  it('has cells that earn a fold handle, both long code and long output', () => {
    expect(code.filter(long).length).toBeGreaterThanOrEqual(4);
    expect(code.some((c) => over(c.source.replace(/\s+$/, ''), 10))).toBe(true);
  });

  it('gives the insights sheet something to say', () => {
    const hits = findSecrets(nb.cells);
    expect(hits.some((h) => h.tier === 'secret')).toBe(true);
    expect(hits.some((h) => h.tier === 'personal')).toBe(true);
    const n = needs(nb.cells, nb);
    expect(n.installs).toContain('tqdm');
    expect(n.packages).toEqual(expect.arrayContaining(['numpy', 'pandas', 'matplotlib']));
    expect(weigh(nb.cells).images).toBeGreaterThan(100_000);
  });

  it('keeps the made-up token from looking like a real provider key', () => {
    expect(text).not.toMatch(/\b(?:sk-|AKIA|ghp_|xox[abprs]-|AIza)/);
  });
});
