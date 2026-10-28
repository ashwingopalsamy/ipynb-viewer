// Screenshots the viewer with a paragraph of the example notebook open for editing, light and dark, for the README.
// Run from tools/brand. BASE points at a running copy (npm run dev); without it the built app in dist/ is served.
import { chromium } from 'playwright'
import { preview } from 'vite'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const root = resolve('../..')
const assets = resolve(root, '.github/assets')
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const server = process.env.BASE ? null : await preview({ root, logLevel: 'silent', preview: { port: 4173, strictPort: true } })
const base = process.env.BASE ?? 'http://localhost:4173'

const height = {}
for (const theme of ['light', 'dark']) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await p.addInitScript((t) => (localStorage.setItem('theme', t), localStorage.setItem('edit-hint', '1')), theme)
  await p.goto(`${base}/`)
  await p.addStyleTag({ content: '.made,.notice-pill{display:none!important}' })
  await p.setInputFiles('input[type=file]', resolve(root, 'examples/cooling-coffee.ipynb'))
  await p.locator('.md [data-b]', { hasText: "Newton's law of cooling" }).first().waitFor()
  await p.waitForTimeout(2500)
  await p.locator('.md [data-b]', { hasText: "Newton's law of cooling" }).first().dblclick({ position: { x: 300, y: 12 } })
  await p.locator('.fmt').waitFor()
  await p.waitForTimeout(1500)
  // the header and the open cell, to a little below its card
  const card = await p.locator('.md:has(> .editing)').boundingBox()
  height[theme] = Math.ceil(card.y + card.height + 28)
  await p.screenshot({ path: `.cache/edit-${theme}-raw.png`, clip: { x: 0, y: 0, width: 1440, height: height[theme] } })
  await p.close()
}
await server?.httpServer.close()

// a window-shaped card with a soft shadow, on a transparent ground, as the hero is
for (const theme of ['light', 'dark']) {
  const p = await browser.newPage({ viewport: { width: 1520, height: height[theme] + 88 }, deviceScaleFactor: 2 })
  const shadow = theme === 'light' ? '0 30px 60px -20px rgba(10,10,20,.30), 0 10px 24px -12px rgba(10,10,20,.20)' : '0 30px 60px -20px rgba(0,0,0,.65)'
  const edge = theme === 'light' ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.14)'
  writeFileSync(`.cache/edit-${theme}.html`, `<style>html,body{margin:0;background:transparent}
body{padding:36px 40px 52px;width:max-content}
img{display:block;width:1440px;border-radius:26px;corner-shape:squircle;box-shadow:0 0 0 1px ${edge},${shadow}}</style>
<img src="edit-${theme}-raw.png">`)
  await p.goto(pathToFileURL(resolve('.cache', `edit-${theme}.html`)).href)
  await p.locator('img').evaluate((i) => i.decode())
  await p.screenshot({ path: resolve(assets, `edit-${theme}.png`), omitBackground: true })
  await p.close()
}
await browser.close()
