import { describe, expect, it } from 'vitest';
import { cmp, csv } from './tables';

describe('cmp', () => {
  const sorted = (xs: string[], dir: 1 | -1 = 1) => [...xs].sort((a, b) => cmp(a, b, dir));
  it('sorts numbers as numbers, with thousands separators, percents and currency', () => {
    expect(sorted(['10', '9', '1,200', '2.5', '-3'])).toEqual(['-3', '2.5', '9', '10', '1,200']);
    expect(sorted(['12%', '3%', '$100'])).toEqual(['3%', '12%', '$100']);
  });
  it('sorts words with embedded numbers in order, and keeps blanks last either way', () => {
    expect(sorted(['item 10', 'item 2', 'apple'])).toEqual(['apple', 'item 2', 'item 10']);
    expect(sorted(['b', '', 'a'])).toEqual(['a', 'b', '']);
    expect(sorted(['b', '', 'a'], -1)).toEqual(['b', 'a', '']);
  });
});

describe('csv', () => {
  it('quotes what needs it', () => {
    expect(csv([['a', 'b,c'], ['say "hi"', 'x\ny']])).toBe('a,"b,c"\n"say ""hi""","x\ny"\n');
  });
});
