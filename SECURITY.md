# Security policy

## Reporting a vulnerability

Do not report vulnerabilities in public issues. Use a private [security advisory](https://github.com/ashwingopalsamy/ipynb-viewer/security/advisories/new). Include a notebook that triggers it and the commit you saw it on.

## What the viewer promises

A notebook is untrusted input. The viewer reads it and never runs it.

- **No code runs.** Code cells are shown as text. There is no kernel, and nothing in a notebook reaches `eval` or a script tag.
- **Markdown is sanitized.** Cell Markdown is rendered to HTML and cleaned by DOMPurify, with `style` removed. Links open in a new tab without an opener.
- **HTML outputs are cut down to tables.** A pandas frame survives as plain table markup. Any other HTML output, scripted or not, is shown as its plain-text fallback.
- **The file stays local.** It is read in the browser and never uploaded.

One exception to the last point: an image that a notebook's Markdown links to on the web is fetched by your browser, with no referrer sent.

## Planned

Rich and interactive outputs will render inside sandboxed iframes without same-origin access, with the static fallback as the default. That ships before the viewer can open a notebook from a link.

## Scope

Anything in this repository and the site at [ipynb.ashwingopalsamy.in](https://ipynb.ashwingopalsamy.in). A way to run notebook code or slip past the sanitizer is a vulnerability, not a bug.
