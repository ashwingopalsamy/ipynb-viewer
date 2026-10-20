import type { Cell, NotebookMeta, Output } from '../notebook';

// Where a notebook's bytes are, and a copy of it with the heavy parts left out.

export interface Heavy {
  cell: string;
  n: number | null;
  /** A short name for what is in it: "PNG", "HTML", "text". */
  what: string;
  bytes: number;
}
export interface Weight {
  total: number;
  source: number;
  outputs: number;
  /** Bytes held by pictures. */
  images: number;
  heavy: Heavy[];
}

const BINARY = /^image\/(?:png|jpeg|gif|webp|bmp|avif)$/;
const base64 = (s: string) => Math.floor((s.length * 3) / 4);
const isImage = (mime: string) => BINARY.test(mime) || mime === 'image/svg+xml';

function measure(o: Output): { bytes: number; images: number; what: string } {
  if (o.type === 'stream') return { bytes: o.text.length, images: 0, what: 'text' };
  if (o.type === 'error') return { bytes: o.traceback.reduce((n, t) => n + t.length, o.evalue.length + o.ename.length), images: 0, what: 'error' };
  let bytes = 0;
  let images = 0;
  let what = 'text';
  let top = 0;
  for (const [mime, v] of Object.entries(o.data)) {
    const size = typeof v === 'string' ? (BINARY.test(mime) ? base64(v) : v.length) : JSON.stringify(v).length;
    bytes += size;
    if (isImage(mime)) images += size;
    if (size > top) (top = size), (what = isImage(mime) ? mime.slice(6).replace('svg+xml', 'svg').toUpperCase() : mime === 'text/html' ? 'HTML' : mime.startsWith('application/') ? 'data' : 'text');
  }
  return { bytes, images, what };
}

export function weigh(cells: readonly Cell[], top = 6): Weight {
  const w: Weight = { total: 0, source: 0, outputs: 0, images: 0, heavy: [] };
  for (const c of cells) {
    w.source += c.source.length;
    if (c.type !== 'code') continue;
    for (const o of c.outputs) {
      const m = measure(o);
      w.outputs += m.bytes;
      w.images += m.images;
      if (m.bytes > 0) w.heavy.push({ cell: c.id, n: c.executionCount, what: m.what, bytes: m.bytes });
    }
  }
  w.total = w.source + w.outputs;
  w.heavy = w.heavy.sort((a, b) => b.bytes - a.bytes).slice(0, top);
  return w;
}

export type Strip = 'outputs' | 'images';

const lines = (s: string) => (s ? s.split(/(?<=\n)/) : []);

function out(o: Output, strip: Strip | null) {
  if (strip === 'outputs') return null;
  if (o.type === 'stream') return { output_type: 'stream', name: o.name, text: lines(o.text) };
  if (o.type === 'error') return { output_type: 'error', ename: o.ename, evalue: o.evalue, traceback: o.traceback };
  const data = strip === 'images' ? Object.fromEntries(Object.entries(o.data).filter(([m]) => !isImage(m))) : o.data;
  if (strip === 'images' && !Object.keys(data).length) return null;
  return o.type === 'display'
    ? { output_type: 'display_data', data, metadata: o.metadata }
    : { output_type: 'execute_result', data, metadata: o.metadata, execution_count: o.executionCount };
}

/** The notebook as a file again, in nbformat 4.5, without outputs or without pictures. Cell notes and ids are kept. */
export function clean(cells: readonly Cell[], meta: NotebookMeta | null, strip: Strip | null): string {
  const body = cells.map((c) => {
    const base = { id: c.id, metadata: c.metadata, source: lines(c.source) };
    if (c.type === 'markdown') return { cell_type: 'markdown', ...base, ...(strip === 'images' || !Object.keys(c.attachments).length ? {} : { attachments: c.attachments }) };
    if (c.type === 'raw') return { cell_type: 'raw', ...base };
    return { cell_type: 'code', ...base, execution_count: strip === 'outputs' ? null : c.executionCount, outputs: c.outputs.map((o) => out(o, strip)).filter(Boolean) };
  });
  return JSON.stringify({ cells: body, metadata: meta?.metadata ?? {}, nbformat: 4, nbformat_minor: 5 }, null, 1) + '\n';
}
