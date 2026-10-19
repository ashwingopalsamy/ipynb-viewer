import { describe, expect, it } from 'vitest';
import { cols, indent, rows, width, wrap } from './glyphs';

const plain = (text: string) => rows([{ text, style: {} }]);
const text = (r: ReturnType<typeof plain>[number]) => r.map((g) => g.ch).join('');

describe('width', () => {
  it('counts what a terminal counts', () => {
    expect(width('a'.codePointAt(0)!)).toBe(1);
    expect(width('中'.codePointAt(0)!)).toBe(2);
    expect(width('😀'.codePointAt(0)!)).toBe(2);
    expect(width(0x0301)).toBe(0);
    expect(width('✓'.codePointAt(0)!)).toBe(1);
  });
});

describe('rows', () => {
  it('splits on newlines and drops carriage returns', () => {
    expect(plain('a\r\nbc\n').map(text)).toEqual(['a', 'bc', '']);
  });
  it('expands tabs to every fourth column', () => {
    expect(text(plain('a\tb')[0])).toBe('a   b');
    expect(text(plain('abcd\te')[0])).toBe('abcd    e');
  });
  it('keeps each run its own style', () => {
    const r = rows([{ text: 'ab', style: { bold: true } }, { text: 'c', style: {} }])[0];
    expect(r.map((g) => !!g.style.bold)).toEqual([true, true, false]);
  });
  it('counts a surrogate pair as one glyph', () => {
    expect(plain('😀x')[0]).toHaveLength(2);
  });
});

describe('wrap', () => {
  it('leaves a short row alone', () => {
    const r = plain('hello')[0];
    expect(wrap(r, 10)).toEqual([r]);
  });
  it('breaks at the limit', () => {
    expect(wrap(plain('abcdefgh')[0], 3).map(text)).toEqual(['abc', 'def', 'gh']);
  });
  it('indents the later pieces', () => {
    expect(wrap(plain('abcdefghij')[0], 6, 2).map(text)).toEqual(['abcdef', '  ghij']);
  });
  it('breaks at a space when one is near', () => {
    expect(wrap(plain('hello wonderful world')[0], 12).map(text)).toEqual(['hello ', 'wonderful ', 'world']);
  });
  it('breaks inside a word when the space is too far back', () => {
    expect(wrap(plain('a verylongwordhere')[0], 8).map(text)).toEqual(['a verylo', 'ngwordhe', 're']);
  });
  it('drops the space the break lands on', () => {
    expect(wrap(plain('abcd efgh')[0], 4).map(text)).toEqual(['abcd', 'efgh']);
  });
  it('never splits a wide character', () => {
    const pieces = wrap(plain('ab中cd')[0], 3);
    expect(pieces.map(text)).toEqual(['ab', '中c', 'd']);
    expect(pieces.every((p) => cols(p) <= 3)).toBe(true);
  });
  it('makes progress when the limit is smaller than a glyph', () => {
    expect(wrap(plain('中中')[0], 1).map(text)).toEqual(['中', '中']);
  });
});

describe('indent', () => {
  it('counts leading spaces', () => {
    expect(indent(plain('    x = 1')[0])).toBe(4);
    expect(indent(plain('x')[0])).toBe(0);
  });
});
