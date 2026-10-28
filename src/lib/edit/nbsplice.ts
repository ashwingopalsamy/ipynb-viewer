import { joinText } from '../notebook/normalize';

/** Where one cell's `"source"` value sits in the file text. A cell with no `"source"` has start and end of -1. */
export interface Located {
  start: number;
  end: number;
  /** The source as the reader joins it. */
  value: string;
}

// A scanner rather than JSON.parse: notebooks in the wild hold NaN and trailing commas, and a parse-and-print would
// reformat every number and image in the file. This only needs to know where values start and end.

const space = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '﻿';

function skipSpace(t: string, i: number): number {
  while (i < t.length && space(t[i])) i++;
  return i;
}

/** The index after the string that opens at `i`. */
function skipString(t: string, i: number): number {
  for (i++; i < t.length; i++) {
    if (t[i] === '\\') i++;
    else if (t[i] === '"') return i + 1;
  }
  return t.length;
}

function skipValue(t: string, i: number): number {
  const c = t[i];
  if (c === '"') return skipString(t, i);
  if (c === '{' || c === '[') {
    let depth = 0;
    for (; i < t.length; i++) {
      const ch = t[i];
      if (ch === '"') i = skipString(t, i) - 1;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') if (--depth === 0) return i + 1;
    }
    return t.length;
  }
  while (i < t.length && !space(t[i]) && t[i] !== ',' && t[i] !== '}' && t[i] !== ']') i++;
  return i;
}

interface Member {
  key: string;
  start: number;
  end: number;
}

function members(t: string, i: number): Member[] {
  const out: Member[] = [];
  for (i++; i < t.length; ) {
    i = skipSpace(t, i);
    if (i >= t.length || t[i] === '}') break;
    if (t[i] !== '"') {
      i++;
      continue;
    }
    const keyEnd = skipString(t, i);
    let key = '';
    try {
      key = JSON.parse(t.slice(i, keyEnd));
    } catch {
      // an unreadable key matches nothing
    }
    i = skipSpace(t, keyEnd);
    if (t[i] !== ':') continue;
    i = skipSpace(t, i + 1);
    const end = skipValue(t, i);
    out.push({ key, start: i, end });
    i = Math.max(end, i + 1);
  }
  return out;
}

function elements(t: string, i: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (i++; i < t.length; ) {
    i = skipSpace(t, i);
    if (i >= t.length || t[i] === ']') break;
    if (t[i] === ',') {
      i++;
      continue;
    }
    const end = skipValue(t, i);
    out.push({ start: i, end });
    i = Math.max(end, i + 1);
  }
  return out;
}

/** One entry per object in the top-level `"cells"` array, in order: the same cells the reader keeps. */
export function locateSources(text: string): Located[] | null {
  const top = skipSpace(text, 0);
  if (text[top] !== '{') return null;
  const cells = members(text, top).findLast((m) => m.key === 'cells');
  if (!cells || text[cells.start] !== '[') return null;
  const out: Located[] = [];
  for (const el of elements(text, cells.start)) {
    if (text[el.start] !== '{') continue;
    const src = members(text, el.start).findLast((m) => m.key === 'source');
    if (!src) {
      out.push({ start: -1, end: -1, value: '' });
      continue;
    }
    let value = '';
    try {
      value = joinText(JSON.parse(text.slice(src.start, src.end)));
    } catch {
      return null;
    }
    out.push({ start: src.start, end: src.end, value });
  }
  return out;
}

function encode(text: string, at: Located, source: string): string {
  if (text[at.start] === '"') return JSON.stringify(source);
  const lines = source === '' ? [] : source.split(/(?<=\n)/);
  if (!lines.length) return '[]';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const old = text.slice(at.start, at.end);
  const lead = text.slice(text.lastIndexOf('\n', at.start) + 1, at.start);
  let elem: string;
  let close: string;
  const multi = /^\[[ \t]*\r?\n([ \t]*)/.exec(old);
  if (multi) {
    elem = multi[1];
    close = /\n([ \t]*)\]$/.exec(old)?.[1] ?? '';
  } else if (/^[ \t]*"source"\s*:\s*$/.test(lead)) {
    // an empty `[]` written on its own line takes the file's own indent step
    const key = /^[ \t]*/.exec(lead)![0];
    close = key;
    elem = key + (/^\{[ \t]*\r?\n([ \t]+)/.exec(text.slice(skipSpace(text, 0)))?.[1] ?? '  ');
  } else {
    return `[${lines.map((l) => JSON.stringify(l)).join(', ')}]`;
  }
  return `[${eol}${lines.map((l) => elem + JSON.stringify(l)).join(',' + eol)}${eol}${close}]`;
}

/**
 * The file text with only the edited cells' sources replaced, in the shape each had; everything else, outputs and
 * images included, is untouched. `original[k]` is what the reader parsed for the k-th cell and `edits` the new
 * sources by the same index. Returns null when the text no longer matches what was parsed, so nothing is guessed.
 */
export function patch(text: string, original: string[], edits: Map<number, string>): string | null {
  const found = locateSources(text);
  if (!found || found.length !== original.length) return null;
  if (found.some((f, k) => f.value !== original[k])) return null;
  let out = text;
  for (const k of [...edits.keys()].sort((a, b) => b - a)) {
    const at = found[k];
    if (!at || at.start < 0) return null;
    out = out.slice(0, at.start) + encode(text, at, edits.get(k)!) + out.slice(at.end);
  }
  return out;
}
