import { describe, expect, it } from 'vitest';
import { reorder } from './replay';
import type { Cell } from './notebook';

const code = (id: string, n: number | null): Cell => ({ type: 'code', id, source: '', metadata: {}, executionCount: n, outputs: [] });
const md = (id: string): Cell => ({ type: 'markdown', id, source: '', metadata: {}, attachments: {} });

describe('reorder', () => {
  it('sorts executed code cells and leaves the rest in place', () => {
    const cells = [md('a'), code('x', 3), code('y', 1), code('skip', null), code('z', 2), md('b')];
    expect(reorder(cells).map((c) => c.id)).toEqual(['a', 'y', 'z', 'skip', 'x', 'b']);
  });
});
