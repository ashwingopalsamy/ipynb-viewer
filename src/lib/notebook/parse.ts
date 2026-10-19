import { lenientParse } from './lenient';
import { normalizeCell } from './normalize';
import { NotebookScanner, type ScanItem } from './scan';
import {
  NotebookParseError,
  type Json,
  type JsonObject,
  type Notebook,
  type NotebookEvent,
  type NotebookMeta,
} from './types';

export type ChunkSource =
  | string
  | Iterable<string | Uint8Array>
  | AsyncIterable<string | Uint8Array>
  | ReadableStream<Uint8Array>;

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

function buildMeta(members: Map<string, Json>): NotebookMeta {
  const declared = members.get('nbformat');
  const nbformat =
    typeof declared === 'number' && Number.isInteger(declared) ? declared : members.has('worksheets') ? 3 : 4;
  const minor = members.get('nbformat_minor');
  const metadata = isObject(members.get('metadata')) ? (members.get('metadata') as JsonObject) : {};
  // Widget state can run to megabytes and is of no use to a reader that never executes anything.
  delete metadata.widgets;

  const kernelspec = isObject(metadata.kernelspec) ? metadata.kernelspec : {};
  const info = isObject(metadata.language_info) ? metadata.language_info : {};
  const str = (v: Json | undefined) => (typeof v === 'string' && v ? v : null);
  return {
    nbformat,
    nbformatMinor: typeof minor === 'number' && Number.isInteger(minor) ? minor : 0,
    metadata,
    language: str(info.name) ?? str(kernelspec.language),
    kernel: str(kernelspec.display_name) ?? str(kernelspec.name),
  };
}

class Assembler {
  readonly warnings: string[] = [];
  private members = new Map<string, Json>();
  private ids = new Set<string>();
  private index = 0;
  private pending: string[] = [];

  private warn = (message: string) => {
    this.warnings.push(message);
    this.pending.push(message);
  };

  handle(item: ScanItem): NotebookEvent[] {
    const events: NotebookEvent[] = [];
    if (item.kind === 'cell') {
      const index = this.index++;
      const parsed = lenientParse(item.raw);
      const cell = parsed.ok
        ? normalizeCell(parsed.value, { index, ids: this.ids, warn: this.warn })
        : (this.warn(`Cell ${index + 1} could not be read (${parsed.error})`), null);
      for (const message of this.pending.splice(0)) events.push({ type: 'warning', message });
      if (cell) events.push({ type: 'cell', cell });
    } else if (item.kind === 'member') {
      const parsed = lenientParse(item.raw);
      if (parsed.ok) this.members.set(item.key, parsed.value);
      else this.warn(`Could not read "${item.key}" (${parsed.error})`);
      for (const message of this.pending.splice(0)) events.push({ type: 'warning', message });
    } else {
      if (this.index === 0 && !this.members.has('nbformat') && !this.members.has('metadata')) {
        throw new NotebookParseError('Not a notebook: no cells found');
      }
      if (!item.complete) {
        this.warn(
          item.truncatedCell
            ? 'The file ends early and the last cell is cut off; showing what could be read'
            : 'The file ends early; showing what could be read',
        );
      }
      for (const message of this.pending.splice(0)) events.push({ type: 'warning', message });
      events.push({ type: 'done', meta: buildMeta(this.members) });
    }
    return events;
  }
}

async function* chunksOf(source: Exclude<ChunkSource, string>): AsyncGenerator<string | Uint8Array> {
  if (typeof (source as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (source as ReadableStream<Uint8Array>).getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    yield* source as AsyncIterable<string | Uint8Array>;
  }
}

/** Yields cells as soon as they are complete, then a `done` event with the notebook-level fields. */
export async function* streamNotebook(source: ChunkSource): AsyncGenerator<NotebookEvent> {
  const scanner = new NotebookScanner();
  const assembler = new Assembler();
  const decoder = new TextDecoder();

  const feed = function* (items: ScanItem[]) {
    for (const item of items) yield* assembler.handle(item);
  };

  if (typeof source === 'string') {
    yield* feed(scanner.push(source));
  } else {
    for await (const chunk of chunksOf(source)) {
      const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      if (text) yield* feed(scanner.push(text));
    }
    const tail = decoder.decode();
    if (tail) yield* feed(scanner.push(tail));
  }
  yield* feed(scanner.finish());
}

/** Reads a whole notebook. `onEvent` fires as cells arrive, for progressive display. */
export async function readNotebook(
  source: ChunkSource,
  onEvent?: (event: NotebookEvent) => void,
): Promise<Notebook> {
  const cells: Notebook['cells'] = [];
  const warnings: string[] = [];
  let meta: NotebookMeta | undefined;
  for await (const event of streamNotebook(source)) {
    onEvent?.(event);
    if (event.type === 'cell') cells.push(event.cell);
    else if (event.type === 'warning') warnings.push(event.message);
    else meta = event.meta;
  }
  return { ...meta!, cells, warnings };
}

/** Synchronous parse for text already in memory. */
export function parseNotebook(text: string): Notebook {
  const scanner = new NotebookScanner();
  const assembler = new Assembler();
  const cells: Notebook['cells'] = [];
  let meta: NotebookMeta | undefined;
  for (const item of [...scanner.push(text), ...scanner.finish()]) {
    for (const event of assembler.handle(item)) {
      if (event.type === 'cell') cells.push(event.cell);
      else if (event.type === 'done') meta = event.meta;
    }
  }
  return { ...meta!, cells, warnings: assembler.warnings };
}
