# Compare Page and Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan fixes the dispatch: waves of Sonnet agents under "Execution", with no per-task reviewer agents (AGENTS.md allows review agents only on request).

**Goal:** Rebuild `/compare/` as an evidence-led comparison page and rebuild the homepage's "how it works" around the same proof, both from one data module and one renderer.

**Architecture:** `site/compare.ts` holds the comparison data. `tools/compare/` renders it: an engine that turns `site/compare.md` into the compare page and its Markdown copy, plus component modules shared by both pages. The homepage keeps its hand-written HTML and gets the shared components through `<!--compare:…-->` placeholders filled at build time. Styles: shared components in a new `src/about/shared.css` (inlined into the home stylesheet), compare-only styles in `src/about/compare.css`.

**Tech Stack:** Vite 8 build plugins in `vite.config.ts`, `marked` (already a dependency), TypeScript under `tsconfig.node.json`, plain CSS with `:has()` and container queries, no script.

**Spec:** `docs/superpowers/specs/2026-10-29-compare-page-redesign-design.md`. Approved mockups: `docs/superpowers/specs/2026-10-29-compare-page-redesign/` (`compare-page.html`, `matrix.html`, `homepage.html`). The spec wins wherever they differ (column widths, phrases, `--tick-ink`, `--part`, the 60px sticky top, the homepage's `id="privacy"`).

## Global Constraints

- Agents do not run or write tests, builds, type checks, linters, formatters or servers, and do not commit (AGENTS.md). The controller commits; the user runs `npm run check` and `npm run build` in Task 8.
- No new dependencies. No changes under `src/lib/`, `src/App.svelte` or `src/about/about.ts`.
- TypeScript (`tsconfig.node.json`): `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type` for types), relative imports end in `.ts`, `noUnusedLocals` and `noUnusedParameters`. Style as in `vite.config.ts`: two spaces, single quotes, no semicolons, few comments.
- No script on any page. The guide CSP and the app CSP are unchanged.
- Built numbers appear only as `<!--fact:key-->`, never as literals.
- Phrase budgets at 14px Inter Medium: a cell's `say` at most **112px**, a row `label` at most **156px**, measured with `width()` from `tools/compare/text.ts`.
- Copy: plain, sentence case, curly apostrophes (’), no exclamation marks, no "best ever" superlatives.
- Colour: the tick family (`--tick`, `--tick-ink`, `--tick-soft`, `--ring`) marks only what is ours. No gradients, no new shadows.
- Each agent edits only the files its task **Owns**.

## Review Focus

No test suite pins these (spec: tests out of scope). Each has a self-check in the owning task, and the controller repeats it in Task 7.

1. **A class the CSS never styles.** Markup from `parts.ts` or `table.ts` uses a root class that `shared.css` or `compare.css` doesn't define, so one page shows an unstyled block. Task 7 compares the root classes on both sides.
2. **Opening a notebook from the new homepage.** `#home` must still be removed and the `#landing` stylesheet switched off, so nothing in `shared.css` may style an app class (`.doc`, `.cell`, `.tbl`, `.exc`) outside a component root. Self-check in Task 2.
3. **Anchors that other code links to.** `#how` (the cue), `#privacy` (the app's Privacy sheet), `#faq`, `#offline` and `#speed` must each exist exactly once on the homepage. Self-check in Task 4.
4. **Sideways scroll at 320px.** A phrase over budget, a route node that cannot wrap, or a chip row that scrolls. Width check in Task 6; wrap rules in Tasks 2 and 3; checked by eye in Task 8.
5. **First-screen budget.** The homepage adds more than 8 KB gzipped, or `core` goes over 30,000. The build line is read in Task 8, and the spec's fallback (demos leave the homepage) is applied there.

## Deviations from the spec (decided here)

| Spec | Plan | Why |
|---|---|---|
| One `tools/compare.ts` | `tools/compare/` with `types.ts`, `text.ts`, `index.ts`, `parts.ts`, `table.ts`, `widths.json` | Parallel agents each own a file; nothing is merged by hand. |
| Shared styles moved into `about.css` | New `src/about/shared.css`, pulled in by `@import './shared.css';` at the top of `about.css` | Same reason. Vite inlines the import, so the built home stylesheet is still one file and the first-screen measure is unchanged. |
| Demo, route and editor-picture content in `site/compare.ts` | It lives with its component in `parts.ts` | It is presentation; `site/compare.ts` keeps tools, groups, rows and `checked`. |
| Compare sections found by `##` slug | An `<!--section:id-->` line before each `##` | Explicit ids; the H2 can hold `<!--compare:count-->`. |
| `<select>` picker with a radio fallback | `<select>` only; the fallback is built only if the manual check in Task 8 fails | YAGNI. |

## Contract

Task 0 writes the first two files exactly. Every agent reads this section.

### `tools/compare/types.ts`

```ts
export type Verdict = 'yes' | 'part' | 'no'
export type ToolId = 'us' | 'nbviewer' | 'github' | 'colab' | 'jupyterlab' | 'vscode'
export type GroupId = 'privacy' | 'access' | 'reading' | 'sharing' | 'editing'
export type PageId = 'home' | 'compare'

export interface Tool { id: ToolId; name: string; job: 'Reads' | 'Shows' | 'Runs'; docs: string; choose: { lead: string; rest: string } }
export interface Group { id: GroupId; name: string }
export interface Cell { v: Verdict; say: string; more?: string; src?: string }
export interface Row { id: string; group: GroupId; label: string; cells: Record<ToolId, Cell> }

/** A block placed by `<!--compare:name-->` or `<!--compare:name:variant-->`. */
export interface Part {
  pages: readonly PageId[]
  variants?: readonly string[]
  html: (variant?: string) => string
  md: (variant?: string) => string
}
```

`site/compare.ts` exports `tools: readonly Tool[]` (order: us, nbviewer, github, colab, jupyterlab, vscode), `groups: readonly Group[]`, `rows: readonly Row[]` and `checked: string` (`'2026-10'`).

### `tools/compare/text.ts`

- `esc(s: string): string`: escapes `& < > "`.
- `word(n: number): string`: 20 to 40 as a capitalised word ("Thirty"); throws outside that range.
- `width(s: string, px = 14): number`: the sum of `widths.json` advances × px / 1000; throws on a missing character.
- `glyph(v: Verdict): string`: `<svg class="g" aria-hidden="true"><use href="#y"/></svg><span class="vh">Yes: </span>`, with `#p` / "Partly: " and `#n` / "No: ".
- `onlyHere(r: Row): boolean`: ours is `yes` and no rival is `yes`.
- `same(r: Row): boolean`: all six verdicts are equal.
- `month(checked: string): string`: `'2026-10'` → `'October 2026'`.

### Placeholders

| Placeholder | Owner | Pages | Notes |
|---|---|---|---|
| `sprite` | parts | home, compare | Hidden SVG with symbols `rose`, `y`, `p`, `n`, `spark`, `mark`, `ar` (copy from `homepage.html` 384–392) |
| `jobs` | parts | both | |
| `figures`, `figures:home` | parts | compare, home | Links: compare → `../#privacy`, `../#speed`, `#sources`, `../#offline`; home → `#privacy`, `#speed`, `#speed`, `#offline` |
| `teaser` | parts | home | Links to `compare/` |
| `demos` | parts | both | |
| `routes` | parts | both | |
| `editor:file`, `editor:notebook` | parts | compare, home | |
| `matrix`, `choose`, `sources` | table | compare | |
| `count` | index | both | `word(rows.length)` |

### Section shell

Task 1 emits this on `/compare/`; Task 4 writes it by hand on the homepage; Task 2 styles it in `shared.css`.

```html
<section class="sec reveal" id="…">                      <!-- full width -->
  <header class="sh"><div><p class="k">Kicker</p><h2>…</h2><p class="lede">…</p></div><p class="aside">…</p></header>
  …
</section>
<section class="sec split reveal" id="…"><div class="txt">…kicker, h2, lede, list…</div><div class="art">…component…</div></section>
<div class="halves"><section class="sec half" id="limits">…</section><section class="sec half" id="sources">…</section></div>
<section class="close reveal"><div><h2>Try it on a notebook of your own.</h2><p>It opens in this tab. Nothing is uploaded.</p></div><div class="acts">…</div></section>
```

The content column is `.wrap` (1240px, 24px gutter, 16px on phones). Buttons and links in `.acts` carry `class="solid"`, `"default"` or `"quiet"`. Ticked lists are `<ul class="ticks">` with `glyph('yes')` in each item. `.vh` is the visually hidden class.

### Class roots

| Root | Owner (markup / CSS) |
|---|---|
| `.wrap .sec .sh .k .lede .aside .split .txt .art .ticks .close .acts .vh .g .sprite` | sections: Task 1 / Task 4 · CSS: Task 2 |
| `.jobs .figs .teaser .demos .routes .editor` | Task 2 / Task 2 |
| `.opening .stamp .toc .note .mxw .mx .choose .halves .limits .sources` | Task 1 (`.opening`, `.halves`) and Task 3 / Task 3 |
| `.trio .duo .keystrip`, the existing `.tiles .chart .stream .lane .node .faq` | Task 4 / Task 4 |

Task 2 extends `.lane` and `.node` only under its roots (`.jobs .lane.us`, `.routes .node.cloud`). The base rules stay in `about.css`, owned by Task 4.

### Rows

The 30 rows, in order. "Yes means" is what earns a tick; for `runs` and `editcode` the tick means capability, so ours is `no`.

| id | group | label | Yes means | Ours (draft) |
|---|---|---|---|---|
| where | privacy | Where the file is read | read on the reader's own device or own server | yes · In your browser |
| uploads | privacy | Uploads your file | the contents never reach a third party | yes · Never |
| account | privacy | Account needed | no sign-in to open a notebook | yes · None |
| private | privacy | Private files | a file that must stay on the machine can be opened | yes · From your disk |
| untrusted | privacy | Safe for untrusted files | a stranger's notebook cannot run code or scripts on open | yes · Cleaned, sandboxed |
| install | access | Install needed | nothing to install | yes · None |
| offline | access | Works offline | opens a notebook with no network | yes · After one visit |
| links | access | Opens from a link | opens a notebook from a URL | yes · GitHub and gists |
| large | access | Large files | a 50 MB notebook opens and stays usable | yes · Read in chunks |
| phone | access | On a phone | usable for reading in a phone browser | yes · Made for it |
| math | reading | Math and highlighting | LaTeX typeset and code highlighted | yes · Typeset |
| frames | reading | Printed DataFrames | `print(df)` text shown as a table | yes · Real tables |
| traces | reading | Tracebacks | the error comes first, library frames folded | yes · Error line first |
| bars | reading | Progress bars | a saved bar shows only its last frame | yes · Last frame only |
| search | reading | Search inside outputs | search covers outputs, not only code | yes · Text and outputs |
| outline | reading | Outline | a contents list built from headings | yes · From headings |
| order | reading | Run order | shows the order cells ran in | yes · Replay it |
| refresh | reading | Live refresh | the view follows the file when it changes on disk | part · In Chromium |
| widgets | reading | Live widgets | ipywidgets work live | no · Saved picture |
| figures | sharing | Figure shelf | every plot gathered in one place | yes · Every plot |
| shot | sharing | Cell as image | one cell exports as an image | yes · Press s |
| copymd | sharing | Copy as Markdown | the notebook as Markdown in one step | yes · Press m |
| share | sharing | Share without hosting | a viewable notebook is shared without uploading it | yes · Link after # |
| secrets | sharing | Secret scan | warns about keys and tokens before sharing | yes · Before sharing |
| diff | sharing | Compare versions | two versions side by side | yes · Side by side |
| runs | editing | Runs the code | can execute cells | no · Never, by design |
| edittext | editing | Edit text cells | Markdown cells can be edited | yes · In the page |
| editcode | editing | Edit code | code cells can be edited | no · Never |
| save | editing | Save back to the file | edits save into the same `.ipynb` | part · In Chromium |
| mdfiles | editing | Markdown files | `.md` files open rendered and can be edited | yes · Edit in the page |

## Execution

| Wave | Who | Tasks | Model |
|---|---|---|---|
| 0 | Controller | Task 0: contract files and the width table | session model |
| 1 | 8 agents in parallel, one message | Tasks 1, 2, 3, 4 (code) and 5a–5d (research, read-only) | `sonnet` |
| 2 | 1 agent | Task 6: data, from the four research tables | `sonnet` |
| 3 | Controller | Task 7: seam check, then one commit per task | session model |
| 4 | User, then at most one fix-up agent | Task 8: build, check, look | `sonnet` |

Dispatch with `subagent_type: "general-purpose"`, `model: "sonnet"`. Every brief is the same preamble plus the task number:

> You are implementing Task N of `docs/superpowers/plans/2026-10-29-compare-page-and-homepage.md`. Read that plan's Global Constraints, Contract and Task N, nothing else in it. Then read only what Task N lists under **Read**: named spec sections, mockup line ranges and repository files. Do not explore beyond them. Edit only the files under **Owns**. Do not run tests, builds, type checks, linters, formatters or servers, and do not commit. Reply in at most 150 words: the files you changed, any departure from the Contract and why, and open questions.

Token rules this plan relies on:
- The contract is code that the controller writes first, so no agent reads another agent's files.
- Agents read mockups by line range, never whole.
- Research agents return only a table. The controller pastes the four tables into Task 6's brief; nothing goes through files.
- There are no reviewer agents. The controller checks the seams with `grep` in Task 7.

---

### Task 0: Contract files and width table (controller)

**Files:**
- Create: `tools/compare/types.ts`, `tools/compare/text.ts`, `tools/compare/widths.json`

**Interfaces:**
- Produces: everything in Contract → `types.ts` and `text.ts`.

- [ ] **Step 1: Measure the width table.** In the browser pane, on a page where `/fonts/inter.woff2` is same-origin: the running dev server at `localhost:5317`, or else the live site after confirming with `shasum` that its `/fonts/inter.woff2` matches `public/fonts/inter.woff2`. Load `new FontFace('M', 'url(/fonts/inter.woff2)', { weight: '500' })`, add it to `document.fonts` and await it. For each character in printable ASCII (32–126) plus `’ “ ” – — × ·`, take a canvas `measureText` at `500 1000px M` and round it. Write `{ "font": "Inter 500", "unit": "1/1000 em", "advances": { "a": 553, … } }` to `widths.json`.
- [ ] **Step 2: Check it against the spec's figures.** `width('Google’s machines')` ≈ 126 and `width('Never, by design')` ≈ 112, within 1px.
- [ ] **Step 3: Write `types.ts`** exactly as in Contract.
- [ ] **Step 4: Write `text.ts`** with the seven helpers in Contract. `width` reads `widths.json` with `readFileSync(new URL('./widths.json', import.meta.url))` and `JSON.parse` (no JSON import attributes).
- [ ] **Step 5: Commit**

```bash
git add tools/compare/types.ts tools/compare/text.ts tools/compare/widths.json
git commit -m "feat(compare): the types, helpers and width table the pages are built on"
```

### Task 1: Engine, compare prose and build wiring

**Owns:** `tools/compare/index.ts`, `site/compare.md`, `vite.config.ts`

**Read:**
- Spec: "Architecture" (all subsections), "Page structure" (all, for prose and section order), "SEO, answer engines and the Markdown copy", "Coordination".
- `vite.config.ts` (all, 277 lines).
- `compare-page.html` 305–332 (opening) and 484–515 (limits, sources, close), markup only.

**Interfaces:**
- Consumes: `shared` from `./parts.ts` (Task 2) and `only` from `./table.ts` (Task 3), both `Record<string, Part>`; the data exports of `../../site/compare.ts` (Task 6); everything in `text.ts`.
- Produces, in `tools/compare/index.ts`:
  - `parts: Record<string, Part>`: `{ ...shared, ...only, count }`.
  - `page(body: string): string`: the compare page's `<main class="compare">…</main>`.
  - `markdown(body: string): string`
  - `fill(html: string, page: PageId): string`
  - `check(guides: readonly string[]): void`

- [ ] **Step 1: Rewrite `site/compare.md`.**
  - Front matter: the title and description from the spec's SEO section.
  - The `#` H1 and the opening lede, then `<!--compare:jobs-->`, `<!--compare:figures-->` and the figures note.
  - Then, for each section: an `<!--section:id-->` line, the `##` H2, its lede paragraph, its placeholders, and its lists, all in spec wording.
  - Section ids and layouts:

    | id | layout | kicker |
    |---|---|---|
    | `table` | full | Side by side |
    | `reading` | full | Reading |
    | `your-file` | full | Privacy |
    | `markdown` | split | Markdown |
    | `choosing` | full | Which to choose |
    | `limits` | half | (none) |
    | `sources` | half | (none) |

  - The `table` H2 is `<!--compare:count--> things, checked.`
- [ ] **Step 2: Implement the walk in `index.ts`.**
  - `marked.lexer(body)`. The `#` and everything before the first `<!--section:…-->` become `<header class="opening">`: `.txt` holds `.k` "Compared" with `.stamp` (`glyph('yes')` + "Checked " + `month(checked)`), the h1, the `.lede` and `nav.toc` (links to `#table`, `#reading`, `#your-file`, `#markdown`, `#choosing`, `#sources`); `.art` holds jobs; then figures and `p.note`.
  - Each section uses the Section shell, with the kicker and layout from the table in Step 1; two consecutive `half` sections share one `.halves`.
  - A placeholder token becomes `parts[name].html(variant)`. Other tokens go through `marked.parser`.
  - Close with the shell's `.close`. Its buttons are links: solid "Open a notebook" `../`, default "See the demo" `../?url=cooling-coffee.ipynb`, quiet "Open from GitHub →" `../open-from-github/`.
  - Put `parts.sprite.html()` first inside `<main class="compare">`, and run `fill(…, 'compare')` over the result for inline placeholders such as the count.
- [ ] **Step 3: Implement `markdown(body)`** with the same walk: placeholders become `md(variant)`, section markers are dropped, and everything else is copied as written.
- [ ] **Step 4: Implement `fill(html, page)`.** Replace `<!--compare:(\w+)(?::(\w+))?-->`. Throw when the name is not in `parts`, the variant is not in `variants`, or `page` is not in `pages`.
- [ ] **Step 5: Implement `check(guides)`.** Throw, naming the row and the tool, for each rule in the spec's "Build-time checks", reading placeholders from `site/compare.md` and `index.html`. A `../slug/` link in `site/compare.md` must have its slug in `guides`.
- [ ] **Step 6: Wire `vite.config.ts`.**
  - `pages()`: call `check(GUIDES)` in `buildStart`.
  - In `render()`, for slug `compare`, replace `<main class="doc"><article>…</article></main>` with `page(g.body)`.
  - Add the compare stylesheet on that page only: in dev `${base}src/about/compare.css`; in build, emit `compare.css` as an asset the way `guide.css` is emitted and link it from `compare/index.html` only.
  - Use `markdown(g.body)` wherever the compare body becomes `compare/index.md` or part of `llms-full.txt`.
  - In the `order: 'pre'` `transformIndexHtml`, run `fill(html, 'home')` first.
  - `finish()`: replace facts in `index.html`, `compare/index.html`, `compare/index.md` and `llms-full.txt`, with the error naming the file.
- [ ] **Step 7: Self-check.** Run `grep -o 'compare:[a-z:]*' site/compare.md | sort -u`. Every name must be a key in `parts`, with a valid variant.

### Task 2: Shared components and their styles

**Owns:** `tools/compare/parts.ts`, `src/about/shared.css`

**Read:**
- Spec: "Page structure" §1 (jobs and figures bullets), §3, §4, §5 (editor picture); "Homepage" §1 (figures:home, teaser), §2 (editor:notebook), "Close"; "Visual language"; "Accessibility".
- `homepage.html`:
  - Styles 3–383: port only the rules for the tokens, the sprite and `.g`, `.in` (→ `.wrap`), `.sec`, `.sh`, `.k`, `.hero`/`.md2`/`.split2` (→ `.split`), `.jobs`, `.figs`, `.cmp` (→ `.teaser`), the demo classes (→ under `.demos`), the routes, `.win`/`.wbar`/`.doc`/`.ed`/`.tool`/`.cc` (→ `.editor`, with `.doc` renamed `.page`), `.ticks` and `.close`.
  - Markup 384–392 (sprite), 426–551 (compared, Markdown, reading, routes) and 604–612 (close).
- `src/about/about.css`: only the `.lane`, `.node`, `.arrow` and `.pill` rules (grep).
- `public/cooling-coffee.ipynb`: one real Markdown paragraph and one real code line for the notebook picture.

**Interfaces:**
- Consumes: Contract types; `esc`, `glyph`, `word`, `month` from `./text.ts`; `tools`, `rows` and `checked` from `../../site/compare.ts`.
- Produces: `export const shared: Record<'sprite' | 'jobs' | 'figures' | 'teaser' | 'demos' | 'routes' | 'editor', Part>`, with `pages` and `variants` as in Contract → Placeholders.

- [ ] **Step 1: Tokens in `shared.css`.** On `:root`, for light and dark, with the theme selectors `about.css` uses: `--tick`, `--tick-ink`, `--tick-soft`, `--ring` and `--part`, with the spec's exact values. Add `.vh`, `.g` (18px), and the `forced-colors` and reduced-motion rules.
- [ ] **Step 2: `sprite` and `jobs`.**
  - `sprite`: the hidden SVG from Contract → Placeholders. Its `mark` symbol gets the dark-mode `--line-2` outline.
  - `jobs`: three lanes built from `tools[].job`, with "Reads" tinted and ringed. `md()` gives three lines: "Shows: nbviewer, GitHub (rendered on a server)", and so on.
- [ ] **Step 3: `figures` and `teaser`.**
  - `figures`: four `.fig` tiles with fact placeholders and the per-variant links from Contract. `md()` gives a list.
  - `teaser`: as in spec Homepage §1. The heading is `${word(rows.length)} things, checked against five tools.`; the chips are `aria-hidden`. `md()` gives one link line.
- [ ] **Step 4: `demos`.**
  - A radio chip row in a fieldset, and three states in one grid area. Below a 720px container, a segmented control switches between the panes.
  - The "as read" HTML copies the reader's table and traceback look under `.demos` only. The captions use the spec's exact sentences.
  - On print, show all three states. `md()` gives "As saved" fenced blocks and "As read" text, with a GFM table for the DataFrame.
- [ ] **Step 5: `routes`.** Seven lanes from the spec's table, with `.node.cloud` for third-party stops and the ring for stops that run code. Each lane ends with `glyph(v)` and its phrase. Nodes wrap between nodes, never inside one. `md()` gives a list of "Tool: a → b → c (end)".
- [ ] **Step 6: `editor`.** `editor:file` draws `field-notes.md` as in spec §5. `editor:notebook` draws `cooling-coffee.ipynb` as in spec Homepage §2, using the real cells from the notebook. Both are `aria-hidden`; `md()` returns `''`.
- [ ] **Step 7: Section shell and close styles:** `.wrap`, `.sec`, `.sh`, `.k`, `.lede`, `.aside`, `.split` (two columns from 960px), `.ticks` and `.close`/`.acts`, with type and spacing from the spec's "Visual language".
- [ ] **Step 8: Self-check.**
  - `grep -nE '^\s*\.(doc|cell|tbl|exc|lane|node)\b' src/about/shared.css` prints nothing.
  - Every class root in `parts.ts` markup appears in `shared.css`.

### Task 3: Compare-only components and styles

**Owns:** `tools/compare/table.ts`, `src/about/compare.css`

**Read:**
- Spec: "The matrix" (all); "Page structure" §1 (opening styling only), §2, §6, §7; "Accessibility"; "Print, performance, robustness".
- `matrix.html`: 7–115 (styles) and 136–202 (markup).
- `compare-page.html`: styles 7–275, only for `.opening`, `.stamp`, `.toc`, `.ctl`, `.chip`, `.sw`, `.choose`, `.halves` and `.sources`; markup 305–356 and 471–506.

**Interfaces:**
- Consumes: Contract types; `esc`, `glyph`, `onlyHere`, `same` and `month` from `./text.ts`; all four data exports.
- Produces: `export const only: Record<'matrix' | 'choose' | 'sources', Part>`, all with `pages: ['compare']`.

- [ ] **Step 1: `matrix` HTML.**
  - `div.mxw` (`container-type: inline-size`), then a fieldset of chips with counts (All, the five groups, Only here), the "Only differences" switch, and a `<select>` labelled "ipynb viewer vs".
  - A real table with a hidden caption, explicit `role` attributes, group rows, and rows classed `g-{group}`, `only` and `same`.
  - A 24px detail checkbox per row, labelled "Details for {label}", opening the following `tr.more` (`more` + a "Source" link). Row label cells carry `id="{row id}"`.
  - The foot: legend, "Checked {month} against each tool’s documentation." and a link to `#sources`.
- [ ] **Step 2: `matrix` Markdown.** One GFM table per group (cells like `Yes: In your browser`), then a notes list with each `more` and its source.
- [ ] **Step 3: `choose` and `sources`.**
  - `choose`: six cards from `tools[].choose`, ours first and tinted.
  - `sources`: one line per rival (docs link and the month checked), the method from `<!--fact:benchnote-->`, and "Something out of date? Open an issue." linking to `https://github.com/ashwingopalsamy/ipynb-viewer/issues/new`.
  - `md()` for both.
- [ ] **Step 4: `compare.css`.**
  - The opening, and the matrix's full and picker layouts at the spec's exact column widths (204 / 180 / at least 163.2px) and switch points (1200px and 328px containers). The sticky header is at `top: 60px` in the full table and on the vs bar in the picker layout.
  - Six `:has()` filter rules, the differences switch and the select picker rules.
  - Hover, focus and 44px coarse-pointer targets.
  - `.choose`, `.halves` (stacked below 960px), the limits list with the dash glyph, `.sources`, and print rules (controls hidden, every row shown, detail rows closed).
- [ ] **Step 5: Self-check.** `grep -n 'white-space: *nowrap' src/about/compare.css` covers the verdict cells. No rule styles `.doc`.

### Task 4: Homepage

**Owns:** `index.html`, `src/about/about.css`, `site/home.md`, `DESIGN.md`

**Read:**
- Spec: "Homepage" (all); "Visual language" (the `--ran` mapping and the DESIGN.md line).
- `index.html` 91–211.
- `src/about/about.css` (all).
- `homepage.html`: markup 531–612; styles only for `.three`, `.card2`, `.psheet`, `.tally`, `.two-up`, `.chart2`, `.stream2`, `.duo`, `.tiles3`, `.ti`, `.keys2` and `.faq` (grep them).
- `site/home.md`.

**Interfaces:**
- Consumes: the placeholder names, Section shell and class roots in Contract.
- Produces: homepage anchors `#how`, `#compared`, `#markdown`, `#reading`, `#privacy`, `#offline`, `#safety`, `#speed`, `#features` and `#faq`.

- [ ] **Step 1: Rewrite `#how` in `index.html`** (inside `#home`, keeping `<div id="how">`). Open with `<!--compare:sprite-->`, then the eight sections and the close in spec order, in the Section shell, with these placeholders:
  - Compared: `jobs`, `figures:home`, `teaser`.
  - Markdown: `editor:notebook`.
  - Reading: `demos`.
  - Privacy: `routes`.

  Everything else is hand-written from the spec:
  - The `.trio` cards, the privacy sheet moved from today's block 2, `id="offline"` on the offline card, and the safety lanes.
  - The `.duo` speed cards, with today's `<!--fact:chart-->` and stream markup.
  - Nine tiles with their keys, plus the `.keystrip`. The new "Trace a name" icon is Lucide `locate-fixed` in the tiles' stroke style.
  - `<!--site:faq-->`.
  - The close: `<button class="solid" type="button" data-choose>` "Choose a notebook" with the upload icon (not `.ask`), `<a class="default" href="./?url=cooling-coffee.ipynb">See the demo</a>`, `<a class="quiet" href="compare/">The full comparison →</a>`.

  Keep every fact placeholder used today.
- [ ] **Step 2: Edit `about.css`.**
  - Put `@import './shared.css';` on the first line.
  - Delete `--ran` in both themes. Map its four uses: `.here .arrow`, `.node.box` and `.row.first .track i` use `--tick`; `.scale span:nth-child(2)` uses `--tick-ink`.
  - Delete the `.block*` and `.keys*` rules.
  - Set the chart's label column to 200px.
  - Add the homepage-only rules (`.trio`, `.duo`, `.tiles` with keys, `.keystrip`, `.faq` as two columns from 960px) as one contiguous block at the end.
- [ ] **Step 3: Rewrite `site/home.md`** in the new order, one bullet per section, with no figures, plus the comparison line from spec Homepage → "Markdown copy". Add the DESIGN.md line under Colour, verbatim from the spec.
- [ ] **Step 4: Self-check.**
  - `for a in how privacy faq offline speed; do grep -c "id=\"$a\"" index.html; done` prints `1` five times.
  - `grep -n -- '--ran\|class="block\|class="keys"' index.html src/about/about.css` prints nothing.
  - `grep -c 'fact:' index.html` is at least 11, and each of `benchcells benchfirst benchnote benchsize benchtotal chart core files offline` still appears.

### Tasks 5a–5d: Rival research (read-only, run with Wave 1)

5a: nbviewer and GitHub (the github.com notebook preview, not Codespaces). 5b: Google Colab. 5c: JupyterLab 4, local, with no added extensions. 5d: VS Code with Microsoft's Jupyter extension, which VS Code offers on first opening a notebook. Give 5d the most care.

**Read:** Contract → Rows. The tool's official documentation, through WebSearch (`mode: "standard"`; `"extended"` only when a standard result is thin or out of date) and WebFetch. State as of October 2026.

**Owns:** nothing. Write no files.

- [ ] **Step 1: Decide each of the 30 rows for the tool** under "Yes means", judging the default product without extra extensions.
- [ ] **Step 2: Reply with only this TSV**, one line per row in Contract order, then at most five lines of notes on uncertain cells:

```
tool	row	v	say	more	src
vscode	where	yes	Your machine	VS Code reads the file locally and keeps it beside your kernel.	https://code.visualstudio.com/docs/datascience/jupyter-notebooks
```

- `say`: at most 16 characters, sentence case, no full stop. Task 6 measures it exactly.
- `more`: one sentence, at most 25 words.
- `src`: the https page that supports the verdict, preferring official documentation.

### Task 6: Data (Wave 2)

**Owns:** `site/compare.ts`

**Read:**
- Contract (types and Rows).
- Spec: "Decisions already made", "Facts the page relies on", "Rows", and "Page structure" §6 (choose sentences).
- `tools/compare/text.ts`.
- The four research TSVs (pasted into the brief).

**Interfaces:**
- Produces: `tools`, `groups`, `rows` and `checked`, typed as in Contract.

- [ ] **Step 1: Write `site/compare.ts`.**
  - `tools`: names, jobs, `docs` (each tool's main documentation URL) and `choose` from spec §6. Our `docs` is `https://github.com/ashwingopalsamy/ipynb-viewer`.
  - `groups`: Privacy, Access, Reading, Sharing, Editing.
  - `rows`: Contract → Rows, with our cells from the draft plus a `more` built from the spec's Facts, and rival cells from the TSVs.
  - `checked = '2026-10'`.
- [ ] **Step 2: Measure every `say` and `label`.** Use a `node -e` script that reads `tools/compare/widths.json` with the same formula as `width()`. This is authoring, not a build. Shorten any phrase over budget and list the changes.
- [ ] **Step 3: Check the derived values.** Print how many rows are "Only here" and confirm each group has a row that is not `same`. Report both.

### Task 7: Seam check and commits (controller)

- [ ] **Step 1: Placeholders.** Run `grep -o 'compare:[a-z:]*' site/compare.md index.html | sort -u`. Every name must be a key of `shared`, `only` or `count`, with a valid variant and page.
- [ ] **Step 2: Class roots.** Compare the root classes used in `parts.ts` and `table.ts` markup, and in `index.html`'s new sections, with the selectors in `shared.css`, `compare.css` and `about.css`. Fix small gaps in place and record each one.
- [ ] **Step 3: Imports.** Every relative import ends in `.ts`, types use `import type`, and nothing imports from `src/`.
- [ ] **Step 4: Commit once per task**, with each task's owned files only:
  - `feat(compare): render the comparison page from data`
  - `feat(compare): shared blocks for the homepage and the comparison`
  - `feat(compare): the side-by-side table, choosing and sources`
  - `feat(home): rebuild how it works around the comparison's proof`
  - `feat(compare): thirty rows, checked against five tools`

### Task 8: Verify (user), fix up, close

- [ ] **Step 1:** The user runs `npm run check` and `npm run build`, or tells the controller to, and pastes the output.
- [ ] **Step 2: Fix up.** If anything fails, dispatch one `sonnet` agent with the error output and only the failing files' owning tasks. Commit as `fix(compare): …`.
- [ ] **Step 3: Budget.** Compare the "first screen" line in the build output with 15 KB. Above 23 KB (8 KB added), take `<!--compare:demos-->` and the Reading section off the homepage and rebuild.
- [ ] **Step 4:** Do the manual checks in the spec's "Manual checks". If the rival picker does not restyle on change in Safari or Firefox, add the radio fallback in `table.ts` and `compare.css`.
- [ ] **Step 5:** Stop the visual companion server.
