/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { cpus } from 'node:os';
import { it } from 'vitest';
import { streamNotebook } from './parse';

// `npm run bench` writes src/about/bench.json, which the About page is built from. It is skipped in a normal test run.
const run = !!process.env.BENCH;

const CHUNK = 64 * 1024;
const chunks = function* (text: string) {
  for (let i = 0; i < text.length; i += CHUNK) yield text.slice(i, i + CHUNK);
};

/** A notebook that looks like real work: prose, code, a stream, a table and a picture in every few cells. */
function synthetic(cells: number, picture: number) {
  const png = randomBytes(picture).toString('base64');
  const out = [];
  for (let i = 0; i < cells; i++) {
    out.push(
      i % 4 === 0
        ? { cell_type: 'markdown', metadata: {}, source: [`## Step ${i}\n`, 'Some prose that explains what the next cell does, with `code` and a [link](https://example.com).'] }
        : {
            cell_type: 'code',
            execution_count: i,
            metadata: {},
            source: [`x${i} = df.groupby("key").agg({"value": "mean"})\n`, `print(x${i}.shape)`],
            outputs: [
              { output_type: 'stream', name: 'stdout', text: [`(${i}, 3)\n`] },
              ...(i % 4 === 2 ? [{ output_type: 'display_data', metadata: {}, data: { 'image/png': png, 'text/plain': ['<Figure size 640x480>'] } }] : []),
            ],
          },
    );
  }
  return JSON.stringify({ cells: out, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' }, language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 5 });
}

async function measure(name: string, text: string) {
  const bytes = Buffer.byteLength(text);
  const runs: { first: number; total: number; cells: number }[] = [];
  for (let n = 0; n < 7; n++) {
    const start = performance.now();
    let first = 0;
    let cells = 0;
    for await (const e of streamNotebook(chunks(text))) {
      if (e.type === 'cell' && !cells++) first = performance.now() - start;
    }
    runs.push({ first, total: performance.now() - start, cells });
  }
  const mid = (pick: (r: (typeof runs)[number]) => number) => [...runs.map(pick)].sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  const total = mid((r) => r.total);
  return { name, bytes, cells: runs[0].cells, firstMs: +mid((r) => r.first).toFixed(1), totalMs: +total.toFixed(1), mbPerSecond: +(bytes / 1024 / 1024 / (total / 1000)).toFixed(0) };
}

it.skipIf(!run)('measures how fast the parser reads', { timeout: 300_000 }, async () => {
  const results = [
    await measure('The example notebook', readFileSync('examples/cooling-coffee.ipynb', 'utf8')),
    await measure('A 12 MB notebook', synthetic(600, 60_000)),
    await measure('A 60 MB notebook', synthetic(3000, 60_000)),
  ];
  writeFileSync('src/about/bench.json', JSON.stringify({ node: process.version, cpu: cpus()[0]?.model ?? 'unknown', date: new Date().toISOString().slice(0, 10), chunk: CHUNK, results }, null, 2) + '\n');
  console.table(results);
});
