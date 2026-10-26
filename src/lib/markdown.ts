import './md.css';
import './tbl.css';
import type { Token } from 'marked';
import DOMPurify from 'dompurify';
import type { MimeBundle } from './notebook';
import { isNum } from './tabular';
import { guard, settle, LINKS } from './guard';
import { marked } from './mdlex';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function attachmentUrl(name: string, attachments: Record<string, MimeBundle>): string | null {
  const bundle = attachments[decodeURIComponent(name)];
  if (!bundle) return null;
  for (const mime of IMAGE_TYPES) {
    const data = bundle[mime];
    if (typeof data === 'string') return `data:${mime};base64,${data}`;
  }
  return null;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href');
    if (href?.[0] !== '#') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    } else if (href.length > 1 && !href.startsWith('#user-content-')) {
      // ids in notebook markup are prefixed so they cannot shadow the page's own; links to them follow
      node.setAttribute('href', '#user-content-' + href.slice(1));
    }
  } else if (node.tagName === 'IMG') settle(node, remote);
});

/** Markdown to sanitized HTML. Raw HTML in the source is kept only as far as DOMPurify allows. */
export function renderMarkdown(source: string, attachments: Record<string, MimeBundle> = {}): string {
  guard();
  const html = marked.parse(source, {
    async: false,
    walkTokens(token: Token) {
      if (token.type === 'image' && token.href.startsWith('attachment:')) {
        const url = attachmentUrl(token.href.slice('attachment:'.length), attachments);
        if (url) token.href = url;
      }
    },
  });
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'option', 'optgroup', 'textarea', 'fieldset', 'label', 'audio', 'video', 'source', 'track', 'picture', 'iframe', 'frame', 'object', 'embed', 'meta', 'link', 'base'],
    FORBID_ATTR: ['style', 'srcset', 'sizes', 'ping', 'poster', 'background', 'formaction', 'action'],
    ADD_ATTR: ['data-tex'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
    ALLOWED_URI_REGEXP: LINKS,
  });
}

const TABLE = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col', 'b', 'strong', 'i', 'em', 'code', 'br', 'p'];
// The line pandas adds under a frame it has truncated; any other paragraph means this is not just a table.
const FOOT = /^[\d,]+ rows? × [\d,]+ columns?$/;

// Numeric columns line up on the right, header included.
function align(table: HTMLTableElement) {
  if (table.querySelector('[colspan], [rowspan]')) return;
  const rows = [...table.rows];
  const width = Math.max(0, ...rows.map((r) => r.cells.length));
  for (let k = 0; k < width; k++) {
    const body = rows.map((r) => r.cells[k]).filter((c) => c?.tagName === 'TD' && c.textContent!.trim());
    if (body.length && body.every((c) => isNum(c.textContent!))) for (const r of rows) r.cells[k]?.classList.add('n');
  }
}

/** The tables in an HTML output, sanitized down to table markup, or null when it holds anything else. */
export function cleanTable(source: string): string | null {
  const clean = DOMPurify.sanitize(source, { ALLOWED_TAGS: TABLE, ALLOWED_ATTR: ['colspan', 'rowspan'] });
  const box = document.createElement('template');
  box.innerHTML = clean;
  const root = box.content;
  const tables = [...root.querySelectorAll('table')].filter((t) => !t.parentElement?.closest('table'));
  if (!tables.length) return null;
  const rest = root.cloneNode(true) as DocumentFragment;
  rest.querySelectorAll('table').forEach((t) => t.remove());
  rest.querySelectorAll('p').forEach((p) => FOOT.test(p.textContent!.trim()) && p.remove());
  if (rest.textContent!.trim()) return null;
  root.querySelectorAll('p').forEach((p) => (FOOT.test(p.textContent!.trim()) ? (p.className = 'foot') : p.remove()));
  for (const t of tables) {
    align(t);
    const frame = document.createElement('div');
    frame.className = 'tbl';
    t.replaceWith(frame);
    frame.append(t);
  }
  const holder = document.createElement('div');
  holder.append(root);
  return holder.innerHTML;
}

/**
 * What an HTML or SVG output shows: its tables, else its plain markup, else nothing, in which case the caller keeps
 * the text version. Scripts never run and pictures from the web wait for the reader's say-so.
 */
export async function outputHtml(source: string): Promise<string | null> {
  guard();
  const table = cleanTable(source);
  if (table) return table;
  const safe = await import('./safe');
  // a drawing is one <svg> and nothing around it; anything else is markup that happens to hold one
  return /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype[^>]*>\s*)?<svg[\s>][\s\S]*<\/svg>\s*$/i.test(source) ? safe.drawing(source) : safe.rich(source, remote);
}

/** Whether pictures from the web may load. Off until the reader has been asked and said yes (see netstate.svelte.ts). */
let remote = false;

export function allowWeb(on: boolean) {
  remote = on;
  reveal();
}

/** Brings the pictures from the web in or out of the page, to match the reader's choice. */
function reveal() {
  const on = remote;
  const page = '.notebook .md, .notebook .rich';
  if (on) {
    for (const note of document.querySelectorAll<HTMLElement>(`:is(${page}) .rimg`)) {
      if (!/^https?:\/\//i.test(note.title)) continue;
      const img = document.createElement('img');
      img.src = note.title;
      img.alt = note.textContent?.includes(' \u00b7 ') ? note.textContent.split(' \u00b7 ')[0] : '';
      settle(img, true);
      note.replaceWith(img);
    }
  } else {
    for (const img of document.querySelectorAll(`:is(${page}) img[src^="http"]`)) settle(img, false);
  }
}
