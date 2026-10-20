// A small notebook carried in the address itself. Everything after `#` stays in the browser: a server is never sent it,
// so a link like this shares a notebook without anyone hosting it.

/** The longest address this makes. Chat apps and mail clients start cutting links somewhere past this. */
export const LINK_MAX = 60_000;
/** The most a link may inflate to when it is opened. */
const OPENED_MAX = 40 * 1024 * 1024;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function run(stream: CompressionStream | DecompressionStream, input: Uint8Array, cap = Infinity): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  writer.write(input as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) {
      reader.cancel().catch(() => {});
      throw new Error('That link opens into more than a notebook link should.');
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) (out.set(p, at), (at += p.length));
  return out;
}

/** The part of an address that carries a notebook: what follows `#`, ready to append. */
export async function pack(notebook: string, name: string): Promise<string> {
  const packed = await run(new CompressionStream('deflate-raw'), new TextEncoder().encode(notebook));
  return `nb=${b64(packed)}&name=${encodeURIComponent(name)}`;
}

/** The notebook text and its file name from the fragment of a link, or null when it carries none. */
export async function unpack(hash: string): Promise<{ text: string; name: string } | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const data = params.get('nb');
  if (!data) return null;
  let bytes: Uint8Array;
  try {
    bytes = unb64(data);
  } catch {
    throw new Error('That link is damaged: its notebook could not be read.');
  }
  let text: string;
  try {
    text = new TextDecoder().decode(await run(new DecompressionStream('deflate-raw'), bytes, OPENED_MAX));
  } catch (e) {
    throw e instanceof Error && /more than/.test(e.message) ? e : new Error('That link is damaged: its notebook could not be read.');
  }
  const name = (params.get('name') ?? '').replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩/\\]/g, '').trim().slice(0, 120);
  return { text, name: /\.ipynb$/i.test(name) ? name : `${name || 'shared'}.ipynb` };
}
