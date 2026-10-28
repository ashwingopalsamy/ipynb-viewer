## How do I open an .ipynb file without Jupyter?

Drop the file on ipynb viewer, or click the page and choose it. The notebook is read in your browser, so there is no server to start, no kernel to install and no account to make. Prose, code, math and outputs are shown as a document, and the file is never executed.

## Can I open a notebook from a GitHub link?

Yes. Paste a link to a public notebook into the field on the home page, or open `?url=` followed by the address. GitHub file pages (`github.com/user/repo/blob/branch/path.ipynb`), raw links, gists (`gist.github.com/user/id`), and the GitHub and gist forms of Colab and nbviewer addresses all work. On ipynb.ashwingopalsamy.in these links are fetched through the site's own Worker, so only GitHub files and gists open there. The GitHub Pages mirror fetches any https address that allows other sites to read it. The site you link to is named before anything is fetched, and you decide whether to go ahead.

## Can I edit a notebook?

Yes, the text cells. Double-click a paragraph, heading or list, or press `e`, and write; a bar offers undo, bold, italic, code, links, headings and lists. Code and outputs are never changed and nothing runs. Saving changes only the text of the cells you edited, so figures, tables and outputs stay as they were. Markdown (`.md`) files edit the same way.

## Can I edit a notebook from a link and save it?

Yes. A notebook opened from a GitHub link can be edited like any other. It has no file on your computer to write to, so Save makes a copy: in Chromium browsers you choose where to put `name (edited).ipynb`, and other browsers download it. A notebook you opened from your own disk in a Chromium browser is saved into that same file with Save, or into a new one with Save a copy. Nothing is uploaded at any point.

## Is my notebook uploaded?

No. A file from your disk is read inside the page and goes nowhere. Once a notebook is open, the page shuts its own network connections, and the browser enforces that, so the Privacy sheet in Settings can count what the page has sent since. A notebook opened from a GitHub link is downloaded to your browser from GitHub and is not stored.

## Does it run the code?

No. It never runs a notebook's code. Markdown and HTML outputs are cleaned before they are shown. An output that carries a script waits behind a button and runs in a sandboxed frame with no access to the page, and no network unless you allow it.

## Does it work offline?

Yes, after the first visit. The app keeps its own files on your device, so opening a notebook from disk with the network off works. Links need a network, because the file has to come from somewhere.

## How large a notebook can it open?

A notebook opened from a link can be up to 50 MB. A file from disk has no limit set by the viewer; it is read in chunks and cells appear while the rest is still being read. In the project's own benchmark a 12 MB notebook is read in about 100 milliseconds on one server core, and drawing the cells in the browser takes longer than reading them.

## How do I share a notebook?

The notebook sheet can make a link that carries the notebook after the `#`. The part after the `#` is never sent to a server, so the link works without anyone hosting the file. Pictures are dropped first and then outputs when the notebook is too long for a link. For a notebook that already lives on GitHub, share the GitHub link as `?url=` instead.

## Can I export a notebook to Markdown, images or PDF?

Markdown and images, yes; PDF, no. Press `m` to copy the notebook as Markdown, with long outputs trimmed, an optional size budget for a language model, and likely secrets hidden. Press `s` to save a cell as an image, and every plot can be saved from the figures shelf as PNG, JPEG or WebP. To make a PDF, use the browser's print dialog.

## Which browsers support live refresh?

Chromium browsers (Chrome, Edge, Brave and others) that can keep a handle to the file. When you open a notebook from disk there, the view follows when you save it. Other browsers open the file once and do not watch it.

## Can it open notebooks from private repositories?

No. Links are fetched without cookies or sign-in details, so only public files can be opened. For a private notebook, download it and drop it on the page.
