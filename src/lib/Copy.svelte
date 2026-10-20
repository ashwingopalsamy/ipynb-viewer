<script lang="ts">
  import './copy.css';

  let { get, what }: { get: () => string; what: string } = $props();

  let done = $state(false);
  let failed = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Where the clipboard API is not offered (a file opened from disk, an old browser), a hidden field does the same.
  function fallback(text: string) {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }

  async function copy() {
    const text = get();
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = fallback(text);
    }
    done = ok;
    failed = !ok;
    clearTimeout(timer);
    timer = setTimeout(() => ((done = false), (failed = false)), 1600);
  }
</script>

<button class="copy" class:done tabindex="-1" title={done ? 'Copied' : failed ? 'Could not copy' : `Copy ${what}`} aria-label="Copy {what}" onclick={copy}>
  <svg class="c" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="11" height="11" rx="3" />
    <path d="M15.5 8.5V7a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" />
  </svg>
  <svg class="k" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
  </svg>
</button>
<span class="sr" role="status">{done ? 'Copied' : failed ? 'Could not copy' : ''}</span>
