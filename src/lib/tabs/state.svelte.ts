// What the tab strip and the reader share. Small and inert: the host (host.svelte.ts) loads only when a second notebook opens.
export type Status = 'loading' | 'ready' | 'error';

/** One tab as a strip draws it. Plain data: it crosses postMessage. */
export interface TabView {
  id: string;
  name: string;
  status: Status;
  dirty: boolean;
  web: boolean;
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

/** The strip as this page draws it. `list` stays empty until the host starts; `me` is this page's tab id. */
export const strip = $state({ list: [] as TabView[], active: 'h', me: 'h' });

const host = () => import('./host.svelte').then((m) => m.boot());

/** Calls made by chips, keys and openers. In the top page the first call loads the host; frame.svelte.ts replaces them in a frame. */
export const act = {
  open: (wants: Want[]) => void host().then((h) => h.open(wants)),
  go: (id: string) => void host().then((h) => h.go(id)),
  step: (by: 1 | -1) => void host().then((h) => h.step(by)),
  close: (id: string) => void host().then((h) => h.close(id)),
};

/** The reader's question before its notebook goes away: true means stay. App.svelte sets it. */
export const hooks = { keep: () => false };

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
