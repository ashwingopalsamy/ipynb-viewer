export type Width = 'narrow' | 'normal' | 'wide';

const root = document.documentElement;

// index.html sets data-width before the first paint; this keeps the choice in step with it.
export const layout = $state<{ value: Width }>({ value: (root.dataset.width as Width) ?? 'normal' });

export function setWidth(next: Width) {
  layout.value = next;
  root.dataset.width = next;
  try {
    localStorage.setItem('width', next);
  } catch {
    // the choice then lasts for this visit only
  }
}
