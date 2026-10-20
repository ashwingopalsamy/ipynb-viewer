<script lang="ts">
  type Name = 'open' | 'info' | 'chev' | 'file' | 'heading';
  let { name }: { name: Name } = $props();
</script>

<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'open'}
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  {:else if name === 'chev'}
    <path d="m9 6 6 6-6 6" />
  {:else if name === 'file'}
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  {:else if name === 'heading'}
    <path d="M6 12h12M6 20V4M18 20V4" />
  {:else}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8v.1" />
  {/if}
</svg>
