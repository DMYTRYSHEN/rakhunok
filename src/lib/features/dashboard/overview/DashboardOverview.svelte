<script lang="ts">
	import { resolve } from '$app/paths';
	import { CircleAlert, Plus } from '@lucide/svelte';
	import type { OverviewSnapshot } from '../types';
	import MetricCard from '../components/MetricCard.svelte';
	import RecentInvoices from '../components/RecentInvoices.svelte';

	let { snapshot, demo = false }: { snapshot: OverviewSnapshot; demo?: boolean } = $props();
</script>

<div class="space-y-6">
	<section class="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">25 серпня · Київ</p>
			<h1 class="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">Фінансовий огляд</h1>
			<p class="mt-2 text-sm text-zinc-500">Платежі та операційний стан бізнесу сьогодні.</p>
		</div>
		<a
			href={resolve(demo ? '/dashboard/invoices/new?demo=1' : '/dashboard/invoices/new')}
			class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
		>
			<Plus size={16} aria-hidden="true" />
			Новий рахунок
		</a>
	</section>

	{#if demo}
		<div
			class="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
			role="note"
		>
			<CircleAlert size={17} class="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
			<p class="text-xs leading-5">
				<strong>Ознайомчий режим.</strong> Дані локальні; жоден запит до Supabase не виконується.
			</p>
		</div>
	{/if}

	<section
		class="grid overflow-hidden rounded-lg border border-zinc-200 sm:grid-cols-2 lg:grid-cols-4"
		aria-label="Ключові показники"
	>
		{#each snapshot.metrics as metric (metric.label)}
			<MetricCard {metric} />
		{/each}
	</section>

	<RecentInvoices invoices={snapshot.recentInvoices} {demo} />
</div>
