---
title: How ipynb viewer keeps a notebook private
description: What the viewer does and does not send, how the page locks its own network connections, and how to check it yourself.
---

# How ipynb viewer keeps a notebook private

A notebook can hold keys, tokens, customer data and scripts. ipynb viewer treats the file as untrusted input and keeps it on your device. This page says how, and what to check.

## The file stays in the page

A notebook you drop or choose is read with the browser's file APIs and parsed in the page. There is no upload and no server that receives it. The share link feature puts a notebook after the `#` of an address, and browsers do not send that part to servers.

## The page shuts its own connections

When a notebook is open, the page adds a Content Security Policy that forbids network connections. A policy can be tightened but never loosened for the life of a document, so the browser enforces this even if the app had a bug. The order is fixed: connections close first, and pictures from the web stay blocked until you allow them for that notebook.

The Privacy sheet in Settings shows the result. It counts the requests the page has made since the notebook opened, using the browser's own resource timing and policy violation reports, so the count is the browser's and not the app's.

## Links are the exception, and are asked about

A notebook opened from a link has to be downloaded. The viewer names the site first and fetches only when you say yes. The download happens before anything is drawn, so the lock can follow. On ipynb.ashwingopalsamy.in the download goes through a small Worker on the same site, which allows only GitHub files and gists, passes the bytes through, and keeps no record of the address. The Cloudflare setting that stores logs is left off. The GitHub Pages mirror fetches directly from the browser.

## Outputs are cleaned and scripts are boxed

- Markdown and HTML are sanitised before they are shown, and styles that could fetch something are dropped.
- An output that carries a script waits behind a button and runs in a sandboxed frame. The frame cannot reach the page and has no network unless you turn it on.
- Pictures that live on the web are blocked until you choose to load them.

## The offline copy

After the first visit the app keeps its own files on your device through a service worker. Opening a notebook then makes no request at all. A new version waits until the old tabs close, so files never change under a notebook you are reading. Nothing about a notebook is stored apart from where you stopped reading.

## Secrets before you share

The notebook sheet looks for keys and tokens in code and outputs. Copy as Markdown hides likely secrets unless you turn that off, and the tools offered to an in-browser agent hide them the same way.

## Check it yourself

1. Open the browser's developer tools and the Network tab.
2. Switch the wifi off and reload. The app still loads from its offline copy.
3. Drop a notebook. Nothing is requested.
4. Open the Privacy sheet and read the count.

The source is public at github.com/ashwingopalsamy/ipynb-viewer under the MIT licence, and SECURITY.md in the repository says how to report a problem.
