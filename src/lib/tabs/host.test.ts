import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabView } from './state.svelte';

// The host is driven here with the few page globals it touches stubbed by hand (Node has no DOM). `$effect.root` is inert under
// Node, so `mine` is read once, when the host boots; what a live reader does to `mine` afterwards is for a browser to show.
vi.mock('../../main', () => ({ unmountReader: vi.fn() }));

const ORIGIN = 'https://ipynb.example';

interface Frame {
  className: string;
  title: string;
  src: string;
  inert: boolean;
  on: boolean;
  classList: { toggle(name: string, force?: boolean): boolean };
  contentWindow: { postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> };
  remove: ReturnType<typeof vi.fn>;
}

interface Start {
  /** What the reader in this page has put in `mine` before the host boots. */
  mine?: { name?: string; link?: string; status?: 'loading' | 'ready' | 'error'; dirty?: boolean; key?: string };
  /** False leaves the host unstarted, as it is until the first tab call. */
  boot?: boolean;
}

async function world(href = `${ORIGIN}/`, start: Start = {}) {
  vi.resetModules();
  vi.useFakeTimers();

  const loc = {
    href,
    origin: ORIGIN,
    assign: vi.fn(),
    get pathname() {
      return new URL(this.href).pathname;
    },
    get search() {
      return new URL(this.href).search;
    },
  };
  const trail: { state: unknown; href: string }[] = [];
  const history = {
    replaceState: vi.fn((state: unknown, _title: string, url?: string) => {
      if (url !== undefined) loc.href = new URL(url, loc.href).href;
      trail.push({ state, href: loc.href });
    }),
    pushState: vi.fn(),
  };
  const store = new Map<string, string>();
  const session = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  const attached: Frame[] = [];
  const made: Frame[] = [];
  const makeFrame = (): Frame => {
    const f: Frame = {
      className: '',
      title: '',
      src: '',
      inert: false,
      on: false,
      classList: {
        toggle: (name, force) => {
          const next = force ?? !f.on;
          if (name === 'on') f.on = next;
          return next;
        },
      },
      contentWindow: { postMessage: vi.fn(), focus: vi.fn() },
      remove: vi.fn(() => {
        const i = attached.indexOf(f);
        if (i >= 0) attached.splice(i, 1);
      }),
    };
    made.push(f);
    return f;
  };
  const app = { inert: false };
  const root = new Set<string>();
  const doc = {
    title: '',
    activeElement: { blur: vi.fn() },
    body: { append: (f: Frame) => void attached.push(f) },
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          const next = force ?? !root.has(name);
          if (next) root.add(name);
          else root.delete(name);
          return next;
        },
      },
    },
    createElement: () => makeFrame(),
    getElementById: (id: string) => (id === 'app' ? app : null),
  };
  const listeners: { type: string; fn: (e: unknown) => void }[] = [];
  const scrollTo = vi.fn();

  vi.stubGlobal('location', loc);
  vi.stubGlobal('history', history);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('addEventListener', (type: string, fn: (e: unknown) => void) => void listeners.push({ type, fn }));
  vi.stubGlobal('scrollTo', scrollTo);
  vi.stubGlobal('scrollY', 0);

  const state = await import('./state.svelte');
  const m = start.mine ?? {};
  Object.assign(state.mine, { name: m.name ?? '', link: m.link ?? '', status: m.status ?? 'ready', dirty: m.dirty ?? false, key: m.key ?? (m.link ? `link:${m.link}` : '') });
  const mod = await import('./host.svelte');
  const main = await import('../../main');
  const api = start.boot === false ? (undefined as never) : mod.boot();

  const stranger = { postMessage: vi.fn() };
  const w = {
    api,
    boot: mod.boot,
    state,
    main,
    loc,
    history,
    trail,
    store,
    doc,
    app,
    root,
    scrollTo,
    listeners,
    frames: attached,
    made,
    /** The address as the address bar shows it, without the origin. */
    addr: () => loc.href.slice(ORIGIN.length),
    list: (): TabView[] => state.strip.list,
    ids: () => state.strip.list.map((t) => t.id),
    names: () => state.strip.list.map((t) => t.name),
    active: () => state.strip.active,
    stored: () => store.get('tabs'),
    lastState: () => trail[trail.length - 1]?.state,
    /** What the host posted to a frame, as [message, target origin]: all but the tab lists, or only those with `only`. */
    sent: (f: Frame, only?: string) => (f.contentWindow.postMessage.mock.calls as [Record<string, unknown>, string][]).filter(([m]) => (only ? m.t === only : m.t !== 'tabs')),
    stranger,
    /** A message event from `from` (a frame, or any window), as the browser delivers it. */
    msg: (from: Frame | { postMessage: unknown } | null, data: unknown, origin = ORIGIN) => {
      const source = from && 'contentWindow' in from ? from.contentWindow : from;
      for (const l of listeners) if (l.type === 'message') l.fn({ origin, source, data });
    },
    /** The frame named by this tab id: ids are handed out t1, t2, … in the order tabs are made. */
    frame: (id: string) => made[Number(id.slice(1)) - 1],
    hello(id: string) {
      this.msg(this.frame(id), { t: 'hello' });
    },
  };
  return w;
}
type World = Awaited<ReturnType<typeof world>>;

const nb = (name: string, size = 2, lastModified = 1) => new File(['x'.repeat(size)], name, { lastModified });
const url = (link: string) => `/?url=${encodeURIComponent(link)}`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('boot', () => {
  it('is idempotent: a second call returns the same host and adds no second listener', async () => {
    const w = await world();
    expect(w.boot()).toBe(w.api);
    expect(w.boot()).toBe(w.api);
    expect(w.listeners.filter((l) => l.type === 'message')).toHaveLength(1);
  });

  it('makes this page the first tab, named by its reader, else by the address', async () => {
    const named = await world(`${ORIGIN}/?url=x`, { mine: { name: 'mine.ipynb' } });
    named.api.open([{ link: 'a.ipynb' }]);
    expect(named.list()[0]).toMatchObject({ id: 'h', name: 'mine.ipynb', status: 'ready', dirty: false, web: false });

    const bare = await world(`${ORIGIN}/?url=${encodeURIComponent('https://x.example/d/z%20q.ipynb')}`, { mine: { link: 'https://x.example/d/z%20q.ipynb', status: 'loading' } });
    bare.api.open([{ link: 'a.ipynb' }]);
    expect(bare.list()[0]).toMatchObject({ id: 'h', name: 'z q.ipynb', status: 'loading', web: true });

    const none = await world();
    none.api.open([{ link: 'a.ipynb' }]);
    expect(none.list()[0].name).toBe('notebook');
  });

  it('shows nothing and posts nothing until a second tab opens', async () => {
    const w = await world();
    expect(w.list()).toEqual([]);
    expect(w.made).toHaveLength(0);
    expect(w.history.replaceState).not.toHaveBeenCalled();
    expect(w.stored()).toBeUndefined();
  });
});

describe('label, as a tab is named from its link', () => {
  const nameOf = async (link: string) => {
    const w = await world();
    w.api.open([{ link }]);
    return w.names()[1];
  };

  it('takes the last path segment, without the query or the fragment', async () => {
    expect(await nameOf('https://x.example/a/b/nb.ipynb?x=1#frag')).toBe('nb.ipynb');
    expect(await nameOf('cooling-coffee.ipynb?copy=2')).toBe('cooling-coffee.ipynb');
    expect(await nameOf('cooling-coffee.ipynb#cell-3')).toBe('cooling-coffee.ipynb');
  });

  it('decodes percent-escapes', async () => {
    expect(await nameOf('https://x.example/my%20notes%2Fv2.ipynb')).toBe('my notes/v2.ipynb');
  });

  it('skips empty segments, so a trailing slash does not hide the name', async () => {
    expect(await nameOf('https://x.example/a/nb.ipynb/')).toBe('nb.ipynb');
    expect(await nameOf('https://x.example//a//nb.ipynb')).toBe('nb.ipynb');
  });

  it('says "notebook" when no segment is left', async () => {
    expect(await nameOf('?copy=2')).toBe('notebook');
    expect(await nameOf('#frag')).toBe('notebook');
    expect(await nameOf('/')).toBe('notebook');
  });

  it('says "notebook" when the name is not valid percent-encoding', async () => {
    expect(await nameOf('https://x.example/%E0%A4%A.ipynb')).toBe('notebook');
    expect(await nameOf('https://x.example/100%.ipynb')).toBe('notebook');
  });

  it('names a file tab by the file', async () => {
    const w = await world();
    w.api.open([{ file: nb('mine.ipynb') }]);
    expect(w.names()[1]).toBe('mine.ipynb');
    expect(w.frame('t1').title).toBe('mine.ipynb');
  });
});

describe('open', () => {
  it('makes a frame per new notebook and goes to the last one', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { file: nb('b.ipynb') }]);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
    expect(w.active()).toBe('t2');
    expect(w.frames).toHaveLength(2);
    expect(w.frames.map((f) => f.className)).toEqual(['tb-frame', 'tb-frame']);
  });

  it('puts the link first in a frame address, then the tab', async () => {
    const w = await world();
    w.api.open([{ link: 'https://x.example/a b.ipynb?q=1' }, { file: nb('b.ipynb') }]);
    expect(w.frame('t1').src).toBe(`./?url=${encodeURIComponent('https://x.example/a b.ipynb?q=1')}&tab=t1`);
    expect(w.frame('t2').src).toBe('./?tab=t2');
  });

  it('starts a frame inert, then lets only the active one be reached', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }], true);
    expect(w.frame('t1').inert).toBe(true);
    expect(w.frame('t1').on).toBe(false);
    expect(w.active()).toBe('h');
    w.api.open([{ link: 'b.ipynb' }]);
    expect(w.frame('t1').inert).toBe(true);
    expect(w.frame('t2').inert).toBe(false);
    expect(w.frame('t2').on).toBe(true);
  });

  it('does not switch tabs when quiet', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }], true);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
    expect(w.active()).toBe('h');
    expect(w.app.inert).toBe(false);
  });

  it('opens a link that is already open as the same tab, and goes to it', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.api.open([{ link: 'b.ipynb' }]);
    expect(w.active()).toBe('t2');
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
    expect(w.frames).toHaveLength(2);
    expect(w.active()).toBe('t1');
  });

  it('dedupes by file name, size and modified time', async () => {
    const w = await world();
    w.api.open([{ file: nb('a.ipynb', 4, 10) }]);
    w.api.open([{ file: nb('a.ipynb', 4, 10) }]);
    expect(w.ids()).toEqual(['h', 't1']);
    for (const other of [nb('a.ipynb', 5, 10), nb('a.ipynb', 4, 11), nb('b.ipynb', 4, 10)]) w.api.open([{ file: other }]);
    expect(w.ids()).toEqual(['h', 't1', 't2', 't3', 't4']);
  });

  it('dedupes within one call', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'a.ipynb' }, { file: nb('f.ipynb') }, { file: nb('f.ipynb') }]);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
    expect(w.active()).toBe('t2');
  });

  it('dedupes against the notebook this page is already showing', async () => {
    const w = await world(`${ORIGIN}/?url=a.ipynb`, { mine: { link: 'a.ipynb', name: 'a.ipynb' } });
    w.api.open([{ link: 'b.ipynb' }]);
    expect(w.active()).toBe('t1');
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.ids()).toEqual(['h', 't1']);
    expect(w.active()).toBe('h');
  });

  it('treats the same text as a link and as a file as different notebooks', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { file: nb('a.ipynb') }]);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
  });

  it('skips a want that names neither a link nor a file, and does not change tab for it', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.api.go('h');
    w.api.open([{}, { asked: true }, { link: '' }]);
    expect(w.ids()).toEqual(['h', 't1']);
    expect(w.active()).toBe('h');
  });

  it('starts one host when the first calls arrive together, and the same file twice is one tab', async () => {
    const w = await world(`${ORIGIN}/`, { boot: false });
    const file = nb('a.ipynb');
    // two opens before the host chunk has loaded, as two presses of the open key would make
    w.state.act.open([{ file }]);
    w.state.act.open([{ file }]);
    await vi.dynamicImportSettled();
    expect(w.listeners.filter((l) => l.type === 'message')).toHaveLength(1);
    expect(w.ids()).toEqual(['h', 't1']);
    expect(w.frames).toHaveLength(1);
    expect(w.active()).toBe('t1');
  });

  it('marks a frame that never says hello as failed after 15 seconds, and keeps it closable', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.list()[1].status).toBe('loading');
    vi.advanceTimersByTime(14_999);
    expect(w.list()[1].status).toBe('loading');
    vi.advanceTimersByTime(1);
    expect(w.list()[1].status).toBe('error');
    await w.api.close('t1');
    expect(w.ids()).toEqual(['h']);
  });

  it('does not fail a frame that said hello in time', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.hello('t1');
    vi.advanceTimersByTime(60_000);
    expect(w.list()[1].status).toBe('loading');
  });
});

describe('go and step', () => {
  it('shows one frame, hides the page behind it, and says so on the root', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    expect(w.active()).toBe('t2');
    expect(w.frames.map((f) => [f.on, f.inert])).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(w.app.inert).toBe(true);
    expect(w.root.has('tb-away')).toBe(true);
    w.api.go('t1');
    expect(w.frames.map((f) => [f.on, f.inert])).toEqual([
      [true, false],
      [false, true],
    ]);
    w.api.go('h');
    expect(w.frames.map((f) => [f.on, f.inert])).toEqual([
      [false, true],
      [false, true],
    ]);
    expect(w.app.inert).toBe(false);
    expect(w.root.has('tb-away')).toBe(false);
  });

  it('puts keyboard focus in the frame it shows, and takes it out of the page on return', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.frame('t1').contentWindow.focus).toHaveBeenCalledTimes(1);
    w.api.go('h');
    expect(w.doc.activeElement.blur).toHaveBeenCalledTimes(1);
  });

  it('gives the page back the scroll position it left', async () => {
    const w = await world();
    vi.stubGlobal('scrollY', 640);
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.scrollTo).not.toHaveBeenCalled();
    vi.stubGlobal('scrollY', 0);
    w.api.go('h');
    expect(w.scrollTo).toHaveBeenLastCalledWith(0, 640);
  });

  it('does not take the scroll position from a frame that is shown, only from the page', async () => {
    const w = await world();
    vi.stubGlobal('scrollY', 300);
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    vi.stubGlobal('scrollY', 0);
    w.api.go('t1');
    w.api.go('h');
    expect(w.scrollTo).toHaveBeenLastCalledWith(0, 300);
  });

  it('ignores a tab that does not exist', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.api.go('t9');
    expect(w.active()).toBe('t1');
  });

  it('steps both ways and wraps around', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }], true);
    w.api.step(1);
    expect(w.active()).toBe('t1');
    w.api.step(1);
    expect(w.active()).toBe('t2');
    w.api.step(1);
    expect(w.active()).toBe('h');
    w.api.step(-1);
    expect(w.active()).toBe('t2');
    w.api.step(-1);
    expect(w.active()).toBe('t1');
  });

  it('does nothing with fewer than two tabs', async () => {
    const w = await world();
    w.api.step(1);
    expect(w.active()).toBe('h');
    expect(w.list()).toEqual([]);
  });

  it('follows the active tab in the title, with a dot for unsaved edits', async () => {
    const w = await world(`${ORIGIN}/`, { mine: { name: 'one.ipynb' } });
    w.api.open([{ link: 'two.ipynb' }]);
    expect(w.doc.title).toBe('two.ipynb · ipynb viewer');
    w.api.go('h');
    expect(w.doc.title).toBe('one.ipynb · ipynb viewer');
    w.hello('t1');
    w.msg(w.frame('t1'), { t: 'state', name: 'two.ipynb', status: 'ready', dirty: true, key: 'link:two.ipynb' });
    expect(w.doc.title).toBe('one.ipynb · ipynb viewer');
    w.api.go('t1');
    expect(w.doc.title).toBe('• two.ipynb · ipynb viewer');
  });
});

describe('the address (C3)', () => {
  it('1: names the active tab when it has a link, with the link marked as asked', async () => {
    const w = await world(`${ORIGIN}/?url=a.ipynb`, { mine: { link: 'a.ipynb', name: 'a.ipynb' } });
    w.api.open([{ link: 'https://x.example/b.ipynb?q=1' }]);
    expect(w.addr()).toBe(url('https://x.example/b.ipynb?q=1'));
    expect(w.lastState()).toEqual({ asked: 'https://x.example/b.ipynb?q=1' });
    w.api.go('h');
    expect(w.addr()).toBe(url('a.ipynb'));
    expect(w.lastState()).toEqual({ asked: 'a.ipynb' });
  });

  it('1: puts the link in the address as one encoded value', async () => {
    const w = await world();
    w.api.open([{ link: 'cooling-coffee.ipynb?copy=2' }]);
    expect(w.addr()).toBe('/?url=cooling-coffee.ipynb%3Fcopy%3D2');
  });

  it('2: returns to the first address when the first tab, carried in #nb=, is active', async () => {
    const w = await world(`${ORIGIN}/#nb=abc123`);
    w.api.open([{ link: 'b.ipynb' }]);
    expect(w.addr()).toBe(url('b.ipynb'));
    w.api.go('h');
    expect(w.addr()).toBe('/#nb=abc123');
    expect(w.lastState()).toBeNull();
  });

  it('3: names the first link tab when the active tab has none', async () => {
    const w = await world();
    w.api.open([{ file: nb('f.ipynb') }, { link: 'first.ipynb' }, { link: 'second.ipynb' }], true);
    expect(w.addr()).toBe(url('first.ipynb'));
    expect(w.lastState()).toEqual({ asked: 'first.ipynb' });
    w.api.go('t1');
    expect(w.addr()).toBe(url('first.ipynb'));
    w.api.go('t3');
    expect(w.addr()).toBe(url('second.ipynb'));
    w.api.go('h');
    expect(w.addr()).toBe(url('first.ipynb'));
  });

  it('3: takes the first link in list order, not in the order they were opened', async () => {
    const w = await world();
    w.api.open([{ link: 'late.ipynb' }, { file: nb('f.ipynb') }], true);
    w.api.restore(['early.ipynb', 'late.ipynb'], '');
    expect(w.ids()).toEqual(['h', 't2', 't3', 't1']);
    w.api.go('t2');
    expect(w.addr()).toBe(url('early.ipynb'));
  });

  it('4: returns to the first address when a #nb= notebook is open and no tab has a link', async () => {
    const w = await world(`${ORIGIN}/#nb=abc123`);
    w.api.open([{ file: nb('f.ipynb') }]);
    expect(w.active()).toBe('t1');
    expect(w.addr()).toBe('/#nb=abc123');
    expect(w.history.replaceState).not.toHaveBeenCalled();
  });

  it('4: and drops a closed link tab from it, so a reload does not bring the link back', async () => {
    const w = await world(`${ORIGIN}/#nb=abc123`);
    w.api.open([{ file: nb('f.ipynb') }, { link: 'gone.ipynb' }]);
    expect(w.addr()).toBe(url('gone.ipynb'));
    await w.api.close('t2');
    expect(w.active()).toBe('t1');
    expect(w.addr()).toBe('/#nb=abc123');
  });

  it('5: otherwise names only the page', async () => {
    const w = await world();
    w.api.open([{ file: nb('f.ipynb') }, { file: nb('g.ipynb') }]);
    expect(w.addr()).toBe('/');
    expect(w.history.replaceState).not.toHaveBeenCalled();
  });

  it('5: after the last link tab is closed beside a file tab, a reload does not bring it back', async () => {
    const w = await world();
    w.api.open([{ file: nb('f.ipynb') }, { link: 'gone.ipynb' }]);
    expect(w.addr()).toBe(url('gone.ipynb'));
    expect(w.stored()).toBe('["gone.ipynb"]');
    await w.api.close('t2');
    expect(w.ids()).toEqual(['h', 't1']);
    expect(w.addr()).toBe('/');
    expect(w.stored()).toBeUndefined();
  });

  it('5: drops the last link even when the closed tab was not the active one', async () => {
    const w = await world();
    w.api.open([{ link: 'gone.ipynb' }, { file: nb('f.ipynb') }]);
    expect(w.active()).toBe('t2');
    expect(w.addr()).toBe(url('gone.ipynb'));
    await w.api.close('t1');
    expect(w.active()).toBe('t2');
    expect(w.addr()).toBe('/');
  });

  it('never adds a history entry', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    w.api.go('h');
    expect(w.history.pushState).not.toHaveBeenCalled();
    expect(w.history.replaceState).toHaveBeenCalled();
  });

  it('writes the address only when it changes', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    const writes = w.history.replaceState.mock.calls.length;
    w.api.go('t1');
    w.api.go('t1');
    w.hello('t1');
    expect(w.history.replaceState.mock.calls.length).toBe(writes);
  });
});

describe('sessionStorage', () => {
  it('holds only the link addresses, in list order', async () => {
    const w = await world(`${ORIGIN}/?url=h.ipynb`, { mine: { link: 'h.ipynb', name: 'h.ipynb' } });
    w.api.open([{ file: nb('f.ipynb') }, { link: 'https://x.example/a.ipynb?t=secret' }]);
    expect(JSON.parse(w.stored()!)).toEqual(['h.ipynb', 'https://x.example/a.ipynb?t=secret']);
    expect([...w.store.keys()]).toEqual(['tabs']);
  });

  it('is removed when no link is left', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    expect(w.stored()).toBe('["a.ipynb"]');
    await w.api.close('t1');
    expect(w.stored()).toBeUndefined();
  });

  it('does not stop the tabs working when storage throws', async () => {
    const w = await world();
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(() => w.api.open([{ link: 'a.ipynb' }])).not.toThrow();
    expect(w.ids()).toEqual(['h', 't1']);
  });

  it('learns a frame link from its key, so a link typed into a frame is kept', async () => {
    const w = await world();
    w.api.open([{ file: nb('f.ipynb') }]);
    w.hello('t1');
    expect(w.stored()).toBeUndefined();
    w.msg(w.frame('t1'), { t: 'state', name: 'z.ipynb', status: 'ready', dirty: false, key: 'link:https://x.example/z.ipynb' });
    expect(w.stored()).toBe('["https://x.example/z.ipynb"]');
    expect(w.list()[1].web).toBe(true);
    w.msg(w.frame('t1'), { t: 'state', name: 'z.ipynb', status: 'ready', dirty: false, key: 'file:z.ipynb:3:4' });
    expect(w.list()[1].web).toBe(false);
    expect(w.stored()).toBeUndefined();
  });
});

describe('restore', () => {
  it('brings the other links back quietly, with h at its saved place', async () => {
    const w = await world(`${ORIGIN}/?url=b`, { mine: { link: 'b', name: 'b' } });
    w.api.restore(['a', 'b', 'c'], 'b');
    expect(w.list().map((t) => [t.id, t.name, t.web])).toEqual([
      ['t1', 'a', true],
      ['h', 'b', true],
      ['t2', 'c', true],
    ]);
    expect(w.active()).toBe('h');
    expect(w.app.inert).toBe(false);
  });

  it('keeps h first when it was saved first, and last when it was saved last', async () => {
    const first = await world(`${ORIGIN}/?url=a`, { mine: { link: 'a', name: 'a' } });
    first.api.restore(['a', 'b', 'c'], 'a');
    expect(first.names()).toEqual(['a', 'b', 'c']);
    const last = await world(`${ORIGIN}/?url=c`, { mine: { link: 'c', name: 'c' } });
    last.api.restore(['a', 'b', 'c'], 'c');
    expect(last.names()).toEqual(['a', 'b', 'c']);
    expect(last.ids()).toEqual(['t1', 't2', 'h']);
  });

  it('never opens a second tab for the link this page already shows', async () => {
    const w = await world(`${ORIGIN}/?url=b`, { mine: { link: 'b', name: 'b' } });
    w.api.restore(['a', 'b'], 'b');
    expect(w.ids()).toEqual(['t1', 'h']);
    expect(w.frames).toHaveLength(1);
    expect(w.made.map((f) => f.src)).toEqual(['./?url=a&tab=t1']);
  });

  it('opens a link saved twice once', async () => {
    const w = await world(`${ORIGIN}/?url=b`, { mine: { link: 'b', name: 'b' } });
    w.api.restore(['a', 'a', 'b'], 'b');
    expect(w.frames).toHaveLength(1);
    expect(w.ids()).toEqual(['t1', 'h']);
  });

  it('puts h first when its own notebook was not a saved link', async () => {
    const w = await world(`${ORIGIN}/`, { mine: { name: 'f.ipynb' } });
    w.api.restore(['a', 'b'], '');
    expect(w.ids()).toEqual(['h', 't1', 't2']);
  });

  it('marks the restored links as asked, so a reload asks nothing again', async () => {
    const w = await world(`${ORIGIN}/?url=b`, { mine: { link: 'b', name: 'b' } });
    w.api.restore(['a', 'b'], 'b');
    w.hello('t1');
    expect(w.sent(w.frame('t1'))).toEqual([[{ t: 'link', asked: true }, ORIGIN]]);
  });

  it('writes the whole list back after the first sync rewrote it', async () => {
    const w = await world(`${ORIGIN}/?url=b`, { mine: { link: 'b', name: 'b' } });
    w.store.set('tabs', '["a","b","c"]');
    w.api.restore(JSON.parse(w.store.get('tabs')!), 'b');
    expect(JSON.parse(w.stored()!)).toEqual(['a', 'b', 'c']);
  });
});

describe('close', () => {
  it('closes a frame that is not ready at once, and moves to its neighbour', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    w.api.go('t1');
    await w.api.close('t1');
    expect(w.ids()).toEqual(['h', 't2']);
    expect(w.active()).toBe('t2');
    expect(w.made[0].remove).toHaveBeenCalledTimes(1);
  });

  it('moves to the tab before when the last one is closed', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    await w.api.close('t2');
    expect(w.active()).toBe('t1');
    expect(w.frame('t1').on).toBe(true);
  });

  it('keeps the active tab when another one closes', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    await w.api.close('t1');
    expect(w.active()).toBe('t2');
  });

  it('cancels the load timer of a frame it closes', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    expect(vi.getTimerCount()).toBe(2);
    await w.api.close('t1');
    expect(vi.getTimerCount()).toBe(1);
    w.hello('t2');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('asks a ready frame first and closes it on a yes', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.hello('t1');
    const done = w.api.close('t1');
    expect(w.sent(w.frame('t1')).at(-1)).toEqual([{ t: 'close?' }, ORIGIN]);
    expect(w.ids()).toEqual(['h', 't1']);
    w.msg(w.frame('t1'), { t: 'close!', ok: true });
    await done;
    expect(w.ids()).toEqual(['h']);
  });

  it('keeps a ready frame on a no, or on anything that is not exactly true', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.hello('t1');
    for (const ok of [false, 'true', 1, undefined, null]) {
      const done = w.api.close('t1');
      w.msg(w.frame('t1'), { t: 'close!', ok });
      await done;
      expect(w.ids(), String(ok)).toEqual(['h', 't1']);
    }
  });

  it('asks only once while a question is open', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.hello('t1');
    const first = w.api.close('t1');
    await w.api.close('t1');
    expect(w.sent(w.frame('t1')).filter(([m]) => m.t === 'close?')).toHaveLength(1);
    w.msg(w.frame('t1'), { t: 'close!', ok: true });
    await first;
    expect(w.ids()).toEqual(['h']);
  });

  it('takes a close! answer only from the frame that was asked', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }]);
    w.hello('t1');
    w.hello('t2');
    let settled = false;
    const done = w.api.close('t1').then(() => (settled = true));
    w.msg(w.frame('t2'), { t: 'close!', ok: true });
    w.msg(w.stranger, { t: 'close!', ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(w.ids()).toEqual(['h', 't1', 't2']);
    w.msg(w.frame('t1'), { t: 'close!', ok: true });
    await done;
    expect(w.ids()).toEqual(['h', 't2']);
  });

  it('lets a frame that reloads itself (hello again) answer yes to a pending question', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.hello('t1');
    const done = w.api.close('t1');
    w.hello('t1');
    await done;
    expect(w.ids()).toEqual(['h']);
  });

  it('asks this page for permission to close itself, and stays when it says no', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    w.state.hooks.keep = () => true;
    await w.api.close('h');
    expect(w.ids()).toEqual(['h', 't1']);
    expect(w.main.unmountReader).not.toHaveBeenCalled();
  });

  it('closes this page’s own notebook through the reader, not by removing a frame', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    await w.api.close('h');
    expect(w.main.unmountReader).toHaveBeenCalledTimes(1);
    expect(w.ids()).toEqual(['t1']);
    expect(w.active()).toBe('t1');
  });

  it('moves on to the next tab when this page\u2019s own notebook was the one on show', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb' }], true);
    await w.api.close('h');
    expect(w.ids()).toEqual(['t1', 't2']);
    expect(w.active()).toBe('t1');
    expect(w.frame('t1').on).toBe(true);
    expect(w.frame('t1').inert).toBe(false);
    expect(w.root.has('tb-away')).toBe(true);
    expect(w.addr()).toBe(url('a.ipynb'));
  });

  it('ignores a tab that does not exist', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }]);
    await w.api.close('t7');
    expect(w.ids()).toEqual(['h', 't1']);
  });

  it('goes to the landing page when nothing is left', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }], true);
    await w.api.close('t1');
    await w.api.close('h');
    expect(w.loc.assign).toHaveBeenCalledWith('/');
    expect(w.stored()).toBeUndefined();
  });
});

describe('messages from frames', () => {
  const opened = async (...links: string[]) => {
    const w = await world();
    w.api.open(links.map((link) => ({ link })));
    return w;
  };
  const unchanged = (w: World, act: () => void) => {
    const before = JSON.stringify(w.list());
    const sent = w.made.map((f) => f.contentWindow.postMessage.mock.calls.length);
    const tabs = w.ids().length;
    const writes = w.history.replaceState.mock.calls.length;
    act();
    expect(JSON.stringify(w.list())).toBe(before);
    expect(w.made.map((f) => f.contentWindow.postMessage.mock.calls.length)).toEqual(sent);
    expect(w.ids()).toHaveLength(tabs);
    expect(w.history.replaceState.mock.calls.length).toBe(writes);
  };

  it('answers hello with the file it holds for that tab, once', async () => {
    const w = await world();
    const file = nb('f.ipynb');
    w.api.open([{ file }]);
    w.hello('t1');
    expect(w.sent(w.frame('t1'))).toEqual([[{ t: 'file', file, handle: undefined }, ORIGIN]]);
    expect(w.sent(w.frame('t1'))[0][0].file).toBe(file);
  });

  it('answers hello with link, and asked only when the tab was opened as asked', async () => {
    const w = await world();
    w.api.open([{ link: 'a.ipynb' }, { link: 'b.ipynb', asked: true }, { link: 'c.ipynb', asked: false }]);
    for (const id of ['t1', 't2', 't3']) w.hello(id);
    expect(w.sent(w.frame('t1'))).toEqual([[{ t: 'link', asked: false }, ORIGIN]]);
    expect(w.sent(w.frame('t2'))).toEqual([[{ t: 'link', asked: true }, ORIGIN]]);
    expect(w.sent(w.frame('t3'))).toEqual([[{ t: 'link', asked: false }, ORIGIN]]);
  });

  it('answers a second hello (a frame that reloaded itself) with link asked:false, never the file again (C6)', async () => {
    const w = await world();
    const file = nb('f.ipynb');
    w.api.open([{ file }, { link: 'b.ipynb', asked: true }]);
    w.hello('t1');
    w.hello('t2');
    w.hello('t1');
    w.hello('t2');
    expect(w.sent(w.frame('t1')).map(([m]) => m)).toEqual([{ t: 'file', file, handle: undefined }, { t: 'link', asked: false }]);
    expect(w.sent(w.frame('t2')).map(([m]) => m)).toEqual([
      { t: 'link', asked: true },
      { t: 'link', asked: false },
    ]);
  });

  it('tells every ready frame the tab list, as plain data, and no frame that is not ready', async () => {
    const w = await opened('a.ipynb', 'b.ipynb');
    w.hello('t1');
    const tabsMsg = w.sent(w.frame('t1'), 'tabs').at(-1)!;
    expect(tabsMsg[1]).toBe(ORIGIN);
    expect(tabsMsg[0].active).toBe('t2');
    expect(tabsMsg[0].list).toEqual([
      { id: 'h', name: 'notebook', status: 'ready', dirty: false, web: false },
      { id: 't1', name: 'a.ipynb', status: 'loading', dirty: false, web: true },
      { id: 't2', name: 'b.ipynb', status: 'loading', dirty: false, web: true },
    ]);
    expect(w.sent(w.frame('t2'), 'tabs')).toEqual([]);
    expect(structuredClone(tabsMsg[0])).toEqual(tabsMsg[0]);
  });

  it('only ever posts to its own origin', async () => {
    const w = await opened('a.ipynb', 'b.ipynb');
    w.hello('t1');
    w.hello('t2');
    w.msg(w.frame('t1'), { t: 'state', name: 'x', status: 'ready', dirty: true, key: '' });
    w.api.go('t1');
    const all = w.made.flatMap((f) => w.sent(f));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every(([, origin]) => origin === ORIGIN)).toBe(true);
  });

  it('ignores a message from another origin', async () => {
    const w = await opened('a.ipynb', 'b.ipynb');
    w.hello('t1');
    unchanged(w, () => {
      for (const origin of ['https://evil.example', 'http://ipynb.example', 'https://ipynb.example:8443', 'null', '']) {
        w.msg(w.frame('t2'), { t: 'hello' }, origin);
        w.msg(w.frame('t2'), { t: 'state', name: 'evil', status: 'ready', dirty: true, key: 'link:evil' }, origin);
        w.msg(w.frame('t2'), { t: 'open', wants: [{ link: 'evil.ipynb' }] }, origin);
        w.msg(w.frame('t2'), { t: 'go', id: 't1' }, origin);
        w.msg(w.frame('t2'), { t: 'step', by: 1 }, origin);
        w.msg(w.frame('t1'), { t: 'close', id: 't2' }, origin);
      }
    });
  });

  it('ignores a message from a window that is not one of its frames', async () => {
    const w = await opened('a.ipynb');
    unchanged(w, () => {
      for (const from of [w.stranger, null, {} as never]) {
        w.msg(from, { t: 'hello' });
        w.msg(from, { t: 'state', name: 'evil', status: 'ready', dirty: false, key: 'link:evil' });
        w.msg(from, { t: 'open', wants: [{ link: 'evil.ipynb' }] });
        w.msg(from, { t: 'go', id: 'h' });
        w.msg(from, { t: 'close', id: 't1' });
      }
    });
    expect(w.frame('t1').contentWindow.postMessage).not.toHaveBeenCalled();
  });

  it('ignores a message from a frame it has closed', async () => {
    const w = await opened('a.ipynb', 'b.ipynb');
    const gone = w.frame('t1');
    await w.api.close('t1');
    unchanged(w, () => {
      w.msg(gone, { t: 'open', wants: [{ link: 'back.ipynb' }] });
      w.msg(gone, { t: 'hello' });
    });
  });

  it('ignores data that is not an object, or has no known type', async () => {
    const w = await opened('a.ipynb');
    unchanged(w, () => {
      for (const data of [undefined, null, 'hello', 5, true, [], {}, { t: 'nope' }, { t: 7 }, { type: 'hello' }, { t: 'tabs', list: [], active: 'h' }, { t: 'file' }, { t: 'link' }]) {
        w.msg(w.frame('t1'), data);
      }
    });
  });

  describe('state', () => {
    const good = { t: 'state', name: 'n.ipynb', status: 'ready', dirty: true, key: 'file:n.ipynb:1:2' };

    it('records name, status and unsaved edits', async () => {
      const w = await opened('a.ipynb');
      w.msg(w.frame('t1'), good);
      expect(w.list()[1]).toMatchObject({ name: 'n.ipynb', status: 'ready', dirty: true, web: false });
      expect(w.frame('t1').title).toBe('n.ipynb');
    });

    it('keeps the old name when the new one is empty', async () => {
      const w = await opened('a.ipynb');
      w.msg(w.frame('t1'), { ...good, name: '' });
      expect(w.list()[1].name).toBe('a.ipynb');
      expect(w.list()[1].dirty).toBe(true);
    });

    it('keeps the old key and link when the new key is empty', async () => {
      const w = await opened('a.ipynb');
      w.msg(w.frame('t1'), { ...good, key: '' });
      expect(w.list()[1].web).toBe(true);
      w.api.open([{ link: 'a.ipynb' }]);
      expect(w.ids()).toEqual(['h', 't1']);
    });

    it('ignores a name, key or dirty flag of the wrong type', async () => {
      const w = await opened('a.ipynb');
      unchanged(w, () => {
        for (const name of [undefined, null, 5, {}, ['x']]) w.msg(w.frame('t1'), { ...good, name });
        for (const key of [undefined, null, 5, {}]) w.msg(w.frame('t1'), { ...good, key });
        for (const dirty of [undefined, null, 'true', 1, 0, {}]) w.msg(w.frame('t1'), { ...good, dirty });
      });
    });

    it('ignores a status outside loading, ready and error', async () => {
      const w = await opened('a.ipynb');
      unchanged(w, () => {
        for (const status of [undefined, null, 'done', 'READY', '', 1, {}, 'constructor', '__proto__']) w.msg(w.frame('t1'), { ...good, status });
      });
    });

    it('does not let a frame name another tab', async () => {
      const w = await opened('a.ipynb', 'b.ipynb');
      w.msg(w.frame('t1'), { ...good, id: 't2', name: 'mine' });
      expect(w.names()).toEqual(['notebook', 'mine', 'b.ipynb']);
    });
  });

  describe('open', () => {
    it('ignores wants that are not a list', async () => {
      const w = await opened('a.ipynb');
      unchanged(w, () => {
        for (const wants of [undefined, null, 'a.ipynb', 5, { link: 'x.ipynb' }, { length: 1, 0: { link: 'x' } }]) w.msg(w.frame('t1'), { t: 'open', wants });
      });
    });

    it('drops entries that name no notebook', async () => {
      const w = await opened('a.ipynb');
      unchanged(w, () => {
        const junk = [null, undefined, 0, 'x.ipynb', [], {}, { link: 5 }, { link: null }, { link: {} }, { file: 'f.ipynb' }, { file: {} }, { file: { name: 'f', size: 1, lastModified: 1 } }, { asked: true }];
        w.msg(w.frame('t1'), { t: 'open', wants: junk });
      });
    });

    it('opens the good entries among the bad ones', async () => {
      const w = await opened('a.ipynb');
      const file = nb('f.ipynb');
      w.msg(w.frame('t1'), { t: 'open', wants: [null, { link: 5 }, { link: 'b.ipynb' }, 'junk', { file }, { file: 'no' }] });
      expect(w.ids()).toEqual(['h', 't1', 't2', 't3']);
      expect(w.names()).toEqual(['notebook', 'a.ipynb', 'b.ipynb', 'f.ipynb']);
      expect(w.active()).toBe('t3');
    });

    it('takes asked as true only when it is exactly true', async () => {
      const w = await opened('a.ipynb');
      const wants: object[] = ['true', 'yes', 1, undefined].map((asked, i) => ({ link: `l${i}.ipynb`, asked }));
      wants.push({ link: 'ok.ipynb', asked: true });
      w.msg(w.frame('t1'), { t: 'open', wants });
      for (const id of ['t2', 't3', 't4', 't5', 't6']) w.hello(id);
      expect(['t2', 't3', 't4', 't5', 't6'].map((id) => w.sent(w.frame(id))[0][0])).toEqual([
        { t: 'link', asked: false },
        { t: 'link', asked: false },
        { t: 'link', asked: false },
        { t: 'link', asked: false },
        { t: 'link', asked: true },
      ]);
    });

    it('drops a file handle that is not a file handle', async () => {
      const w = await opened('a.ipynb');
      class Handle {}
      vi.stubGlobal('FileSystemFileHandle', Handle);
      const real = new Handle();
      const file = nb('f.ipynb');
      const other = nb('g.ipynb');
      w.msg(w.frame('t1'), { t: 'open', wants: [{ file, handle: real }, { file: other, handle: { kind: 'file', getFile: () => other } }] });
      w.hello('t2');
      w.hello('t3');
      expect(w.sent(w.frame('t2'))[0][0].handle).toBe(real);
      expect(w.sent(w.frame('t3'))[0][0].handle).toBeUndefined();
    });

    it('drops every file handle where the browser has no such class', async () => {
      const w = await opened('a.ipynb');
      const file = nb('f.ipynb');
      w.msg(w.frame('t1'), { t: 'open', wants: [{ file, handle: {} }] });
      w.hello('t2');
      expect(w.sent(w.frame('t2'))[0][0].handle).toBeUndefined();
    });

    it('dedupes against the tabs it has', async () => {
      const w = await opened('a.ipynb');
      w.msg(w.frame('t1'), { t: 'open', wants: [{ link: 'a.ipynb' }] });
      expect(w.ids()).toEqual(['h', 't1']);
      expect(w.active()).toBe('t1');
    });
  });

  describe('go, step and close', () => {
    it('go needs a string id', async () => {
      const w = await opened('a.ipynb', 'b.ipynb');
      unchanged(w, () => {
        for (const id of [undefined, null, 1, {}, ['h'], true]) w.msg(w.frame('t1'), { t: 'go', id });
      });
      expect(w.active()).toBe('t2');
      w.msg(w.frame('t2'), { t: 'go', id: 'h' });
      expect(w.active()).toBe('h');
    });

    it('step needs exactly 1 or -1', async () => {
      const w = await opened('a.ipynb', 'b.ipynb');
      unchanged(w, () => {
        for (const by of [undefined, 0, 2, -2, '1', 1.5, null, NaN, Infinity]) w.msg(w.frame('t2'), { t: 'step', by });
      });
      w.msg(w.frame('t2'), { t: 'step', by: 1 });
      expect(w.active()).toBe('h');
      w.msg(w.frame('t2'), { t: 'step', by: -1 });
      expect(w.active()).toBe('t2');
    });

    it('close needs a string id', async () => {
      const w = await opened('a.ipynb', 'b.ipynb');
      unchanged(w, () => {
        for (const id of [undefined, null, 1, {}, ['t1'], true]) w.msg(w.frame('t2'), { t: 'close', id });
      });
      w.msg(w.frame('t2'), { t: 'close', id: 't1' });
      expect(w.ids()).toEqual(['h', 't2']);
    });
  });
});
