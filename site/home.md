# ipynb viewer

Jupyter notebooks, without Jupyter. Drop a `.ipynb` notebook or a Markdown `.md` file, or paste a GitHub link, and read it. Nothing runs, and nothing is sent anywhere.

ipynb viewer is a free, open source (MIT) web page at https://ipynb.ashwingopalsamy.in/. It reads a notebook in your browser and works offline after the first visit.

- A notebook is a document. The file is read where it is, in your browser, and no line of it is run.
- Your file stays here. Once a notebook is open, the page shuts its own connections, and the browser enforces that. The Privacy sheet counts what the page has sent.
- Small on purpose. The first screen is a few tens of kilobytes gzipped. Math and code highlighting load only when a notebook needs them.
- Cells appear while the file is still being read.
- A notebook is untrusted input. Markdown and HTML outputs are cleaned, and scripts wait behind a button in a sandbox with no network.
- Markdown too: a `.md` file opens and edits like a notebook of one text cell.
- Made for reading: search, a figures shelf, live refresh in Chromium browsers, run order, share by link, cell screenshots, Copy as Markdown and keyboard shortcuts.
- Edit in place: double-click any text cell and write, with a bar for undo, bold, links, headings and lists. Code and outputs are never touched. Save writes into the file you opened; from a link, or in a browser that cannot write files, it saves a copy to your computer.

Pages: [open from GitHub](open-from-github/index.md), [comparison](compare/index.md), [for agents](agents/index.md), [design](design/index.md).
