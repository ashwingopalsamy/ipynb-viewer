import type {
  Cell,
  CodeCell,
  Json,
  JsonObject,
  MimeBundle,
  Output,
} from './types';

export type Warn = (message: string) => void;

export interface CellContext {
  index: number;
  ids: Set<string>;
  warn: Warn;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function joinText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x == null ? '' : String(x))).join('');
  return '';
}

function toCount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
}

const asObject = (v: unknown): JsonObject => (isObject(v) ? (v as JsonObject) : {});

const isJsonMime = (mime: string) => mime === 'application/json' || mime.endsWith('+json');
const isBinaryMime = (mime: string) =>
  (mime.startsWith('image/') && mime !== 'image/svg+xml') || mime === 'application/pdf';

export function normalizeBundle(data: unknown): MimeBundle {
  const out: MimeBundle = {};
  if (!isObject(data)) return out;
  for (const [mime, value] of Object.entries(data)) {
    if (isJsonMime(mime)) out[mime] = value as Json;
    else if (isBinaryMime(mime)) out[mime] = joinText(value).replace(/\s+/g, '');
    else if (isObject(value)) out[mime] = JSON.stringify(value);
    else if (typeof value === 'number' || typeof value === 'boolean') out[mime] = String(value);
    else out[mime] = joinText(value);
  }
  return out;
}

// v3 stored each representation as a top-level key of the output.
const LEGACY_MIME: Record<string, string> = {
  text: 'text/plain',
  html: 'text/html',
  latex: 'text/latex',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  javascript: 'application/javascript',
  json: 'application/json',
};

function legacyBundle(raw: Record<string, unknown>): MimeBundle {
  const data: Record<string, unknown> = {};
  for (const [key, mime] of Object.entries(LEGACY_MIME)) {
    if (!(key in raw)) continue;
    let value = raw[key];
    if (key === 'json' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep the string */
      }
    }
    data[mime] = value;
  }
  return normalizeBundle(data);
}

function normalizeOutput(raw: unknown, ctx: CellContext): Output | null {
  const at = `Cell ${ctx.index + 1}`;
  if (!isObject(raw)) {
    ctx.warn(`${at}: an output was not an object and was skipped`);
    return null;
  }
  const kind = raw.output_type;
  const hasData = isObject(raw.data);
  const display = (): Output => ({
    type: 'display',
    data: hasData ? normalizeBundle(raw.data) : legacyBundle(raw),
    metadata: asObject(raw.metadata),
  });
  const stream = (): Output => ({
    type: 'stream',
    name: typeof raw.name === 'string' ? raw.name : typeof raw.stream === 'string' ? raw.stream : 'stdout',
    text: joinText(raw.text),
  });

  switch (kind) {
    case 'stream':
      return stream();
    case 'display_data':
      return display();
    case 'execute_result':
    case 'pyout': {
      const d = display() as Extract<Output, { type: 'display' }>;
      return {
        type: 'result',
        data: d.data,
        metadata: d.metadata,
        executionCount: toCount(raw.execution_count ?? raw.prompt_number),
      };
    }
    case 'error':
    case 'pyerr': {
      const tb = raw.traceback;
      return {
        type: 'error',
        ename: typeof raw.ename === 'string' ? raw.ename : 'Error',
        evalue: typeof raw.evalue === 'string' ? raw.evalue : '',
        traceback: Array.isArray(tb) ? tb.map((x) => String(x ?? '')) : typeof tb === 'string' ? tb.split('\n') : [],
      };
    }
  }
  if (hasData) return display();
  if ('text' in raw) return stream();
  ctx.warn(`${at}: skipped an output of unknown type${typeof kind === 'string' ? ` "${kind}"` : ''}`);
  return null;
}

function normalizeOutputs(raw: unknown, ctx: CellContext): Output[] {
  if (!Array.isArray(raw)) return [];
  const out: Output[] = [];
  for (const item of raw) {
    const o = normalizeOutput(item, ctx);
    if (!o) continue;
    const prev = out[out.length - 1];
    if (o.type === 'stream' && prev?.type === 'stream' && prev.name === o.name) prev.text += o.text;
    else out.push(o);
  }
  return out;
}

function cellId(raw: Record<string, unknown>, ctx: CellContext): string {
  let id = typeof raw.id === 'string' && raw.id ? raw.id : '';
  if (!id || ctx.ids.has(id)) id = `cell-${ctx.index}`;
  while (ctx.ids.has(id)) id += '_';
  ctx.ids.add(id);
  return id;
}

/** Accepts a v4 cell, or a v2/v3 one, and returns it in the v4 shape. */
export function normalizeCell(raw: unknown, ctx: CellContext): Cell | null {
  const at = `Cell ${ctx.index + 1}`;
  if (!isObject(raw)) {
    ctx.warn(`${at} is not an object and was skipped`);
    return null;
  }
  const base = () => ({ id: cellId(raw, ctx), metadata: asObject(raw.metadata) });
  const type = raw.cell_type;

  if (type === 'heading') {
    const level = Math.min(6, Math.max(1, toCount(raw.level) ?? 1));
    return {
      type: 'markdown',
      ...base(),
      source: `${'#'.repeat(level)} ${joinText(raw.source)}`,
      attachments: {},
    };
  }
  if (type === 'markdown') {
    const attachments: Record<string, MimeBundle> = {};
    if (isObject(raw.attachments)) {
      for (const [name, bundle] of Object.entries(raw.attachments)) attachments[name] = normalizeBundle(bundle);
    }
    return { type: 'markdown', ...base(), source: joinText(raw.source), attachments };
  }
  if (type === 'code') {
    const cell: CodeCell = {
      type: 'code',
      ...base(),
      source: joinText(raw.source ?? raw.input),
      executionCount: toCount(raw.execution_count ?? raw.prompt_number),
      outputs: normalizeOutputs(raw.outputs, ctx),
    };
    return cell;
  }
  if (type !== 'raw') {
    ctx.warn(`${at} has ${typeof type === 'string' ? `unknown type "${type}"` : 'no type'} and is shown as raw text`);
  }
  return { type: 'raw', ...base(), source: joinText(raw.source) };
}
