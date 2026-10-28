---
name: ipynb viewer
description: Jupyter notebooks, without Jupyter. A neutral, quiet frame around someone else's work.
colors:
  page: { light: "#f5f5f7", dark: "#0a0a0c" }
  paper: { light: "#ffffff", dark: "#1a1a21" }
  well: { light: "#e6e8ef", dark: "#272833" }
  well-2: { light: "#f3f4f8", dark: "#20212a" }
  fg: { light: "#1d1d1f", dark: "#f5f5f7" }
  fg-2: { light: "#48484a", dark: "#cfcfd4" }
  fg-3: { light: "#636368", dark: "#9a9aa1" }
  line: { light: "rgba(0, 0, 0, 0.09)", dark: "rgba(255, 255, 255, 0.1)" }
  line-2: { light: "rgba(0, 0, 0, 0.16)", dark: "rgba(255, 255, 255, 0.2)" }
  glass: { light: "rgba(255, 255, 255, 0.86)", dark: "rgba(34, 34, 38, 0.84)" }
  accent: { light: "#0066cc", dark: "#4da3ff" }
  danger: { light: "#b3261e", dark: "#ff7b72" }
  ok: { light: "#1d8a4a", dark: "#4cc38a" }
  wait: { light: "#b26b00", dark: "#f0b44c" }
typography:
  sans: Inter, -apple-system, system-ui, sans-serif
  mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace
  body: { size: 16px, line-height: 1.6, weight: 400 }
  cap: { size: 11px, weight: 600 }
  xs: { size: 12px }
  sm: { size: 13px, weight: 500 }
  md: { size: 14px, weight: 600, tracking: -0.01em }
  lg: { size: 15px, weight: 600, tracking: -0.01em }
  num: { size: 34px, weight: 600 }
  code: { size: 13.5px, family: mono }
spacing: { s1: 4px, s2: 8px, s3: 12px, s4: 16px, s5: 20px, s6: 24px, row: 44px, ctl: 32px, btn: 36px, measure: 1120px }
rounded: { key: 6px, group: 10px, tile: 14px, sheet: 18px, dialog: 22px, pill: 999px }
motion: { fast: 100ms, base: 160ms, slow: 220ms, max: 300ms, ease: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
---

# ipynb viewer: design language

A notebook reader should disappear. The interface is neutral and calm so the notebook, someone else's work, is the only thing with character. Source of truth: `src/app.css` (tokens) and `src/lib/ui.css` (controls). The same tokens are published at [/design/](site/design.md).

## Colour

- Three tones, one ink: `page` is the window, `paper` the sheet being read, `well` the recess under code. Text steps `fg`, `fg-2`, `fg-3`; `fg-3` still passes 4.5:1 on `paper`.
- There is no brand colour. `accent` is for links and the unread dot only. `ok`, `wait` and `danger` mean state and nothing else. Never fill a large area with a hue.
- Light and dark share every token and switch on `data-theme="dark"`. Dark drops drop-shadows and adds a 1px top highlight instead.

## Typography

Inter for words, JetBrains Mono for code, both variable, Latin only, served from the same origin (the app makes no outside requests). Prose is 16px at 1.6. UI text runs 11 to 15px; headings are 600 with -0.01em tracking. Figures are 34px.

## Shape and depth

- Controls are pills (`999px`). Surfaces are rounded rectangles: popovers 18px, dialogs 22px, tiles 14px, grouped rows 10px, key caps 6px. `corner-shape: squircle` where supported.
- Glass floats, paper rests. The header and dock are `glass` pills with a `float` shadow and a 22px backdrop blur. Content rests on `paper` with `lift` (light) or the `edge` highlight (dark).

## Layout

A 4px base (`s1` to `s6`). Rows are 44px (56px with a second line), controls 32px, buttons 36px; both grow to 44px on touch. The reading column is 1120px, 760px narrow, 1720px wide. One left edge: a sheet's 8px padding plus a row's 12px inset puts every label 20px in.

## Interaction and motion

- One hover for every control: a fill of its own text colour at 8% (14% pressed). Press scales to 0.97.
- Focus is a 2px ring at 60% of `fg`, 2px offset, always visible.
- `{` `}` step through the open tabs and `W` closes the one you are reading, like the other single keys.
- Nothing runs longer than 300ms and only transform and opacity move. Default easing is `cubic-bezier(0.2, 0.8, 0.2, 1)`; popovers overshoot slightly. Honour `prefers-reduced-motion`.

## Components

Button (`.btn`: solid, default, quiet), Segmented (`.seg`), Switch (`.sw`), Pill (`.pill`, the glass header). Tabs (`.tb`) take the name pill's place once a second notebook opens: a chip per notebook, a count button when the chips no longer fit, and on a phone only a list. Icons are Lucide-style lines, 16px at stroke 1.9, `currentColor`, `fg-3`; the active tool is filled.

## Voice

Plain, short, verbs first, sentence case, lowercase product name. Say the privacy promise early: the file never leaves your browser and no code runs. No exclamation marks, no emoji.

## Do and don't

- Do reuse a token; don't introduce a hex value.
- Do let state colours mean state; don't decorate with them.
- Do keep new controls pill-shaped and 44px on touch; don't add a second hover style.
- Don't add gradients, new shadows or outside font requests.
