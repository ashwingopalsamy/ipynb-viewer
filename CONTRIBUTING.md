# Contributing

Bug reports with a notebook that shows the problem are the most useful thing you can send. Code and documentation are welcome too.

## Setup

Node 22 or newer.

```sh
git clone https://github.com/ashwingopalsamy/ipynb-viewer
cd ipynb-viewer
npm install
npm run dev
```

## Checks

There is no CI yet, so run these before you open a pull request:

```sh
npm run check
npm test
npm run build
```

`npm run build` prints the gzipped size of every chunk. The entry chunk stays under 30 KB; anything new that does not fit loads lazily. Svelte features used only inside a lazy component can still be pulled into the entry chunk, so check the sizes after adding one.

## Layout

| Path | What lives there |
|---|---|
| `src/lib/notebook/` | The parser: streaming, forgiving of broken files, nbformat 3 and 4 |
| `src/lib/` | The reader, its components and the chunks it loads on demand |
| `public/fonts/` | Inter and JetBrains Mono, self-hosted under the OFL |
| `examples/` | Notebooks to try the reader on |
| `docs/` | How it works, and the keyboard |
| `tools/brand/` | The scripts that draw the images in `.github/assets/` |

## Rules that matter

- **Notebook code never runs.** Not in a worker, not behind a flag.
- **Untrusted content stays contained.** Markdown and HTML outputs pass through DOMPurify; see [SECURITY.md](SECURITY.md) before touching either.
- **Nothing phones home.** No analytics, no fonts or scripts from other hosts.
- **Motion is transform and opacity.** Nothing else animates, and `prefers-reduced-motion` turns it down.
- **Words are few.** Interface copy is short and plain. If a label needs a sentence, the design needs another look.
- **A fix comes with a test.** A parser bug gets a fixture in `src/lib/notebook/fixtures/`.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org): `feat(reader): ...`, `fix(parser): ...`, `docs: ...`. Keep a pull request to one change and fill in the template. Add a line to [CHANGELOG.md](CHANGELOG.md) for anything a reader would notice.

By contributing, you agree that your work is released under the [MIT licence](LICENSE).
