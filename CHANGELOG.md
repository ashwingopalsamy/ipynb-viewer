# Changelog

Versions follow [semantic versioning](https://semver.org). Each release lists what a reader would notice.

## Unreleased

First public version, in progress.

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
