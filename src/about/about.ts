import { toggleTheme } from '../lib/theme.svelte'

// The home page is the app. It shows the landing page until a notebook is chosen, dropped, pasted or linked; then the landing
// page goes and the reader takes its place on the same page. The reader is loaded only at that moment.
const root = document.documentElement
const home = document.getElementById('home')!
const landing = document.getElementById('landing') as HTMLLinkElement | null
const picker = document.getElementById('picker') as HTMLInputElement
const listening = new AbortController()
const { signal } = listening
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
    const text = e.clipboardData?.getData('text') ?? ''
    if (text.includes('http')) import('../lib/link').then((m) => m.pasted(text))
  },
  { signal },
)

// A notebook link in the address bar goes straight to the reader, which fetches it.
if (/[?#](?:url|nb)=/.test(location.href)) open()

// The offline copy is made from this page too, for a visit that never opens a notebook.
setTimeout(() => import('../lib/offline'), 2500)
