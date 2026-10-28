# Keyboard

Single keys act on the cell you are reading, except `c` and `o`, which act on the whole page. They stay quiet while you type, and settings can switch them off.

| Key | Does |
|---|---|
| `j` `k` | Next or previous cell |
| `[` `]` | Previous or next heading |
| `x` | Open or close this cell |
| `c` | Show or hide code in every cell |
| `o` | Show or hide outputs in every cell |
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
| `⌘O` or `Ctrl O` | Open a file |
| `↑` `↓` `Home` `End` | Move between the controls in the notebook, which is one Tab stop |

## Editing

A notebook can be edited in its text cells. Double-click a paragraph, heading or list and write, or press `e`, or use the pencil in the header. Code and outputs are never touched. A bar opens at the top for as long as a cell is open; the header stays, so Save, Save a copy and the pencil (Edit mode, pressed while editing, press it again to finish) are always at hand.

| Key | Does |
|---|---|
| double-click | Edit that block in place |
| `e` | Edit the first block of the cell you are reading |
| click | While editing, open any other text, in this cell or another |
| `↑` `↓` | At the first or last line, move to the neighbouring block, then on into the cell above or below |
| `⌘B` `⌘I` `⌘E` `⌘K` `⌘⇧X` | Bold, italic, code, link, strikethrough |
| `Enter` | Split the paragraph or heading here; at the end, start a new one |
| `⇧Enter` | Line break inside the block |
| `⌫` `Del` | At the start or end, join the neighbouring paragraph |
| `⌘/` | Switch the block between writing and its markdown |
| `Alt F10` | Move to the bar with the keys; `esc` goes back to the text |
| `esc` or `⌘Enter` | Finish the block |
| `⌘Z` `⇧⌘Z` | Undo and redo while writing; after the block is finished, take back or put back the edit |
| `⌘S` or the Save button | Save into the file |
| `⇧⌘S` or Save a copy | Save a new file instead |

Edits are visible everywhere on the page (Contents, Search, Copy as Markdown, share links) before they are saved, and the header and the tab title show a dot until they are. Saving changes only the text of the cells you edited; outputs and pictures stay as they were. A copy is saved where you choose, as `name (edited).ipynb`, in browsers that can write files, and downloaded in the others. If the file changed on disk after you started editing, your edits go to a new file and the original is left alone. A notebook opened from a link has no file to write to, so saving makes a copy.
