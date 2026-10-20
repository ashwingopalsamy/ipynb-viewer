import { describe, expect, it } from 'vitest';
import type { Cell, NotebookMeta } from '../notebook';
import { parseNotebook } from '../notebook';
import { clean, weigh } from './weight';

const PNG = 'A'.repeat(4000);
const cells = [
  { id: 'm', type: 'markdown', source: '# Hi', metadata: {}, attachments: {} },
  { id: 'c1', type: 'code', source: 'plot()', metadata: { tags: ['x'] }, executionCount: 1, outputs: [{ type: 'display', data: { 'image/png': PNG, 'text/plain': '<Figure>' }, metadata: {} }] },
  { id: 'c2', type: 'code', source: 'print(1)', metadata: {}, executionCount: 2, outputs: [{ type: 'stream', name: 'stdout', text: '1\n' }] },
] as unknown as Cell[];
const meta = { nbformat: 4, nbformatMinor: 5, metadata: { kernelspec: { name: 'python3' } }, language: 'python', kernel: 'Python 3' } as NotebookMeta;

describe('weigh', () => {
  it('counts pictures apart from the rest and names the heaviest output', () => {
    const w = weigh(cells);
    expect(w.images).toBe(3000);
    expect(w.heavy[0]).toMatchObject({ cell: 'c1', n: 1, what: 'PNG' });
    expect(w.total).toBe(w.source + w.outputs);
  });
});

describe('clean', () => {
  it('drops every output and the counts', () => {
    const back = parseNotebook(clean(cells, meta, 'outputs'));
    expect(back.cells.length).toBe(3);
    expect(back.cells[1]).toMatchObject({ type: 'code', executionCount: null, outputs: [], metadata: { tags: ['x'] } });
  });
  it('drops only pictures and keeps the text beside them', () => {
    const back = parseNotebook(clean(cells, meta, 'images'));
    const o = (back.cells[1] as Extract<Cell, { type: 'code' }>).outputs[0];
    expect(o.type === 'display' && Object.keys(o.data)).toEqual(['text/plain']);
    expect((back.cells[2] as Extract<Cell, { type: 'code' }>).outputs.length).toBe(1);
  });
  it('round-trips with nothing stripped', () => {
    const back = parseNotebook(clean(cells, meta, null));
    expect(back.cells.map((c) => c.source)).toEqual(['# Hi', 'plot()', 'print(1)']);
    expect(back.metadata).toEqual(meta.metadata);
  });
});
