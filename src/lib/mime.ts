import { collapseCarriageReturns, type MimeBundle } from './notebook';

const IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
/** Types that are shown as text or as markdown, so they never count as left out. */
const DRAWN = ['text/plain', 'text/markdown', 'text/latex'];

export type Shown =
  | { kind: 'image'; src: string; alpha: boolean }
  | {
      kind: 'text';
      text: string;
      /** The first type nothing here can draw, which is what the note says was left out. */
      rich: string | null;
      html: string | null;
      /** Markdown or LaTeX the output carries, drawn as the markdown cells are. */
      md: string | null;
      /** A widget or a chart library's object: its plain text is only a description of an object, so it stays out of sight. */
      chart: boolean;
    };

// The PNG header stores the color type at byte 25; 4 and 6 carry an alpha channel.
const hasAlpha = (b64: string) => {
  try {
    const type = atob(b64.slice(0, 36)).charCodeAt(25);
    return type === 4 || type === 6;
  } catch {
    return false;
  }
};

/** Picks what a display or result bundle can show today: a raster image, else its plain text. */
export function describeData(data: MimeBundle): Shown {
  for (const mime of IMAGES) {
    const v = data[mime];
    if (typeof v === 'string') return { kind: 'image', src: `data:${mime};base64,${v}`, alpha: mime === 'image/png' && hasAlpha(v) };
  }
  const plain = data['text/plain'];
  const rich = Object.keys(data).find((m) => !DRAWN.includes(m)) ?? null;
  return {
    kind: 'text',
    text: typeof plain === 'string' ? collapseCarriageReturns(plain) : '',
    rich,
    html: [data['text/html'], data['image/svg+xml']].find((v) => typeof v === 'string') as string | undefined ?? null,
    md: ([data['text/markdown'], data['text/latex']].find((v) => typeof v === 'string' && v.trim()) as string | undefined) ?? null,
    chart: !!rich && /widget|plotly|bokeh|vega|holoviews/.test(rich),
  };
}
