<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		CalendarDays,
		Check,
		Copy,
		ExternalLink,
		Hash,
		Landmark,
		ReceiptText,
		Trash2
	} from '@lucide/svelte';
	import StatusBadge from '../components/StatusBadge.svelte';
	import type { InvoiceEvent, InvoiceRecord } from '../types';
	import { formatInvoiceDate, formatMoney } from '../utils/format';
	import { getInvoiceShareLinks } from './invoice-links';
	import { buildLegacyInvoiceCancellation } from './invoice-cancellation-contract';
	import InvoiceTimeline from './InvoiceTimeline.svelte';

	let {
		invoice,
		events = [],
		eventsLoading = false,
		eventsError = null,
		onEventsRetry,
		onCancel,
		demo = false
	}: {
		invoice: InvoiceRecord;
		events?: InvoiceEvent[];
		eventsLoading?: boolean;
		eventsError?: string | null;
		onEventsRetry?: () => void;
		onCancel: (invoiceId: string) => Promise<void>;
		demo?: boolean;
	} = $props();
	let copiedPath = $state<string | null>(null);
	let cancelling = $state(false);
	let cancelError = $state<string | null>(null);
	let shareLinks = $derived(getInvoiceShareLinks(invoice));
	let cancellation = $derived(buildLegacyInvoiceCancellation(invoice));
	let checkoutPath = $derived(
		shareLinks.find((l) => l.path.startsWith('/pay/'))?.path || shareLinks[0].path
	);
	let checkoutUrl = $derived(`${browser ? window.location.origin : ''}${checkoutPath}`);
	let qrUrl = $derived(
		`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkoutUrl)}`
	);

	async function copyLink(path: string) {
		if (!browser) return;
		await navigator.clipboard.writeText(`${window.location.origin}${path}`);
		copiedPath = path;
		window.setTimeout(() => {
			if (copiedPath === path) copiedPath = null;
		}, 1500);
	}

	async function cancelInvoice() {
		if (demo || cancelling || !cancellation.eligible || !confirm('Скасувати цей рахунок?')) return;
		cancelling = true;
		cancelError = null;
		try {
			await onCancel(invoice.id);
		} catch (error) {
			cancelError = error instanceof Error ? error.message : 'Не вдалося скасувати рахунок.';
		} finally {
			cancelling = false;
		}
	}
</script>

<div class="space-y-6">
	<a
		href={resolve(demo ? '/dashboard/invoices?demo=1' : '/dashboard/invoices')}
		class="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-950"
	>
		<ArrowLeft size={16} /> До рахунків
	</a>
	<header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">{invoice.reference}</p>
			<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">{invoice.title}</h1>
			<div class="mt-3"><StatusBadge status={invoice.status} /></div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if cancellation.eligible}
				<button
					type="button"
					disabled={demo || cancelling}
					onclick={cancelInvoice}
					class="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-sm font-bold text-red-700 disabled:opacity-50"
					><Trash2 size={16} /> {cancelling ? 'Скасовуємо…' : 'Скасувати'}</button
				>
			{/if}
			<a
				href={resolve(checkoutPath as '/')}
				target="_blank"
				rel="noreferrer"
				class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white"
				>Відкрити checkout <ExternalLink size={16} /></a
			>
		</div>
	</header>
	{#if cancelError}<p
			class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
			role="alert"
		>
			{cancelError}
		</p>{/if}

	<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<section
			class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6"
			aria-labelledby="invoice-details-title"
		>
			<h2 id="invoice-details-title" class="text-sm font-bold">Деталі платежу</h2>
			<p class="mt-5 text-3xl font-semibold tabular-nums">{formatMoney(invoice.amount)}</p>
			<dl class="mt-6 grid gap-5 border-t border-zinc-100 pt-5 sm:grid-cols-2">
				<div>
					<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
						<ReceiptText size={15} /> Призначення
					</dt>
					<dd class="mt-1 text-sm font-bold">{invoice.description || invoice.title}</dd>
				</div>
				<div>
					<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
						<CalendarDays size={15} /> Створено
					</dt>
					<dd class="mt-1 text-sm font-bold">{formatInvoiceDate(invoice.createdAt)}</dd>
				</div>
				{#if invoice.paidAt}
					<div>
						<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
							<CalendarDays size={15} /> Оплачено
						</dt>
						<dd class="mt-1 text-sm font-bold">{formatInvoiceDate(invoice.paidAt)}</dd>
					</div>
				{/if}
				{#if invoice.type === 'table' && invoice.expiresAt}
					<div>
						<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
							<CalendarDays size={15} /> Діє до
						</dt>
						<dd class="mt-1 text-sm font-bold">{formatInvoiceDate(invoice.expiresAt)}</dd>
					</div>
				{/if}
				<div>
					<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
						<Hash size={15} /> Тип
					</dt>
					<dd class="mt-1 text-sm font-bold">{invoice.type}</dd>
				</div>
				{#if invoice.tableNumber !== null}
					<div>
						<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
							<Hash size={15} /> Стіл
						</dt>
						<dd class="mt-1 text-sm font-bold">№{invoice.tableNumber}</dd>
					</div>
				{/if}
				<div>
					<dt class="flex items-center gap-2 text-xs font-semibold text-zinc-500">
						<Landmark size={15} /> Банк
					</dt>
					<dd class="mt-1 text-sm font-bold">{invoice.paidBankCode || 'Ще не визначено'}</dd>
				</div>
			</dl>
		</section>
		<aside class="space-y-5 rounded-lg border border-zinc-200 bg-[#111313] p-5 text-white">
			<div>
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">QR для клієнта</p>
				<div class="mt-4 grid place-items-center rounded-md bg-white p-4">
					<img
						src={qrUrl}
						alt="QR-код для оплати рахунку"
						class="size-44"
						width="176"
						height="176"
					/>
				</div>
			</div>
			<div class="border-t border-white/10 pt-5">
				<h2 class="text-sm font-bold">Поділитися посиланням</h2>
				<div class="mt-3 space-y-3">
					{#each shareLinks as link (link.path)}
						<div>
							<p class="text-xs text-zinc-400">{link.label}</p>
							<div class="mt-1 flex items-center gap-2">
								<p class="min-w-0 flex-1 truncate font-mono text-xs text-[#c9ff4a]">{link.path}</p>
								<button
									type="button"
									aria-label={`Скопіювати: ${link.label}`}
									onclick={() => copyLink(link.path)}
									class="grid size-8 shrink-0 place-items-center rounded-md border border-white/15 hover:bg-white/10"
								>
									{#if copiedPath === link.path}<Check size={14} />{:else}<Copy size={14} />{/if}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</aside>
	</div>

	<InvoiceTimeline {events} loading={eventsLoading} error={eventsError} onRetry={onEventsRetry} />
</div>
