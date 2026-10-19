import { describe, expect, it } from 'vitest';
import type { CodeCell, Output } from './notebook';
import { long, over } from './long';

const cell = (source: string, outputs: Output[] = []): CodeCell => ({ id: 'a', type: 'code', source, metadata: {}, executionCount: 1, outputs });
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');
const stream = (text: string): Output => ({ type: 'stream', name: 'stdout', text });
const shown = (data: Record<string, string>): Output => ({ type: 'display', data, metadata: {} });

describe('over', () => {
  it('counts lines, not newlines', () => {
    expect(over(lines(10), 10)).toBe(false);
    expect(over(lines(11), 10)).toBe(true);
  });
});

describe('long', () => {
  it('is false for a short cell', () => {
    expect(long(cell(lines(3), [stream(lines(3))]))).toBe(false);
  });
  it('flags code past 10 lines', () => {
    expect(long(cell(lines(10)))).toBe(false);
    expect(long(cell(lines(11)))).toBe(true);
  });
  it('ignores blank lines at the end of the code', () => {
    expect(long(cell(lines(10) + '\n\n\n'))).toBe(false);
  });
  it('flags text output past 14 lines', () => {
    expect(long(cell('x', [stream(lines(14))]))).toBe(false);
    expect(long(cell('x', [stream(lines(15))]))).toBe(true);
    expect(long(cell('x', [shown({ 'text/plain': lines(15) })]))).toBe(true);
  });
  it('flags any figure or table', () => {
    expect(long(cell('x', [shown({ 'image/png': 'AAAA' })]))).toBe(true);
    expect(long(cell('x', [shown({ 'text/plain': 'df', 'text/html': '<div><table></table></div>' })]))).toBe(true);
  });
  it('does not flag an SVG alone, a short error or plain html', () => {
    expect(long(cell('x', [shown({ 'image/svg+xml': '<svg/>' })]))).toBe(false);
    expect(long(cell('x', [{ type: 'error', ename: 'E', evalue: 'v', traceback: [lines(40)] }]))).toBe(false);
    expect(long(cell('x', [shown({ 'text/html': '<b>hi</b>' })]))).toBe(false);
  });
});
