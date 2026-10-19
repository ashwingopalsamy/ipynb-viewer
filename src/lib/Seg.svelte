<script lang="ts" generics="T extends string | number">
  import { roving } from './roving';

  // A segmented control: one choice from a few, with a thumb that slides to it.
  let { label, options, value, onchange, disabled = [] }: { label: string; options: readonly (readonly [T, string])[]; value: T; onchange: (value: T) => void; disabled?: readonly T[] } = $props();

  const at = $derived(options.findIndex(([v]) => v === value));
  const off = (i: number) => disabled.includes(options[i][0]);
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--i={Math.max(at, 0)} style:--n={options.length}>
  <i class="thumb"></i>
  {#each options as [v, text], i}
    <button role="radio" aria-checked={i === at} tabindex={i === at ? 0 : -1} disabled={off(i)} onclick={() => onchange(v)} onkeydown={(e) => roving(e, at, options.length, off, (k) => onchange(options[k][0]))}>{text}</button>
  {/each}
</div>
