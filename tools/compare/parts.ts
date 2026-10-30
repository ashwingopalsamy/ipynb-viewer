import { checked, rows, tools } from '../../site/compare.ts'
import { esc, glyph, month, word } from './text.ts'
import type { PageId, Part, ToolId, Verdict } from './types.ts'

const both: readonly PageId[] = ['home', 'compare']
const mark = '<svg class="mk" aria-hidden="true"><use href="#mark"/></svg>'
const arrow = (long: boolean) => `<svg class="arrow${long ? ' long' : ''}" aria-hidden="true"><use href="#ar"/></svg>`
const code = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
const rivals = tools.filter((t) => t.id !== 'us')

const toolName = (id: ToolId) => {
  const t = tools.find((x) => x.id === id)
  if (!t) throw new Error(`No tool "${id}" in site/compare.ts`)
  return t.name
}

const sprite: Part = {
  pages: both,
  html: () =>
    [
      '<svg class="sprite" width="0" height="0" aria-hidden="true">',
      '<symbol id="rose" viewBox="0 0 18 18"><path d="M9 .8 9.5 .9 10 1.2 10.5 1.6 10.9 2 11.3 2.3 11.7 2.5 12.1 2.7 12.6 2.7 13.2 2.7 13.8 2.7 14.4 2.9 14.8 3.2 15.1 3.6 15.3 4.2 15.3 4.8 15.3 5.4 15.3 5.9 15.4 6.3 15.7 6.7 16 7.1 16.4 7.5 16.8 8 17.1 8.5 17.2 9 17.1 9.5 16.8 10 16.4 10.5 16 10.9 15.7 11.3 15.4 11.7 15.3 12.1 15.3 12.6 15.3 13.2 15.3 13.8 15.1 14.4 14.8 14.8 14.4 15.1 13.8 15.3 13.2 15.3 12.6 15.3 12.1 15.3 11.7 15.4 11.3 15.7 10.9 16 10.5 16.4 10 16.8 9.5 17.1 9 17.2 8.5 17.1 8 16.8 7.5 16.4 7.1 16 6.7 15.7 6.3 15.4 5.9 15.3 5.4 15.3 4.8 15.3 4.2 15.3 3.6 15.1 3.2 14.8 2.9 14.4 2.7 13.8 2.7 13.2 2.7 12.7 2.7 12.1 2.5 11.7 2.3 11.3 2 10.9 1.6 10.5 1.2 10 .9 9.5 .8 9 .9 8.5 1.2 8 1.6 7.5 2 7.1 2.3 6.7 2.5 6.3 2.7 5.9 2.7 5.3 2.7 4.8 2.7 4.2 2.9 3.6 3.2 3.2 3.6 2.9 4.2 2.7 4.8 2.7 5.3 2.7 5.9 2.7 6.3 2.5 6.7 2.3 7.1 2 7.5 1.6 8 1.2 8.5 .9Z"/></symbol>',
      '<symbol id="y" viewBox="0 0 18 18"><use href="#rose" style="fill:var(--tick)"/><path d="m5.7 9.3 2.2 2.2 4.4-4.7" style="fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round"/></symbol>',
      '<symbol id="p" viewBox="0 0 18 18"><use href="#rose" style="fill:var(--part)"/><path d="m5.7 9.3 2.2 2.2 4.4-4.7" style="fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round"/></symbol>',
      '<symbol id="n" viewBox="0 0 18 18"><path d="M5.5 9h7" style="stroke:var(--fg-3);stroke-width:1.8;stroke-linecap:round;opacity:.8"/></symbol>',
      '<symbol id="spark" viewBox="0 0 12 12"><path d="M6 .5c.35 2.6 2.4 4.65 5 5-2.6.35-4.65 2.4-5 5-.35-2.6-2.4-4.65-5-5 2.6-.35 4.65-2.4 5-5Z" style="fill:currentColor"/></symbol>',
      '<symbol id="mark" viewBox="0 0 40 48"><rect width="40" height="48" rx="10" fill="#1d1d1f" style="stroke:var(--line-2);stroke-width:1.5"/><circle cx="12" cy="13" r="4" fill="#4cc38a"/><rect x="9" y="25" width="22" height="4" rx="2" fill="#fff" opacity=".9"/><rect x="9" y="33" width="15" height="4" rx="2" fill="#fff" opacity=".55"/></symbol>',
      '<symbol id="ar" viewBox="0 0 30 12"><path d="M1 6h27m-5-5 5 5-5 5"/></symbol>',
      '</svg>',
    ].join(''),
  md: () => '',
}

const jobLanes = [
  ['Shows', 'rendered on a server'],
  ['Runs', 'on a kernel'],
  ['Reads', 'in your browser, nothing else'],
] as const

const jobs: Part = {
  pages: both,
  html: () =>
    `<div class="jobs">${jobLanes
      .map(([job, note]) => {
        const nodes = tools
          .filter((t) => t.job === job)
          .map((t) => `<span class="node">${t.id === 'us' ? mark : ''}${esc(t.name)}</span>`)
          .join('')
        return `<div class="lane${job === 'Reads' ? ' us' : ''}"><b>${job}</b>${nodes}<small>${note}</small></div>`
      })
      .join('')}</div>`,
  md: () =>
    jobLanes
      .map(([job, note]) => `- ${job}: ${tools.filter((t) => t.job === job).map((t) => t.name).join(', ')} (${note})`)
      .join('\n'),
}

const figures: Part = {
  pages: both,
  variants: ['home'],
  html: (variant) => {
    const home = variant === 'home'
    const tiles = [
      ['0 bytes', 'leave your device when you open a file from disk', home ? '#privacy' : '../#privacy', home ? 'Where your file goes' : 'Check it yourself'],
      ['<!--fact:core-->', 'for the first screen, gzipped. The rest loads only when a notebook needs it', home ? '#speed' : '../#speed', home ? 'Small on purpose' : 'What loads when'],
      ['<!--fact:benchtotal-->', 'to read a <!--fact:benchsize--> notebook of <!--fact:benchcells--> cells', home ? '#speed' : '#sources', home ? 'Cells while it reads' : 'How it is measured'],
      ['<!--fact:offline-->', 'downloaded once; after that it opens with the wifi off', home ? '#offline' : '../#offline', home ? 'The offline copy' : 'What is kept'],
    ]
      .map(([fig, say, to, link]) => `<div class="fig"><b>${fig}</b><span>${say}</span><a href="${to}">${link}</a></div>`)
      .join('')
    return `<div class="figs">${tiles}</div>`
  },
  md: (variant) => {
    const home = variant === 'home'
    // the build fills facts into the Markdown copies too
    return [
      `- **0 bytes** leave your device when you open a file from disk. [${home ? 'Where your file goes' : 'Check it yourself'}](${home ? '#privacy' : '../#privacy'})`,
      `- **<!--fact:core-->** for the first screen, gzipped; the rest loads only when a notebook needs it. [${home ? 'Small on purpose' : 'What loads when'}](${home ? '#speed' : '../#speed'})`,
      `- **<!--fact:benchtotal-->** to read a <!--fact:benchsize--> notebook of <!--fact:benchcells--> cells.${home ? ' [Cells while it reads](#speed)' : ' See Sources and method.'}`,
      `- **<!--fact:offline-->** downloaded once; after that it opens with the wifi off. [${home ? 'The offline copy' : 'What is kept'}](${home ? '#offline' : '../#offline'})`,
    ].join('\n')
  },
}

const teaser: Part = {
  pages: ['home'],
  html: () => {
    if (rivals.length !== 5) throw new Error('The teaser says "five tools"; update its wording with the data')
    return `<a class="teaser" href="compare/" aria-labelledby="teaser-h teaser-go"><div><div class="k">The full comparison</div><h3 id="teaser-h">${word(rows.length)} things, checked against five tools.</h3><p>Filter by what you care about, hide the rows that are the same everywhere, and open any row for its source.</p></div><div class="cr"><div class="tl" aria-hidden="true">${rivals.map((t) => `<span>${esc(t.name)}</span>`).join('')}</div><span class="go" id="teaser-go">Compare them <i aria-hidden="true">→</i></span></div></a>`
  },
  md: () => `**${word(rows.length)} things, checked against five tools.** [Compare them](compare/index.md). Last checked ${month(checked)}.`,
}

// Raw output is a list of segments, so one source gives the fenced block and the highlighted <pre>.
type Seg = string | [text: string, cls: 'dim' | 'bad']
const plain = (s: Seg[]) => s.map((x) => (typeof x === 'string' ? x : x[0])).join('')
const marked = (s: Seg[]) => s.map((x) => (typeof x === 'string' ? esc(x) : `<span class="${x[1]}">${esc(x[0])}</span>`)).join('')

const head = ['city', 'temp_c', 'rain_mm']
const body = [
  ['Berlin', '11.2', '4.1'],
  ['Lisbon', '19.8', '0.0'],
  ['Oslo', '6.4', '7.9'],
  ['Chennai', '31.0', '12.3'],
  ['Quito', '14.6', '3.2'],
]
const table =
  `<div class="dtab"><table><thead><tr><th scope="col"><span class="vh">Row</span></th>${head.map((h, c) => `<th scope="col"${c ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>` +
  body.map((r, i) => `<tr><td class="i">${i}</td>${r.map((x, c) => `<td${c ? ' class="n"' : ''}>${x}</td>`).join('')}</tr>`).join('') +
  '</tbody></table></div>'
const gfm = [['', ...head], ['---', '---', '---:', '---:'], ...body.map((r, i) => [String(i), ...r])].map((r) => `| ${r.join(' | ')} |`).join('\n')

const demoList: { chip: string; saved: Seg[]; read: string; readMd: string; why: string }[] = [
  {
    chip: '`print(df)`',
    saved: [
      '      city  temp_c  rain_mm\n0   Berlin    11.2      4.1\n1   Lisbon    19.8      0.0\n2     Oslo     6.4      7.9\n3  Chennai    31.0     12.3\n4    Quito    14.6      3.2',
    ],
    read: table,
    readMd: 'a table, numbers aligned on the right.\n\n' + gfm,
    why: 'Text that lines up in columns, which is what `print(df)` writes, becomes a table. Numbers align on the right; the index stays quiet.',
  },
  {
    chip: 'A traceback',
    saved: [
      ['KeyError', 'bad'],
      '                                  Traceback (most recent call last)\nFile ~/env/lib/python3.12/site-packages/pandas/core/indexes/base.py:3805, in Index.get_loc\n-> 3805     return self._engine.get_loc(casted_key)\nFile index.pyx:167, in pandas._libs.index.IndexEngine.get_loc()\nFile index.pyx:196, in pandas._libs.index.IndexEngine.get_loc()\n',
      ['The above exception was the direct cause of the following exception:', 'dim'],
      '\nCell In[7], line 3\n----> 3 df["rain_mm"].mean()\nFile ~/env/lib/python3.12/site-packages/pandas/core/frame.py:4102, in DataFrame.__getitem__\n',
      ['   …  9 more lines', 'dim'],
      '\n',
      ["KeyError: 'rain_mm'", 'bad'],
    ],
    read: '<p class="dexc"><strong>KeyError</strong>\'rain_mm\'</p><pre class="dframe">Cell In[7], line 3\n      1 df = load("weather.csv")\n<span class="hl">----&gt; 3 df["rain_mm"].mean()</span></pre><div class="rowcap">Show full traceback</div>',
    readMd: 'the error first, `KeyError: \'rain_mm\'`, then the line in your own code, `df["rain_mm"].mean()` (cell 7, line 3), with the library frames folded behind a "Show full traceback" row.',
    why: 'The error is named first, then the line in your own code. The library frames wait behind one row.',
  },
  {
    chip: 'A progress bar',
    saved: [
      '  0%|          | 0/100 [00:00<?, ?it/s]\n 20%|██        | 20/100 [00:00<00:03, 24.3it/s]\n 40%|████      | 40/100 [00:01<00:02, 24.0it/s]\n 60%|██████    | 60/100 [00:02<00:01, 24.1it/s]\n 80%|████████  | 80/100 [00:03<00:00, 24.2it/s]\n100%|██████████| 100/100 [00:04<00:00, 24.2it/s]\nTraining finished: loss 0.081',
    ],
    read: '<pre class="dframe">100%|██████████| 100/100 [00:04&lt;00:00, 24.2it/s]\nTraining finished: loss 0.081</pre>',
    readMd: 'the last frame of the bar, `100%|██████████| 100/100 [00:04<00:00, 24.2it/s]`, then the line printed after it, `Training finished: loss 0.081`.',
    why: 'A bar saved as one line per frame keeps only its last frame. Everything printed after it stays.',
  },
]

const demos: Part = {
  pages: both,
  html: () => {
    const chips = demoList
      .map((d, i) => `<label class="chip"><input type="radio" name="demo" id="dm${i + 1}"${i ? '' : ' checked'}>${code(d.chip)}</label>`)
      .join('')
    const saved = demoList.map((d, i) => `<pre class="draw s s${i + 1}">${marked(d.saved)}</pre>`).join('')
    const read = demoList.map((d, i) => `<div class="s s${i + 1}">${d.read}</div>`).join('')
    const whys = demoList
      .map((d, i) => `<p class="why s s${i + 1}"><svg aria-hidden="true"><use href="#spark"/></svg><b>Only here</b><span>${code(d.why)}</span></p>`)
      .join('')
    return (
      `<div class="demos"><fieldset class="dbar"><legend class="vh">Try one</legend><span class="k" aria-hidden="true">Try one</span>${chips}</fieldset>` +
      `<fieldset class="seg"><legend class="vh">Show</legend><label><input type="radio" name="side" id="dw">Elsewhere</label><label><input type="radio" name="side" id="dn" checked>${mark}ipynb viewer</label></fieldset>` +
      `<div class="pair"><div class="pane was"><div class="ph"><svg class="g" aria-hidden="true"><use href="#n"/></svg>Elsewhere<small>as saved</small></div><div class="body">${saved}</div></div>` +
      `<div class="pane now"><div class="ph">${mark}ipynb viewer<small>as read</small></div><div class="body">${read}</div></div></div>` +
      `<div class="whys">${whys}</div></div>`
    )
  },
  md: () =>
    demoList
      .map((d) => `**${d.chip}**\n\nAs saved:\n\n\`\`\`text\n${plain(d.saved)}\n\`\`\`\n\nAs read: ${d.readMd}\n\nOnly here: ${d.why}`)
      .join('\n\n'),
}

type Stop = [text: string, kind?: string]
interface RouteLane { who: ToolId | 'link'; cls?: string; stops: Stop[]; long?: boolean; v: Verdict; end: string }
const routeLanes: RouteLane[] = [
  { who: 'us', cls: 'us', long: true, stops: [['your file'], ['this page', 'mark']], v: 'yes', end: 'Stays on your device' },
  { who: 'link', cls: 'sub', stops: [['GitHub', 'cloud'], ['this site’s relay'], ['this page', 'mark']], v: 'part', end: 'Passed through, not kept' },
  { who: 'nbviewer', stops: [['a link'], ['nbviewer’s server', 'cloud'], ['a page']], v: 'no', end: 'Fetched by their server' },
  { who: 'github', stops: [['your repository'], ['GitHub’s servers', 'cloud'], ['a page']], v: 'part', end: 'Already on GitHub' },
  { who: 'colab', stops: [['your file'], ['Google Drive', 'cloud'], ['Google’s runtime', 'cloud kern'], ['a page']], v: 'no', end: 'Copied to Google' },
  { who: 'jupyterlab', stops: [['your file'], ['Jupyter server'], ['your kernel', 'kern'], ['a page']], v: 'yes', end: 'Your machine' },
  { who: 'vscode', stops: [['your file'], ['the editor'], ['your kernel', 'kern']], v: 'yes', end: 'Your machine' },
]
const stop = ([text, kind = '']: Stop) => `<span class="node${kind && kind !== 'mark' ? ` ${kind}` : ''}">${kind === 'mark' ? mark : ''}${esc(text)}</span>`
const hop = (s: Stop, long: boolean) => `<span class="step">${arrow(long)}<span class="vh">then </span>${stop(s)}</span>`

const routes: Part = {
  pages: both,
  html: () =>
    `<div class="routes">${routeLanes
      .map((l) => {
        const who = l.who === 'link' ? 'From a link' : toolName(l.who)
        const path = l.stops.map((s, i) => (i ? hop(s, !!l.long && i === 1) : stop(s))).join('')
        return `<div class="lane${l.cls ? ` ${l.cls}` : ''}"><b>${esc(who)}</b>${path}<small>${glyph(l.v)}${esc(l.end)}</small></div>`
      })
      .join('')}</div>`,
  md: () =>
    routeLanes
      .map((l) => `- ${l.who === 'link' ? `${toolName('us')}, from a link` : toolName(l.who)}: ${l.stops.map((s) => s[0]).join(' → ')} (${l.end})`)
      .join('\n'),
}

const linkIcon =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.5.5M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.5-.5"/></svg>'
const editBar = `<div class="tool"><span>↶</span><span class="sep"></span><span class="on">B</span><span class="it">I</span><span class="cd">&lt;/&gt;</span><span>${linkIcon}</span><span class="sep"></span><span>H</span><span>≡</span></div>`
const picture = (name: string, inner: string) =>
  `<div class="editor" aria-hidden="true"><div class="wbar"><span class="file">${mark}${name}<i class="dot"></i></span><span class="saved">Edited</span><span class="bt def">Save a copy</span><span class="bt solid">Save</span></div><div class="page">${inner}</div></div>`

const editor: Part = {
  pages: both,
  variants: ['file', 'notebook'],
  html: (variant) => {
    if (variant === 'file') {
      return picture(
        'field-notes.md',
        `<h3>Field notes</h3><div class="ed">${editBar}<p class="edit">Water boils at a lower temperature the higher you go, so a pot on the ridge needs a <span class="sel">longer</span><i class="caret"></i> simmer than one on the shore.</p></div><p class="math">T<sub>boil</sub> ≈ 100 − h / 300</p><ul><li>Log the height of each stop in <code>stops.csv</code></li><li>Keep the kettle notes in <code>kettle.md</code></li></ul>`,
      )
    }
    if (variant === 'notebook') {
      return picture(
        'cooling-coffee.ipynb',
        `<h3>Cooling coffee</h3><div class="ed">${editBar}<p class="edit">The cup cools <span class="sel">fastest</span><i class="caret"></i> while it is hottest. The gap to the room shrinks by the same fraction every minute, so the first ten minutes decide most of the story.</p></div><div class="cc"><span class="n">[10]</span><code>ks_grid = np.linspace(0.03, 0.07, 9)</code><span class="lk">Code · unchanged</span></div><p class="math">T(t) = T<sub>room</sub> + (T<sub>0</sub> − T<sub>room</sub>) e<sup>−kt</sup></p>`,
      )
    }
    throw new Error(`editor takes "file" or "notebook", not "${variant}"`)
  },
  md: () => '',
}

export const shared: Record<'sprite' | 'jobs' | 'figures' | 'teaser' | 'demos' | 'routes' | 'editor', Part> = {
  sprite,
  jobs,
  figures,
  teaser,
  demos,
  routes,
  editor,
}
