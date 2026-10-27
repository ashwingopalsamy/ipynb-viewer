# Continuous editing: one click or one arrow moves the editor

Branch `feat/markdown-wysiwyg-editor-d40a96`. Edit mode is a state, not a gesture: double-click enters it from reading;
once an editor is open, a single click on any text block (this cell or another) commits the open editor and opens the
clicked block with the caret where the click landed, and ArrowUp/Down on a cell's first/last line goes on into the text
cell above/below, past any code. Esc, Done, and a click on anything that is not text end it, as before.

## Decisions

1. **Every primary press is judged on release, not on press.** `BlockEditor` records the press on `pointerdown` and
   decides on `pointerup`: a click (moved < 5px mouse/pen, < 16px touch, no selection made outside the editor) on text
   hands off; anything else commits. Judging on press had a real bug, old and new: the closing editor changes the page's
   height, so a link or button below it moved before the release and the click was lost (seen live: a link under a task
   list opened as source). `pointercancel` commits for a mouse (a drag of text or a picture began) and leaves the editor
   open for a finger (a scroll), as before. Right and control clicks still commit on press: their menu can keep the release.
   `leave` (blur) defers to a pending press, so a press commits once.
2. **What a click opens is resolved in the editor, opened by the target cell.** `text(t, y)` maps the press target to a
   block (`[data-b]`), the empty-cell placeholder, the whole cell when it is not drawn in blocks, or, for a press on the
   cell around/between blocks (gaps, gutter, padding), the nearest block by vertical distance. If the nearest is the open
   editor, the caret goes back into it (no commit). Links, `summary` and sortable `thead th` are controls: never handed off.
   The editor commits with `Follow { to: 'cell', cell, ask }`; `done()` dispatches the existing `edit` event to that cell
   only when the commit was accepted, and skips its focus restore. The cell's `begin` does the rest.
3. **Identity, not coordinates.** `begin` reads the target block's start offset in the source before the commit is drawn;
   the editor passes `moved(s)`: in the same cell, text after the edited span moves by `next.length - source.length`
   (exact, unlike a prefix/suffix diff, which mis-maps repeated text). After `await tick()` the block is found by start.
4. **The click point is relative to the block's box**, not the page. Found live: a heading opened by double-click put the
   caret at the end, because the editor mounts without the contents list's `data-h` room (56px higher) until the next
   frame. `place()` adds the point to the editor's own box, so the transient does not matter.
5. **The clicked block stays where it was clicked.** `begin` passes the block's screen top; the editor, once the page is
   drawn for the frame (after the contents list's marks), scrolls by how far the block moved, then reveals. Measured: a
   heading below a closing formula editor stayed at 583px while the page above shrank 89px. `reveal` moved into the same
   deferred step, which also fixes the double-click jump when a heading near the top was revealed in its transient place.
6. **No frame between the two editors.** The hand-on skips `ensureBase` (the editor before read the file; nothing reads
   it again while one is open): its dynamic import crossed a task, and a frame could show neither editor (probe: toolbar
   absent at `setTimeout(0)` before, present after). Toolbar `gone` keeps it from rising again; the card's lift is tied to
   the toolbar's `.rise`, so it only animates as editing begins and simply moves between cells.
7. **Arrows across cells** use the same hand-on with `edge` instead of a target. A cell not drawn yet (more than 1200px
   away) is drawn on demand from a module-level renderer reference (no import wait). A point out of the window finds no
   text, so `place()` first scrolls just far enough to show the target line, which also keeps the column within a cell.

## Edge cases

| Case | Outcome |
|---|---|
| Drag-select in another block while editing | fix: commits on release, selection kept (verified) |
| Link click while editing, editor above changes height | fix: navigates (verified with a hash link) |
| Double-click out of habit while editing | first click hands off, second selects a word in the new editor (verified) |
| Same-cell target after the edited block, block count changed (new paragraph committed, block removed) | fix: found by start offset (verified both) |
| Commit refused (cell changed underneath) | nothing opens, clipboard notice kept, focus restored (by reading; not reproducible with `?url=`) |
| Block not found after commit | nothing opens, focus on the target cell |
| Math formula | opens as source with the caret on its TeX (verified) |
| Table, code, task list, blockquote | open as source, caret at start, as on double-click (verified table, code) |
| `summary`, sortable table header | treated as controls: commit, then their own action (verified summary) |
| Empty-cell placeholder | opens the new paragraph (verified click and arrow) |
| Cell drawn whole (raw HTML) | opens whole as source (verified click and arrow) |
| Text cell not drawn yet | click: not possible (only far off screen); arrow: drawn and opened (verified) |
| Gap between blocks, gutter, cell padding | fix: nearest block, or back into the open editor (verified) |
| New paragraph with nothing typed: arrows | fix: passed over to the block or cell beyond; an empty cell was a dead end (verified) |
| New paragraph with text: arrows | leave: no navigation, as before (its commit would renumber blocks) |
| Code cell, outputs, page margin, header, contents rail | commit and end (verified code cell, margin) |
| Esc, Done, Alt+F10 | unchanged (verified) |
| Undo after a hand-on | one step per commit (verified) |
| Touch tap | `preventDefault` on the tap's `pointerdown` so the emulated mouse press cannot take focus from the new editor; not verified on a real touch device |
| iOS keyboard across the hand-on | leave: unverified; focus moves in the same task as the tap |
| Release never delivered (rare scrollbar drags) | leave: blur commit waits for the next press |
| Tall source editor revealed by its bottom | leave: existing `reveal` behaviour |

## Verified

Chromium pane, desktop 1024 and phone 375 (mouse events), dark theme. Not verified: Safari, Firefox, real touch.
The pane runs `requestAnimationFrame` about every 600ms, so checks waited for frames; a fast second click there can
land before the contents list re-marks a heading (not reachable at a real frame rate).
