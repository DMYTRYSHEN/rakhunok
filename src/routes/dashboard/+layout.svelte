<script lang="ts">
	import { onMount } from 'svelte';
	import { requiresDashboardDocument } from './entry-boundary';

	let { children } = $props();

	onMount(() => {
		const entry = performance.getEntriesByType('navigation')[0];
		if (entry && requiresDashboardDocument(entry.name, window.location.href)) {
			window.location.replace(window.location.href);
		}
	});
</script>

{@render children()}