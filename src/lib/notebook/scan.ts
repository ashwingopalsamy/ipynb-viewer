import { NotebookParseError } from './types';

export type ScanItem =
  | { kind: 'cell'; raw: string }
  | { kind: 'member'; key: string; raw: string }
  | { kind: 'end'; complete: boolean; truncatedCell: boolean };

interface Frame {
  arr: boolean;
  key: string | null;
  isCells: boolean;
  expectKey: boolean;
  curKey: string | null;
}

interface Capture {
  kind: 'cell' | 'member';
  key: string;
  closeLen: number;
  scalar: 'none' | 'string' | 'prim';
}

const isWs = (c: number) => c <= 32;

/**
 * Incremental scanner for notebook JSON. It never builds the whole document:
 * it hands back each cell (v4 `cells`, v3 `worksheets[].cells`) and each other
 * top-level member as raw JSON text, so cells can be parsed and shown as the
 * bytes arrive and the full file never needs to sit in memory as one value.
 */
export class NotebookScanner {
  private stack: Frame[] = [];
  private started = false;
  private done = false;
  private inString = false;
  private esc = false;
  private keyMode = false;
  private keyBuf = '';
  private cap: Capture | null = null;
  private carry = '';
  private first = true;

  push(chunk: string): ScanItem[] {
    const items: ScanItem[] = [];
    if (this.first && chunk.length) {
      this.first = false;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    const s = chunk;
    const n = s.length;
    const stack = this.stack;
    let capFrom = 0;

    const endCap = (end: number) => {
      const cap = this.cap!;
      const raw = this.carry + s.slice(capFrom, end);
      this.carry = '';
      this.cap = null;
      items.push(cap.kind === 'cell' ? { kind: 'cell', raw } : { kind: 'member', key: cap.key, raw });
    };

    for (let i = 0; i < n; i++) {
      if (this.done) break;
      const c = s.charCodeAt(i);

      if (this.inString) {
        if (this.esc) {
          this.esc = false;
          if (this.keyMode) this.keyBuf += s[i];
        } else if (c === 92) {
          this.esc = true;
          if (this.keyMode) this.keyBuf += '\\';
        } else if (c === 34) {
          this.inString = false;
          if (this.keyMode) {
            this.keyMode = false;
            stack[stack.length - 1].curKey = this.keyBuf;
          } else if (this.cap && this.cap.scalar === 'string') {
            endCap(i + 1);
          }
        } else if (this.keyMode) this.keyBuf += s[i];
        continue;
      }

      if (isWs(c)) {
        if (this.cap?.scalar === 'prim') endCap(i);
        continue;
      }

      if (!this.started) {
        if (c !== 123) throw new NotebookParseError('Not a notebook: the file does not start with a JSON object');
        this.started = true;
        stack.push({ arr: false, key: null, isCells: false, expectKey: true, curKey: null });
        continue;
      }

      const top = stack[stack.length - 1];

      if (c === 44) {
        if (this.cap?.scalar === 'prim') endCap(i);
        if (!top.arr) top.expectKey = true;
        continue;
      }
      if (c === 58) {
        top.expectKey = false;
        continue;
      }
      if (c === 125 || c === 93) {
        if (this.cap?.scalar === 'prim') endCap(i);
        stack.pop();
        if (this.cap && this.cap.scalar === 'none' && stack.length === this.cap.closeLen) endCap(i + 1);
        if (stack.length === 0) this.done = true;
        continue;
      }

      if (c === 34 && !top.arr && top.expectKey) {
        this.inString = true;
        this.keyMode = true;
        this.keyBuf = '';
        top.expectKey = false;
        continue;
      }

      // A value starts here.
      const isOpen = c === 123 || c === 91;
      if (!this.cap) {
        const closeLen = stack.length;
        if (top.arr && top.isCells) {
          this.cap = { kind: 'cell', key: '', closeLen, scalar: isOpen ? 'none' : c === 34 ? 'string' : 'prim' };
        } else if (!top.arr && stack.length === 1) {
          const key = top.curKey ?? '';
          const descend = c === 91 && (key === 'cells' || key === 'worksheets');
          if (!descend) {
            this.cap = { kind: 'member', key, closeLen, scalar: isOpen ? 'none' : c === 34 ? 'string' : 'prim' };
          }
        }
        if (this.cap) capFrom = i;
      }
      if (c === 34) {
        this.inString = true;
      } else if (isOpen) {
        const parentKey = top.arr ? null : top.curKey;
        const isCells =
          c === 91 &&
          !top.arr &&
          parentKey === 'cells' &&
          (stack.length === 1 || (stack.length === 3 && stack[1].key === 'worksheets'));
        stack.push({ arr: c === 91, key: parentKey, isCells, expectKey: c === 123, curKey: null });
      }
    }

    if (this.cap) {
      this.carry += s.slice(capFrom);
    }
    return items;
  }

  finish(): ScanItem[] {
    if (!this.started) throw new NotebookParseError('The file is empty');
    return [{ kind: 'end', complete: this.done, truncatedCell: this.cap !== null && this.cap.kind === 'cell' }];
  }
}
