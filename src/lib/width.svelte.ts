const root = document.documentElement;

// index.html sets data-width before the first paint; this keeps the switch in step with it.
export const layout = $state<{ wide: boolean }>({ wide: root.dataset.width === 'wide' });

export function toggleWidth() {
  layout.wide = !layout.wide;
  root.dataset.width = layout.wide ? 'wide' : 'normal';
  try {
    localStorage.setItem('width', layout.wide ? 'wide' : 'normal');
  } catch {
    // the choice then lasts for this visit only
  }
}
