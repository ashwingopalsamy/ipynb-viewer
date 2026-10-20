import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'

// The font fallbacks (.woff, .ttf) are left out of the offline copy because every browser that can run the app takes the .woff2 files.
const SKIP = /\.(?:map|woff|ttf)$|^(?:sw\.js|_headers|404\.html|social-preview\.png)$/

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
    configResolved: (config) => void (out = config.build.outDir),
    generateBundle(_, bundle) {
      for (const [name, item] of Object.entries(bundle)) if (item.type === 'chunk' && !item.isEntry) chunks.set(name, partOf(Object.keys(item.modules)))
    },
    closeBundle() {
      const all = walk(out).map((f) => relative(out, f).split('\\').join('/'))
      const html = readFileSync(join(out, 'index.html'), 'utf8')
      const first = [...html.matchAll(/(?:src|href)="(?:\.\.\/|\/)?([^"]+\.(?:js|css))"/g)].map((m) => m[1])
      const core = gz('index.html') + first.reduce((n, f) => n + gz(f), 0)

      // everything else that can load later, by what loads it
      const parts: Record<Part, number> = { math: 0, highlight: 0, markdown: 0, extras: 0 }
      let languages = 0
      let widest = 0
      for (const f of all) {
        if (!/\.(?:js|css)$/.test(f) || first.includes(f) || f === 'sw.js' || /^assets\/home-/.test(f)) continue
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

export default defineConfig({
  plugins: [svelte(), finish()],
  build: {
    // Every browser the reader supports preloads modules natively, so the polyfill would only add weight to the first load.
    modulePreload: { polyfill: false },
    rolldownOptions: { input: { home: 'index.html' } },
  },
})
