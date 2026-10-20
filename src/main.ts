import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// The home page calls this once a notebook is in hand (chosen, dropped, pasted or linked). Nothing in this file runs before that.
export function mountReader(file?: File, handle?: FileSystemFileHandle) {
  const target = document.createElement('div')
  target.id = 'app'
  document.body.append(target)
  mount(App, { target, props: { file, handle } })
}
