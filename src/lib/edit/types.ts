/** Where the caret goes when an editor opens. */
export type Caret =
  | 'start'
  | 'end'
  /** A character position inside the block, as `textOffset` counts. */
  | { offset: number }
  /** The point that was clicked. */
  | { x: number; y: number }
  /** The same, with the word under it selected, as a double-click does. */
  | { word: { x: number; y: number } }
  /** The first place this text occurs in a source editor. */
  | { find: string }
  /** The first or last line of the block, at this horizontal position: arriving from the block above or below. */
  | { edge: 'top' | 'bottom'; x: number };

/** What happens after an editor commits: which block opens next, and where its caret goes. */
export interface Follow {
  to: 'prev' | 'same' | 'next' | 'ghost';
  at: Caret;
}
