import './watch.css';
import { readNotebook, type Cell, type Notebook } from './notebook';

export interface Update {
  notebook: Notebook;
  /** Cells reuse their old object when nothing in them changed. */
  cells: Cell[];
  changed: Set<string>;
}

interface Handle {
  getFile(): Promise<File>;
}

const stamp = (f: File) => `${f.lastModified}:${f.size}`;

// Enough of a cell to tell whether it changed, without hashing megabytes of image data.
function sig(cell: Cell): string {
  let s = `${cell.type}\n${cell.source}`;
  if (cell.type === 'code') {
    for (const o of cell.outputs) {
      if (o.type === 'stream') s += `\n${o.name}${o.text}`;
      else if (o.type === 'error') s += `\n${o.ename}${o.evalue}`;
      else for (const [k, v] of Object.entries(o.data)) s += `\n${k}${typeof v === 'string' ? v.length + v.slice(0, 48) + v.slice(-48) : JSON.stringify(v)}`;
    }
  }
  return s;
}

/**
 * Polls the file once a second and reports a new reading once the writer has settled,
 * so a notebook saved in Jupyter or by an agent updates in place.
 */
export function watch(handle: Handle, first: File, current: () => Cell[], apply: (u: Update) => void): () => void {
  let seen = stamp(first);
  let pending = '';
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const file = await handle.getFile();
      const now = stamp(file);
      if (now === seen) return void (pending = '');
      if (now !== pending) return void (pending = now);
      const notebook = await readNotebook(file.stream());
      // A half-written file parses as a short notebook; wait for the next tick instead.
      if (notebook.warnings.some((w) => w.startsWith('The file ends early'))) return;
      seen = now;
      pending = '';
      const old = new Map(current().map((c) => [c.id, c]));
      const changed = new Set<string>();
      const cells = notebook.cells.map((c) => {
        const o = old.get(c.id);
        if (o && sig(o) === sig(c)) return o;
        changed.add(c.id);
        return c;
      });
      apply({ notebook, cells, changed });
    } catch {
      // the file moved or is mid-write; the next tick tries again
    } finally {
      busy = false;
    }
  }, 1000);
  return () => clearInterval(timer);
}

export interface Opened {
  file: File;
  handle?: FileSystemFileHandle;
}

/** The picker where the browser has one, which hands back a file that can be watched. */
export async function pick(): Promise<Opened | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({
      types: [{ description: 'Notebook', accept: { 'application/json': ['.ipynb', '.json'] } }],
    });
    return { file: await handle.getFile(), handle };
  } catch {
    return null; // closed without choosing
  }
}

/** A dropped file, with its handle when the browser offers one. */
export async function dropped(data: DataTransfer): Promise<Opened | null> {
  const handle = await data.items[0]?.getAsFileSystemHandle?.();
  if (handle?.kind === 'file') return { file: await (handle as FileSystemFileHandle).getFile(), handle: handle as FileSystemFileHandle };
  return data.files[0] ? { file: data.files[0] } : null;
}
