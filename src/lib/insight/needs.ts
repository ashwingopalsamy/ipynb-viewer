import type { Cell, NotebookMeta } from '../notebook';

// What it takes to run a notebook again: the language and its version, the kernel, and the packages the code imports.
// Only Python and R imports are read; any other language gets the facts from the file and no package list.

export interface Needs {
  language: string | null;
  version: string | null;
  kernel: string | null;
  format: string;
  packages: string[];
  /** Packages the notebook installs for itself with %pip or !pip, which need no listing. */
  installs: string[];
  /** The command that installs `packages`, or null when there is nothing to install. */
  command: string | null;
}

const STDLIB = new Set(
  `abc argparse array ast asyncio base64 bisect builtins bz2 calendar cmath collections concurrent configparser contextlib copy csv ctypes dataclasses datetime decimal difflib dis email enum errno fnmatch fractions ftplib functools gc getpass glob gzip hashlib heapq hmac html http importlib inspect io itertools json keyword linecache locale logging lzma math mimetypes multiprocessing numbers operator os pathlib pickle pkgutil platform pprint queue random re sched secrets select shelve shlex shutil signal smtplib socket sqlite3 ssl stat statistics string struct subprocess sys tarfile tempfile textwrap threading time timeit tkinter token tokenize traceback types typing unicodedata unittest urllib uuid warnings weakref webbrowser xml zipfile zlib zoneinfo __future__ posixpath ntpath`.split(/\s+/),
);

/** Import names that differ from the name pip knows the package by. */
const PIP: Record<string, string> = {
  cv2: 'opencv-python', PIL: 'pillow', sklearn: 'scikit-learn', skimage: 'scikit-image', yaml: 'pyyaml', bs4: 'beautifulsoup4',
  dateutil: 'python-dateutil', dotenv: 'python-dotenv', attr: 'attrs', Crypto: 'pycryptodome', serial: 'pyserial', git: 'gitpython',
  jwt: 'pyjwt', mpl_toolkits: 'matplotlib', IPython: 'ipython', tensorflow_hub: 'tensorflow-hub', umap: 'umap-learn', fitz: 'pymupdf',
  docx: 'python-docx', pptx: 'python-pptx', magic: 'python-magic', OpenSSL: 'pyopenssl', MySQLdb: 'mysqlclient', psycopg2: 'psycopg2-binary',
  lightgbm: 'lightgbm', xgboost: 'xgboost', cv: 'opencv-python', pkg_resources: 'setuptools', google: '',
};

const PY_IMPORT = /^[ \t]*(?:import[ \t]+([\w.]+(?:[ \t]+as[ \t]+\w+)?(?:[ \t]*,[ \t]*[\w.]+(?:[ \t]+as[ \t]+\w+)?)*)|from[ \t]+([\w.]+)[ \t]+import\b)/gm;
const PIP_LINE = /^[ \t]*[!%](?:pip|pip3|python -m pip|conda)[ \t]+install[ \t]+(.+)$/gm;
const R_LIB = /\b(?:library|require|requireNamespace)\(\s*["']?([\w.]+)["']?/g;

const hint = (words: string) =>
  words
    .split(/\s+/)
    .filter((w) => w && !w.startsWith('-') && !/[/\\:]/.test(w))
    .map((w) => w.replace(/[<>=!~\[].*$/, ''))
    .filter(Boolean);

export function needs(cells: readonly Cell[], meta: NotebookMeta | null): Needs {
  const language = meta?.language ?? null;
  const info = (meta?.metadata.language_info ?? {}) as Record<string, unknown>;
  const found = new Set<string>();
  const installs = new Set<string>();
  const python = !language || language === 'python';
  const r = language === 'R' || language === 'r';
  for (const c of cells) {
    if (c.type !== 'code') continue;
    for (const m of c.source.matchAll(PIP_LINE)) for (const w of hint(m[1])) installs.add(w.toLowerCase());
    if (python) {
      for (const m of c.source.matchAll(PY_IMPORT)) {
        const names = m[2] ? [m[2]] : m[1].split(',').map((p) => p.trim().split(/\s+/)[0]);
        for (const n of names) {
          const root = n.split('.')[0];
          if (root && !STDLIB.has(root) && !root.startsWith('_')) found.add(root);
        }
      }
    } else if (r) for (const m of c.source.matchAll(R_LIB)) found.add(m[1]);
  }
  const packages = [...new Set([...found].map((n) => (python ? (n in PIP ? PIP[n] : n.replace(/_/g, '-')) : n)).filter(Boolean))]
    .filter((p) => !installs.has(p.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return {
    language,
    version: typeof info.version === 'string' ? info.version : null,
    kernel: meta?.kernel ?? null,
    format: meta ? `${meta.nbformat}.${meta.nbformatMinor}` : '',
    packages,
    installs: [...installs].sort(),
    command: !packages.length ? null : python ? `pip install ${packages.join(' ')}` : r ? `install.packages(c(${packages.map((p) => `"${p}"`).join(', ')}))` : null,
  };
}
