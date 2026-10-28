<script lang="ts">
  import './veil.css';

  let { on, label = 'Drop to open' }: { on: boolean; label?: string } = $props();
</script>

<div class="veil" class:on aria-hidden="true">
  <div class="pill">{label}</div>
</div>
