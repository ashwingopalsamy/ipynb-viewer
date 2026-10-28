import type { Notebook, NotebookEvent } from '../notebook';

export const isMarkdown = (name: string) => /\.(?:md|markdown)$/i.test(name);

/** A markdown file as a notebook of one text cell, so the reader and the editor treat it like any other. */
export async function readMarkdown(file: Pick<File, 'text'>, on: (event: NotebookEvent) => void = () => {}): Promise<Notebook> {
  // line endings are put back on save, so the cell only ever holds \n
  const source = (await file.text()).replace(/\r\n?/g, '\n');
  const cell = { type: 'markdown' as const, id: 'md', source, metadata: {}, attachments: {} };
  const meta = { nbformat: 4, nbformatMinor: 0, metadata: {}, language: null, kernel: null };
  on({ type: 'cell', cell });
  on({ type: 'done', meta });
  return { ...meta, cells: [cell], warnings: [] };
}
