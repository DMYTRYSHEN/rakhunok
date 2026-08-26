<script lang="ts">
	import { ArrowUpRight, CircleCheck, WalletCards } from '@lucide/svelte';
	import type { OverviewMetric } from '../types';

	let { metric }: { metric: OverviewMetric } = $props();
</script>

<article class="group border-r border-b border-zinc-200 bg-white p-5 last:border-r-0 lg:p-6">
	<div class="flex items-start justify-between gap-4">
		<p class="text-[0.6875rem] font-bold tracking-[0.12em] text-zinc-500 uppercase">
			{metric.label}
		</p>
		<div
			class="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600"
		>
			{#if metric.tone === 'success'}
				<CircleCheck size={15} strokeWidth={2} aria-hidden="true" />
			{:else if metric.tone === 'primary'}
				<ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
			{:else}
				<WalletCards size={15} strokeWidth={2} aria-hidden="true" />
			{/if}
		</div>
	</div>
	<p
		class="mt-5 text-[1.75rem] leading-none font-semibold tracking-normal text-zinc-950 tabular-nums"
	>
		{metric.value}
	</p>
	<p
		class:!text-emerald-700={metric.tone === 'success'}
		class="mt-3 text-xs font-semibold text-zinc-500"
	>
		{metric.detail}
	</p>
</article>
