import { locateSources } from './nbsplice';

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
  /** Every cell's source as parsed, in file order. */
  original: string[];
}

export const stamp = (f: File) => `${f.lastModified}:${f.size}`;

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
    const found = locateSources(text);
    if (!found || found.length !== l.original.length || found.some((f, k) => f.value !== l.original[k])) return false;
    l.text = text;
    l.bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
    l.stamp = stamp(file);
    return true;
  } catch {
    return false;
  }
}
