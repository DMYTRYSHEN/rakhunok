<script lang="ts">
	import { CheckCircle2, AlertCircle, ArrowRight, X, ShieldAlert } from '@lucide/svelte';
	import type { DiscrepancyRecord } from '../data/discrepancies';
	import type { InvoiceRecord } from '../types';
	import { formatMoney } from '../utils/format';

	let {
		discrepancy,
		pendingInvoices = [],
		onClose,
		onConfirmMatch
	}: {
		discrepancy: DiscrepancyRecord;
		pendingInvoices: InvoiceRecord[];
		onClose: () => void;
		onConfirmMatch: (discrepancyId: string, invoiceId: string) => Promise<void> | void;
	} = $props();

	let selectedInvoiceId = $state<string>(discrepancy.suggestedInvoiceId || (pendingInvoices[0]?.id ?? ''));
	let isSubmitting = $state(false);
	let manualNote = $state('');

	const selectedInvoice = $derived(pendingInvoices.find((i) => i.id === selectedInvoiceId));

	async function handleMatch() {
		if (!selectedInvoiceId || isSubmitting) return;
		isSubmitting = true;
		try {
			await onConfirmMatch(discrepancy.id, selectedInvoiceId);
			onClose();
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
	<div class="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
		<button
			type="button"
			onclick={onClose}
			class="absolute top-5 right-5 grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
		>
			<X size={18} />
		</button>

		<div class="flex items-center gap-3">
			<div class="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
				<ShieldAlert size={20} />
			</div>
			<div>
				<h2 class="text-lg font-bold text-zinc-900">Диспетчер розбіжностей: ручне зіставлення</h2>
				<p class="text-xs text-zinc-500">Прив'язка банківського платежу до неоплаченого рахунку</p>
			</div>
		</div>

		<div class="mt-6 space-y-4">
			<!-- Evidence card -->
			<div class="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
				<p class="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Банківський доказ</p>
				<div class="mt-2 grid grid-cols-2 gap-3 text-xs">
					<div>
						<span class="text-zinc-500">Платник:</span>
						<p class="font-bold text-zinc-900">{discrepancy.payerName}</p>
					</div>
					<div>
						<span class="text-zinc-500">Сума виписки:</span>
						<p class="font-bold text-emerald-700 text-sm">{discrepancy.amountFormatted}</p>
					</div>
					<div class="col-span-2">
						<span class="text-zinc-500">Призначення платежу:</span>
						<p class="mt-0.5 rounded bg-white p-2 font-mono text-[11px] text-zinc-800 border border-zinc-200">
							{discrepancy.purpose}
						</p>
					</div>
					<div>
						<span class="text-zinc-500">ID транзакції:</span>
						<p class="font-mono text-[10px] text-zinc-600">{discrepancy.bankTxId}</p>
					</div>
					<div>
						<span class="text-zinc-500">Причина розбіжності:</span>
						<p class="font-medium text-amber-700">{discrepancy.reasons[0]}</p>
					</div>
				</div>
			</div>

			<!-- Select Invoice -->
			<div class="space-y-2">
				<label for="invoice-select" class="block text-xs font-bold text-zinc-700">
					Виберіть рахунок для зарахування:
				</label>
				{#if pendingInvoices.length === 0}
					<p class="rounded-lg bg-zinc-100 p-3 text-center text-xs text-zinc-500">
						Немає активних неоплачених рахунків для прив'язки
					</p>
				{:else}
					<select
						id="invoice-select"
						bind:value={selectedInvoiceId}
						class="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm font-semibold text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none"
					>
						{#each pendingInvoices as inv (inv.id)}
							<option value={inv.id}>
								{inv.reference} — {inv.title} ({formatMoney(inv.amount)})
							</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if selectedInvoice}
				<div class="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
					<div class="flex items-center justify-between font-bold">
						<span>Рахунок: {selectedInvoice.reference}</span>
						<span>Очікувана сума: {formatMoney(selectedInvoice.amount)}</span>
					</div>
					<p class="mt-1 text-[11px] text-blue-700">
						Після підтвердження статус рахунку зміниться на <span class="font-bold text-emerald-800">«Оплачено»</span>, 
						а банківська операція отримає статус вирішеної (Manual Reconciled).
					</p>
				</div>
			{/if}

			<div>
				<label for="manual-note" class="block text-xs font-semibold text-zinc-600">Коментар диспетчера (опціонально):</label>
				<input
					id="manual-note"
					type="text"
					bind:value={manualNote}
					placeholder="Напр., підтверджено дзвінком клієнта"
					class="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
			</div>
		</div>

		<div class="mt-6 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
			<button
				type="button"
				onclick={onClose}
				class="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
			>
				Скасувати
			</button>
			<button
				type="button"
				disabled={!selectedInvoiceId || isSubmitting}
				onclick={handleMatch}
				class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
			>
				{#if isSubmitting}
					Зарахування...
				{:else}
					<CheckCircle2 size={14} />
					<span>Зарахувати та закрити рахунок</span>
				{/if}
			</button>
		</div>
	</div>
</div>
