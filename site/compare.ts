import type { Group, Row, Tool } from '../tools/compare/types.ts'

export const checked = '2026-10'

export const tools: readonly Tool[] = [
  {
    id: 'us',
    name: 'ipynb viewer',
    job: 'Reads',
    docs: 'https://github.com/ashwingopalsamy/ipynb-viewer',
    choose: { lead: 'To read a notebook now,', rest: 'on any device, with nothing to install and nothing sent anywhere, including one that came by email.' },
  },
  {
    id: 'nbviewer',
    name: 'nbviewer',
    job: 'Shows',
    docs: 'https://nbviewer.org/faq',
    choose: { lead: 'For a stable public address', rest: 'that anyone can open without this tool or an account.' },
  },
  {
    id: 'github',
    name: 'GitHub',
    job: 'Shows',
    docs: 'https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files',
    choose: { lead: 'When the notebook lives in a repository', rest: 'and you are reviewing it there, beside the code.' },
  },
  {
    id: 'colab',
    name: 'Colab',
    job: 'Runs',
    docs: 'https://research.google.com/colaboratory/faq.html',
    choose: { lead: 'To run it with no setup,', rest: 'on Google’s machines, when a Google account and Drive are fine.' },
  },
  {
    id: 'jupyterlab',
    name: 'JupyterLab',
    job: 'Runs',
    docs: 'https://jupyterlab.readthedocs.io/en/latest/',
    choose: { lead: 'To work on it:', rest: 'run cells, change code, install packages, on a kernel you control.' },
  },
  {
    id: 'vscode',
    name: 'VS Code',
    job: 'Runs',
    docs: 'https://code.visualstudio.com/docs/datascience/jupyter-notebooks',
    choose: { lead: 'When it is part of a codebase', rest: 'you are editing and debugging, with git beside it.' },
  },
]

export const groups: readonly Group[] = [
  { id: 'privacy', name: 'Privacy' },
  { id: 'access', name: 'Access' },
  { id: 'reading', name: 'Reading' },
  { id: 'sharing', name: 'Sharing' },
  { id: 'editing', name: 'Editing' },
]

const nbvFaq = 'https://nbviewer.org/faq'
const nbvRepo = 'https://github.com/jupyter/nbviewer'
const nbvLayout = 'https://github.com/jupyter/nbviewer/blob/main/nbviewer/templates/layout.html'
const nbvNotebook = 'https://github.com/jupyter/nbviewer/blob/main/nbviewer/templates/notebook.html'
const ghFiles = 'https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files'
const ghEdit = 'https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files'
const ghReviewnb = 'https://blog.reviewnb.com/jupyter-notebook-not-rendering-on-github/'
const colabFaq = 'https://research.google.com/colaboratory/faq.html'
const colabIssue = 'https://github.com/googlecolab/colabtools/issues/1746'
const jlNotebook = 'https://jupyterlab.readthedocs.io/en/latest/user/notebook.html'
const jlStart = 'https://jupyterlab.readthedocs.io/en/latest/getting_started/starting.html'
const jlSecurity = 'https://jupyter-server.readthedocs.io/en/latest/operators/security.html'
const jlRender = 'https://github.com/jupyterlab/jupyterlab/blob/main/packages/rendermime/src/renderers.ts'
const jlExport = 'https://jupyterlab.readthedocs.io/en/latest/user/export.html'
const vscNotebooks = 'https://code.visualstudio.com/docs/datascience/jupyter-notebooks'
const vscWeb = 'https://code.visualstudio.com/docs/setup/vscode-web'

export const rows: readonly Row[] = [
  {
    id: 'where',
    group: 'privacy',
    label: 'Where the file is read',
    cells: {
      us: { v: 'yes', say: 'In your browser', more: 'A notebook opened from disk is read in your browser tab. A link is fetched through this site’s relay, which passes the bytes through.' },
      nbviewer: { v: 'no', say: 'On its server', more: 'nbviewer fetches the notebook and converts it to HTML on its own server (nbconvert on Tornado), not in your browser.', src: nbvRepo },
      github: { v: 'no', say: 'On GitHub', more: 'The file lives in a repo on GitHub’s servers, which render the preview and serve it to you.', src: ghFiles },
      colab: { v: 'no', say: 'Google cloud', more: 'Notebooks live in Drive or load from GitHub, and the code runs on a Google-managed virtual machine, not on your device.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Your machine', more: 'JupyterLab runs a local server on your computer, so the notebook is read from your own disk and stays there.', src: jlStart },
      vscode: { v: 'yes', say: 'Your machine', more: 'VS Code reads the .ipynb from disk on your own machine; kernels run locally unless you connect to a remote server.', src: vscNotebooks },
    },
  },
  {
    id: 'uploads',
    group: 'privacy',
    label: 'Uploads your file',
    cells: {
      us: { v: 'yes', say: 'Never', more: 'A file from disk stays on your device. A link is fetched through this site’s relay, which allows only GitHub files and gists, passes the bytes through and keeps no record of the address.' },
      nbviewer: { v: 'no', say: 'Server fetches', more: 'The public instance downloads your file from its URL, renders it and caches the result for about ten minutes.', src: nbvFaq },
      github: { v: 'no', say: 'Pushed first', more: 'To preview a notebook it must first be pushed to GitHub, so its contents sit on GitHub’s servers.', src: ghFiles },
      colab: { v: 'no', say: 'To Google', more: 'Opening your own notebook means uploading it to Google Drive, and its code and outputs then sit in your Google account.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Stays local', more: 'With a local install nothing is sent to a third party unless you choose to run the server somewhere else.', src: jlSecurity },
      vscode: { v: 'yes', say: 'Not by default', more: 'VS Code does not upload a notebook on open; contents leave only through a remote kernel or a service you use, like Copilot.', src: vscNotebooks },
    },
  },
  {
    id: 'account',
    group: 'privacy',
    label: 'Account needed',
    cells: {
      us: { v: 'yes', say: 'None', more: 'Opening a notebook asks for no sign-in.' },
      nbviewer: { v: 'yes', say: 'None', more: 'No sign-in; paste the URL of a public notebook and it renders.', src: nbvFaq },
      github: { v: 'part', say: 'Public: none', more: 'A public repo’s notebooks open without signing in; private repos need a login, and hosting your own file needs an account.', src: ghFiles },
      colab: { v: 'part', say: 'View only', more: 'A Google account is needed to run, edit or upload. Secondary sources say a public notebook can be viewed signed out, but Google’s support page says sign-in is required.', src: 'https://support.google.com/machinelearningeducation/answer/7656404?hl=en' },
      jupyterlab: { v: 'yes', say: 'Token only', more: 'No account exists; the server prints a token, and the browser tab it opens already carries it.', src: jlSecurity },
      vscode: { v: 'yes', say: 'No sign-in', more: 'VS Code has no sign-in to open or run notebooks; accounts matter only for optional services such as Copilot or settings sync.', src: 'https://code.visualstudio.com/docs/configure/telemetry' },
    },
  },
  {
    id: 'private',
    group: 'privacy',
    label: 'Private files',
    cells: {
      us: { v: 'yes', say: 'From your disk', more: 'A notebook on your disk opens in the browser and is not sent anywhere.' },
      nbviewer: { v: 'no', say: 'Public URL only', more: 'Notebooks must be reachable on the public internet; private files need a self-hosted nbviewer.', src: nbvFaq },
      github: { v: 'no', say: 'Must be pushed', more: 'A private repo limits who can see the file, but it still has to be pushed to GitHub before it can open.', src: 'https://blog.jupyter.org/posts/2015/rendering-notebooks-on-github/' },
      colab: { v: 'no', say: 'Upload first', more: 'To open a file from your disk, Colab copies it into Drive; a local runtime moves the compute, not the notebook.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'In server folder', more: 'Any file under the server’s root folder opens; files outside it need the server started with a different --notebook-dir.', src: jlStart },
      vscode: { v: 'yes', say: 'Local files', more: 'Notebooks open straight from a folder on your disk, and nothing needs to be published first.', src: vscNotebooks },
    },
  },
  {
    id: 'untrusted',
    group: 'privacy',
    label: 'Safe for untrusted files',
    cells: {
      us: { v: 'yes', say: 'Sandboxed', more: 'Markdown and HTML outputs are cleaned. An output that carries a script waits behind a button and runs in a sandboxed frame. No cell is ever run.' },
      nbviewer: { v: 'no', say: 'Scripts run', more: 'The FAQ says embedded JavaScript runs on rendered pages, so a hostile notebook can run script in the visitor’s browser.', src: nbvFaq },
      github: { v: 'yes', say: 'Static, no JS', more: 'GitHub shows notebooks as static HTML and drops JavaScript, custom CSS and most custom HTML, so nothing in the file runs.', src: 'https://blog.jupyter.org/posts/2015/rendering-notebooks-on-github/' },
      colab: { v: 'part', say: 'Sandboxed', more: 'Nothing runs until you press run. Saved outputs can still contain scripts, which run inside iframes on a separate origin, according to a 2019 comment from the Colab team.', src: 'https://github.com/pyviz/holoviews/issues/3551' },
      jupyterlab: { v: 'yes', say: 'Sanitized HTML', more: 'Notebooks from elsewhere start untrusted: HTML is sanitized, JavaScript never runs, and no cell executes just because you opened one, though the kernel can start on open.', src: jlSecurity },
      vscode: { v: 'part', say: 'Ask to trust', more: 'Restricted Mode blocks running cells and hides rich outputs until you trust the folder; once you trust it, saved rich outputs, including scripts, render.', src: vscNotebooks },
    },
  },
  {
    id: 'install',
    group: 'access',
    label: 'Install needed',
    cells: {
      us: { v: 'yes', say: 'None', more: 'It runs in the browser; there is nothing to install.' },
      nbviewer: { v: 'yes', say: 'None', more: 'It is a website; there is nothing to install to read a notebook.', src: nbvFaq },
      github: { v: 'yes', say: 'None', more: 'It is a website; there is nothing to install.', src: ghFiles },
      colab: { v: 'yes', say: 'None', more: 'Colab runs in the browser, so there is nothing to download, install or run yourself.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'pip install', more: 'It needs a Python-based install through pip, conda or Docker before first use, and the docs offer no hosted or no-install route.', src: 'https://jupyterlab.readthedocs.io/en/latest/getting_started/installation.html' },
      vscode: { v: 'no', say: 'App + add-on', more: 'Needs the VS Code app and the Jupyter extension, which VS Code offers on first opening a notebook; running cells also needs Python and ipykernel.', src: vscNotebooks },
    },
  },
  {
    id: 'offline',
    group: 'access',
    label: 'Works offline',
    cells: {
      us: { v: 'yes', say: 'After one visit', more: 'The app needs a one-time download; after that, a notebook on your disk opens without a network.' },
      nbviewer: { v: 'no', say: 'Online only', more: 'Pages are rendered by a remote service and load scripts and styles from the network, so nothing opens offline.', src: nbvRepo },
      github: { v: 'no', say: 'Online only', more: 'The preview is rendered by GitHub, so it needs a connection.', src: ghFiles },
      colab: { v: 'no', say: 'Online only', more: 'Colab needs a connection to Google both to load the notebook and to run it on a remote virtual machine.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Local server', more: 'Both the server and the front end run on your machine, so a notebook opens with no network connection.', src: jlStart },
      vscode: { v: 'yes', say: 'Once installed', more: 'Everything runs on your machine, so a notebook opens and runs with no network once VS Code and the extension are installed.', src: vscNotebooks },
    },
  },
  {
    id: 'links',
    group: 'access',
    label: 'Opens from a link',
    cells: {
      us: { v: 'yes', say: 'GitHub and gists', more: 'On the main site a link is fetched through this site’s relay, which allows only GitHub files and gists. The GitHub Pages mirror fetches directly from the browser.' },
      nbviewer: { v: 'yes', say: 'Any public URL', more: 'Takes a URL, GitHub path or gist ID and renders the notebook found there.', src: nbvFaq },
      github: { v: 'yes', say: 'Repos, gists', more: 'Every notebook in a repo or gist has its own link that opens it rendered.', src: ghFiles },
      colab: { v: 'yes', say: 'GitHub, Drive', more: 'An address like colab.research.google.com/github/owner/repo/blob/branch/path opens a public GitHub notebook directly, and Drive notebooks open by link too.', src: 'https://github.com/googlecolab/colabtools/blob/main/notebooks/colab-github-demo.ipynb' },
      jupyterlab: { v: 'part', say: 'Open from URL', more: 'The Open from URL command (in the command palette, not the File menu) fetches the file in the browser, so the host must allow cross-origin requests, then copies it into the server folder.', src: 'https://github.com/jupyterlab/jupyterlab/blob/main/packages/filebrowser-extension/src/index.ts' },
      vscode: { v: 'part', say: 'GitHub repos', more: 'VS Code for the Web opens a GitHub repo from a vscode.dev URL, but that docs page does not mention notebooks, and no way to open a notebook from a URL in the desktop app is documented.', src: vscWeb },
    },
  },
  {
    id: 'large',
    group: 'access',
    label: 'Large files',
    cells: {
      us: { v: 'yes', say: 'Read in chunks', more: 'The file is read in chunks. A notebook opened from a link is capped at 50 MB.' },
      nbviewer: { v: 'no', say: 'Slow or fails', more: 'No size limit is documented. One forum report describes a notebook of about 200 MB loading for minutes and then returning a 503; a 50 MB notebook was not tested.', src: 'https://discourse.jupyter.org/t/is-there-a-maximum-size-of-jupyter-notebook-for-which-nbviewer-can-render/25931' },
      github: { v: 'no', say: 'Won’t render', more: 'No size limit is documented. A ReviewNB write-up describes a five second render timeout and a “too big to display” message, and says a 30 MB notebook failed; a 50 MB notebook was not tested.', src: ghReviewnb },
      colab: { v: 'part', say: 'Slow when big', more: 'Google documents no notebook size limit. An issue on the colabtools tracker reports heavy outputs freezing the tab and using over 8 GB of memory; a 50 MB notebook was not tested.', src: colabIssue },
      jupyterlab: { v: 'part', say: 'Can be slow', more: 'Windowed rendering keeps scrolling light. Forum posts report that a notebook full of large outputs loads slowly and can exhaust browser memory; no 50 MB test was found.', src: 'https://jupyterlab.readthedocs.io/en/4.6.x/getting_started/changelog.html' },
      vscode: { v: 'part', say: 'Slow when big', more: 'No size limit is documented. The editor’s source refuses notebooks too large for memory, and output-heavy notebooks can render slowly; a 50 MB notebook was not tested.', src: 'https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/notebook/browser/notebookEditor.ts' },
    },
  },
  {
    id: 'phone',
    group: 'access',
    label: 'On a phone',
    cells: {
      us: { v: 'yes', say: 'Made for it', more: 'The page is built to be read on a phone as well as on a desktop.' },
      nbviewer: { v: 'yes', say: 'Responsive', more: 'The page sets a device-width viewport and a collapsing navbar, so notebooks read on a phone; long code lines scroll sideways. This was read from the template, not seen on a device.', src: nbvLayout },
      github: { v: 'yes', say: 'Responsive', more: 'github.com has a mobile layout and a rendered notebook opens in a phone browser, with wide code scrolling sideways. GitHub’s documentation does not describe notebooks on phones.', src: ghFiles },
      colab: { v: 'part', say: 'Desktop-first', more: 'Colab says it works on any internet-enabled device. Its team has called mobile support difficult, and an open 2024 issue reports selection and layout bugs on iPhone.', src: 'https://github.com/googlecolab/colabtools/issues/4361' },
      jupyterlab: { v: 'part', say: 'Cramped layout', more: 'The accessibility page lists iOS and Android as supported. That the interface is desktop-oriented is an inference, and it needs a server the phone can reach.', src: 'https://jupyterlab.readthedocs.io/en/4.6.x/getting_started/accessibility.html' },
      vscode: { v: 'part', say: 'Web, cramped', more: 'VS Code for the Web works in mobile browsers, and its own docs say smaller screens have certain limitations. That page does not mention notebooks.', src: vscWeb },
    },
  },
  {
    id: 'math',
    group: 'reading',
    label: 'Math and highlighting',
    cells: {
      us: { v: 'yes', say: 'Typeset', more: 'LaTeX is typeset and code is highlighted.' },
      nbviewer: { v: 'yes', say: 'Typeset', more: 'Loads MathJax for inline and display LaTeX in Markdown cells, and code is highlighted when the page is rendered.', src: nbvNotebook },
      github: { v: 'yes', say: 'Typeset', more: 'Markdown cells render LaTeX and code is highlighted; GitHub’s math support is MathJax-based. Its math documentation covers Markdown and does not mention notebooks.', src: 'https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions' },
      colab: { v: 'yes', say: 'Typeset', more: 'Text cells render LaTeX math between dollar signs, and code cells are syntax highlighted.', src: 'https://colab.research.google.com/notebooks/markdown_guide.ipynb' },
      jupyterlab: { v: 'yes', say: 'MathJax', more: 'Notebooks render LaTeX equations in Markdown cells and highlight code in the editor, both built in.', src: jlNotebook },
      vscode: { v: 'yes', say: 'KaTeX math', more: 'Markdown cells typeset LaTeX with KaTeX, and code cells are syntax highlighted by the editor.', src: 'https://github.com/microsoft/vscode/blob/main/extensions/markdown-math/package.json' },
    },
  },
  {
    id: 'frames',
    group: 'reading',
    label: 'Printed DataFrames',
    cells: {
      us: { v: 'yes', say: 'Real tables', more: 'Plain text that lines up as a pandas frame, which is what print(df) writes, becomes a real table: monospace, tabular figures, numbers right-aligned.' },
      nbviewer: { v: 'no', say: 'Plain text', more: 'Printed text output is shown as saved; nothing turns it into a table.', src: nbvRepo },
      github: { v: 'no', say: 'Plain text', more: 'A printed DataFrame stays as the saved text; only a saved HTML table output renders as a table.', src: ghFiles },
      colab: { v: 'no', say: 'Plain text', more: 'A DataFrame that is the last expression renders as a table, but print(df) stays plain text.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Plain text', more: 'A printed DataFrame stays monospaced text; only a displayed DataFrame, through its HTML form, renders as a table.', src: jlRender },
      vscode: { v: 'no', say: 'Plain text', more: 'print(df) stays plain text; only a DataFrame displayed as the last value renders as an HTML table, with a data viewer for variables.', src: vscNotebooks },
    },
  },
  {
    id: 'traces',
    group: 'reading',
    label: 'Tracebacks',
    cells: {
      us: { v: 'yes', say: 'Error line first', more: 'The exception name and value come first. A traceback of five or more frames is reduced to the last frame in your own code, and the rest sits behind a “Show full traceback” row.' },
      nbviewer: { v: 'no', say: 'Saved as is', more: 'Tracebacks appear as saved, in cell order, with every library frame expanded and the error at the bottom.', src: nbvRepo },
      github: { v: 'no', say: 'Saved as is', more: 'Tracebacks show as saved, with every library frame expanded and the error line last.', src: ghFiles },
      colab: { v: 'no', say: 'Full trace', more: 'Errors show the full Python traceback, library frames included and unfolded, with the message at the bottom.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Full traceback', more: 'The error appears as the complete traceback, library frames included and colored by ANSI codes, with no folding or error-first view.', src: jlRender },
      vscode: { v: 'no', say: 'Full traceback', more: 'The whole traceback shows by default, error last. An opt-in minimal style hides the stack behind Show Details; it is off by default.', src: 'https://github.com/microsoft/vscode/blob/main/extensions/notebook-renderers/src/index.ts' },
    },
  },
  {
    id: 'bars',
    group: 'reading',
    label: 'Progress bars',
    cells: {
      us: { v: 'yes', say: 'Last frame only', more: 'A bar saved as one line per frame, as tqdm without a terminal and Keras write it, keeps only the last frame of each run. Carriage returns are collapsed too.' },
      nbviewer: { v: 'no', say: 'Every frame', more: 'nbconvert passes carriage returns through, and a browser turns each into a line break, so a bar saved with each update should show every frame as its own line. This is inferred from the source, not observed.', src: 'https://github.com/jupyter/nbconvert/blob/main/nbconvert/filters/ansi.py' },
      github: { v: 'no', say: 'Every frame', more: 'GitHub’s documentation does not cover this. Terminal-style bars such as tqdm are shown as saved text, usually one line per update, with no collapse to the last frame, as far as could be found.', src: ghReviewnb },
      colab: { v: 'yes', say: 'Last frame', more: 'Progress text that rewrites a line with carriage returns is reported to collapse to its final state in the output area. No Colab documentation page states this.', src: colabIssue },
      jupyterlab: { v: 'yes', say: 'Last frame', more: 'On load, carriage returns and backspaces overwrite earlier text, so a saved text bar shows its final state.', src: 'https://github.com/jupyterlab/jupyterlab/blob/main/packages/outputarea/src/model.ts' },
      vscode: { v: 'no', say: 'Frames pile up', more: 'Carriage-return redraws are folded while a cell runs, but bars saved by other tools appear to load as one line per frame. This was read from the source, not tested in VS Code.', src: 'https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/notebook/common/notebookCommon.ts' },
    },
  },
  {
    id: 'search',
    group: 'reading',
    label: 'Search inside outputs',
    cells: {
      us: { v: 'yes', say: 'Text and outputs', more: 'Press / to search. It covers outputs, not only code.' },
      nbviewer: { v: 'no', say: 'Browser find', more: 'The page template has no search box, so only the browser’s own find works, on the rendered text.', src: nbvLayout },
      github: { v: 'no', say: 'Browser find', more: 'The preview has no search of its own that was found; the browser’s find works on the rendered page.', src: ghFiles },
      colab: { v: 'no', say: 'Code and text', more: 'Find and replace covers code and text cells. No Colab page lists outputs as searched, and outputs render in separate sandboxed frames.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Outputs option', more: 'Find has a Search Cell Outputs filter, though the option can be unavailable while the replace bar is open.', src: 'https://discourse.jupyter.org/t/search-cell-outputs-checkbox-disabled/26064' },
      vscode: { v: 'yes', say: 'Cells, outputs', more: 'Ctrl/Cmd+F searches Markdown, code and cell output, and a funnel menu filters which are included. The docs list inputs as the default, but the source default includes outputs, so the docs may be out of date.', src: vscNotebooks },
    },
  },
  {
    id: 'outline',
    group: 'reading',
    label: 'Outline',
    cells: {
      us: { v: 'yes', say: 'From headings', more: 'Press t for a contents list built from the notebook’s headings.' },
      nbviewer: { v: 'no', say: 'None', more: 'The template has no contents panel; headings get anchor links only.', src: nbvNotebook },
      github: { v: 'no', say: 'None', more: 'No contents panel built from headings is documented for the notebook preview.', src: ghFiles },
      colab: { v: 'yes', say: 'Contents pane', more: 'A left-hand table of contents pane is built from the Markdown headings in text cells.', src: 'https://github.com/googlecolab/colabtools/issues/4880' },
      jupyterlab: { v: 'yes', say: 'From headings', more: 'A table of contents in the left sidebar is generated from the Markdown headings in the notebook.', src: 'https://jupyterlab.readthedocs.io/en/latest/user/toc.html' },
      vscode: { v: 'yes', say: 'Outline view', more: 'The Outline view in the Explorer lists a notebook’s Markdown headings, and can include code cells too.', src: vscNotebooks },
    },
  },
  {
    id: 'order',
    group: 'reading',
    label: 'Run order',
    cells: {
      us: { v: 'yes', say: 'Replay it', more: 'Shows the order the cells ran in and can replay it.' },
      nbviewer: { v: 'yes', say: 'Counts shown', more: 'Code cells keep their In [n] execution counts, so the run order can be read, though it cannot be replayed.', src: nbvRepo },
      github: { v: 'yes', say: 'Counts shown', more: 'Cells keep their execution counts, so the order they ran in can be read, but not replayed. GitHub’s documentation does not describe this.', src: ghFiles },
      colab: { v: 'part', say: 'Live runs only', more: 'Colab shows run counts in a live session, and its documentation does not say they are kept in the saved file.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Run counts', more: 'Each code cell shows its saved execution count, so the order cells ran in is visible, though there is no replay.', src: 'https://nbformat.readthedocs.io/en/latest/format_description.html' },
      vscode: { v: 'yes', say: 'Run counts', more: 'Each cell that has run shows its execution count in brackets, so the order cells ran in is visible; counts reset with the kernel.', src: 'https://github.com/microsoft/vscode/issues/287853' },
    },
  },
  {
    id: 'refresh',
    group: 'reading',
    label: 'Live refresh',
    cells: {
      us: { v: 'part', say: 'In Chromium', more: 'In Chromium browsers the view follows the file when it changes on disk.' },
      nbviewer: { v: 'no', say: '10-minute cache', more: 'Rendered pages are cached for about ten minutes; adding ?flush_cache=true forces a fresh render.', src: nbvFaq },
      github: { v: 'no', say: 'Reload the page', more: 'The preview shows the committed file; to see a change you push it and reload.', src: ghFiles },
      colab: { v: 'no', say: 'No file watch', more: 'No Colab documentation describes watching a file on disk, and the notebook is held in Drive rather than read from your folder.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Manual reload', more: 'A Jupyter forum thread says the server does not watch the file system, so changes on disk need a manual reload command or a save-time conflict prompt.', src: 'https://discourse.jupyter.org/t/automatically-refresh-notebook-on-changes/16912' },
      vscode: { v: 'no', say: 'Reload by hand', more: 'An open notebook does not pick up outside edits to the .ipynb until you revert or reload it; the request is still open on the VS Code tracker.', src: 'https://github.com/microsoft/vscode/issues/171920' },
    },
  },
  {
    id: 'widgets',
    group: 'reading',
    label: 'Live widgets',
    cells: {
      us: { v: 'no', say: 'Saved picture', more: 'Nothing runs, so a widget shows as the picture saved in the file and does not respond.' },
      nbviewer: { v: 'no', say: 'Saved state only', more: 'Widgets draw only if the notebook saved widget state, and nothing runs Python behind them, so callbacks never fire.', src: 'https://ipywidgets.readthedocs.io/en/latest/embedding.html' },
      github: { v: 'no', say: 'Not rendered', more: 'Interactivity such as widgets and JavaScript plots is disabled in the preview, so only static fallback output shows.', src: ghFiles },
      colab: { v: 'yes', say: 'On a runtime', more: 'ipywidgets work live while a runtime is connected; third-party widgets need output.enable_custom_widget_manager(), and a widget is not live when merely opened.', src: 'https://colab.research.google.com/notebooks/widgets.ipynb' },
      jupyterlab: { v: 'yes', say: 'With ipywidgets', more: 'After pip install ipywidgets, widgets run live against the kernel with no manual extension step in JupyterLab 4.', src: 'https://ipywidgets.readthedocs.io/en/latest/user_install.html' },
      vscode: { v: 'yes', say: 'With a kernel', more: 'ipywidgets render and respond while a kernel is running; third-party widgets load from a CDN only if you allow it. A 2025 issue reports widgets failing to render in one setup.', src: 'https://github.com/microsoft/vscode-jupyter/wiki/Component:-IPyWidgets' },
    },
  },
  {
    id: 'figures',
    group: 'sharing',
    label: 'Figure shelf',
    cells: {
      us: { v: 'yes', say: 'Every plot', more: 'Every plot in the notebook is gathered in one place.' },
      nbviewer: { v: 'no', say: 'None', more: 'Plots appear inline where they were produced; no gallery of them was found.', src: nbvRepo },
      github: { v: 'no', say: 'None', more: 'Plots appear inline where they were produced; no gallery of them was found.', src: ghFiles },
      colab: { v: 'no', say: 'Inline only', more: 'Plots appear in the output of the cell that drew them; no view that gathers every figure in one place is documented.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Not built in', more: 'No gallery of plots is documented; each output stays in its own cell, and Create New View for Output pins only one.', src: jlNotebook },
      vscode: { v: 'no', say: 'Per cell only', more: 'Plots stay inline in their cells and can be saved one at a time; the Plot Viewer works only in the Interactive Window.', src: 'https://code.visualstudio.com/docs/python/jupyter-support-py' },
    },
  },
  {
    id: 'shot',
    group: 'sharing',
    label: 'Cell as image',
    cells: {
      us: { v: 'yes', say: 'Press s', more: 'Press s to export a cell as an image.' },
      nbviewer: { v: 'no', say: 'None', more: 'The navbar lists Download Notebook and the slides and script views; no cell-to-image option appears in it.', src: nbvNotebook },
      github: { v: 'no', say: 'None', more: 'Nothing in the preview that was found exports a single cell as an image.', src: ghFiles },
      colab: { v: 'no', say: 'Not built in', more: 'No Colab documentation lists a command that exports one cell as an image.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Not built in', more: 'Outputs can be copied or opened in a new view; the export docs list no command that exports a cell as an image.', src: jlExport },
      vscode: { v: 'no', say: 'Plots only', more: 'You can save a plot image from the output’s Save icon, but no way to export a whole cell as an image was found.', src: vscNotebooks },
    },
  },
  {
    id: 'copymd',
    group: 'sharing',
    label: 'Copy as Markdown',
    cells: {
      us: { v: 'yes', say: 'Press m', more: 'Press m to copy the notebook as Markdown. Likely secrets are hidden by default.' },
      nbviewer: { v: 'no', say: 'None', more: 'The alternate views are HTML, slides and a Python script; no Markdown export is listed.', src: nbvRepo },
      github: { v: 'no', say: 'None', more: 'The file view offers raw, copy and download of the JSON, not the notebook as Markdown.', src: ghFiles },
      colab: { v: 'no', say: 'No Markdown', more: 'File > Download offers .ipynb and .py; no Markdown export or copy command is listed.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Export as .md', more: 'Exporting from the File menu offers Markdown without extra tools, but it downloads a file rather than copying to the clipboard.', src: jlExport },
      vscode: { v: 'no', say: 'Py, HTML, PDF', more: 'The export menu offers a Python script, HTML or PDF; no Markdown export or copy-as-Markdown command was found.', src: vscNotebooks },
    },
  },
  {
    id: 'share',
    group: 'sharing',
    label: 'Share without hosting',
    cells: {
      us: { v: 'yes', say: 'Link after #', more: 'A viewable notebook is shared as a link with the part after the # carrying it, so nothing is uploaded.' },
      nbviewer: { v: 'no', say: 'Host it first', more: 'The notebook must already sit at a public URL, in a GitHub repo or in a gist before nbviewer can show it.', src: nbvFaq },
      github: { v: 'no', say: 'Push it first', more: 'A shared link means the notebook is stored on GitHub, in a repo or a gist.', src: ghFiles },
      colab: { v: 'no', say: 'Via Drive', more: 'Sharing uses Drive’s Share button or a link to a notebook already hosted on GitHub, so the file is always hosted somewhere.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Needs a server', more: 'Sharing means giving someone access to your running server, which allows arbitrary code execution; no read-only publish option is documented in core.', src: jlSecurity },
      vscode: { v: 'no', say: 'No link sharing', more: 'No built-in share link was found; Live Share is a separate extension for live sessions, and its notebook support is a preview.', src: 'https://learn.microsoft.com/en-us/visualstudio/liveshare/reference/notebooks' },
    },
  },
  {
    id: 'secrets',
    group: 'sharing',
    label: 'Secret scan',
    cells: {
      us: { v: 'yes', say: 'Before sharing', more: 'Likely keys and tokens are spotted and hidden by default when you copy as Markdown.' },
      nbviewer: { v: 'no', say: 'None', more: 'No check for keys or tokens is documented; whatever is in the public file is rendered as is.', src: nbvRepo },
      github: { v: 'part', say: 'Push protection', more: 'Push protection blocks pushes with known token patterns and is on by default for public repos. It scans pushes, not notebooks as such, and private repos need a paid plan.', src: 'https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/push-protection-for-users' },
      colab: { v: 'no', say: 'Not scanned', more: 'A Secrets tab keeps keys out of the notebook, but no scan of cells or outputs for keys and tokens before you share is documented.', src: colabFaq },
      jupyterlab: { v: 'no', say: 'Not built in', more: 'No scan for keys or tokens is documented in core, and none appears in the 4.5 or 4.6 release notes.', src: 'https://jupyterlab.readthedocs.io/en/4.6.x/getting_started/changelog.html' },
      vscode: { v: 'no', say: 'No scanner', more: 'No built-in warning for keys or tokens in notebooks was found; scanning comes from extensions or from GitHub after a push.', src: vscNotebooks },
    },
  },
  {
    id: 'diff',
    group: 'sharing',
    label: 'Compare versions',
    cells: {
      us: { v: 'yes', say: 'Cell by cell', more: 'Open another copy and the Changes list shows each cell added, removed or edited, with the changed lines.' },
      nbviewer: { v: 'no', say: 'One version', more: 'It renders a single notebook per page; no way to compare two versions is documented.', src: nbvRepo },
      github: { v: 'part', say: 'Opt-in preview', more: 'Rich notebook diffs, built on nbdime, were announced as a Feature Preview in March 2023 that you turn on; no later general-availability notice was found. Comments need the source diff.', src: 'https://github.blog/changelog/2023-03-01-feature-preview-rich-jupyter-notebook-diffs/' },
      colab: { v: 'yes', say: 'Revision diff', more: 'File > Revision history lists saved versions and can show a side-by-side diff between any two of them.', src: 'https://blog.reviewnb.com/jupyter-notebook-google-colab/' },
      jupyterlab: { v: 'no', say: 'Needs nbdime', more: 'Side-by-side notebook diffing comes from the separate nbdime extension, which is not part of a default install.', src: 'https://nbdime.readthedocs.io/en/stable/extensions.html' },
      vscode: { v: 'yes', say: 'Per-cell diff', more: 'A built-in notebook diff editor compares two versions cell by cell, with a menu to include outputs and metadata changes.', src: vscNotebooks },
    },
  },
  {
    id: 'runs',
    group: 'editing',
    label: 'Runs the code',
    cells: {
      us: { v: 'no', say: 'Never, by design', more: 'Nothing runs. Code and outputs are never changed.' },
      nbviewer: { v: 'no', say: 'Binder link', more: 'It never executes cells, though a button can hand GitHub-hosted notebooks to Binder to run.', src: nbvFaq },
      github: { v: 'no', say: 'View only', more: 'The preview never executes cells; running them needs another tool.', src: ghFiles },
      colab: { v: 'yes', say: 'On Google VMs', more: 'Cells run on a virtual machine private to your account, with free CPUs, GPUs and TPUs subject to usage limits.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Local kernel', more: 'Cells run on a kernel that the local server starts, using whichever kernels you have installed.', src: jlNotebook },
      vscode: { v: 'yes', say: 'On a kernel', more: 'Cells run on a Jupyter kernel, local or remote, once you pick a Python environment with ipykernel; Restricted Mode blocks this.', src: 'https://code.visualstudio.com/docs/datascience/jupyter-kernel-management' },
    },
  },
  {
    id: 'edittext',
    group: 'editing',
    label: 'Edit text cells',
    cells: {
      us: { v: 'yes', say: 'In the page', more: 'Double-click a paragraph, heading or list, or press e, and write. Saving changes only the text of the cells that were edited, so figures, tables and outputs stay as they were.' },
      nbviewer: { v: 'no', say: 'Read only', more: 'Notebooks are displayed as static pages, and no cell can be edited.', src: nbvFaq },
      github: { v: 'part', say: 'Raw JSON only', more: 'GitHub’s editing docs name no file types. The web editor is expected to open an .ipynb as raw JSON, so a Markdown cell’s text can be changed there but not in the rendered view.', src: ghEdit },
      colab: { v: 'yes', say: 'In the page', more: 'Text cells are edited in place with a Markdown editor and live preview.', src: 'https://colab.research.google.com/notebooks/markdown_guide.ipynb' },
      jupyterlab: { v: 'yes', say: 'In the browser', more: 'Markdown cells are edited in place in the page and rendered again when you run the cell.', src: jlNotebook },
      vscode: { v: 'yes', say: 'In the editor', more: 'Markdown cells are edited in the notebook editor and rendered with the check mark, Ctrl+Enter or Shift+Enter.', src: vscNotebooks },
    },
  },
  {
    id: 'editcode',
    group: 'editing',
    label: 'Edit code',
    cells: {
      us: { v: 'no', say: 'Never', more: 'Code and outputs are never changed.' },
      nbviewer: { v: 'no', say: 'Read only', more: 'Code cells are static HTML and cannot be edited.', src: nbvFaq },
      github: { v: 'part', say: 'Raw JSON only', more: 'In the same web editor, code sits inside JSON strings, so it can be changed but not as a notebook cell. As above, this is expected rather than documented.', src: ghEdit },
      colab: { v: 'yes', say: 'Full editor', more: 'Code cells use a full code editor in the page, with completion and syntax highlighting.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Full editor', more: 'Code cells are edited in a full code editor with syntax highlighting and kernel-backed completion.', src: jlNotebook },
      vscode: { v: 'yes', say: 'In the editor', more: 'Code cells are edited in place in the notebook editor; language features come from installed extensions such as Python.', src: vscNotebooks },
    },
  },
  {
    id: 'save',
    group: 'editing',
    label: 'Save back to the file',
    cells: {
      us: { v: 'part', say: 'In Chromium', more: 'From disk in Chromium, Save writes the same file; from a link or in other browsers, it saves a copy.' },
      nbviewer: { v: 'no', say: 'Read only', more: 'There is nothing to save; the source file lives at its original URL and is never touched.', src: nbvFaq },
      github: { v: 'part', say: 'Commits JSON', more: 'Edits made in the web editor commit back to the same .ipynb file, as JSON rather than through a notebook interface. As above, this is expected rather than documented.', src: ghEdit },
      colab: { v: 'part', say: 'Drive copy', more: 'Edits autosave to the .ipynb in your Drive. A notebook uploaded from your disk or opened from GitHub is saved as a Drive copy, not into the file you opened.', src: colabFaq },
      jupyterlab: { v: 'yes', say: 'Saves to .ipynb', more: 'Edits are written through the server into the same .ipynb file, with autosave on by default.', src: jlNotebook },
      vscode: { v: 'yes', say: 'Same .ipynb', more: 'Ctrl+S or File > Save writes the notebook back to the same .ipynb file.', src: vscNotebooks },
    },
  },
  {
    id: 'mdfiles',
    group: 'editing',
    label: 'Markdown files',
    cells: {
      us: { v: 'yes', say: 'Edit in the page', more: 'Files ending .md or .markdown open by picker, drop or the operating system, render as one Markdown cell and edit like text cells. They save into the same file in Chromium browsers; other browsers download a copy.' },
      nbviewer: { v: 'no', say: 'Not editable', more: 'It has no editor, so a Markdown file cannot be edited there.', src: nbvFaq },
      github: { v: 'yes', say: 'Edit and preview', more: 'Markdown files render in the file view, and the web editor has a Preview tab.', src: ghEdit },
      colab: { v: 'part', say: 'Source only', more: 'A .md file is expected to open in Colab’s file pane as plain text you can edit, with no rendered preview; this was not confirmed on a live page.', src: colabFaq },
      jupyterlab: { v: 'part', say: 'Menu preview', more: 'An .md file can be edited in the text editor, and a rendered preview that updates as you type opens from the Open With menu.', src: 'https://jupyterlab.readthedocs.io/en/latest/user/file_formats.html' },
      vscode: { v: 'part', say: 'Preview beside', more: 'A .md file opens as source; preview is one shortcut away, and the experimental Markdown Editor edits rendered text.', src: 'https://code.visualstudio.com/docs/languages/markdown' },
    },
  },
]
