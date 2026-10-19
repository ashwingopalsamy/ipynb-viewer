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

## Keeping state

Settings and the theme live in `localStorage` and are applied before the first paint, so the page never flashes the wrong theme. Nothing about the notebook itself is stored, apart from where you stopped reading.

## Exporting

Cell screenshots and figure exports are drawn on a canvas in the page. No image service is involved.
