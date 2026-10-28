export type Width = 'narrow' | 'normal' | 'wide';

const root = document.documentElement;

// index.html sets data-width before the first paint; this keeps the choice in step with it.
export const layout = $state<{ value: Width }>({ value: (root.dataset.width as Width) ?? 'normal' });

// A width chosen in another page of the app (another tab, or another window) is followed here, and never written back.
addEventListener('storage', (e) => {
  if (e.key !== 'width') return;
  if (e.newValue === 'narrow' || e.newValue === 'normal' || e.newValue === 'wide') {
    layout.value = e.newValue;
    root.dataset.width = e.newValue;
  }
});

export function setWidth(next: Width) {
  layout.value = next;
  root.dataset.width = next;
  try {
    localStorage.setItem('width', next);
  } catch {
    // the choice then lasts for this visit only
  }
}
