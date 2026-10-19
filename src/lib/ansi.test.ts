import { describe, expect, it } from 'vitest';
import { parseAnsi } from './ansi';

describe('parseAnsi', () => {
  it('returns plain text untouched', () => {
    expect(parseAnsi('hello')).toEqual([{ text: 'hello', cls: '', style: '' }]);
  });

  it('maps basic colors and weight to classes', () => {
    expect(parseAnsi('\u001b[1;31mfail\u001b[0m ok')).toEqual([
      { text: 'fail', cls: 'fg1 bold', style: '' },
      { text: ' ok', cls: '', style: '' },
    ]);
  });

  it('turns 256 and truecolor into inline color', () => {
    const [a, b] = parseAnsi('\u001b[38;5;196mx\u001b[38;2;1;2;3my');
    expect(a.style).toBe('color:#ff0000;');
    expect(b.style).toBe('color:#010203;');
  });

  it('drops sequences that are not styles', () => {
    expect(parseAnsi('a\u001b[2Kb').map((s) => s.text).join('')).toBe('ab');
  });
});
