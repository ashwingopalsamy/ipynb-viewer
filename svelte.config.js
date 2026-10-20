/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  // the reader is not a library other pages look at, so it does not announce its Svelte version on `window`
  compilerOptions: { discloseVersion: false },
}
