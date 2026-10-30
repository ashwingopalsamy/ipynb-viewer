# Changelog

Versions follow [semantic versioning](https://semver.org). Each release lists what a reader would notice.

## 2.5.0 (2026-10-30)

The home page shows its proof, and the comparison page is rebuilt to back it up.

- The comparison page is a table of thirty things, checked against nbviewer, GitHub, Colab, JupyterLab and, new, VS Code. Every verdict is a tick, a part tick or a dash with a few words beside it, on one line at every width. Rows are grouped by what you would ask; chips filter them, Only differences hides the row that is the same everywhere, and each row opens to its detail and the page it was checked against. Seven rows are marked Only here.
- On a phone the table shows this page against one other tool at a time, chosen from a menu, Colab first.
- The comparison also shows the same notebook read two ways (a printed DataFrame, a traceback, a progress bar), where each tool takes your file, which tool to choose for what, what this one does not do, and its sources with the month they were checked.
- The home page's "how it works" is rebuilt around the same proof: what kind of tool this is beside the others, four figures from the build, a card into the full comparison, the reading demos, where your file goes and how to check it yourself, why a notebook is untrusted input, what loads when and cells arriving while the file is read, and every feature with its key. Editing a notebook's Markdown cells comes second, right after the comparison.
- The questions sit in two columns on a wide window, and a long address in an answer wraps instead of running off a phone's screen.
- The comparison page and its Markdown copy for agents come from one data file, so they cannot disagree, and the build checks that every verdict has a source and fits its column.
- The home page's highlight is the same blue as the comparison's ticks.
- The first screen grows to about 24 KB gzipped, still under its 30 KB budget.

## 2.1.0 (2026-10-29)

A calmer header with search in its middle, pictures that save as PNG, JPEG or WebP, footers that lead somewhere, and the whole app moving and answering one way.

- The header is two pills. On the left is what you are reading, a chip for each notebook, and a `+` that opens another. The `+` is always a plus, with one notebook or many. On the right are the tools. The section heading in the middle of the header is gone, and so is the section line under the file name on a phone.
- Tabs size to their names, so short names are no longer cut short to make room. A long name loses its middle, not its end, cut to the width the tab has: two notebooks that start alike still read apart. Close has a place of its own at the end of each tab: always on the tab you are reading, on any other when you point at it, and the unsaved dot sits there until you do; the tab's icon never changes. One notebook on its own gets the same close, which takes you back home. The tab you are on looks the same width on every tab, and switching tabs no longer makes the row of tabs jump.
- Each tab shows what it holds, in a quiet line drawing: a notebook, a Markdown file or a link. The app's logo no longer repeats on every tab; it stands only in front of the app's own name, before a notebook is open.
- When the tabs no longer fit, they scroll with fading ends. The mouse wheel scrolls them sideways, and the tab you are on stays in view when the window changes size. `←` `→` move between tabs, `Delete` closes the one in hand, and the list of every tab names the site a linked notebook came from. A long list scrolls and opens on the tab you are on.
- A new tab no longer blinks the header empty while it loads: the page you are on stays until the new one has drawn its tabs, and the new tab slides in at once in the row you are looking at.
- On a wide window, search is a field in the middle of the header, centred on the window. It steps out of the way while you read down and comes back when you scroll up, as the page slows to a stop, or when the pointer comes up to the header. Enter and Shift+Enter walk through the matches, with a count, and `Esc` clears them. On a narrower window the search card is centred on the window too.
- The Open card puts choosing a file first, with `⌘O`, and a link second. Press `⌘V` while the card is open and a copied link opens, with no need to click the field.
- The tools keep still. The ones only some notebooks have sit at the left, hairlines part the groups, and a tool whose card is open is filled, on a phone too. Search no longer widens the tools, and no tooltip draws over an open card.
- Every sheet (Settings, the notebook sheet, Markdown, Privacy, Open, the picture dialog) sets its rows on the sheet itself, with no grey boxes around them that looked like the notebook's cells. Sections are parted by a hairline; only code keeps its grey well.
- The focus ring shows only while you move with the keyboard. A click or a tap, opening a card, or closing one with `Esc` no longer leaves a ring behind.
- Settings is sorted into Page, Code and Outputs, every row in line, with new page-width pictures. **Show code** and **Show outputs** are back, so the dot on Settings when code or outputs are hidden leads to a switch that brings them back. Privacy, Shortcuts and Home stay at the foot of the sheet when it scrolls.
- The home page says up front that Markdown files open too: a `.md` reads, and edits, like a notebook of one text cell. Installed as an app, it opens `.md` files as well as `.ipynb`.
- The questions on the home page are numbered and open one at a time. The privacy page is gone: what it said beyond the home page now sits in the questions (what happens with a link, what is kept, how to check it yourself), and old links to it go to the home page.
- The footer on the home and guide pages leads with Contribute on GitHub, then a row of links, each with its icon, and a line on who made it, in two even columns on a phone. A guide's footer leads home first. Under a notebook, the footer offers the app's home page and its source, each in a new browser tab so no open notebook is left, above the line on who made it.
- Every picture has Enlarge and Save under it, always in view rather than on hover, and Save offers PNG, JPEG or WebP at 1 to 3 times the size. The Figures sheet and the full-screen viewer have Save and Go to cell for each figure too. Long tables have Copy as CSV under them, in view.
- The notebook sheet's Weight shows where the size goes in colour: pictures, other outputs, and code and text, each with its share, and the heaviest cells in the colour of what makes them heavy.
- A long file name stays inside its tab and gives way with an ellipsis, at every width, reading or editing. While you edit on a window too narrow for the editing bar beside the tabs and tools, the tabs and the reading tools step aside until Done, as they already did on a phone.
- Near the end of a long notebook, Back to top takes you up to its title. At the very end it rides up with the footer and never covers it.
- Everything moves and answers the same way: every animation runs on one of four timings, every control has the same hover, chosen and pressed fills and the same press, and every icon is drawn with the same line at every size. The search field's icon and key cap sit the same distance from its two ends. A card that closes now fades out whole, rather than shrinking to an empty bar first, the tools keep their title until it has gone, and the button you just pressed does not pop its name up over it.
- A notebook that will not open offers Choose a file and Back to home, and for a link, what a good one looks like. Coming back to a notebook offers to continue reading where you stopped, naming the section.
- The heart in the footer is drawn whole and rests until you point at it. It used to fade on a loop, because another animation had taken its name.
- Fixed: on a window too narrow for the search bar's full width, opening Search could stop the page's controls from responding.
- Fixed: the "back to where you stopped" pill rose in the wrong way once the editor had loaded.

## 2.0.1 (2026-10-29)

New versions arrive with a reload.

- A new version of the app used to wait until every tab of the site was closed, so a reload kept the old one. Now, when the page is the app's only window, it reloads once into the new version as it opens, and tabs opened from a link come back. With other windows of the site open, nothing changes under them: the new version still waits for those to close.
- This takes effect from the next update on. To get 2.0.1 itself, close every tab of the site once more.

## 2.0.0 (2026-10-29)

Read several notebooks at once, each in a tab of its own.

- Opening a notebook while one is on screen now opens it in a new tab and switches to it, instead of replacing it. That holds for `⌘O`, the Open button, a file dropped on the page, and a link typed into the Open card.
- Choose, drop or open several files at once and each gets a tab. Open the same file or link again and its tab comes forward instead of a second copy opening.
- The tabs sit in the header where the file name was: a chip for each notebook, marked as a file or a link, with a ring while it opens, a dot for unsaved edits and a close button. When the chips no longer fit, a count button opens a list of them all, and on a phone that list is all there is. Close tabs down to one and the header goes back to the file name.
- `{` and `}` move to the previous and next tab, and `W` closes the one you are reading. Closing a tab with unsaved edits asks first.
- Every tab is a page of its own, so it keeps its own network lock, its own answer about web pictures and its own Privacy count. Search, folds, edits and the picture choice in one tab never reach another: allowing pictures in one still asks in the next.
- A notebook that will not open shows its error in its own tab and leaves the others as they were.
- Theme, text size, page width, single keys and the pictures mode follow you into every open tab and every other window of the app.
- Reload, and the tabs you opened from a link come back in order. Tabs opened from a file do not, because a file cannot be read again without you. Only the web addresses are kept, in the browser tab's own session; nothing about a notebook is stored. The address bar names the link you are on, and a link tab you closed does not return.
- `⌘P` inside a tab prints that tab's whole notebook.
- With one notebook open, nothing changes: the same header, title and address as 1.1, and none of the tab code loads.
- The build now fails if the first screen grows past 30,000 bytes gzipped.

Known limits: printing from the browser's menu prints only what is on screen in the tab you are on (use `⌘P` inside the tab for the whole notebook). There is no limit on the number of tabs, and each one is a page of its own with its own memory.

## 1.1.0 (2026-10-28)

Edit a notebook in the page, and save it back.

- Double-click a paragraph, heading or list to edit it where it stands, or press `e`, or use the pencil in the header. Code and outputs are never touched, and nothing runs.
- A bar for the open cell: undo and redo, bold, italic, strikethrough, code, link, paragraph, three heading sizes, lists, the markdown source of the block, and Done. It sits in the header's row, in place of the section name.
- Once a cell is open, one click on any other text opens it there, in this cell or another, with the caret where you clicked. A click that drifts a few pixels still counts as a click; a drag still selects. `↑` and `↓` at the first or last line carry on into the cell above or below, past code.
- Writes as you would expect: `Enter` splits a paragraph or starts a new one, `⌫` joins, `⇧Enter` breaks the line, `-`, `1.` and `#` start a list or a heading, pasted markdown becomes real blocks, a link pasted over a selection becomes a link.
- `⌘Z` and `⇧⌘Z` take back and put back an edit, from anywhere on the page, and the unsaved mark follows them.
- Save and Save a copy sit in the header beside an Edit mode button. Save writes into the file you opened and changes only the text of the cells you edited, so outputs, pictures and the file's own formatting stay as they were. Save a copy asks where to put `name (edited).ipynb`.
- Open a notebook from a link, edit it, and save it to your computer: it has no file to write to, so saving makes a copy. Browsers that cannot write files download it instead.
- Markdown files open and edit the same way.
- If the file changed on disk while you edited, saving goes to a new file and leaves the original alone. A reload, a new file or closing the tab warns while edits are unsaved, and the tab title shows a dot.
- Edits show everywhere on the page before they are saved: Contents, Search, Copy as Markdown and share links.
- The editor loads after the first paint, so the page opens as fast as before.
- On a phone the dock sits at the bottom of the screen instead of over the file name, and while editing it keeps Edit, Save and the theme.
- The footer credit has a beating heart and a face that appears on hover.
- The Notebook sheet now finds a key or token assigned to a name that ends in the word, such as `OPENAI_API_KEY = "..."`. It had passed over those, and the demo notebook's own made-up token with them.

## 1.0.0 (2026-10-21)

First public version.

- Link downloads are rate limited per IP, time out, and are capped by size as they stream; aggregate server-side counts of outcomes, with no addresses or identifiers.
- Extra response headers and a `security.txt`.
- Drop a `.ipynb` and read it, in light or dark.
- Streaming parser for nbformat 3 and 4 that opens damaged files where it can.
- Chapter rail and keyboard navigation.
- Figures shelf and cell screenshots.
- Live refresh in Chromium browsers when the file changes on disk.
- Search across text, code and outputs with `/` or `⌘K`, with each match marked in its cell.
- Click a figure to see it full size, and step through the others with the arrow keys.
- Markdown and LaTeX outputs are typeset, and widget or chart objects no longer show their text description.
- A file that will not open leaves the notebook you were reading, and `⌘O` or `Ctrl O` opens a file.
- Links in a notebook are blue and underlined.
- The page icon, a web manifest and a theme colour, so the page installs as an app, and a print layout for saving a notebook as a PDF.
- On a phone the controls sit in a dock at the bottom and the file name has the top bar to itself.
- Settings are grouped under named headings, with the less common options behind More, and the width control is a pill.
- Keyboard focus is shown with a neutral ring instead of the accent colour.
- The header lines up with the notebook column, and the section being read (the notebook's top-level heading) is named in the middle of it.
- Each cell's output sits in a recessed box, so it reads as the result of the code above it.
- After the first visit the app works offline: a worker keeps its own files on the device, so opening a notebook makes no request.
- Once a notebook is open the page shuts its own connections, and pictures from the web wait behind a card that says which sites they come from and what loading them tells those sites. Settings has a three-way choice (Ask, Never, Always) and a Privacy sheet that counts the page's requests.
- A link opened with `?url=` names the site and asks before it fetches.
- The home page is the About page, with the numbers behind the app, and the viewer lives at `/viewer/`. Links with `?url=` or `#nb=` opened on the home page go straight to the viewer, and the installed app starts there. The page shows the size of the first load and how fast a large notebook is read.
- A Notebook sheet (`i`) that scans for keys and tokens before you share, lists what the notebook needs to run with a ready `pip install` line, and shows which outputs weigh the most, with a copy saved without pictures or without outputs.
- Copy as Markdown can hold to a token budget, and hides secrets while that setting is on.
- Copy a link with the notebook inside it. The notebook travels in the part of the address after `#`, which no server receives, and the link opens it directly.
- Compare the open notebook with another version, cell by cell, outputs included.
- The header goes back to the window's edges, and the settings card spans exactly from the Open pill to the tools pill.
- The sheets under the header share one layout: pills and tiles that fit on screen without scrolling. Settings is a grid of switch tiles and the Notebook sheet is split into tabs.
- Search is a single pill, with the match count beside the field and the results in a card below it.
- The figures shelf is a grid that fills the width, with each cell's number under its figure.
- A return arrow in the margin marks each output, and it turns red when the cell ended in an error. The green dot beside the run count is gone, since the count already says a cell ran.
- The footer links carry icons.
- Table outputs sort by column and copy as CSV.
