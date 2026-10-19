import { describe, expect, it } from 'vitest';
import { block, tables } from './tabular';

const frame = ['   phase   peak', '0    0.0  0.713', '1    1.2  0.831', '2    2.4  0.612'];

describe('block', () => {
  it('reads a pandas frame', () => {
    const b = block(frame, 0)!;
    expect(b.head).toEqual(['phase', 'peak']);
    expect(b.rows).toEqual([['0', '0.0', '0.713'], ['1', '1.2', '0.831'], ['2', '2.4', '0.612']]);
    expect(b.end).toBe(4);
  });

  it('keeps values that hold spaces', () => {
    const row = (i: string, t: string, n: string) => `${i}  ${t.padStart(13)}  ${n.padStart(5)}`;
    const lines = [row(' ', 'text', 'score'), row('0', 'hello  world', '0.9'), row('1', 'the quick fox', '0.4')];
    const b = block(lines, 0)!;
    expect(b.rows.map((r) => r[1])).toEqual(['hello  world', 'the quick fox']);
    expect(b.rows.map((r) => r[2])).toEqual(['0.9', '0.4']);
  });

  it('reads named string indexes such as describe()', () => {
    const lines = ['         age  height', 'count   8.00    8.00', 'mean   31.50  170.25'];
    expect(block(lines, 0)!.rows.map((r) => r[0])).toEqual(['count', 'mean']);
  });

  it('leaves prose and ragged text alone', () => {
    expect(block(['  some words', 'Hello  there friend'], 0)).toBeNull();
    expect(block(['no leading blank', '0  1  2'], 0)).toBeNull();
    expect(block(['   a  b', 'x  1'], 0)).toBeNull();
  });
});

describe('tables', () => {
  it('keeps the text around a table', () => {
    const html = tables(['spacy', ...frame, '[3 rows x 2 columns]'].join('\n'))!;
    expect(html.startsWith('<pre>spacy</pre><div class="tbl">')).toBe(true);
    expect(html).toContain('<th class="n">peak</th>');
    expect(html).toContain('<td class="n">0.831</td>');
    expect(html.endsWith('<p class="foot">3 rows × 2 columns</p>')).toBe(true);
  });

  it('turns the footer of a truncated frame into a note, but only under a table', () => {
    expect(tables('[3 rows x 2 columns]\nmore')).toBeNull();
    expect(tables(['       a', '0  1', '1  2', '[1,200 rows x 14 columns]'].join('\n'))).toContain('<p class="foot">1,200 rows × 14 columns</p>');
  });

  it('escapes cells and returns null without a table', () => {
    expect(tables('just\nsome\nlines')).toBeNull();
    const html = tables(['       a', '0  <b>', '1  <i>'].join('\n'))!;
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });
});
