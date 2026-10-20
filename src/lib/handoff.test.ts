import { describe, expect, it } from 'vitest';
import type { Cell, Output } from './notebook';
import { toMarkdown, tokens } from './handoff';

const code = (source: string, outputs: Output[] = []): Cell => ({ id: 'c', type: 'code', source, metadata: {}, executionCount: 1, outputs });
const md = (source: string): Cell => ({ id: 'm', type: 'markdown', source, metadata: {}, attachments: {} });
const stream = (text: string): Output => ({ type: 'stream', name: 'stdout', text });
const result = (data: Record<string, string>): Output => ({ type: 'result', data, metadata: {}, executionCount: 1 });
const opts = { file: 'nb.ipynb', language: 'python', outputs: 'trim' as const };

describe('toMarkdown', () => {
  it('writes the title, a line about the notebook, the text cells as written and the code in fences', () => {
    const m = toMarkdown([md('## Setup\n\nSome *text*.'), code('x = 1\nprint(x)', [stream('1\n')])], opts);
    expect(m.text).toBe('# nb.ipynb\n\nPython notebook, 2 cells.\n\n## Setup\n\nSome *text*.\n\n```python\nx = 1\nprint(x)\n```\n\nOutput:\n```text\n1\n```\n');
    expect(m.cells).toBe(2);
    expect(m.trimmed).toBe(false);
  });

  it('skips raw cells and empty ones', () => {
    const raw: Cell = { id: 'r', type: 'raw', source: 'x', metadata: {} };
    expect(toMarkdown([raw, md('  '), code('')], opts).text).toBe('# nb.ipynb\n\nPython notebook, 2 cells.\n');
  });

  it('keeps the head and tail of a long output and says how much is between', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const m = toMarkdown([code('go()', [stream(lines)])], opts);
    expect(m.trimmed).toBe(true);
    expect(m.text).toContain('line 0\n');
    expect(m.text).toContain('line 11\n… 182 lines omitted …\nline 194');
    expect(m.text).toContain('line 199');
    expect(m.text).not.toContain('line 100');
  });

  it('shortens a very long line', () => {
    const m = toMarkdown([code('go()', [stream('x'.repeat(1000))])], opts);
    expect(m.trimmed).toBe(true);
    expect(m.text).toContain('x'.repeat(240) + ' …');
  });

  it('full keeps everything, but still drops colour codes and progress frames', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `\u001b[31mline ${i}\u001b[0m`).join('\n');
    const m = toMarkdown([code('go()', [stream(lines)])], { ...opts, outputs: 'full' });
    expect(m.trimmed).toBe(false);
    expect(m.text).toContain('line 50\n');
    expect(m.text).not.toContain('\u001b');
    const bars = ' 10%|█ | 1/10\n 20%|██ | 2/10\n 30%|███ | 3/10\ndone';
    expect(toMarkdown([code('go()', [stream(bars)])], { ...opts, outputs: 'full' }).text).toContain('3/10\ndone');
    expect(toMarkdown([code('go()', [stream(bars)])], { ...opts, outputs: 'full' }).text).not.toContain('1/10');
  });

  it('none leaves outputs out but keeps one line for an error', () => {
    const err: Output = { type: 'error', ename: 'ZeroDivisionError', evalue: 'division by zero', traceback: ['a', 'b', 'c', 'd', 'e'] };
    const m = toMarkdown([code('1/0', [stream('hi'), err])], { ...opts, outputs: 'none' });
    expect(m.text).toContain('Error:\n```text\nZeroDivisionError: division by zero\n```');
    expect(m.text).not.toContain('hi');
  });

  it('a long traceback shrinks to the last frame in the reader’s own code', () => {
    const tb = ['---', 'File "/lib/a.py", line 1', 'File "/lib/b.py", line 2', 'File "/lib/c.py", line 3', 'Cell In[9], line 3\n----> 3 b = a / 0', 'ZeroDivisionError: division by zero'];
    const err: Output = { type: 'error', ename: 'ZeroDivisionError', evalue: 'division by zero', traceback: tb };
    const m = toMarkdown([code('1/0', [err])], opts);
    expect(m.text).toContain('Cell In[9], line 3');
    expect(m.text).not.toContain('/lib/b.py');
    expect(toMarkdown([code('1/0', [err])], { ...opts, outputs: 'full' }).text).toContain('/lib/b.py');
  });

  it('names a picture instead of carrying it', () => {
    // a PNG header for 640 by 480
    const png = btoa('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x02\x80\x00\x00\x01\xe0\x08\x06') + 'AAAA';
    const m = toMarkdown([code('plt.show()', [result({ 'image/png': png, 'text/plain': '<Figure>' })])], opts);
    expect(m.text).toContain('[image: PNG 640×480]');
    expect(m.text).not.toContain(png);
    expect(m.left).toBe(1);
  });

  it('an interactive output with no text version is named by its type', () => {
    const m = toMarkdown([code('fig.show()', [result({ 'application/vnd.plotly.v1+json': '{}' })])], opts);
    expect(m.text).toContain('[interactive output: application/vnd.plotly.v1+json]');
    expect(m.left).toBe(1);
  });

  it('a rich output with a text version uses the text', () => {
    const m = toMarkdown([code('df', [result({ 'text/html': '<table></table>', 'text/plain': '   a\n0  1' })])], opts);
    expect(m.text).toContain('   a\n0  1');
    expect(m.left).toBe(0);
  });

  it('fences grow when the text holds fences', () => {
    const m = toMarkdown([code('s = """\n```\n"""', [])], opts);
    expect(m.text).toContain('````python\ns = """\n```\n"""\n````');
  });

  it('leaves the language tag off when it is not known', () => {
    expect(toMarkdown([code('x')], { ...opts, language: null }).text).toBe('# nb.ipynb\n\nNotebook, 1 cell.\n\n```\nx\n```\n');
  });
});

describe('tokens', () => {
  it('counts about four characters to the token', () => {
    expect(tokens('x'.repeat(400))).toBe(100);
    expect(tokens('')).toBe(0);
  });
});
