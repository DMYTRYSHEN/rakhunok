<script lang="ts">
	import { page } from '$app/state';
	import DashboardPage from '$lib/features/dashboard/DashboardPage.svelte';
</script>

<svelte:head><title>Деталі рахунку · Rahunok</title></svelte:head>

<DashboardPage view="invoice" invoiceId={page.params.id} />
