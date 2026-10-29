## How do I open an .ipynb file without Jupyter?

Drop the file on ipynb viewer, or click the page and choose it. The notebook is read in your browser, so there is no server to start, no kernel to install and no account to make. Prose, code, math and outputs are shown as a document, and the file is never executed.

## Can it open Markdown files?

Yes. Drop or choose a `.md` file and it opens as a notebook of one text cell, with headings, lists, tables, code blocks and math drawn the same way. You can edit it in place and save it back like any notebook. A Markdown file opens from your disk; links open notebooks.

## Can I open a notebook from a GitHub link?

Yes. Paste a link to a public notebook into the field on the home page, or open `?url=` followed by the address. GitHub file pages (`github.com/user/repo/blob/branch/path.ipynb`), raw links, gists (`gist.github.com/user/id`), and the GitHub and gist forms of Colab and nbviewer addresses all work. On ipynb.ashwingopalsamy.in these links are fetched through the site's own Worker, so only GitHub files and gists open there. The GitHub Pages mirror fetches any https address that allows other sites to read it. The site you link to is named before anything is fetched, and you decide whether to go ahead.

## Can I edit a notebook?

Yes, the text cells. Double-click a paragraph, heading or list, or press `e`, and write; a bar offers undo, bold, italic, code, links, headings and lists. Code and outputs are never changed and nothing runs. Saving changes only the text of the cells you edited, so figures, tables and outputs stay as they were. Markdown (`.md`) files edit the same way.

## Can I edit a notebook from a link and save it?

Yes. A notebook opened from a GitHub link can be edited like any other. It has no file on your computer to write to, so Save makes a copy: in Chromium browsers you choose where to put `name (edited).ipynb`, and other browsers download it. A notebook you opened from your own disk in a Chromium browser is saved into that same file with Save, or into a new one with Save a copy. Nothing is uploaded at any point.

## Is my notebook uploaded?

No. A file from your disk is read inside the page and goes nowhere. Once a notebook is open, the page shuts its own network connections, and the browser enforces that: a policy can be tightened but never loosened for the life of a page, so even a bug in the app could not send the file out. The Privacy sheet in Settings counts what the page has sent since, from the browser's own record. A notebook opened from a GitHub link is downloaded to your browser from GitHub and is not stored.

## What happens when I open a link?

The site is named first, and nothing is fetched until you say yes. The file is downloaded before anything is drawn, so the page can shut its connections after. On ipynb.ashwingopalsamy.in the download goes through a small Worker on the same site, which allows only GitHub files and gists, passes the bytes through, and keeps no record of the address. Cloudflare's stored logs are off; the Worker keeps only counts of how downloads ended, by GitHub host and country, with no address, IP or identifier. The GitHub Pages mirror fetches straight from your browser.

## Does it keep anything about my notebook?

Only where you stopped reading, so it can offer to take you back. After the first visit the app keeps its own files on your device so it works offline, and a new version takes over only when no notebook you are reading would change under you. For tabs opened from links, their web addresses are kept for the browser tab's session, so a reload brings them back; files are never kept.

## How can I check this myself?

1. Open the browser's developer tools and the Network tab.
2. Switch the wifi off and reload. The app still loads from its offline copy.
3. Drop a notebook. Nothing is requested.
4. Open the Privacy sheet in Settings and read the count.

The source is public on GitHub under the MIT licence, and SECURITY.md there says how to report a problem.

## Does it run the code?

No. It never runs a notebook's code. Markdown and HTML outputs are cleaned before they are shown. An output that carries a script waits behind a button and runs in a sandboxed frame with no access to the page, and no network unless you allow it.

## Does it work offline?

Yes, after the first visit. The app keeps its own files on your device, so opening a notebook from disk with the network off works. Links need a network, because the file has to come from somewhere.

## How large a notebook can it open?

A notebook opened from a link can be up to 50 MB. A file from disk has no limit set by the viewer; it is read in chunks and cells appear while the rest is still being read. In the project's own benchmark a 12 MB notebook is read in about 100 milliseconds on one server core, and drawing the cells in the browser takes longer than reading them.

## How do I share a notebook?

The notebook sheet can make a link that carries the notebook after the `#`. The part after the `#` is never sent to a server, so the link works without anyone hosting the file. Pictures are dropped first and then outputs when the notebook is too long for a link. Before you share, the same sheet looks for keys and tokens in code and outputs, and Copy as Markdown hides likely secrets unless you turn that off. For a notebook that already lives on GitHub, share the GitHub link as `?url=` instead.

## Can I export a notebook to Markdown, images or PDF?

Markdown and images, yes; PDF, no. Press `m` to copy the notebook as Markdown, with long outputs trimmed, an optional size budget for a language model, and likely secrets hidden. Press `s` to save a cell as an image, and every plot has a Save figure button for PNG, JPEG or WebP. To make a PDF, use the browser's print dialog.

## Which browsers support live refresh?

Chromium browsers (Chrome, Edge, Brave and others) that can keep a handle to the file. When you open a notebook from disk there, the view follows when you save it. Other browsers open the file once and do not watch it.

## Can it open notebooks from private repositories?

No. Links are fetched without cookies or sign-in details, so only public files can be opened. For a private notebook, download it and drop it on the page.
