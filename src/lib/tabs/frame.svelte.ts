import { act, hooks, mine, strip, type Want } from './state.svelte';

// The frame side of a tab: this page runs one reader and talks to the host in the page around it (host.svelte.ts).
export function join(id: string, mount: (file?: File, handle?: FileSystemFileHandle) => void) {
  strip.me = id;
  const post = (m: object) => parent.postMessage(m, location.origin);
  Object.assign(act, {
    open: (wants: Want[]) => post({ t: 'open', wants }),
    go: (to: string) => post({ t: 'go', id: to }),
    step: (by: 1 | -1) => post({ t: 'step', by }),
    close: (to: string) => post({ t: 'close', id: to }),
  });

  let mounted = false;
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'file':
        if (mounted || !(d.file instanceof File)) return;
        mounted = true;
        mount(d.file, typeof FileSystemFileHandle !== 'undefined' && d.handle instanceof FileSystemFileHandle ? d.handle : undefined);
        break;
      case 'link': {
        if (mounted) return;
        mounted = true;
        // the host asked the person before it opened this tab, so the reader must not ask again
        const url = new URLSearchParams(location.search).get('url');
        if (d.asked === true && url) history.replaceState({ asked: url }, '');
        mount();
        break;
      }
      case 'tabs':
        if (Array.isArray(d.list) && typeof d.active === 'string') {
          strip.list = d.list;
          strip.active = d.active;
        }
        break;
      case 'close?':
        post({ t: 'close!', ok: !hooks.keep() });
        break;
    }
  });

  $effect.root(() => {
    $effect(() => post({ t: 'state', name: mine.name, status: mine.status, dirty: mine.dirty, key: mine.key }));
  });
  post({ t: 'hello' });
}
