import { collapseCarriageReturns, type MimeBundle } from './notebook';

const IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export type Shown =
  | { kind: 'image'; src: string; alpha: boolean }
  | { kind: 'text'; text: string; rich: string | null; html: string | null };

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
  return {
    kind: 'text',
    text: typeof plain === 'string' ? collapseCarriageReturns(plain) : '',
    rich: Object.keys(data).find((m) => m !== 'text/plain') ?? null,
    html: typeof data['text/html'] === 'string' ? data['text/html'] : null,
  };
}
