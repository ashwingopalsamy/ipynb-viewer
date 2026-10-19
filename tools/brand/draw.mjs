// Screenshots the built app with the example notebook, then renders the hero and social images.
import { chromium } from 'playwright'
import { preview } from 'vite'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve('../..')
const assets = resolve(root, '.github/assets')
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})

async function page(width, height, scale) {
  return browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale })
}

const server = await preview({ root, logLevel: 'silent', preview: { port: 4173, strictPort: true } })
for (const theme of ['light', 'dark']) {
  const p = await page(1440, 900, 2)
  await p.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await p.goto('http://localhost:4173/')
  // the footer tucks away once you scroll; a still frame has no scroll, so it goes
  await p.addStyleTag({ content: '.made{display:none!important}' })
  await p.setInputFiles('input[type=file]', resolve(root, 'examples/cooling-coffee.ipynb'))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `.cache/${theme}.png` })
  await p.close()
}
await server.httpServer.close()

async function render(html, out, width, height, transparent) {
  const p = await page(width, height, 1)
  await p.goto(pathToFileURL(resolve('.cache', html)).href)
  await p.waitForTimeout(800)
  await p.screenshot({ path: resolve(assets, out), omitBackground: transparent })
  await p.close()
}
await render('hero-light.html', 'hero-light.png', 2400, 1236, true)
await render('hero-dark.html', 'hero-dark.png', 2400, 1236, true)
await render('social.html', 'social-preview.png', 1280, 640, false)
await browser.close()
