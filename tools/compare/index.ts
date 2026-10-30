import { readFileSync } from 'node:fs'
import { marked, type Token, type Tokens } from 'marked'
import { checked, groups, rows, tools } from '../../site/compare.ts'
import { shared } from './parts.ts'
import { only } from './table.ts'
import { glyph, month, same, width, word } from './text.ts'
import type { PageId, Part, Verdict } from './types.ts'

const FILES: Record<PageId, string> = { home: 'index.html', compare: 'site/compare.md' }
const MARK = /<!--compare:(\w+)(?::(\w+))?-->/g
const SOLO = /^<!--compare:(\w+)(?::(\w+))?-->$/
const SECTION = /^<!--section:([\w-]+)-->$/

// `list` styles the section's bullet lists: the class they carry and the glyph in front of each item.
const SECTIONS: Record<string, { kicker?: string; layout: 'full' | 'split' | 'half'; list?: [string, Verdict] }> = {
  table: { kicker: 'Side by side', layout: 'full' },
  reading: { kicker: 'Reading', layout: 'full' },
  'your-file': { kicker: 'Privacy', layout: 'full' },
  markdown: { kicker: 'Markdown', layout: 'split', list: ['ticks', 'yes'] },
  choosing: { kicker: 'Which to choose', layout: 'full' },
  limits: { layout: 'half', list: ['limits', 'no'] },
  sources: { layout: 'half' },
}

const TOC = [
  ['table', 'The table'],
  ['reading', 'Reading'],
  ['your-file', 'Your file'],
  ['markdown', 'Markdown'],
  ['choosing', 'Choosing'],
  ['sources', 'Sources'],
]

// the homepage's teaser names the count itself, so only the compare page places it
const count: Part = { pages: ['compare'], html: () => word(rows.length), md: () => word(rows.length) }

export const parts: Record<string, Part> = { ...shared, ...only, count }

const part = (name: string, variant: string | undefined, page: PageId) => {
  const p = parts[name]
  if (!p) throw new Error(`${FILES[page]}: <!--compare:${name}--> names no component`)
  if (variant && !p.variants?.includes(variant)) throw new Error(`${FILES[page]}: <!--compare:${name}:${variant}--> names no variant`)
  if (!p.pages.includes(page)) throw new Error(`${FILES[page]}: <!--compare:${name}--> is not meant for the ${page} page`)
  return p
}

/** Replaces every placeholder in an HTML string and nothing else. */
export const fill = (html: string, page: PageId) => html.replace(MARK, (_, name: string, variant?: string) => part(name, variant, page).html(variant))

const lines = (...xs: string[]) => xs.filter(Boolean).join('\n')
const inline = (s: string) => marked.parseInline(s.trim(), { async: false })
const para = (cls: string, s: string) => (s ? `<p class="${cls}">${s}</p>` : '')
const comment = (t: Token) => (t.type === 'html' ? (t as Tokens.HTML).raw.trim() : '')

const block = (t: Token, list?: [string, Verdict]) => {
  const m = SOLO.exec(comment(t))
  if (m) return part(m[1], m[2], 'compare').html(m[2])
  if (list && t.type === 'list') return `<ul class="${list[0]}">\n${(t as Tokens.List).items.map((i) => `<li>${glyph(list[1])}<span>${inline(i.text)}</span></li>`).join('\n')}\n</ul>`
  return marked.parser([t])
}

const opening = (tokens: Token[]) => {
  const [h1, ...rest] = tokens.filter((t) => t.type !== 'space')
  if (h1?.type !== 'heading') throw new Error('site/compare.md must open with a # heading')
  const lede = rest[0]?.type === 'paragraph' ? inline((rest.shift() as Tokens.Paragraph).text) : ''
  let art = ''
  const tail: string[] = []
  for (const t of rest) {
    if (SOLO.exec(comment(t))?.[1] === 'jobs') art = block(t)
    else tail.push(t.type === 'paragraph' ? para('note', inline((t as Tokens.Paragraph).text)) : block(t))
  }
  return lines(
    '<header class="opening">',
    '<div class="txt">',
    `<p class="k">Compared<span class="stamp">${glyph('yes')}Checked ${month(checked)}</span></p>`,
    `<h1>${inline((h1 as Tokens.Heading).text)}</h1>`,
    para('lede', lede),
    `<nav class="toc" aria-label="On this page">${TOC.map(([id, name]) => `<a href="#${id}">${name}</a>`).join('')}</nav>`,
    '</div>',
    `<div class="art">${art}</div>`,
    ...tail,
    '</header>',
  )
}

const section = (id: string, tokens: Token[]) => {
  const cfg = SECTIONS[id]
  if (!cfg) throw new Error(`site/compare.md: section "${id}" has no layout in tools/compare/index.ts`)
  const [head, ...rest] = tokens.filter((t) => t.type !== 'space')
  if (head?.type !== 'heading') throw new Error(`site/compare.md: section "${id}" must start with a ## heading`)
  const h2 = inline((head as Tokens.Heading).text)
  const lede = para('lede', rest[0]?.type === 'paragraph' ? inline((rest.shift() as Tokens.Paragraph).text) : '')
  const kicker = cfg.kicker ? `<p class="k">${cfg.kicker}</p>` : ''
  if (cfg.layout === 'half') return lines(`<section class="sec half" id="${id}">`, `<h2>${h2}</h2>`, lede, ...rest.map((t) => block(t, cfg.list)), '</section>')
  if (cfg.layout === 'split') {
    const art = rest.filter((t) => SOLO.test(comment(t)))
    return lines(
      `<section class="sec split reveal" id="${id}">`,
      `<div class="txt">${kicker}<h2>${h2}</h2>${lede}`,
      ...rest.filter((t) => !art.includes(t)).map((t) => block(t, cfg.list)),
      '</div>',
      `<div class="art">${art.map((t) => block(t)).join('\n')}</div>`,
      '</section>',
    )
  }
  const aside = rest[0]?.type === 'blockquote' ? para('aside', inline((rest.shift() as Tokens.Blockquote).text)) : ''
  return lines(`<section class="sec reveal" id="${id}">`, `<header class="sh"><div>${kicker}<h2>${h2}</h2>${lede}</div>${aside}</header>`, ...rest.map((t) => block(t, cfg.list)), '</section>')
}

const close = lines(
  '<section class="close reveal">',
  '<div><h2>Try it on a notebook of your own.</h2><p>It opens in this tab. Nothing is uploaded.</p></div>',
  '<div class="acts"><a class="solid" href="../">Open a notebook</a><a class="default" href="../?url=cooling-coffee.ipynb">See the demo</a><a class="quiet" href="../open-from-github/">Open from GitHub →</a></div>',
  '</section>',
)

/** The compare page's `<main>`, built from the Markdown body of site/compare.md. */
export const page = (body: string) => {
  const intro: Token[] = []
  const blocks: { id: string; tokens: Token[] }[] = []
  for (const t of marked.lexer(body)) {
    const m = SECTION.exec(comment(t))
    if (m) blocks.push({ id: m[1], tokens: [] })
    else (blocks.at(-1)?.tokens ?? intro).push(t)
  }
  const out: string[] = []
  let halves: string[] = []
  const flush = () => {
    if (halves.length) out.push(lines('<div class="halves">', ...halves, '</div>'))
    halves = []
  }
  for (const b of blocks) {
    const html = section(b.id, b.tokens)
    if (SECTIONS[b.id].layout === 'half') halves.push(html)
    else {
      flush()
      out.push(html)
    }
  }
  flush()
  return fill(lines('<main class="compare">', part('sprite', undefined, 'compare').html(), '<div class="wrap">', opening(intro), ...out, close, '</div>', '</main>'), 'compare')
}

/** The same walk as `page`, to Markdown: placeholders become their Markdown, section markers go, the rest is copied. */
export const markdown = (body: string) =>
  marked
    .lexer(body)
    .filter((t) => t.type !== 'space' && !SECTION.test(comment(t)))
    .map((t) => {
      const m = SOLO.exec(comment(t))
      return (m ? part(m[1], m[2], 'compare').md(m[2]) : t.raw).trim()
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(MARK, (_, name: string, variant?: string) => part(name, variant, 'compare').md(variant)) + '\n'

/** Throws, naming the row and the tool, when the data or a placeholder breaks a rule of the comparison. */
export const check = (guides: readonly string[]) => {
  const ids = new Set<string>()
  for (const r of rows) {
    if (ids.has(r.id)) throw new Error(`Row "${r.id}" appears twice`)
    ids.add(r.id)
    if (width(r.label) > 156) throw new Error(`Row "${r.id}": label "${r.label}" is ${width(r.label).toFixed(1)}px wide; the budget is 156px`)
    for (const t of tools) {
      const c = r.cells[t.id]
      if (!c) throw new Error(`Row "${r.id}" has no cell for ${t.name}`)
      if (width(c.say) > 114) throw new Error(`Row "${r.id}", ${t.name}: "${c.say}" is ${width(c.say).toFixed(1)}px wide; the budget is 114px`)
      if (t.id !== 'us' && !c.src?.startsWith('https://')) throw new Error(`Row "${r.id}", ${t.name}: a rival cell needs a src that starts with https://`)
    }
  }
  for (const g of groups) if (!rows.some((r) => r.group === g.id && !same(r))) throw new Error(`Group "${g.id}" has no row that differs between tools, so "Only differences" would empty it`)

  for (const m of readFileSync(FILES.compare, 'utf8').matchAll(/(?:\(|href=")\.\.\/([\w-]+)\//g)) {
    if (!guides.includes(m[1])) throw new Error(`${FILES.compare} links to ../${m[1]}/, which is not a built guide`)
  }

  // page() places the sprite itself
  const placed: Record<PageId, Set<string>> = { home: new Set(), compare: new Set(['sprite']) }
  for (const page of ['home', 'compare'] as const) {
    for (const m of readFileSync(FILES[page], 'utf8').matchAll(MARK)) {
      part(m[1], m[2], page)
      placed[page].add(m[1])
    }
  }
  for (const [name, p] of Object.entries(parts)) {
    for (const page of p.pages) if (!placed[page].has(name)) throw new Error(`<!--compare:${name}--> is meant for the ${page} page, but ${FILES[page]} never places it`)
  }
}
