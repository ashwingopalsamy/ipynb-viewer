<script lang="ts">
  type Name = 'list' | 'grid' | 'sliders';
  let { name }: { name: Name } = $props();
</script>

<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'list'}
    <path d="M4.5 6.5h15M8.5 12h11M12.5 17.5h7" />
  {:else if name === 'grid'}
    <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M4 16.5l4.6-4.3a1.5 1.5 0 0 1 2 0l5.4 5.1M14 15.4l1.2-1.1a1.5 1.5 0 0 1 2 0l3.3 3" />
  {:else}
    <path d="M4 8h8.5M18.5 8H20M4 16h2.5M12.5 16H20" />
    <circle cx="15.5" cy="8" r="2.5" />
    <circle cx="9.5" cy="16" r="2.5" />
  {/if}
</svg>
