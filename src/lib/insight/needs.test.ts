import { describe, expect, it } from 'vitest';
import type { Cell, NotebookMeta } from '../notebook';
import { needs } from './needs';

const code = (source: string) => ({ id: source, type: 'code', source, metadata: {}, executionCount: null, outputs: [] }) as unknown as Cell;
const meta = (language: string, version = '3.11.4'): NotebookMeta => ({ nbformat: 4, nbformatMinor: 5, metadata: { language_info: { name: language, version } }, language, kernel: 'Python 3 (ipykernel)' });

describe('needs', () => {
  it('lists third-party imports, maps names to pip, and skips the standard library', () => {
    const n = needs([code('import os, sys\nimport numpy as np\nimport pandas as pd, sklearn.linear_model\nfrom PIL import Image\nfrom . import sibling\nfrom collections import Counter')], meta('python'));
    expect(n.packages).toEqual(['numpy', 'pandas', 'pillow', 'scikit-learn']);
    expect(n.command).toBe('pip install numpy pandas pillow scikit-learn');
    expect(n.version).toBe('3.11.4');
    expect(n.kernel).toBe('Python 3 (ipykernel)');
    expect(n.format).toBe('4.5');
  });

  it('leaves out what the notebook installs itself', () => {
    const n = needs([code('%pip install -q seaborn requests==2.31\n'), code('import seaborn\nimport requests\nimport scipy')], meta('python'));
    expect(n.installs).toEqual(['requests', 'seaborn']);
    expect(n.packages).toEqual(['scipy']);
  });

  it('reads R libraries', () => {
    const n = needs([code('library(ggplot2)\nrequire("dplyr")')], meta('R', '4.3.1'));
    expect(n.command).toBe('install.packages(c("dplyr", "ggplot2"))');
  });

  it('gives the facts and no list for other languages', () => {
    const n = needs([code('using Plots')], meta('julia', '1.10'));
    expect(n.packages).toEqual([]);
    expect(n.command).toBeNull();
  });

  it('copes with no metadata', () => {
    expect(needs([], null).packages).toEqual([]);
  });
});
