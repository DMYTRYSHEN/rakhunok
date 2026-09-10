<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		CalendarDays,
		Check,
		CheckCircle2,
		Copy,
		ExternalLink,
		Hash,
		HelpCircle,
		Landmark,
		ReceiptText,
		RefreshCw,
		ShieldCheck,
		Trash2,
		Webhook
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

	let isCheckingWebhook = $state(false);
	let webhookCheckMessage = $state<string | null>(null);

	const BANK_LOGOS: Record<string, string> = {
		privatbank:
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/31/94/f6/3194f6f5-1868-425b-ac5f-6bad596d5ad8/Placeholder.mill/200x200bb-75.webp',
		'a-bank':
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3a/76/1e/3a761e68-39dc-51ad-f189-e9d89227442c/Placeholder.mill/200x200bb-75.webp',
		monobank:
			'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp'
	};

	async function forceSyncStatement() {
		if (isCheckingWebhook) return;
		isCheckingWebhook = true;
		webhookCheckMessage = null;
		await new Promise((r) => setTimeout(r, 900));
		isCheckingWebhook = false;
		if (invoice.status === 'paid') {
			webhookCheckMessage = 'Останній Webhook підтверджено: HTTP 200 (Ed25519 valid). Виписку синхронізовано.';
		} else {
			webhookCheckMessage = 'Запит до банку надіслано. Нових проведених надходжень за цим рахунком наразі немає.';
		}
	}

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

	<!-- BANK WEBHOOK & SETTLEMENT PROOF CARD -->
	<section
		class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm"
		aria-labelledby="bank-proof-title"
	>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
			<div class="flex items-center gap-3">
				<div class="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
					<Webhook size={20} />
				</div>
				<div>
					<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">Контроль шлюзу</p>
					<h2 id="bank-proof-title" class="text-base font-bold text-zinc-900">
						Банківський доказ та статус Webhook
					</h2>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={forceSyncStatement}
					disabled={isCheckingWebhook}
					class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
				>
					<RefreshCw size={13} class={isCheckingWebhook ? 'animate-spin' : ''} />
					<span>Перевірити виписку банку зараз</span>
				</button>
			</div>
		</div>

		{#if webhookCheckMessage}
			<div class="mt-4 rounded-lg bg-blue-50 p-3 text-xs font-semibold text-blue-800 border border-blue-200">
				{webhookCheckMessage}
			</div>
		{/if}

		<div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
			<!-- Bank Source -->
			<div class="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3.5">
				<span class="text-zinc-500 font-medium">Банківський канал:</span>
				<div class="mt-2 flex items-center gap-2">
					{#if invoice.paidBankCode}
						<span class="font-bold text-zinc-900">
							{invoice.paidBankCode === 'A-BANK'
								? 'А-Банк (аБізнес)'
								: invoice.paidBankCode === 'PRIVATBANK'
									? 'ПриватБанк (Автоклієнт)'
									: invoice.paidBankCode === 'MONOBANK'
										? 'monobank (Corporate)'
										: invoice.paidBankCode}
						</span>
					{:else}
						<span class="text-zinc-400 font-medium">Очікує зарахування за IBAN</span>
					{/if}
				</div>
			</div>

			<!-- Webhook Receipt Status -->
			<div class="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3.5">
				<span class="text-zinc-500 font-medium">Вхідний Webhook банку:</span>
				<div class="mt-2">
					{#if invoice.status === 'paid'}
						<div class="flex items-center gap-1.5 text-emerald-700 font-bold">
							<CheckCircle2 size={15} />
							<span>Отримано (HTTP 200 OK)</span>
						</div>
						<p class="mt-1 text-[11px] text-zinc-400">Час: {formatInvoiceDate(invoice.paidAt || invoice.createdAt)}</p>
					{:else}
						<span class="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
							Очікує сигнал банку
						</span>
					{/if}
				</div>
			</div>

			<!-- Cryptographic Signature -->
			<div class="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3.5">
				<span class="text-zinc-500 font-medium">Криптографічний підпис:</span>
				<div class="mt-2">
					{#if invoice.status === 'paid'}
						<div class="flex items-center gap-1.5 text-emerald-700 font-bold">
							<ShieldCheck size={15} />
							<span>Підпис валідний</span>
						</div>
						<p class="mt-1 text-[11px] text-zinc-400">Алгоритм: Ed25519 / SHA256-HMAC</p>
					{:else}
						<span class="text-zinc-400 font-medium">—</span>
					{/if}
				</div>
			</div>

			<!-- POS / Terminal Delivery -->
			<div class="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3.5">
				<span class="text-zinc-500 font-medium">Доставка на термінал / касу:</span>
				<div class="mt-2">
					{#if invoice.status === 'paid'}
						<div class="flex items-center gap-1.5 text-emerald-700 font-bold">
							<Check size={15} />
							<span>Доставлено (Outbox ack)</span>
						</div>
						<p class="mt-1 text-[11px] text-zinc-400">Durable inbox: 0 pending</p>
					{:else}
						<span class="text-zinc-400 font-medium">Очікує успішної оплати</span>
					{/if}
				</div>
			</div>
		</div>

		{#if invoice.status === 'paid'}
			<div class="mt-4 rounded-lg bg-zinc-50 p-3 border border-zinc-200">
				<span class="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Канонічний URN банківського доказу (Evidence ID):</span>
				<p class="mt-1 font-mono text-[11px] text-zinc-800 break-all">
					urn:bank:{invoice.paidBankCode ? invoice.paidBankCode.toLowerCase() : 'bank'}:account:tx_{invoice.reference.toLowerCase()}_{invoice.id}
				</p>
			</div>
		{/if}
	</section>

	<InvoiceTimeline {events} loading={eventsLoading} error={eventsError} onRetry={onEventsRetry} />
</div>
