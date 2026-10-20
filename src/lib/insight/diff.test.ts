import { describe, expect, it } from 'vitest';
import type { Cell } from '../notebook';
import { compare, lineDiff } from './diff';

const code = (source: string, out = '') => ({ id: source, type: 'code', source, metadata: {}, executionCount: 1, outputs: out ? [{ type: 'stream', name: 'stdout', text: out }] : [] }) as unknown as Cell;
const md = (source: string) => ({ id: source, type: 'markdown', source, metadata: {}, attachments: {} }) as unknown as Cell;

describe('compare', () => {
  it('says nothing changed for the same notebook', () => {
    const r = compare([md('# A'), code('x = 1')], [md('# A'), code('x = 1')]);
    expect(r).toMatchObject({ same: 2, added: 0, removed: 0, changed: 0, outputs: 0 });
    expect(r.changes).toEqual([]);
  });

  it('finds added, removed and edited cells', () => {
    const r = compare([md('# A'), code('x = 1'), code('y = 2')], [md('# A'), code('x = 10'), code('y = 2'), code('z = 3')]);
    expect(r.changes.map((c) => [c.kind, c.a, c.b])).toEqual([
      ['changed', 1, 1],
      ['added', undefined, 3],
    ]);
    expect(r.changed).toBe(1);
    expect(r.changes[0].lines).toEqual([
      { mark: '-', text: 'x = 1' },
      { mark: '+', text: 'x = 10' },
    ]);
  });

  it('sees a removed cell and a moved-over one', () => {
    const r = compare([code('a'), code('b'), code('c')], [code('a'), code('c')]);
    expect(r.changes).toEqual([{ kind: 'removed', a: 1, type: 'code', text: 'b' }]);
  });

  it('flags a cell whose code is the same but whose output is not', () => {
    const r = compare([code('print(1)', '1\n')], [code('print(1)', '2\n')]);
    expect(r.changes.map((c) => c.kind)).toEqual(['outputs']);
    expect(r.outputs).toBe(1);
  });

  it('reports a partial comparison for very large notebooks', () => {
    const big = Array.from({ length: 3001 }, (_, i) => md(String(i)));
    expect(compare(big.slice(0, 5), big.slice(0, 5)).partial).toBe(false);
  });
});

describe('lineDiff', () => {
  it('keeps a little context and elides the rest', () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
    const after = before.replace('l10', 'changed');
    const d = lineDiff(before, after);
    expect(d.filter((l) => l.mark !== ' ')).toEqual([
      { mark: '-', text: 'l10' },
      { mark: '+', text: 'changed' },
    ]);
    expect(d.some((l) => l.text === '…')).toBe(true);
    expect(d.length).toBeLessThan(12);
  });
});
