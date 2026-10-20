import { guard } from './guard';

// Runs an interactive output in an iframe that has sandbox="allow-scripts" and nothing else: no way into this page,
// its storage or the other outputs. The frame loads the app's own box.html, which sets a policy before it writes
// the output; the only thing the output can tell this page back is how tall it is.

const src = () => new URL('box.html', document.baseURI).href;

export function run(node: HTMLElement, first: { html: string; web: boolean }) {
  guard();
  let frame: HTMLIFrameElement | undefined;
  const hear = (e: MessageEvent) => {
    const h = e.data?.h;
    if (frame && e.source === frame.contentWindow && typeof h === 'number' && h >= 0) frame.style.height = `${Math.min(Math.max(Math.ceil(h), 40), 900)}px`;
  };
  const open = ({ html, web }: { html: string; web: boolean }) => {
    frame?.remove();
    const f = (frame = document.createElement('iframe'));
    f.setAttribute('sandbox', 'allow-scripts');
    f.referrerPolicy = 'no-referrer';
    f.allow = '';
    f.title = 'Interactive output';
    f.style.height = '120px';
    f.src = src();
    f.onload = () => {
      // once: a frame that navigates itself elsewhere gets nothing more
      f.onload = null;
      f.contentWindow?.postMessage({ html, web }, '*');
    };
    node.append(f);
  };
  addEventListener('message', hear);
  open(first);
  return {
    update: open,
    destroy() {
      removeEventListener('message', hear);
      frame?.remove();
    },
  };
}
