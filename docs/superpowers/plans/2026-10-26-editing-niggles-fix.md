# Editing niggles: fix plan

Follow-up to `2026-10-26-markdown-wysiwyg-editing.md`. Audited in the built-in browser (Chromium) on `http://localhost:5173/?url=cooling-coffee.ipynb` at 900x700, 1280x800 and 390x844, dark and light, against branch `feat/markdown-wysiwyg-editor-d40a96` at `54ef643`. `7abc281` (the open editor's cell stops skipping off-screen paint, so its outline is no longer cut off) landed during the audit and is accounted for below; it moved `edit.css` down by two lines. Line numbers are otherwise at `54ef643`; each change also quotes the text to find, so use the quote if a line has moved.

## How to execute (read this first)

- Inline, one task at a time, in order. Read only the line ranges a task names. Do not re-read a file you already have from an earlier task unless the task says so.
- No tests, no builds, no linters, no formatters. Run `npm run check` once, after the last task.
- Commit after each task: `fix(edit): ...` for Tasks 1 to 6, `feat(edit): ...` for the rest. Short plain comments in code, no JSDoc.
- Never click Save in the browser (it opens a native file picker and hangs). The demo page keeps unsaved edits in memory. To start clean, use the browser tool `navigate` to the demo URL with `force: true` (the page asks before it unloads while dirty).
- Browser setup for every verification: `resize_window` 900x700 (crisp screenshots; still the desktop layout), then 1280x800 and 390x844 where a step says so. Reset with preset `desktop` at the end. Use `javascript_tool` for exact checks; screenshots for looks.
- Dev server is already running from this worktree; Vite hot-reloads. Do not start another.

## Findings

| id | sev | what I saw | how to reproduce / evidence | root cause |
|---|---|---|---|---|
| F1 | High | Enter in the middle of a paragraph opens the second half as a monospace source textarea showing `\*\*world\*\* and \`code\` here`. | Open a paragraph, caret mid-text, Enter. `document.querySelector('.md .editing-src')` is non-null. | `MarkdownCell.svelte:104` reads `page?.blocks` synchronously after `commit()`; `cell` (so `page`) only updates when the parent flushes, so `kindAt(i)` (`:114`) reads the old block at `i` (the blockquote, kind `source`). Same stale array: the ghost `after` index (`:116`) and the `blocks.length === before` guard (`:126`), which can never fail. |
| F2 | High | After an editor closes without a change (or the next block opens), formulas in that block show as raw mono TeX (`\frac{dT}{dt} = ...`). | Double-click the `$$` block in the first cell, Esc. `document.querySelectorAll('[data-cell="cell-00"] .math[data-tex]').length` is 1. Same for a paragraph with `$k$`. | The typeset effect (`MarkdownCell.svelte:35-38`) depends only on `page`. Closing re-inserts `{@html part}` (`:157`), which holds untypeset `.math[data-tex]` placeholders, and `page` did not change, so nothing typesets them. |
| F3 | High | Shift+Enter shows a line break while editing; after commit it is gone (source gets `Solving\n the`, a soft break that renders as a space). Paragraphs hard-wrapped in the source also show their line breaks in the editor but not on the page, so the block reflows when it opens. | Shift+Enter mid-paragraph, type, Esc; inspect the rendered `<p>`: no `<br>`. | `edit.css:7` `white-space: pre-wrap`: Chrome's `insertLineBreak` (`BlockEditor.svelte:254`) inserts a `\n` character, not a `<br>`, in pre-wrap text. Verified: with `white-space: normal` injected, Shift+Enter inserts `<br>` and the committed page shows `Solving<br>Z`. |
| F4 | Medium | Cmd+B (or the bubble's B) on a word in a heading makes it look un-bolded; the markdown does not change. | Open `## The model`, select "model", Cmd+B. Editor HTML: `The <span style="font-weight: normal;">model</span>`; Cmd+/ shows `## The model`. | `execCommand('bold')` (`dom.ts:136`) treats a heading as already bold and removes it; `fromDom`'s `marks()` (`dom.ts:53-60`) ignores `font-weight: normal`. WYSIWYG mismatch. |
| F5 | Medium | (code reading) A refused commit still opens the next block. | `commit()` returns false when the cell changed underneath (E28). | `MarkdownCell.svelte:103` ignores the boolean, then follows. |
| F6 | Medium | Enter at the end of a paragraph draws an empty bordered box with a caret and no hint (owner's screenshot). | Enter at the end of "A cup of filter coffee...". | Ghost paragraph (`MarkdownCell.svelte:131-137`) is a bare `<p class="editing">` with the accent outline (`edit.css:2-10`) and no placeholder. |
| F7 | Medium | Typing in that new paragraph and pressing Enter commits and closes everything; writing cannot continue. | Type "Hello", Enter: no editor is open. | `BlockEditor.svelte:257` `if (ghost) finish(compute())` with no follow. |
| F8 | Medium | The editing outline and the hover tint are cut off at the right edge of the text column (the open right end of the box in the owner's screenshot) and on both sides at phone width. | 900x700: ghost box has no right edge. 390x844: editing box shows only top and bottom lines. | `.cell` has `content-visibility: auto` (`app.css:276`), which clips paint at the cell's padding box. Markdown cells have no inline padding, so anything drawn outside `.md` on the right (desktop) or either side (phone) is clipped. Code cells avoid this with `--bleed` (`app.css:281-284`). Since `7abc281` a cell with an open editor sets `content-visibility: visible` (`edit.css:3`), so the editor is no longer clipped; the hover tint still is, and so would the phone dot of Task 13. |
| F9 | Low | Edited-cell bar cut through the first letters (owner's screenshot). | | Removed in `54ef643`. Nothing replaces it, so an edited block is now not marked anywhere but the header dot. Task 13 adds a per-block dot. |
| F10 | Medium | Hover tint sits flush against the text (4px), is clipped on the right (F8), stays on neighbouring blocks while another block is being edited (the "dark band"), and on headings and blockquotes it replaces their own background (the heading hairline vanishes on hover). | Hover "The data" heading: hairline disappears. Open a block, leave the pointer on the paragraph above: tinted. | `md.css:61` uses the `background` shorthand at higher specificity than `.md > [data-h]` (`md.css:37-45`) and `.md blockquote` (`md.css:18`), and has no "not while editing" condition. |
| F11 | Medium | Format bubble appears on every double-click entry (the word re-selected by E4), covering the line above; centred on the selection with no clamp (off-screen near the left edge on a phone); 32px buttons on touch; pressed state is accent-blue; 16px icons look small next to the header's 18px. | Double-click any word: bubble shows immediately over the heading. | `Bubble.svelte:20-37` reacts to any non-collapsed selection, including the programmatic one from `BlockEditor.svelte:149-154`; `edit.css:42-69` fixed 32px, accent pressed state (DESIGN.md: accent is for links and the unread dot only); `Bubble.svelte:69` `size={16}`. |
| F12 | Medium | Typing `**world**`, `` `code` ``, `# `, `- ` stays literal and is escaped on commit (`\*\*world\*\*`). | Type in any rich block. | No input rules (`BlockEditor.svelte:382` only sets `touched`). |
| F13 | Medium | Editing a `$$` block swaps the equation for a bare TeX textarea, no preview; layout jumps. | Double-click the equation. | Source mode only (`BlockEditor.svelte:367-368`). |
| F14 | Low | Source textarea is two lines tall for one line of text; long prose lines (blockquote) scroll sideways and are cut off ("...image, `i` for wha"); it is styled as a code box with a 1px border plus a 2px accent ring. | Open the blockquote: `ta.rows === 2`, height 62px for one line. | Textarea default `rows=2` with `size()` (`BlockEditor.svelte:295-298`) using `scrollHeight` (never below 2 rows); `white-space: pre` (`edit.css:38`); `edit.css:23-40`. |
| F15 | Low | ArrowUp/Down walk block to block until a source block, then stop: no way out of a textarea but Esc. | ArrowDown from "A cup..." into the blockquote, ArrowDown again: stays. | `srcKey` (`BlockEditor.svelte:349-360`) has no arrow handling. |
| F16 | Low | Opening a source block shifts the content below (math 70px to 62px, blockquote about 75px to 62px; a heading in source loses its spacing and hairline). | Measure the next block's `top` before and after opening. | Textarea `margin: 0` (`edit.css:27`) and F14's height. Partly inherent; Tasks 5 and 8 reduce it. |
| F17 | Low, unconfirmed | Once, ArrowDown needed an extra press to leave a single-line block after arriving from above. | Not reproduced reliably. | Unknown; possibly the arrival caret from `{ edge: 'top' }` (`BlockEditor.svelte:141-146`). Watch for it in the QA pass; do not fix blind. |

Out of scope, noticed: the `align` block in the second cell numbers both lines "(1)" (KaTeX rendering, not editing).

## Design decisions (grounded in DESIGN.md and the tokens in `src/app.css :root`)

- **Live block (rich and source)**: no outline. A soft slab: `box-shadow: inset 0 0 0 100vmax var(--fill), 0 0 0 6px var(--fill)` with `border-radius: var(--r-key)` (6px). `--fill` is the fg at 6%, a step above the 4% hover, so hover and editing read as one family. Box-shadow, not `background`, so a heading keeps its hairline and a blockquote its surface. The caret stays `--fg`.
- **Hover**: the same slab at fg 4%, same 6px spread, only on cells with no open editor.
- **Room for both**: markdown cells get 12px inline padding with a matching negative margin (like the code cells' bleed), so the 6px spread is never clipped.
- **Source textarea**: same slab, no border, no ring, mono 13.5px/1.6 (DESIGN `code`), `rows=1`, wraps prose; code fences and tables keep `white-space: pre`.
- **Ghost paragraph**: placeholder `Type a paragraph · Esc to cancel` in `--fg-3`, drawn by `::before`, gone on the first character. After Task 15 it becomes `Type, or # for a heading, - for a list`.
- **Edited marker**: per block, not per cell. A 6px `--accent` dot (DESIGN: accent is for "the unread dot"; the header already uses an accent dot for unsaved edits), 20px left of the block's text (in the gutter, clear of every glyph), vertically centred on the block's first line. Phone: 11px left, inside the new 12px bleed.
- **Bubble**: a glass pill like the header (`border-radius: 999px`), buttons `var(--ctl)` (32px, 44px on touch) and pill-shaped, icons at the header's 18px (Lucide default), hover `var(--btn-2)` (fg 8%, DESIGN's one hover), pressed fg 14% with `--fg` text (no accent). Shown only after the reader acts in the editor, not on entry. Clamped 128px from the viewport edges. No B in headings.
- **Math block**: source textarea plus a live KaTeX preview under it.
- **Input rules (minimal, safe)**: inline `**x**`, `*x*`, `~~x~~`, `` `x` `` convert when the closing character is typed; block `# `, `## `, `### `, `- `, `* `, `+ `, `1. `, `1) ` at the very start of a paragraph convert it to a heading or list in place. Nothing for `>` or fences (those are source-only blocks). No `_x_` rule (snake_case).

## Ordering

Tasks 1 to 6 are correctness and are independent of each other. Task 7 must land before 8, 9 and 13 (they draw outside the text column). Task 10 needs Task 1 (the ghost-after-ghost index). Task 11 after Task 4 (both touch `Bubble.svelte`). Task 12 after Task 8 (CSS next to it). Tasks 14, 15, 16 in that order, after Task 10 (they replace the same `oninput` and Enter lines).

---

## Task 1: Read the cell's blocks after the parent has flushed (F1, F5)

Read: `src/lib/MarkdownCell.svelte` lines 98-128 only.

Replace the body of `done()` from `const was = open;` to the end of the function with:

```ts
    const was = open;
    const before = page?.blocks?.length ?? 0;
    open = null;
    session.active = null;
    // a commit that was refused (the cell changed underneath) leaves everything closed
    const ok = next === null || commit(cell.id, cell.source, next);
    if (!follow || !was || !ok) {
      // the reader stays where they were rather than falling to the top of the page, unless they clicked on something else
      tick().then(() => {
        const now = document.activeElement;
        if (!now || now === document.body) root?.closest<HTMLElement>('[data-cell]')?.focus({ preventScroll: true });
      });
      return;
    }
    // the new source reaches this cell only when the parent flushes, so the blocks are read after that
    await tick();
    const blocks = page?.blocks ?? null;
    const kindAt = (i: number): 'rich' | 'source' => (blocks![i].kind === 'source' ? 'source' : 'rich');
    if (follow.to === 'ghost') {
      // a new paragraph that was just committed is the block after `was.b`, so the next one goes after it
      const after = Math.min(was.kind === 'ghost' ? was.b + 1 : was.b, (blocks?.length ?? 0) - 1);
      activate({ kind: 'ghost', b: after, mode: 'rich', at: follow.at });
    } else if (was.kind === 'ghost') {
      // a new paragraph that was committed is done; one that was empty opens again
      if (next === null) activate({ kind: 'ghost', b: was.b, mode: 'rich', at: follow.at });
    } else if (was.kind === 'whole' || !blocks) {
      if (was.kind === 'whole' && follow.to === 'same') activate({ kind: 'whole', b: -1, mode: 'source', at: follow.at });
    } else {
      const i = follow.to === 'next' ? was.b + 1 : follow.to === 'prev' ? was.b - 1 : was.b;
      // a block the edit split or joined elsewhere than expected is left closed
      if (blocks[i] && (follow.to !== 'same' || blocks.length === before)) activate({ kind: 'block', b: i, mode: kindAt(i), at: follow.at });
    }
```

Only three things change: `ok`, the `blocks` read moved below `await tick()`, and the ghost `after` index.

Verify (900x700, fresh demo page):
1. Double-click "filter" in "A cup of filter coffee...". In `javascript_tool`, put the caret after "coffee,": `const ed=document.querySelector('.md .editing'); getSelection().collapse(ed.firstChild, 23)`. Press Return.
2. `javascript_tool`: `[document.querySelector('.md .editing')?.tagName, !!document.querySelector('.md .editing-src'), document.querySelector('.md .editing')?.textContent.startsWith('a kitchen')]` must be `["P", false, true]`.
3. Screenshot: the second half is in proportional Inter text, not monospace.

---

## Task 2: Typeset a block again when its editor closes (F2)

Read: `src/lib/MarkdownCell.svelte` lines 35-38.

Replace:

```ts
  $effect(() => {
    page;
    if (root && page) typeset(root);
  });
```

with:

```ts
  // a block drawn again after its editor closes holds TeX placeholders too, so closing typesets as a new page does
  $effect(() => {
    page;
    open;
    if (root && page) typeset(root);
  });
```

(`typeset` only touches `.math[data-tex]`, so running it again is cheap.)

Verify: double-click the `$$` equation in the first cell, press Escape. `document.querySelectorAll('[data-cell="cell-00"] .math[data-tex]').length` must be 0 and the screenshot shows the typeset fraction, not mono TeX. Repeat with the "Solving the equation gives one number, k" paragraph (double-click "Solving", Escape): the `k` is italic KaTeX.

---

## Task 3: Shift+Enter makes a real line break (F3)

Read: `src/lib/edit/edit.css` lines 1-11; `src/lib/edit/dom.ts` line 12.

1. `edit.css`: delete the line `  white-space: pre-wrap;` inside `.md .editing { ... }` (line 9 since `7abc281`). The editor then lays text out as the page does: a soft break in the source shows as a space, and the browser's `insertLineBreak` inserts a `<br>` (the model's hard break, written `\` + newline).
2. `dom.ts` line 12, replace the comment with: `/** The model as DOM. Text keeps its soft line breaks as \n, which the editor shows as spaces, as the page does. */`

No other change; `tidy` (`dom.ts:51`) already turns the browser's non-breaking spaces back into spaces.

Verify:
1. Double-click "Newton's" in the first cell. In `javascript_tool`: `getSelection().collapse(document.querySelector('.md .editing').firstChild, 8)`. Press Shift+Return, type `Z`, press Escape.
2. `[...document.querySelectorAll('.md p')].find(p => p.textContent.includes('law of cooling')).innerHTML.slice(0, 30)` must contain `<br>`.
3. Screenshot: "Newton's" alone on its line, "Z law of cooling..." on the next, both in the editor (before Escape) and on the page (after).

---

## Task 4: No bold toggle inside headings (F4)

Read: `src/lib/edit/BlockEditor.svelte` lines 181-183 and 390; `src/lib/edit/Bubble.svelte` lines 7 and 57.

1. `BlockEditor.svelte`, replace `fmt`:

```ts
  const fmt = (kind: 'strong' | 'em' | 'del' | 'code' | 'link') => {
    // a heading is bold already: the browser's bold would take it off on screen while the markdown kept it
    if (kind === 'strong' && shape?.kind === 'heading') return;
    if (el && mark(el, kind, say)) touched = true;
  };
```

2. `BlockEditor.svelte` line 390: `<Bubble root={() => el} onmark={fmt} heading={shape?.kind === 'heading'} />`.
3. `Bubble.svelte` line 7: `let { root, onmark, heading = false }: { root: () => HTMLElement | undefined; onmark: (kind: Kind) => void; heading?: boolean } = $props();`
4. `Bubble.svelte` line 57: `{#each TOOLS.filter((t) => !(heading && t.kind === 'strong')) as t}`

Cmd+B in a heading is still swallowed by `richKey` (it calls `own()` first), so the page's own Cmd+B does not fire.

Verify: double-click "model" in "The model". The bubble has 4 buttons (no B). Press Cmd+B: `document.querySelector('.md .editing').innerHTML` is still `The model` (no span). Escape.

---

## Task 5: Source textarea sizing and wrapping (F14)

Read: `src/lib/edit/BlockEditor.svelte` lines 295-298 and 368; `src/lib/edit/edit.css` lines 25-42.

1. `BlockEditor.svelte` line 297: `node.style.height = node.scrollHeight + 'px';` (no border any more after Task 8; harmless before it).
2. `BlockEditor.svelte` line 368, on the `<textarea ...>` add `rows="1"` and `class:code={block?.token.type === 'code' || block?.token.type === 'table'}` (keep `class="editing-src"`).
3. `edit.css`: in `.md textarea.editing-src` change `white-space: pre;` to `white-space: pre-wrap;` and `overflow-x: auto;` to `overflow: hidden;`. After that rule add:

```css
/* code and tables keep their lines and scroll sideways */
.md textarea.editing-src.code { white-space: pre; overflow-x: auto; }
```

Verify: double-click the "Try it." blockquote. `const ta=document.querySelector('.md .editing-src'); [ta.rows, ta.scrollWidth <= ta.clientWidth]` is `[1, true]`, and the screenshot shows the whole quote wrapped over two or three lines with no empty line under it. Escape. Double-click the `bash` code fence in the last cell (scroll down): its lines do not wrap.

---

## Task 6: Arrow keys leave a source block too (F15)

Read: `src/lib/edit/BlockEditor.svelte` lines 349-360.

In `srcKey`, after the line `else if (mod && !e.altKey && !e.shiftKey && 'kbie'.includes(e.key.toLowerCase())) own();` add:

```ts
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.shiftKey && !e.altKey && block && ta) {
      // at the very start or end of the text the arrow goes on into the neighbouring block, as in the rich editor
      const up = e.key === 'ArrowUp';
      const end = up ? 0 : ta.value.length;
      if (ta.selectionStart !== end || ta.selectionEnd !== end) return;
      const all = blocksOf(source);
      const i = all ? all.findIndex((b) => b.start === block.start) : -1;
      if (i < 0 || !all?.[up ? i - 1 : i + 1]) return;
      own();
      finish(compute(), { to: up ? 'prev' : 'next', at: { edge: up ? 'bottom' : 'top', x: ta.getBoundingClientRect().left } });
    }
```

A first ArrowUp on the first line moves the caret to the start (the browser's own behaviour); the second leaves. Same for ArrowDown at the end.

Verify: double-click "A cup of filter coffee...", press ArrowDown until the blockquote opens as a textarea, then ArrowDown twice more: the "Newton's law..." paragraph is now the open rich editor (`document.querySelector('.md .editing')?.textContent.startsWith("Newton")`). ArrowUp twice from its first line returns to the textarea; ArrowUp twice more returns to "A cup...".

---

## Task 7: Give markdown cells room at their sides (F8; prerequisite for 8, 9, 13)

Read: `src/app.css` lines 270-285.

After the `.cell.code { ... }` rule (ends line 284) add:

```css
/* A text cell keeps 12px of room at each side, given back as negative margin, so what the editor draws around a block
   (content-visibility clips paint at the cell's edge) is not cut off. The text stays where it was. */
.cell.markdown { padding-inline: 12px; margin-inline: -12px; }
```

Verify (900x700): `const c=document.querySelector('.cell.markdown'), m=c.querySelector('.md'); [m.getBoundingClientRect().left - c.getBoundingClientRect().left, c.getBoundingClientRect().right - m.getBoundingClientRect().right]` is `[92, 12]` (80px gutter + 12). At 390x844 it is `[12, 12]`. A screenshot before and after shows the text in exactly the same place.

---

## Task 8: The live block is a soft slab, not an outlined box (F6 look, F8, F14 look, F16)

Read: `src/lib/edit/edit.css` lines 1-40 (as left by Tasks 3 and 5).

1. Keep the `.cell:has(> .md > :is(.editing, .editing-src)) { content-visibility: visible; }` rule from `7abc281` (harmless next to Task 7, and it keeps the slab whole even before Task 7), but change its comment to `/* What is drawn around the live block sits outside the text, where a cell that skips painting off-screen content could cut it off. */`. Replace the first comment line (`/* The block being edited keeps the look of the page; only a hairline says it is live. */`), the `.md .editing { ... }` rule, the `.md .editing:focus-visible` line and the `.md .editing a` line with:

```css
/* The block being edited keeps the look of the page. A soft slab a little wider than the text, a step stronger than
   the hover, says it is live. A shadow and not a background, so a heading keeps its hairline and a quote its surface. */
.md .editing {
  position: relative;
  outline: none;
  border-radius: var(--r-key);
  box-shadow: inset 0 0 0 100vmax var(--fill), 0 0 0 6px var(--fill);
  caret-color: var(--fg);
  min-height: 1.6em;
}
.md .editing a { cursor: text; }
```

2. Replace the whole `.md textarea.editing-src { ... }` rule (keep the `.code` rule from Task 5 after it) with:

```css
.md textarea.editing-src {
  display: block;
  width: 100%;
  padding: 0;
  font: 13.5px/1.6 var(--mono);
  color: var(--fg);
  background: none;
  border: 0;
  border-radius: var(--r-key);
  box-shadow: inset 0 0 0 100vmax var(--fill), 0 0 0 6px var(--fill);
  outline: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  tab-size: 4;
}
/* the rhythm of a paragraph, except as the cell's first block */
.md :where(textarea.editing-src) { margin: 0.8em 0; }
```

Verify, light and dark (toggle with the moon/sun button), at 900x700 and 390x844:
1. Double-click "A cup of filter coffee": a faint rounded slab, wider than the text by about 6px on every side, no blue line, nothing cut off on the right (desktop) or on either side (phone).
2. Double-click "The model": the slab includes the room above the heading and the hairline is still visible across its top.
3. Double-click the blockquote: a mono textarea on the same slab, no border, no ring, wrapped, one line per line of source.
4. `getComputedStyle(document.querySelector('.md .editing, .md .editing-src')).outlineStyle` is `none`.

---

## Task 9: Hover tint that is not flush, not clipped, and not left behind (F10)

Read: `src/lib/md.css` lines 57-64.

Replace lines 57-62 (the comment, the two `cursor` lines and the `@media (hover: hover)` block) with:

```css
/* Editing: the blocks of a notebook that can be edited say so under the pointer, with a slab a little wider than the
   text (the live block's, fainter). Not while a block of the cell is open, so the only slab then is the live one. */
.md [data-b] { cursor: text; }
.md [data-b] a { cursor: pointer; }
@media (hover: hover) {
  .md:not(:has(.editing, .editing-src)) [data-b]:hover { box-shadow: inset 0 0 0 100vmax color-mix(in srgb, var(--fg) 4%, transparent), 0 0 0 6px color-mix(in srgb, var(--fg) 4%, transparent); }
  .md [data-b]:is(p, h1, h2, h3, h4, h5, h6, ul, ol, .math-block):hover { border-radius: var(--r-key); }
}
```

Blockquotes, code and tables keep their own 10px corners.

Verify (900x700, dark then light): hover "The data" heading: hairline still visible, tint extends 6px past the text on both sides. Hover the "Try it." quote: its surface keeps its colour, slightly tinted, corners unchanged. Open "A cup..." and leave the pointer on "Cooling coffee": the heading is not tinted.

---

## Task 10: The new paragraph says what it is, and Enter keeps writing (F6, F7)

Needs Task 1. Read: `src/lib/edit/BlockEditor.svelte` lines 44-47, 256-258, 370-388; `src/lib/edit/edit.css` (whole file is short).

1. After `let done = false;` (line 47) add:

```ts
  // nothing typed yet, so a new paragraph shows what it is for
  let blank = $state(ghost);
```

2. On the `<svelte:element ...>` replace `oninput={() => (touched = true)}` with `oninput={() => ((touched = true), (blank = !el?.textContent))}` and add the attribute `data-placeholder={ghost && blank ? 'Type a paragraph · Esc to cancel' : undefined}`.
3. Replace line 257 `if (ghost) (own(), finish(compute()));` with:

```ts
      // a new paragraph with text is kept and another opens under it; Enter on an empty one closes it
      if (ghost) (own(), blank ? finish(null) : finish(compute(), { to: 'ghost', at: 'start' }));
```

4. `edit.css`, after `.md .editing a { cursor: text; }` add:

```css
/* a new paragraph says what it is for until something is typed */
.md .editing[data-placeholder]::before { content: attr(data-placeholder); position: absolute; inset: 0 auto auto 0; color: var(--fg-3); white-space: nowrap; pointer-events: none; }
```

Verify (900x700 and 390x844, both themes):
1. Caret at the end of "A cup..." (`const ed=document.querySelector('.md .editing'); getSelection().collapse(ed, ed.childNodes.length)`), Return: an empty slab with "Type a paragraph · Esc to cancel" in grey, caret blinking at its start, text not overlapping the caret.
2. Type `One`: the placeholder disappears. Return: a new empty slab with the placeholder under "One". Type `Two`, Return, then Return again on the empty one: everything closes; the page shows "One" and "Two" as two paragraphs.
3. Esc on an empty new paragraph: nothing added, header dot unchanged.

---

## Task 11: Format bubble polish (F11)

Needs Task 4. Read: `src/lib/edit/Bubble.svelte` (73 lines); `src/lib/edit/edit.css` the `.fmt` rules at its end.

1. In `Bubble.svelte`, after `let on = $state...` (line 18) add:

```ts
  // the word a double-click selects as the editor opens is not a selection the reader made, so the bar waits for them to act
  let armed = false;
```

2. In `sync()`, change the first condition to begin `if (!armed || !el || ...` (rest unchanged), and replace `at = { x: box.left + box.width / 2, y: below ? box.bottom : box.top, below };` with:

```ts
    // kept clear of the window's edges
    at = { x: Math.min(Math.max(box.left + box.width / 2, 128), innerWidth - 128), y: below ? box.bottom : box.top, below };
```

3. Replace the `onMount` block with:

```ts
  onMount(() => {
    const arm = (e: Event) => {
      if (root()?.contains(e.target as Node)) armed = true;
    };
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('keydown', arm, true);
    document.addEventListener('selectionchange', sync);
    addEventListener('scroll', sync, true);
    return () => {
      document.removeEventListener('pointerdown', arm, true);
      document.removeEventListener('keydown', arm, true);
      document.removeEventListener('selectionchange', sync);
      removeEventListener('scroll', sync, true);
    };
  });
```

4. Line 69: `<Lucide name={t.icon} />` (the header's 18px icons).
5. `edit.css`: replace every rule from `/* the toolbar floats over a selection */` to the end of the file with:

```css
/* the toolbar floats over a selection: a glass pill, like the header */
.fmt {
  position: fixed;
  z-index: 70;
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--glass);
  backdrop-filter: blur(22px) saturate(1.7);
  border-radius: 999px;
  box-shadow: var(--float);
  transform: translate(-50%, calc(-100% - 10px));
}
.fmt.below { transform: translate(-50%, 10px); }
.fmt button {
  display: grid;
  place-items: center;
  width: var(--ctl);
  height: var(--ctl);
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--fg-2);
  cursor: pointer;
}
.fmt button:hover { background: var(--btn-2); color: var(--fg); }
.fmt button:active { transform: scale(0.97); }
.fmt button[aria-pressed='true'] { background: color-mix(in srgb, var(--fg) 14%, transparent); color: var(--fg); }
.fmt button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
```

Verify (900x700, both themes; then 390x844):
1. Double-click "thermometer": no bubble. Shift+ArrowRight: the bubble appears above the selection, a pill, icons the size of the header's.
2. Cmd+B: the B button is filled grey (not blue).
3. Double-click "A" at the very start of the paragraph, then Shift+ArrowRight: the bubble's left edge is at least 8px inside the window (`document.querySelector('.fmt').getBoundingClientRect().left >= 8`). At 390x844 its buttons are 44px (`.fmt button` height).
4. Scroll so a selected word is under the header: the bubble flips below the selection.

---

## Task 12: Live preview under a formula being edited (F13)

Needs Task 8. Read: `src/lib/edit/BlockEditor.svelte` lines 1-13, 293-317, 367-368.

1. Imports: add `import { renderMarkdown } from '../markdown';` (already in the editor's chunk through `dom.ts`).
2. After the `src` action (ends line 317) add:

```ts
  // TeX is hard to read as text, so a formula being edited is drawn under its source as it is typed
  function preview(node: HTMLElement) {
    const box = node.previousElementSibling as HTMLTextAreaElement | null;
    let frame = 0;
    const draw = () => {
      frame = 0;
      // sanitized by DOMPurify in renderMarkdown
      node.innerHTML = renderMarkdown(box?.value ?? srcText, attachments);
      typeset(node);
    };
    const queue = () => (frame ||= requestAnimationFrame(draw));
    draw();
    box?.addEventListener('input', queue);
    return {
      destroy() {
        cancelAnimationFrame(frame);
        box?.removeEventListener('input', queue);
      },
    };
  }
```

3. Directly after the `<textarea ...></textarea>` on line 368 add:

```svelte
  {#if block?.token.type === 'blockMath'}<div class="editing-preview" aria-hidden="true" use:preview></div>{/if}
```

4. `edit.css`, after the textarea rules add:

```css
/* a formula being edited is drawn under its source */
.md .editing-preview { pointer-events: none; }
.md .editing-preview > .math-block { margin: 8px 0 0; }
```

Verify (900x700, both themes): double-click the `$$` equation. The TeX textarea (one line, slab) has the typeset equation under it. Type `+1` before the closing `$$`: within a frame the preview shows `+ 1`. Delete a `}` to break the TeX: the preview shows KaTeX's red error text, no exception in `read_console_messages`. Escape restores the plain typeset block (Task 2).

---

## Task 13: A dot beside each edited block (replaces the bar removed in 54ef643)

Needs Task 7. Read: `src/lib/edit/session.svelte.ts` lines 26-28, 47-61, 72-78; `src/lib/markdown.ts` lines 62-84; `src/lib/MarkdownCell.svelte` lines 30-33; the end of `src/lib/md.css`.

1. `session.svelte.ts`: replace the `edited` field and its comment with:

```ts
  /** Cells with unsaved edits, each with its source as it was before the first of them; replaced when a cell is added. */
  edited: new Map<string, string>() as ReadonlyMap<string, string>,
```

In `commit()` replace `session.edited = new Set(session.edited).add(id);` with `if (!session.edited.has(id)) session.edited = new Map(session.edited).set(id, before);`. In `reset()` replace `session.edited = new Set();` with `session.edited = new Map();`. (`Cell.svelte` only calls `.has`, which a Map has.)

2. `markdown.ts` `renderParts`: change the signature to `export function renderParts(source: string, attachments: Record<string, MimeBundle> = {}, base?: string): { parts: string[]; blocks: Block[] | null } {`. Before `const parts = blocks.map(` add:

```ts
  // blocks whose text is not in the cell as it was last saved carry a mark (md.css draws a dot beside them)
  const was = new Map<string, number>();
  if (base !== undefined) for (const b of blocksOf(base) ?? []) was.set(base.slice(b.start, b.end), (was.get(base.slice(b.start, b.end)) ?? 0) + 1);
```

Inside the `blocks.map` callback, after the `for (const el of box.content.children) ...` line add:

```ts
    const text = source.slice(b.start, b.end);
    const left = was.get(text) ?? 0;
    if (left) was.set(text, left - 1);
    else if (base !== undefined) box.content.firstElementChild?.setAttribute('data-changed', '');
```

In the DEV check change `.replace(/ data-b="\d+"/g, '')` to `.replace(/ data-b="\d+"| data-changed=""/g, '')`.

3. `MarkdownCell.svelte` line 32: `md.renderParts(cell.source, cell.attachments, session.edited.get(cell.id))`.
4. `md.css`, at the end:

```css
/* a block with unsaved edits has a dot in the gutter beside its first line */
.cell.markdown > .md { position: relative; }
.md > [data-changed]::before { content: ''; position: absolute; left: -20px; width: 6px; height: 6px; margin-top: calc(0.5lh - 3px); border-radius: 999px; background: var(--accent); }
@media (max-width: 720px) { .md > [data-changed]::before { left: -11px; } }
```

Verify (900x700 and 390x844, both themes): on a fresh page, double-click "thermometer", type `x`, Escape. One blue dot sits left of "A cup of filter coffee", centred on its first line, clear of the "A"; no other block has one; the header dot is there. Edit "The model" heading too: it gets its own dot at its text line (below the hairline). Click empty page space, then Cmd+Z twice: both dots go. `document.querySelectorAll('[data-changed]').length` matches what you see.

---

## Task 14: Inline input rules (F12, part 1)

Needs Task 10. Read: `src/lib/edit/dom.ts` lines 50-51 and 130-164; `src/lib/edit/BlockEditor.svelte` lines 8 and the `oninput=` line on the `<svelte:element>`.

First confirm `tidy` (`dom.ts:51`) strips U+200B: `sed -n 51p src/lib/edit/dom.ts | od -c | head -3` shows `342 200 213` inside the first regex. (If it does not, add `.replace(/​/g, '')` there.)

1. `dom.ts`, after `mark()` (ends line 164) add:

```ts
// Markdown typed as text: the closing character of `**x**`, `*x*`, `~~x~~` or `` `x` `` turns the run into its mark.
// No rule for `_x_`, which would fire inside snake_case.
const RULES: [RegExp, 'strong' | 'em' | 'del' | 'code'][] = [
  [/(?:^|[^*\\])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, 'strong'],
  [/(?:^|[^*\\])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, 'em'],
  [/(?:^|[^~\\])(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, 'del'],
  [/(?:^|[^`\\])(`([^`]+)`)$/, 'code'],
];

/** Turns the markdown typed just before the caret into its mark. True when it did. */
export function inputRule(root: HTMLElement, heading: boolean): boolean {
  const sel = getSelection();
  const node = sel?.anchorNode;
  if (!sel?.isCollapsed || !node || node.nodeType !== 3 || !root.contains(node) || node.parentElement?.closest('code, .atom')) return false;
  const end = sel.anchorOffset;
  const typed = (node as Text).data.slice(0, end);
  for (const [re, kind] of RULES) {
    const m = re.exec(typed);
    // a heading is bold already
    if (!m || (kind === 'strong' && heading)) continue;
    const r = document.createRange();
    r.setStart(node, end - m[1].length);
    r.setEnd(node, end);
    sel.removeAllRanges();
    sel.addRange(r);
    // the browser's own insert, so undo brings the typed markdown back
    if (!document.execCommand('insertText', false, m[2])) return false;
    const at = sel.getRangeAt(0);
    if (at.endContainer.nodeType !== 3 || at.endOffset < m[2].length) return true;
    const inner = document.createRange();
    inner.setStart(at.endContainer, at.endOffset - m[2].length);
    inner.setEnd(at.endContainer, at.endOffset);
    sel.removeAllRanges();
    sel.addRange(inner);
    mark(root, kind);
    // typing goes on after the mark, not inside it; the zero-width space is dropped when the block is read back
    const near = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement;
    const made = near?.closest('b, strong, i, em, s, strike, del, code');
    if (made && root.contains(made)) {
      const gap = document.createTextNode('​');
      made.after(gap);
      sel.collapse(gap, 1);
    } else sel.collapseToEnd();
    return true;
  }
  return false;
}
```

2. `BlockEditor.svelte`: add `inputRule` to the `./dom` import (line 8). Before `function richKey` add:

```ts
  // Markdown typed as text: a closing `*`, `~` or backtick turns what it closes into a mark.
  let ruling = false;
  function typed(e: Event) {
    touched = true;
    blank = !el?.textContent;
    const ev = e as InputEvent;
    // the rule's own edits fire input too
    if (ruling || !el || ev.isComposing || ev.inputType !== 'insertText' || !ev.data) return;
    ruling = true;
    try {
      if ('*~`'.includes(ev.data)) inputRule(el, shape?.kind === 'heading');
    } finally {
      ruling = false;
    }
  }
```

and on the `<svelte:element>` replace the `oninput={...}` from Task 10 with `oninput={typed}`.

Verify (900x700, fresh page): open "A cup...", caret at the end, type ` **bold** and *it* and ~~gone~~ and `code` x`.
1. Screenshot: "bold" bold, "it" italic, "gone" struck, "code" in the code chip; the trailing " and" after each is plain (not bold or italic).
2. Escape. `[...document.querySelectorAll('.md p')][0].innerHTML` contains `<strong>bold</strong>`, `<em>it</em>`, `<del>gone</del>`, `<code>code</code>`, and no `\*` anywhere.
3. Re-open, type `2 * 3 * 4` and `snake_case`: both stay literal after Escape.
4. Open "The model", type ` **x**`: stays literal (no bold rule in headings); `*y*` becomes italic.

---

## Task 15: Block input rules for headings and lists (F12, part 2)

Needs Task 14. Read: `src/lib/edit/blocks.ts` lines 17-28; `src/lib/edit/BlockEditor.svelte` lines 157-171 (`build`), 256-259 (Enter), and `typed` from Task 14.

1. `blocks.ts` line 25, replace `if (body.length !== 1 || (body[0].type !== 'text' && body[0].type !== 'paragraph')) return 'source';` with:

```ts
    // an empty item, as `- ` alone, still makes a simple list
    if (body.length > 1 || (body.length === 1 && body[0].type !== 'text' && body[0].type !== 'paragraph')) return 'source';
```

Check in a second browser tab on `http://localhost:5173/` (the landing page; the notebook page blocks module loads): `const b = await import('/src/lib/edit/blocks.ts'); ['# ', '- ', '* ', '1. ', '### '].map((s) => b.blocksOf(s)?.[0]?.kind)` must be `["heading","list","list","list","heading"]`. If any is not, leave that prefix out of the regex in step 3.

2. `build()`: replace `li.append(toDom(item, document, attachments));` with:

```ts
        li.append(toDom(item, document, attachments));
        // an empty item needs a break to hold the caret
        if (!item.length) li.append(document.createElement('br'));
```

3. Add after `typed` (and add `toMarkdown` is already imported; `fromDom`, `textOffset` are in the `./dom` import, `blocksOf` in `./blocks`):

```ts
  // `# ` to `### `, `- `, `* `, `+ `, `1. ` or `1) ` typed at the very start of a paragraph turns it into a heading or a list
  function blockRule() {
    if (!el || (shape && shape.kind !== 'paragraph')) return;
    const m = fromDom(el);
    const first = m[0];
    const head = first?.t === 'text' ? first.v : '';
    const pre = /^(#{1,3}|[-*+]|1[.)])[  ]/.exec(head);
    if (!pre || textOffset(el) !== pre[0].length) return;
    const rest = toMarkdown([{ t: 'text', v: head.slice(pre[0].length) }, ...m.slice(1)]).trim();
    const found = blocksOf(`${pre[1]} ${rest}`);
    if (found?.length !== 1 || (found[0].kind !== 'heading' && found[0].kind !== 'list')) return;
    caret = { offset: 0 };
    blank = !rest;
    shape = found[0];
  }
```

In `typed`, change the rule line to:

```ts
      if ('*~`'.includes(ev.data)) inputRule(el, shape?.kind === 'heading');
      else if (ev.data === ' ') blockRule();
```

4. Enter (lines 256-259 as left by Task 10), replace the whole `else if (k === 'Enter' && !e.altKey) { ... }` branch with:

```ts
    } else if (k === 'Enter' && !e.altKey) {
      // in a list the browser adds the item
      if (shape?.kind === 'list') return;
      // a new paragraph with text is kept and another opens under it; Enter on an empty one closes it
      if (ghost) (own(), blank ? finish(null) : finish(compute(), { to: 'ghost', at: 'start' }));
      else if (shape) (own(), split());
    }
```

5. Placeholder text from Task 10: `'Type, or # for a heading, - for a list'`.

Verify (900x700, both themes; then 390x844):
1. Caret at the end of "A cup...", Return, type `# Title`: as soon as the space after `#` is typed, the slab turns into a large h1 with the caret at its start, and "Title" follows. Escape: the page has a new h1 "Title" after the paragraph (`# Title` in the source; check with Cmd+/ on it).
2. New paragraph, type `- milk`, Return, `eggs`, Return, Return: the list has "milk" and "eggs"; see Task 16 for the last Return. Escape.
3. Type `1. one` in a new paragraph: an ordered list.
4. In an existing paragraph, put the caret at its start and type `## `: the paragraph becomes an h2 keeping its text.
5. Type `#hashtag` (no space) and `-5 degrees`: stay literal.

---

## Task 16: Enter on an empty last item ends the list

Needs Task 15. Read: the Enter branch from Task 15.

1. Add before `function richKey`:

```ts
  // the empty last item of a list, where Enter ends the list
  function endItem(): HTMLElement | null {
    const at = getSelection()?.anchorNode;
    const li = (at instanceof Element ? at : at?.parentElement)?.closest('li');
    return el && li && li === el.lastElementChild && el.children.length > 1 && !li.textContent ? li : null;
  }
```

2. Replace `if (shape?.kind === 'list') return;` with:

```ts
      if (shape?.kind === 'list') {
        // an empty last item ends the list, and a new paragraph opens under it
        const item = endItem();
        if (item) (own(), item.remove(), (touched = true), finish(compute(), { to: 'ghost', at: 'start' }));
        return;
      }
```

Verify: the list from Task 15 step 2: after `eggs`, Return gives a third empty bullet; Return again removes it and opens the placeholder paragraph under the list. Escape. Rendered `<ul>` has exactly two `<li>`, and no stray empty paragraph follows it. Also try in an existing list opened by double-click.

---

## Final check

Run `npm run check` once. Fix only errors it reports in files these tasks touched. Then reset the browser viewport with `resize_window` preset `desktop`.

## Visual QA matrix

Fresh page (`navigate` with `force: true`) for each theme. D = dark, L = light; 1280 = `resize_window` 1280x800, 390 = 390x844 (touch is emulated at 390, so double-tap counts as double-click). Before any Cmd+K row, run `window.prompt = () => 'https://example.com'` in `javascript_tool` (a real prompt blocks the pane). Never click Save.

| Block | Action | Expect | D 1280 | L 1280 | D 390 | L 390 |
|---|---|---|---|---|---|---|
| h1 Cooling coffee | focus cell (click its gutter), `e` | slab on the h1, caret at start, no bubble, no jump | | | | |
| h1 | Esc | closes; `document.activeElement` is the cell article; scrollY unchanged | | | | |
| h2 The model | double-click | slab includes room above; hairline visible; bubble hidden until Shift+Arrow; bubble has no B | | | | |
| h2 | Cmd+/ twice | source `## The model` one row, slab; back to rich | | | | |
| paragraph | hover (1280 only) | 4% slab, 6px wider, not clipped; none on other blocks while one is open | | | n/a | n/a |
| paragraph | double-click word | slab, word selected, no bubble | | | | |
| paragraph | Shift+ArrowRight, then B, I, S, code buttons | bubble pill above, clamped on screen, pressed = grey fill | | | | |
| paragraph | Cmd+B, Cmd+I, Cmd+E, Cmd+Shift+X, Cmd+K | marks apply; Escape; rendered marks match | | | | |
| paragraph | Enter at start | nothing happens | | | | |
| paragraph | Enter in middle | second half opens rich (P, Inter), caret at its start | | | | |
| paragraph | Enter at end | placeholder paragraph | | | | |
| paragraph | Shift+Enter, type, Esc | line break kept on the page (`<br>`) | | | | |
| paragraph | Backspace at start / Delete at end | joins with neighbour, caret at the join | | | | |
| paragraph with `$k$` | open, Esc | `k` typeset (no mono TeX) | | | | |
| new paragraph | type, Enter, type, Enter, Enter | two paragraphs, editor closed | | | | |
| new paragraph | `# `, `- `, `1. ` | heading / bullet list / ordered list in place | | | | |
| any rich block | `**a**`, `*a*`, `~~a~~`, `` `a` `` | marks; typing after is plain | | | | |
| any rich block | paste: `const dt=new DataTransfer(); dt.setData('text/plain','pasted **x**'); document.querySelector('.md .editing').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))` | literal text inserted (no rule fires on paste) | | | | |
| list (made via `- `) | Enter, Enter on empty last | new item; then list ends, paragraph opens | | | | |
| blockquote | double-click | mono textarea, wraps, one row per line, slab | | | | |
| blockquote | ArrowDown at end, ArrowUp at start | moves to next / previous block | | | | |
| `$$` block | double-click | textarea + live preview; Esc typesets | | | | |
| table (second cell) | double-click | source, lines not wrapped | | | | |
| task list | double-click | source textarea | | | | |
| code fence (last cell) | double-click, Tab | source, no wrap, Tab inserts 4 spaces | | | | |
| whole cell | type text, click empty page | commits; header dot and Save icon (first in the right pill); one blue dot per edited block, clear of glyphs | | | | |
| cell 'When to drink' | empty both blocks, Esc | "Empty cell · double-click to write"; double-click opens the placeholder paragraph | | | | |
| any | open/close mid-page | scrollY unchanged (`scrollY` before and after) | | | | |
| any | after edits: Cmd+Z on the page (not in an editor) | edit undone; its dot gone | | | | |

## Not verified in this audit

- Rich lists: the demo has none (its only list is a task list, which is source-only), so native Enter, Backspace and the empty-item behaviour inside a contenteditable `<ul>` were not exercised. Tasks 15 and 16 assume Chrome adds an `<li>` on Enter; if it inserts a `<div>`, `read()` turns it into a paragraph after the list and the Task 16 check will show it.
- The input rules (Tasks 14, 15) were not prototyped. Two assumptions: `execCommand` may be called from an `input` handler (the `ruling` guard covers the nested event), and a zero-width-space text node after a mark keeps typing outside it. The `code` wrap and the zero-width node are not on the browser's undo stack, so Cmd+Z straight after a code rule may not restore the backticks exactly.
- `white-space: normal` (Task 3) was checked live only in the pane's Chromium (by injecting the rule). Safari and Firefox were not tested; both insert `<br>` for a line break outside pre-wrap text.
- Cmd+K (a native prompt), real clipboard paste, Safari and Firefox, and a real touch device were not exercised. Light theme was only seen at phone width.
- The owner's green circle: read here as the clipped right end of the box (F8), which matches the screenshot. That is a guess about intent.
- The bubble colliding with the header was not reproduced; by code it flips below when the selection is within 96px of the top.
- F17 was seen once and not reproduced.
- Concurrent edits: `54ef643` (removing the gutter bar) landed while this audit ran. If more commits land before execution, match on the quoted code, not the line numbers.
