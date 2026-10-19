<script lang="ts">
  import Icon from './Icon.svelte';

  // One row for everything that is folded, hidden or capped, so there is one thing to learn.
  let {
    kind,
    lead,
    meta = '',
    open = false,
    chev = true,
    well,
    fade = false,
    onclick,
  }: {
    kind: 'closed' | 'code' | 'layer' | 'cap';
    lead: string;
    meta?: string;
    open?: boolean;
    chev?: boolean;
    well?: boolean;
    fade?: boolean;
    onclick: (e: MouseEvent & { currentTarget: HTMLButtonElement }) => void;
  } = $props();
</script>

<button class="row {kind}" class:well={well ?? (kind === 'closed' || kind === 'code')} class:soft={kind === 'layer'} class:fade aria-expanded={open} tabindex="-1" {onclick}>
  {#if chev}<Icon name="chev" />{/if}
  <span class="lead">{lead}</span>
  {#if meta}<em>{meta}</em>{/if}
</button>
