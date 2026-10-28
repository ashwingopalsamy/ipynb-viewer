import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fileKey, hooks, mine, saved, strip } from './state.svelte';

const storage = (get: (key: string) => string | null) => vi.stubGlobal('sessionStorage', { getItem: get });
const holds = (value: string | null) => storage(() => value);

afterEach(() => vi.unstubAllGlobals());

describe('fileKey', () => {
  it('names a file by name, size and modified time', () => {
    const f = new File(['hello'], 'a.ipynb', { lastModified: 1700000000000 });
    expect(fileKey(f)).toBe('file:a.ipynb:5:1700000000000');
  });

  it('tells two files apart when any of the three differ', () => {
    const a = new File(['hello'], 'a.ipynb', { lastModified: 1 });
    expect(fileKey(new File(['hello'], 'a.ipynb', { lastModified: 1 }))).toBe(fileKey(a));
    expect(fileKey(new File(['hello'], 'b.ipynb', { lastModified: 1 }))).not.toBe(fileKey(a));
    expect(fileKey(new File(['hello!'], 'a.ipynb', { lastModified: 1 }))).not.toBe(fileKey(a));
    expect(fileKey(new File(['hello'], 'a.ipynb', { lastModified: 2 }))).not.toBe(fileKey(a));
  });

  it('cannot be mistaken for the key of a link', () => {
    expect(fileKey(new File([''], 'link:x', { lastModified: 0 })).startsWith('file:')).toBe(true);
  });
});

describe('saved', () => {
  it('reads the links in order', () => {
    holds('["a.ipynb","https://x.example/b.ipynb"]');
    expect(saved()).toEqual(['a.ipynb', 'https://x.example/b.ipynb']);
  });

  it('returns nothing when the key is missing', () => {
    holds(null);
    expect(saved()).toEqual([]);
  });

  it('returns nothing for text that is not JSON', () => {
    for (const bad of ['', '{', 'tabs', '[1,', 'undefined']) {
      holds(bad);
      expect(saved(), bad).toEqual([]);
    }
  });

  it('returns nothing when the JSON is not an array', () => {
    for (const odd of ['{"0":"a"}', '"a"', '5', 'null', 'true']) {
      holds(odd);
      expect(saved(), odd).toEqual([]);
    }
  });

  it('keeps only the strings of an array', () => {
    holds('["a",1,null,{"x":1},"b",["c"],true,"",2.5]');
    expect(saved()).toEqual(['a', 'b', '']);
  });

  it('returns nothing when storage throws', () => {
    storage(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(saved()).toEqual([]);
  });

  it('returns nothing when there is no storage at all', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(saved()).toEqual([]);
  });

  it('asks storage for the "tabs" key', () => {
    const seen: string[] = [];
    storage((k) => (seen.push(k), null));
    saved();
    expect(seen).toEqual(['tabs']);
  });
});

describe('shared state', () => {
  it('starts as one notebook that is its own tab, with no strip', () => {
    expect(strip).toEqual({ list: [], active: 'h', me: 'h' });
    expect(mine).toEqual({ name: '', status: 'loading', dirty: false, key: '', link: '' });
    expect(hooks.keep()).toBe(false);
  });

  it('keeps its calls replaceable, as a frame replaces them', () => {
    const open = act.open;
    const seen = vi.fn();
    Object.assign(act, { open: seen });
    act.open([{ link: 'a' }]);
    expect(seen).toHaveBeenCalledWith([{ link: 'a' }]);
    Object.assign(act, { open });
  });
});
