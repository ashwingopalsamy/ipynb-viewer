import { describe, expect, it } from 'vitest';
import { isName, scan, strip } from './scan';

const facts = (src: string, lang: string | null = 'python') => {
  const f = scan(src, lang);
  return { defs: [...f.defs].sort(), uses: [...f.uses].sort() };
};

describe('strip', () => {
  it('drops comments and empties strings', () => {
    expect(strip('a = "df # no" # df\nb = 1', true)).toBe('a = "" \nb = 1');
  });
  it('keeps what an f-string interpolates', () => {
    expect(strip('m = f"{count} of {total}"', true)).toContain('(count)');
    expect(strip('m = f"{count} of {total}"', true)).toContain('(total)');
  });
  it('drops a triple-quoted docstring whole', () => {
    expect(strip('"""\nx = 1\n"""\ny = 2', true)).toBe('""\ny = 2');
  });
  it('knows the comments of C-like languages', () => {
    expect(strip('a = 1 // df\n/* df */ b = 2', false)).toBe('a = 1 \n b = 2');
  });
});

describe('scan: what a cell defines', () => {
  it('imports', () => {
    expect(facts('import numpy as np\nimport pandas as pd, os.path\nfrom sklearn.model_selection import train_test_split as tts, KFold')).toEqual({
      defs: ['KFold', 'np', 'os', 'pd', 'tts'],
      uses: [],
    });
  });
  it('assignment, chained and unpacked', () => {
    expect(facts('a = b = c\nx, (y, z) = pair\n[p, q] = other')).toEqual({ defs: ['a', 'b', 'p', 'q', 'x', 'y', 'z'], uses: ['c', 'other', 'pair'] });
  });
  it('changing an item or attribute uses the name instead of defining it', () => {
    expect(facts("df['a'] = df.b * 2\nobj.size = n")).toEqual({ defs: [], uses: ['df', 'n', 'obj'] });
  });
  it('augmented assignment both defines and uses', () => {
    expect(facts('total += step')).toEqual({ defs: ['total'], uses: ['step', 'total'] });
  });
  it('loops, context managers and handlers', () => {
    expect(facts('for i, row in df.iterrows():\n    pass\nwith open(path) as fh:\n    pass\ntry:\n    pass\nexcept KeyError as err:\n    pass')).toEqual({
      defs: ['err', 'fh', 'i', 'row'],
      uses: ['KeyError', 'df', 'open', 'path'],
    });
  });
  it('a one-line body is read too', () => {
    expect(facts('if ready: out = value\nfor k in ks: seen = k')).toEqual({ defs: ['k', 'out', 'seen'], uses: ['k', 'ks', 'ready', 'value'] });
  });
  it('walrus', () => {
    expect(facts('if (n := len(a)) > 3:\n    pass').defs).toEqual(['n']);
  });
  it('annotations', () => {
    expect(facts('x: int = 3')).toEqual({ defs: ['x'], uses: ['int'] });
  });
  it('keyword arguments are not names', () => {
    expect(facts('plot(x, color=hue)')).toEqual({ defs: [], uses: ['hue', 'plot', 'x'] });
  });
  it('attributes are not names', () => {
    expect(facts('os.path.join(p)')).toEqual({ defs: [], uses: ['os', 'p'] });
  });
  it('a comparison is not an assignment', () => {
    expect(facts('ok = a == b\nflag = a <= b != c')).toEqual({ defs: ['flag', 'ok'], uses: ['a', 'b', 'c'] });
  });
  it('calls that run over several lines', () => {
    expect(facts('result = compute(\n    alpha,\n    beta=gamma,\n)')).toEqual({ defs: ['result'], uses: ['alpha', 'compute', 'gamma'] });
  });
  it('comprehension variables and lambda parameters stay inside', () => {
    expect(facts('ys = [v * 2 for v in xs if v]\nf = lambda q: q + k')).toEqual({ defs: ['f', 'ys'], uses: ['k', 'xs'] });
  });
  it('strings and comments hold no names', () => {
    expect(facts('# df is here\nname = "df and x"')).toEqual({ defs: ['name'], uses: [] });
    expect(facts('msg = f"{count} items"')).toEqual({ defs: ['msg'], uses: ['count'] });
  });
  it('magics are skipped', () => {
    expect(facts('%matplotlib inline\n!pip install foo\n%%time')).toEqual({ defs: [], uses: [] });
  });
});

describe('scan: functions and classes', () => {
  it('parameters and locals stay inside the function', () => {
    expect(facts('def area(w, h=DEFAULT):\n    total = w * h\n    return total + OFFSET\narea(2)')).toEqual({ defs: ['area'], uses: ['DEFAULT', 'OFFSET', 'area'] });
  });
  it('global reaches out', () => {
    expect(facts('def bump():\n    global n\n    n = n + 1')).toEqual({ defs: ['bump', 'n'], uses: ['n'] });
  });
  it('annotations of parameters are read', () => {
    expect(facts('def f(a: Frame = None) -> Out:\n    pass')).toEqual({ defs: ['f'], uses: ['Frame'] });
  });
  it('a class defines its name; its attributes belong to no one', () => {
    expect(facts('class Net(Base):\n    size = 3\n    def run(self):\n        return size')).toEqual({ defs: ['Net'], uses: ['Base', 'size'] });
  });
  it('the next top-level line leaves the function', () => {
    expect(facts('def f(x):\n    y = x\nx = 5')).toEqual({ defs: ['f', 'x'], uses: [] });
  });
  it('a one-line function', () => {
    expect(facts('def inc(a): return a + step')).toEqual({ defs: ['inc'], uses: ['step'] });
  });
});

describe('scan: other languages', () => {
  it('JavaScript declarations', () => {
    expect(facts('const total = items.length;\nlet [a, b] = pair;\nconst f = (x) => x + 1;\nfunction go(n) { return n }', 'javascript')).toEqual({
      defs: ['a', 'b', 'f', 'go', 'total'],
      uses: ['items', 'n', 'pair', 'x'],
    });
  });
  it('R arrows', () => {
    expect(facts('x <- c(1, 2)', 'r')).toEqual({ defs: ['x'], uses: ['c'] });
  });
});

describe('isName', () => {
  it('rejects keywords and everything that is not an identifier', () => {
    expect(isName('df')).toBe(true);
    expect(isName('_x1')).toBe(true);
    expect(isName('for')).toBe(false);
    expect(isName('1a')).toBe(false);
    expect(isName('a.b')).toBe(false);
  });
});
