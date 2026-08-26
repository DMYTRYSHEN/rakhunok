<script lang="ts">
	import { resolve } from '$app/paths';
	import { Banknote, CircleCheck, Clock3, Radio, Store, X } from '@lucide/svelte';
	import type { PosBoard as PosBoardData } from '../types';
	import { formatInvoiceDate, formatMoney } from '../utils/format';
	import PosCheckout from './PosCheckout.svelte';
	import { decideLegacyPosOrderCreation, type LegacyPosOrderInsert } from './pos-order-contract';
	import {
		createPosDraftsState,
		getPosDraft,
		reducePosDrafts,
		type PosDraftAction
	} from './pos-drafts';

	let {
		board,
		merchantId,
		onCreate,
		onMarkPaid,
		onCancel,
		demo = false
	}: {
		board: PosBoardData;
		merchantId: string;
		onCreate?: (payload: LegacyPosOrderInsert) => Promise<void>;
		onMarkPaid?: (orderId: string) => Promise<void>;
		onCancel?: (orderId: string) => Promise<void>;
		demo?: boolean;
	} = $props();
	let draftState = $state(createPosDraftsState());
	let draftTerminalId = $state<string | null>(null);
	let pendingAction = $state<string | null>(null);
	let actionError = $state<string | null>(null);

	const draftTerminal = $derived(
		draftTerminalId
			? board.terminals.find((terminal) => terminal.id === draftTerminalId)
			: undefined
	);

	function openDraft(terminalId: string) {
		draftState = reducePosDrafts(draftState, { type: 'select-terminal', terminalId });
		draftTerminalId = terminalId;
	}

	function dispatchDraft(action: PosDraftAction) {
		draftState = reducePosDrafts(draftState, action);
	}

	function orderFor(terminalId: string) {
		return board.activeOrders.find((order) => order.terminalId === terminalId);
	}

	function invoiceHref(invoiceId: string) {
		return demo
			? (`/dashboard/invoices/${invoiceId}?demo=1` as '/')
			: (`/dashboard/invoices/${invoiceId}` as '/');
	}

	async function submitDraft() {
		if (!draftTerminal || !onCreate || pendingAction) return;
		const decision = decideLegacyPosOrderCreation(
			merchantId,
			draftTerminal,
			getPosDraft(draftState),
			board.activeOrders
		);
		if (decision.status !== 'ready') {
			throw new Error(
				decision.status === 'blocked'
					? 'Для цього термінала вже є активне замовлення.'
					: 'Додайте суму або товар.'
			);
		}
		pendingAction = `create:${draftTerminal.id}`;
		try {
			await onCreate(decision.payload);
			draftTerminalId = null;
		} finally {
			pendingAction = null;
		}
	}

	async function mutateOrder(orderId: string, action: 'paid' | 'cancel') {
		if (pendingAction) return;
		if (action === 'cancel' && !confirm('Скасувати POS-замовлення?')) return;
		const callback = action === 'paid' ? onMarkPaid : onCancel;
		if (!callback) return;
		pendingAction = `${action}:${orderId}`;
		actionError = null;
		try {
			await callback(orderId);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Не вдалося оновити замовлення.';
		} finally {
			pendingAction = null;
		}
	}
</script>

<div class="space-y-6">
	{#if draftTerminal}
		<PosCheckout
			{merchantId}
			terminal={draftTerminal}
			draft={getPosDraft(draftState)}
			onaction={dispatchDraft}
			onsubmit={submitDraft}
			onclose={() => (draftTerminalId = null)}
		/>
	{:else}
		{#if actionError}<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{actionError}</p>{/if}
		<header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
			<div>
				<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">Термінал & каса</p>
				<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">Робочі місця</h1>
				<p class="mt-2 text-sm text-zinc-500">Актуальний стан столів, міток і кас бізнесу.</p>
			</div>
			<div class="flex items-center gap-2 text-xs font-semibold text-zinc-500" role="status">
				<Radio size={15} class="text-emerald-600" aria-hidden="true" />
				{demo ? 'Локальна демонстрація' : 'Realtime + резервне оновлення'}
			</div>
		</header>

		<section aria-label="Термінали" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each board.terminals as terminal (terminal.id)}
				{@const order = orderFor(terminal.id)}
				<article class="min-h-48 rounded-lg border border-zinc-200 bg-white p-5">
					<header class="flex items-start justify-between gap-4">
						<div class="flex min-w-0 items-center gap-3">
							<span
								class="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-700"
							>
								<Store size={17} aria-hidden="true" />
							</span>
							<div class="min-w-0">
								<h2 class="truncate text-sm font-bold">{terminal.name}</h2>
								<p class="mt-0.5 text-xs text-zinc-500">{terminal.code}</p>
							</div>
						</div>
						<span class="size-2 rounded-full {order ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
					</header>

					{#if order}
						<div class="mt-6 flex items-end justify-between gap-3">
							<div>
								<p class="text-xs font-semibold text-zinc-500">
									{order.status === 'paid' ? 'Оплачено' : 'Очікує оплати'}
								</p>
								<p class="mt-1 text-xl font-extrabold tabular-nums">{formatMoney(order.amount)}</p>
							</div>
							{#if order.status === 'paid'}
								<CircleCheck size={20} class="text-emerald-600" aria-label="Оплачено" />
							{:else}
								<Clock3 size={20} class="text-amber-600" aria-label="Очікує оплати" />
							{/if}
						</div>
						<p class="mt-3 text-xs text-zinc-500">{formatInvoiceDate(order.createdAt)}</p>
						<a
							href={resolve(invoiceHref(order.id))}
							class="mt-4 inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-xs font-bold hover:border-blue-300 hover:text-blue-700"
						>
							Відкрити рахунок
						</a>
						{#if order.status === 'pending'}
							<div class="mt-2 flex gap-2">
								<button type="button" disabled={Boolean(pendingAction) || !onMarkPaid} onclick={() => mutateOrder(order.id, 'paid')} class="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-40"><Banknote size={14} aria-hidden="true" /> Готівкою</button>
								<button type="button" disabled={Boolean(pendingAction) || !onCancel} onclick={() => mutateOrder(order.id, 'cancel')} aria-label="Скасувати замовлення" class="grid size-9 place-items-center rounded-md border border-red-200 text-red-700 disabled:opacity-40"><X size={15} aria-hidden="true" /></button>
							</div>
						{/if}
					{:else}
						<div class="mt-6">
							<p class="text-sm font-bold text-emerald-700">Вільно</p>
							<p class="mt-1 text-xs text-zinc-500">Активного рахунку немає.</p>
						</div>
						<button
							type="button"
							onclick={() => openDraft(terminal.id)}
							class="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-bold text-white hover:bg-blue-700"
						>
							<Banknote size={15} aria-hidden="true" /> Чернетка замовлення
						</button>
					{/if}
				</article>
			{:else}
				<div
					class="rounded-lg border border-dashed border-zinc-300 p-10 text-center sm:col-span-2 xl:col-span-3"
				>
					<p class="text-sm font-bold">Активних терміналів немає</p>
					<p class="mt-1 text-xs text-zinc-500">
						Термінали з’являться після налаштування структури бізнесу.
					</p>
				</div>
			{/each}
		</section>
	{/if}
</div>
