import { describe, expect, it } from 'vitest';
import { calm } from './trace';

const tb = [
  '---------------------------',
  'KeyError    Traceback (most recent call last)',
  'Cell \u001b[0;32mIn[7], line 3\u001b[0m\n      1 x = 1',
  'File ~/lib/pandas/frame.py:3761, in DataFrame.__getitem__(self, key)\n   3760 ...',
  'File ~/lib/pandas/index.py:3655, in Index.get_loc(self, key)\n   3654 ...',
  "KeyError: 'missing'",
];

describe('calm', () => {
  it('keeps the last frame in the reader\'s own cells and the exception', () => {
    expect(calm(tb)).toEqual([tb[2], tb[5]]);
  });

  it('falls back to the deepest frame when no cell frame exists', () => {
    const plain = [tb[0], tb[1], tb[3], tb[3], tb[4], tb[5]];
    expect(calm(plain)).toEqual([tb[4], tb[5]]);
  });

  it('leaves short tracebacks alone', () => {
    expect(calm(tb.slice(0, 4))).toBeNull();
  });
});
