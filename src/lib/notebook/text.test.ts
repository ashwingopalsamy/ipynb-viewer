import { describe, expect, it } from 'vitest';
import { collapseCarriageReturns, stripAnsi } from './text';

describe('stripAnsi', () => {
  it('removes colour and cursor sequences', () => {
    expect(stripAnsi('\u001b[0;31mError\u001b[0m: \u001b[1;32mnope\u001b[0m')).toBe('Error: nope');
    expect(stripAnsi('\u001b[38;5;241m/\u001b[39m \u001b[2K')).toBe('/ ');
  });

  it('removes OSC links', () => {
    expect(stripAnsi('\u001b]8;;http://x\u0007link\u001b]8;;\u0007')).toBe('link');
  });

  it('leaves plain text alone', () => {
    expect(stripAnsi('a [31m b')).toBe('a [31m b');
  });
});

describe('collapseCarriageReturns', () => {
  it('keeps the last write of a progress bar', () => {
    expect(collapseCarriageReturns('\r  0%\r 50%\r100%\n')).toBe('100%\n');
  });

  it('overwrites from column zero without clearing the rest', () => {
    expect(collapseCarriageReturns('abcdef\rxy')).toBe('xycdef');
  });

  it('treats CRLF as a newline', () => {
    expect(collapseCarriageReturns('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('applies backspace', () => {
    expect(collapseCarriageReturns('abc\b\bX')).toBe('aXc');
  });

  it('returns plain text as is', () => {
    expect(collapseCarriageReturns('one\ntwo')).toBe('one\ntwo');
  });
});
