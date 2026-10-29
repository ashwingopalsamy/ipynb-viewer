// What the tab strip and the reader share. Small and inert: the host (host.svelte.ts) loads only when a second notebook opens.
export type Status = 'loading' | 'ready' | 'error';

/** One tab as a strip draws it. Plain data: it crosses postMessage. */
export interface TabView {
  id: string;
  name: string;
  status: Status;
  dirty: boolean;
  web: boolean;
  /** The host name of the link a web notebook came from; '' for a file or an address that is not a full link. */
  from: string;
  /** When the host opened it (ms since the epoch; 0 for the first notebook), so a chip that is new can come in. */
  born: number;
}

/** A notebook to open beside the others. */
export interface Want {
  file?: File;
  handle?: FileSystemFileHandle;
  link?: string;
  asked?: boolean;
}

/** What this page's own reader shows. Written by App.svelte; read by the host (top page) or sent to it (frame). */
export const mine = $state({ name: '', status: 'loading' as Status, dirty: false, key: '', link: '' });

/** The strip as this page draws it. `list` stays empty until the host starts; `me` is this page's tab id; `x` is how far the chips were scrolled when the active tab was picked. */
export const strip = $state({ list: [] as TabView[], active: 'h', me: 'h', x: 0 });

/** How far the chips on this page are scrolled; handed over with a switch so the next page's strip starts where this one is. */
export const here = () => document.querySelector<HTMLElement>('.bar .tb-row')?.scrollLeft;

const host = () => import('./host.svelte').then((m) => m.boot());

/** Calls made by chips, keys and openers. In the top page the first call loads the host; frame.svelte.ts replaces them in a frame. */
export const act = {
  open: (wants: Want[]) => void host().then((h) => h.open(wants)),
  go: (id: string, x?: number) => void host().then((h) => h.go(id, x)),
  step: (by: 1 | -1, x?: number) => void host().then((h) => h.step(by, x)),
  close: (id: string) => void host().then((h) => h.close(id)),
};

/** The reader's question before its notebook goes away (true means stay; App.svelte sets it), and the word a tab's page sends once its
 * strip is on screen (frame.svelte.ts sets it; the top page has nothing to tell). */
export const hooks = { keep: () => false, painted: () => {} };

/** A notebook's name as a chip shows it. */
export const bare = (name: string) => name.replace(/\.ipynb$/i, '');

/** A long name kept to about `most` characters by its two ends, cut at words, so names that share a beginning still differ. The end,
 * where versions and topics usually are, keeps the larger share. */
export const short = (name: string, most: number) => {
  const s = bare(name);
  if (s.length <= most) return s;
  const front = Math.round((most - 1) * 0.4);
  const head = s.slice(0, front).replace(/[\s\-_·.,]+\S{0,3}$/, '');
  const tail = s.slice(front + 1 - most).replace(/^\S{0,3}[\s\-_·.,]+/, '');
  return `${head}…${tail}`;
};

let pen: CanvasRenderingContext2D | null | undefined;
/** `short` at the most characters that fit `room` pixels in `font`: cut by its middle to fit, a name never also loses its end to an ellipsis. */
export const fit = (name: string, room: number, font: string) => {
  pen ??= document.createElement('canvas').getContext('2d');
  if (!pen) return short(name, 24);
  pen.font = font;
  for (let most = bare(name).length; most > 9; most--) {
    const s = short(name, most);
    if (pen.measureText(s).width <= room) return s;
  }
  return short(name, 9);
};

export const fileKey = (f: File) => `file:${f.name}:${f.size}:${f.lastModified}`;

/** The web addresses that were open as tabs before a reload, oldest first. */
export const saved = (): string[] => {
  try {
    const all = JSON.parse(sessionStorage.getItem('tabs') ?? '[]');
    return Array.isArray(all) ? all.filter((l): l is string => typeof l === 'string') : [];
  } catch {
    return [];
  }
};

// In development, an edit to this module or the host reloads the page: swapped in place, the reader would keep writing to the old copy.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
