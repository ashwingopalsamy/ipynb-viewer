import { stripAnsi } from './notebook';

// A frame from the reader's own cells, as IPython names them.
const OWN = /^(Cell In\[\d+\]|Input In \[\d+\]|File "?<ipython-input)/;

/**
 * Long tracebacks reduce to the last frame in the reader's own code and the exception line.
 * Returns null when there is nothing worth hiding.
 */
export function calm(traceback: readonly string[]): string[] | null {
  const n = traceback.length;
  if (n < 5) return null;
  let own = n - 2;
  for (let i = n - 2; i >= 1; i--) {
    if (OWN.test(stripAnsi(traceback[i]).trimStart())) {
      own = i;
      break;
    }
  }
  return [traceback[own], traceback[n - 1]];
}
