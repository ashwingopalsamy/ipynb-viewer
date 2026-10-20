import { describe, expect, it } from 'vitest';
import type { Cell } from './notebook';
import { remoteHosts, sites } from './netstate.svelte';

const md = (source: string) => ({ type: 'markdown', source }) as unknown as Cell;
const code = (html: string, source = '') => ({ type: 'code', source, outputs: [{ type: 'display', data: { 'text/html': html } }] }) as unknown as Cell;

describe('remoteHosts', () => {
  it('counts markdown and html pictures by site', () => {
    const found = remoteHosts([
      md('![a](https://imgur.com/a.png) and ![b](https://imgur.com/b.png "t") and ![c](<https://github.com/c.png>)'),
      code('<img src="https://cdn.example.org/x.png"><img alt=x src=\'https://imgur.com/z.png\'>'),
    ]);
    expect(Object.fromEntries(found)).toEqual({ 'imgur.com': 3, 'github.com': 1, 'cdn.example.org': 1 });
  });

  it('ignores data pictures, relative paths, links, and code', () => {
    const found = remoteHosts([
      md('![a](data:image/png;base64,AAAA) ![b](./b.png) [link](https://example.com/page)'),
      code('<a href="https://example.com/">x</a>', '![x](https://hidden.example/x.png)'),
    ]);
    expect(found.size).toBe(0);
  });

  it('reads no further than the cap into a huge cell', () => {
    const far = 'x'.repeat(400_000) + '![a](https://late.example/a.png)';
    expect(remoteHosts([md(far)]).size).toBe(0);
  });
});

describe('sites', () => {
  it('names one or two sites and counts the rest', () => {
    expect(sites(['a.com'])).toBe('a.com');
    expect(sites(['a.com', 'b.com'])).toBe('a.com and b.com');
    expect(sites(['a.com', 'b.com', 'c.com'])).toBe('a.com and 2 other sites');
  });
});
