# Security policy

## Reporting a vulnerability

Do not report vulnerabilities in public issues. Use a private [security advisory](https://github.com/ashwingopalsamy/ipynb-viewer/security/advisories/new). Include a notebook that triggers it and the commit you saw it on.

## What the viewer promises

A notebook is untrusted input. The viewer reads it and never runs it.

- **No code runs.** Code cells are shown as text. There is no kernel, and nothing in a notebook reaches `eval` or a script tag.
- **Markdown is sanitized.** Cell Markdown is rendered to HTML and cleaned by DOMPurify, with `style` removed. Links open in a new tab without an opener.
- **HTML outputs are cut down to tables.** A pandas frame survives as plain table markup. Any other HTML output, scripted or not, is shown as its plain-text fallback.
- **The file stays local.** It is read in the browser and never uploaded.
- **The page goes quiet.** Once a notebook is open, the page narrows its own content security policy so it cannot open connections at all. A policy can only be tightened, never loosened, so the browser enforces this and the page cannot undo it.
- **The web is asked about.** A picture a notebook links to on the web is fetched only after you say yes, once per notebook (or always, or never, in Settings). Choosing to keep them blocked tightens the policy again, so the browser refuses them even if a sanitizer missed one. No referrer is sent either way.
- **A shared link asks first.** A page opened with `?url=` names the site it would fetch from and waits for you before any request.

After the first visit the app keeps its own files on the device (a service worker, `sw.js`), so a notebook opens with no request at all. The Privacy sheet in Settings counts the requests the page has made since the notebook opened, from the browser's own log.

## Planned

Rich and interactive outputs will render inside sandboxed iframes without same-origin access, with the static fallback as the default. That ships before the viewer can open a notebook from a link.

## Scope

Anything in this repository and the site at [ipynb.ashwingopalsamy.in](https://ipynb.ashwingopalsamy.in). A way to run notebook code or slip past the sanitizer is a vulnerability, not a bug.
