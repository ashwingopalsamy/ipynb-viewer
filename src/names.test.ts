/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// macOS and Windows ignore case, so `net.svelte` would resolve to Net.svelte there while net.svelte.ts sits beside it.
describe('file names', () => {
  it('never differ only by case once the extension is dropped', () => {
    const names = (readdirSync('src', { recursive: true }) as string[]).map((f) => f.toLowerCase());
    const seen = new Map<string, string>();
    const clash: string[] = [];
    for (const f of names) {
      const stem = f.replace(/\.ts$/, '');
      const other = seen.get(stem);
      if (other !== undefined && other !== f) clash.push(`${other} / ${f}`);
      seen.set(stem, f);
    }
    expect(clash).toEqual([]);
  });
});
