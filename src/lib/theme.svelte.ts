export type Theme = 'light' | 'dark';

const root = document.documentElement;
const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};

export const theme = $state<{ value: Theme }>({ value: root.dataset.theme === 'dark' ? 'dark' : 'light' });

// The browser's own chrome (an installed window's title bar, a phone's address bar) follows the page, not the system.
function apply(value: Theme) {
  theme.value = value;
  root.dataset.theme = value;
  (document.getElementsByName('theme-color')[0] as HTMLMetaElement).content = value === 'dark' ? '#0a0a0c' : '#f5f5f7';
}
apply(theme.value);

export function toggleTheme() {
  const next: Theme = theme.value === 'dark' ? 'light' : 'dark';
  apply(next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    // storage can be blocked; the choice then lasts for this visit only
  }
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!stored()) apply(e.matches ? 'dark' : 'light');
});
