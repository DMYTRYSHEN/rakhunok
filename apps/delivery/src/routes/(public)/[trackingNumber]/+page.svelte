<script lang="ts">
	import PublicTrackingPage from '#lib/PublicTrackingPage.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<PublicTrackingPage tracking={data.tracking} />