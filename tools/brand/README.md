# Brand

The scripts that draw the images in `.github/assets/` and the example notebook. Everything is drawn from the app itself, with its own fonts and real screenshots of the reader.

## What is drawn

| File | Made by |
|---|---|
| `wordmark-light.svg`, `wordmark-dark.svg` | `wordmark.py` |
| `tag-*.svg` | `tags.py` |
| `hero-light.png`, `hero-dark.png` | `hero.py`, then `draw.mjs` |
| `social-preview.png` | `social.py`, then `draw.mjs` |
| `examples/cooling-coffee.ipynb` | `notebook.py` |

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
