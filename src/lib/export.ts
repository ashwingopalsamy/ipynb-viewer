// Saving pictures: re-encoding in the browser's canvas, nothing leaves the page.
export type Format = 'png' | 'jpeg' | 'webp';

export const TYPES: Record<Format, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
export const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };
export const LABEL: Record<Format, string> = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP' };

/** Quality for the lossy formats: high enough that text in a plot stays clean. */
const QUALITY = 0.92;

/** WebP encoding is not offered everywhere (Safari has no encoder in older versions). */
export const canWebp = () => {
  try {
    return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
};

/** The most pixels a canvas is asked for: phones have far less to spare than a desktop. */
export const limit = () => (matchMedia('(pointer: coarse)').matches ? 16_000_000 : 40_000_000);

/** Whether a picture of this size, scaled up, still fits one canvas. */
export const fits = (w: number, h: number, scale: number) => w * scale * (h * scale) <= limit() && Math.max(w, h) * scale <= 16_384;

export const mimeOf = (src: string) => /^data:([^;,]+)/.exec(src)?.[1] ?? '';

/** The bytes of a base64 data URL, without going through the network stack. */
export function bytes(src: string): Blob {
  const comma = src.indexOf(',');
  const raw = atob(src.slice(comma + 1));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return new Blob([out], { type: mimeOf(src) });
}

export async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export function encode(canvas: HTMLCanvasElement, format: Format): Promise<Blob> {
  return new Promise((done, fail) =>
    canvas.toBlob((b) => (b ? done(b) : fail(new Error('The browser could not make that image.'))), TYPES[format], format === 'png' ? undefined : QUALITY),
  );
}

/**
 * The picture in another format or size. The original bytes go through untouched when nothing changes;
 * JPEG has no transparency, so it is flattened onto white.
 */
export async function convert(src: string, img: HTMLImageElement, format: Format, scale: number): Promise<Blob> {
  if (scale === 1 && mimeOf(src) === TYPES[format]) return bytes(src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return encode(canvas, format);
}

export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Only PNG is accepted by every clipboard. The promise goes in unresolved, which is what Safari requires. */
export const canCopy = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
export const copyPng = (png: Promise<Blob>) => navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);

/** `notes.ipynb` and a tag become `notes-figure-12`, safe to use as a file name. */
export function fileName(file: string, tag = ''): string {
  const stem = file.replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'notebook';
  return tag ? `${stem}-${tag}` : stem;
}

export function size(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
