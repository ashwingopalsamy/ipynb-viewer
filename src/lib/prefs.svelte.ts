// Reader options. Each one that is off its default is a token on <html data-pf>, remembered in storage;
// the stylesheet and a few small watchers do the rest. index.html sets the attribute before the first paint.
const root = document.documentElement;

export const SIZES = [90, 100, 110, 125, 140];

export const pf = $state<{ on: string[] }>({ on: (root.dataset.pf ?? '').split(' ').filter(Boolean) });

export const has = (token: string) => pf.on.includes(token);

function save() {
  const value = pf.on.join(' ');
  root.dataset.pf = value;
  try {
    if (value) localStorage.setItem('pf', value);
    else localStorage.removeItem('pf');
  } catch {
    // storage can be blocked; the choice then lasts for this visit only
  }
}

export function set(token: string, on: boolean) {
  pf.on = on ? [...new Set([...pf.on, token])] : pf.on.filter((t) => t !== token);
  save();
}

/** The text size as a percentage; 100 is the default and has no token. */
export const zoom = () => SIZES.find((n) => has(`z${n}`)) ?? 100;

export function setZoom(n: number) {
  pf.on = pf.on.filter((t) => !/^z\d+$/.test(t)).concat(n === 100 ? [] : [`z${n}`]);
  save();
}
