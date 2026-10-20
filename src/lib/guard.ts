// What keeps a notebook's own markup from doing anything but show itself. Nothing here runs until the first piece of
// rich content is about to be rendered, so none of it counts against the first load.

/**
 * The policy the page takes on once it is about to show notebook markup. Scripts and fonts come from the app alone,
 * nothing may open a connection, and the only frames are the app's own sandbox page. Fonts may be data, because
 * KaTeX's stylesheet carries its own. Pictures may come from the web
 * because the sanitizers decide which ones do; a policy cannot be loosened later, so it cannot be the gate for a
 * setting the reader can switch at any time.
 */
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Which attribute values a sanitizer keeps. DOMPurify tests every value that is not on its short list of plain
 * ones, so this has to pass numbers and words and refuse only a scheme it does not know: web, mail and phone links
 * stay, and so does anything that names no scheme at all.
 */
export const LINKS = /^(?:(?:https?|mailto|tel):|#|(?![a-z][a-z0-9+.-]*:))/i;
/** The same for an SVG, where a reference may only point inside the drawing or be a picture's own data. */
export const INSIDE = /^(?:#|data:image\/|(?![a-z][a-z0-9+.-]*:))/i;

let armed = false;

/** Puts the policy on the page, and tells the browser not to say where a link or a picture was found. */
export function guard() {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = POLICY;
  const referrer = document.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  document.head.append(policy, referrer);
}

/**
 * What a sanitizer lets a `style` attribute keep: a short list of properties that only change how a box looks, with
 * values that cannot fetch anything. Anything else, in whole or in part, goes.
 */
const SAFE = new Set(
  `color background-color background font font-family font-size font-weight font-style font-variant line-height letter-spacing
   word-spacing text-align text-decoration text-transform text-indent white-space word-break overflow-wrap vertical-align
   width height min-width max-width min-height max-height margin margin-top margin-right margin-bottom margin-left
   padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left
   border-color border-style border-width border-radius border-collapse border-spacing caption-side table-layout
   display flex flex-direction flex-wrap flex-grow flex-shrink flex-basis gap row-gap column-gap justify-content
   align-items align-self align-content grid-template-columns opacity list-style list-style-type box-shadow text-shadow
   overflow overflow-x overflow-y visibility`.split(/\s+/),
);
const DISPLAY = /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|table|inline-table|table-row|table-cell|table-header-group|table-row-group|list-item|none)$/;
// Letters, digits and the punctuation of lengths, colours, fonts and calc(); no escapes, urls, comments or braces.
const PLAIN = /^[\w\s#%.,()+\-*/'"!]*$/;
const FETCH = /url\s*\(|image-set|expression|javascript|behavior|binding|@|\\|\/\*|var\s*\(|env\s*\(|attr\s*\(/i;

export function cleanStyle(css: string): string {
  const keep: string[] = [];
  for (const part of css.split(';')) {
    const at = part.indexOf(':');
    if (at < 1) continue;
    const name = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    if (!SAFE.has(name) || !value || !PLAIN.test(value) || FETCH.test(value)) continue;
    if (name === 'display' && !DISPLAY.test(value.toLowerCase())) continue;
    keep.push(`${name}: ${value}`);
  }
  return keep.join('; ');
}

/** The web address a picture would come from, as a host name for a placeholder, or null for a picture that is data. */
export function remoteHost(src: string): string | null {
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|avif|bmp)[;,]/i.test(src)) return null;
  try {
    const url = new URL(src, 'https://x.invalid/');
    return url.host === 'x.invalid' ? 'a relative path' : url.host || 'an unknown address';
  } catch {
    return 'an unknown address';
  }
}

/**
 * Settles one picture in sanitized markup: data pictures stay, web pictures stay when the reader allowed them, and
 * everything else becomes a muted line that says where the picture would have come from.
 */
export function settle(img: Element, remote: boolean) {
  const src = img.getAttribute('src') ?? '';
  const host = remoteHost(src);
  const web = /^https?:\/\//i.test(src);
  if (host === null || (web && remote)) {
    img.removeAttribute('srcset');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('referrerpolicy', 'no-referrer');
    return;
  }
  const note = document.createElement('span');
  note.className = 'rimg';
  if (web) note.title = src;
  const alt = img.getAttribute('alt')?.trim();
  note.textContent = `${alt ? alt + ' · ' : ''}image from ${host}`;
  img.replaceWith(note);
}
