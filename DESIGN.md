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
- Charts use one fixed categorical set (blue, orange, aqua; each stepped for light and dark and checked for colour-blind separation on the paper), for data marks only. Colour follows the thing measured, never its rank, and every mark has a label, so colour is never the only cue.
- The homepage and the comparison page add one exception: a verified-tick blue (`tick`, with `tick-ink` for text) marks what is ours: its small glyphs, the hairline round its own column, card or lane, its captions, and at most a 9% tint behind them. Never in the app.

## Typography

Inter for words, JetBrains Mono for code, both variable, Latin only, served from the same origin (the app makes no outside requests). Prose is 16px at 1.6. UI text runs 11 to 15px; headings are 600 with -0.01em tracking. Figures are 34px.

## Shape and depth

- Controls are pills (`999px`). Surfaces are rounded rectangles: popovers 18px, dialogs 22px, tiles 14px, grouped rows 10px, key caps 6px. `corner-shape: squircle` where supported.
- Glass floats, paper rests. The header and dock are `glass` pills with a `float` shadow and a 22px backdrop blur. Content rests on `paper` with `lift` (light) or the `edge` highlight (dark).

## Layout

A 4px base (`s1` to `s6`). Rows are 44px (56px with a second line), controls 32px, buttons 36px; both grow to 44px on touch. The reading column is 1120px, 760px narrow, 1720px wide. One left edge: a sheet's 8px padding plus a row's 12px inset puts every label 20px in.

## Interaction and motion

- One set of states for every control, as tokens: a fill of its own ink at 8% under the pointer (`--hover`), 12% while it is chosen or its card is open (`--held`, 16% under the pointer), 14% while held down (`--press`). Press scales a control to 0.97 (`--press-scale`) and a large surface, a tile or the drop area, to 0.985.
- Focus is a 2px ring at 60% of `fg`, 2px offset. It belongs to the keyboard: Tab, or an arrow moving through a list, shows it, and a click or a tap never draws it.
- `{` `}` step through the open tabs and `W` closes the one you are reading, like the other single keys.
- Four timings, by what moves: `--t1` 100ms for feedback (hover, press, a cap or a cross changing), `--t2` 160ms for fades and every exit, `--t3` 220ms for movement and entrances, `--t4` 300ms for the largest moves. A raw duration in a stylesheet is a bug; only loops (a spinner, a heartbeat) and choreographed delays keep their own. Entrances ease out (`--out`, or `--pop` to overshoot slightly), exits ease in (`--in`), springs back from a press use `--rel`. Nothing runs longer than 300ms and only transform and opacity move. Honour `prefers-reduced-motion`.
- Spacing is measured by what is painted: in a pill, the first and last glyph sit about 15px from its ends, set by the round 36px tools, so a field's icon and its key cap, or a tab's mark and the `+`, sit at the same distance from their ends.

## Components

Sheets (`.set`) hold rows on the sheet itself, never in grey boxes that would read as a notebook's cells: a caps label and a hairline part the sections, a row that acts fills under the pointer, and only code keeps its well. Button (`.btn`: solid, default, quiet), Segmented (`.seg`), Switch (`.sw`), Pill (`.pill`, the glass header). The header is two mirrored pills: on the left what is being read, on the right what can be done. The left pill (`.tb`) holds a chip per open notebook and ends with `+`; a chip's close has its own slot at the end (× on the chip being read and under the pointer, else the unsaved dot), so its icon never changes; past the room it has, the chips scroll with fading ends and a count button lists them all, and on a phone only that list shows. On a wide window the middle holds the search field, centred on the window, which steps aside while reading down. The dock on the right keeps its always-present tools still: the ones only some notebooks have sit at its left, and hairlines part the groups. A card hung from either pill shares that pill's edge. Icons are Lucide-style lines in `currentColor`, `fg-3`, every one drawn with the same 1.3px line on screen whatever its size (`--stroke`, a non-scaling stroke); a tool whose card is open, or that is pressed, is filled.

## Voice

Plain, short, verbs first, sentence case, lowercase product name. Say the privacy promise early: the file never leaves your browser and no code runs. No exclamation marks, no emoji.

## Do and don't

- Do reuse a token; don't introduce a hex value.
- Do let state colours mean state; don't decorate with them.
- Do keep new controls pill-shaped and 44px on touch; don't add a second hover style.
- Don't add gradients, new shadows or outside font requests.
