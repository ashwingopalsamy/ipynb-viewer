/** Typesets every `.math` placeholder under `root`. KaTeX and its stylesheet load on first use. */
export async function typeset(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('.math[data-tex]');
  if (!nodes.length) return;
  const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
  for (const node of nodes) {
    katex.render(node.dataset.tex ?? '', node, {
      displayMode: node.classList.contains('display'),
      throwOnError: false,
    });
    node.removeAttribute('data-tex');
  }
}
