<script lang="ts">
  import { checkout } from '../state/checkout.svelte.js';
</script>

<div class="toast" class:visible={Boolean(checkout.toastMessage)} role="status">
  {checkout.toastMessage || ''}
</div>
