import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  // Every browser the reader supports preloads modules natively, so the polyfill would only add weight to the first load.
  build: { modulePreload: { polyfill: false } },
})
