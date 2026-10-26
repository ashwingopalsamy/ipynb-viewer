# Keyboard

Single keys act on the cell you are reading. They stay quiet while you type, and settings can switch them off.

| Key | Does |
|---|---|
| `j` `k` | Next or previous cell |
| `[` `]` | Previous or next heading |
| `x` | Open or close this cell |
| `c` | Show or hide code |
| `o` | Show or hide outputs |
| `s` | Save the cell as an image |
| `f` | Trace the selected name |
| `n` `p` | Next or previous cell that uses it |
| `t` | Contents |
| `e` | Edit this cell (notebooks opened from a file) |
| `m` | Copy as Markdown |
| `i` | Notebook sheet: secrets, requirements, weight |
| `/` | Search the notebook (also `⌘K` or `Ctrl K`) |
| `?` | This list |
| `esc` | Close a popover or a picture |

## Editing

A notebook opened from a file on your computer can be edited in the text cells: double-click a paragraph, heading or list and write. Code and outputs are never touched. A notebook opened from a link is read-only.

| Key | Does |
|---|---|
| double-click | Edit that block in place |
| `e` | Edit the first block of the cell you are reading |
| `⌘B` `⌘I` `⌘E` `⌘K` `⌘⇧X` | Bold, italic, code, link, strikethrough (or select text for the toolbar) |
| `Enter` | Split the paragraph or heading here; at the end, start a new one |
| `⇧Enter` | Line break inside the block |
| `↑` `↓` | At the first or last line, move to the neighbouring block |
| `⌫` `Del` | At the start or end, join the neighbouring paragraph |
| `⌘/` | Switch the block between writing and its markdown |
| `esc` or `⌘Enter` | Finish the block |
| `⌘Z` | Undo while writing; after the block is finished, undo it |
| `⌘S` or the Save button | Save into the file; `⇧` with either saves a new file instead |

Edits are visible everywhere on the page (Contents, Search, Copy as Markdown, share links) before they are saved. Saving changes only the text of the cells you edited; outputs and pictures stay as they were. If the file changed on disk after you started editing, your edits go to a new file, `name (edited).ipynb`, and the original is left alone. Browsers that cannot write files offer a download instead.
