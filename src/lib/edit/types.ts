/** Where the caret goes when an editor opens. */
export type Caret =
  | 'start'
  | 'end'
  /** A character position inside the block, as `textOffset` counts. */
  | { offset: number }
  /** The point that was clicked, from the top left of the block's box: an open block can be drawn a little higher or lower. */
  | { x: number; y: number }
  /** The first place this text occurs in a source editor. */
  | { find: string }
  /** The first or last line of the block, at this horizontal position: arriving from the block above or below. */
  | { edge: 'top' | 'bottom'; x: number };

/** What happens after an editor commits: which block opens next, and where its caret goes. */
export interface Follow {
  /** `near`: an edit in this cell is about to be taken back or put back, and the block where the text changes opens. */
  to: 'prev' | 'same' | 'next' | 'ghost' | 'above' | 'near';
  at: Caret;
}
