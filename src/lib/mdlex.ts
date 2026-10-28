import { Marked, type Tokens } from 'marked';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// KaTeX renders these placeholders on demand; until then the source stays readable.
const math = (tex: string, display: boolean) =>
  `<span class="math${display ? ' display' : ''}" data-tex="${escapeHtml(tex)}">${escapeHtml(tex)}</span>`;

export interface MathToken extends Tokens.Generic {
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

/** The one markdown parser. The reader renders with it and the editor lexes with it, so both see the same blocks. */
export const marked = new Marked({
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
