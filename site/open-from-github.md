---
title: Open a notebook from a GitHub link
description: Which GitHub, gist, Colab and nbviewer links ipynb viewer opens, how the link is passed, and what it will not open.
---

# Open a notebook from a GitHub link

ipynb viewer can open a public notebook from a web address. Paste the address into the field on the home page, or build the link yourself: the home page followed by `?url=` and the address. The address should be percent-encoded.

```
https://ipynb.ashwingopalsamy.in/?url=https%3A%2F%2Fgithub.com%2Fashwingopalsamy%2Fipynb-viewer%2Fblob%2Fmain%2Fexamples%2Fcooling-coffee.ipynb
```

An address without `https://` is accepted when it starts with a host name, so `github.com/user/repo/blob/main/analysis.ipynb` works too.

## Addresses that work

- A file page on GitHub: `github.com/user/repo/blob/branch/path/file.ipynb`, or the same with `raw` in place of `blob`.
- A raw file: `raw.githubusercontent.com/user/repo/branch/path/file.ipynb`. A commit hash can stand in for the branch, which pins the file to that version.
- A gist: `gist.github.com/user/id`, or just `gist.github.com/id`. The first `.ipynb` file in the gist opens. A `#file-name-ipynb` ending picks a particular file when a gist has several.
- A raw gist file: `gist.githubusercontent.com/user/id/raw/file.ipynb`.
- The GitHub and gist forms of Colab and nbviewer addresses: `colab.research.google.com/github/user/repo/blob/branch/file.ipynb` and `nbviewer.org/github/user/repo/blob/branch/file.ipynb`, and the matching `/gist/` forms.

## Which hosts are reached

On ipynb.ashwingopalsamy.in the page may only talk to its own site. Links to GitHub files and gists are therefore fetched through a small Worker on that site, which passes the file back and keeps no record of it. Other hosts are not opened on that copy. The GitHub Pages mirror has no such Worker and fetches directly, so on the mirror any https address works if the server allows other sites to read its files (CORS). When you run the viewer yourself, it behaves like the mirror.

## The question before the fetch

A link in the address bar is never fetched silently. The viewer first says which site it points to, and that fetching tells that site your address and the time. Choose Fetch notebook to go on, or Cancel to stop. You can tick "Do not ask again" for a site you trust. On the Cloudflare copy the site sees this site's address rather than yours, because the Worker makes the request.

## Limits

- A linked notebook can be up to 50 MB. The size is checked against what the server announces and against what actually arrives.
- A server that says nothing for 20 seconds is given up on.
- Only https addresses are opened, with no user name or password in the address. Addresses on a local or private network are refused.
- The request carries no cookies, no referrer and no headers of our own.
- The file is drawn while it is still arriving, so the first cells appear before the download finishes.

## What does not open

- Private repositories. Requests are made without sign-in details, so GitHub answers as it would to a stranger, with a 404.
- Google Drive notebooks, including Colab links that point into Drive. Download the file and drop it on the page.
- GitHub pages that are not files, such as a repository or folder. Open the notebook there and copy the address of the file page.
- An address that returns a web page rather than a notebook.

## Opening a link while a notebook is on screen

Once a notebook is shown, the page has closed its own connections and cannot loosen that. Opening a link from the Open card therefore opens it in a new tab, which is a fresh page of its own, after asking the question above. If you decline, the notebook you were reading stays where it is.
