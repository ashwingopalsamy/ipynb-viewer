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
let undone: Step[] = [];
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
  undone = [];
  h.apply(id, after);
  if (!session.edited.has(id)) session.edited = new Map(session.edited).set(id, before);
  settle(id, after);
  return true;
}

/** A cell back at the source it began from has nothing to save, and the notebook has nothing once every cell is. */
function settle(id: string, source: string) {
  if (session.edited.get(id) === source) {
    const next = new Map(session.edited);
    next.delete(id);
    session.edited = next;
  }
  session.dirty = session.edited.size > 0;
}

/** Takes back the last committed edit; the id of its cell, or null when there is nothing to take back. */
function undo(): string | null {
  const s = steps.pop();
  if (!s || !h) return null;
  if (h.source(s.id) !== s.after) return null;
  h.apply(s.id, s.before);
  settle(s.id, s.before);
  undone.push(s);
  return s.id;
}

/** Puts back the edit that was taken back last. */
function redo(): string | null {
  const s = undone.pop();
  if (!s || !h) return null;
  if (h.source(s.id) !== s.before) return null;
  h.apply(s.id, s.after);
  if (!session.edited.has(s.id)) session.edited = new Map(session.edited).set(s.id, s.before);
  settle(s.id, s.after);
  steps.push(s);
  return s.id;
}

/** Takes back (or, going forward, puts back) an edit, and shows where it was. False when there was none. */
export function rewind(forward = false): boolean {
  const id = forward ? redo() : undo();
  if (!id) return false;
  document.querySelector(`[data-cell="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  say(forward ? 'Put the edit back.' : 'Took back the last edit. ⇧⌘Z puts it back.');
  return true;
}

/** A new file, or a save: nothing is unsaved and nothing can be taken back. */
export function reset() {
  steps = [];
  undone = [];
  session.dirty = false;
  session.conflict = false;
  session.edited = new Map();
}
