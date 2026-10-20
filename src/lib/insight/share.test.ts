import { describe, expect, it } from 'vitest';
import { LINK_MAX, pack, unpack } from './share';

describe('share', () => {
  it('carries a notebook through the fragment and back', async () => {
    const nb = JSON.stringify({ cells: [{ cell_type: 'markdown', source: ['# Héllo ✓'] }], nbformat: 4, nbformat_minor: 5 });
    const hash = await pack(nb, 'my notes.ipynb');
    expect(hash).toMatch(/^nb=[\w-]+&name=my%20notes\.ipynb$/);
    expect(await unpack('#' + hash)).toEqual({ text: nb, name: 'my notes.ipynb' });
  });

  it('compresses, so a real notebook stays under the limit', async () => {
    const nb = JSON.stringify({ cells: Array.from({ length: 200 }, (_, i) => ({ cell_type: 'code', source: [`x${i} = df.groupby("k").mean()\n`], outputs: [] })) });
    expect((await pack(nb, 'a')).length).toBeLessThan(nb.length / 3);
    expect(LINK_MAX).toBeGreaterThan(10_000);
  });

  it('names the file after the link when it has no name, and tidies a bad one', async () => {
    expect((await unpack('#nb=' + (await pack('{}', '')).split('&')[0].slice(3)))?.name).toBe('shared.ipynb');
    expect((await unpack('#' + (await pack('{}', 'a/../b‮'))))?.name).toBe('a..b.ipynb');
  });

  it('returns null for an address with no notebook, and fails plainly on damage', async () => {
    expect(await unpack('#section-2')).toBeNull();
    await expect(unpack('#nb=!!!!')).rejects.toThrow(/damaged/);
    await expect(unpack('#nb=AAAA')).rejects.toThrow(/damaged/);
  });

  it('refuses a link that inflates past the limit', async () => {
    const bomb = await pack('x'.repeat(41 * 1024 * 1024), 'b');
    await expect(unpack('#' + bomb)).rejects.toThrow(/more than/);
  });
});
