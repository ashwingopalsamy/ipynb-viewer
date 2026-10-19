<script lang="ts">
  import './veil.css';

  let { on }: { on: boolean } = $props();
</script>

<div class="veil" class:on aria-hidden="true">
  <div class="pill">Drop to open</div>
</div>
