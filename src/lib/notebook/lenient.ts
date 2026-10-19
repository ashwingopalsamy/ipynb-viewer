import type { Json } from './types';

const BARE = /^(?:NaN|-?Infinity)/;

/** Rewrites NaN, Infinity and trailing commas, which some writers emit, into valid JSON. */
function repair(raw: string): string {
  let out = '';
  let last = 0;
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const c = raw.charCodeAt(i);
    if (c === 34) {
      i++;
      while (i < n) {
        const d = raw.charCodeAt(i);
        if (d === 92) i += 2;
        else if (d === 34) break;
        else i++;
      }
      i++;
    } else if (c === 78 || c === 73 || c === 45) {
      const m = BARE.exec(raw.slice(i, i + 9));
      if (m) {
        out += raw.slice(last, i) + 'null';
        i += m[0].length;
        last = i;
      } else i++;
    } else if (c === 44) {
      let j = i + 1;
      while (j < n && raw.charCodeAt(j) <= 32) j++;
      const next = raw.charCodeAt(j);
      if (next === 93 || next === 125) {
        out += raw.slice(last, i);
        last = i + 1;
      }
      i++;
    } else i++;
  }
  return out + raw.slice(last);
}

export function lenientParse(raw: string): { ok: true; value: Json } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as Json };
  } catch {
    try {
      return { ok: true, value: JSON.parse(repair(raw)) as Json };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
