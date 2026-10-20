<script lang="ts">
  type Name = 'list' | 'grid' | 'doc' | 'sliders' | 'search' | 'look' | 'columns' | 'code' | 'output' | 'more' | 'keys' | 'chevron' | 'globe' | 'shield' | 'info' | 'link';
  let { name }: { name: Name } = $props();
</script>

<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'list'}
    <path d="M4.5 6.5h15M8.5 12h11M12.5 17.5h7" />
  {:else if name === 'grid'}
    <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M4 16.5l4.6-4.3a1.5 1.5 0 0 1 2 0l5.4 5.1M14 15.4l1.2-1.1a1.5 1.5 0 0 1 2 0l3.3 3" />
  {:else if name === 'doc'}
    <path d="M8 3.5h5.5l5 5V18a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5ZM13.5 3.5v5h5M9 13h6M9 16.5h4" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  {:else if name === 'look'}
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
  {:else if name === 'columns'}
    <rect x="3.5" y="5" width="17" height="14" rx="4" />
    <path d="M12 5v14" />
  {:else if name === 'code'}
    <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
  {:else if name === 'output'}
    <rect x="3.5" y="5" width="17" height="14" rx="4" />
    <path d="M8 10.5h8M8 14h5" />
  {:else if name === 'more'}
    <path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3" />
  {:else if name === 'keys'}
    <rect x="3" y="6.5" width="18" height="11" rx="3.5" />
    <path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8" />
  {:else if name === 'info'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  {:else if name === 'link'}
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-.8.8M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l.8-.8" />
  {:else if name === 'globe'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.3-3.6-8.5S9.6 6 12 3.5Z" />
  {:else if name === 'shield'}
    <path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  {:else if name === 'chevron'}
    <path d="m9 6 6 6-6 6" />
  {:else}
    <path d="M4 8h8.5M18.5 8H20M4 16h2.5M12.5 16H20" />
    <circle cx="15.5" cy="8" r="2.5" />
    <circle cx="9.5" cy="16" r="2.5" />
  {/if}
</svg>
