export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** Mime type to payload. Text mimes are joined strings, images are base64 without whitespace. */
export type MimeBundle = Record<string, Json>;

export interface StreamOutput {
  type: 'stream';
  name: string;
  text: string;
}

export interface DisplayOutput {
  type: 'display';
  data: MimeBundle;
  metadata: JsonObject;
}

export interface ResultOutput {
  type: 'result';
  data: MimeBundle;
  metadata: JsonObject;
  executionCount: number | null;
}

export interface ErrorOutput {
  type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

export type Output = StreamOutput | DisplayOutput | ResultOutput | ErrorOutput;

interface CellBase {
  id: string;
  source: string;
  metadata: JsonObject;
}

export interface MarkdownCell extends CellBase {
  type: 'markdown';
  attachments: Record<string, MimeBundle>;
}

export interface CodeCell extends CellBase {
  type: 'code';
  executionCount: number | null;
  outputs: Output[];
}

export interface RawCell extends CellBase {
  type: 'raw';
}

export type Cell = MarkdownCell | CodeCell | RawCell;

export interface NotebookMeta {
  /** Version found in the file. Cells are always in the v4 shape. */
  nbformat: number;
  nbformatMinor: number;
  metadata: JsonObject;
  language: string | null;
  kernel: string | null;
}

export interface Notebook extends NotebookMeta {
  cells: Cell[];
  warnings: string[];
}

export type NotebookEvent =
  | { type: 'cell'; cell: Cell }
  | { type: 'warning'; message: string }
  | { type: 'done'; meta: NotebookMeta };

export class NotebookParseError extends Error {
  override name = 'NotebookParseError';
}
