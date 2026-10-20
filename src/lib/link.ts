import { mount } from 'svelte';

// Reading a notebook from a web address. This loads only when the page is opened with ?url=, and what it returns is a
// plain File: from there the notebook goes through the same reader, sanitizers and sandbox as one opened from disk.

/** The most a link will download. A file on disk has no such limit. */
export const LIMIT = 50 * 1024 * 1024;
/** How long a server may say nothing before the download is given up. */
const STALL = 20_000;
/** A gist's own listing is only metadata, so it gets a smaller allowance. */
const LISTING = 8 * 1024 * 1024;

export interface Env {
  fetch: typeof fetch;
  /** The address of the app itself: what counts as "the same site", and whether this is a local copy for development. */
  here: URL;
  stall?: number;
  online?: () => boolean;
}

/**
 * A failure with a sentence that can be shown as it is. `status` is the server's when it answered, 0 when the message
 * is ours, and -1 when nothing could be read at all (offline, blocked, or too slow).
 */
export class Fail extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

type Plan =
  | { kind: 'file'; url: URL; name?: string }
  | { kind: 'gist'; id: string; user?: string; pick?: string };

const GIST_ID = /^[0-9a-f]{5,64}$/i;
const INTERNAL = /(?:^|\.)(?:localhost|local|internal|lan|home|corp|intranet|private|home\.arpa)$/;
const NOT_A_FILE = 'That is a GitHub page, not a file. Open the notebook there and copy the address from its page.';
const PRIVATE = 'Addresses on a local or private network are not opened.';

/** On the Cloudflare copy the page may only talk to its own site (connect-src 'self'), which fetches GitHub's files for it: tools/worker.js. */
const RELAY = import.meta.env.MODE === 'cloudflare';
const VIA = new Set(['raw.githubusercontent.com', 'gist.githubusercontent.com', 'api.github.com']);
const relay = (url: URL, here: URL) => (RELAY && VIA.has(url.hostname) ? new URL(`${import.meta.env.BASE_URL}link/${url.hostname}${url.pathname}`, here) : url);

const loopback = (host: string) => host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '[::1]';

function reserved(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b, c] = m.slice(1).map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/**
 * Whether an address may be fetched at all. Web addresses only, https unless this is a local copy talking to a local
 * server, no sign-in details in the address, and nothing on a local or private network. A name that merely points
 * at a private address cannot be told apart from here, so this is a first gate and not the last one.
 */
export function admit(url: URL, here: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Fail('Only web addresses can be opened.');
  if (url.username || url.password) throw new Fail('Addresses with a user name or password in them are not opened.');
  if (url.origin === here.origin) return;
  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  const near = loopback(host);
  if (near && loopback(here.hostname)) return;
  if (url.protocol !== 'https:') throw new Fail('Only https addresses can be opened.');
  if (near || !host.includes('.') || host.startsWith('[') || INTERNAL.test(host) || reserved(host)) throw new Fail(PRIVATE);
}

const file = (path: string): Plan => ({ kind: 'file', url: new URL(`https://raw.githubusercontent.com/${path}`) });

/** user / repo / blob or raw / branch or commit / path, as the address bar of a GitHub file shows it. */
function github(parts: string[]): Plan {
  const [user, repo, kind, ...rest] = parts;
  if (!user || !repo || (kind !== 'blob' && kind !== 'raw') || rest.length < 2) throw new Fail(NOT_A_FILE);
  return file([user, repo, ...rest].join('/'));
}

/** user / id, then whatever follows: a `raw` part names the file itself, anything else is a page about the gist. */
function gist(parts: string[], hash: string): Plan {
  const [first, second, ...tail] = parts;
  const pick = hash.replace(/^#/, '') || undefined;
  if (first && GIST_ID.test(first) && (!second || second === 'raw')) return { kind: 'gist', id: first, pick };
  if (!first || !second || !GIST_ID.test(second)) throw new Fail('That does not look like a gist address.');
  if (tail[0] === 'raw') {
    const url = new URL(`https://gist.githubusercontent.com/${first}/${second}/${tail.join('/')}`);
    return { kind: 'file', url, name: tail.length < 2 ? 'gist.ipynb' : undefined };
  }
  return { kind: 'gist', id: second, user: first, pick };
}

/** A pasted `github.com/user/repo/...` has no scheme; a bare `notes.ipynb` or `samples/a.ipynb` is a file of the app. */
const BARE_HOST = /^[\w-]+(?:\.[\w-]+)+(?::\d+)?\//;

/** What an address is: a file to download as it is, or a gist whose notebook has to be found first. */
export function resolve(input: string, here: URL): Plan {
  const text = input.trim();
  let url: URL;
  try {
    if (!text) throw new Error('empty');
    url = new URL(BARE_HOST.test(text) ? `https://${text}` : text, here);
  } catch {
    throw new Fail('That does not look like a web address.');
  }
  admit(url, here);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'github.com') return github(parts);
  if (host === 'gist.github.com') return gist(parts, url.hash);
  if (host === 'colab.research.google.com' || host === 'nbviewer.org' || host === 'nbviewer.jupyter.org') {
    if (parts[0] === 'github') return github(parts.slice(1));
    if (parts[0] === 'gist') return gist(parts.slice(1), url.hash);
    if (parts[0] === 'drive') throw new Fail('Notebooks in Google Drive cannot be opened from a link. Download the file and drop it here.');
  }
  if (host === 'drive.google.com') throw new Fail('Files in Google Drive cannot be opened from a link. Download the file and drop it here.');
  if (RELAY && url.origin !== here.origin && !VIA.has(url.hostname)) throw new Fail('This site opens links to GitHub files and gists. Download the notebook and drop it here instead.');
  return { kind: 'file', url };
}

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`);
const tooBig = (n?: number) =>
  new Fail(`${n ? `That file is ${size(n)}` : 'That file is too big'}, and links open up to ${size(LIMIT)}. Download it and drop it here instead.`);
const webPage = () => new Fail('That address returned a web page, not a notebook file.');
const bigListing = () => new Fail('GitHub sent back more than expected for that gist.');

function refused(status: number, url: URL): Fail {
  if (status === 413) return tooBig();
  if (status === 415) return webPage();
  const gh = /(?:^|\.)github(?:usercontent)?\.com$/.test(url.hostname);
  if (status === 404) {
    return new Fail(
      gh
        ? 'Nothing is there (404). Check the branch and the file name; files in private repositories cannot be opened from a link.'
        : 'Nothing is there (404). Check the address.',
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new Fail(
      url.hostname === 'api.github.com'
        ? 'GitHub is limiting requests from this network (403). Try again later.'
        : 'That address is private or needs a sign-in (403). Only public files can be opened from a link.',
      status,
    );
  }
  if (status === 429) return new Fail('The server asked for a pause (429). Try again in a minute.', status);
  if (status >= 500) return new Fail(`The server had a problem (${status}). Try again later.`, status);
  return new Fail(`The server answered with an error (${status}).`, status);
}

interface Got {
  blob: Blob;
  url: URL;
  modified: number;
}

interface Opened {
  url: URL;
  modified: number;
  /** The body as it arrives, checked on the way: not a web page, under the limit, and given up on when the server goes quiet. Every failure is a Fail. */
  body: ReadableStream<Uint8Array>;
}

/**
 * One download. Nothing is sent with it that could identify the reader or the page: no cookies, no referrer and no
 * headers of our own (so the browser never has to ask the server's permission first). The size is checked against what
 * the server announces and again against what actually arrives, and a server that goes quiet is given up on.
 * A `listing` is gist metadata: smaller allowance, and it is not expected to look like a notebook.
 * It resolves once the headers are good; the body is checked as it is read.
 */
async function connect(url: URL, say: (text: string) => void, env: Env, kind: 'notebook' | 'listing'): Promise<Opened> {
  const notebook = kind === 'notebook';
  const limit = notebook ? LIMIT : LISTING;
  const over = (n?: number) => (notebook ? tooBig(n) : bigListing());
  const host = url.hostname;
  const ctl = new AbortController();
  let reason: 'stall' | 'big' | '' = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ((reason = 'stall'), ctl.abort()), env.stall ?? STALL);
  };
  const lost = () =>
    reason === 'stall'
      ? new Fail(`${host} stopped answering. Try again later.`, -1)
      : reason === 'big'
        ? over()
        : new Fail(
            env.online && !env.online()
              ? 'You seem to be offline.'
              : `The browser could not read ${host}. The server may be down, or it does not allow other sites to read its files. The browser does not say which. Download the notebook and drop it here instead.`,
            -1,
          );
  say(host);
  watch();
  const via = relay(url, env.here);
  let res: Response;
  let end = url;
  try {
    try {
      res = await env.fetch(via.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow', signal: ctl.signal });
    } catch {
      throw lost();
    }
    watch();
    if (via === url && res.url && res.url !== url.href) {
      try {
        end = new URL(res.url);
        admit(end, env.here);
      } catch {
        res.body?.cancel().catch(() => {});
        throw new Fail('That address redirected somewhere that cannot be opened.');
      }
    }
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw refused(res.status, end);
    }
    const announced = Number(res.headers.get('content-length'));
    if (announced > limit) {
      res.body?.cancel().catch(() => {});
      throw over(announced);
    }
    if (notebook && /^(?:text\/html|application\/xhtml)/i.test(res.headers.get('content-type') ?? '')) {
      res.body?.cancel().catch(() => {});
      throw webPage();
    }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
  const modified = Date.parse(res.headers.get('last-modified') ?? '') || Date.now();
  if (!res.body) {
    try {
      const blob = await res.blob();
      if (blob.size > limit) throw over(blob.size);
      return { body: blob.stream(), url: end, modified };
    } finally {
      clearTimeout(timer);
    }
  }
  const reader = res.body.getReader();
  let total = 0;
  let shown = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        // the stall timer runs only while the server is being waited on, not while the reader is busy with what it has
        watch();
        const { done, value } = await reader.read();
        clearTimeout(timer);
        if (done) return c.close();
        if (!total && notebook && /^\s*</.test(new TextDecoder().decode(value.subarray(0, 64)))) throw webPage();
        total += value.length;
        if (total > limit) {
          reason = 'big';
          ctl.abort();
          throw over();
        }
        c.enqueue(value);
        const now = performance.now();
        if (notebook && now - shown > 150) {
          shown = now;
          say(`${host} · ${size(total)}`);
        }
      } catch (e) {
        clearTimeout(timer);
        reader.cancel().catch(() => {});
        c.error(e instanceof Fail ? e : lost());
      }
    },
    cancel() {
      clearTimeout(timer);
      return reader.cancel().catch(() => {});
    },
  });
  return { body, url: end, modified };
}

/** The whole of a download, for a gist listing and for fetchLink. */
async function download(url: URL, say: (text: string) => void, env: Env, kind: 'notebook' | 'listing'): Promise<Got> {
  const got = await connect(url, say, env, kind);
  const reader = got.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return { blob: new Blob(chunks as BlobPart[]), url: got.url, modified: got.modified };
}

/** A name that is safe to show in the header: no control or direction-changing characters, and not absurdly long. */
const tidy = (name: string) => name.replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069/\\]/g, '').trim().slice(0, 120);

/** The last part of an address as a file name, or a plain one when it has none. */
function called(url: URL): string {
  let last = url.pathname.split('/').filter(Boolean).pop() ?? '';
  try {
    last = decodeURIComponent(last);
  } catch {
    // keep it as written
  }
  last = tidy(last);
  return !last ? 'notebook.ipynb' : /\.[a-z0-9]+$/i.test(last) ? last : `${last}.ipynb`;
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

interface Listing {
  files?: Record<string, { filename?: string; raw_url?: string; size?: number }>;
}

async function fromGist(plan: Extract<Plan, { kind: 'gist' }>, say: (text: string) => void, env: Env): Promise<File> {
  const find = async () => {
    const { blob } = await download(new URL(`https://api.github.com/gists/${plan.id}`), say, env, 'listing');
    let listing: Listing;
    try {
      listing = JSON.parse(await blob.text());
    } catch {
      throw new Fail('GitHub answered with something that is not a gist listing.');
    }
    const books = Object.values(listing.files ?? {}).filter((f) => /\.ipynb$/i.test(f.filename ?? ''));
    const found = (plan.pick && books.find((f) => squash(`file-${f.filename}`) === squash(plan.pick!))) || books[0];
    if (!found?.raw_url) throw new Fail('That gist has no .ipynb file in it.');
    let raw: URL | undefined;
    try {
      raw = new URL(found.raw_url);
    } catch {
      // checked below
    }
    if (raw?.protocol !== 'https:' || raw.hostname !== 'gist.githubusercontent.com') {
      throw new Fail('GitHub pointed at a file that is not on gist.githubusercontent.com, so it was not opened.');
    }
    if ((found.size ?? 0) > LIMIT) throw tooBig(found.size);
    return { raw, name: tidy(found.filename!) || 'gist.ipynb' };
  };
  let found: { raw: URL; name: string };
  try {
    found = await find();
  } catch (e) {
    // The listing can be rate limited or unreachable while the raw file is not. That needs a user name in the address.
    const soft = !(e instanceof Fail) || e.status === -1 || e.status === 403 || e.status === 429 || e.status >= 500;
    if (soft && plan.user) found = { raw: new URL(`https://gist.githubusercontent.com/${plan.user}/${plan.id}/raw`), name: 'gist.ipynb' };
    else throw e instanceof Fail && e.status === 404 ? new Fail('That gist was not found, or it is not public.', 404) : e;
  }
  const got = await download(found.raw, say, env, 'notebook');
  return new File([got.blob], found.name, { type: 'application/json', lastModified: got.modified });
}

const live = (): Env => ({ fetch: (url, init) => fetch(url, init), here: new URL(location.href), online: () => navigator.onLine });

/**
 * Downloads the notebook an address points at. `say` is told where it is from and how far it got; the result is a
 * File like one picked from disk, and every failure is an Error whose message is meant to be read.
 */
export async function fetchLink(input: string, say: (text: string) => void, env: Env = live()): Promise<File> {
  const plan = resolve(input, env.here);
  if (plan.kind === 'gist') return fromGist(plan, say, env);
  const got = await download(plan.url, say, env, 'notebook');
  return new File([got.blob], plan.name ?? called(got.url), { type: 'application/json', lastModified: got.modified });
}

/**
 * The same download, handed over as it arrives so the first cells are drawn while the rest is on its way. A gist's file is found
 * through its listing first and comes whole.
 */
async function streamLink(input: string, say: (text: string) => void, env: Env = live()): Promise<Pick<File, 'name' | 'stream'>> {
  const plan = resolve(input, env.here);
  if (plan.kind === 'gist') return fromGist(plan, say, env);
  const got = await connect(plan.url, say, env, 'notebook');
  return { name: plan.name ?? called(got.url), stream: () => got.body };
}

/** Asks before anything is fetched: the site named in a shared link will see the reader's address. */
async function ask(host: string, href: string): Promise<boolean> {
  const [{ default: Gate }, { trust }] = await Promise.all([import('./Gate.svelte'), import('./netstate.svelte')]);
  return new Promise((yes) => {
    const box = document.body.appendChild(document.createElement('div'));
    mount(Gate, {
      target: box,
      props: {
        host,
        url: href,
        via: RELAY,
        answer: (go: boolean, always: boolean) => {
          box.remove();
          if (go && always) trust(host);
          yes(go);
        },
      },
    });
  });
}

/**
 * The address carried `?url=` or `#nb=`. A notebook in the link opens at once; a `url` asks unless the reader already trusts that site, then fetch it and hand the file (or
 * the reason it failed) back. Saying no returns to the empty screen with nothing requested.
 */
export async function start(href: string, say: (text: string) => void, done: (file: Pick<File, 'name' | 'stream'>) => void, fail: (why: string) => void) {
  const link = new URL(href);
  // a notebook carried in the address needs no request at all
  if (link.hash.includes('nb=')) {
    try {
      const got = await (await import('./insight/share')).unpack(link.hash);
      return got ? done(new File([got.text], got.name, { type: 'application/json' })) : fail('There was no notebook in that link.');
    } catch (e) {
      return fail((e as Error).message);
    }
  }
  const input = link.searchParams.get('url');
  if (!input) return fail('There was no address to open.');
  try {
    const here = new URL(location.href);
    const plan = resolve(input, here);
    const target = plan.kind === 'gist' ? new URL('https://gist.github.com/') : plan.url;
    if (target.origin !== here.origin && history.state?.asked !== input && !(await import('./netstate.svelte')).trusted(target.host)) {
      say('Waiting for you');
      if (!(await ask(target.host, plan.kind === 'gist' ? input : plan.url.href))) return location.replace(location.pathname + location.hash);
    }
  } catch (e) {
    return fail((e as Error).message);
  }
  streamLink(input, say).then(done, (e) => fail(e.message));
}

/**
 * A link typed into the open page. A page that has shown a notebook has shut its own connections (guard.ts, netstate lock) and a
 * policy cannot be loosened, so the link opens on a fresh page, the way a shared link arrives. The question is asked here first, so
 * declining keeps the notebook on screen; a yes travels with the new history entry so the new page does not ask again.
 * Resolves false when declined; true when the page is reloading with the link.
 */
export async function requested(input: string, say: (text: string) => void): Promise<boolean> {
  const here = new URL(location.href);
  const plan = resolve(input, here);
  const target = plan.kind === 'gist' ? new URL('https://gist.github.com/') : plan.url;
  if (target.origin !== here.origin && !(await import('./netstate.svelte')).trusted(target.host)) {
    say('Waiting for you');
    if (!(await ask(target.host, plan.kind === 'gist' ? input : plan.url.href))) return false;
  }
  history.pushState({ asked: input }, '', `${location.pathname}?url=${encodeURIComponent(input)}`);
  location.reload();
  return true;
}

/** A link pasted on the empty screen reloads the page with it, so the download always comes before anything is drawn. */
export const pasted = (text: string) => /^https?:\/\/\S+\s*$/i.test(text) && (location.search = 'url=' + encodeURIComponent(text));
