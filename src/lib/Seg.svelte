<script lang="ts" generics="T extends string | number">
  import type { Snippet } from 'svelte';
  import { roving } from './roving';

  // A segmented control: one choice from a few, with a thumb that slides to it. An item snippet draws each choice (an icon, say) in place of its words.
  let { label, options, value, onchange, disabled = [], item }: { label: string; options: readonly (readonly [T, string])[]; value: T; onchange: (value: T) => void; disabled?: readonly T[]; item?: Snippet<[T, string]> } = $props();

  const at = $derived(options.findIndex(([v]) => v === value));
  const off = (i: number) => disabled.includes(options[i][0]);
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--i={Math.max(at, 0)} style:--n={options.length}>
  <i class="thumb"></i>
  {#each options as [v, text], i}
    <button role="radio" aria-label={text} title={item ? text : undefined} aria-checked={i === at} tabindex={i === at ? 0 : -1} disabled={off(i)} onclick={() => onchange(v)} onkeydown={(e) => roving(e, at, options.length, off, (k) => onchange(options[k][0]))}>{#if item}{@render item(v, text)}{:else}{text}{/if}</button>
  {/each}
</div>
