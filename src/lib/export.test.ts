import { describe, expect, it } from 'vitest';
import { fileName, mimeOf, size } from './export';

describe('fileName', () => {
  it('drops the extension and keeps the name readable', () => {
    expect(fileName('spec.ipynb', 'figure-12')).toBe('spec-figure-12');
    expect(fileName('My notes (v2).ipynb', 'cell-3')).toBe('My-notes-v2-cell-3');
  });
  it('falls back when nothing is left', () => {
    expect(fileName('.ipynb', 'figure')).toBe('notebook-figure');
    expect(fileName('', 'figure')).toBe('notebook-figure');
  });
  it('keeps letters of other scripts', () => {
    expect(fileName('分析.ipynb', 'cell-1')).toBe('分析-cell-1');
  });
});

describe('mimeOf', () => {
  it('reads the type of a data URL', () => {
    expect(mimeOf('data:image/png;base64,AAAA')).toBe('image/png');
    expect(mimeOf('nope')).toBe('');
  });
});

describe('size', () => {
  it('rounds to a unit a reader can feel', () => {
    expect(size(512)).toBe('512 B');
    expect(size(184 * 1024)).toBe('184 KB');
    expect(size(3.4 * 1024 * 1024)).toBe('3.4 MB');
  });
});
