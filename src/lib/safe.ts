import './safe.css';
import DOMPurify from 'dompurify';
import { cleanStyle, settle, LINKS, INSIDE } from './guard';

// What an HTML or SVG output may show without being run. HTML keeps its plain markup; SVG becomes a picture, which
// a browser draws without scripts, links or outside requests. Each kind has its own instance, apart from the
// markdown one, so their hooks do not mix.
const purify = DOMPurify(window);
const drawn = DOMPurify(window);

purify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName !== 'style') return;
  data.attrValue = cleanStyle(data.attrValue);
  data.keepAttr = data.attrValue !== '';
});
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
// a drawing may point at things inside itself and at nothing else
drawn.addHook('afterSanitizeAttributes', (node) => {
  for (const { name, value } of [...node.attributes ?? []]) {
    if (/^(?:xlink:)?href$/i.test(name) ? !/^#|^data:image\//i.test(value) : /url\(\s*(?!['"]?#)/i.test(value)) node.removeAttribute(name);
  }
});

const TAGS = `a abbr b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure
  h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q s samp small span strong sub summary sup table tbody td tfoot th
  thead time tr u ul var wbr center`.split(/\s+/);
const ATTRS = 'href title alt src width height colspan rowspan align valign style open start dir lang datetime'.split(' ');

/** Plain markup from an HTML output, with nothing that runs or loads, or null when nothing is left to see. */
export function rich(source: string, remote: boolean): string | null {
  if (source.length > 2_000_000) return null;
  const box = document.createElement('template');
  box.innerHTML = purify.sanitize(source, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: LINKS,
  });
  // pictures are settled after the sanitizer is done: what replaces one is built here, not taken from the output
  for (const img of box.content.querySelectorAll('img')) settle(img, remote);
  if (!box.content.textContent?.trim() && !box.content.querySelector('img, .rimg')) return null;
  const holder = document.createElement('div');
  holder.className = 'rich';
  holder.append(box.content);
  return holder.outerHTML;
}

const NS = 'http://www.w3.org/2000/svg';

/** An SVG output as a picture, made from a copy with the scripts, frames and outside links taken out. */
export function drawing(source: string): string | null {
  if (source.length > 1_500_000) return null;
  const clean = drawn.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // `use` is how drawings reuse a glyph or a marker; the hook above lets it point inside the drawing only
    ADD_TAGS: ['use'],
    FORBID_TAGS: ['script', 'foreignObject', 'a', 'animate', 'set', 'animateTransform', 'animateMotion', 'handler', 'listener'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: INSIDE,
  });
  const svg = new DOMParser().parseFromString(clean, 'text/html').body.querySelector('svg');
  if (!svg) return null;
  svg.setAttribute('xmlns', NS);
  // styles may restyle the drawing and nothing more
  for (const css of svg.querySelectorAll('style')) css.textContent = (css.textContent ?? '').replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none');
  const xml = new XMLSerializer().serializeToString(svg);
  return `<span class="pic"><img class="out-image plate" alt="Drawing" decoding="async" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}" /></span>`;
}
