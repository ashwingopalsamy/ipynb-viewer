import type { Token, Tokens, TokensList } from 'marked';
import { marked } from '../mdlex';

/** How a block is edited: `source` blocks only open as raw markdown. */
export type Kind = 'paragraph' | 'heading' | 'list' | 'source';

export interface Block {
  /** Where the block sits in the cell's source, without the blank lines around it. */
  start: number;
  end: number;
  kind: Kind;
  token: Token;
}

export const lexOf = (source: string): TokensList => marked.lexer(source);

function kindOf(t: Token): Kind {
  if (t.type === 'paragraph') return 'paragraph';
  if (t.type === 'heading') return 'heading';
  if (t.type !== 'list') return 'source';
  const list = t as Tokens.List;
  for (const item of list.items) {
    if (item.task) return 'source';
    const body = item.tokens.filter((x) => x.type !== 'space');
    // an empty item, as `- ` alone, still makes a simple list
    if (body.length > 1 || (body.length === 1 && body[0].type !== 'text' && body[0].type !== 'paragraph')) return 'source';
  }
  return 'list';
}

/** The one block that `src` lexes to, spanning all of it. Unlike `blocksOf` it accepts what the lexer normalises (`- ` alone), for text typed into the editor. */
export function blockFrom(src: string): Block | null {
  const tokens = lexOf(src).filter((t) => t.type !== 'space');
  return tokens.length === 1 ? { start: 0, end: src.length, kind: kindOf(tokens[0]), token: tokens[0] } : null;
}

/**
 * The top-level blocks of a cell with their spans, or null when the source cannot be mapped with confidence
 * (carriage returns, raw HTML blocks, anything the lexer rewrote); the caller then edits the whole cell as text.
 */
export function blocksOf(source: string, tokens?: TokensList): Block[] | null {
  if (source.includes('\r')) return null;
  const out: Block[] = [];
  let from = 0;
  for (const t of tokens ?? lexOf(source)) {
    if (t.type === 'space') continue;
    if (t.type === 'html') return null;
    const i = source.indexOf(t.raw, from);
    // anything between two tokens that is not blank means the lexer dropped or rewrote text
    if (i < 0 || !/^\s*$/.test(source.slice(from, i))) return null;
    from = i + t.raw.length;
    if (t.type === 'def') continue;
    out.push({ start: i, end: i + t.raw.replace(/\n+$/, '').length, kind: kindOf(t), token: t });
  }
  return out;
}

/** The source with one block's span swapped for `text`; an empty `text` removes the block and one blank-line gap. */
export function replaceBlock(source: string, b: Block, text: string): string {
  if (text) return source.slice(0, b.start) + text + source.slice(b.end);
  if (/\S/.test(source.slice(b.end))) return source.slice(0, b.start) + source.slice(b.end).replace(/^\n+/, '');
  return source.slice(0, b.start).replace(/\n+$/, '') + source.slice(b.end);
}
