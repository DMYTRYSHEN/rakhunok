<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, ChevronRight, Plus, ReceiptText, Search } from '@lucide/svelte';
	import StatusBadge from '../components/StatusBadge.svelte';
	import type { InvoiceRecord, InvoiceStatus, InvoiceType } from '../types';
	import { formatInvoiceDate, formatMoney } from '../utils/format';
	import { buildLegacyInvoiceCancellation } from './invoice-cancellation-contract';
	import { filterInvoices } from './invoice-filters';

	let {
		invoices,
		onCancel,
		demo = false
	}: {
		invoices: InvoiceRecord[];
		onCancel?: (invoiceId: string) => Promise<void>;
		demo?: boolean;
	} = $props();
	let cancellingId = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let search = $state('');
	let status = $state<InvoiceStatus | 'all'>('all');
	let type = $state<InvoiceType | 'all'>('all');
	let period = $state<'7' | '30' | 'all'>('30');
	let currentPage = $state(1);
	const pageSize = 10;
	let filtered = $derived(filterInvoices(invoices, { search, status, type, period }));
	let pageCount = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
	let visibleInvoices = $derived(
		filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function resetPage() {
		currentPage = 1;
	}

	function detailHref(invoiceId: string) {
		return demo
			? (`/dashboard/invoices/${invoiceId}?demo=1` as '/')
			: (`/dashboard/invoices/${invoiceId}` as '/');
	}

	function cancellationFor(invoice: InvoiceRecord) {
		return buildLegacyInvoiceCancellation(invoice, demo ? new Date(invoice.createdAt) : new Date());
	}

	async function cancel(invoiceId: string) {
		if (!onCancel || cancellingId || !confirm('Скасувати цей рахунок?')) return;
		cancellingId = invoiceId;
		actionError = null;
		try {
			await onCancel(invoiceId);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Не вдалося скасувати рахунок.';
		} finally {
			cancellingId = null;
		}
	}
</script>

<div class="space-y-6">
	<header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">Платіжний журнал</p>
			<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">Рахунки</h1>
			<p class="mt-2 text-sm text-zinc-500">Пошук і контроль усіх платежів бізнесу.</p>
		</div>
		<a
			href={resolve(demo ? '/dashboard/invoices/new?demo=1' : '/dashboard/invoices/new')}
			class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
		>
			<Plus size={16} aria-hidden="true" /> Новий рахунок
		</a>
	</header>

	<section class="rounded-lg border border-zinc-200 bg-white" aria-label="Реєстр рахунків">
		{#if actionError}<p
				class="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
				role="alert"
			>
				{actionError}
			</p>{/if}
		<div
			class="grid gap-3 border-b border-zinc-200 p-4 md:grid-cols-[minmax(15rem,1fr)_repeat(3,minmax(8rem,auto))]"
		>
			<label class="relative">
				<span class="sr-only">Пошук рахунків</span>
				<Search
					size={16}
					class="pointer-events-none absolute top-3 left-3 text-zinc-400"
					aria-hidden="true"
				/>
				<input
					bind:value={search}
					oninput={resetPage}
					type="search"
					placeholder="Номер, назва або сума"
					class="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
				/>
			</label>
			<label>
				<span class="sr-only">Статус</span>
				<select
					bind:value={status}
					onchange={resetPage}
					class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
				>
					<option value="all">Усі статуси</option>
					<option value="pending">Очікує</option>
					<option value="paid">Оплачено</option>
					<option value="cancelled">Скасовано</option>
					<option value="failed">Помилка</option>
				</select>
			</label>
			<label>
				<span class="sr-only">Тип</span>
				<select
					bind:value={type}
					onchange={resetPage}
					class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
				>
					<option value="all">Усі типи</option>
					<option value="fixed">Фіксований</option>
					<option value="open_amount">Вільна сума</option>
					<option value="table">Столик</option>
					<option value="delivery">Доставка</option>
				</select>
			</label>
			<label>
				<span class="sr-only">Період</span>
				<select
					bind:value={period}
					onchange={resetPage}
					class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
				>
					<option value="7">7 днів</option>
					<option value="30">30 днів</option>
					<option value="all">Увесь час</option>
				</select>
			</label>
		</div>

		<div class="divide-y divide-zinc-100 md:hidden" data-testid="mobile-invoice-list">
			{#each visibleInvoices as invoice (invoice.id)}
				{@const cancellation = cancellationFor(invoice)}
				<div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 p-4">
					<div class="min-w-0">
						<a
							href={resolve(detailHref(invoice.id))}
							class="block truncate text-sm font-bold text-zinc-900 active:text-blue-700"
							>{invoice.title}</a
						>
						<p class="mt-1 text-xs text-zinc-500">{invoice.reference} · {invoice.type}</p>
					</div>
					<p class="text-right text-sm font-bold text-zinc-900 tabular-nums">
						{formatMoney(invoice.amount)}
					</p>
					<p class="text-xs text-zinc-500">{formatInvoiceDate(invoice.createdAt)}</p>
					<div class="justify-self-end"><StatusBadge status={invoice.status} /></div>
					{#if cancellation.eligible}
						<button
							type="button"
							disabled={demo || !onCancel || Boolean(cancellingId)}
							title={demo ? 'Буде доступно після перевірки політики RLS' : undefined}
							onclick={() => cancel(invoice.id)}
							class="col-span-2 h-9 justify-self-start rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 opacity-60"
						>
							Скасувати
						</button>
					{/if}
				</div>
			{:else}
				<div class="px-5 py-14 text-center">
					<ReceiptText size={24} class="mx-auto text-zinc-300" aria-hidden="true" />
					<p class="mt-3 text-sm font-bold">Рахунків не знайдено</p>
					<p class="mt-1 text-xs text-zinc-500">Змініть фільтри або пошуковий запит.</p>
				</div>
			{/each}
		</div>

		<div class="hidden overflow-x-auto md:block">
			<table class="w-full min-w-[48rem] border-collapse text-left">
				<thead class="bg-zinc-50 text-[0.6875rem] font-bold text-zinc-500 uppercase">
					<tr>
						<th class="px-5 py-3">Рахунок</th><th class="px-4 py-3">Тип</th><th class="px-4 py-3"
							>Створено</th
						><th class="px-4 py-3">Статус</th><th class="px-5 py-3 text-right">Сума</th><th
							class="px-5 py-3 text-right"><span class="sr-only">Дії</span></th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-100">
					{#each visibleInvoices as invoice (invoice.id)}
						{@const cancellation = cancellationFor(invoice)}
						<tr class="group hover:bg-zinc-50">
							<td class="px-5 py-4">
								<a href={resolve(detailHref(invoice.id))} class="block">
									<span class="block text-sm font-bold group-hover:text-blue-700"
										>{invoice.title}</span
									>
									<span class="mt-1 block text-xs text-zinc-500">{invoice.reference}</span>
								</a>
							</td>
							<td class="px-4 py-4 text-xs font-semibold text-zinc-600">{invoice.type}</td>
							<td class="px-4 py-4 text-xs text-zinc-500">{formatInvoiceDate(invoice.createdAt)}</td
							>
							<td class="px-4 py-4"><StatusBadge status={invoice.status} /></td>
							<td class="px-5 py-4 text-right text-sm font-bold tabular-nums"
								>{formatMoney(invoice.amount)}</td
							>
							<td class="px-5 py-4 text-right">
								{#if cancellation.eligible}
									<button
										type="button"
										disabled={demo || !onCancel || Boolean(cancellingId)}
										title={demo ? 'Буде доступно після перевірки політики RLS' : undefined}
										onclick={() => cancel(invoice.id)}
										class="h-8 rounded-md border border-red-200 px-3 text-xs font-bold text-red-700 opacity-60"
									>
										Скасувати
									</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-5 py-16 text-center">
								<ReceiptText size={24} class="mx-auto text-zinc-300" aria-hidden="true" />
								<p class="mt-3 text-sm font-bold">Рахунків не знайдено</p>
								<p class="mt-1 text-xs text-zinc-500">Змініть фільтри або пошуковий запит.</p>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<footer
			class="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500"
		>
			<p>Знайдено: <strong class="text-zinc-900">{filtered.length}</strong></p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					aria-label="Попередня сторінка"
					disabled={currentPage === 1}
					onclick={() => currentPage--}
					class="grid size-8 place-items-center rounded-md border border-zinc-200 disabled:opacity-35"
					><ChevronLeft size={15} /></button
				>
				<span class="min-w-16 text-center font-semibold">{currentPage} / {pageCount}</span>
				<button
					type="button"
					aria-label="Наступна сторінка"
					disabled={currentPage === pageCount}
					onclick={() => currentPage++}
					class="grid size-8 place-items-center rounded-md border border-zinc-200 disabled:opacity-35"
					><ChevronRight size={15} /></button
				>
			</div>
		</footer>
	</section>
</div>
