import { describe, expect, it } from 'vitest';
import {
  NotebookParseError,
  parseNotebook,
  readNotebook,
  streamNotebook,
  type CodeCell,
  type Notebook,
  type NotebookEvent,
} from './index';

import basicText from './fixtures/basic.ipynb?raw';
import brokenText from './fixtures/broken.ipynb?raw';
import legacyText from './fixtures/legacy-v3.ipynb?raw';
import richText from './fixtures/rich.ipynb?raw';
import tracebackText from './fixtures/traceback.ipynb?raw';

const fixtures: Record<string, string> = {
  basic: basicText,
  broken: brokenText,
  'legacy-v3': legacyText,
  rich: richText,
  traceback: tracebackText,
};
const load = (name: string) => fixtures[name];
const code = (nb: Notebook, i: number) => nb.cells[i] as CodeCell;

function chunked(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

describe('basic notebook', () => {
  const nb = parseNotebook(load('basic'));

  it('reads the notebook fields', () => {
    expect(nb.nbformat).toBe(4);
    expect(nb.nbformatMinor).toBe(5);
    expect(nb.language).toBe('python');
    expect(nb.kernel).toBe('Python 3 (ipykernel)');
    expect(nb.warnings).toEqual([]);
  });

  it('joins source lines and keeps ids', () => {
    expect(nb.cells.map((c) => c.type)).toEqual(['markdown', 'code', 'code', 'code', 'raw', 'code']);
    expect(nb.cells[0]).toMatchObject({ id: 'intro', source: '# Sales notes\n\nQuick look at monthly totals.' });
    expect(nb.cells[1].source).toBe("import pandas as pd\nprint('loading')");
  });

  it('keeps carriage returns in stream text', () => {
    const [out] = code(nb, 2).outputs;
    expect(out).toMatchObject({ type: 'stream', name: 'stderr' });
    expect((out as { text: string }).text.split('\r')).toHaveLength(4);
    expect((out as { text: string }).text.endsWith('30.00it/s]\n')).toBe(true);
  });

  it('merges adjacent streams of the same name only', () => {
    const outs = code(nb, 3).outputs;
    expect(outs.map((o) => (o.type === 'stream' ? [o.name, o.text] : null))).toEqual([
      ['stdout', 'a\nb\n'],
      ['stderr', 'warn\n'],
      ['stdout', 'c\n'],
    ]);
  });

  it('handles empty code cells', () => {
    expect(code(nb, 5)).toMatchObject({ source: '', executionCount: null, outputs: [] });
  });
});

describe('traceback', () => {
  it('keeps ANSI traceback lines untouched', () => {
    const nb = parseNotebook(load('traceback'));
    const out = code(nb, 0).outputs[0];
    expect(out.type).toBe('error');
    if (out.type !== 'error') return;
    expect(out.ename).toBe('ZeroDivisionError');
    expect(out.traceback).toHaveLength(4);
    expect(out.traceback[3]).toContain('\u001b[0;31m');
  });
});

describe('rich outputs', () => {
  const nb = parseNotebook(load('rich'));

  it('keeps markdown attachments as clean base64', () => {
    const md = nb.cells[0];
    if (md.type !== 'markdown') throw new Error('expected markdown');
    expect(md.attachments['dot.png']['image/png']).toMatch(/^iVBORw0KGgo[A-Za-z0-9+/=]+$/);
  });

  it('joins html and reads a DataFrame result', () => {
    const out = code(nb, 1).outputs[0];
    if (out.type !== 'result') throw new Error('expected result');
    expect(out.executionCount).toBe(1);
    expect(typeof out.data['text/html']).toBe('string');
    expect(out.data['text/html']).toContain('<table border="1" class="dataframe">');
    expect(out.data['text/plain']).toContain('Feb    135');
  });

  it('strips whitespace from image data', () => {
    const out = code(nb, 2).outputs[0];
    if (out.type !== 'display') throw new Error('expected display');
    expect(out.data['image/png']).not.toMatch(/\s/);
    expect(out.metadata).toEqual({ needs_background: 'light' });
  });

  it('keeps svg as text and json as a value', () => {
    const svg = code(nb, 3).outputs[0];
    const json = code(nb, 4).outputs[0];
    if (svg.type !== 'display' || json.type !== 'result') throw new Error('unexpected output types');
    expect(svg.data['image/svg+xml']).toMatch(/^<svg/);
    expect(json.data['application/json']).toEqual({ rows: 2, ok: true });
  });

  it('passes scripted html through untouched for the renderer to sanitize', () => {
    const out = code(nb, 5).outputs[0];
    if (out.type !== 'display') throw new Error('expected display');
    expect(out.data['text/html']).toContain('<script>');
  });
});

describe('legacy v3', () => {
  const nb = parseNotebook(load('legacy-v3'));

  it('flattens worksheets into v4 cells', () => {
    expect(nb.nbformat).toBe(3);
    expect(nb.cells.map((c) => c.type)).toEqual(['markdown', 'markdown', 'code', 'code']);
    expect(nb.cells[0].source).toBe('## Old notebook');
    expect(new Set(nb.cells.map((c) => c.id)).size).toBe(4);
  });

  it('upgrades input, prompt_number and outputs', () => {
    const cell = code(nb, 2);
    expect(cell.source).toBe('x = 21\nprint(x)\nx * 2');
    expect(cell.executionCount).toBe(1);
    expect(cell.outputs.map((o) => o.type)).toEqual(['stream', 'result', 'display', 'error']);
    const [stream, result, display, error] = cell.outputs;
    expect(stream).toMatchObject({ name: 'stdout', text: '21\n' });
    if (result.type !== 'result' || display.type !== 'display' || error.type !== 'error') throw new Error('shape');
    expect(result.executionCount).toBe(1);
    expect(Object.keys(result.data).sort()).toEqual(['image/png', 'text/html', 'text/plain']);
    expect(display.data['image/svg+xml']).toContain('<svg');
    expect(error.ename).toBe('NameError');
  });

  it('accepts input given as a plain string', () => {
    expect(code(nb, 3)).toMatchObject({ source: '1', executionCount: null });
  });
});

describe('malformed input', () => {
  const nb = parseNotebook(load('broken'));

  it('survives and reports what it skipped', () => {
    expect(nb.cells.map((c) => c.type)).toEqual(['markdown', 'raw', 'code', 'code', 'code']);
    expect(nb.warnings.some((w) => w.includes('unknown type "figure"'))).toBe(true);
    expect(nb.warnings.some((w) => w.includes('not an object'))).toBe(true);
    expect(nb.warnings.some((w) => w.includes('"mystery"'))).toBe(true);
  });

  it('fills in missing fields', () => {
    expect(nb.cells[0].source).toBe('');
    expect(new Set(nb.cells.map((c) => c.id)).size).toBe(nb.cells.length);
  });

  it('coerces odd values in code cells', () => {
    const c = code(nb, 2);
    expect(c.executionCount).toBe(7);
    expect(c.outputs.map((o) => o.type)).toEqual(['stream', 'display', 'result']);
    const display = c.outputs[1];
    if (display.type !== 'display') throw new Error('expected display');
    expect(display.data['text/plain']).toBe('5');
    expect(display.data['image/png']).toBe('AAAABBBB');
    const result = c.outputs[2];
    if (result.type !== 'result') throw new Error('expected result');
    expect(result.executionCount).toBeNull();
    expect(code(nb, 3)).toMatchObject({ executionCount: 3, outputs: [] });
  });

  it('turns bare NaN into null', () => {
    expect(nb.metadata.weird).toBeNull();
    expect(code(nb, 4).metadata).toEqual({ vals: [null, 1] });
  });

  it('keeps the cells before a truncated end', () => {
    const text = load('basic');
    const cut = parseNotebook(text.slice(0, text.indexOf('"id": "merge"')));
    expect(cut.cells.map((c) => c.id)).toEqual(['intro', 'load', 'progress']);
    expect(cut.warnings.at(-1)).toMatch(/ends early/);
  });

  it('skips a cell that is not valid JSON', () => {
    const text = '{"cells":[{"cell_type":"raw","source":"a"},{"cell_type": raw},{"cell_type":"raw","source":"c"}],"nbformat":4}';
    const nb2 = parseNotebook(text);
    expect(nb2.cells.map((c) => c.source)).toEqual(['a', 'c']);
    expect(nb2.warnings[0]).toMatch(/^Cell 2 could not be read/);
  });

  it('rejects files that are not notebooks', () => {
    expect(() => parseNotebook('')).toThrow(NotebookParseError);
    expect(() => parseNotebook('   ')).toThrow(NotebookParseError);
    expect(() => parseNotebook('print("hi")')).toThrow(NotebookParseError);
    expect(() => parseNotebook('[1, 2]')).toThrow(NotebookParseError);
    expect(() => parseNotebook('{"hello": "world"}')).toThrow(NotebookParseError);
  });

  it('accepts an empty notebook and a BOM', () => {
    const nb2 = parseNotebook('﻿{"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}');
    expect(nb2.cells).toEqual([]);
    expect(nb2.warnings).toEqual([]);
  });

  it('is not fooled by structure inside strings', () => {
    const tricky = JSON.stringify({
      cells: [{ cell_type: 'raw', source: '{"cells": [ "}\\" ] } ,', metadata: { cells: [1, 2] } }],
      metadata: { cells: [{ cell_type: 'raw' }] },
      nbformat: 4,
    });
    const nb2 = parseNotebook(tricky);
    expect(nb2.cells).toHaveLength(1);
    expect(nb2.cells[0].source).toBe('{"cells": [ "}\\" ] } ,');
    expect(nb2.metadata).toEqual({ cells: [{ cell_type: 'raw' }] });
  });
});

describe('streaming', () => {
  const text = load('rich');
  const reference = parseNotebook(text);

  it.each([1, 7, 64, 1000])('matches the sync parse with %i-char chunks', async (size) => {
    const nb = await readNotebook(chunked(text, size));
    expect(nb).toEqual(reference);
  });

  it('decodes bytes split inside a multi-byte character', async () => {
    const original = parseNotebook(load('basic'));
    const bytes = new TextEncoder().encode(load('basic'));
    const parts: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 5) parts.push(bytes.slice(i, i + 5));
    expect(await readNotebook(parts)).toEqual(original);
  });

  it('reads a ReadableStream', async () => {
    const bytes = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 300) controller.enqueue(bytes.slice(i, i + 300));
        controller.close();
      },
    });
    expect(await readNotebook(stream)).toEqual(reference);
  });

  it('yields cells before the rest of the input arrives', async () => {
    const full = load('basic');
    const split = full.indexOf('"id": "merge"');
    let released = false;
    async function* source() {
      yield full.slice(0, split);
      released = true;
      yield full.slice(split);
    }
    const seenBeforeRelease: string[] = [];
    const events: NotebookEvent[] = [];
    for await (const event of streamNotebook(source())) {
      events.push(event);
      if (event.type === 'cell' && !released) seenBeforeRelease.push(event.cell.id);
    }
    expect(seenBeforeRelease).toEqual(['intro', 'load', 'progress']);
    expect(events.at(-1)?.type).toBe('done');
  });
});

describe('size', () => {
  it('handles a large notebook in chunks', async () => {
    const payload = 'A'.repeat(1_000_000);
    const cell = (i: number) => ({
      cell_type: 'code',
      execution_count: i,
      id: `c${i}`,
      metadata: {},
      outputs: [{ output_type: 'display_data', data: { 'image/png': payload, 'text/plain': ['<Figure>'] }, metadata: {} }],
      source: ['plot()'],
    });
    const text = JSON.stringify({ cells: Array.from({ length: 30 }, (_, i) => cell(i)), metadata: {}, nbformat: 4, nbformat_minor: 5 });
    expect(text.length).toBeGreaterThan(30_000_000);
    const nb = await readNotebook(chunked(text, 65536));
    expect(nb.cells).toHaveLength(30);
    expect(nb.warnings).toEqual([]);
  }, 20000);
});
