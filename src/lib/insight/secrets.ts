import { stripAnsi, type Cell } from '../notebook';

// What a notebook gives away without its author noticing: keys and tokens pasted into a cell, a password that
// printed in an output, a home folder in a traceback. Everything here runs in the page and reads only what is already loaded.

export type Tier = 'secret' | 'personal';
export interface Hit {
  cell: string;
  /** The execution count, for naming the cell the way the gutter does. */
  n: number | null;
  where: 'code' | 'text' | 'output';
  kind: string;
  tier: Tier;
  /** The exact text to hide. */
  value: string;
  /** A masked form that is safe to show. */
  shown: string;
}

const KEYS: [string, RegExp][] = [
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Stripe key', /\b[sr]k_live_[0-9A-Za-z]{20,}\b/g],
  ['API key', /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/g],
  ['Private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )?PRIVATE KEY-----|$)/g],
  ['Web token', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
];
/** A password inside an address: the part after the colon. */
const URL_PASSWORD = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:([^\s@/]{3,})@[^\s/]+/gi;
/** `api_key = "..."`, or `OPENAI_API_KEY = "..."`: the quoted value. An underscore before the name is part of a longer name, not a word edge. */
const ASSIGNED = /(?<![A-Za-z0-9])(?:api[_-]?key|secret|token|passw(?:or)?d|pwd|auth)\b["']?\s*[:=]\s*["']([^"'\s]{12,})["']/gi;
const PLACEHOLDER = /^(?:your|my|xxx|\*+|<|\$\{|\{\{|os\.|getenv|example|changeme|placeholder|dummy|test)/i;
const EMAIL = /(?<![A-Za-z0-9._%+:-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const BORING_MAIL = /(?:@example\.|@users\.noreply\.github\.com|^noreply@|^no-reply@)/i;
const HOME = /(?:\/Users\/|\/home\/|C:\\Users\\)([A-Za-z0-9._-]+)/g;
const GENERIC_HOME = new Set(['jovyan', 'runner', 'ubuntu', 'user', 'codespace', 'vscode', 'root', 'shared', 'colab', 'sagemaker-user']);

/** Each text is read up to this far, and a notebook reports this many hits at most. */
const REACH = 400_000;
export const MOST = 200;

const mask = (v: string) => (v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-2)}` : '••••••');

export function scanText(text: string, add: (kind: string, tier: Tier, value: string) => void) {
  const body = text.length > REACH ? text.slice(0, REACH) : text;
  for (const [kind, re] of KEYS) for (const m of body.matchAll(re)) add(kind, 'secret', m[0]);
  for (const m of body.matchAll(URL_PASSWORD)) add('Password in an address', 'secret', m[1]);
  for (const m of body.matchAll(ASSIGNED)) if (!PLACEHOLDER.test(m[1]) && !/^(.)\1+$/.test(m[1])) add('Secret value', 'secret', m[1]);
  for (const m of body.matchAll(EMAIL)) if (!BORING_MAIL.test(m[0])) add('Email address', 'personal', m[0]);
  for (const m of body.matchAll(HOME)) if (!GENERIC_HOME.has(m[1].toLowerCase())) add('Home folder', 'personal', m[0]);
}

const outText = (o: Cell & { type: 'code' }) => {
  const parts: string[] = [];
  for (const out of o.outputs) {
    if (out.type === 'stream') parts.push(out.text);
    else if (out.type === 'error') parts.push(out.evalue, ...out.traceback.map(stripAnsi));
    else for (const mime of ['text/plain', 'text/html', 'text/markdown']) if (typeof out.data[mime] === 'string') parts.push(out.data[mime] as string);
  }
  return parts.join('\n');
};

export function findSecrets(cells: readonly Cell[]): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const c of cells) {
    if (c.type === 'raw') continue;
    const n = c.type === 'code' ? c.executionCount : null;
    const places: [Hit['where'], string][] = c.type === 'markdown' ? [['text', c.source]] : [['code', c.source], ['output', outText(c)]];
    for (const [where, text] of places) {
      if (!text) continue;
      scanText(text, (kind, tier, value) => {
        const key = `${c.id}\0${value}`;
        if (hits.length >= MOST || seen.has(key)) return;
        seen.add(key);
        hits.push({ cell: c.id, n, where, kind, tier, value, shown: tier === 'secret' ? mask(value) : value });
      });
    }
  }
  return hits;
}

/** The text with every found value replaced by a note of what it was. */
export function redact(text: string, hits: readonly Hit[]): string {
  let out = text;
  const done = new Set<string>();
  for (const h of [...hits].sort((a, b) => b.value.length - a.value.length)) {
    if (done.has(h.value)) continue;
    done.add(h.value);
    const note = `[hidden: ${h.kind.toLowerCase()}]`;
    out = out.split(h.value).join(note);
    // a value inside a saved file is written the way JSON writes it
    const written = JSON.stringify(h.value).slice(1, -1);
    if (written !== h.value) out = out.split(written).join(note);
  }
  return out;
}
