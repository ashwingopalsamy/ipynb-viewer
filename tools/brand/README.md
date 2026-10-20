# Brand

The scripts that draw the images in `.github/assets/` and the example notebook. Everything is drawn from the app itself, with its own fonts and real screenshots of the reader.

## What is drawn

| File | Made by |
|---|---|
| `wordmark-light.svg`, `wordmark-dark.svg` | `wordmark.py` |
| `tag-*.svg` | `tags.py` |
| `hero-light.png`, `hero-dark.png` | `hero.py`, then `draw.mjs` |
| `social-preview.png` | `social.py`, then `draw.mjs` |
| `examples/cooling-coffee.ipynb`, `public/cooling-coffee.ipynb` | `notebook.py` |

Text in the SVGs is set as outlines with HarfBuzz, so it looks the same wherever GitHub shows it. The green dot over the i is the reader's own status dot, the one beside every cell that ran.

## Colours

| | Light | Dark |
|---|---|---|
| Ink | `#1d1d1f` | `#f5f5f7` |
| Page | `#f5f5f7` | `#0a0a0c` |
| Ran | `#1d8a4a` | `#4cc38a` |
| Accent | `#0066cc` | `#4da3ff` |

## Redraw

```sh
python3 -m pip install fonttools brotli uharfbuzz matplotlib numpy pandas
npm install --no-save playwright
npx playwright install chromium
tools/brand/build.sh
```

`notebook.py` runs the example's code once, here, to fill in its outputs. The viewer never does.

## The demo notebook

`cooling-coffee.ipynb` is also the demo behind **Open Demo** on the landing page (`?url=cooling-coffee.ipynb`, served from `public/`, kept out of the offline precache). `notebook.py` runs every code cell once, in order, so the outputs are real; the progress bar, the traceback and the `%pip` line are recorded in the shape Jupyter writes them. Regenerating gives a byte-identical file.

`src/lib/notebook/demo.test.ts` checks each row below with the viewer's own functions.

| Feature | Where in the notebook |
|---|---|
| Contents rail, chapter chip | H1, six H2s and H3s |
| Math | Opening equation, an `align` block, inline symbols |
| Markdown table, task list, quote | "The model" |
| Syntax highlighting | Python cells; `bash` and `sql` fences at the end |
| Figures shelf, save as image | Four PNGs: overview, fit and residuals, heatmap, small multiples |
| Vector output | The thermometer SVG |
| Sortable table, copy CSV | `readings` (16 rows) |
| Printed frame becomes a table | `print(readings.head(10))` |
| Progress bar folds | The bootstrap cell |
| ANSI colour | The PASS and WARN report |
| Long output folds | The 31-line cooling log |
| Calm traceback | `readings["temp"]` raises `KeyError` |
| Markdown output | The "Drinkable after" line |
| Fold handles | The figure cells, the frame, the long listing |
| Insights: secrets, needs, weight | The made-up `SCALE_API_TOKEN`, the home folder in the traceback, `%pip install tqdm`, the pictures |
| Run order switch | Not shown: the cells ran in order |

Redraw it with `python3 notebook.py ../../examples/cooling-coffee.ipynb ../../public/cooling-coffee.ipynb`. The hero images and the file-size chip in `scenes.py` come from this notebook, so run `build.sh` after changing it.
