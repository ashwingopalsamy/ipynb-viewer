import { describe, expect, it } from 'vitest';
import { admit, fetchLink, resolve, Fail, LIMIT, type Env } from './link';

const app = new URL('https://ipynb.example/');
const dev = new URL('http://localhost:5173/');
const ID = '0123456789abcdef0123456789abcdef';

const fails = (run: () => unknown, message: RegExp) => {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(Fail);
    expect((e as Error).message).toMatch(message);
    return;
  }
  throw new Error('did not throw');
};
const rejects = async (run: Promise<unknown>, message: RegExp) => {
  const e = await run.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(Fail);
  expect((e as Error).message).toMatch(message);
  return e as Fail;
};

describe('resolve', () => {
  const file = (input: string) => {
    const plan = resolve(input, app);
    expect(plan.kind).toBe('file');
    return plan.kind === 'file' ? plan.url.href : '';
  };

  it('turns a GitHub file page into the raw address', () => {
    expect(file('https://github.com/ashwingopalsamy/ipynb-viewer/blob/main/samples/a.ipynb')).toBe(
      'https://raw.githubusercontent.com/ashwingopalsamy/ipynb-viewer/main/samples/a.ipynb',
    );
    expect(file('https://github.com/u/r/blob/abc123/a%20b.ipynb?raw=true#L4')).toBe('https://raw.githubusercontent.com/u/r/abc123/a%20b.ipynb');
    expect(file('https://github.com/u/r/raw/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(file('https://github.com/u/r/raw/refs/heads/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/refs/heads/main/a.ipynb');
    expect(file('https://github.com/u/r/blob/feature/x/dir/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/feature/x/dir/a.ipynb');
    expect(file('https://www.github.com/u/r/blob/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
  });

  it('says so when a GitHub address is a page and not a file', () => {
    for (const page of ['https://github.com/u', 'https://github.com/u/r', 'https://github.com/u/r/tree/main/samples', 'https://github.com/u/r/blob/main', 'https://github.com/u/r/issues/4']) {
      fails(() => resolve(page, app), /GitHub page, not a file/);
    }
  });

  it('keeps raw addresses as they are', () => {
    expect(file('https://raw.githubusercontent.com/u/r/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(file('https://gist.githubusercontent.com/u/' + ID + '/raw/abc/a.ipynb')).toBe('https://gist.githubusercontent.com/u/' + ID + '/raw/abc/a.ipynb');
    expect(file('https://example.com/data/a.ipynb?token=1')).toBe('https://example.com/data/a.ipynb?token=1');
  });

  it('finds the gist behind a gist page, and the file it points at', () => {
    expect(resolve(`https://gist.github.com/someone/${ID}`, app)).toEqual({ kind: 'gist', id: ID, user: 'someone', pick: undefined });
    expect(resolve(`https://gist.github.com/someone/${ID}#file-my_nb-ipynb`, app)).toEqual({ kind: 'gist', id: ID, user: 'someone', pick: 'file-my_nb-ipynb' });
    expect(resolve(`https://gist.github.com/${ID}`, app)).toEqual({ kind: 'gist', id: ID, pick: undefined });
    expect(resolve(`https://gist.github.com/someone/${ID}/revisions`, app)).toMatchObject({ kind: 'gist', id: ID, user: 'someone' });
  });

  it('reads the raw form of a gist address as a file', () => {
    expect(file(`https://gist.github.com/someone/${ID}/raw/a.ipynb`)).toBe(`https://gist.githubusercontent.com/someone/${ID}/raw/a.ipynb`);
    expect(file(`https://gist.github.com/someone/${ID}/raw/rev1/a.ipynb`)).toBe(`https://gist.githubusercontent.com/someone/${ID}/raw/rev1/a.ipynb`);
    expect(file(`https://gist.github.com/someone/${ID}/raw`)).toBe(`https://gist.githubusercontent.com/someone/${ID}/raw`);
    fails(() => resolve('https://gist.github.com/someone/not-an-id', app), /gist address/);
    fails(() => resolve('https://gist.github.com/', app), /gist address/);
  });

  it('understands Colab and nbviewer links to GitHub and gists', () => {
    expect(file('https://colab.research.google.com/github/u/r/blob/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(file('https://nbviewer.org/github/u/r/blob/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(file('https://nbviewer.jupyter.org/github/u/r/blob/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(resolve(`https://nbviewer.org/gist/someone/${ID}`, app)).toMatchObject({ kind: 'gist', id: ID, user: 'someone' });
    expect(resolve(`https://colab.research.google.com/gist/someone/${ID}/a.ipynb`, app)).toMatchObject({ kind: 'gist', id: ID });
  });

  it('explains that Google Drive links cannot be read', () => {
    fails(() => resolve('https://colab.research.google.com/drive/1AbC', app), /Google Drive/);
    fails(() => resolve('https://drive.google.com/file/d/1AbC/view', app), /Google Drive/);
  });

  it('adds https to an address pasted without it, and keeps paths of the app itself', () => {
    expect(file('github.com/u/r/blob/main/a.ipynb')).toBe('https://raw.githubusercontent.com/u/r/main/a.ipynb');
    expect(file('example.com/a.ipynb')).toBe('https://example.com/a.ipynb');
    expect(file('samples/a.ipynb')).toBe('https://ipynb.example/samples/a.ipynb');
    expect(file('/samples/a.ipynb')).toBe('https://ipynb.example/samples/a.ipynb');
    expect(file('//example.com/a.ipynb')).toBe('https://example.com/a.ipynb');
  });

  it('refuses what is not an address', () => {
    fails(() => resolve('  ', app), /does not look like a web address/);
    fails(() => resolve('http://', app), /does not look like a web address/);
    fails(() => resolve('https://exa mple.com/a', app), /does not look like a web address/);
  });
});

describe('admit', () => {
  const no = (input: string, message: RegExp, here = app) => fails(() => admit(new URL(input), here), message);
  const yes = (input: string, here = app) => expect(() => admit(new URL(input), here)).not.toThrow();

  it('lets public https addresses through', () => {
    for (const ok of ['https://example.com/a.ipynb', 'https://raw.githubusercontent.com/u/r/main/a.ipynb', 'https://8.8.8.8/a', 'https://172.32.0.1/a', 'https://100.128.0.1/a', 'https://sub.domain.example.co.uk:8443/a']) yes(ok);
  });

  it('refuses anything that is not a web address', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/plain,hi', 'file:///etc/passwd', 'blob:https://ipynb.example/abc', 'ftp://example.com/a.ipynb', 'ws://example.com/', 'about:blank']) {
      no(bad, /Only web addresses/);
    }
  });

  it('refuses sign-in details in the address', () => {
    no('https://user:pass@example.com/a.ipynb', /user name or password/);
    no('https://user@example.com/a.ipynb', /user name or password/);
    no('https://:pass@example.com/a.ipynb', /user name or password/);
  });

  it('refuses plain http outside a local copy', () => {
    no('http://example.com/a.ipynb', /Only https/);
    no('http://localhost:9000/a.ipynb', /Only https/);
  });

  it('refuses hosts on a local or private network, whatever the spelling', () => {
    const hosts = [
      'localhost', 'LOCALHOST', 'localhost.', 'foo.localhost', 'printer', 'nas.local', 'router.lan', 'x.internal', 'x.home.arpa', 'a.corp',
      '127.0.0.1', '127.1', '2130706433', '0x7f.0.0.1', '0177.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.1',
      '[::1]', '[::]', '[::ffff:127.0.0.1]', '[fe80::1]', '[fd00::1]', '[2001:db8::1]',
    ];
    for (const h of hosts) no(`https://${h}/a.ipynb`, /local or private network/);
  });

  it('lets a local copy talk to a local server, and nothing else that is near', () => {
    yes('http://localhost:9000/a.ipynb', dev);
    yes('http://127.0.0.1:9000/a.ipynb', dev);
    yes('https://localhost:9443/a.ipynb', dev);
    no('http://192.168.1.5/a.ipynb', /Only https/, dev);
    no('https://192.168.1.5/a.ipynb', /local or private network/, dev);
    no('http://example.com/a.ipynb', /Only https/, dev);
    no('https://10.0.0.1/a.ipynb', /local or private network/, dev);
  });

  it('always lets the app read its own files', () => {
    yes('https://ipynb.example/samples/a.ipynb');
    yes('http://localhost:5173/samples/a.ipynb', dev);
  });
});

// ---- downloads, against a pretend network ----

interface Reply {
  status?: number;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  url?: string;
}
const answer = (r: Reply): Response => {
  const res = new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers });
  if (r.url) Object.defineProperty(res, 'url', { value: r.url });
  return res;
};
type Route = Reply | ((init: RequestInit) => Reply | Promise<Reply>) | 'network';
const pretend = (routes: Record<string, Route>, over: Partial<Env> = {}) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const env: Env = {
    here: app,
    online: () => true,
    fetch: (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const route = routes[url];
      if (!route || route === 'network') throw new TypeError('Failed to fetch');
      return answer(typeof route === 'function' ? await route(init) : route);
    }) as unknown as typeof fetch,
    ...over,
  };
  return { env, calls };
};
const text = (s: string) => s;
const NB = JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [] });

describe('fetchLink', () => {
  it('returns the file, named after the address, and sends nothing that identifies the reader', async () => {
    const { env, calls } = pretend({ 'https://example.com/data/My%20Notes.ipynb': { body: NB, headers: { 'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT' } } });
    const said: string[] = [];
    const file = await fetchLink('https://example.com/data/My%20Notes.ipynb', (t) => said.push(t), env);
    expect(file.name).toBe('My Notes.ipynb');
    expect(await file.text()).toBe(NB);
    expect(file.lastModified).toBe(Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'));
    expect(said[0]).toBe('example.com');
    expect(calls).toHaveLength(1);
    expect(calls[0].init).toMatchObject({ mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow' });
    expect(calls[0].init).not.toHaveProperty('headers');
    expect(calls[0].init).not.toHaveProperty('body');
    expect(calls[0].init.method).toBeUndefined();
  });

  it('gives the file a plain name when the address has none', async () => {
    const names: Record<string, string> = {
      'https://example.com/': 'notebook.ipynb',
      'https://example.com/export': 'export.ipynb',
      'https://example.com/a/b.json': 'b.json',
      'https://example.com/%E0%A4%A.ipynb': '%E0%A4%A.ipynb',
      'https://example.com/x%00y%0Az.ipynb': 'xyz.ipynb',
      'https://example.com/evil%E2%80%AEgnp.ipynb': 'evilgnp.ipynb',
    };
    for (const [url, want] of Object.entries(names)) {
      const { env } = pretend({ [url]: { body: NB } });
      expect((await fetchLink(url, () => {}, env)).name).toBe(want);
    }
  });

  it('asks raw.githubusercontent.com for a GitHub file page', async () => {
    const { env, calls } = pretend({ 'https://raw.githubusercontent.com/u/r/main/a.ipynb': { body: NB } });
    const file = await fetchLink('https://github.com/u/r/blob/main/a.ipynb', () => {}, env);
    expect(file.name).toBe('a.ipynb');
    expect(calls.map((c) => c.url)).toEqual(['https://raw.githubusercontent.com/u/r/main/a.ipynb']);
  });

  it('never asks the network about an address it refuses', async () => {
    const { env, calls } = pretend({});
    for (const bad of ['http://example.com/a', 'https://localhost/a', 'https://user:pw@example.com/a', 'javascript:alert(1)', 'https://[::1]/a', 'https://192.168.0.1/a', 'https://github.com/u/r', 'https://printer/a']) {
      await rejects(fetchLink(bad, () => {}, env), /./);
    }
    expect(calls).toHaveLength(0);
  });

  it('says what the server said, in words', async () => {
    const cases: [number, string, RegExp][] = [
      [404, 'https://example.com/a.ipynb', /Nothing is there \(404\)\. Check the address/],
      [404, 'https://raw.githubusercontent.com/u/r/main/a.ipynb', /branch and the file name.*private repositories/],
      [403, 'https://example.com/a.ipynb', /private or needs a sign-in/],
      [401, 'https://example.com/a.ipynb', /private or needs a sign-in/],
      [429, 'https://example.com/a.ipynb', /pause \(429\)/],
      [503, 'https://example.com/a.ipynb', /problem \(503\)/],
      [418, 'https://example.com/a.ipynb', /error \(418\)/],
    ];
    for (const [status, url, message] of cases) {
      const { env } = pretend({ [url]: { status, body: 'no' } });
      const e = await rejects(fetchLink(url, () => {}, env), message);
      expect(e.status).toBe(status);
    }
  });

  it('explains a failed connection without claiming to know why', async () => {
    const { env } = pretend({ 'https://example.com/a.ipynb': 'network' });
    const e = await rejects(fetchLink('https://example.com/a.ipynb', () => {}, env), /could not read example\.com.*does not allow other sites.*does not say which.*drop it here/);
    expect(e.status).toBe(-1);
    const off = pretend({ 'https://example.com/a.ipynb': 'network' }, { online: () => false });
    await rejects(fetchLink('https://example.com/a.ipynb', () => {}, off.env), /offline/);
  });

  it('turns away a web page that stands in for a notebook', async () => {
    const page = '<!doctype html><html><body>Sign in</body></html>';
    const cases: Reply[] = [
      { body: page, headers: { 'content-type': 'text/html; charset=utf-8' } },
      { body: page, headers: { 'content-type': 'application/xhtml+xml' } },
      { body: page, headers: { 'content-type': 'text/plain' } },
      { body: '﻿  \n' + page, headers: { 'content-type': 'application/octet-stream' } },
    ];
    for (const reply of cases) {
      const { env } = pretend({ 'https://example.com/a.ipynb': reply });
      await rejects(fetchLink('https://example.com/a.ipynb', () => {}, env), /web page, not a notebook/);
    }
    const { env } = pretend({ 'https://example.com/a.ipynb': { body: '  \n{"cells":[]}', headers: { 'content-type': 'text/plain' } } });
    expect(await (await fetchLink('https://example.com/a.ipynb', () => {}, env)).text()).toContain('cells');
  });

  it('hands back hostile bytes untouched, to be sanitized by the reader like any other file', async () => {
    const hostile = JSON.stringify({ cells: [{ cell_type: 'markdown', source: '<script>pwn()</script><img src=x onerror=pwn()>' }] });
    const { env } = pretend({ 'https://example.com/h.ipynb': { body: hostile } });
    expect(await (await fetchLink('https://example.com/h.ipynb', () => {}, env)).text()).toBe(hostile);
  });

  describe('size', () => {
    const endless = () => {
      const spy = { pulled: 0, cancelled: false };
      const piece = new Uint8Array(1024 * 1024).fill(32);
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          spy.pulled++;
          c.enqueue(piece);
        },
        cancel() {
          spy.cancelled = true;
        },
      });
      return { spy, body };
    };

    it('refuses a file that announces itself as too large, without reading it', async () => {
      const { spy, body } = endless();
      const { env } = pretend({ 'https://example.com/big.ipynb': { body, headers: { 'content-length': String(80 * 1024 * 1024) } } });
      await rejects(fetchLink('https://example.com/big.ipynb', () => {}, env), /That file is 80 MB, and links open up to 50 MB\. Download it and drop it here/);
      await new Promise((r) => setTimeout(r, 20));
      expect(spy.cancelled).toBe(true);
      expect(spy.pulled).toBeLessThan(4);
    });

    it('cuts off a server that sends more than it said, or says nothing', async () => {
      const { spy, body } = endless();
      const { env } = pretend({ 'https://example.com/liar.ipynb': { body, headers: { 'content-length': '100' } } });
      await rejects(fetchLink('https://example.com/liar.ipynb', () => {}, env), /too big, and links open up to 50 MB/);
      expect(spy.cancelled).toBe(true);
      expect(spy.pulled).toBeLessThanOrEqual(LIMIT / (1024 * 1024) + 3);
      const open = endless();
      const unknown = pretend({ 'https://example.com/chunked.ipynb': { body: open.body } });
      await rejects(fetchLink('https://example.com/chunked.ipynb', () => {}, unknown.env), /too big/);
      expect(open.spy.cancelled).toBe(true);
    });

    it('reports progress while it reads', async () => {
      const piece = new Uint8Array(300 * 1024).fill(32);
      let n = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(c) {
          await new Promise((r) => setTimeout(r, 40));
          if (n++ < 5) c.enqueue(piece);
          else c.close();
        },
      });
      const { env } = pretend({ 'https://example.com/a.ipynb': { body } });
      const said: string[] = [];
      await fetchLink('https://example.com/a.ipynb', (t) => said.push(t), env);
      expect(said[0]).toBe('example.com');
      expect(said.some((t) => /^example\.com · \d+ KB$/.test(t) || /^example\.com · \d\.\d MB$/.test(t))).toBe(true);
    });
  });

  describe('redirects', () => {
    it('follows one that stays on the web, and names the file after where it ended', async () => {
      const { env } = pretend({ 'https://short.example/x': { body: NB, url: 'https://cdn.example.com/files/real.ipynb' } });
      expect((await fetchLink('https://short.example/x', () => {}, env)).name).toBe('real.ipynb');
    });

    it('throws away one that ended somewhere it would not have gone', async () => {
      for (const end of ['https://10.0.0.5/secret.ipynb', 'https://localhost/a', 'http://example.com/a.ipynb', 'https://user:pw@example.com/a', 'https://[::1]/a', 'javascript:alert(1)', 'https://printer/a']) {
        const { env } = pretend({ 'https://example.com/a.ipynb': { body: NB, url: end } });
        await rejects(fetchLink('https://example.com/a.ipynb', () => {}, env), /redirected somewhere that cannot be opened/);
      }
    });
  });

  describe('a server that goes quiet', () => {
    const quiet = (init: RequestInit) =>
      new Promise<never>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

    it('is given up on before it answers', async () => {
      const { env } = pretend({ 'https://example.com/a.ipynb': quiet as unknown as Route }, { stall: 40 });
      const e = await rejects(fetchLink('https://example.com/a.ipynb', () => {}, env), /example\.com stopped answering/);
      expect(e.status).toBe(-1);
    });

    it('is given up on halfway through', async () => {
      const body = (init: RequestInit) =>
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode('{"cells":['));
            init.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
          },
        });
      const { env } = pretend({ 'https://example.com/a.ipynb': ((init: RequestInit) => ({ body: body(init) })) as Route }, { stall: 40 });
      await rejects(fetchLink('https://example.com/a.ipynb', () => {}, env), /example\.com stopped answering/);
    });
  });

  describe('gists', () => {
    const user = 'someone';
    const api = `https://api.github.com/gists/${ID}`;
    const raw = (name: string) => `https://gist.githubusercontent.com/${user}/${ID}/raw/abc123/${name}`;
    const listing = (files: Record<string, { size?: number; raw_url?: string }>) =>
      ({
        body: JSON.stringify({ files: Object.fromEntries(Object.entries(files).map(([filename, f]) => [filename, { filename, raw_url: raw(filename), size: 10, ...f }])) }),
        headers: { 'content-type': 'application/json' },
      }) as Reply;
    const link = `https://gist.github.com/${user}/${ID}`;

    it('opens the first notebook in the gist', async () => {
      const { env, calls } = pretend({ [api]: listing({ 'notes.md': {}, 'one.ipynb': {}, 'two.ipynb': {} }), [raw('one.ipynb')]: { body: NB } });
      const file = await fetchLink(link, () => {}, env);
      expect(file.name).toBe('one.ipynb');
      expect(await file.text()).toBe(NB);
      expect(calls.map((c) => c.url)).toEqual([api, raw('one.ipynb')]);
      for (const c of calls) expect(c.init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    });

    it('opens the notebook the address names', async () => {
      const { env } = pretend({ [api]: listing({ 'one.ipynb': {}, 'My_Two.ipynb': {} }), [raw('My_Two.ipynb')]: { body: NB } });
      expect((await fetchLink(`${link}#file-my_two-ipynb`, () => {}, env)).name).toBe('My_Two.ipynb');
    });

    it('says when the gist holds no notebook', async () => {
      const { env } = pretend({ [api]: listing({ 'notes.md': {}, 'script.py': {} }) });
      await rejects(fetchLink(link, () => {}, env), /no \.ipynb file/);
    });

    it('does not follow a file address that is not the gist host', async () => {
      const { env, calls } = pretend({ [api]: listing({ 'one.ipynb': { raw_url: 'https://evil.example/one.ipynb' } }), 'https://evil.example/one.ipynb': { body: NB } });
      await rejects(fetchLink(link, () => {}, env), /not on gist\.githubusercontent\.com/);
      for (const bad of ['http://gist.githubusercontent.com/x/one.ipynb', 'https://gist.githubusercontent.com.evil.example/x', 'not a url', 'https://127.0.0.1/x', 'javascript:alert(1)']) {
        const run = pretend({ [api]: listing({ 'one.ipynb': { raw_url: bad } }) });
        await rejects(fetchLink(link, () => {}, run.env), /not on gist\.githubusercontent\.com/);
        expect(run.calls.map((c) => c.url)).toEqual([api]);
      }
      expect(calls.map((c) => c.url)).toEqual([api]);
    });

    it('says when the gist does not exist', async () => {
      const { env } = pretend({ [api]: { status: 404, body: '{}' } });
      await rejects(fetchLink(link, () => {}, env), /gist was not found, or it is not public/);
    });

    it('goes straight to the raw file when GitHub is limiting the listing', async () => {
      const direct = `https://gist.githubusercontent.com/${user}/${ID}/raw`;
      const { env, calls } = pretend({ [api]: { status: 403, body: '{}' }, [direct]: { body: NB } });
      const file = await fetchLink(link, () => {}, env);
      expect(await file.text()).toBe(NB);
      expect(calls.map((c) => c.url)).toEqual([api, direct]);
      const down = pretend({ [api]: 'network', [direct]: { body: NB } });
      expect(await (await fetchLink(link, () => {}, down.env)).text()).toBe(NB);
    });

    it('has nothing to fall back on without a user name', async () => {
      const { env } = pretend({ [api]: { status: 403, body: '{}' } });
      await rejects(fetchLink(`https://gist.github.com/${ID}`, () => {}, env), /GitHub is limiting requests from this network/);
    });

    it('does not fall back from a missing notebook, a bad listing or an oversized one', async () => {
      const direct = `https://gist.githubusercontent.com/${user}/${ID}/raw`;
      for (const [reply, message] of [
        [listing({ 'notes.md': {} }), /no \.ipynb file/],
        [{ body: '<html>maintenance</html>' }, /not a gist listing/],
        [{ body: '{}', headers: { 'content-length': String(9 * 1024 * 1024) } }, /more than expected/],
      ] as [Reply, RegExp][]) {
        const { env, calls } = pretend({ [api]: reply, [direct]: { body: NB } });
        await rejects(fetchLink(link, () => {}, env), message);
        expect(calls.map((c) => c.url)).toEqual([api]);
      }
    });

    it('refuses a notebook the listing says is too large, without downloading it', async () => {
      const { env, calls } = pretend({ [api]: listing({ 'huge.ipynb': { size: 90 * 1024 * 1024 } }) });
      await rejects(fetchLink(link, () => {}, env), /That file is 90 MB/);
      expect(calls).toHaveLength(1);
    });
  });
});
