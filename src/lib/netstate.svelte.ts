import type { Cell } from './notebook';

// The reader's promise about the network, kept in one place: what the page may reach, what the reader has allowed,
// and a count of everything that did go out. The policy can only be tightened at run time, so it is tightened early.

export type Mode = 'ask' | 'never' | 'always';
export type Choice = 'none' | 'ask' | 'loaded' | 'blocked';
export interface Seen {
  host: string;
  path: string;
  /** Served from this device (the offline copy or the browser's cache), so nothing travelled. */
  local: boolean;
}

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // storage can be blocked; the choice then lasts for this visit only
    }
  },
};

const read = (): Mode => {
  const v = store.get('net');
  return v === 'never' || v === 'always' ? v : 'ask';
};

export const net = $state({
  mode: read(),
  choice: 'none' as Choice,
  name: '',
  hosts: [] as string[],
  pictures: 0,
  /** 0: nothing tightened yet; 1: connections cut; 2: connections cut and no picture from the web. */
  lock: 0 as 0 | 1 | 2,
  seen: [] as Seen[],
  blocked: [] as string[],
});

const IMG_MD = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^\s)>]+)/gi;
const IMG_HTML = /<img\b[^>]*?\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi;
const REACH = 300_000;

/** The web pictures a notebook points at, counted by site. Markdown and HTML outputs are read; code is not. */
export function remoteHosts(cells: readonly Cell[]): Map<string, number> {
  const found = new Map<string, number>();
  const scan = (text: unknown) => {
    if (typeof text !== 'string') return;
    for (const re of [IMG_MD, IMG_HTML]) {
      re.lastIndex = 0;
      for (const m of text.slice(0, REACH).matchAll(re)) {
        try {
          const host = new URL(m[1]).hostname;
          found.set(host, (found.get(host) ?? 0) + 1);
        } catch {
          // not an address
        }
      }
    }
  };
  for (const c of cells) {
    if (c.type === 'markdown') scan(c.source);
    else if (c.type === 'code') {
      for (const o of c.outputs) if (o.type === 'display' || o.type === 'result') (scan(o.data['text/html']), scan(o.data['text/markdown']));
    }
  }
  return found;
}

/** "a.com", "a.com and b.com", "a.com and 3 other sites". */
export const sites = (hosts: readonly string[]) => (hosts.length < 3 ? hosts.join(' and ') : `${hosts[0]} and ${hosts.length - 1} other sites`);

/** Narrows the page's own policy. Policies add up, so a later one can only take more away. */
export function lock(level: 1 | 2) {
  if (typeof document === 'undefined' || level <= net.lock) return;
  net.lock = level;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = level === 2 ? "connect-src 'none'; img-src 'self' data: blob:" : "connect-src 'none'";
  document.head.append(meta);
}

let watching = false;
let since = 0;
function watch() {
  if (watching || typeof PerformanceObserver === 'undefined') return;
  watching = true;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        if (e.startTime < since || net.seen.length > 200) continue;
        const u = new URL(e.name);
        net.seen.push({ host: u.host, path: u.pathname.length > 40 ? '…' + u.pathname.slice(-38) : u.pathname, local: u.origin === location.origin && e.transferSize === 0 });
      }
    }).observe({ type: 'resource' });
  } catch {
    // an old browser keeps no log; the sheet says so
  }
  document.addEventListener('securitypolicyviolation', (e) => {
    try {
      net.blocked.push(new URL(e.blockedURI).host || e.violatedDirective);
    } catch {
      net.blocked.push(e.violatedDirective);
    }
  });
}

const remembered = () => {
  try {
    return (JSON.parse(store.get('net-ok') ?? '{}') as Record<string, string>)[net.name] === net.hosts.join(',');
  } catch {
    return false;
  }
};

function remember() {
  try {
    const all = JSON.parse(store.get('net-ok') ?? '{}') as Record<string, string>;
    all[net.name] = net.hosts.join(',');
    store.set('net-ok', JSON.stringify(Object.fromEntries(Object.entries(all).slice(-50))));
  } catch {
    // nothing to keep
  }
}

// The markdown module holds the switch the sanitizers read. It is set for this visit only and never written to storage.
const flag = (on: boolean) => import('./markdown').then((m) => m.allowWeb(on));

function decide() {
  lock(1);
  if (!net.hosts.length) return void (net.choice = 'none');
  if (net.mode === 'never') return deny(true);
  if (net.mode === 'always' || remembered()) return allow(false);
  flag(false);
  net.choice = 'ask';
}

/** A notebook has opened: start counting from here, then decide about its pictures. */
export function begin(name: string, found: Map<string, number>) {
  watch();
  since = performance.now();
  net.seen = [];
  net.blocked = [];
  net.name = name;
  net.hosts = [...found.keys()].sort();
  net.pictures = [...found.values()].reduce((a, b) => a + b, 0);
  decide();
}

export function allow(keep: boolean) {
  flag(true);
  net.choice = 'loaded';
  if (keep) remember();
}

/** Pictures stay off. `hard` hands the refusal to the browser, which then holds until the page is reloaded. */
export function deny(hard = false) {
  flag(false);
  net.choice = 'blocked';
  if (hard) lock(2);
}

export function setMode(mode: Mode) {
  net.mode = mode;
  store.set('net', mode === 'ask' ? null : mode);
  if (!net.name) return;
  // a page that already refused for good cannot be talked round; anything else is decided again
  if (net.lock === 2) net.choice = net.hosts.length ? 'blocked' : 'none';
  else decide();
}

/** Forgets every notebook and site the reader said yes to. */
export function forget() {
  store.set('net-ok', null);
  store.set('net-hosts', null);
}

/** Sites the reader has said may be fetched from without asking, for `?url=` links. */
export const trusted = (host: string): boolean => {
  try {
    return (JSON.parse(store.get('net-hosts') ?? '[]') as string[]).includes(host);
  } catch {
    return false;
  }
};

export function trust(host: string) {
  try {
    const all = new Set(JSON.parse(store.get('net-hosts') ?? '[]') as string[]);
    all.add(host);
    store.set('net-hosts', JSON.stringify([...all].slice(-30)));
  } catch {
    // nothing to keep
  }
}
