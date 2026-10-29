import './tabs.css';
import { fileKey, hooks, mine, strip, type Status, type Want } from './state.svelte';

// The tab host: the top page's tab list. The first notebook is the page's own reader (`h`); each further one runs the same
// reader in a frame of this page (`t1`, `t2`, …), which keeps its own policy, its own state and its own network lock.
export interface TabHost {
  open(wants: Want[], quiet?: boolean): void;
  go(id: string, x?: number): void;
  step(by: 1 | -1, x?: number): void;
  close(id: string): Promise<void>;
  restore(all: string[], own: string): void;
}

interface Rec {
  id: string;
  name: string;
  status: Status;
  dirty: boolean;
  key: string;
  link: string;
  frame?: HTMLIFrameElement;
  want?: Want;
  ready: boolean;
  /** Its strip is on screen, so showing it now cannot blink an empty header. The first notebook always is. */
  painted: boolean;
  born: number;
  timer?: ReturnType<typeof setTimeout>;
  asking?: (ok: boolean) => void;
}

const tabs: Rec[] = [];
let active = 'h';
// the tab on screen; `active` runs ahead of it while a new tab draws itself
let shown = 'h';
let pending: { id: string; timer: ReturnType<typeof setTimeout> } | undefined;
let n = 0;
// where the first notebook was scrolled to when another tab took over
let top = 0;
// how far the chips were scrolled when the tab was picked, handed on so the next page's strip starts there
let across = 0;
// the address this page began with: a notebook carried in `#nb=` can only come back from it
const first = location.href;
let api: TabHost | undefined;
let stopEffects: (() => void) | undefined;

const label = (link: string) => {
  const last = link.split(/[?#]/)[0].split('/').filter(Boolean).pop();
  try {
    return last ? decodeURIComponent(last) : 'notebook';
  } catch {
    return 'notebook';
  }
};
const find = (id: string) => tabs.find((r) => r.id === id);
const hostOf = (link: string) => {
  try {
    return new URL(link).host;
  } catch {
    return '';
  }
};
const post = (rec: Rec, msg: object) => rec.frame?.contentWindow?.postMessage(msg, location.origin);

// Only addresses are kept, and only for this browser tab's session: enough to bring the link tabs back after a reload.
function save() {
  try {
    const links = tabs.map((r) => r.link).filter(Boolean);
    if (links.length) sessionStorage.setItem('tabs', JSON.stringify(links));
    else sessionStorage.removeItem('tabs');
  } catch {
    /* storage blocked: nothing comes back after a reload */
  }
}

// The address names what a reload should bring back: the active link, else the first link left, else the page's own start.
function where() {
  const nb = !!find('h') && first.includes('#nb=');
  const cur = find(active)?.link;
  let link = '';
  if (cur) link = cur;
  else if (!(active === 'h' && nb)) link = tabs.find((r) => r.link)?.link ?? '';
  const target = link ? `${location.pathname}?url=${encodeURIComponent(link)}` : nb ? first : location.pathname;
  if (new URL(target, location.href).href !== location.href) history.replaceState(link ? { asked: link } : null, '', target);
}

function sync() {
  const views = tabs.map(({ id, name, status, dirty, link, born }) => ({ id, name, status, dirty, web: !!link, from: hostOf(link), born }));
  strip.list = views;
  strip.active = active;
  strip.x = across;
  for (const r of tabs) if (r.ready && r.frame) post(r, { t: 'tabs', list: views, active, x: across });
  const now = find(active);
  if (now) document.title = `${now.dirty ? '• ' : ''}${now.name} · ipynb viewer`;
  where();
  save();
}

function open(wants: Want[], quiet = false) {
  let target: Rec | undefined;
  for (const w of wants) {
    const key = w.link ? `link:${w.link}` : w.file ? fileKey(w.file) : '';
    if (!key) continue;
    let rec = tabs.find((r) => r.key === key);
    if (!rec) {
      const id = 't' + ++n;
      const name = w.file ? w.file.name : label(w.link!);
      const frame = document.createElement('iframe');
      frame.className = 'tb-frame';
      frame.title = name;
      frame.inert = true;
      frame.src = w.file ? `./?tab=${id}` : `./?url=${encodeURIComponent(w.link!)}&tab=${id}`;
      document.body.append(frame);
      const made: Rec = { id, name, status: 'loading', dirty: false, key, link: w.link ?? '', frame, want: w, ready: false, painted: false, born: Date.now() };
      // a frame that never says hello (offline with no copy, a crash) shows as failed and can be closed
      made.timer = setTimeout(() => {
        if (!made.ready) {
          made.status = 'error';
          sync();
        }
      }, 15_000);
      tabs.push(made);
      rec = made;
    }
    target = rec;
  }
  if (!quiet && target) go(target.id);
  else sync();
}

// Puts a tab on screen: its frame shows and takes the keyboard, the others are hidden and inert.
function show(id: string) {
  clearTimeout(pending?.timer);
  pending = undefined;
  const rec = find(id);
  if (!rec) return;
  if (shown === 'h' && id !== 'h') top = scrollY;
  shown = id;
  for (const r of tabs) {
    r.frame?.classList.toggle('on', r.id === id);
    if (r.frame) r.frame.inert = r.id !== id;
  }
  const app = document.getElementById('app');
  if (app) app.inert = id !== 'h';
  document.documentElement.classList.toggle('tb-away', id !== 'h');
  if (id === 'h') {
    scrollTo(0, top);
    (document.activeElement as HTMLElement | null)?.blur();
  } else rec.frame?.contentWindow?.focus();
}

// The strips follow at once; the page itself changes when the tab has drawn its header, so a new tab never shows an empty one (a tab that
// never says so is shown after a moment anyway).
function go(id: string, x?: number) {
  const rec = find(id);
  if (!rec) return;
  if (typeof x === 'number' && Number.isFinite(x)) across = x;
  active = id;
  sync();
  if (rec.painted || !rec.frame) return show(id);
  clearTimeout(pending?.timer);
  pending = { id, timer: setTimeout(() => show(id), 1200) };
}

function step(by: 1 | -1, x?: number) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex((r) => r.id === active);
  go(tabs[(i + by + tabs.length) % tabs.length].id, x);
}

async function close(id: string) {
  const rec = find(id);
  if (!rec) return;
  if (id === 'h') {
    if (hooks.keep()) return;
    stopEffects?.();
    (await import('../../main')).unmountReader();
  } else if (rec.ready) {
    // a question is already open in that tab
    if (rec.asking) return;
    // no timeout: the tab may be showing a confirm dialog
    const ok = await new Promise<boolean>((yes) => {
      rec.asking = yes;
      post(rec, { t: 'close?' });
    });
    rec.asking = undefined;
    if (!ok) return;
  }
  const i = tabs.indexOf(rec);
  if (i < 0) return;
  rec.frame?.remove();
  clearTimeout(rec.timer);
  tabs.splice(i, 1);
  if (!tabs.length) {
    save();
    location.assign(location.pathname);
  } else if (rec.id === active) go((tabs[i] ?? tabs[i - 1]).id);
  else {
    // the page on screen went while another was still drawing itself: show that one now
    if (rec.id === shown) show(active);
    sync();
  }
}

function onMessage(e: MessageEvent) {
  if (e.origin !== location.origin) return;
  const rec = tabs.find((r) => r.frame && r.frame.contentWindow === e.source);
  const d = e.data;
  if (!rec || !d || typeof d !== 'object') return;
  switch (d.t) {
    case 'hello': {
      clearTimeout(rec.timer);
      rec.ready = true;
      // a page that loads again draws its header again
      rec.painted = false;
      // a reloaded frame has nothing left to ask about
      rec.asking?.(true);
      const w = rec.want;
      rec.want = undefined;
      // a frame that reloads itself says hello again; its address was already marked as asked
      post(rec, w?.file ? { t: 'file', file: w.file, handle: w.handle } : { t: 'link', asked: w?.asked === true });
      sync();
      break;
    }
    case 'state': {
      const { name, status, dirty, key } = d;
      if (typeof name !== 'string' || typeof key !== 'string' || typeof dirty !== 'boolean') return;
      if (status !== 'loading' && status !== 'ready' && status !== 'error') return;
      if (name) {
        rec.name = name;
        if (rec.frame) rec.frame.title = name;
      }
      rec.status = status;
      rec.dirty = dirty;
      if (key) {
        rec.key = key;
        rec.link = key.startsWith('link:') ? key.slice(5) : '';
      }
      sync();
      break;
    }
    case 'open': {
      if (!Array.isArray(d.wants)) return;
      const wants: Want[] = [];
      for (const w of d.wants) {
        if (!w || typeof w !== 'object') continue;
        if (w.file instanceof File) {
          const handle = typeof FileSystemFileHandle !== 'undefined' && w.handle instanceof FileSystemFileHandle ? w.handle : undefined;
          wants.push({ file: w.file, handle });
        } else if (typeof w.link === 'string') wants.push({ link: w.link, asked: w.asked === true });
      }
      open(wants);
      break;
    }
    case 'go':
      if (typeof d.id === 'string') go(d.id, d.x);
      break;
    case 'close':
      if (typeof d.id === 'string') void close(d.id);
      break;
    case 'step':
      if (d.by === 1 || d.by === -1) step(d.by, d.x);
      break;
    case 'close!':
      rec.asking?.(d.ok === true);
      break;
    case 'painted':
      rec.painted = true;
      if (pending?.id === rec.id) show(rec.id);
      break;
  }
}

// After a reload: bring the other link tabs back in their saved order. `all` is the saved list (the first sync rewrites it),
// `own` is the link this page was opened with.
function restore(all: string[], own: string) {
  open(all.filter((l) => l !== own).map((link) => ({ link, asked: true })), true);
  const at = (r: Rec) => all.indexOf(r.id === 'h' ? own : r.link);
  tabs.sort((a, b) => at(a) - at(b));
  sync();
}

/** Starts the host on first call; later calls return it. */
export function boot(): TabHost {
  if (api) return api;
  tabs.push({
    id: 'h',
    name: mine.name || label(new URLSearchParams(location.search).get('url') ?? ''),
    status: mine.status,
    dirty: mine.dirty,
    key: mine.key,
    link: mine.link,
    ready: true,
    painted: true,
    born: 0,
  });
  addEventListener('message', onMessage);
  // this page's own reader reports through `mine`, as a frame's does by message
  stopEffects = $effect.root(() => {
    $effect(() => {
      const h = find('h');
      if (!h) return;
      if (mine.name) h.name = mine.name;
      h.status = mine.status;
      h.dirty = mine.dirty;
      h.key = mine.key;
      h.link = mine.link;
      sync();
    });
  });
  return (api = { open, go, step, close, restore });
}
