import type { HighlighterCore, LanguageInput } from 'shiki/core';

const grammars: Record<string, LanguageInput> = {
  python: () => import('shiki/langs/python.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  julia: () => import('shiki/langs/julia.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
};

const aliases: Record<string, string> = {
  ipython: 'python',
  ipython2: 'python',
  ipython3: 'python',
  python2: 'python',
  python3: 'python',
  py: 'python',
  js: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  'c++': 'cpp',
  rscript: 'r',
};

let core: Promise<HighlighterCore> | undefined;

function load(): Promise<HighlighterCore> {
  return (core ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ]);
    return createHighlighterCore({
      themes: [import('./syntax').then((m) => m.lightTheme), import('./syntax').then((m) => m.darkTheme)],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })());
}

export function canHighlight(language: string | null): boolean {
  return !!language && (language.toLowerCase() in grammars || language.toLowerCase() in aliases);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A language without a grammar still gets its lines, so numbers and wrapping behave the same everywhere. */
const plain = (code: string) => code.split('\n').map((l) => `<span class="line">${esc(l)}</span>`).join('\n');

/**
 * Returns the inner markup of a highlighted block: one span per line, with both themes as CSS variables,
 * so switching theme needs no second pass. A language with no grammar comes back as plain lines.
 */
export async function highlight(code: string, language: string | null): Promise<string> {
  const key = (language ?? '').toLowerCase();
  const name = aliases[key] ?? key;
  const grammar = grammars[name];
  if (!grammar) return plain(code);
  const hl = await load();
  if (!hl.getLoadedLanguages().includes(name)) await hl.loadLanguage(grammar);
  const html = hl.codeToHtml(code, {
    lang: name,
    themes: { light: 'ipynb-light', dark: 'ipynb-dark' },
    defaultColor: false,
  });
  return html.slice(html.indexOf('<code>') + 6, html.lastIndexOf('</code>'));
}
