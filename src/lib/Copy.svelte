<script lang="ts">
  import './copy.css';

  let { get, what }: { get: () => string; what: string } = $props();

  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Where the clipboard API is not offered (a file opened from disk, an old browser), a hidden field does the same.
  function fallback(text: string) {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0';
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }

  async function copy() {
    const text = get();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallback(text);
    }
    done = true;
    clearTimeout(timer);
    timer = setTimeout(() => (done = false), 1600);
  }
</script>

<button class="copy" class:done tabindex="-1" title={done ? 'Copied' : `Copy ${what}`} aria-label="Copy {what}" onclick={copy}>
  <svg class="c" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="11" height="11" rx="3" />
    <path d="M15.5 8.5V7a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" />
  </svg>
  <svg class="k" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
  </svg>
</button>
<span class="sr" role="status">{done ? 'Copied' : ''}</span>
