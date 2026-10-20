<script lang="ts">
  import type { Cell } from './notebook';
  import Pop from './Pop.svelte';
  import Seg from './Seg.svelte';
  import { ui } from './ui.svelte';
  import { toMarkdown, tokens, type Detail } from './handoff';
  import { findSecrets, redact } from './insight/secrets';
  import { fileName, save, size } from './export';
  import './export.css';

  // The menu behind the document button: the notebook as Markdown for a prompt or a note, copied or saved.
  let { cells, name, language }: { cells: readonly Cell[]; name: string; language: string | null } = $props();

  const DETAIL: [Detail, string][] = [
    ['trim', 'Trimmed'],
    ['none', 'None'],
    ['full', 'Full'],
  ];
  const stored = (): Detail => {
    try {
      const v = localStorage.getItem('md');
      return DETAIL.some(([d]) => d === v) ? (v as Detail) : 'trim';
    } catch {
      return 'trim';
    }
  };
  const BUDGET: [number, string][] = [
    [0, 'None'],
    [8000, '8k'],
    [32000, '32k'],
    [128000, '128k'],
  ];
  let budget = $state(0);
  let detail = $state<Detail>(stored());
  const choose = (d: Detail) => {
    detail = d;
    try {
      localStorage.setItem('md', d);
    } catch {
      // the choice then lasts for this visit only
    }
  };

  // Only worked out while the menu is up: a large notebook should not be rewritten as it streams in.
  const made = $derived.by(() => (ui.pop === 'md' ? toMarkdown(cells, { file: name, language, outputs: detail, budget }) : null));
  // what a notebook gives away by accident stays out of the copy unless the reader says otherwise
  const hits = $derived(made && ui.hide ? findSecrets(cells) : []);
  const text = $derived(made ? (hits.length ? redact(made.text, hits) : made.text) : '');
  const weight = $derived(new TextEncoder().encode(text).length);
  const count = $derived.by(() => {
    const n = made ? tokens(text) : 0;
    return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
  });
  const note = $derived(
    made
      ? [
          made.over ? 'Over the budget even with no outputs.' : made.squeezed ? `Outputs were cut harder to fit ${budget / 1000}k.` : detail === 'trim' && made.trimmed ? 'Long outputs keep their first and last lines.' : '',
          detail !== 'none' && made.left && !made.over ? 'Pictures and interactive outputs are named, not included.' : '',
          hits.length ? `${hits.length} possible ${hits.length === 1 ? 'secret is' : 'secrets are'} hidden.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : '',
  );

  let failed = $state('');
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy() {
    failed = '';
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1600);
    } catch {
      failed = 'The clipboard did not accept it. Save the file instead.';
    }
  }
  function download() {
    save(new Blob([text], { type: 'text/markdown' }), `${fileName(name)}.md`);
    ui.pop = null;
  }
</script>

<Pop id="md" label="Copy as Markdown" width={300} anchor={() => document.querySelector('[data-pop=md]')}>
  <div class="fig">
    <h3 class="cat">Copy as Markdown</h3>
    <p class="cap">Outputs</p>
    <Seg label="Outputs" options={DETAIL} value={detail} onchange={choose} />
    <p class="cap">Fit to a model</p>
    <Seg label="Token budget" options={BUDGET} value={budget} onchange={(b) => (budget = b)} />
    <p class="meta"><span>{#if made}{made.cells.toLocaleString('en-US')} cells · about {count} tokens{/if}</span><span>{#if made}{size(weight)}{/if}</span></p>
    <p class="note" class:bad={!!failed} role="status">{failed || note}</p>
    <div class="btns">
      <button class="btn" disabled={!made} onclick={download}>Save .md</button>
      <button class="btn solid" disabled={!made} onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  </div>
</Pop>
