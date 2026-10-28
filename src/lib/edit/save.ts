import type { Cell } from '../notebook';
import { stamp } from '../watch';
import { locateSources, patch } from './nbsplice';

/** What the open notebook was read from, and what saving needs to put it back. */
export interface Loaded {
  name: string;
  file: File;
  handle?: FileSystemFileHandle;
  /** `lastModified:size` of the file as last read or written by us. */
  stamp: string;
  /** The file's text, read when the first editor opens. */
  text: string | null;
  bom: boolean;
  /** A Markdown file, which is one cell and is written back whole. */
  kind: 'ipynb' | 'md';
  /** A Markdown file that uses \r\n; its cell holds \n. */
  crlf: boolean;
  /** Every cell's source as parsed, in file order. */
  original: string[];
}

/**
 * Reads the file text edits will be patched into and checks it still holds the cells on screen.
 * False means the file moved on since it was opened, which is better learned before typing than at save.
 */
export async function readBase(l: Loaded): Promise<boolean> {
  if (l.text !== null) return true;
  try {
    const file = l.handle ? await l.handle.getFile() : l.file;
    const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    const text = await file.text();
    if (l.kind === 'md') {
      if (text.replace(/\r\n?/g, '\n') !== l.original[0]) return false;
      l.crlf = text.includes('\r\n');
    } else {
      const found = locateSources(text);
      if (!found || found.length !== l.original.length || found.some((f, k) => f.value !== l.original[k])) return false;
    }
    l.text = text;
    l.bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
    l.stamp = stamp(file);
    return true;
  } catch {
    return false;
  }
}

export interface Target {
  name: string;
  handle?: FileSystemFileHandle;
  stamp: string;
  text: string;
  bom: boolean;
  kind: 'ipynb' | 'md';
  crlf: boolean;
  original: string[];
  cells: readonly Cell[];
}

/** Why the edits did not go into the file that was opened. */
export type Why = 'changed' | 'denied' | 'gone' | undefined;

export type Saved =
  | { how: 'none' }
  | { how: 'in-place'; name: string; text: string; handle: FileSystemFileHandle; file: File }
  | { how: 'as-new'; name: string; text: string; handle: FileSystemFileHandle; file: File; why: Why }
  | { how: 'download'; name: string; text: string; why: Why }
  | { how: 'cancelled' }
  | { how: 'failed'; why: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const allowed = async (h: FileSystemFileHandle) => {
  const mode = { mode: 'readwrite' } as const;
  try {
    return (await h.queryPermission?.(mode)) === 'granted' || (await h.requestPermission?.(mode)) === 'granted';
  } catch {
    return false;
  }
};

// The write goes to a swap file and replaces the original only when it closes, so a failure leaves the file as it was.
async function write(h: FileSystemFileHandle, text: string) {
  const w = await h.createWritable();
  try {
    await w.write(text);
    await w.close();
  } catch (e) {
    await w.abort().catch(() => {});
    throw e;
  }
}

/**
 * Puts the edited sources into the notebook. Only the edited cells' `"source"` values change in the file's own text,
 * so outputs and images are never re-encoded. The file that was opened is written when it is still as we read it;
 * otherwise, or when asked, the result goes to a new file and the original is left alone.
 */
export async function save(t: Target, asNew: boolean): Promise<Saved> {
  const edits = new Map<number, string>();
  t.cells.forEach((c, k) => c.source !== t.original[k] && edits.set(k, c.source));
  if (!edits.size) return { how: 'none' };
  const mime = t.kind === 'md' ? 'text/markdown' : 'application/json';
  const text = t.kind === 'md' ? (t.crlf ? edits.get(0)!.replace(/\n/g, '\r\n') : edits.get(0)!) : patch(t.text, t.original, edits);
  if (text === null) return { how: 'failed', why: 'the file does not match what was opened' };
  const out = (s: string) => (t.bom ? '﻿' + s : s);

  let why: Why;
  if (!asNew && t.handle) {
    let now: File | null = null;
    try {
      now = await t.handle.getFile();
    } catch {
      why = 'gone';
    }
    if (now) {
      if (stamp(now) !== t.stamp) why = 'changed';
      else if (!(await allowed(t.handle))) why = 'denied';
      else {
        try {
          await write(t.handle, out(text));
          return { how: 'in-place', name: t.name, text, handle: t.handle, file: await t.handle.getFile() };
        } catch (e) {
          return { how: 'failed', why: message(e) };
        }
      }
    }
  }

  const name = t.name.replace(/(\.[^./\\]+)?$/, ' (edited)$1');
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name, types: [t.kind === 'md' ? { description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } } : { description: 'Notebook', accept: { 'application/json': ['.ipynb'] } }] });
      await write(handle, out(text));
      return { how: 'as-new', name: handle.name, text, handle, file: await handle.getFile(), why };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { how: 'cancelled' };
      // the picker needs a click that is still fresh; a download needs nothing
    }
  }
  const url = URL.createObjectURL(new Blob([out(text)], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
  return { how: 'download', name, text, why };
}
