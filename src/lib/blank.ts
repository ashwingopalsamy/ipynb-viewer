import type { Cell } from './notebook';

/** A cell with nothing to read: no text and no output. The page leaves it out. */
export const blank = (c: Cell) => !c.source.trim() && !(c.type === 'code' && c.outputs.length);
