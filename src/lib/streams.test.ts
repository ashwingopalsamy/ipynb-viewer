import { describe, expect, it } from 'vitest';
import { foldBars } from './streams';

describe('foldBars', () => {
  it('keeps only the last frame of a progress run', () => {
    const text = ' 10%|█         | 10/100 [00:01<00:09]\n 50%|█████     | 50/100 [00:05<00:05]\n100%|██████████| 100/100 [00:10<00:00]\n';
    expect(foldBars(text)).toBe('100%|██████████| 100/100 [00:10<00:00]\n');
  });

  it('leaves ordinary logs alone', () => {
    const text = 'step 1\nstep 2\n';
    expect(foldBars(text)).toBe(text);
  });

  it('keeps text around a run', () => {
    expect(foldBars('start\n 1/3 [=>.]\n 2/3 [==>]\n 3/3 [===]\ndone')).toBe('start\n 3/3 [===]\ndone');
  });
});
