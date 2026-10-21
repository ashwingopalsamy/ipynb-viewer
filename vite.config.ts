import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { marked } from 'marked'
import { defineConfig, type Plugin } from 'vite'

// The font fallbacks (.woff, .ttf) are left out of the offline copy because every browser that can run the app takes the .woff2 files.
const SKIP = /\.(?:map|woff|ttf)$|^(?:sw\.js|_headers|404\.html|social-preview\.png|cooling-coffee\.ipynb|llms(?:-full)?\.txt)$|\.md$/

const kb = (n: number) => `${n < 10_000 ? (n / 1000).toFixed(1) : Math.round(n / 1000)} KB`
const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`
const ms = (n: number) => (n < 10 ? `${n} ms` : `${Math.round(n)} ms`)

type Part = 'math' | 'highlight' | 'markdown' | 'extras'
const partOf = (ids: string[]): Part =>
  ids.some((id) => id.includes('/katex/')) ? 'math' : ids.some((id) => /\/(?:shiki|@shikijs|oniguruma)/.test(id)) ? 'highlight' : ids.some((id) => /\/(?:marked|dompurify)\//.test(id)) ? 'markdown' : 'extras'

/**
 * Finishes a build. The home page (the About page) is filled in with figures read from the files just written, so its sizes are the
 * real ones, and the offline worker is written last with the list of every file the app can ask for.
 */
function finish(): Plugin {
  let out = 'dist'
  let base = ''
  const chunks = new Map<string, Part>()
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })
  const gz = (file: string) => gzipSync(readFileSync(join(out, file)), { level: 9 }).length

  return {
    name: 'finish',
    apply: 'build',
    // The build rewrites the landing page's stylesheet link and drops its id, and the app finds that link by id to switch it off once a
    // notebook opens. Without the id the landing page's `.cell` rule stays on and flattens every notebook cell.
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/<link rel="stylesheet"([^>]*href="[^"]*\/home-[^"]+\.css")/, '<link id="landing" rel="stylesheet"$1'),
    },
    configResolved: (config) => {
      out = config.build.outDir
      base = config.base.replace(/^\/|\/$/g, '')
    },
    generateBundle(_, bundle) {
      for (const [name, item] of Object.entries(bundle)) if (item.type === 'chunk' && !item.isEntry) chunks.set(name, partOf(Object.keys(item.modules)))
    },
    closeBundle() {
      const all = walk(out).map((f) => relative(out, f).split('\\').join('/'))
      const html = readFileSync(join(out, 'index.html'), 'utf8')
      const first = [...html.matchAll(/(?:src|href)="(?:\.\.\/|\/)?([^"]+\.(?:js|css))"/g)].map((m) => (base && m[1].startsWith(`${base}/`) ? m[1].slice(base.length + 1) : m[1]))
      const core = gz('index.html') + first.reduce((n, f) => n + gz(f), 0)

      // everything else that can load later, by what loads it
      const parts: Record<Part, number> = { math: 0, highlight: 0, markdown: 0, extras: 0 }
      let languages = 0
      let widest = 0
      for (const f of all) {
        if (!/\.(?:js|css)$/.test(f) || first.includes(f) || f === 'sw.js' || /^assets\/(?:home|guide)-/.test(f)) continue
        const size = gz(f)
        const part = /katex/i.test(f) ? 'math' : (chunks.get(f) ?? 'extras')
        parts[part] += size
        if (part === 'highlight' && f.endsWith('.js') && !/(?:core|engine|themes?)-/.test(f)) {
          languages++
          widest = Math.max(widest, size)
        }
      }
      const fonts = ['fonts/inter.woff2', 'fonts/jetbrains-mono.woff2'].reduce((n, f) => n + statSync(join(out, f)).size, 0)

      const rows: [string, string, number, boolean?][] = [
        ['First screen', 'Loads first', core, true],
        ['Reader extras', 'Search, menus, figures, exports', parts.extras],
        ['Markdown', 'Cleaner for prose', parts.markdown],
        ['Math', 'Only when a formula appears', parts.math],
        ['Highlighting', `${languages} languages, one at a time`, parts.highlight],
      ]
      const top = Math.max(...rows.map((r) => r[2]))
      const chart = rows
        .map(([name, note, size, head]) => `<div class="row${head ? ' first' : ''}"><span>${name}<small>${note}</small></span><div class="track"><i style="--w:${Math.max(0.012, size / top).toFixed(4)}"></i></div><b>${kb(size)}</b></div>`)
        .join('\n      ')

      const bench = JSON.parse(readFileSync('src/about/bench.json', 'utf8')) as { node: string; results: { name: string; bytes: number; cells: number; firstMs: number; totalMs: number }[] }
      const big = bench.results[bench.results.length - 1]
      const precache = all.filter((f) => !SKIP.test(f.split('/').pop()!)).sort()
      const download = precache.reduce((n, f) => n + (/\.(?:js|css|html|svg|webmanifest|txt|json)$/.test(f) ? gz(f) : statSync(join(out, f)).size), 0)

      const facts: Record<string, string> = {
        core: kb(core),
        chart: chart + `\n      <div class="row"><span>Fonts<small>Two files, cached</small></span><div class="track"><i style="--w:${Math.max(0.012, fonts / top).toFixed(4)}"></i></div><b>${kb(fonts)}</b></div>`,
        files: String(precache.length + 1),
        offline: mb(download),
        benchsize: `${Math.round(big.bytes / 1_000_000)} MB`,
        benchcells: big.cells.toLocaleString('en'),
        benchfirst: ms(big.firstMs),
        benchtotal: ms(big.totalMs),
        benchnote: `Measured with npm run bench on Node ${bench.node.replace(/^v/, '').split('.')[0]}, one core of a cloud server, reading in 64 KB chunks. Drawing the cells in the browser takes longer than reading them; this is the reader’s share.`,
      }
      const page = join(out, 'index.html')
      writeFileSync(page, readFileSync(page, 'utf8').replace(/<!--fact:(\w+)-->/g, (_, key: string) => facts[key] ?? (() => { throw new Error(`index.html asks for a fact that is not computed: ${key}`) })()))

      const hash = createHash('sha256')
      for (const f of precache) hash.update(f).update(readFileSync(join(out, f)))
      const template = readFileSync('tools/sw.template.js', 'utf8')
      writeFileSync(join(out, 'sw.js'), template.replace('__VERSION__', hash.digest('hex').slice(0, 10)).replace('__FILES__', JSON.stringify(precache)))
    },
  }
}

/** The guide pages, written in Markdown under site/, become static pages with no script, plus Markdown copies, llms.txt and the FAQ on the home page. */
function pages(): Plugin {
  const GUIDES = ['open-from-github', 'privacy', 'compare', 'agents', 'design']
  let base = '/'
  const source = (name: string) => readFileSync(join('site', name), 'utf8')
  const guide = (slug: string) => {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(source(`${slug}.md`))
    if (!m) throw new Error(`site/${slug}.md has no front matter`)
    const meta = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]))
    return { slug, title: meta.title, description: meta.description, body: source(`${slug}.md`).slice(m[0].length) }
  }
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  const questions = () =>
    source('faq.md')
      .split(/^## /m)
      .slice(1)
      .map((block) => {
        const [question, ...rest] = block.split('\n')
        return { question: question.trim(), answer: rest.join('\n').trim() }
      })

  return {
    name: 'pages',
    enforce: 'post',
    configResolved: (config) => {
      base = config.base
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const faq = questions()
        const ld = JSON.stringify({
          '@type': 'FAQPage',
          mainEntity: faq.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: text(marked.parse(answer, { async: false })) } })),
        }).replace(/</g, '\\u003c')
        return html
          .replace('<!--site:faq-->', () => faq.map(({ question, answer }) => `<h3>${esc(question)}</h3>\n    ${marked.parse(answer, { async: false }).trim()}`).join('\n    '))
          .replace('<!--site:faq-ld-->', () => ld)
          .replace('<!--site:alt-->', () => `<link rel="alternate" type="text/markdown" href="${base}index.md" />`)
      },
    },
    generateBundle(_, bundle) {
      const index = readFileSync('index.html', 'utf8')
      const theme = /<script>([\s\S]*?)<\/script>/.exec(index)?.[1]
      const footer = /<footer>[\s\S]*?<\/footer>/.exec(index)?.[0]
      const sheet = Object.keys(bundle).find((f) => /^assets\/home-.*\.css$/.test(f))
      if (!theme || !footer || !sheet) throw new Error('index.html is missing its theme script or footer, or the home stylesheet was not built')
      const style = this.getFileName(this.emitFile({ type: 'asset', name: 'guide.css', source: readFileSync('src/about/guide.css', 'utf8') }))
      // links to the guides are written for the home page; from a guide they go up one level
      const foot = footer.replace(/href="(?=(?:open-from-github|privacy|compare|agents|design)\/")/g, 'href="../').replace('src="/ashwin.webp"', `src="${base}ashwin.webp"`)
      const all = GUIDES.map(guide)

      for (const g of all) {
        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="color-scheme" content="light dark" />
<meta name="description" content="${esc(g.description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ipynb viewer" />
<meta property="og:title" content="${esc(g.title)}" />
<meta property="og:description" content="${esc(g.description)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#f5f5f7" />
<link rel="icon" href="${base}favicon.svg" />
<link rel="manifest" href="${base}manifest.webmanifest" />
<title>${esc(g.title)} · ipynb viewer</title>
<link rel="alternate" type="text/markdown" href="index.md" />
<link rel="stylesheet" href="${base}${sheet}" />
<link rel="stylesheet" href="${base}${style}" />
<script>${theme}</script>
</head>
<body>
<header class="bar">
  <div class="inner">
    <a class="name pill" href="../"><img src="${base}mark.svg" alt="" width="17" height="20" style="flex:none" />ipynb viewer</a>
  </div>
</header>
<main class="doc">
<article>
${marked.parse(g.body, { async: false })}
<p class="cta"><a href="../">Open a notebook</a></p>
</article>
</main>
${foot}
</body>
</html>
`
        this.emitFile({ type: 'asset', fileName: `${g.slug}/index.html`, source: html })
        this.emitFile({ type: 'asset', fileName: `${g.slug}/index.md`, source: g.body })
      }

      const summary = `${source('home.md').trim()}\n\n${source('faq.md').trim()}\n`
      this.emitFile({ type: 'asset', fileName: 'index.md', source: summary })
      this.emitFile({
        type: 'asset',
        fileName: 'llms.txt',
        source: `# ipynb viewer

> A free, open source web viewer for Jupyter notebooks (.ipynb). It reads a notebook in your browser, runs nothing and uploads nothing, opens files from disk or public GitHub links, and works offline.

ipynb viewer is a web page at https://ipynb.ashwingopalsamy.in/. Every page below has a Markdown version at the address shown.

## Pages

- [Home and questions](index.md): what it is and answers to common questions
${all.map((g) => `- [${g.title}](${g.slug}/index.md): ${g.description}`).join('\n')}

## Optional

- [Changelog](https://github.com/ashwingopalsamy/ipynb-viewer/blob/main/CHANGELOG.md)
- [Source code](https://github.com/ashwingopalsamy/ipynb-viewer)
`,
      })
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: [summary.trim(), ...all.map((g) => g.body.trim())].join('\n\n---\n\n') + '\n' })
    },
  }
}

export default defineConfig({
  plugins: [svelte(), pages(), finish()],
  build: {
    // Every browser the reader supports preloads modules natively, so the polyfill would only add weight to the first load.
    modulePreload: { polyfill: false },
    rolldownOptions: { input: { home: 'index.html' } },
  },
})
