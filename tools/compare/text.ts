import { readFileSync } from 'node:fs'
import type { Row, Verdict } from './types.ts'

// Inter Medium advances in thousandths of an em, measured once in a browser (canvas measureText at 1000px); measure again if the font changes
const advances: Record<string, number> = JSON.parse(readFileSync('tools/compare/widths.json', 'utf8')).advances

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TENS: Record<number, string> = { 2: 'Twenty', 3: 'Thirty', 4: 'Forty' }
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
export const word = (n: number) => {
  if (!Number.isInteger(n) || n < 20 || n > 40) throw new Error(`No word for ${n}; the comparison is written for twenty to forty rows`)
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
}

/** Width in pixels at `px` Inter Medium, summed without kerning, so it reads 1 to 2px wide. */
export const width = (s: string, px = 14) =>
  ([...s].reduce((n, ch) => {
    const a = advances[ch]
    if (a === undefined) throw new Error(`No width for "${ch}" in "${s}"; measure it into tools/compare/widths.json`)
    return n + a
  }, 0) * px) / 1000

const GLYPHS: Record<Verdict, [string, string]> = { yes: ['y', 'Yes'], part: ['p', 'Partly'], no: ['n', 'No'] }
export const glyph = (v: Verdict) => `<svg class="g" aria-hidden="true"><use href="#${GLYPHS[v][0]}"/></svg><span class="vh">${GLYPHS[v][1]}: </span>`

export const onlyHere = (r: Row) => r.cells.us.v === 'yes' && Object.entries(r.cells).every(([id, c]) => id === 'us' || c.v !== 'yes')
export const same = (r: Row) => Object.values(r.cells).every((c) => c.v === r.cells.us.v)

export const month = (checked: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(checked)) throw new Error(`checked must be YYYY-MM, not "${checked}"`)
  return new Date(`${checked}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
