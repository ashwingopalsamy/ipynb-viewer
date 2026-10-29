import { checked, groups, rows, tools } from '../../site/compare.ts'
import { esc, glyph, month, onlyHere, same } from './text.ts'
import type { Cell, Group, Part, Row, Tool, ToolId, Verdict } from './types.ts'

const ISSUES = 'https://github.com/ashwingopalsamy/ipynb-viewer/issues/new'
const WORDS: Record<Verdict, string> = { yes: 'Yes', part: 'Partly', no: 'No' }

const us = tools.find((t) => t.id === 'us')
if (!us) throw new Error('site/compare.ts has no "us" tool')
const rivals = tools.filter((t) => t.id !== 'us')

const cls = (id: ToolId) => (id === 'us' ? 'us' : `t t-${id}`)
const hasMore = (r: Row) => Object.values(r.cells).some((c) => c.more)
const flags = (r: Row) => `g-${r.group}${onlyHere(r) ? ' only' : ''}${same(r) ? ' same' : ''}`
const host = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')
const mark = '<svg aria-hidden="true"><use href="#mark"/></svg>'

const chip = (value: string, text: string, n: number, only = false) =>
  `<label class="chip${only ? ' only' : ''}"><input type="radio" name="f" value="${value}"${value === 'all' ? ' checked' : ''}>${only ? '<svg aria-hidden="true"><use href="#spark"/></svg>' : ''}${text} <em>${n}</em></label>`

const heading = (t: Tool) =>
  t.id === 'us'
    ? `<th class="us" scope="col" role="columnheader"><span class="who">${mark}${esc(t.name)}</span><small>${t.job} · this site</small></th>`
    : `<th class="${cls(t.id)}" scope="col" role="columnheader">${esc(t.name)}<small>${t.job}</small></th>`

const cell = (t: Tool, c: Cell) => `<td class="${cls(t.id)}" role="cell"><span class="v">${glyph(c.v)}${esc(c.say)}</span></td>`
const detail = (t: Tool, c: Cell) =>
  `<td class="${cls(t.id)}" role="cell">${c.more ? `${esc(c.more)}${c.src ? ` <a href="${esc(c.src)}">Source</a>` : ''}` : ''}</td>`

const rowHtml = (r: Row) => {
  const f = flags(r)
  const open = hasMore(r)
  const toggle = open
    ? `<label class="tg"><input type="checkbox"><span class="vh">Details for ${esc(r.label)}</span></label>`
    : '<span class="tg"></span>'
  const caption = onlyHere(r)
    ? '<small class="oh"><svg aria-hidden="true"><use href="#spark"/></svg>Only here</small>'
    : same(r)
      ? '<small class="eq">Same everywhere</small>'
      : ''
  const line = `<tr class="${f}" role="row"><th class="lab" scope="row" role="rowheader" id="${esc(r.id)}"><div class="lc">${toggle}<span class="lbl"><span class="nm">${esc(r.label)}</span>${caption}</span></div></th>${tools.map((t) => cell(t, r.cells[t.id])).join('')}</tr>`
  if (!open) return line
  return `${line}<tr class="${f} more" role="row"><td class="lab" role="cell"></td>${tools.map((t) => detail(t, r.cells[t.id])).join('')}</tr>`
}

const groupHtml = (g: Group) => {
  const rs = rows.filter((r) => r.group === g.id)
  const empty = tools.map((t) => `<td class="${cls(t.id)}" role="cell"></td>`).join('')
  return `<tr class="grp g-${g.id}" role="row"><th scope="rowgroup" role="rowheader">${esc(g.name)} <em>${rs.length}</em></th>${empty}</tr>${rs.map(rowHtml).join('')}`
}

const matrixHtml = () => {
  const chips = [
    chip('all', 'All', rows.length),
    ...groups.map((g) => chip(g.id, esc(g.name), rows.filter((r) => r.group === g.id).length)),
    chip('only', 'Only here', rows.filter(onlyHere).length, true),
  ].join('')
  const picker = `<div class="vs"><label for="mx-vs">${esc(us.name)} vs</label><span class="sel"><select id="mx-vs">${rivals.map((t) => `<option value="${t.id}"${t.id === 'colab' ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></span></div>`
  const controls = `<div class="ctl"><fieldset><legend class="vh">Show</legend>${chips}</fieldset><label class="sw"><input type="checkbox"><i aria-hidden="true"></i>Only differences</label></div>`
  const cols = `<colgroup><col class="lab"><col class="us">${rivals.map(() => '<col>').join('')}</colgroup>`
  const head = `<thead role="rowgroup"><tr role="row"><th class="lab" scope="col" role="columnheader"><span class="vh">What was checked</span></th>${tools.map(heading).join('')}</tr></thead>`
  const end = `<tfoot aria-hidden="true"><tr><td></td>${tools.map((t) => `<td class="${cls(t.id)}"></td>`).join('')}</tr></tfoot>`
  const key = (v: Verdict) => `<span class="key" aria-hidden="true">${glyph(v)}${WORDS[v]}</span>`
  const foot = `<div class="mxfoot">${key('yes')}${key('part')}${key('no')}<span>Checked ${month(checked)} against each tool’s documentation.</span><a href="#sources">Sources and method</a></div>`
  return `<div class="mxw">${picker}${controls}<table class="mx" role="table"><caption class="vh">One row for each thing checked, with a verdict for each tool.</caption>${cols}${head}<tbody role="rowgroup">${groups.map(groupHtml).join('')}</tbody>${end}</table>${foot}</div>`
}

const cellMd = (c: Cell) => `${WORDS[c.v]}: ${c.say.replace(/\|/g, '\\|')}`

const matrixMd = () =>
  [
    ...groups.map((g) => {
      const rs = rows.filter((r) => r.group === g.id)
      const table = [
        `| Feature | ${tools.map((t) => t.name).join(' | ')} |`,
        `| --- |${tools.map(() => ' --- |').join('')}`,
        ...rs.map((r) => `| ${r.label} | ${tools.map((t) => cellMd(r.cells[t.id])).join(' | ')} |`),
      ].join('\n')
      const notes = rs.flatMap((r) =>
        tools.flatMap((t) => {
          const c = r.cells[t.id]
          return c.more ? [`- **${r.label}, ${t.name}:** ${c.more}${c.src ? ` ([source](${c.src}))` : ''}`] : []
        }),
      )
      return [`### ${g.name}`, table, ...(notes.length ? [notes.join('\n')] : [])].join('\n\n')
    }),
    `Checked ${month(checked)} against each tool’s documentation. Sources and method are below.`,
  ].join('\n\n')

const card = (t: Tool) =>
  `<div class="card${t.id === 'us' ? ' us' : ''}"><div class="t">${t.id === 'us' ? mark : ''}<h3>${esc(t.name)}</h3><span class="tag">${t.job}</span></div><p><b>${esc(t.choose.lead)}</b> ${esc(t.choose.rest)}</p></div>`

const sourcesHtml = () =>
  `<div class="sources"><ul>${rivals.map((t) => `<li><b>${esc(t.name)}</b><a href="${esc(t.docs)}">${esc(host(t.docs))}</a><time datetime="${checked}">${month(checked)}</time></li>`).join('')}</ul><p class="method"><!--fact:benchnote--></p><p class="report">Something out of date? <a href="${ISSUES}">Open an issue.</a></p></div>`

const sourcesMd = () =>
  [
    rivals.map((t) => `- ${t.name}: [${host(t.docs)}](${t.docs}), checked ${month(checked)}`).join('\n'),
    '<!--fact:benchnote-->',
    `Something out of date? [Open an issue.](${ISSUES})`,
  ].join('\n\n')

export const only: Record<'matrix' | 'choose' | 'sources', Part> = {
  matrix: { pages: ['compare'], html: matrixHtml, md: matrixMd },
  choose: {
    pages: ['compare'],
    html: () => `<div class="choose">${tools.map(card).join('')}</div>`,
    md: () => tools.map((t) => `- **${t.name}** (${t.job}): **${t.choose.lead}** ${t.choose.rest}`).join('\n'),
  },
  sources: { pages: ['compare'], html: sourcesHtml, md: sourcesMd },
}
