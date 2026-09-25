<script lang="ts">
	import type { PageData } from './$types';
	import PromoPage from './promo/+page.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PromoPage {data} />
