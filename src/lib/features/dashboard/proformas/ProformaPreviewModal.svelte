<script lang="ts">
	import { onMount } from 'svelte';
	import { X, Printer, Share2, Download, Copy, Check, Send, Mail } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import type { ProformaDraft, ProformaTotals } from './types';
	import { formatProformaMoney } from './proforma-calc';
	import { amountToWordsUAH } from './number-to-words-uk';

	let {
		draft,
		totals,
		open = $bindable(false)
	}: {
		draft: ProformaDraft;
		totals: ProformaTotals;
		open: boolean;
	} = $props();

	let qrCanvas = $state<HTMLCanvasElement | null>(null);
	let copied = $state(false);
	let shareMenuOpen = $state(false);

	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	const shareUrl = $derived(
		draft.invoiceId ? `${origin}/pay/${draft.invoiceId}` : `${origin}/dashboard/proformas`
	);

	const sellerInitials = $derived.by(() => {
		const name = draft.seller.name?.trim();
		if (!name) return '1B';
		const words = name.split(/\s+/);
		if (words.length >= 2) {
			return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	});

	$effect(() => {
		if (open && qrCanvas && shareUrl) {
			void QRCode.toCanvas(qrCanvas, shareUrl, {
				errorCorrectionLevel: 'M',
				margin: 1,
				width: 88,
				color: { dark: '#09090b', light: '#ffffff' }
			});
		}
	});

	function handlePrint() {
		window.print();
	}

	async function handleShare() {
		if (typeof navigator !== 'undefined' && navigator.share) {
			try {
				await navigator.share({
					title: `${draft.title} № ${draft.number}`,
					text: `Рахунок-фактура № ${draft.number} від ${draft.issueDate} на суму ${formatProformaMoney(totals.total, draft.currency)}`,
					url: shareUrl
				});
				return;
			} catch {
				// Fallback to menu
			}
		}
		shareMenuOpen = !shareMenuOpen;
	}

	async function copyShareLink() {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 2500);
	}

	function shareToTelegram() {
		const text = encodeURIComponent(
			`Рахунок-фактура № ${draft.number} на суму ${formatProformaMoney(totals.total, draft.currency)}\n${shareUrl}`
		);
		window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
	}

	function shareToEmail() {
		const subject = encodeURIComponent(`${draft.title} № ${draft.number}`);
		const body = encodeURIComponent(
			`Доброго дня!\n\nНадсилаємо рахунок-фактуру № ${draft.number} від ${draft.issueDate}.\nСума до сплати: ${formatProformaMoney(totals.total, draft.currency)}.\n\nПосилання на електронну версію та оплату: ${shareUrl}\n\nЗ повагою,\n${draft.seller.name}`
		);
		window.open(`mailto:${draft.customer.email || ''}?subject=${subject}&body=${body}`, '_blank');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md print:p-0 print:bg-white"
		role="dialog"
		aria-modal="true"
		aria-labelledby="preview-title"
	>
		<div
			class="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none print:rounded-none"
		>
			<!-- Modal Header Toolbar (hidden on print) -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 print:hidden">
				<div class="flex items-center gap-3">
					<span class="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
						Друкована версія
					</span>
					<h3 id="preview-title" class="text-base font-extrabold text-zinc-900">
						{draft.title} № {draft.number}
					</h3>
				</div>

				<div class="relative flex items-center gap-2">
					<!-- Share Button -->
					<button
						type="button"
						onclick={handleShare}
						class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
					>
						<Share2 size={15} />
						Поділитись
					</button>

					{#if shareMenuOpen}
						<div class="absolute right-32 top-11 z-50 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl space-y-1 text-xs">
							<button
								type="button"
								onclick={copyShareLink}
								class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 font-semibold"
							>
								{#if copied}
									<Check size={15} class="text-emerald-600" />
									<span class="text-emerald-600 font-bold">Скопійовано!</span>
								{:else}
									<Copy size={15} />
									<span>Скопіювати лінк</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={shareToTelegram}
								class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-blue-50 hover:text-blue-700 font-semibold"
							>
								<Send size={15} />
								<span>Надіслати в Telegram</span>
							</button>
							<button
								type="button"
								onclick={shareToEmail}
								class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 font-semibold"
							>
								<Mail size={15} />
								<span>Надіслати на Email</span>
							</button>
						</div>
					{/if}

					<!-- Print / PDF Button -->
					<button
						type="button"
						onclick={handlePrint}
						class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
					>
						<Printer size={15} />
						Друк / Скачати в PDF
					</button>

					<button
						type="button"
						onclick={() => (open = false)}
						class="grid size-9 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
						aria-label="Закрити"
					>
						<X size={18} />
					</button>
				</div>
			</div>

			<!-- Printable Document Body (A4 sheet) -->
			<div class="flex-1 overflow-y-auto p-6 font-sans text-sm text-zinc-900 print:p-0 print:overflow-visible">
				<div
					id="proforma-print-sheet"
					class="mx-auto max-w-[210mm] bg-white p-10 print:p-8 print:w-full print:max-w-none shadow-sm print:shadow-none border border-zinc-100 print:border-none"
				>
					<!-- Top Section: Logo & Document Title -->
					<div class="flex items-start justify-between pb-8">
						<!-- Brand Badge / Logo -->
						<div class="flex size-20 items-center justify-center rounded-2xl border-4 border-zinc-400/80 bg-white font-sans text-2xl font-black text-zinc-700 tracking-tight shadow-sm">
							{sellerInitials}
						</div>

						<!-- Document Title and Details -->
						<div class="text-right">
							<h1 class="text-3xl font-extrabold tracking-tight text-zinc-950">
								{draft.title}
							</h1>
							<p class="mt-1 text-sm font-bold text-zinc-800">
								№ {draft.number} від {draft.issueDate ? new Date(draft.issueDate).toLocaleDateString('uk-UA') : '___'}
							</p>
							{#if draft.dueDate}
								<p class="mt-0.5 text-xs text-zinc-500">
									Оплатити до {new Date(draft.dueDate).toLocaleDateString('uk-UA')}
								</p>
							{/if}
						</div>
					</div>

					<!-- Parties: Seller and Buyer (2 columns) -->
					<div class="mt-6 grid grid-cols-2 gap-10 text-xs">
						<!-- Seller (Постачальник) -->
						<div>
							<h2 class="text-base font-extrabold text-zinc-950">
								{draft.seller.name || 'Моя компанія'}
							</h2>
							<div class="mt-1.5 space-y-0.5 text-zinc-600">
								{#if draft.seller.taxId}
									<p>ЄДРПОУ/РНОКПП: <strong class="text-zinc-900">{draft.seller.taxId}</strong></p>
								{/if}
								{#if draft.seller.iban}
									<p>IBAN: <strong class="font-mono text-zinc-900">{draft.seller.iban}</strong></p>
								{/if}
								{#if draft.seller.bankName}
									<p>Банк: {draft.seller.bankName}</p>
								{/if}
								<p class="text-[11px] text-zinc-500">
									{draft.seller.vatStatus === 'vat' ? 'Платник ПДВ 20%' : 'Без ПДВ (не є платником ПДВ)'}
								</p>
							</div>
						</div>

						<!-- Buyer (Покупець / Замовник) -->
						<div>
							<h2 class="text-base font-extrabold text-zinc-950">
								{draft.customer.name || 'Клієнт'}
							</h2>
							<div class="mt-1.5 space-y-0.5 text-zinc-600">
								{#if draft.customer.taxId}
									<p>ЄДРПОУ/РНОКПП: <strong class="text-zinc-900">{draft.customer.taxId}</strong></p>
								{/if}
								{#if draft.customer.phone}
									<p>{draft.customer.phone}</p>
								{/if}
								{#if draft.customer.email}
									<p>{draft.customer.email}</p>
								{/if}
								{#if draft.customer.address}
									<p>{draft.customer.address}</p>
								{/if}
							</div>
						</div>
					</div>

					<!-- Goods & Services Table -->
					<div class="mt-8">
						<table class="w-full text-left text-xs">
							<thead>
								<tr class="rounded-xl bg-zinc-100/90 text-zinc-800 font-extrabold">
									<th class="py-3 px-4 rounded-l-xl">Найменування товару або послуги</th>
									<th class="py-3 px-3 text-center w-24">Кількість</th>
									<th class="py-3 px-4 text-right w-28">Ціна, грн</th>
									<th class="py-3 px-4 text-right rounded-r-xl w-32">Сума, грн</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-zinc-100">
								{#each draft.items as item, index}
									{#if item.type === 'heading'}
										<tr class="bg-zinc-50/70 font-extrabold text-zinc-800">
											<td colspan="4" class="py-2.5 px-4 text-[11px] uppercase tracking-wider text-blue-700">
												{item.name}
											</td>
										</tr>
									{:else}
										<tr class="hover:bg-zinc-50/50">
											<td class="py-3 px-4">
												<span class="font-bold text-zinc-900">{item.name || `Послуга ${index + 1}`}</span>
												{#if item.description}
													<p class="text-[11px] text-zinc-500 mt-0.5">{item.description}</p>
												{/if}
											</td>
											<td class="py-3 px-3 text-center tabular-nums text-zinc-700">
												{item.quantity} {item.unit || 'шт.'}
											</td>
											<td class="py-3 px-4 text-right tabular-nums text-zinc-700">
												{item.price.toFixed(2)}
											</td>
											<td class="py-3 px-4 text-right font-extrabold tabular-nums text-zinc-950">
												{item.total.toFixed(2)}
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Bottom Section: Payment Method with QR & Financial Totals -->
					<div class="mt-8 grid grid-cols-12 gap-8 items-start pt-4 border-t border-zinc-100">
						<!-- Left: Payment Method & QR Badge -->
						<div class="col-span-7 space-y-3">
							<div>
								<span class="block text-xs font-bold text-zinc-900">Спосіб оплати</span>
								<p class="text-xs font-mono text-zinc-700 mt-0.5">
									{draft.seller.iban || draft.paymentMethod.details || '0000 0000 0000 0000'}
								</p>
							</div>

							<!-- QR Card Badge -->
							<div class="inline-flex items-center gap-3.5 rounded-2xl bg-zinc-100/90 p-3 pr-5 shadow-sm border border-zinc-200/60">
								<div class="relative grid size-20 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
									<canvas bind:this={qrCanvas} class="size-full"></canvas>
									<!-- Document Icon in center of QR -->
									<div class="absolute grid size-5 place-items-center rounded-md bg-amber-400 text-zinc-950 shadow-sm">
										<span class="text-[9px] font-black">📄</span>
									</div>
								</div>
								<div class="text-left">
									<strong class="block text-xs font-bold text-zinc-900 leading-snug">
										Перейти до електронної<br />версії документу
									</strong>
									<span class="mt-0.5 block text-[10px] text-zinc-500">
										Скануйте для миттєвої оплати
									</span>
								</div>
							</div>
						</div>

						<!-- Right: Financial Summary -->
						<div class="col-span-5 space-y-2 text-right">
							<div class="flex items-center justify-between text-xs text-zinc-600">
								<span>Сума</span>
								<strong class="tabular-nums text-zinc-900">{totals.subtotal.toFixed(2)} грн</strong>
							</div>

							{#if totals.discountTotal > 0}
								<div class="flex items-center justify-between text-xs text-zinc-600">
									<span>Знижка</span>
									<span class="tabular-nums text-zinc-900">{totals.discountTotal.toFixed(2)} грн</span>
								</div>
							{/if}

							{#if draft.taxRate > 0}
								<div class="flex items-center justify-between text-xs text-zinc-600">
									<span>ПДВ ({draft.taxRate}%)</span>
									<span class="tabular-nums text-zinc-900">{totals.taxAmount.toFixed(2)} грн</span>
								</div>
							{:else}
								<div class="flex items-center justify-between text-xs text-zinc-500">
									<span>ПДВ</span>
									<span class="font-semibold text-zinc-700">Без ПДВ</span>
								</div>
							{/if}

							<!-- Grand Total -->
							<div class="pt-2 border-t border-zinc-200">
								<div class="flex items-baseline justify-between">
									<span class="text-base font-extrabold text-zinc-950">Разом</span>
									<strong class="text-2xl font-black text-zinc-950 tabular-nums">
										{totals.total.toFixed(2)} грн
									</strong>
								</div>
								<!-- Amount in Words according to Ukrainian standards -->
								<p class="mt-1 text-[11px] italic text-zinc-600">
									({amountToWordsUAH(totals.total)})
								</p>
							</div>
						</div>
					</div>

					<!-- Payment Purpose & Ukrainian Law Compliance Note -->
					{#if draft.purpose}
						<div class="mt-8 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 text-xs text-zinc-700">
							<span class="font-bold text-zinc-900">Призначення платежу: </span>
							<span>{draft.purpose}</span>
						</div>
					{/if}

					<!-- Ukrainian Legal Footer & Signature Placeholder -->
					<div class="mt-10 pt-6 border-t border-zinc-200 text-xs text-zinc-600 grid grid-cols-2 gap-8">
						<div>
							<p class="text-[11px] leading-relaxed text-zinc-500">
								Рахунок дійсний до оплати протягом вказаного терміну. Оплата даного рахунку є погодженням з умовами поставки та підтвердженням замовлення.
							</p>
						</div>
						<div class="text-right flex flex-col justify-end">
							<div class="border-b border-zinc-400 pb-1 w-56 ml-auto flex justify-between text-zinc-500 text-[11px]">
								<span>Виписав(ла)</span>
								<span class="font-bold text-zinc-900">{draft.seller.name}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@media print {
		:global(body) {
			background: #ffffff !important;
			color: #000000 !important;
			margin: 0 !important;
			padding: 0 !important;
		}
		:global(nav),
		:global(aside),
		:global(header),
		:global(footer) {
			display: none !important;
		}
		#proforma-print-sheet {
			border: none !important;
			box-shadow: none !important;
			margin: 0 !important;
			padding: 10mm !important;
			width: 100% !important;
			max-width: none !important;
		}
	}
</style>
