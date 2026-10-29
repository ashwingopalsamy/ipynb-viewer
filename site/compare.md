---
title: ipynb viewer compared with nbviewer, GitHub, Colab, JupyterLab and VS Code
description: A side-by-side comparison of six ways to open a Jupyter notebook: where the file goes, whether code runs, offline use, reading, sharing and editing, including Markdown files.
---

# Six ways to open a notebook, compared.

nbviewer and GitHub show a notebook from a server. Colab, JupyterLab and VS Code run one, on a kernel that has to live somewhere. **ipynb viewer reads it in your browser:** nothing to install, no account, no upload, and no code runs.

<!--compare:jobs-->

<!--compare:figures-->

Sizes are measured by the build on every release; read times come from the project’s benchmark.

<!--section:table-->
## <!--compare:count--> things, checked.

Grouped by what you would ask. Every tick has words beside it, and every row opens to the detail and its source.

<!--compare:matrix-->

<!--section:reading-->
## The same notebook, read better.

Most tools show an output exactly as it was saved. ipynb viewer reads it and shows what it means. Your file is never changed.

> None of this runs code. It reads what the notebook already holds.

<!--compare:demos-->

<!--section:your-file-->
## Where your file goes.

The tools that show a notebook read it on their servers. The tools that run one keep it beside a kernel that can execute it. Here, the page you are reading is the only place it goes, and nothing in it runs.

> Grey stops are someone else’s computer. Outlined stops can run code.

<!--compare:routes-->

<!--section:markdown-->
## Markdown files, too.

Open a `.md` file from your disk and it reads like a notebook. Edit it in the page you are reading, then save it back to the same file.

- Opens `.md` and `.markdown` by picking or dropping
- Edit the rendered text: double-click a paragraph, or press `e`
- A bar for bold, italic, code, links, headings and lists, with undo
- Save writes the same file in Chromium browsers; others download a copy

GitHub: edit the source, preview in another tab.

VS Code: the source, with a preview beside it.

<!--compare:editor:file-->

<!--section:choosing-->
## Each one is right for something.

Choose by what you need to do.

<!--compare:choose-->

<!--section:limits-->
## What it does not do

Said plainly, so the ticks above can be trusted.

- **Run code.** You see what the notebook saved, never new results.
- **Live widgets.** They need a kernel; their saved picture shows if there is one.
- **Edit code or outputs.** Only the text of text cells changes.
- **Export to PDF.** The browser’s print dialog does that.
- **Markdown from a link.** Markdown files open from disk.

<!--section:sources-->
## Sources and method

Each verdict links to the page it came from.

<!--compare:sources-->
