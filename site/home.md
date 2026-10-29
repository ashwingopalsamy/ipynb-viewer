# ipynb viewer

Jupyter notebooks, without Jupyter. Drop a `.ipynb` notebook or a Markdown `.md` file, or paste a GitHub link, and read it. Nothing runs, and nothing is sent anywhere.

ipynb viewer is a free, open source (MIT) web page at https://ipynb.ashwingopalsamy.in/. It reads a notebook in your browser and works offline after the first visit.

- Compared: six ways to open a notebook. nbviewer and GitHub show a notebook from a server; Colab, JupyterLab and VS Code run one on a kernel. ipynb viewer reads it in your browser: nothing to install, no account, no upload, and no code runs.
- Markdown: edit the text and keep the outputs. Double-click a Markdown cell and write in the page. Saving changes only the text you edited, so code, figures and tables stay as they were. A `.md` file from your disk opens the same way.
- Reading: the same notebook, read better. A printed DataFrame becomes a table, a traceback names the error first, and a progress bar keeps its last frame. None of this runs code.
- Privacy: where your file goes. The file is read where it is, in your browser. Once a notebook is open, the page shuts its own connections, and the browser enforces that. After the first visit the app works offline, and the Privacy sheet counts what the page has sent.
- Safety: a notebook is untrusted input. Markdown and HTML outputs are cleaned, and scripts wait behind a button in a sandbox with no network.
- Speed: small on purpose. Math and code highlighting load only when a notebook needs them, the file is read in chunks, and cells appear while it is still being read.
- Everything else: search, a figures shelf, live refresh in Chromium browsers, run order, share by link, cell screenshots, Copy as Markdown, edit in place, trace a name, and single-key shortcuts.
- Questions: the answers people ask most, such as whether a file is uploaded and whether any code runs.

Compared with nbviewer, GitHub, Colab, JupyterLab and VS Code: [the comparison](compare/index.md).

Pages: [open from GitHub](open-from-github/index.md), [comparison](compare/index.md), [for agents](agents/index.md), [design](design/index.md).
