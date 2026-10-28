import { mount, unmount } from 'svelte'
import './app.css'
import App from './App.svelte'
import type { Want } from './lib/tabs/state.svelte'

// The home page calls this once a notebook is in hand (chosen, dropped, pasted or linked), and so does a frame page for its tab (src/lib/tabs). Nothing in this file runs before that.
let app: ReturnType<typeof mount> | undefined

export function mountReader(file?: File, handle?: FileSystemFileHandle, more: Want[] = []) {
  const target = document.createElement('div')
  target.id = 'app'
  document.body.append(target)
  app = mount(App, { target, props: { file, handle, more } })
}

// The first tab is closed while others stay: its reader goes, the frames keep running.
export function unmountReader() {
  if (app) unmount(app)
  app = undefined
  document.getElementById('app')?.remove()
}

export function mountFrame(id: string) {
  return import('./lib/tabs/frame.svelte').then((m) => m.join(id, mountReader))
}
