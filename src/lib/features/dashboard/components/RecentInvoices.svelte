<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ReceiptText } from '@lucide/svelte';
	import type { InvoiceSummary } from '../types';
	import { formatInvoiceDate, formatMoney } from '../utils/format';
	import StatusBadge from './StatusBadge.svelte';

	let { invoices, demo = false }: { invoices: InvoiceSummary[]; demo?: boolean } = $props();
</script>

<section
	class="overflow-hidden rounded-lg border border-zinc-200 bg-white"
	aria-labelledby="invoices-title"
>
	<header
		class="flex items-center justify-between gap-5 border-b border-zinc-200 px-5 py-4 lg:px-6"
	>
		<div>
			<div class="flex items-center gap-2">
				<ReceiptText size={17} class="text-zinc-500" aria-hidden="true" />
				<h2 id="invoices-title" class="text-sm font-bold text-zinc-950">Останні рахунки</h2>
			</div>
			<p class="mt-1 text-xs text-zinc-500">Моніторинг оплат у реальному часі</p>
		</div>
		<a
			href={resolve(demo ? '/dashboard/invoices?demo=1' : '/dashboard/invoices')}
			class="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
		>
			Усі рахунки
			<ArrowRight size={14} aria-hidden="true" />
		</a>
	</header>

	{#if invoices.length === 0}
		<div class="grid min-h-52 place-items-center px-6 text-center">
			<div>
				<p class="text-sm font-semibold text-zinc-800">Ще немає рахунків</p>
				<p class="mt-1 text-xs text-zinc-500">Нові рахунки з'являться тут після створення.</p>
			</div>
		</div>
	{:else}
		<div class="divide-y divide-zinc-100">
			{#each invoices as invoice (invoice.id)}
				<article
					class="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.5fr)_8rem_8rem_7rem] lg:items-center lg:px-6"
				>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<p class="truncate text-sm font-bold text-zinc-950">{invoice.title}</p>
							<span class="hidden text-[0.6875rem] font-semibold text-zinc-400 sm:inline"
								>{invoice.reference}</span
							>
						</div>
						<p class="mt-1 text-xs text-zinc-500">{formatInvoiceDate(invoice.createdAt)}</p>
					</div>
					<p class="text-right text-sm font-bold text-zinc-950 tabular-nums lg:order-3">
						{formatMoney(invoice.amount)}
					</p>
					<div class="lg:order-2">
						<StatusBadge status={invoice.status} />
					</div>
					<p class="self-center text-right text-xs font-semibold text-zinc-500 lg:order-4">
						{invoice.channel}
					</p>
				</article>
			{/each}
		</div>
	{/if}
</section>
