// Which names a piece of code defines and which it only uses. A notebook is one shared namespace, so this goes by
// name rather than by scope, with one exception: what a function takes or makes for itself stays inside it, so a
// parameter called `df` does not point at the `df` of the notebook.

export interface Facts {
  defs: Set<string>;
  uses: Set<string>;
}

const HASH = new Set(['python', 'python3', 'ipython', 'r', 'julia', 'bash', 'sh', 'shell', 'ruby', 'perl', 'yaml']);

const KEYWORDS = new Set(
  `False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield
   let const var val function new this typeof null undefined true false fn func struct enum impl pub use mod match type interface export default switch case do static void
   NULL NA TRUE FALSE library require`.split(/\s+/),
);

export const isName = (s: string) => /^[A-Za-z_]\w*$/.test(s) && !KEYWORDS.has(s);

/** Code with comments dropped and strings emptied; what an f-string or a template interpolates is kept. */
export function strip(src: string, hash: boolean): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (hash ? c === '#' : c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (!hash && c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const triple = hash && src.startsWith(c + c + c, i);
      const q = triple ? c + c + c : c;
      const live = c === '`' || /(?:^|\W)(?:rf|fr|f)$/i.test(src.slice(Math.max(0, i - 3), i));
      // a prefix such as f or rb belongs to the string, not to the code
      if (hash && c !== '`') out = out.replace(/(?<![\w.])[rRbBuUfF]{1,2}$/, '');
      let body = '';
      let j = i + q.length;
      while (j < src.length && !src.startsWith(q, j)) {
        if (src[j] === '\\') j++;
        else if (!triple && c !== '`' && src[j] === '\n') break;
        else body += src[j];
        j++;
      }
      i = j + q.length;
      out += '""';
      if (live) for (const m of body.matchAll(/(?<!\{)\{([^{}]*)\}|\$\{([^{}]*)\}/g)) out += ` (${m[1] ?? m[2]}) `;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The depth of brackets a piece of text leaves open. */
const open = (s: string) => {
  let d = 0;
  for (const c of s) d += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
  return d;
};

/** An assignment operator, as opposed to a comparison, a walrus or an arrow; `+=` and its kin count. */
const assign = (s: string, i: number) => (s[i] === '=' && s[i + 1] !== '=' && s[i + 1] !== '>' && !/[=!<>:]/.test(s[i - 1] ?? '') ? 1 : 0);

/** Splits at a character, or at whatever an operator test accepts, when it sits outside any brackets. */
function split(s: string, at: string | ((s: string, i: number) => number)): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (!depth && (typeof at === 'string' ? c === at : at(s, i))) {
      parts.push(s.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(s.slice(from));
  return parts;
}

/** True when one pair of brackets holds the whole text. */
const wrapped = (s: string) => {
  if (!/^[(\[][^]*[)\]]$/.test(s)) return false;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    d += '([{'.includes(s[i]) ? 1 : ')]}'.includes(s[i]) ? -1 : 0;
    if (!d && i < s.length - 1) return false;
  }
  return true;
};

const WORDS = /(?<![\w.])[A-Za-z_]\w*(?!\w)(?!\s*=(?!=))/g;
const OPS = /(?:\/\/|\*\*|[+\-*/%&|^@])\s*$/;

interface Frame {
  indent: number;
  def: boolean;
  own: Set<string>;
  global: Set<string>;
}

export function scan(source: string, language: string | null): Facts {
  const lang = (language ?? 'python').toLowerCase();
  const hash = HASH.has(lang);
  const defs = new Set<string>();
  const uses = new Set<string>();
  const stack: Frame[] = [];

  const mine = () => stack.at(-1);
  const local = (n: string) => stack.some((f) => f.def && f.own.has(n) && !f.global.has(n));
  const read = (text: string, skip?: Set<string>) => {
    const away = new Set(skip);
    // a lambda's parameters and a comprehension's variables belong to the expression
    for (const m of text.matchAll(/\blambda\b([^:]*):/g)) for (const w of m[1].matchAll(/[A-Za-z_]\w*/g)) away.add(w[0]);
    for (const m of text.matchAll(/\bfor\s+([^\n]+?)\s+in\b/g)) for (const w of m[1].matchAll(/[A-Za-z_]\w*/g)) away.add(w[0]);
    for (const m of text.matchAll(WORDS)) if (!KEYWORDS.has(m[0]) && !away.has(m[0]) && !local(m[0])) uses.add(m[0]);
  };
  const make = (n: string) => {
    if (!isName(n)) return;
    const f = mine();
    if (!f) defs.add(n);
    else if (f.def) f.global.has(n) ? defs.add(n) : f.own.add(n);
    // a name made in a class body is an attribute, and belongs to no one
  };
  // a target is a name being bound, or an attribute or item being changed, which only uses what it names
  const target = (t: string, also: boolean) => {
    const s = t.trim();
    const each = split(s, ',');
    if (each.length > 1) return each.forEach((e) => target(e, also));
    if (wrapped(s)) return split(s.slice(1, -1), ',').forEach((e) => target(e, also));
    const m = /^\*?\s*([A-Za-z_]\w*)$/.exec(s);
    if (m) {
      if (also) read(m[1]);
      make(m[1]);
    } else read(s);
  };

  function statement(text: string, indent: number) {
    let m: RegExpExecArray | null;
    if (/^[%!]/.test(text)) return;
    for (const w of text.matchAll(/\(?([A-Za-z_]\w*)\s*:=/g)) make(w[1]);
    if ((m = /^(?:async\s+)?def\s+(\w+)\s*\(/.exec(text))) {
      // def name(params) -> annotation: body
      const start = m[0].length;
      let depth = 1;
      let end = start;
      while (end < text.length && depth) (depth += text[end] === '(' ? 1 : text[end] === ')' ? -1 : 0), end++;
      const own = new Set<string>();
      for (const p of split(text.slice(start, end - 1), ',')) {
        const q = /^\s*\**\s*([A-Za-z_]\w*)/.exec(p);
        if (!q) continue;
        own.add(q[1]);
        const [note, ...fallback] = split(p.slice(q[0].length), assign);
        read(note.replace(/^\s*:/, ''), own);
        if (fallback.length) read(fallback.join('='), own);
      }
      make(m[1]);
      stack.push({ indent, def: true, own, global: new Set() });
      const rest = text.slice(end).replace(/^\s*(?:->\s*[^:]*)?:?/, '');
      if (rest.trim()) statement(rest.trim(), indent + 1);
    } else if ((m = /^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:?(.*)$/.exec(text))) {
      make(m[1]);
      if (m[2]) read(m[2]);
      stack.push({ indent, def: false, own: new Set(), global: new Set() });
      if (m[3].trim()) statement(m[3].trim(), indent + 1);
    } else if ((m = /^(?:global|nonlocal)\s+(.+)$/.exec(text))) {
      for (const n of m[1].split(',')) mine()?.global.add(n.trim());
    } else if ((m = /^import\s+(.+)$/.exec(text))) {
      for (const part of m[1].split(',')) {
        const p = /^\s*([\w.]+)(?:\s+as\s+(\w+))?\s*$/.exec(part);
        if (p) make(p[2] ?? p[1].split('.')[0]);
      }
    } else if ((m = /^from\s+[\w.]+\s+import\s+\(?(.+?)\)?$/.exec(text))) {
      for (const part of m[1].split(',')) {
        const p = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(part);
        if (p) make(p[2] ?? p[1]);
      }
    } else if ((m = /^(?:async\s+)?for\s+(.+?)\s+in\s+(.+)$/.exec(text))) {
      target(m[1], false);
      const [head, ...body] = split(m[2], ':');
      read(head);
      if (body.join(':').trim()) statement(body.join(':').trim(), indent + 1);
    } else if ((m = /^(?:async\s+)?(?:with|except)\b(.*)$/.exec(text))) {
      const bound = new Set<string>();
      for (const w of m[1].matchAll(/\bas\s+([A-Za-z_]\w*)/g)) bound.add(w[1]);
      const [head, ...body] = split(m[1].replace(/\bas\s+[A-Za-z_]\w*/g, ''), ':');
      read(head);
      bound.forEach(make);
      if (body.join(':').trim()) statement(body.join(':').trim(), indent + 1);
    } else if ((m = /^(?:if|elif|else|while|try|finally)\b(.*)$/.exec(text))) {
      const [head, ...body] = split(m[1], ':');
      read(head);
      if (body.join(':').trim()) statement(body.join(':').trim(), indent + 1);
    } else if ((m = /^(?:function|fn|func|struct|enum|interface|type)\s+(\w+)(.*)$/.exec(text))) {
      make(m[1]);
      read(m[2]);
    } else {
      // an assignment: `a = b = c`, `a, b = c`, `a += c`, `let a = c`, `a: int = c`
      const parts = split(text, assign);
      if (parts.length > 1) {
        const last = parts.pop()!;
        for (const p of parts) {
          const aug = OPS.test(p);
          const lhs = p.replace(OPS, '').replace(/^\s*(?:let|const|var|val)\s+/, '');
          // `x: int` keeps the annotation for reading
          const [name, ...note] = split(lhs, ':');
          if (note.length) read(note.join(':'));
          target(name, aug);
        }
        read(last);
      } else read(text);
    }
  }

  const lines = strip(source, hash).split('\n');
  for (let at = 0; at < lines.length; at++) {
    let line = lines[at];
    while ((open(line) > 0 || /\\\s*$/.test(line)) && at + 1 < lines.length) line = line.replace(/\\\s*$/, '') + ' ' + lines[++at];
    if (!line.trim()) continue;
    const indent = /^[ \t]*/.exec(line)![0].replace(/\t/g, '    ').length;
    while (stack.length && indent <= mine()!.indent) stack.pop();
    statement(lang === 'r' ? line.trim().replace(/<-/g, '=') : line.trim(), indent);
  }
  return { defs, uses };
}
