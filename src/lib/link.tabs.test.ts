import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasted, requested, start } from './link';
import { act, strip } from './tabs/state.svelte';

// The question a foreign site gets (Gate.svelte) is answered here, by a stub of `mount`, and what the reader trusts is a plain set.
const gate = vi.hoisted(() => ({ yes: false, trusted: new Set<string>() }));
vi.mock('./netstate.svelte', () => ({ trusted: (host: string) => gate.trusted.has(host), trust: () => {} }));
vi.mock('svelte', async (original) => ({
  ...(await original<typeof import('svelte')>()),
  mount: (_view: unknown, options: { props: { answer: (go: boolean, always: boolean) => void } }) => options.props.answer(gate.yes, false),
}));

const ORIGIN = 'https://ipynb.example';
const RAW = 'https://raw.githubusercontent.com/u/r/main/a.ipynb';

let loc: { href: string; pathname: string; search: string; hash: string; reload: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
let hist: { state: unknown; pushState: ReturnType<typeof vi.fn>; replaceState: ReturnType<typeof vi.fn> };
let open: ReturnType<typeof vi.spyOn>;
const say = vi.fn();

beforeEach(() => {
  loc = { href: `${ORIGIN}/`, pathname: '/', search: '', hash: '', reload: vi.fn(), replace: vi.fn() };
  hist = { state: null, pushState: vi.fn(), replaceState: vi.fn() };
  vi.stubGlobal('location', loc);
  vi.stubGlobal('history', hist);
  vi.stubGlobal('document', { body: { appendChild: (el: unknown) => el }, createElement: () => ({ remove: () => {} }) });
  open = vi.spyOn(act, 'open').mockImplementation(() => {});
  strip.me = 'h';
  gate.yes = false;
  gate.trusted.clear();
  say.mockClear();
});

afterEach(() => {
  open.mockRestore();
  strip.me = 'h';
  vi.unstubAllGlobals();
});

const left = () => ({ reload: loc.reload.mock.calls.length, push: hist.pushState.mock.calls.length, replaceState: hist.replaceState.mock.calls.length, replace: loc.replace.mock.calls.length });

describe('requested beside the notebook on show', () => {
  it('opens the link as a tab and does not navigate', async () => {
    const link = `${ORIGIN}/cooling-coffee.ipynb?copy=2`;
    expect(await requested(link, say, true)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith([{ link, asked: true }]);
    expect(left()).toEqual({ reload: 0, push: 0, replaceState: 0, replace: 0 });
    expect(loc.href).toBe(`${ORIGIN}/`);
    expect(say).not.toHaveBeenCalled();
  });

  it('hands over the text as typed, not its resolved address', async () => {
    expect(await requested('cooling-coffee.ipynb?copy=3', say, true)).toBe(true);
    expect(open).toHaveBeenCalledWith([{ link: 'cooling-coffee.ipynb?copy=3', asked: true }]);
  });

  it('does the same from inside a frame', async () => {
    strip.me = 't2';
    expect(await requested(`${ORIGIN}/a.ipynb`, say, true)).toBe(true);
    expect(open).toHaveBeenCalledWith([{ link: `${ORIGIN}/a.ipynb`, asked: true }]);
    expect(left()).toEqual({ reload: 0, push: 0, replaceState: 0, replace: 0 });
  });

  it('opens a trusted foreign site without asking', async () => {
    gate.trusted.add('raw.githubusercontent.com');
    expect(await requested(RAW, say, true)).toBe(true);
    expect(say).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith([{ link: RAW, asked: true }]);
  });

  it('asks about a foreign site first, and opens nothing when the answer is no', async () => {
    gate.yes = false;
    expect(await requested(RAW, say, true)).toBe(false);
    expect(say).toHaveBeenCalledWith('Waiting for you');
    expect(open).not.toHaveBeenCalled();
    expect(left()).toEqual({ reload: 0, push: 0, replaceState: 0, replace: 0 });
  });

  it('opens a foreign site after a yes, marked as asked so the new tab does not ask again', async () => {
    gate.yes = true;
    expect(await requested(RAW, say, true)).toBe(true);
    expect(open).toHaveBeenCalledWith([{ link: RAW, asked: true }]);
  });

  it('rejects an address that is not a web address before opening anything', async () => {
    await expect(requested('javascript:alert(1)', say, true)).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('requested into the page itself', () => {
  it('adds a history entry and reloads the top page', async () => {
    const link = `${ORIGIN}/a.ipynb?x=1`;
    expect(await requested(link, say)).toBe(true);
    expect(hist.pushState).toHaveBeenCalledWith({ asked: link }, '', `/?url=${encodeURIComponent(link)}`);
    expect(loc.reload).toHaveBeenCalledTimes(1);
    expect(hist.replaceState).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps its tab in a frame, and adds no history', async () => {
    strip.me = 't3';
    const link = `${ORIGIN}/a.ipynb?x=1`;
    expect(await requested(link, say, false)).toBe(true);
    expect(hist.replaceState).toHaveBeenCalledWith({ asked: link }, '', `/?url=${encodeURIComponent(link)}&tab=t3`);
    expect(hist.pushState).not.toHaveBeenCalled();
    expect(loc.reload).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves the page alone when a foreign site is declined', async () => {
    expect(await requested(RAW, say)).toBe(false);
    expect(left()).toEqual({ reload: 0, push: 0, replaceState: 0, replace: 0 });
  });
});

describe('pasted', () => {
  const link = 'https://x.example/a.ipynb?k=v&z=1';

  it('reloads the top page with the link', () => {
    const set = vi.fn();
    Object.defineProperty(loc, 'search', { set, get: () => '' });
    expect(pasted(link)).toBe(true);
    expect(set).toHaveBeenCalledWith('url=' + encodeURIComponent(link));
    expect(loc.replace).not.toHaveBeenCalled();
  });

  it('keeps &tab= in a frame, replacing its own address', () => {
    strip.me = 't2';
    const set = vi.fn();
    Object.defineProperty(loc, 'search', { set, get: () => '' });
    expect(pasted(`${link}  \n`)).toBe(true);
    expect(loc.replace).toHaveBeenCalledWith(`/?url=${encodeURIComponent(link)}&tab=t2`);
    expect(set).not.toHaveBeenCalled();
  });

  it('puts url first, so the address still reads as a link', () => {
    strip.me = 't9';
    pasted(link);
    expect(loc.replace.mock.calls[0][0]).toMatch(/^\/\?url=[^&]+&tab=t9$/);
  });

  it('ignores text that is not a web address, in the page or a frame', () => {
    for (const me of ['h', 't1']) {
      strip.me = me;
      for (const text of ['hello', 'ftp://x.example/a', ' https://x.example/a', 'https://', 'https://x.example/a b', '']) {
        expect(pasted(text), `${me}: ${text}`).toBe(false);
      }
    }
    expect(loc.replace).not.toHaveBeenCalled();
  });
});

describe('start, when the person declines', () => {
  const input = RAW;
  const href = `${ORIGIN}/?url=${encodeURIComponent(input)}`;
  const run = async () => {
    const done = vi.fn();
    const fail = vi.fn();
    loc.href = href;
    loc.search = `?url=${encodeURIComponent(input)}`;
    await start(href, say, done, fail);
    return { done, fail };
  };

  it('returns the top page to the empty screen', async () => {
    const { done, fail } = await run();
    expect(loc.replace).toHaveBeenCalledWith('/');
    expect(done).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });

  it('keeps a frame where it is and says nothing was fetched', async () => {
    strip.me = 't1';
    const { done, fail } = await run();
    expect(fail).toHaveBeenCalledWith('Nothing was fetched.');
    expect(loc.replace).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
});
