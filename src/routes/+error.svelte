<script lang="ts">
	import { page } from '$app/state';
	import CircuitError from '$lib/components/errors/CircuitError.svelte';
</script>

{#key page.status}
	<CircuitError status={page.status} />
{/key}