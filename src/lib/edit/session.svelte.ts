// Editing state that the reader shell and the cells share. Everything heavier loads on the first edit.

export interface Host {
  apply(id: string, source: string): void;
  /** The cell's source as it is now, or undefined when there is no such cell. */
  source(id: string): string | undefined;
  /** Reads the file text the edits will be patched into. False when it no longer matches what is on screen. */
  ensureBase(): Promise<boolean>;
  save(asNew?: boolean): Promise<void>;
}

export const session = $state({
  /** The open notebook can be edited. */
  on: false,
  /** Why not, in a sentence, when `on` is false. */
  why: '',
  /** The reason has been shown once for this notebook. */
  told: false,
  dirty: false,
  /** There is no file to write to (a notebook from a link), so saving makes a copy. */
  detached: false,
  saving: false,
  /** The file changed on disk after the edits began, so saving goes to a new file. */
  conflict: false,
  /** The cell that has an open editor. */
  active: null as string | null,
  /** Cells with unsaved edits, each with its source as it was before the first of them; replaced when a cell is added. */
  edited: new Map<string, string>() as ReadonlyMap<string, string>,
  /** Set by the open editor: commits what is typed without closing it. */
  flush: null as (() => void) | null,
});

interface Step {
  id: string;
  before: string;
  after: string;
}

let steps: Step[] = [];
let h: Host | null = null;

export const host = (next: Host | null) => void (h = next);
export const current = () => h;

const say = (text: string) => import('../notice').then((m) => m.say(text));

/** Replaces a cell's source, once, if the cell still holds what the edit began from. */
export function commit(id: string, before: string, after: string): boolean {
  if (before === after) return true;
  if (!h || h.source(id) !== before) {
    navigator.clipboard?.writeText(after).catch(() => {});
    say('That cell changed while you were editing. Your text is on the clipboard.');
    return false;
  }
  steps.push({ id, before, after });
  if (steps.length > 100) steps.shift();
  h.apply(id, after);
  session.dirty = true;
  if (!session.edited.has(id)) session.edited = new Map(session.edited).set(id, before);
  return true;
}

/** Takes back the last committed edit. False when there is nothing to take back. */
export function undo(): boolean {
  const s = steps.pop();
  if (!s || !h) return false;
  if (h.source(s.id) !== s.after) return false;
  h.apply(s.id, s.before);
  return true;
}

/** A new file, or a save: nothing is unsaved and nothing can be taken back. */
export function reset() {
  steps = [];
  session.dirty = false;
  session.conflict = false;
  session.edited = new Map();
}
