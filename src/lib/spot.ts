/** Marks the cell under the reading line, a little above the middle of the screen, so the rest can step back. */
export function spotlight(): () => void {
  const root = document.querySelector('.notebook');
  if (!root) return () => {};
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('lit', e.isIntersecting)), { rootMargin: '-40% 0px -59% 0px' });
  const watch = () => root.querySelectorAll(':scope > .cell').forEach((c) => io.observe(c));
  watch();
  // cells keep arriving while a notebook is read in
  const mo = new MutationObserver(watch);
  mo.observe(root, { childList: true });
  return () => {
    io.disconnect();
    mo.disconnect();
    root.querySelectorAll('.lit').forEach((c) => c.classList.remove('lit'));
  };
}
