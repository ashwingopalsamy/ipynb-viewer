import './md.css';
import './tbl.css';
import { Marked, type Token, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import type { MimeBundle } from './notebook';
import { isNum } from './tabular';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// KaTeX renders these placeholders on demand; until then the source stays readable.
const math = (tex: string, display: boolean) =>
  `<span class="math${display ? ' display' : ''}" data-tex="${escapeHtml(tex)}">${escapeHtml(tex)}</span>`;

interface MathToken extends Tokens.Generic {
  type: 'inlineMath' | 'blockMath';
  text: string;
  display: boolean;
}

const INLINE_MATH = [
  /^\$\$([\s\S]+?)\$\$/,
  /^\\\(([\s\S]+?)\\\)/,
  /^\\\[([\s\S]+?)\\\]/,
];
// $x$ but not a price: no space inside the delimiters, no digit right after the closing one.
const DOLLAR = /^\$(?!\s)((?:\\.|[^\\$\n]|\n(?!\n))+?)(?<!\s)\$(?!\d)/;

const marked = new Marked({
  gfm: true,
  extensions: [
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src: string) => src.search(/\$|\\[([]/),
      tokenizer(src: string): MathToken | undefined {
        for (const re of INLINE_MATH) {
          const m = re.exec(src);
          if (m) return { type: 'inlineMath', raw: m[0], text: m[1].trim(), display: re !== INLINE_MATH[1] };
        }
        const m = DOLLAR.exec(src);
        if (m) return { type: 'inlineMath', raw: m[0], text: m[1], display: false };
      },
      renderer: (t) => math((t as MathToken).text, (t as MathToken).display),
    },
    {
      name: 'blockMath',
      level: 'block',
      start: (src: string) => src.search(/^(?:\$\$|\\begin\{)/m),
      tokenizer(src: string): MathToken | undefined {
        const dollars = /^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$[ \t]*(?:\n|$)/.exec(src);
        if (dollars) return { type: 'blockMath', raw: dollars[0], text: dollars[1].trim(), display: true };
        const env = /^\\begin\{([a-zA-Z*]+)\}[\s\S]+?\\end\{\1\}[ \t]*(?:\n|$)/.exec(src);
        if (env) return { type: 'blockMath', raw: env[0], text: env[0].trim(), display: true };
      },
      renderer: (t) => `<div class="math-block">${math((t as MathToken).text, true)}</div>\n`,
    },
  ],
});

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
  if (node.tagName === 'A' && node.getAttribute('href')?.[0] !== '#') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  } else if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('decoding', 'async');
    node.setAttribute('referrerpolicy', 'no-referrer');
  }
});

/** Markdown to sanitized HTML. Raw HTML in the source is kept only as far as DOMPurify allows. */
export function renderMarkdown(source: string, attachments: Record<string, MimeBundle> = {}): string {
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
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['style'],
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
