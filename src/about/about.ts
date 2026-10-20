// The home page is the app. It shows the landing page until a notebook is chosen, dropped, pasted or linked; then the landing
// page goes and the reader takes its place on the same page. The reader is loaded only at that moment.
const root = document.documentElement
const home = document.getElementById('home')!
const landing = document.getElementById('landing') as HTMLLinkElement | null
const picker = document.getElementById('picker') as HTMLInputElement
const listening = new AbortController()
const { signal } = listening

// The same switch as lib/theme.svelte.ts, without its runes: that module pulls the Svelte runtime into this small first script, and the reader loads it later.
const stored = () => {
  try {
    const v = localStorage.getItem('theme')
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}
const paint = (value: string) => {
  root.dataset.theme = value
  ;(document.getElementsByName('theme-color')[0] as HTMLMetaElement).content = value === 'dark' ? '#0a0a0c' : '#f5f5f7'
}
function toggleTheme() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
  paint(next)
  try {
    localStorage.setItem('theme', next)
  } catch {
    // storage can be blocked; the choice then lasts for this visit only
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => !stored() && paint(e.matches ? 'dark' : 'light'), { signal })
let opened = false
let loading: Promise<typeof import('../lib/watch')> | undefined
const watch = () => (loading ??= import('../lib/watch'))

async function open(file?: File, handle?: FileSystemFileHandle) {
  if (opened) return
  opened = true
  const { mountReader } = await import('../main')
  // The reader brings its own styles, which would clash with the landing page's, so the landing page's go with its markup and listeners.
  listening.abort()
  if (landing) landing.disabled = true
  home.remove()
  root.classList.remove('opening')
  mountReader(file, handle)
}

async function choose() {
  if (!window.showOpenFilePicker) return picker.click()
  const got = await (await watch()).pick()
  if (got) open(got.file, got.handle)
}

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
let depth = 0

document.querySelectorAll<HTMLElement>('[data-choose]').forEach((el) => el.addEventListener('click', choose, { signal }))
document.querySelector('.theme')?.addEventListener('click', toggleTheme, { signal })
document.querySelector<HTMLFormElement>('[data-link]')?.addEventListener(
  'submit',
  (e) => {
    e.preventDefault()
    const text = ((e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement).value.trim()
    if (text) location.assign(`${location.pathname}?url=${encodeURIComponent(text)}`)
  },
  { signal },
)
// The cue at the foot of the first screen takes the reader down to the explainers; with reduced motion it jumps.
document.querySelector('.next')?.addEventListener(
  'click',
  (e) => {
    e.preventDefault()
    document.getElementById('how')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  },
  { signal },
)
picker.addEventListener(
  'change',
  () => {
    const file = picker.files?.[0]
    picker.value = ''
    if (file) open(file)
  },
  { signal },
)
window.addEventListener(
  'keydown',
  (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault()
      choose()
    }
  },
  { signal },
)

window.addEventListener(
  'dragenter',
  (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth++
    root.classList.add('over')
    // loaded while the file is still being carried, so the drop does not wait for it
    watch()
  },
  { signal },
)
window.addEventListener(
  'dragover',
  (e) => {
    if (hasFiles(e)) e.preventDefault()
  },
  { signal },
)
window.addEventListener(
  'dragleave',
  () => {
    depth = Math.max(0, depth - 1)
    if (!depth) root.classList.remove('over')
  },
  { signal },
)
window.addEventListener(
  'drop',
  async (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth = 0
    root.classList.remove('over')
    const got = await (await watch()).dropped(e.dataTransfer!)
    if (got) open(got.file, got.handle)
  },
  { signal },
)

window.addEventListener(
  'paste',
  (e) => {
    if ((e.target as Element).closest?.('input, textarea')) return
    const text = e.clipboardData?.getData('text') ?? ''
    if (text.includes('http')) import('../lib/link').then((m) => m.pasted(text))
  },
  { signal },
)

// A notebook link in the address bar goes straight to the reader, which fetches it. The code that reads the link loads beside the
// reader rather than after it.
if (/[?#](?:url|nb)=/.test(location.href)) {
  import('../lib/link')
  import('../lib/netstate.svelte')
  open()
}

// The offline copy is made from this page too, for a visit that never opens a notebook.
setTimeout(() => import('../lib/offline'), 2500)

// Where the browser lets a page offer tools to an agent working with the person (WebMCP), the empty page offers one: open a link.
const tools = (document as any).modelContext ?? (navigator as any).modelContext
if (tools) import('../lib/agent').then((m) => m.landing(tools, signal))

// A notebook opened from the operating system (an installed copy in Chromium) arrives through the launch queue.
if ('launchQueue' in window) (window as any).launchQueue.setConsumer(async (p: any) => { const h = p.files?.[0]; if (h) open(await h.getFile(), h) })
