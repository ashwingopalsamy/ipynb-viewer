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

function apply(value: Theme) {
  theme.value = value;
  root.dataset.theme = value;
}

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
