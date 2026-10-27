# Editing surface polish: slab, corners, toolbar

Branch `feat/markdown-wysiwyg-editor-d40a96` at `19ba2a2`. Measured live (Chromium, 1024x768 pane, light and dark, 375x812) on `http://localhost:5173/?url=cooling-coffee.ipynb` with every change below injected as a temporary `<style>` first. Quoted text is the anchor for each edit; line numbers are at `19ba2a2`.

## How to execute

- Inline, in order, one commit per task (`fix(edit): ...`). Touch only the files a task names. No tests, builds, linters or formatters.
- Browser: load the pane tools with ToolSearch `select:mcp__Claude_Browser__tabs_context,mcp__Claude_Browser__tabs_select,mcp__Claude_Browser__navigate,mcp__Claude_Browser__javascript_tool,mcp__Claude_Browser__computer,mcp__Claude_Browser__resize_window`. Front the tab (`tabs_select seed`) or screenshots stall; take a second screenshot if one looks stale. `computer` coordinates are an 800x600 frame (CSS px x 0.78125 at 1024 wide). CSS edits hot-reload in place; a `.svelte` edit closes any open editor. Reset with `resize_window` preset `desktop` at the end. Never click Save.
- Helpers to paste into `javascript_tool` (open an editor without guessing coordinates; close it):
  - `const open = async (el) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 20, clientY: r.top + Math.min(r.height / 2, 12) })); await new Promise((f) => setTimeout(f, 400)); };`
  - `const done = () => document.querySelector('.fmt [data-cmd=done]')?.click();`
  - `const head = (t) => [...document.querySelectorAll('.notebook .md > :is(h1,h2,h3)')].find((h) => h.textContent.startsWith(t));`

## Decisions

1. **Slab = the block's own box, nothing else.** Root cause of screenshots 6/7: `.md > [data-h]` (md.css:37-45) draws its hairline as a background and its room as `padding-top`, inside the box the slab shadows paint. Fix: the room becomes margin and the hairline an `::after` above the box (`::before` stays free for the `data-changed` dot and the ghost placeholder). Text positions measured identical for all 21 drawn blocks and `scrollHeight` (9751) unchanged; only a heading straight after an `h1` moves (up 0.16px: an h1's 20.16px bottom margin beat the 20px `in` gap before, now loses to 34px). Knock-ons handled: contents jumps (`scroll-margin-top` + pad, so the hairline lands at 96px as before) and print (padding again, so a heading that starts a page keeps its hairline). Accepted: the contents list now changes section when the heading's words, not its hairline, cross its 150px line (14-32px later).
2. **`min-height: 1lh` on the live block.** Measured: opening the title editor grows the h1 42 -> 53.76px and pushes the page down 11.76px (`min-height: 1.6em` > a heading's 1.25 line height). `data-h` padding hid this for most headings; Decision 1 would expose it, so it ships with Task 1.
3. **Radius scale.** The app uses 999 (pills, round buttons), 22 (dialogs), 18 (cards: `.card`, the open text card), 14 (tiles), 10 + `corner-shape: squircle` (everything inside a card: `.srcbox`, `.outs`, rows, `pre`, quotes, tables, images), 6 round (`--r-key`: inline code, kbd). Card 18 with 8px padding around a 10 box is the concentric pair. The open card puts the slab 8px inside its 18 edge, so the slab is **10 squircle**, like `pre`. A box-shadow's corner grows by its spread, so the element radius is 10 minus the reach: 4px for the 6px slab, 6px for the top/bottom 4px halves, 8px for the 2px only-child slab, all `corner-shape: squircle` (overlaid against a 10px squircle at 5x zoom: identical; the current 6px round + 6 spread draws 12px round). A one-line paragraph slab is 40px tall (32px as a cell's only block) with 10px corners: a soft rectangle, never a pill. Hover: same 10 squircle for text blocks; `pre`, quotes, tables and images keep their own 10px and the 6px ring makes 16, concentric with them (unchanged). Atoms are inline chips like `code`: `--r-key`. Toolbar pill and its buttons are 999, concentric by construction (22 outer = 18 inner + 4 padding).
4. **Toolbar in the header's row, on every width (the phone model).** A second row cannot work at the top of a notebook: the first cell's card starts 86px (paragraph first) or 104px (h1 first) down at scroll 0 and nothing can scroll it clear of a bar ending at 104px. Measured: cooling-coffee's card top 104 == toolbar bottom 104 (screenshot 9), and a paragraph-first notebook has its first line under the bar. In the header row (top 8, bottom 52; 60 on touch) the gap is 34-52px. The header's pills and the centre section pill hide while it is there (no `.mid` collision at any width) and come back on Done, which is what the phone already does. It centres on the open card, not the window (the column sits 24px right of centre at 1024, 16-40px elsewhere), clamped 20px inside the window. Editors open with the caret at `--jump` (96px), like contents jumps. If the owner wants the header kept on wide screens, that is a separate call; the top-of-page collision is why it is not the default.
5. **Toolbar contents.** Done becomes the app's solid button with the word Done (opaque, so on a phone it can stay pinned at the bar's end while the tools scroll under it; measured: today Done sits at x 704 in a 351px-wide bar, off screen). H1/H2/H3 are redrawn with the figure as tall as the H (Lucide's digit is 8px tall and sits on the baseline, which reads as smaller and lower). Hover tooltips are dropped where the bar scrolls (measured: they make it 73px of scrollable height in a 44px bar, so a mouse wheel scrolls the buttons away).

## Task 1: hairline and room above a heading move outside its box

Files: `src/lib/md.css`, `src/lib/edit/edit.css`. Run Check step 1 before editing.

Change, md.css lines 36-45: replace the comment's last line and the rule with:
```css
   line says the heading's rank, from the full width for the top level down to a short stroke. Both sit outside the
   heading's box, in its margin, so the slab drawn on a block being pointed at or edited holds the words alone. */
.md > [data-h] {
  --gap: 28px;
  --pad: 16px;
  --len: 100%;
  --rule: var(--line);
  position: relative;
  margin-top: calc(var(--gap) + var(--pad));
  /* a jump from the contents still puts the hairline where it always did */
  scroll-margin-top: calc(var(--jump) + var(--pad));
}
.md > [data-h]::after { content: ''; position: absolute; top: calc(var(--pad) * -1); left: 0; width: var(--len); height: 1px; background: var(--rule); pointer-events: none; }
```
md.css line 52: `.md > [data-h]:first-child { margin-top: max(10px, calc(var(--gap) - 16px)); }` becomes
```css
.md > [data-h]:first-child { margin-top: calc(max(10px, var(--gap) - 16px) + var(--pad)); }
/* on paper the room is padding again, which a page break keeps, so a heading that starts a page keeps its hairline */
@media print {
  .md > [data-h] { margin-top: var(--gap); padding-top: var(--pad); }
  .md > [data-h]:first-child { margin-top: max(10px, calc(var(--gap) - 16px)); }
  .md > [data-h]::after { top: 0; }
}
```
edit.css line 34: `  min-height: 1.6em;` becomes
```css
  /* one line at its own size: an empty block keeps a line, and a heading does not grow as it opens */
  min-height: 1lh;
```
Check (light theme, no editor open):
1. BEFORE editing, render every cell and record text positions: `for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((f) => setTimeout(f, 60)); } scrollTo(0, 0); await new Promise((f) => setTimeout(f, 300)); window.__t0 = [...document.querySelectorAll('.notebook .md > *')].map((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().top + scrollY; }); window.__h0 = document.documentElement.scrollHeight; window.__t0.length`.
2. After the edit: same map into `t1`; expect equal length, `t1.map((v, i) => +(v - __t0[i]).toFixed(2)).filter(Boolean)` empty, `scrollHeight === __h0`.
3. `[getComputedStyle(head('The data')).paddingTop, getComputedStyle(head('The data'), '::after').top]` is `['0px', '-24px']` (an `out` heading: pad 24).
4. Scroll "The data" into view, hover it: the grey slab covers the words only; the hairline stays above it, unshaded (compare screenshots 7 and 8). `await open(head('The data'))`: same, plus the hairline sits in the card above the slab. `done()`.
5. `scrollTo(0,0)`; note `document.querySelector('.notebook .md > h1').nextElementSibling.getBoundingClientRect().top`; `await open(document.querySelector('.notebook .md > h1'))`; the same value (before the fix it moved 11.76px). `done()`.
6. Press `t`, pick "The data": afterwards `head('The data').getBoundingClientRect().top - 24` is 96 ± 4 (its hairline at `--jump`), and the contents list marks it current.

## Task 2: one corner for every slab

Files: `src/lib/edit/edit.css`, `src/lib/md.css`.

Change, edit.css line 27 (`   the hover, says it is live. A shadow and not a background, so a heading keeps its hairline and a quote its surface. */`) becomes
```css
   the hover, says it is live. A shadow and not a background, so it reaches past the text without moving it. Its
   corners are the 10px squircle of a code box, the card's 18px less the 8px between them; a shadow's corner grows
   by its spread, so each slab's radius here is 10px less its reach. */
```
In `.md .editing` (line 31) `  border-radius: var(--r-key);` becomes `  border-radius: 4px;` + new line `  corner-shape: squircle;`.
Lines 39-41: insert as the first declaration inside each rule's braces: `border-radius: 6px; ` (the `:first-child:not([data-h])` and `:last-child` rules) and `border-radius: 8px; ` (the `:first-child:last-child` rule).
Atoms: `  background: var(--fill);\n  border-radius: 4px;\n  padding: 0 2px;` becomes the same with `border-radius: var(--r-key);` (chips in the text share inline code's corner).
Textarea (line 66): in `.md textarea.editing-src`, `  border-radius: var(--r-key);` becomes `  border-radius: 4px;` + `  corner-shape: squircle;`.
md.css line 63: `  .md [data-b]:is(p, h1, h2, h3, h4, h5, h6, ul, ol, .math-block):hover { border-radius: var(--r-key); }` becomes
```css
  /* the live slab's corner; code, quotes, tables and pictures keep their own 10px, and the slab rounds 6px outside it */
  .md [data-b]:not(pre, blockquote, table, img):hover { border-radius: 4px; corner-shape: squircle; }
```
(This also stops `details`, `hr` and raw HTML blocks from getting square slabs.)
Check: open "Newton's law of cooling..." (`await open([...document.querySelectorAll('.notebook .md > p')].find((p) => p.textContent.startsWith('Newton')))`); `getComputedStyle(document.querySelector('.md .editing'))` gives `borderRadius` `4px`, `cornerShape` `superellipse(2)`. Zoom (`computer zoom`) on the slab's left end and the "Try it" quote just above: both corners the same size and shape. `done()`. Open the h1 title: radius `6px` (first block). Open "Sixteen readings per cup" (last block of its cell): `6px`. Open the `$$` formula: textarea `4px` (its preview, not it, is the last child). Hover the quote: radius still `10px`. Dark theme: repeat one zoom.

## Task 3: the toolbar takes the header's row, centred on the open cell

Files: `src/lib/edit/edit.css`, `src/lib/edit/Toolbar.svelte`.

Change, edit.css lines 43-44 become
```css
/* an editor that opens near the top is scrolled as clear of the header row as a jump from the contents */
.md :is(.editing, .editing-src) { scroll-margin-top: var(--jump); }
```
edit.css lines 82-100 (comment and `.fmt { ... }`) become
```css
/* The editing toolbar: a glass pill like the header's, in the header's own row for as long as a text cell is open; the
   header's pills step aside until Done. A row of its own under the header would sit on the first lines of a notebook
   at the top of the page, where nothing can scroll clear of it. It stays put however far a long cell scrolls, and is
   centred on the open cell, which sits right of the window's centre (Toolbar.svelte sets --x). */
.fmt {
  position: fixed;
  z-index: 17;
  top: 8px;
  left: var(--x, 50%);
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 2px;
  width: max-content;
  max-width: calc(100vw - 40px);
  padding: 4px;
  background: var(--glass);
  backdrop-filter: blur(22px) saturate(1.7);
  border-radius: 999px;
  box-shadow: var(--float);
}
body:has(> .fmt) .bar .inner > *, body:has(> .fmt) .mid { visibility: hidden; }
```
edit.css lines 112-116 (the last media block) become
```css
/* on a phone it runs the width of the screen */
@media (max-width: 720px) {
  .fmt { inset-inline: 12px; translate: none; width: auto; max-width: none; }
}
```
Toolbar.svelte `onMount` (lines 100-108) becomes
```ts
  onMount(() => {
    document.addEventListener('selectionchange', sync);
    document.addEventListener('input', sync, true);
    // Centred on the open cell, not the window: the text column sits right of centre, past the gutter. Held 20px
    // inside the window's edges, the header's margin. Ignored on a phone, where the bar spans the screen.
    const cell = document.querySelector('.md:has(> :is(.editing, .editing-src))');
    const centre = () => {
      if (!cell) return;
      const box = cell.getBoundingClientRect();
      const half = bar.offsetWidth / 2;
      bar.style.setProperty('--x', `${Math.min(Math.max(box.left + box.width / 2, 20 + half), document.documentElement.clientWidth - 20 - half)}px`);
    };
    // the column moves with the window, the contents rail and the width setting
    const look = new ResizeObserver(centre);
    if (cell) look.observe(cell);
    addEventListener('resize', centre);
    return () => {
      gone = performance.now();
      document.removeEventListener('selectionchange', sync);
      document.removeEventListener('input', sync, true);
      look.disconnect();
      removeEventListener('resize', centre);
    };
  });
```
Check, at the pane's 1024, then `resize_window` 1440x900, 800x600, preset `mobile`, preset `desktop`. Each time: `scrollTo(0,0)`, `await open(document.querySelector('.notebook .md > h1'))`, then `const f = document.querySelector('.fmt').getBoundingClientRect(), c = document.querySelector('.md:has(> .editing)').getBoundingClientRect(); [f.top, f.bottom, f.left + f.width / 2, c.left + c.width / 2, c.top - 10 - f.bottom, getComputedStyle(document.querySelector('.bar .inner > *')).visibility]`.
Expect: desktop widths `top 8`, `bottom 52`, the two centres within 1px (1024: about 536; 1440: about 736; 800: about 424), gap to the card 52 at scroll 0, `hidden`; at 1440 also `getComputedStyle(document.querySelector('.mid')).visibility === 'hidden'`. Mobile (navigate to reload after the preset): `left 12`, `right 363`, `top 8`. After `done()` the header pills are back (`visible`). Reveal: at 1024, `const p = [...document.querySelectorAll('.notebook .md > p')].find((x) => x.textContent.startsWith('Sixteen')); scrollBy(0, p.getBoundingClientRect().top - 60); await open(p);` then `document.querySelector('.md .editing').getBoundingClientRect().top` is about 92 (caret line at 96). Screenshot: one row, no centre pill, toolbar over the card's middle.

## Task 4: what is on the toolbar

Files: `src/lib/edit/Toolbar.svelte`, `src/lib/Lucide.svelte`, `src/lib/edit/edit.css`.

Change, Toolbar.svelte button (lines 175-190): `class="icon"` becomes `class={t.cmd === 'done' ? 'btn solid' : 'icon'}`, and `<Lucide name={t.icon} />` becomes `{#if t.cmd === 'done'}Done{:else}<Lucide name={t.icon} />{/if}`. Nothing else changes (Done keeps `data-cmd`, `aria-label`, `data-tip="Done · Esc"` and its place in the arrow-key order).
Lucide.svelte lines 51-53 become
```js
    // not Lucide's: the figure as tall as the H, so it reads at 18px beside the other tools
    'heading-1': '<path d="M4 6v12M12 6v12M4 12h8M16.5 8.5 19.5 6v12"/>',
    'heading-2': '<path d="M4 6v12M12 6v12M4 12h8M15.5 9a3 3 0 0 1 6 0c0 3.5-6 5-6 9h6"/>',
    'heading-3': '<path d="M4 6v12M12 6v12M4 12h8M15.5 6h6l-3.5 4.5a3.75 3.75 0 1 1-2.9 6.4"/>',
```
edit.css toolbar rules: after `.fmt .icon[aria-pressed='true']::before { opacity: 0.12; }` add `.fmt .icon[aria-pressed='true']:hover::before { opacity: 0.16; }`; `.fmt .icon:disabled { opacity: 0.3; cursor: default; }` becomes `.fmt .icon:disabled { opacity: 0.3; cursor: default; color: var(--fg-2); }`; after the `.fmt .sep` line add
```css
/* Done, the way out, says so in words; it never gives up its width to the tools */
.fmt .btn { flex: none; }
```
and the `(max-width: 720px), (pointer: coarse)` comment and block (lines 108-111) become
```css
/* where it is wider than the window (a phone, a finger's larger buttons) it scrolls sideways, with Done pinned at its
   end over the tools passing under it; names on hover would make it scroll up and down too */
@media (max-width: 720px), (pointer: coarse) {
  .fmt { overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
  .fmt .btn { position: sticky; right: 0; box-shadow: 0 0 0 4px var(--paper); }
  .fmt [data-tip]::after { display: none; }
}
```
Check: 1024, open any paragraph. Toolbar about 649px wide; zoom on it: H1/H2/H3 figures as tall as the H, same weight and centre line as the pilcrow and list icons; Done is a dark pill (light theme) / light pill (dark theme), 4px from the bar's end. Hover Done: tooltip "Done · Esc" below the bar. Hover a pressed button (the block's kind): its fill deepens. Keys: Alt+F10, then End: focus ring around Done; Enter closes the editor. Preset `mobile`, reload, open a paragraph: `const f = document.querySelector('.fmt'), d = f.querySelector('[data-cmd=done]').getBoundingClientRect(); [f.scrollWidth > f.clientWidth, f.scrollHeight === f.clientHeight, f.getBoundingClientRect().right - d.right]` gives `[true, true, 4]`; scroll the bar sideways (`f.scrollLeft = 200`): Done stays put and the tools slide under it cleanly. Tap Done: header back.

## Task 5: high contrast

Files: `src/lib/edit/edit.css` (append at the end).
```css
/* Windows high contrast drops shadows and fills, which is all the slab and a pressed button are made of */
@media (forced-colors: active) {
  .md :is(.editing, textarea.editing-src) { outline: 2px solid Highlight; outline-offset: 4px; }
  .fmt .icon[aria-pressed='true'] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
}
```
Check: the pane cannot emulate forced colours; confirm the rule parses (`[...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.conditionText === '(forced-colors: active)' && r.cssText.includes('.editing')); } catch { return false; } })` is true with an editor open) and that nothing changes in normal mode.

## Edge cases (verified live or argued from the code named)

| Case | Call | Why |
|---|---|---|
| Heading with `data-h`, hover and live | fix (T1) | slab paints the hairline and room today (md.css:37-45) |
| First heading (no `data-h`), first/last block, only block | keep | edit.css:39-41 already trims the slab to keep 8px to the card; T2 only sets their radii |
| `data-h` heading as a cell's first block | keep | its hairline sits 14-32px above the words, clear of the 6px slab |
| Opening a heading editor shifts the page | fix (T1) | measured 11.76px on the h1 (`min-height: 1.6em`) |
| Ghost paragraph placeholder; ghost turned heading | keep | placeholder is `::before`, hairline `::after`: no clash |
| `data-changed` dot | keep | desktop: 8px clear of the slab; phone: dot at -11px meets the 6px reach for 1px, under 12px of gutter |
| Adjacent blocks (0.8em) | keep | 13.2px between blocks, 6px reach, one slab per cell at a time |
| Hover in the next cell while a card is open | leave | that slab's top meets the card's bottom (both at +2px into the cell); rare and momentary |
| Lists, nested lists | keep | one block, one slab |
| Code, tables, quotes, math, HTML in source | keep (T2 radius) | textarea slab, same 10px; math preview sits below it |
| `details`, raw HTML, `hr` hover | fix (T2) | were square; `hr` is 1px tall, so its slab stays nearly square and is hard to hit: leave |
| Image-only paragraph | leave | slab's 10px corner 6px outside the image's 10px is not concentric and the line's strut adds room below; needs `:has()` per hover |
| Heading switched to source (Cmd+/) | leave | the textarea is not a heading: no hairline, paragraph margins; existing |
| Card 14px wider than code cards, 6px gap to them | leave | text sits at the code cards' edge; aligning moves the text |
| First cell at scroll 0; very tall cell; last cell | fix (T3) / keep / keep | header row clears the card by 34-52px; bar is fixed; card's 10px overhang lands in the notebook's 72px bottom padding |
| Hush (header slides away on scroll) | keep | the bar is no longer tied to the header's height |
| `.cell` `content-visibility` | keep | live: edit.css:2 unclips; hover reaches 6px into 8/12px cell padding |
| Narrow desktop window (<= 720px, mouse) | fix (T4) | tooltips make the scrolling bar scroll vertically (measured 73 vs 44px) |
| Phone: Done off screen | fix (T4) | measured at x 704 in a 351px bar |
| Reduced motion | keep | no new motion; `translate` is static; app.css:425 covers `.rise` and the card's lift |
| Dark theme | keep | all fills are tokens; solid Done inverts (checked) |
| Selection colour on the slab | keep | rare.css:45 accent at 28% stays legible over a 6% slab |
| Forced colours | fix (T5) | slab and pressed state are shadows/fills only |
| Contents list current section | accepted | switches when the words cross 150px, 14-32px later than the hairline did |

## Not covered / needs a real device

- Safari and Firefox without `corner-shape`: slabs fall back to 10px round (4 + 6 spread), which still matches their round `pre`.
- iPad (coarse pointer above 720px): 52px bar in the header row, sticky Done, no tooltips.
- iOS Safari with the keyboard up: a fixed bar at top 8px against the visual viewport.
- Windows high contrast (Task 5) and a print preview with a heading at a page break (Task 1).
- Seen, not in scope: at phone width the dock renders at the top, not the bottom (`.bar` has `will-change: transform`, app.css:156, so fixed children anchor to it); worth its own fix.
