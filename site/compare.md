---
title: ipynb viewer compared with nbviewer, GitHub, Colab and JupyterLab
description: A plain comparison of ways to read a Jupyter notebook, covering whether code runs, whether the file is uploaded, offline use, private files, size and export.
---

# ipynb viewer compared with nbviewer, GitHub, Colab and JupyterLab

These tools do different jobs. JupyterLab and Colab are for working on a notebook. nbviewer and GitHub show one. ipynb viewer only shows one, and tries to do that without anything leaving your device. Checked in October 2026 against each tool's documented behaviour; products change, so confirm anything that matters to you.

| | ipynb viewer | nbviewer | GitHub preview | Google Colab | JupyterLab |
|---|---|---|---|---|---|
| Runs the code | No | No | No | Yes, on Google's machines | Yes, on your kernel |
| Where the file is read | In your browser | On the nbviewer server, which fetches and renders it | On GitHub's servers | In the Colab service | On the machine running the server |
| Uploads your file | No for files; links go to the browser from GitHub, or via this site's Worker on the main copy | Public links are fetched by the server | The file is already in GitHub | Yes, to Drive or the session | Not to a third party |
| Works offline | Yes, after one visit | No | No | No | Yes, once installed |
| Private files | Open them from disk | Public links only | Needs access to the repository | Needs a Google sign-in | Open them from disk |
| Account needed | No | No | For private repositories | A Google account | No |
| Large files | Disk files are read in chunks with no set limit; links up to 50 MB | Depends on the service | GitHub may decline to render large notebooks | Depends on Drive and the session | Depends on your machine |
| Export | Markdown, cell and figure images | Download the file | Download or view raw | Several formats | Many formats through nbconvert |

## When to choose which

- Use ipynb viewer when you want to read a notebook quickly, in a browser, without installing anything and without sending the file anywhere, including one you received by email.
- Use nbviewer or the GitHub preview when you want a stable web address for a public notebook that others can open without this tool.
- Use Colab or JupyterLab when you want to run or edit the notebook.

## What the viewer does not do

It does not execute cells or show widgets that need a kernel. It edits only the text of text cells, never code or outputs. Interactive outputs are shown as what the notebook saved, and scripts wait behind a button in a sandbox. There is no PDF export; the browser's print dialog covers that.

## Links

ipynb viewer opens GitHub files and gists from a link, including the GitHub forms of Colab and nbviewer addresses, so a link made for one of those tools can be pasted here. See [opening a notebook from a GitHub link](../open-from-github/) for what is accepted and the limits.
