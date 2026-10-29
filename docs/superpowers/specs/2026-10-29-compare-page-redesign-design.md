# Compare page and homepage redesign

Date: 2026-10-29. Branch: `feat/compare-page-redesign-0c5447`. Status: both pages approved in the visual companion (`page-v1` for `/compare/`, `home-v3` for the homepage); this document is the written spec.

## Goal

`/compare/` is today a generic guide page: a 720px column, an 8 × 6 table that wraps its cells and scrolls sideways on a phone, and three short sections. It should become the page that shows, with evidence, why ipynb viewer is the best way to read a notebook, while staying fair enough to be believed.

Success means:

- Every verdict sits on one line at every supported width, from 320px to wide desktop. No cell wraps; no page scrolls sideways.
- The page shows things, not adjectives: build-measured figures, before/after demos taken from what the reader actually does, and a route for each tool's file.
- It is interactive with no script: filters, a rival picker on narrow screens, row detail and demo switching all work under the guide pages' strict CSP.
- It claims Markdown support only as far as it works: open from disk, edit in the rendered page, save back to the same file.
- Agents and answer engines get the same content as clean Markdown (`compare/index.md`, `llms-full.txt`).

The homepage's "how it works" blocks get the same treatment. A visitor should see the proof without finding `/compare/`: what kind of tool this is, the figures, the reading demos, where the file goes and Markdown editing. The full table stays on `/compare/`, and one card links to it.

## Decisions already made

| Question | Decision |
|---|---|
| Markdown claims | Disk only. Markdown from a link does not work today (`App.svelte` decides Markdown only for a `File`; `streamLink()` returns `{name, stream}`, so a `.md` link is parsed as notebook JSON and fails). No app change in this work. |
| Voice | Confident and evidence-led. No "best ever" superlatives; the proof is figures, demos and fair verdicts. Plain, short, sentence case, no exclamation marks (DESIGN.md). |
| Rivals | nbviewer, GitHub preview, Google Colab, JupyterLab, VS Code. |
| Interactivity | CSS only. The page keeps the guide pages' one inline script (the theme) and adds none. |
| Architecture | Approach A: one data module, rendered twice (rich HTML for the page, GFM for the Markdown copy). |
| Matrix | The "spotlight" table, refined: blue verified tick, one-line phrases, "Only here" as a caption. Approved in `spotlight-v3`. |
| Rest of page | Approved in `page-v1` (opening, demos, routes, Markdown, choosing, limits and sources, close). |
| Homepage | Proof on the homepage, full page kept. The homepage reuses the jobs card, figures, demos, routes and editor picture, built from the same data. The table is not on the homepage (tried in `home-v1`, rejected); a card under the figures links to it. Approved in `home-v3`. |
| Homepage Markdown | Leads with editing a notebook's Markdown cells; `.md` files come third. It sits second, right after the comparison. |
| Homepage accent | The landing page's green "this path" highlight (`--ran`) becomes the tick blue, so both pages have one colour for "ours". |

## Facts the page relies on

Checked in the code on 2026-10-29. The page must not claim more than this.

- **Printed DataFrames.** Plain text that lines up as a pandas frame (what `print(df)` writes) becomes a real table: monospace, tabular figures, numbers right-aligned (`src/lib/tabular.ts`, `src/lib/tbl.css`).
- **Tracebacks.** The exception name and value come first, in `--danger` (`Output.svelte`, `.exc`). A traceback of five or more frames is reduced to the last frame in the reader's own code (`Cell In[n]`), and the rest sits behind a "Show full traceback" row (`src/lib/trace.ts`, `calm()`).
- **Progress bars.** A bar saved as one line per frame (tqdm without a terminal, Keras) keeps only the last frame of each run (`src/lib/streams.ts`, `foldBars()`); carriage returns are collapsed too.
- **Long outputs.** Past 24 lines an output keeps its first 12 and last 8 lines. Not used as a demo: VS Code also truncates long text outputs, so it is not unique.
- **Markdown files.** `.md` and `.markdown` open by picker, drop or the operating system (`src/lib/edit/mdfile.ts`, `watch.ts`), render as one Markdown cell, edit the same way as text cells (double-click or `e`; a bar with undo, bold, italic, code, links, headings and lists), and save into the same file in Chromium browsers; other browsers download a copy. Live refresh works for them too.
- **Text cells in a notebook.** Double-click a paragraph, heading or list, or press `e`, and write. Code and outputs are never changed and nothing runs. Saving changes only the text of the cells that were edited, so figures, tables and outputs stay as they were. From disk in Chromium, Save writes the same file; from a link or in other browsers, it saves a copy (`site/faq.md`).
- **Copy as Markdown** hides likely secrets by default (`ui.hide` defaults to `true`; `src/lib/Handoff.svelte`, `src/lib/insight/secrets.ts`).
- **Keys** the homepage names: `j` `k` cells, `[` `]` headings, `t` contents, `{` `}` tabs (`App.svelte`), `?` every key, `/` search, `s` cell image, `m` Copy as Markdown, `e` edit, `f` trace a name.
- **Links.** On the main site a link is fetched through this site's Worker relay, which allows only GitHub files and gists, passes the bytes through and keeps no record of the address (`site/faq.md`, "What happens when I open a link?"). The GitHub Pages mirror fetches directly from the browser. Links are capped at 50 MB.
- **Build facts.** `finish()` in `vite.config.ts` computes `core` (first screen, gzipped), `offline` (one-time download), `files`, `benchsize`, `benchcells`, `benchfirst`, `benchtotal` and `benchnote`. Today it fills `<!--fact:key-->` in `dist/index.html` only. The bench numbers come from `src/about/bench.json`, measured by `npm run bench`, not by the build.

## Architecture

### Files

| File | Change |
|---|---|
| `site/compare.ts` | New. The comparison as typed data: tools, groups, rows, verdicts, sources, demos, routes, choosing cards, the checked date. Content edits happen here and in `site/compare.md`. |
| `site/compare.md` | Rewritten. The page's prose in reading order, with block placeholders (`<!--compare:matrix-->` and so on) where data-driven parts go. Front matter gains VS Code in the title and a new description. |
| `tools/compare.ts` | New. Pure functions: `page(body)` returns the page's `<main>` HTML; `markdown(body)` returns the Markdown copy. Validates the data and throws on any rule below. |
| `tools/widths.json` | New. Advance widths of Inter Medium (weight 500), in thousandths of an em, for printable ASCII plus `’ “ ” – — × ·`. Measured once in a browser with canvas `measureText` at 1000px; regenerate only if the font changes. A comment at the top of `tools/compare.ts` says how. |
| `src/about/compare.css` | New. Styles only the compare page uses: the opening, the matrix and its controls, choosing, limits and sources. |
| `src/about/about.css` | The tick tokens, the sprite glyphs and the shared components (section layout, kicker, `jobs`, `figures`, `teaser`, `demos`, `routes`, `editor`) move here, because both pages load it. The numbered `.block` and the `.keys` list go. `--ran` goes; its four uses take the tick colours. |
| `index.html` | `#how` is rewritten as eight sections and a close (see Homepage), with `<!--compare:…-->` placeholders for the shared components. The hero, the head, the JSON-LD and the FAQ placeholders are unchanged. |
| `site/home.md` | Rewritten to follow the new homepage, one bullet per section, plus a line pointing to the comparison. |
| `vite.config.ts` | Small hooks: `pages()` renders the compare page through `tools/compare.ts`, links `compare.css` on that page only, and uses the expanded Markdown for `compare/index.md` and `llms-full.txt`. The existing `order: 'pre'` `transformIndexHtml` that fills `<!--site:faq-->` also fills `<!--compare:…-->` in `index.html`. `finish()` fills facts in four files instead of one. |
| `DESIGN.md` | One line under Colour for the tick colour (see Visual language). |

No app code changes (`about.ts` already binds every `[data-choose]`, so the close's button needs no script). No new dependencies.

### Rendering

`site/compare.md` is the skeleton. `tools/compare.ts` reads it with `marked.lexer()` and walks the tokens:

- The `#` heading and the paragraphs before the first `##` are the opening. `<!--compare:jobs-->` and `<!--compare:figures-->` in that stretch place the opening's card and figures.
- Each `##` heading starts a section, `<section id="{slug}">`. Its first paragraph is the section's lede. A small table in `tools/compare.ts` maps each slug to its kicker (the small capitals line above the heading) and its layout: `full`, `split` (prose left, component right) or `half` (two consecutive half sections share a row).
- An HTML token matching `<!--compare:(\w+)(?::(\w+))?-->` is replaced by that component's HTML; the optional second word picks a variant. Any other token goes through `marked.parser()` unchanged.
- The close and the footer are appended by the shell, as the guide pages' call to action is today.
- `page()` returns `<main class="compare">`, not the guides' `.doc`, so `guide.css`'s 720px article column and its `display: block` tables never reach the components.

`markdown(body)` walks the same tokens and replaces each placeholder with the component's Markdown (empty for the editor window, which is only a picture). Everything else is copied as written. So the page and its Markdown copy cannot drift: they come from one source.

Components: `sprite`, `jobs`, `figures`, `teaser`, `matrix`, `demos`, `routes`, `editor`, `choose`, `sources`, `count`. Each has `html()` and `md()`. Three are new for the homepage:

- `teaser` is the homepage's card to the full comparison (see Homepage).
- `count` is the number of rows as a word ("Thirty"), so the prose that names it ("Thirty things, checked.") follows the data. It covers twenty to forty and throws outside that range.
- `editor` takes a variant: `editor:file` draws `field-notes.md` (the compare page), `editor:notebook` draws `cooling-coffee.ipynb` (the homepage). Both pictures are data in `site/compare.ts`: the file name, the heading and the blocks under it.
- `figures` takes `figures:home`, which points each tile's link at a section of the homepage instead of the compare page.

The homepage uses `fill(html)`, a third export that replaces placeholders in an HTML string and nothing else, since `index.html` is written as HTML, not Markdown. The same component functions serve both pages, so a shared component cannot differ between them.

### Data model

```ts
type Verdict = 'yes' | 'part' | 'no'
type ToolId = 'us' | 'nbviewer' | 'github' | 'colab' | 'jupyterlab' | 'vscode'
type GroupId = 'privacy' | 'access' | 'reading' | 'sharing' | 'editing'

interface Tool { id: ToolId; name: string; job: 'Reads' | 'Shows' | 'Runs'; docs: string; choose: { lead: string; rest: string } }
interface Cell { v: Verdict; say: string; more?: string; src?: string }
interface Row { id: string; group: GroupId; label: string; cells: Record<ToolId, Cell> }

export const checked: string // '2026-10', rendered as "October 2026"
```

Derived, never written by hand:

- **Only here:** our cell is `yes` and no rival cell is `yes`.
- **Same everywhere:** all six cells have the same verdict.
- Chip counts, per group and for "Only here".

### Build-time checks

`tools/compare.ts` throws, naming the row and tool, when:

- a row lacks a tool, or two rows share an `id`;
- a rival cell has no `src`, or a `src` is not `https:`;
- a `say` is wider than **114px** at 14px Inter Medium, or a `label` wider than **156px**, measured with `tools/widths.json` (a character missing from the table is an error);
- a group has no row that differs between tools (the "Only differences" switch would empty it);
- a link to another guide points at a slug that is not built (the list is `GUIDES` in `vite.config.ts`);
- a placeholder in `site/compare.md` or `index.html` names no component or no variant, or a component meant for a page is never placed on it.

The width budget is what keeps every phrase on one line. It is derived from the layout in "The matrix" below: the narrowest rival column leaves 113.2px for text at weight 400, our column 130px, and a phone cell at 360px wide 112px at 13.5px. The label budget leaves room for the row's detail toggle. The check sums per-character advances without kerning, which reads 1 to 2px wider than rendered text ("Never, by design" sums to 113.9px and renders at 112px). A sum of 114px at 14px Medium fits all three: Regular is about 3% narrower than Medium (about 110.6px, under 113.2), 13.5px scales it to 109.9px (under 112), and our column has 130px. Pixels, not characters, because "WWW" and "iii" differ by a factor of three.

### Facts

`finish()` replaces `<!--fact:key-->` in `dist/index.html`, `dist/compare/index.html`, `dist/compare/index.md` and `dist/llms-full.txt`, with the same values and the same error for an unknown key. The compare page uses `core`, `offline`, `benchsize`, `benchcells` and `benchtotal`. The homepage keeps every fact it uses today (`files`, `offline`, `core`, `chart`, the four bench facts and `benchnote`), now inside the new sections. Components emit fact placeholders, never numbers, so the figures stay correct on both pages.

### CSP and the shell

The page keeps the guide shell: head, theme script, header pill, footer. It links the home stylesheet, `guide.css` and `compare.css`. Its policy is the guides' strict one, unchanged. The page adds an inline SVG sprite (symbols only, no script) and inline `style` attributes on symbol children, which `style-src 'unsafe-inline'` already allows. The inputs sit outside any form, so `form-action 'none'` is never exercised. The homepage keeps the app's policy, unchanged: the sprite and the demo radios are markup and CSS, and the page adds no script.

## Page structure

Content width is 1240px with a 24px gutter (16px on phones). One left edge for every section; nothing breaks out of it. Sections are 112px apart (56px on phones) and use the landing page's `.reveal`.

### 1. Opening

Two columns from 960px (1.15fr / 1fr, 72px gap), stacked below.

- Kicker "Compared", beside a stamp pill with a blue tick: "Checked October 2026" (from `checked`).
- H1, 58px, weight 700, −0.04em, `text-wrap: balance`: **Six ways to open a notebook, compared.**
- Lede, 19px, `fg-2`, 52ch: "nbviewer and GitHub show a notebook from a server. Colab, JupyterLab and VS Code run one, on a kernel that has to live somewhere. **ipynb viewer reads it in your browser:** nothing to install, no account, no upload, and no code runs."
- Contents row, one line: The table · Reading · Your file · Markdown · Choosing · Sources. Each item is an anchor with a small chevron.
- Right column, `jobs`: a paper card holding three of the landing page's lanes. "Shows": nbviewer, GitHub, "rendered on a server". "Runs": Colab, JupyterLab, VS Code, "on a kernel". "Reads": ipynb viewer, "in your browser, nothing else". The "Reads" lane is tinted (`--tick-soft`) with a `--ring` hairline and a blue label.
- `figures`, four tiles in a row (2 × 2 on phones), 34px figures, each with a link to its evidence:
  - **0 bytes** leave your device when you open a file from disk. → Check it yourself (`../#privacy`, the homepage's "Check it yourself" card).
  - **`core`** for the first screen, gzipped. The rest loads only when a notebook needs it. → What loads when (the homepage's size chart, `../#speed`).
  - **`benchtotal`** to read a `benchsize` notebook of `benchcells` cells. → How it is measured (Sources and method).
  - **`offline`** downloaded once; after that it opens with the wifi off. → What is kept (`../#offline`).
- Under the tiles, 13px `fg-3`: "Sizes are measured by the build on every release; read times come from the project's benchmark."

### 2. The table

Kicker "Side by side". H2 **Thirty things, checked.** ("Thirty" is `<!--compare:count-->`.) Lede: "Grouped by what you would ask. Every tick has words beside it, and every row opens to the detail and its source." Then the matrix (next section of this spec).

### 3. Reading

Kicker "Reading". H2 **The same notebook, read better.** Lede: "Most tools show an output exactly as it was saved. ipynb viewer reads it and shows what it means. Your file is never changed." Aside, right-aligned: "None of this runs code. It reads what the notebook already holds."

`demos`: a paper sheet with a chip row ("Try one": `print(df)`, A traceback, A progress bar) and two panes:

- **Elsewhere, as saved:** a sunk well (`--sunk`, `--dip`), the raw output in 12.5px mono. Long lines scroll inside the pane (`overflow-x: auto`), never the page.
- **ipynb viewer, as read:** paper with a `--ring` hairline and the mark: a real table; the exception line with the user's own frame and a "Show full traceback" row; the last frame of the bar and what was printed after it.
- Under the panes, a caption with the blue sparkle and "Only here", one sentence per demo:
  - "Text that lines up in columns, which is what `print(df)` writes, becomes a table. Numbers align on the right; the index stays quiet."
  - "The error is named first, then the line in your own code. The library frames wait behind one row."
  - "A bar saved as one line per frame keeps only its last frame. Everything printed after it stays."

The demo content lives in `site/compare.ts` as the raw text plus hand-written "as read" HTML that copies the reader's look (`.tbl`, `.exc`). It is written by hand because `tabular.ts` imports `tbl.css` and cannot run in the build config. Neither page loads the reader's styles, so the demo restates that look in `about.css`, scoped under `.demos` so it can never reach a real notebook. The three states share one grid area, so the sheet is as tall as the tallest state and switching never moves the page. The Markdown copy gives each demo as "As saved" in a fenced block and "As read" in words (a GFM table for the DataFrame).

Below a 720px container, the chips stay and a segmented control chooses the pane: Elsewhere | ipynb viewer, defaulting to ipynb viewer.

### 4. Your file

Kicker "Privacy". H2 **Where your file goes.** Lede: "The tools that show a notebook read it on their servers. The tools that run one keep it beside a kernel that can execute it. Here, the page you are reading is the only place it goes, and nothing in it runs." Aside: "Grey stops are someone else's computer. Outlined stops can run code."

`routes`: one lane per tool in a paper card, reusing `.lane`, `.node` and the landing page's arrow. Label column 118px, tool names in sentence case at 14px. Each lane ends, right-aligned, with a glyph and a phrase:

| Tool | Route | End |
|---|---|---|
| ipynb viewer | your file → this page | yes, Stays on your device |
| (from a link, indented under ours) | GitHub → this site's relay → this page | partly, Passed through, not kept |
| nbviewer | a link → nbviewer's server → a page | no, Fetched by their server |
| GitHub | your repository → GitHub's servers → a page | partly, Already on GitHub |
| Colab | your file → Google Drive → Google's runtime → a page | no, Copied to Google |
| JupyterLab | your file → Jupyter server → your kernel → a page | yes, Your machine |
| VS Code | your file → the editor → your kernel | yes, Your machine |

Third-party stops use `.node.cloud` (grey text). Stops that can run code get a `--line-2` inset outline. Our lane is tinted like the opening's; the link lane under it has only the ring. On phones each lane stacks: label, then nodes (wrapping between nodes, never inside one), then the end phrase.

### 5. Markdown

Kicker "Markdown". H2 **Markdown files, too.** Layout `split`.

- Left: lede "Open a `.md` file from your disk and it reads like a notebook. Edit it in the page you are reading, then save it back to the same file." Then a list with blue ticks, from the Markdown in `site/compare.md`:
  - Opens `.md` and `.markdown` by picking or dropping
  - Edit the rendered text: double-click a paragraph, or press `e`
  - A bar for bold, italic, code, links, headings and lists, with undo
  - Save writes the same file in Chromium browsers; others download a copy
- Under a hairline, two quiet lines: "GitHub: edit the source, preview in another tab." "VS Code: the source, with a preview beside it."
- Right, `editor:file`: a still picture of the reader editing `field-notes.md`, built in HTML and `aria-hidden`. A header with the name pill and its unsaved dot, "Edited", "Save a copy" and a solid "Save". The heading "Field notes". A paragraph in edit mode (`--ring` outline) with a selected word, a caret, and the edit bar floating above it, clear of the text. A math line, a two-item list with inline code.

### 6. Choosing

Kicker "Which to choose". H2 **Each one is right for something.** Lede: "Choose by what you need to do."

`choose`: six cards, 3 × 2 (one column on phones). Tool name, its job as a small capitals tag, one sentence with a bold lead. Ours first, tinted, with the ring.

- ipynb viewer, Reads: **To read a notebook now,** on any device, with nothing to install and nothing sent anywhere, including one that came by email.
- nbviewer, Shows: **For a stable public address** that anyone can open without this tool or an account.
- GitHub preview, Shows: **When the notebook lives in a repository** and you are reviewing it there, beside the code.
- Google Colab, Runs: **To run it with no setup,** on Google's machines, when a Google account and Drive are fine.
- JupyterLab, Runs: **To work on it:** run cells, change code, install packages, on a kernel you control.
- VS Code, Runs: **When it is part of a codebase** you are editing and debugging, with git beside it.

This replaces today's "When to choose which" list.

### 7. Limits and sources

Two `half` sections side by side (stacked below 960px).

**What it does not do.** Lede: "Said plainly, so the ticks above can be trusted." A list, each item with the dash glyph and a bold lead, written in `site/compare.md`:

- **Run code.** You see what the notebook saved, never new results.
- **Live widgets.** They need a kernel; their saved picture shows if there is one.
- **Edit code or outputs.** Only the text of text cells changes.
- **Export to PDF.** The browser's print dialog does that.
- **Markdown from a link.** Markdown files open from disk.

**Sources and method** (`id="sources"`). Lede: "Each verdict links to the page it came from." Then `sources`: one line per rival with its documentation link and the month checked; the method in two sentences (what the figures measure, how the bench runs, taken from `benchnote`); and "Something out of date? Open an issue." linking to the repository's new-issue page.

### 8. Close

A paper sheet, 28px radius: **Try it on a notebook of your own.** "It opens in this tab. Nothing is uploaded." Buttons: solid "Open a notebook" (`../`), default "See the demo" (`../?url=cooling-coffee.ipynb`), quiet "Open from GitHub →" (`../open-from-github/`). Then the shared footer.

## The matrix

### Layout

- A real `<table>`, `table-layout: fixed`, in a wrapper with `container-type: inline-size`.
- **Full table** when the container is at least 1200px wide: label column 204px (a 16px toggle, a 6px gap and at most 156px of label), our column 180px, the five rivals share the rest (at least 163.2px each). Cells 12px side padding, 14px text, an 18px glyph with an 8px gap, `white-space: nowrap`.
- **Picker layout** below 1200px: the label sits above a pair of cells, ours and one rival. The pair is two columns down to a 328px container (a 360px phone) and stacks below that, so 320px phones never clip.
- The header row is sticky under the guide header (`top: 60px`: the header's 8px inset, its 44px pill and 8px of air) in the full table. In the picker layout, the "ipynb viewer vs [rival]" bar is sticky instead, so the chosen rival stays named while rows scroll.

### Look (as approved)

- Glyphs, 18px, from an inline sprite: **yes** is the 8-lobed rosette (`R=7.6, a=0.62, n=8`) in `--tick` with a white check (`m5.7 9.3 2.2 2.2 4.4-4.7`, stroke 1.9, round caps); **partly** is the same in `--part`; **no** is a dash (`M5.5 9h7`, `fg-3`). The sparkle (`#spark`) marks "Only here". Symbol children carry `style="fill:var(--…)"`, because selectors do not reach into a `<use>` tree but custom properties do.
- Our column is paper, weight 500, with a `--ring` hairline drawn as inset shadows. Its header cell is tinted `--tick-soft`, rounded 18px at the top, and holds the mark, "ipynb viewer" and "Reads · this site". Its last cell is rounded 18px at the bottom. Rival headers carry their job ("Shows", "Runs") in small capitals.
- Group rows: small capitals, `fg-3`, with the row count.
- "Only here" rows: a 12px, weight 600 caption under the label, in `--tick-ink`, with the sparkle. "Same everywhere" rows: a `fg-3` caption, and their cells at 50% opacity.
- Row hover: `--hover` on rival cells and a 5% tick tint on ours.
- Foot: legend (Yes, Partly, No), "Checked October 2026 against each tool's documentation.", and a link to Sources and method.

### Controls, without script

- **Filter chips:** a `<fieldset>` of radios (All, Privacy, Access, Reading, Sharing, Editing, Only here), each with its count. Rows carry `g-{group}` and `only` classes; six `:has()` rules hide the rest. Chips wrap onto a second line on phones and never scroll sideways.
- **Only differences:** a checkbox styled as the app's switch. When on, rows marked `same` are hidden.
- **Rival picker** (picker layout only): a native `<select>` styled as a pill, labelled "ipynb viewer vs". `:has(option[value=…]:checked)` shows that rival's cells and header. If any target browser does not restyle on change, it falls back to a radio chip row with the same rules.
- **Row detail:** rows with detail get a 24px chevron toggle in the label cell (44px on coarse pointers): a checkbox labelled "Details for {label}". When checked, the following `tr.more` shows: one cell per tool with its `more` sentence (prose, wrapping allowed here) and a "Source" link. In the picker layout it shows ours and the chosen rival.
- **Deep links:** each row's label cell has `id="{row id}"` and `scroll-margin-top`, so `compare/#uploads` lands on the row.

### Rows

Thirty rows, five groups. Our draft verdicts follow. Every rival verdict, and every phrase, is written and checked against each tool's documentation during implementation (October 2026), with VS Code given the most care. Phrases must pass the width check, so long drafts such as "Become real tables" become "Real tables".

| Group | Row | Ours |
|---|---|---|
| Privacy | Where the file is read | yes, In your browser |
| | Uploads your file | yes, Never (detail: links go through the relay, which keeps nothing) |
| | Account needed | yes, None |
| | Private files | yes, From your disk |
| | Safe for untrusted files | yes, Cleaned, sandboxed |
| Access | Install needed | yes, None |
| | Works offline | yes, After one visit |
| | Opens from a link | yes, GitHub and gists |
| | Large files | yes, Read in chunks |
| | On a phone | yes, Made for it |
| Reading | Math and highlighting | yes, Typeset (expected the same everywhere) |
| | Printed DataFrames | yes, Real tables |
| | Tracebacks | yes, Error line first |
| | Progress bars | yes, Last frame only |
| | Search inside outputs | yes, Text and outputs |
| | Outline | yes, From headings |
| | Run order | yes, Replay it |
| | Live refresh | part, In Chromium |
| | Live widgets | no, Saved picture |
| Sharing | Figure shelf | yes, Every plot |
| | Cell as image | yes, Press s |
| | Copy as Markdown | yes, Press m |
| | Share without hosting | yes, Link after # |
| | Secret scan | yes, Before sharing |
| | Compare versions | yes, Side by side (GitHub, VS Code and nbdime have this too; shown fairly) |
| Editing | Runs the code | no, Never, by design |
| | Edit text cells | yes, In the page |
| | Edit code | no, Never |
| | Save back to the file | part, In Chromium |
| | Markdown files | yes, Edit in the page |

"Only here" is derived, so its count follows the checked verdicts rather than this draft.

## Homepage

The hero stays as it is: logo, H1, lede, the Choose button, the hint and the "How it works" cue. It is the app's first screen and where a file is dropped. Below it, `#how` becomes eight sections and a close, on the compare page's grid: 1240px content, a 24px gutter (16px on phones), one left edge, sections 112px apart (56px on phones), `.reveal` on each. The numbered badges go; each section has a kicker and an H2, as on `/compare/`, and an `id` the figures can link to.

Nothing from today's eight blocks is lost. Blocks 1 and 2 become "Where your file goes"; 3 and 4 become "Speed"; 5 is "Safety"; 6 and 7 become "Everything else"; 8 is "Questions". Every section's prose is written in `index.html`; the shared components come from `tools/compare.ts`.

### 1. Compared (`#compared`)

- Two columns from 960px, as the compare opening. Kicker "Compared". H2 **Six ways to open a notebook.** Lede: "nbviewer and GitHub show a notebook from a server. Colab, JupyterLab and VS Code run one, on a kernel. **This page reads it in your browser:** nothing to install, no account, no upload, and no code runs." Right: `jobs`.
- `figures`, the same four tiles, but each links down this page: 0 bytes → Where your file goes (`#privacy`); `core` → Small on purpose (`#speed`); `benchtotal` → Cells while it reads (`#speed`); `offline` → The offline copy (`#offline`). The variant is `figures:home`.
- `teaser`: one paper card under the figures, full width, the whole card a link to `compare/`. Left: kicker "The full comparison", heading "`count` things, checked against five tools.", and "Filter by what you care about, hide the rows that are the same everywhere, and open any row for its source." Right, end-aligned: the five rivals as quiet chips (`well-2`, 13px) above a solid pill in `--tick-ink` (`--tick` in dark), "Compare them →". One row from 960px; below that it stacks, and the chips wrap between chips. Hover adds the `--ring` hairline. The names and the count come from the data; the chips are `aria-hidden`, so the link reads as its heading and "Compare them".

### 2. Markdown (`#markdown`)

Split layout. Kicker "Markdown". H2 **Edit the text. Keep the outputs.**, on two lines at 40px by design (non-breaking spaces hold "Keep the outputs." together). Lede: "Double-click a Markdown cell and write in the page you are reading. Saving changes only the text you edited, so code, figures and tables stay exactly as they were. A `.md` file from your disk opens the same way." Blue-tick list:

- Edit any Markdown cell: double-click it, or press `e`
- Code and outputs are never changed, and nothing runs
- Opens `.md` and `.markdown` files too, by picking or dropping
- Save writes the same file in Chromium; others download a copy

Right, `editor:notebook`: `cooling-coffee.ipynb` with its unsaved dot, "Edited", "Save a copy" and "Save"; the notebook's title; a Markdown paragraph in edit mode with the edit bar above it; a code cell under it in a `well-2` strip (`[n]` and one line of code), marked "Code · unchanged"; a math line. The text is taken from cells that really are in `public/cooling-coffee.ipynb`, so the demo link shows the same notebook.

### 3. Reading (`#reading`)

`demos`, as on `/compare/` (section 3 there), with the same H2 and aside. The lede says "This page reads it" where `/compare/` says "ipynb viewer reads it".

### 4. Where your file goes (`#privacy`)

The section keeps today's `id="privacy"`: the app's Privacy sheet links to `./#privacy`.

Kicker "Privacy". H2 **Where your file goes.** Lede: "Opening a notebook usually means a server, and sharing one means putting it on somebody else's. This page reads the file where it is, and once it is open the page shuts its own connections. The browser enforces that, so even a bug could not send your file out." Aside as on `/compare/`. Then `routes`, the same seven lanes. Under them three cards in a row (stacked on phones):

- **The Privacy sheet:** today's picture of the sheet, moved as it is ("0 requests left this page since the notebook opened"; Offline copy, Ready; Connections, Closed; Web pictures, Asked per notebook), captioned "The Privacy sheet, in Settings." Its labels follow `src/lib/Privacy.svelte`.
- **The offline copy** (`id="offline"`): "After the first visit the app keeps its own files on your device: `files` files and about `offline`, downloaded once. Open a notebook with the wifi off and it still opens."
- **Check it yourself:** three numbered steps, the first three of the FAQ's "How can I check this myself?": open the browser's developer tools and the Network tab; switch the wifi off and reload; drop a notebook, and nothing is requested. A link to that question (`#faq`) follows.

### 5. Safety (`#safety`)

Split layout. Kicker "Safety". H2 **A notebook is untrusted input.** Lede: "Markdown and HTML outputs are cleaned before they are shown, and styles that could fetch anything are dropped. An output that carries a script waits behind a button and runs in a sandboxed frame that cannot reach your page, or the network unless you turn that on." Right, in a `jobs`-style card, today's two lanes: Markup: notebook → cleaner → page ("drops `onerror=…`"); Scripts: notebook → your click → sandbox, no network. The sandbox node keeps its outline, now in `--tick`.

### 6. Speed (`#speed`)

Kicker "Speed". H2 **Small on purpose, quick on big files.** Lede: "The first screen weighs **`core`** gzipped; math and highlighting load only when a notebook asks. The file is read in chunks, and each cell is handed over the moment it is whole." Two cards side by side from 960px:

- **What loads when:** `<!--fact:chart-->` as today, with a 200px label column so no label wraps, and the first bar in `--tick`. Caption "Gzipped, from this build."
- **Cells while it reads:** today's stream rail, its cells tinted with `--tick-soft`, the scale, then two figures, `benchfirst` "to the first cell" and `benchtotal` "for all `benchcells` cells of a `benchsize` file", with `benchnote` as the caption.

### 7. Everything else (`#features`)

Kicker "Everything else". H2 **Made for reading, and for small edits.** Lede: "Every action has a single key. Keys stand down in text fields and when you hold a modifier." Nine tiles, three across (one column on phones), each with today's icon and, where it has one, its key at the right of the title:

| Tile | Key | Line |
|---|---|---|
| Search | `/` | Across text, code and outputs, with each match marked in its cell. |
| Figures | | Every plot on one shelf, and each one saves as an image. |
| Run order | | See the cells in the order they ran, and the ones that ran out of turn. |
| Live refresh | | Save the notebook and the view follows, in Chromium browsers. |
| Share by link | | The link carries the notebook after the #, so no server sees it. |
| Screenshots | `s` | A clean image of a cell, ready for a post or a doc. |
| Copy as Markdown | `m` | The notebook as text, for a doc or for a model, secrets hidden. |
| Edit in place | `e` | Double-click any text and write. Code and outputs are never touched. |
| Trace a name | `f` | Every cell that defines or uses it, one key apart. |

"Trace a name" is new and needs one Lucide-style icon. Under the tiles, one line of keys: `j` `k` cells, `[` `]` headings, `t` contents, `{` `}` tabs, `?` every key. Today's "Save it back" tile moves into the Markdown list. The "Keyboard" tile and the Keys block become that line.

### 8. Questions (`#faq`)

Kicker "Questions". H2 **Asked often.** `<!--site:faq-->` as today: since 2.1.0 it renders `<div class="faq">` with one numbered `<details>` per question, so a question and its answer are already one element. The two columns are a grid on `.faq` from 960px; `vite.config.ts` is unchanged here. The FAQ JSON-LD is unchanged.

### Close

A paper sheet as on `/compare/`: **Try it on a notebook of your own.** "It opens in this tab. Nothing is uploaded." Buttons:

- A solid `<button data-choose>` "Choose a notebook" with the upload icon. It does not use the hero's `.ask` class, which `about.ts` looks up on its own.
- A default "See the demo" (`./?url=cooling-coffee.ipynb`).
- A quiet "The full comparison →" (`compare/`).

Today's footer follows.

### Phones

Every split stacks, prose first. The figures go 2 × 2. The teaser, the three privacy cards and the two speed cards stack. The routes stack as on `/compare/`.

### Markdown copy

`site/home.md` follows the new order, one bullet per section, in prose without figures (as today, since no facts are filled into it), plus "Compared with nbviewer, GitHub, Colab, JupyterLab and VS Code: [the comparison](compare/index.md)." `index.md` stays `home.md` plus the FAQ.

### First-screen budget

`index.html` and what it loads count toward the 30,000-byte budget, so every byte added here is a first-screen byte.

- **Today:** the live homepage reports 15 KB (read on 2026-10-29).
- **Markup, measured on `home-v3`:** the new `#how` gzips about 3 KB larger than today's (`index.html` source 5.8 → 8.7 KB gzipped), plus about 0.5 KB for the sprite. By section: demos 1.25 KB, everything else 0.88, your file 0.77, Markdown 0.62, compared 0.53, speed 0.49, safety 0.26, close 0.14, questions 0.13.
- **Styles:** the shared components add an estimated 2.5 to 3.5 KB gzipped to `about.css`, less the `.block` and `.keys` rules.
- **Expected:** `core` about 21 to 22 KB, still well under 30.

If the build shows the homepage adding more than 8 KB, the demos leave the homepage first (they are the heaviest, and `/compare/` keeps them). The budget is not raised, and no styles are deferred behind script: the page publishes its own first-screen figure, and that figure must stay true.

## Visual language

- Tokens are the landing page's (`src/about/about.css`): `page`, `paper`, `well`, `well-2`, `sunk`, `fg` to `fg-3`, `line`, `line-2`, `lift`, `dip`, `glass`, Inter and JetBrains Mono from `/fonts/`.
- New tokens, defined in `about.css` on `:root` for both themes, used by both pages:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--tick` | `#1a8cd8` (3.63:1 on paper) | `#1d9bf0` (5.77:1 on paper) | yes glyph, chip outline |
| `--tick-ink` | `#1470b8` (5.20:1 on paper, 4.69:1 on `--tick-soft`) | `#1d9bf0` | blue text: captions, "Reads", "Only here" chip |
| `--tick-soft` | 9% `--tick` in paper | the same mix | our header cell, our lane, our card |
| `--ring` | 34% `--tick`, transparent | the same mix | hairlines around ours |
| `--part` | `#86868f` (3.61:1 on paper) | `#74747e` (3.74:1 on paper) | partly glyph |

  `--tick-ink` and the darker `--part` correct two contrast failures in the approved mockup: blue caption text at 3.6:1 and a grey glyph at 2.1:1. The look barely changes.
- The landing page's `--ran` green goes. Its four uses take the tick: the "here" arrow (`.here .arrow`) and the outlined node (`.node.box`) use `--tick`, the first chart bar (`.row.first .track i`) uses `--tick`, and the stream scale's label (`.scale span:nth-child(2)`), which is text, uses `--tick-ink`. The green in the logo mark is the mark's own and stays.
- DESIGN.md gains one line under Colour: "The homepage and the comparison page add one exception: a verified-tick blue (`tick`, with `tick-ink` for text) marks what is ours: its small glyphs, the hairline round its own column, card or lane, its captions, and at most a 9% tint behind them. Never in the app."
- Every shared component's rules sit under its own root class (`.jobs`, `.figs`, `.teaser`, `.demos`, `.routes`, `.editor`). None styles a bare class the app or the guides already use (`.doc`, `.cell`, `.tbl`, `.exc`). `about.css` is switched off when a notebook opens (the `#landing` link), but the guide pages load it too.
- No gradients and no new shadows. The edit bar in the Markdown picture uses `glass` and the existing `float` shadow.
- Type: H1 58px (38px on phones). H2 40px (28px), weight 700, −0.032em, `text-wrap: balance`. Ledes 17px, `fg-2`, `text-wrap: pretty`. Figures 34px weight 600 (26px on phones), tabular. Table 14px. Captions 12 to 13px.
- Radii: sheets 22 to 24px, cards and figures 18 to 20px, panes 16px, lanes 16px, pills 999px.
- Dark mode: the mark (a dark rounded rectangle) gets a 1px `--line-2` outline so it holds on dark paper.
- Motion: sections use `.reveal`. Demo states crossfade with opacity over 160ms on the default easing. Chips and the switch use the app's hover (8% of their text colour) and press (scale 0.97). Nothing runs longer than 300ms. Reduced motion turns all of it off.

## Accessibility

- The table has a visually hidden `<caption>`; headers use `scope`. Glyph SVGs are `aria-hidden`, and each cell starts with visually hidden "Yes:", "Partly:" or "No:".
- The picker layout changes `display` on table parts, which drops table semantics in some browsers, so the table carries explicit `role` attributes (`table`, `row`, `columnheader`, `rowheader`, `cell`).
- Chips are real radios in a fieldset with a legend; arrow keys move between them. Focus shows the app's ring (2px, 60% of `fg`, 2px offset) on the chip via `:has(:focus-visible)`.
- Every control is 44px tall on coarse pointers.
- Colour never carries meaning alone: every glyph has a word beside it.
- `forced-colors: active`: glyphs fall back to `CanvasText`, and the ring becomes a 1px `CanvasText` outline.
- Anchors land below the sticky header (`scroll-margin-top`).

## SEO, answer engines and the Markdown copy

- Title: "ipynb viewer compared with nbviewer, GitHub, Colab, JupyterLab and VS Code". Description: "A side-by-side comparison of six ways to open a Jupyter notebook: where the file goes, whether code runs, offline use, reading, sharing and editing, including Markdown files." Canonical and Open Graph tags come from `tools/site.mjs` as today.
- `compare/index.md` and the compare part of `llms-full.txt` are the rendered Markdown: the prose, then one GFM table per group with cells such as `Yes: In your browser`, then a notes list per group with each detail and its source link. Figures are filled. The editor picture is left out.
- The visible H1 is shorter than the title; the title keeps the names for search.

## Print, performance, robustness

- **Print:** controls are hidden, all thirty rows show regardless of the filters, detail rows stay closed, and each demo prints all three states one after another. `.reveal` is already neutralised for print.
- **Performance:** the page is static HTML and CSS: no script beyond the theme, no images beyond the mark, fonts already cached by the app. The first-screen budget applies to `index.html` and is unchanged; the homepage's share is under Homepage, "First-screen budget". `compare.css` loads only on `/compare/`, so the matrix's styles never reach the first screen.
- **No horizontal scroll at 320px:** pre blocks scroll inside their pane, chips and lane nodes wrap between items, phrases are bounded by the width check.

## Coordination

The sibling branch `notebook-ui-controls-polish-1f7925` landed on main as 2.1.0 (#32) and is merged into this branch (ca63cc3). What it changed that this work builds on:

- `pages()` renders the guides in the dev server too (`render(guide(slug), sheets)`), so the compare page's renderer is called from both the build and the middleware.
- `site/privacy.md` is gone; its steps and the relay's description now live in `site/faq.md`, and `/privacy` redirects home. Links that went to the privacy guide go to the homepage's `#privacy` and `#offline`.
- The FAQ renders as numbered `<details>`, and the guide header is a floating 44px pill.

## Out of scope

- Opening Markdown from a link (an app change, for its own task).
- Changes to other guide pages, and to the homepage's hero, head and JSON-LD.
- The comparison table on the homepage (tried and rejected).
- Structured data for the compare page.
- Automated tests. The build-time checks are part of the renderer, not a test suite.

## Manual checks

The smallest set worth a look once it is built:

- `npm run build` passes the data and width checks. Read `dist/compare/index.md` once. Compare its "first screen" line with the 15 KB of today.
- The homepage at 1440, 1024, 375 and 320px, in light and dark: no sideways scroll, the figures' links land on their sections, the closing button opens the file picker, and opening a notebook still clears the homepage and switches its stylesheet off.
- The page at 1440, 1248 (just above the table's switch), 1200 (just below), 1024, 375, 360 and 320px, in light and dark: no wrapped verdict, no sideways scroll.
- Keyboard through the chips, the switch, a row toggle and the rival picker. VoiceOver reading a row in the picker layout.
- The rival picker in Safari (iOS) and Firefox, and the switch between layouts around a 1200px container. If it does not restyle on change, switch to the radio fallback.
- Print preview.
- No CSP errors in the console.

## Risks

- **Rival facts age.** The stamp, the per-row sources and the issue link limit the damage; the date lives in one place.
- **`select` and `:has()`.** Restyling on `option:checked` is expected in current Chromium, Safari and Firefox but is checked by hand; the radio fallback is specified.
- **First-screen growth.** The published `core` figure rises from about 15 KB to about 21 to 22 KB. It stays well under budget and "Small on purpose" stays true; the fallback order is under Homepage.
- **Shared components.** A change to `jobs`, `figures`, `demos`, `routes` or `editor` shows on both pages. That is the point, but check both when one changes.
- **Width table drift.** If Inter is updated, `tools/widths.json` must be measured again; until then the check can be off by a pixel or two, and the budgets leave about 3px of slack in the tightest column.
