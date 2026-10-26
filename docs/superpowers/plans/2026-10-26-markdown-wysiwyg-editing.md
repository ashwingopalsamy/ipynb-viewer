# Markdown WYSIWYG Editing Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, one task at a time, in order. No subagents. Steps use checkbox (`- [ ]`) syntax. Each task lists every file it touches; read only those (and only the line ranges named) before editing.

**Goal:** Double-click a rendered markdown block in a locally opened notebook to edit it in place, rich (no markdown syntax shown) for prose, raw source for everything else, then save back to the same file with a byte-minimal diff.

**Architecture:** Editing is *block-scoped*. A cell's source is lexed once with the app's own `marked` instance; each top-level token becomes a `Block` with a `[start, end)` span in the source. Only the active block is turned into an editor; on commit its new text is spliced into that span, so every untouched block (and every untouched byte of the file) stays identical. Rich blocks round-trip through a small neutral inline model (`Inline[]`) that is serialized to markdown by our code, not by the browser. Save patches only the edited cells' `"source"` values inside the original file text.

**Tech Stack:** Svelte 5 runes, TypeScript, `marked` 18 (lexer + parser), DOMPurify, File System Access API, Vitest (node environment, no DOM).

**Spec:** this document (the Design section below is the spec).

---

## Design (the spec)

### Scope
- In: markdown cells of a notebook opened from disk (picker, drop, or the home page hand-off: anything that reaches `App.open` with a `File`), nbformat ≥ 4, not truncated.
- Out (read-only, double-click does nothing): notebooks opened from a link (`?url=`/`#nb=`), nbformat 3 (its heading cells were rewritten to `#` markdown by `normalize.ts:169`, so the file text no longer matches), files with an "ends early" warning, code and raw cells.
- Task 7 adds standalone `.md` / `.markdown` files through the same machinery. It is separable; stop after Task 6 if not wanted.

### Interaction
| Gesture | Result |
|---|---|
| Double-click a block | That block becomes editable in place, caret at the clicked point. |
| Paragraph / ATX or setext heading / simple list | **Rich** editor (contenteditable, rendered look, no syntax). |
| Code fence, table, blockquote, hr, math block, nested or task list | **Source** editor (auto-sized monospace textarea of that block's raw markdown). |
| Cell containing a top-level HTML block, `\r`, or any span the lexer cannot locate | Whole-cell source editor (one textarea for the cell). |
| `Mod+B` / `Mod+I` / `Mod+Shift+X` / `Mod+E` / `Mod+K` | bold / italic / strike / inline code / link (rich only). |
| `Enter` in paragraph or heading | Split at caret: text before stays, text after becomes a new paragraph block, which becomes active with caret at its start. |
| `Shift+Enter` | Hard line break (serialized `\` + newline). |
| `Enter` in a list item | Native new item. `Backspace` on an empty last item leaves the list (content after the list becomes a paragraph). |
| `Mod+/` | Toggle the active block between rich and source. |
| `Esc`, blur, `Mod+Enter` | Commit and leave. Empty text deletes the block. |
| `Mod+Z` inside the editor | Native undo. Outside any editor: undo the last committed block edit (stack of 100). |
| `Mod+S` | Save (see Persistence). Swallowed (no browser "save page") whenever editing is on. |

Inline content the rich editor cannot represent (inline math, images, inline HTML) appears as an **atom**: a `contenteditable="false"` chip showing the sanitized rendering; it is preserved byte-for-byte. To change one, `Mod+/` into source.

Out of scope for v1: arrow-key navigation across blocks, markdown input rules (typing `**x**` converts), drag-reordering blocks, creating new cells, editing code cells.

### Fidelity invariants
1. A block that was opened and committed without any input event produces no source change.
2. Untouched blocks are byte-identical after any edit to another block (span splice, never re-render-to-markdown of the cell).
3. Inside an edited rich block, every mark node (strong/em/del/code/link) whose content is unchanged re-emits its original raw markdown (`__x__` stays `__x__`, `[a][ref]` stays a reference link). Only changed nodes take canonical syntax.
4. Literal text stays literal: serialization escapes only characters that would otherwise change meaning in that position (rules in Task 2).
5. Soft line breaks (`\n` inside a paragraph) are kept as `\n` in the DOM text nodes and in the model; never read text with `innerText`.
6. Save rewrites only the `"source"` value of edited cells, in the file's existing shape (string vs array, indentation, line ending). Everything else in the file is untouched.
7. Save never overwrites a file that changed on disk since it was loaded or last saved.

### Trust boundary
The editor DOM is built only with `createElement` / `textContent` from the model. The only HTML strings inserted come from `renderMarkdown`-family functions (DOMPurify-sanitized). Paste inserts `text/plain` only. Drops onto an editor are prevented. Nothing is fetched.

### Persistence
- With a `FileSystemFileHandle`: on `Mod+S`, re-read the file, refuse if its `lastModified:size` stamp differs from the one recorded at load/last save, patch, `requestPermission({ mode: 'readwrite' })`, write via `createWritable()`. Tell the watcher the new stamp so it does not echo-reload.
- Without a handle (input fallback, Safari/Firefox): `Mod+S` downloads the patched file under the same name.
- While there are unsaved edits: the watcher does not apply disk changes; it raises one notice ("<name> changed on disk. Save will not overwrite it; reopen to load the new version."). `beforeunload` warns. Opening another file (pick, drop, `Mod+O`) asks `confirm('Discard unsaved edits to <name>?')`.

---

## Global Constraints
- No new dependencies. `package.json` is not modified.
- Every new module under `src/lib/edit/` is loaded with dynamic `import()` on first double-click or first save, never statically from `App.svelte`/`MarkdownCell.svelte`, except `src/lib/edit/session.svelte.ts` (must stay under ~60 lines; it is in the core chunk). The core reader must stay under 30 KB gzipped (`docs/architecture.md`).
- Viewer-only documents (link-opened, nbformat 3) render exactly as today through the unchanged `renderMarkdown` path.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); no stores.
- Match repo voice: short plain-English comments, only where the why is not obvious; no JSDoc boilerplate.
- Never assign `innerHTML` with anything that did not come out of DOMPurify.
- Colors/radii/spacing in new CSS use existing custom properties from `src/app.css` / `src/lib/md.css`; do not invent hex values.
- Tests are Vitest in the node environment (no jsdom): only pure modules get unit tests (`blocks.ts`, `inline.ts`, `nbsplice.ts`). DOM/Svelte pieces are verified manually by the user.

## Review Focus
1. **Cells the lexer cannot map** (CRLF source, top-level HTML block like `<div align="center">`, a duplicate link definition): must fall back to whole-cell source mode, never splice at a wrong offset. → test `blocksOf returns null for \r and html` (Task 1).
2. **Markdown-significant characters typed as text** (`2 * 3`, `snake_case`, `$5 and $6`, a line starting `# ` or `1. `): must render literally after commit with no gratuitous escapes. → tests `escapes only where meaning changes` (Task 2).
3. **Lenient notebooks** (`NaN` in metadata, trailing commas, a non-object entry in `cells`): patch must target the right cell or refuse. → tests `skips non-object cells`, `tolerates NaN`, `refuses on mismatch` (Task 3).
4. **Disk changed while dirty** (Jupyter autosave): no silent overwrite in either direction. → stamp check in `save()` (Task 6); manual check listed there.
5. **Whitespace at mark edges** (user bolds `"bold "` including the trailing space): must serialize `**bold** ` not `**bold **` (which would not parse as bold). → test `moves edge whitespace outside marks` (Task 2).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/mdlex.ts` (new) | The single configured `Marked` instance (math extensions moved out of `markdown.ts`). Node-safe: no DOMPurify, no CSS imports. |
| `src/lib/markdown.ts` (modify) | Imports `marked` from `mdlex.ts`; adds `renderParts` and `renderInline`. |
| `src/lib/edit/blocks.ts` (new) | Source → `Block[]` with spans; `replaceBlock`. Pure. |
| `src/lib/edit/inline.ts` (new) | `Inline` model; tokens → model; model → markdown with minimal escaping and raw preservation. Pure. |
| `src/lib/edit/nbsplice.ts` (new) | Locate and rewrite cell `"source"` values in notebook JSON text. Pure. |
| `src/lib/edit/session.svelte.ts` (new, core) | Editing on/off, dirty flag, commit/undo hooks registered by `App`. |
| `src/lib/edit/dom.ts` (new) | Model ↔ contenteditable DOM; formatting commands. |
| `src/lib/edit/BlockEditor.svelte` (new) | The active-block editor (rich + source modes). |
| `src/lib/edit/edit.css` (new) | Editor styles. |
| `src/lib/edit/save.ts` (new) | Stamp check, patch, write or download. |
| `src/lib/MarkdownCell.svelte` (modify) | Per-block render when editable; double-click activation. |
| `src/App.svelte` (modify) | Wires session (apply, undo, save, dirty guards). |
| `src/lib/watch.ts` (modify) | Hold updates while dirty; accept our own saved stamp. |
| `docs/shortcuts.md` (modify) | Editing keys. |

---

### Task 1: Shared lexer and block spans

**Files:**
- Create: `src/lib/mdlex.ts`, `src/lib/edit/blocks.ts`, `src/lib/edit/blocks.test.ts`
- Modify: `src/lib/markdown.ts:1-58` (lexer definitions move out; see Step 1)

**Interfaces:**
- Produces:
  - `mdlex.ts`: `export const marked: Marked`, `export const escapeHtml: (s: string) => string`, `export interface MathToken`.
  - `blocks.ts`:
    ```ts
    export type Kind = 'paragraph' | 'heading' | 'list' | 'source';
    export interface Block { start: number; end: number; kind: Kind; token: Token }
    export function blocksOf(source: string): Block[] | null;
    export function replaceBlock(source: string, b: Block, text: string): string;
    export function lexOf(source: string): TokensList; // marked.lexer(source), exported so renderParts lexes once
    ```

- [ ] **Step 1: Move the lexer.** Cut lines 9-58 of `markdown.ts` (the `escapeHtml`, `math`, `MathToken`, `INLINE_MATH`, `DOLLAR`, `marked` definitions) into `src/lib/mdlex.ts`, exporting `marked`, `escapeHtml`, `MathToken`. `markdown.ts` keeps everything else and adds `import { marked, escapeHtml } from './mdlex';`. Pure move; no behavior change.

- [ ] **Step 2: Write the failing tests** in `src/lib/edit/blocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blocksOf, replaceBlock } from './blocks';

const kinds = (s: string) => blocksOf(s)!.map((b) => [b.kind, s.slice(b.start, b.end)]);

describe('blocksOf', () => {
  it('maps each top-level block to its exact span, without trailing newlines', () => {
    const s = '# Title\n\nSome *text*\nwrapped.\n\n- a\n- b\n\n```py\nx = 1\n```\n';
    expect(kinds(s)).toEqual([
      ['heading', '# Title'],
      ['paragraph', 'Some *text*\nwrapped.'],
      ['list', '- a\n- b'],
      ['source', '```py\nx = 1\n```'],
    ]);
  });
  it('treats setext headings as headings', () => expect(kinds('Title\n=====\n')[0][0]).toBe('heading'));
  it('sends nested lists, task lists, tables, quotes, hr and math blocks to source', () => {
    for (const s of ['- a\n  - b', '- [ ] a', '| a |\n|---|\n| 1 |', '> q', '---', '$$\nx\n$$']) expect(blocksOf(s)![0].kind).toBe('source');
  });
  it('skips link definitions but keeps their bytes outside every span', () => {
    const s = 'See [x][r].\n\n[r]: https://example.com\n';
    expect(kinds(s)).toEqual([['paragraph', 'See [x][r].']]);
  });
  it('returns null for \\r and html blocks', () => {
    expect(blocksOf('a\r\nb')).toBeNull();
    expect(blocksOf('<div align="center">\n\nx\n\n</div>')).toBeNull();
  });
});

describe('replaceBlock', () => {
  const s = 'one\n\ntwo\n\nthree';
  const b = () => blocksOf(s)!;
  it('replaces only the span', () => expect(replaceBlock(s, b()[1], 'TWO')).toBe('one\n\nTWO\n\nthree'));
  it('deletes a middle block with its following blank line', () => expect(replaceBlock(s, b()[1], '')).toBe('one\n\nthree'));
  it('deletes the last block with its preceding blank line', () => expect(replaceBlock(s, b()[2], '')).toBe('one\n\ntwo'));
  it('splits into two paragraphs', () => expect(replaceBlock(s, b()[0], 'o\n\nne')).toBe('o\n\nne\n\ntwo\n\nthree'));
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/edit/blocks.test.ts` — expect FAIL (module missing).

- [ ] **Step 4: Implement `blocks.ts`.** Algorithm (the part the tests do not dictate):
  - Return `null` if `source.includes('\r')`.
  - `tokens = marked.lexer(source)`. Walk with a cursor `from = 0`: for each token, `i = source.indexOf(t.raw, from)`; if `i < 0` return `null`; `from = i + t.raw.length`. Skip `space` and `def` tokens (they produce no element). If any token is `html`, return `null`.
  - `end = i + t.raw.replace(/\n+$/, '').length`.
  - Kind: `paragraph` → `'paragraph'`; `heading` → `'heading'`; `list` → `'list'` when every item has `!task`, and `item.tokens` contains no `list` token and exactly one `text`/`paragraph` token; everything else → `'source'`.
  - `replaceBlock`: non-empty text → `source.slice(0, start) + text + source.slice(end)`. Empty: if a later block exists remove `[start, end)` plus the following `\n+` run; otherwise remove the preceding `\n+` run plus `[start, end)`.

- [ ] **Step 5: Run** `npx vitest run src/lib/edit/blocks.test.ts` — expect PASS. Also run `npx vitest run` once to confirm the move broke nothing.

- [ ] **Step 6: Commit** `refactor(markdown): share the marked instance; feat(edit): block spans` (two commits if the move is separable: `git add src/lib/mdlex.ts src/lib/markdown.ts` first).

---

### Task 2: Inline model and minimal-diff serializer

**Files:**
- Create: `src/lib/edit/inline.ts`, `src/lib/edit/inline.test.ts`

**Interfaces:**
- Consumes: `marked` from `../mdlex` (tests lex with it); `Block`, `blocksOf` from `./blocks` (Task 1).
- Produces:
  ```ts
  export type Inline =
    | { t: 'text'; v: string }
    | { t: 'strong' | 'em' | 'del'; c: Inline[]; raw?: string; sig?: string }
    | { t: 'code'; v: string; raw?: string; sig?: string }
    | { t: 'link'; href: string; title: string | null; c: Inline[]; raw?: string; sig?: string }
    | { t: 'br' }
    | { t: 'atom'; raw: string };
  export function fromTokens(tokens: Token[]): Inline[];   // sets raw and sig (= canonical(node)) on every mark node
  export function toMarkdown(nodes: Inline[], ctx?: 'paragraph' | 'heading'): string;
  export function blockText(b: Block): Inline[][];         // paragraph/heading: one line; list: one entry per item
  export function blockMarkdown(b: Block, items: Inline[][], extra?: Inline[][]): string; // rebuilds the block keeping its markers
  ```

- [ ] **Step 1: Write the failing tests** in `src/lib/edit/inline.test.ts`. Helper: `const inl = (s: string) => fromTokens((marked.lexer(s)[0] as Tokens.Paragraph).tokens);`

```ts
it('round-trips untouched input byte-for-byte', () => {
  for (const s of ['__b__ and _i_', 'a [x][r] b\n\n[r]: /u', '<https://a.b>', 'x\\*y', '`` a`b ``', 'soft\nwrap', 'math $x^2$ here', '![alt](p.png)', 'a<br>b', 'hard\\\nbreak'])
    expect(toMarkdown(inl(s))).toBe(s.split('\n\n')[0]);
});
it('decodes text to what the reader sees', () => expect(inl('a < b \\* c & d')).toEqual([{ t: 'text', v: 'a < b * c & d' }]));
it('keeps math, images and inline html as atoms', () => expect(inl('$x$').map((n) => n.t)).toEqual(['atom']));
it('re-emits a changed mark canonically and an unchanged one as written', () => {
  const n = inl('__a__ __b__');
  (n[2] as any).c = [{ t: 'text', v: 'B' }];
  expect(toMarkdown(n)).toBe('__a__ **B**');
});
it('escapes only where meaning changes', () => {
  const md = (v: string, ctx?: 'heading') => toMarkdown([{ t: 'text', v }], ctx);
  expect(md('2 * 3')).toBe('2 \\* 3');
  expect(md('snake_case and _x')).toBe('snake_case and \\_x');
  expect(md('$5 and $6')).toBe('$5 and $6');
  expect(md('cost $x$')).toBe('cost \\$x\\$');
  expect(md('# not a heading')).toBe('\\# not a heading');
  expect(md('1. not a list')).toBe('1\\. not a list');
  expect(md('line\n- not a list')).toBe('line\n\\- not a list');
  expect(md('a [b] c')).toBe('a \\[b] c');
  expect(md('x < y, <tag>')).toBe('x < y, \\<tag>');
  expect(md('ends with #', 'heading')).toBe('ends with \\#');
});
it('moves edge whitespace outside marks', () =>
  expect(toMarkdown([{ t: 'strong', c: [{ t: 'text', v: 'bold ' }] }, { t: 'text', v: 'x' }])).toBe('**bold** x'));
it('fences code with a longer backtick run', () => expect(toMarkdown([{ t: 'code', v: 'a`b' }])).toBe('``a`b``'));
it('wraps link targets that need it', () =>
  expect(toMarkdown([{ t: 'link', href: 'a b(c)', title: null, c: [{ t: 'text', v: 'x' }] }])).toBe('[x](<a b(c)>)'));
it('every canonical output re-lexes to the same model', () => {
  const tree: Inline[] = [{ t: 'em', c: [{ t: 'text', v: 'a*b' }] }, { t: 'text', v: ' 2 * 3 ' }, { t: 'code', v: 'k' }];
  expect(strip(inl(toMarkdown(tree)))).toEqual(tree); // strip() drops raw/sig
});
```
And for lists:
```ts
it('rebuilds a list keeping marker, start number and looseness', () => {
  const b = blocksOf('3) a\n\n4) b')![0];
  const items = blockText(b);
  expect(blockMarkdown(b, [...items, [{ t: 'text', v: 'c' }]])).toBe('3) a\n\n4) b\n\n5) c');
});
it('keeps setext style for a setext heading', () => {
  const b = blocksOf('Old\n---')![0];
  expect(blockMarkdown(b, [[{ t: 'text', v: 'New title' }]])).toBe('New title\n---------');
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/edit/inline.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `inline.ts`.**
  - `fromTokens` maps marked inline tokens: `text`/`escape` → text (merge adjacent; text value must be the decoded character data — if marked 18 gives HTML-escaped `text`, decode `&amp; &lt; &gt; &quot; &#39;`; the `decodes text` test pins this); `strong`/`em`/`del` → mark with children; `codespan` → code; `link` → link; `br` → br; everything else (`inlineMath`, `image`, `html`, unknown) → `{ t: 'atom', raw: token.raw }`. For a `text` token that has its own `.tokens` (list items), recurse.
  - `raw` is the token's `raw`; `sig` is `toMarkdown([node])` computed right after building the node (canonical form). In `toMarkdown`, a mark node emits `raw` iff `raw !== undefined && canonical(node) === sig`.
  - Canonical syntax: strong `**…**`, em `*…*`, del `~~…~~`, code: backtick run one longer than the longest inside, padded with one space when content starts or ends with a backtick; link `[…](href "title")`, href in `<…>` when it contains space, `(`, `)` or `<`; br `\` + `\n`; atom → raw.
  - Before emitting a mark, move leading/trailing whitespace of its first/last text child outside it; drop marks that end up empty.
  - Escaping (text nodes only, applied per character with context):
    - always: `\` `` ` `` `*`
    - `_` only when not between two word characters (`/\w/` on both sides)
    - `[` always; `]` never
    - `$` only when the next char is neither a digit nor whitespace nor end
    - `<` only when followed by `[A-Za-z/!?]`
    - `~` only when doubled, `&` only when it begins `&#?\w+;`
    - at line start (start of node when it is the first node, or after `\n`): `#` (if followed by space/end, up to six `#`), `>`, `+`/`-`/`*` followed by space, `\d+` followed by `.` or `)` and a space (escape the `.`/`)`), a line that is entirely `=+` or `-+`, 4+ leading spaces (drop to 3)
    - heading context: a trailing run of `#` is escaped.
  - `blockText`: paragraph/heading → `[fromTokens(token.tokens)]`; list → one entry per item from its single text/paragraph token.
  - `blockMarkdown`: heading → ATX `'#'.repeat(depth) + ' ' + text`, or setext when the original raw's second line matches `/^[=-]+\s*$/`, using that char, underline length = text length; paragraph → text; list → marker from the first item's raw (`/^\s*([-+*]|\d+[.)])/`), ordered numbers counting from `token.start`, items joined with `\n\n` when `token.loose` else `\n`; `extra` entries are appended after the list as paragraphs separated by `\n\n`.

- [ ] **Step 4: Run** `npx vitest run src/lib/edit/inline.test.ts` — expect PASS.

- [ ] **Step 5: Commit** `feat(edit): inline model and minimal-diff markdown serializer`.

---

### Task 3: Notebook source patcher

**Files:**
- Create: `src/lib/edit/nbsplice.ts`, `src/lib/edit/nbsplice.test.ts`

**Interfaces:**
- Consumes: `joinText` from `../notebook/normalize` (export it from `src/lib/notebook/index.ts` if not already exported).
- Produces:
  ```ts
  export interface Located { start: number; end: number; value: string } // value = decoded joined source
  export function locateSources(text: string): Located[] | null;       // one entry per object element of top-level "cells", in order
  export function patch(text: string, original: string[], edits: Map<number, string>): string | null;
  ```
  `original[k]` is the parsed source of object-cell `k` at load; `edits` maps object-cell ordinal → new source. `patch` returns `null` when the located count differs from `original.length` or any located value differs from `original[k]`.

- [ ] **Step 1: Write the failing tests:**

```ts
const nb = (cells: string) => `{\n "cells": [${cells}\n ],\n "metadata": {"x": NaN,},\n "nbformat": 4,\n "nbformat_minor": 5\n}\n`;
const md = (lines: string[]) => `\n  {\n   "cell_type": "markdown",\n   "metadata": {},\n   "source": [\n${lines.map((l) => '    ' + JSON.stringify(l)).join(',\n')}\n   ]\n  }`;

it('locates array and string sources and tolerates NaN and trailing commas', () => {
  const t = nb(md(['a\n', 'b']) + ',' + `\n  {"cell_type": "markdown", "metadata": {}, "source": "s",}`);
  expect(locateSources(t)!.map((l) => l.value)).toEqual(['a\nb', 's']);
});
it('skips non-object cells', () => expect(locateSources(nb('1,' + md(['x'])))!.map((l) => l.value)).toEqual(['x']));
it('rewrites only the edited source, in the same shape and indent', () => {
  const t = nb(md(['a\n', 'b']) + ',' + md(['keep']));
  const out = patch(t, ['a\nb', 'keep'], new Map([[0, 'A\nB\nC']]))!;
  expect(out).toBe(t.replace('    "a\\n",\n    "b"', '    "A\\n",\n    "B\\n",\n    "C"'));
});
it('writes an empty source as []', () => expect(patch(nb(md(['a'])), ['a'], new Map([[0, '']]))).toContain('"source": []'));
it('keeps a string source a string', () =>
  expect(patch(nb(`{"source": "s"}`), ['s'], new Map([[0, 'x\ny']]))).toContain('"source": "x\\ny"'));
it('keeps CRLF structure', () => {
  const t = nb(md(['a'])).replace(/\n/g, '\r\n');
  expect(patch(t, ['a'], new Map([[0, 'a\nb']]))).toContain('"a\\n",\r\n    "b"');
});
it('refuses on mismatch', () => {
  expect(patch(nb(md(['a'])), ['different'], new Map([[0, 'x']]))).toBeNull();
  expect(patch(nb(md(['a'])), ['a', 'extra'], new Map([[0, 'x']]))).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/edit/nbsplice.test.ts` — expect FAIL.

- [ ] **Step 3: Implement.** A hand-written structural scanner, not `JSON.parse` of the whole file (that would choke on `NaN` and lose formatting). It needs: skip whitespace; skip a string honoring `\` escapes; skip a value (string, object, array with nesting depth, or a bare word/number run up to `,` `}` `]` or whitespace); inside the top-level object read key strings and find `"cells"`; iterate its array elements, and for each object element find the key `"source"` and record its value span. Decode the span with `joinText(JSON.parse(span))` (the span itself is strict JSON: strings only). Encoding in `patch`:
  - string shape → `JSON.stringify(source)`;
  - array shape → split with `source.split(/(?<=\n)/)` (empty source → `[]`); if the original had a newline right after `[`, emit each element on its own line with the original first element's indent and close with the original `]` line's indent; otherwise `[` + elements joined by `, ` + `]`;
  - line ending = `\r\n` if the file text contains `\r\n`, else `\n`.
  - Apply edits from the highest offset to the lowest so earlier offsets stay valid.

- [ ] **Step 4: Run** the test file — expect PASS.

- [ ] **Step 5: Commit** `feat(edit): patch notebook cell sources in place`.

---

### Task 4: Session state, per-block rendering, App wiring

**Files:**
- Create: `src/lib/edit/session.svelte.ts`
- Modify: `src/lib/markdown.ts` (add two exports after `renderMarkdown`), `src/App.svelte` (script: `open`, `pick`, `choose`, `drop`, window keydown; template: name pill)

**Interfaces:**
- Consumes: `blocksOf`, `lexOf`, `Block` (Task 1).
- Produces:
  ```ts
  // session.svelte.ts
  export const session: { on: boolean; dirty: boolean };
  export interface Host { apply(id: string, source: string): void; save(): Promise<void>; }
  export function host(h: Host | null): void;
  export function commit(id: string, before: string, after: string): void; // no-op when before === after; pushes undo, calls apply, sets dirty
  export function undo(): boolean;                                         // false when the stack is empty
  export function reset(): void;                                           // clears stack and dirty (after open/save)

  // markdown.ts
  export function renderParts(source: string, attachments?: Record<string, MimeBundle>): { parts: string[]; blocks: Block[] | null };
  export function renderInline(raw: string): string;
  ```
  `renderParts`: when `blocksOf` is `null`, return `{ parts: [renderMarkdown(source, attachments)], blocks: null }`. Otherwise lex once, run the attachment rewrite with `marked.walkTokens(tokens, fn)` (same body as today's `walkTokens` option, extracted into a shared function), render each block's token with `marked.parser([token])` (give the array the lexed `links` property), sanitize each with the same DOMPurify config as `renderMarkdown` (extract the config object to a module const), then set `data-b="<index>"` on each top-level element via a `<template>` and take its `innerHTML`. Blocks with `kind` and no element (impossible after skipping space/def) need no handling. `renderInline(raw)`: `marked.parseInline(raw)` through the same sanitizer; used for atoms.

- [ ] **Step 1: Write `session.svelte.ts`** to the interface above. Undo entries `{ id, before, after }`, capped at 100 (drop oldest). `undo()` pops and calls `apply(id, before)`; dirty stays true.

- [ ] **Step 2: Add `renderParts` / `renderInline`** to `markdown.ts` as specified. `renderMarkdown`'s output must not change.

- [ ] **Step 3: Wire `App.svelte`.**
  - Keep `let loaded: { file: File; handle?: FileSystemFileHandle; stamp: string; original: string[] } | null` set in `open` after a successful read when `file instanceof File && !link && meta.nbformat >= 4 && !warnings.some(w => w.startsWith('The file ends early'))`; `original = notebook.cells.map(c => c.source)`. Link-opened files pass a flag (the `link.start` callback path) so they stay read-only. Set `session.on = !!loaded`; `reset()`.
  - `host({ apply: (id, source) => (cells = cells.map(c => c.id === id ? { ...c, source } : c)), save: () => import('./lib/edit/save').then(m => m.save(...)) })` — `save` args per Task 6; leave it as `async () => {}` until Task 6.
  - At the top of `open`, `pick`, `choose`, `drop`: `if (session.dirty && !confirm(\`Discard unsaved edits to ${name}?\`)) return;`.
  - Window keydown: `Mod+S` → when `session.on`, `preventDefault()` and `host.save`; `Mod+Z` without Shift, when the target is not inside `input, textarea, [contenteditable]` and `session.on` → `if (undo()) preventDefault()`.
  - `<svelte:window onbeforeunload={(e) => session.dirty && e.preventDefault()} />`.
  - Name pill: append `<span class="dirty" title="Unsaved edits. ⌘S saves.">•</span>` when `session.dirty`.

- [ ] **Step 4: Run** `npx vitest run` and `npm run check` — expect both clean.

- [ ] **Step 5: Commit** `feat(edit): editing session and per-block rendering`.

---

### Task 5: Block editor and double-click activation

**Files:**
- Create: `src/lib/edit/dom.ts`, `src/lib/edit/BlockEditor.svelte`, `src/lib/edit/edit.css`
- Modify: `src/lib/MarkdownCell.svelte` (whole file, 33 lines)

**Interfaces:**
- Consumes: `Block`, `replaceBlock` (T1); `Inline`, `blockText`, `blockMarkdown`, `toMarkdown` (T2); `renderParts`, `renderInline` (T4); `session`, `commit` (T4).
- Produces:
  ```ts
  // dom.ts
  export function toDom(nodes: Inline[], doc: Document): DocumentFragment;
  export function fromDom(root: Node): Inline[];
  export function mark(root: HTMLElement, kind: 'strong' | 'em' | 'del' | 'code' | 'link'): void;
  ```
  ```svelte
  <!-- BlockEditor.svelte props -->
  { block: Block | null; source: string; mode: 'rich' | 'source'; at: { x: number; y: number } | 'start' | null;
    onDone: (next: string | null, follow?: 'next') => void }   // next = whole new cell source, null = unchanged
  ```
  `block: null` means whole-cell source mode (`source` is the entire cell).

- [ ] **Step 1: `dom.ts`.**
  - `toDom`: text → `Text` (keep `\n` as is); strong/em/del → `strong`/`em`/`del`; code → `code`; link → `a` with `href` attribute set only when it matches the `LINKS` regex from `../guard` (else omitted) and `data-href` holding the original; br → `br`; atom → `span.atom[contenteditable=false]` whose `innerHTML = renderInline(raw)`. Store the source node in a module `WeakMap<Element, Inline>` so `fromDom` can carry `raw`/`sig` forward when the element survives.
  - `fromDom`: walk children. `b`/`strong` → strong, `i`/`em` → em, `s`/`strike`/`del` → del, `code` → code (its `textContent`), `a` → link (`data-href` ?? `href`), `br` → br, `.atom` → its WeakMap atom; a `span`/`font` with inline `font-weight` ≥ 600 / `font-style: italic` / `text-decoration` containing `line-through` → the matching mark, any other element → unwrap; `div`/`p` children (browser line wrappers) → preceded by a `br` unless first. Text: replace ` ` with space, strip `​`. Merge adjacent text, drop empty marks; copy `raw`/`sig` from the WeakMap entry when the element's kind is unchanged.
  - `mark`: strong/em/del via `document.execCommand('bold' | 'italic' | 'strikeThrough')` (keeps native undo); `code` by wrapping the selection `Range` in `code` (or unwrapping when inside one); `link` via `prompt('Link', current)` then `execCommand('createLink', false, url)` (empty → `unlink`).

- [ ] **Step 2: `BlockEditor.svelte`.**
  - Rich mode renders the block's own tag (`p`, `h{depth}`, `ul`/`ol` with `li`s, `start` attribute for ordered) with `contenteditable`, filled from `toDom(blockText(block)…)` on mount. Record `touched = false`; any `input` event sets it.
  - Caret: on mount, if `at` is a point use `document.caretPositionFromPoint` ?? `caretRangeFromPoint` to place it; `'start'` → start; else end. Focus.
  - Keys (rich): `Mod+B/I/E/K`, `Mod+Shift+X` → `mark`; `Enter` in p/h (no Shift) → split: extract the range from caret to end of editor into a fragment, `fromDom` both halves, `next = replaceBlock(source, block, blockMarkdown(block, [left]) + '\n\n' + toMarkdown(right))`, `onDone(next, 'next')`; `Shift+Enter` → `execCommand('insertLineBreak')`; `Mod+/` → switch to source mode with the current serialized text; `Esc` / `Mod+Enter` → commit; all handled keys call `stopPropagation()` so the window shortcuts do not fire.
  - Commit: `!touched` → `onDone(null)`. Else, list: collect top-level `li` → items, any non-`li` element after them → `extra`. `onDone(replaceBlock(source, block, blockMarkdown(block, items, extra)))`.
  - `focusout` whose `relatedTarget` is outside the editor → commit.
  - `paste` → `preventDefault`, `execCommand('insertText', false, clipboardData.getData('text/plain'))`. `drop`/`dragover` → `preventDefault` + `stopPropagation`.
  - Source mode: `textarea` with the block's raw (`source.slice(start, end)`) or whole cell; auto-height (`style.height = scrollHeight`); `Mod+Enter`/`Esc`/blur commit via `replaceBlock` (or whole-cell replacement); `Mod+/` back to rich only when `block.kind !== 'source'` and the text still lexes to one block of the same kind (else stay).

- [ ] **Step 3: `MarkdownCell.svelte`.**
  - When `session.on`, render with `renderParts` instead of `renderMarkdown`; keep `parts`/`blocks` in state. Not editable → existing path untouched.
  - Template when editable: `{#each parts as p, i}{#if active && active.b === i}<Editor …/>{:else}{@html p}{/if}{/each}`; whole-cell mode (`blocks === null`) replaces all parts with the editor. `Editor` is the dynamically imported `BlockEditor` component (load `dom.ts`, `inline.ts`, `blocks.ts` through it).
  - `ondblclick` on the root: `if (!session.on) return;` find `(e.target as Element).closest('[data-b]')` within root (whole-cell mode: any target); links still activate (a single click keeps navigating as today). Set `active = { b, mode: blocks[b].kind === 'source' ? 'source' : 'rich', at: { x: e.clientX, y: e.clientY } }` after the import resolves.
  - `onDone(next, follow)`: `active = null`; if `next !== null` call `commit(cell.id, cell.source, next)`; if `follow === 'next'`, after the re-render (`await tick()`), set `active = { b: old + 1, mode: 'rich', at: 'start' }`.
  - Keep the `typeset(root)` effect; it must re-run after each parts change (depend on `parts`).

- [ ] **Step 4: `edit.css`** (imported from `BlockEditor.svelte`): editable block keeps the rendered typography (no font change in rich mode); `outline: 1px solid` using the accent/line variable and a small radius, `outline-offset: 4px`; `caret-color` from the text variable; `.atom` `user-select: all` with a subtle background; source-mode `textarea` uses the code font variable, full width, no resize handle, `white-space: pre`, `overflow-x: auto`. In editable documents, `.md [data-b]` gets `cursor: text`.

- [ ] **Step 5: `npm run check`** — expect clean. Hand to the user for manual checks (see Task 6 checklist).

- [ ] **Step 6: Commit** `feat(edit): double-click to edit markdown blocks in place`.

---

### Task 6: Save, watcher coordination, shortcuts doc

**Files:**
- Create: `src/lib/edit/save.ts`
- Modify: `src/lib/watch.ts:31-70` (`watch` signature), `src/App.svelte` (call sites of `watch` and `host.save`), `docs/shortcuts.md`

**Interfaces:**
- Consumes: `patch` (T3), `session`, `reset` (T4), `say` from `../notice`.
- Produces:
  ```ts
  // watch.ts
  export interface Watching { stop(): void; saved(f: File): void }
  export function watch(handle, first, current, apply, hold: () => boolean): Watching;
  // save.ts
  export interface Target { name: string; file: File; handle?: FileSystemFileHandle; stamp: string; original: string[]; cells: Cell[] }
  export async function save(t: Target): Promise<{ ok: true; file?: File } | { ok: false; why: string }>;
  ```

- [ ] **Step 1: `watch.ts`.** Add the `hold` parameter: when the stamp changed and settled but `hold()` is true, do not `apply`; call `say(\`${name} changed on disk. Save will not overwrite it; reopen to load the new version.\`)` once per distinct stamp (keep `seen` unchanged so it stays detectable). Return `{ stop, saved }` where `saved(f)` sets `seen = stamp(f)`. Export `stamp`.

- [ ] **Step 2: `save.ts`.**
  - `edits`: for each `k`, `cells[k].source !== original[k]` → `edits.set(k, cells[k].source)`. None → `{ ok: true }`.
  - Read current text: `handle ? await handle.getFile() : file`. With a handle, `stamp(current) !== t.stamp` → `{ ok: false, why: 'changed on disk' }`.
  - `patched = patch(text, original, edits)`; `null` → `{ ok: false, why: 'the file does not match what was opened' }`.
  - Handle: `(await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted' || (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'`, else fall through to download. Write with `createWritable()`, `write(patched)`, `close()`; return `{ ok: true, file: await handle.getFile() }`.
  - Download: `Blob([patched], { type: 'application/json' })` (`text/markdown` for Task 7), object URL, temporary `<a download={name}>`, click, revoke. Return `{ ok: true }`.
  - Add the two permission methods to `src/fs.d.ts` if the types are missing.

- [ ] **Step 3: App wiring.** `stop = w.stop` with `w = watch(..., () => session.dirty)`. `host.save` builds the `Target` from `loaded` and current `cells`, calls `save`; on success: `loaded.original = cells.map(c => c.source)`, `loaded.stamp`/`loaded.file` updated from the returned file, `w.saved(file)`, `reset()`, `say(\`Saved ${name}\`)` (or `Downloaded ${name}`); on failure: `say(\`Not saved: ${why}.\`)` and leave dirty.

- [ ] **Step 4: `docs/shortcuts.md`.** Add an "Editing" table: double-click, `⌘S`/`Ctrl S`, `⌘B` `⌘I` `⌘E` `⌘K` `⌘⇧X`, `Enter`, `Shift Enter`, `⌘/`, `Esc`, `⌘Z`. Note editing is only for notebooks opened from disk. If `src/lib/Menus.svelte` renders the `?` sheet from its own list (line ~25), add the same rows there.

- [ ] **Step 5: `npm run check` and `npx vitest run`** — expect clean.

- [ ] **Step 6: Commit** `feat(edit): save edits back to the notebook file`.

- [ ] **Step 7: Manual checks for the user** (do not automate): open `examples/cooling-coffee.ipynb` from disk in Chrome; double-click a paragraph, bold a word, `Esc`, `⌘S`; `git diff examples/` shows only that cell's source lines changed. Repeat: Enter-split, list item add, code fence in source mode, `⌘Z` after commit, edit then touch the file externally then `⌘S` (must refuse), Safari (download path). Then `git checkout examples/`.

---

### Task 7 (optional, separable): standalone `.md` files

**Files:**
- Modify: `src/App.svelte` (`open`, picker `accept`), `src/lib/watch.ts` (`pick` types; `watch` re-read), `index.html:225` (`accept`) and whatever home-page script filters dropped files by extension (find with `grep -rn "ipynb" src/about index.html`), `src/lib/edit/save.ts`.

**Interfaces:**
- Produces: `Target` gains `kind: 'ipynb' | 'md'`.

- [ ] **Step 1:** In `open`, when `/\.(md|markdown)$/i.test(file.name)`: read `await file.text()`, set `cells = [{ type: 'markdown', id: 'md', source: text, metadata: {}, attachments: {} }]`, `meta = { nbformat: 4, nbformatMinor: 0, metadata: {}, language: null, kernel: null }`, `loaded.original = [text]`, `kind = 'md'`. Add `.md,.markdown,text/markdown` to every `accept` list and `'text/markdown': ['.md', '.markdown']` to the picker types.
- [ ] **Step 2:** In `save`, `kind === 'md'` → the new text is `cells[0].source` directly (no `patch`), MIME `text/markdown`. In `watch`, re-read an `.md` file as a single cell the same way instead of `readNotebook`.
- [ ] **Step 3:** `npm run check`; commit `feat: open and edit standalone markdown files`.
