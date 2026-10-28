import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropped, pick } from './watch';

const file = (name: string) => new File(['{}'], name, { lastModified: 1 });
const handle = (f: File, kind = 'file') => ({ kind, name: f.name, getFile: vi.fn(async () => f) });
const later = <T>(value: T) => Promise.resolve(value);
const as = <T>(h: unknown) => h as T;

afterEach(() => vi.unstubAllGlobals());

describe('dropped', () => {
  it('pairs each file with its handle, in order', async () => {
    const a = file('a.ipynb');
    const b = file('b.ipynb');
    // getFile hands back a newer read of the same file, so a pairing mix-up shows
    const ha = handle(file('a.ipynb'));
    const hb = handle(file('b.ipynb'));
    const got = await dropped([a, b], [later(as<FileSystemHandle>(ha)), later(as<FileSystemHandle>(hb))]);
    expect(got).toHaveLength(2);
    expect(got[0].file).toBe(await ha.getFile.mock.results[0].value);
    expect(got[0].handle).toBe(ha);
    expect(got[1].file).toBe(await hb.getFile.mock.results[0].value);
    expect(got[1].handle).toBe(hb);
  });

  it('keeps the order of the files whichever handle settles first', async () => {
    const a = file('a.ipynb');
    const b = file('b.ipynb');
    const slow = new Promise<FileSystemHandle>((yes) => setTimeout(() => yes(as<FileSystemHandle>(handle(a))), 20));
    const quick = later(as<FileSystemHandle>(handle(b)));
    const got = await dropped([a, b], [slow, quick]);
    expect(got.map((o) => o.file.name)).toEqual(['a.ipynb', 'b.ipynb']);
  });

  it('falls back to the plain file for a handle that is null or undefined', async () => {
    const a = file('a.ipynb');
    const b = file('b.ipynb');
    const got = await dropped([a, b], [later(null), later(undefined)]);
    expect(got).toEqual([{ file: a }, { file: b }]);
    expect(got[0].file).toBe(a);
    expect(got[1].file).toBe(b);
  });

  it('falls back to the plain file for a handle that rejects', async () => {
    const a = file('a.ipynb');
    const got = await dropped([a], [Promise.reject(new Error('no permission'))]);
    expect(got).toEqual([{ file: a }]);
    expect(got[0].file).toBe(a);
    expect('handle' in got[0]).toBe(false);
  });

  it('falls back to the plain file for a directory handle, and never reads it', async () => {
    const a = file('dir');
    const dir = handle(file('dir'), 'directory');
    const got = await dropped([a], [later(as<FileSystemHandle>(dir))]);
    expect(got).toEqual([{ file: a }]);
    expect(dir.getFile).not.toHaveBeenCalled();
  });

  it('falls back to the plain file when getFile throws, and keeps the other pairs', async () => {
    const a = file('a.ipynb');
    const b = file('b.ipynb');
    const gone = { kind: 'file', name: 'a.ipynb', getFile: vi.fn(async () => Promise.reject(new DOMException('gone', 'NotFoundError'))) };
    const ok = handle(file('b.ipynb'));
    const got = await dropped([a, b], [later(as<FileSystemHandle>(gone)), later(as<FileSystemHandle>(ok))]);
    expect(got[0]).toEqual({ file: a });
    expect(got[0].file).toBe(a);
    expect(got[1].handle).toBe(ok);
  });

  it('falls back when getFile throws synchronously', async () => {
    const a = file('a.ipynb');
    const bad = {
      kind: 'file',
      getFile: () => {
        throw new Error('stale');
      },
    };
    expect(await dropped([a], [later(as<FileSystemHandle>(bad))])).toEqual([{ file: a }]);
  });

  it('opens every file even when the browser gave fewer handles than files', async () => {
    const a = file('a.ipynb');
    const b = file('b.ipynb');
    const got = await dropped([a, b], []);
    expect(got).toEqual([{ file: a }, { file: b }]);
  });

  it('ignores handles beyond the files', async () => {
    const a = file('a.ipynb');
    const got = await dropped([a], [later(null), later(as<FileSystemHandle>(handle(file('x'))))]);
    expect(got).toEqual([{ file: a }]);
  });

  it('returns nothing for an empty drop', async () => {
    expect(await dropped([], [])).toEqual([]);
  });
});

describe('pick', () => {
  it('asks for several files and pairs each with its handle', async () => {
    const ha = handle(file('a.ipynb'));
    const hb = handle(file('b.ipynb'));
    const picker = vi.fn(async (_options?: unknown) => [ha, hb]);
    vi.stubGlobal('window', { showOpenFilePicker: picker });
    const got = await pick();
    expect(picker.mock.calls[0][0]).toMatchObject({ multiple: true });
    expect(got.map((o) => o.file.name)).toEqual(['a.ipynb', 'b.ipynb']);
    expect(got[0].handle).toBe(ha);
    expect(got[1].handle).toBe(hb);
  });

  it('returns nothing when the picker is closed (it throws)', async () => {
    vi.stubGlobal('window', {
      showOpenFilePicker: async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      },
    });
    expect(await pick()).toEqual([]);
  });

  it('returns nothing when the picker throws before it returns a promise', async () => {
    vi.stubGlobal('window', {
      showOpenFilePicker: () => {
        throw new TypeError('not allowed');
      },
    });
    expect(await pick()).toEqual([]);
  });

  it('returns nothing where the browser has no picker', async () => {
    vi.stubGlobal('window', {});
    expect(await pick()).toEqual([]);
  });
});
