<script lang="ts">
	import {
		AlertCircle,
		ArrowRight,
		CheckCircle2,
		Filter,
		HelpCircle,
		Link2,
		RefreshCw,
		Search,
		ShieldAlert,
		Sparkles
	} from '@lucide/svelte';
	import {
		demoDiscrepancies,
		type DiscrepancyRecord
	} from '../data/discrepancies';
	import type { InvoiceRecord } from '../types';
	import DiscrepancyDispatcherModal from './DiscrepancyDispatcherModal.svelte';

	let {
		invoices = [],
		onInvoicePaid
	}: {
		invoices: InvoiceRecord[];
		onInvoicePaid?: (invoiceId: string, bankCode: string) => void;
	} = $props();

	// Official logos
	const BANK_LOGOS: Record<string, string> = {
		privatbank:
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/31/94/f6/3194f6f5-1868-425b-ac5f-6bad596d5ad8/Placeholder.mill/200x200bb-75.webp',
		'a-bank':
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3a/76/1e/3a761e68-39dc-51ad-f189-e9d89227442c/Placeholder.mill/200x200bb-75.webp',
		monobank:
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp'
	};

	let discrepancies = $state<DiscrepancyRecord[]>([...demoDiscrepancies]);
	let activeModalDiscrepancy = $state<DiscrepancyRecord | null>(null);
	let filterType = $state<'all' | 'unresolved' | 'resolved'>('unresolved');
	let searchQuery = $state('');

	const pendingInvoices = $derived(invoices.filter((i) => i.lifecycleStatus === 'pending'));

	const filteredDiscrepancies = $derived(
		discrepancies.filter((item) => {
			if (filterType !== 'all' && item.status !== filterType) return false;
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				item.payerName.toLowerCase().includes(q) ||
				item.purpose.toLowerCase().includes(q) ||
				item.bankTxId.toLowerCase().includes(q) ||
				item.amountFormatted.includes(q)
			);
		})
	);

	function openModal(item: DiscrepancyRecord) {
		activeModalDiscrepancy = item;
	}

	function closeModal() {
		activeModalDiscrepancy = null;
	}

	function handleConfirmMatch(discrepancyId: string, invoiceId: string) {
		const targetDisc = discrepancies.find((d) => d.id === discrepancyId);
		if (targetDisc) {
			targetDisc.status = 'resolved';
			targetDisc.resolvedInvoiceId = invoiceId;
			targetDisc.resolvedAt = new Date().toISOString();
			targetDisc.resolvedBy = 'Диспетчер (ручне зіставлення)';
		}

		if (onInvoicePaid && targetDisc) {
			onInvoicePaid(invoiceId, targetDisc.bankId.toUpperCase());
		}
	}

	function getDecisionBadge(decision: DiscrepancyRecord['decision']) {
		switch (decision) {
			case 'ambiguous':
				return {
					label: 'Неоднозначний референс',
					classes: 'bg-amber-50 text-amber-800 border-amber-200'
				};
			case 'overpaid':
				return {
					label: 'Переплата',
					classes: 'bg-blue-50 text-blue-800 border-blue-200'
				};
			case 'underpaid':
				return {
					label: 'Недоплата',
					classes: 'bg-rose-50 text-rose-800 border-rose-200'
				};
			case 'wrong_recipient':
				return {
					label: 'Невірний IBAN',
					classes: 'bg-purple-50 text-purple-800 border-purple-200'
				};
			case 'unmatched':
			default:
				return {
					label: 'Не знайдено рахунок',
					classes: 'bg-zinc-100 text-zinc-800 border-zinc-200'
				};
		}
	}
</script>

<div class="space-y-4">
	<!-- Top Bar -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
		<div class="flex items-center gap-2">
			<div class="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-semibold">
				<button
					type="button"
					onclick={() => (filterType = 'unresolved')}
					class="rounded-md px-3 py-1.5 transition {filterType === 'unresolved'
						? 'bg-white font-bold text-zinc-900 shadow-sm'
						: 'text-zinc-600 hover:text-zinc-900'}"
				>
					Потребують уваги ({discrepancies.filter((d) => d.status === 'unresolved').length})
				</button>
				<button
					type="button"
					onclick={() => (filterType = 'resolved')}
					class="rounded-md px-3 py-1.5 transition {filterType === 'resolved'
						? 'bg-white font-bold text-zinc-900 shadow-sm'
						: 'text-zinc-600 hover:text-zinc-900'}"
				>
					Вирішені ({discrepancies.filter((d) => d.status === 'resolved').length})
				</button>
				<button
					type="button"
					onclick={() => (filterType = 'all')}
					class="rounded-md px-3 py-1.5 transition {filterType === 'all'
						? 'bg-white font-bold text-zinc-900 shadow-sm'
						: 'text-zinc-600 hover:text-zinc-900'}"
				>
					Усі ({discrepancies.length})
				</button>
			</div>
		</div>

		<div class="relative min-w-[14rem]">
			<Search size={14} class="absolute top-2.5 left-3 text-zinc-400" />
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Пошук за платником чи референсом"
				class="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:bg-white"
			/>
		</div>
	</div>

	<!-- Discrepancy Table / List -->
	{#if filteredDiscrepancies.length === 0}
		<div class="rounded-xl border border-zinc-200 bg-white p-12 text-center">
			<CheckCircle2 size={32} class="mx-auto text-emerald-500" />
			<h3 class="mt-3 text-sm font-bold text-zinc-900">Усі банківські виписки зіставлені</h3>
			<p class="mt-1 text-xs text-zinc-500">Немає нерозпізнаних платежів або розбіжностей у сумах.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filteredDiscrepancies as item (item.id)}
				{@const badge = getDecisionBadge(item.decision)}
				<div
					class="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 md:flex-row md:items-center md:justify-between {item.status ===
					'resolved'
						? 'opacity-65 bg-zinc-50/50'
						: ''}"
				>
					<div class="flex items-start gap-3.5">
						<!-- Bank Logo -->
						<div class="size-11 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
							<img
								src={BANK_LOGOS[item.bankId] || ''}
								alt={item.bankId}
								class="size-full object-contain rounded-lg"
							/>
						</div>

						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-sm font-bold text-zinc-900">{item.payerName}</span>
								<span
									class="inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold {badge.classes}"
								>
									{badge.label}
								</span>
								{#if item.status === 'resolved'}
									<span class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
										<CheckCircle2 size={12} /> Зіставлено вручну
									</span>
								{/if}
							</div>

							<p class="mt-1 font-mono text-xs text-zinc-700 break-words line-clamp-1" title={item.purpose}>
								{item.purpose}
							</p>

							<div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
								<span>TX: <span class="font-mono text-zinc-700">{item.bankTxId}</span></span>
								<span>Час: {new Date(item.bookingDate).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
								<span class="text-amber-700 font-medium">{item.reasons[0]}</span>
							</div>
						</div>
					</div>

					<!-- Amount and Action Button -->
					<div class="flex items-center justify-between gap-4 border-t border-zinc-100 pt-3 md:border-t-0 md:pt-0">
						<div class="text-right">
							<p class="text-base font-extrabold text-zinc-900 tabular-nums">{item.amountFormatted}</p>
							{#if item.suggestedInvoiceReference && item.status === 'unresolved'}
								<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
									<Sparkles size={11} /> Схоже на {item.suggestedInvoiceReference}
								</span>
							{/if}
						</div>

						{#if item.status === 'unresolved'}
							<button
								type="button"
								onclick={() => openModal(item)}
								class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
							>
								<Link2 size={13} />
								<span>Прив'язати вручну</span>
							</button>
						{:else}
							<div class="text-right text-[11px] text-zinc-400">
								<span>Прив'язано до рахунку</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if activeModalDiscrepancy}
	<DiscrepancyDispatcherModal
		discrepancy={activeModalDiscrepancy}
		{pendingInvoices}
		onClose={closeModal}
		onConfirmMatch={handleConfirmMatch}
	/>
{/if}
