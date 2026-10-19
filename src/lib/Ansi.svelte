<script lang="ts">
  import { parseAnsi } from './ansi';
  import './ansi.css';
  let { text }: { text: string } = $props();
  const segments = $derived(parseAnsi(text));
</script>

{#each segments as s}{#if s.cls || s.style}<span class={s.cls} style={s.style}>{s.text}</span>{:else}{s.text}{/if}{/each}
