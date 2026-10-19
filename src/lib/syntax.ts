import type { ThemeRegistration } from 'shiki/core';

interface Palette {
  text: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  function: string;
  builtin: string;
  type: string;
  decorator: string;
  param: string;
  property: string;
  operator: string;
  punct: string;
}

// Every color clears 4.5:1 against the well the code sits in (#e6e8ef light, #272833 dark).
const light: Palette = {
  text: '#1f2328',
  comment: '#59626d',
  keyword: '#a1307a',
  string: '#0a6640',
  number: '#0b5fc5',
  function: '#6639ba',
  builtin: '#0b6a8a',
  type: '#9a5200',
  decorator: '#b2450f',
  param: '#3d444d',
  property: '#0a58a8',
  operator: '#57606a',
  punct: '#5a636d',
};

const dark: Palette = {
  text: '#e6e6ea',
  comment: '#8b929c',
  keyword: '#f28bbd',
  string: '#7fd7a0',
  number: '#79b8ff',
  function: '#c3a6ff',
  builtin: '#6ed4e8',
  type: '#f0b86e',
  decorator: '#ffa07a',
  param: '#c9d1d9',
  property: '#9ecbff',
  operator: '#a3abb5',
  punct: '#8f98a3',
};

function build(name: string, type: 'light' | 'dark', p: Palette, background: string): ThemeRegistration {
  const rule = (scope: string[], foreground: string, fontStyle?: string) => ({
    scope,
    settings: fontStyle ? { foreground, fontStyle } : { foreground },
  });
  return {
    name,
    type,
    colors: { 'editor.foreground': p.text, 'editor.background': background },
    tokenColors: [
      rule(['comment', 'punctuation.definition.comment'], p.comment, 'italic'),
      rule(['punctuation', 'meta.brace', 'meta.delimiter'], p.punct),
      rule(['keyword.operator', 'keyword.operator.assignment', 'keyword.operator.arithmetic'], p.operator),
      rule(
        ['keyword', 'storage', 'storage.type', 'storage.modifier', 'constant.language', 'keyword.control', 'keyword.operator.logical', 'keyword.operator.word', 'keyword.operator.expression'],
        p.keyword,
      ),
      rule(['variable.language', 'variable.parameter.function.language.special'], p.keyword, 'italic'),
      rule(['string', 'punctuation.definition.string', 'string.quoted'], p.string),
      rule(['constant.character.escape', 'string.interpolated', 'punctuation.definition.template-expression', 'constant.other.placeholder'], p.decorator),
      rule(['constant.numeric', 'constant.numeric.integer', 'constant.numeric.float', 'constant.other'], p.number),
      rule(['entity.name.function', 'meta.function-call', 'meta.function-call.generic', 'support.function'], p.function),
      rule(['support.function.builtin', 'support.type', 'support.class', 'support.function.magic'], p.builtin),
      rule(['entity.name.class', 'entity.name.type', 'entity.other.inherited-class', 'support.type.python'], p.type),
      rule(['entity.name.function.decorator', 'meta.function.decorator', 'punctuation.definition.decorator', 'meta.decorator'], p.decorator),
      rule(['variable.parameter', 'meta.function.parameters variable'], p.param),
      rule(['variable.other.property', 'variable.other.object.property', 'support.variable.attribute', 'support.type.property-name', 'meta.attribute', 'entity.other.attribute-name'], p.property),
      rule(['entity.name.tag', 'meta.tag'], p.keyword),
      rule(['markup.heading', 'entity.name.section'], p.function, 'bold'),
    ],
  };
}

export const lightTheme = build('ipynb-light', 'light', light, '#f6f6f8');
export const darkTheme = build('ipynb-dark', 'dark', dark, '#1a1a1f');
