---
title: ipynb viewer design language
description: The colours, type, shapes and motion behind ipynb viewer, as plain tokens that a designer or an assistant can reuse.
---

# ipynb viewer design language

A notebook reader should disappear. The interface is neutral and calm so the notebook, someone else's work, is the only thing with character. The same rules are kept in [DESIGN.md](https://github.com/ashwingopalsamy/ipynb-viewer/blob/main/DESIGN.md) in the repository.

## Colour

Three tones and one ink. `page` is the window, `paper` is the sheet being read and `well` is the recess under code. There is no brand colour: the blue is for links, and green, amber and red mean state and nothing else.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `page` | `#f5f5f7` | `#0a0a0c` | The window |
| `paper` | `#ffffff` | `#1a1a21` | The sheet, dialogs, cards |
| `well` | `#e6e8ef` | `#272833` | Under inline code and key caps |
| `fg` | `#1d1d1f` | `#f5f5f7` | Text, solid buttons |
| `fg-2` | `#48484a` | `#cfcfd4` | Secondary text |
| `fg-3` | `#636368` | `#9a9aa1` | Icons, notes, line numbers |
| `accent` | `#0066cc` | `#4da3ff` | Links |
| `ok` | `#1d8a4a` | `#4cc38a` | Ready, success |
| `wait` | `#b26b00` | `#f0b44c` | Pending |
| `danger` | `#b3261e` | `#ff7b72` | Errors, secrets |

Light and dark share every token. Dark drops drop-shadows and adds a one-pixel top highlight instead.

## Type

Inter for words and JetBrains Mono for code, both served from the same origin. Prose is 16px at a line height of 1.6. Interface text runs from 11px to 15px, headings are weight 600 with a tracking of -0.01em, and figures are 34px.

## Shape and depth

Controls are pills. Surfaces are rounded rectangles: 18px for popovers, 22px for dialogs, 14px for tiles, 10px for grouped rows and 6px for key caps. The header floats as glass pills with a blur behind them, and the notebook rests on paper.

## Space

A 4px base with steps of 4, 8, 12, 16, 20 and 24. Rows are 44px, controls 32px and buttons 36px, and both grow to 44px on a touch screen. The reading column is 1120px wide, or 760px narrow and 1720px wide.

## Interaction and motion

Every control hovers the same way, with a wash of its own text colour at 8%. Pressing scales it to 0.97. Focus is a two pixel ring, always visible. Nothing runs longer than 300ms, only transform and opacity move, and reduced motion is respected.

## Voice

Plain and short, verbs first, sentence case, with the product name in lowercase. The privacy promise comes early: the file never leaves your browser and no code runs.
