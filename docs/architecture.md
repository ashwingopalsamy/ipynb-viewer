# How it works

A notebook is a JSON file. The viewer turns it into a page without a kernel or a server.

## Reading the file

The parser in `src/lib/notebook/` reads the file as a stream, so the first cells appear before a large notebook has finished loading. It accepts nbformat 3 and 4 and normalises both into one shape.

Real notebooks are not always valid JSON. The parser repairs what some writers emit, like `NaN` and trailing commas, and a file cut off halfway still shows every complete cell with a note about the rest.

## Drawing the page

Each cell renders on its own. Markdown goes through `marked` and then DOMPurify; math is typeset by KaTeX when a cell contains some. Code is highlighted by Shiki with its JavaScript engine, one grammar at a time, so there is no WebAssembly to download.

Outputs are matched by MIME type. Images show as they are, with a light plate behind transparent plots in dark mode. HTML outputs are reduced to table markup; anything else falls back to its plain text. [SECURITY.md](../SECURITY.md) explains why.

## Staying small

The core of the reader, script and styles, is held under 30 KB gzipped. Highlighting, math, the chapter rail, screenshots and live refresh are separate chunks that load the first time they are needed. Fonts are self-hosted Latin subsets, with italics loaded on demand.

## Editing

The editor is not part of the first load. After the first paint the page fetches it when idle (not on a connection that asks to save data), and a double-click waits for it if it has not arrived. A cell is drawn in blocks while editing is possible, so a block that is open is the only part that is live. Closing it commits the block's new markdown into the cell's source if the cell still holds what the edit began from, and a cell that changed underneath is left alone. Saving does not rebuild the notebook: it patches the edited cells' source into the original file text (`src/lib/edit/nbsplice.ts`), so outputs, ids, metadata and the file's own formatting are kept byte for byte. Undo is a stack of those commits.

## Tabs

The first notebook is read by the top page, as ever. Each further notebook runs the same reader in a frame of that page (`index.html?tab=t1`), laid over it with only the active one showing. Frames are there because a page can only ever tighten its Content Security Policy, so one that has shown a notebook can never fetch a link, and because the reader keeps its state (search, folds, edits, the network choice) in singletons that can safely hold one notebook each. The tab host (`src/lib/tabs/host.svelte.ts`) loads when a second notebook opens; the first screen carries only a small state module. A frame says `hello`, is sent its file or link, and then reports its name, status and unsaved edits, while the host sends every page the tab list to draw. Messages go to and are accepted from this origin only, and the host knows a frame by its window, never by an id inside the message. Only the web addresses of open link tabs are written to `sessionStorage`, which is how a reload brings them back; files are not kept. The build prints the first screen's size and fails above 30,000 bytes gzipped.

## Keeping state

Settings and the theme live in `localStorage` and are applied before the first paint, so the page never flashes the wrong theme. Pages of the app follow a change made in any other through the `storage` event. Nothing about the notebook itself is stored, apart from where you stopped reading.

## Exporting

Cell screenshots and figure exports are drawn on a canvas in the page. No image service is involved.

## Offline and the network

The home page is the app: `index.html` shows the landing page until a notebook is opened, and the reader then takes its place. A small service worker, `tools/sw.template.js`, is filled in at build time with every file the app can ask for, so after the first visit opening a notebook makes no request at all. It never calls `skipWaiting`, so a new version takes over on the next visit and never swaps files under a notebook you are reading. The build leaves out source maps, the `.woff` and `.ttf` font fallbacks and the share image, which keeps the copy under 1 MB gzipped.

Once a notebook is open the page narrows its own Content Security Policy. A policy can only be tightened at runtime, so the order is fixed: connections are shut first, and pictures from the web stay blocked until a card asks. The Privacy sheet reads the browser's resource timing and policy violation events, so its count is the browser's, not ours.

The notebook sheet (`src/lib/insight/`) works on the parsed cells and is loaded only when it is opened. A notebook in a link is deflated and written into the fragment, with the pictures dropped first and the outputs next when it would be too long.
