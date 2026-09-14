<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, ArrowUpRight, Check, RefreshCw, Send } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import { TELEGRAM_LOGO_SVG } from './telegram-invoice-art';
	import type { InvoiceRecord } from '../types';
	import { eligibleTelegramInvoices, formatTelegramInvoiceAmount, formatTelegramInvoiceDate, invoiceAmountCents, TelegramInvoiceError, TELEGRAM_DELIVERY_WARNING, type TelegramInvoiceCard } from './telegram-invoice-client';

	let { demo = false, onLoadInvoices, onPreviewInvoice, onSendInvoice, onClose, sentIds = $bindable(), uncertainIds = $bindable() }: {
		demo?: boolean;
		onLoadInvoices?: () => Promise<InvoiceRecord[]>;
		onPreviewInvoice?: (id: string) => Promise<TelegramInvoiceCard>;
		onSendInvoice?: (id: string) => Promise<void>;
		onClose: () => void;
		sentIds: string[];
		uncertainIds: string[];
	} = $props();

	let invoices = $state<InvoiceRecord[]>([]);
	let selectedId = $state('');
	let loading = $state(false);
	let sending = $state(false);
	let loadError = $state('');
	let sendError = $state('');
	let result = $state('');
	let confirmRetry = $state(false);
	let preview = $state<TelegramInvoiceCard | null>(null);
	let previewId = $state('');
	let previewLoading = $state(false);
	let previewError = $state('');
	let qr = $state<{ size: number; path: string } | null>(null);
	let previewGeneration = 0;
	let disposed = false;
	const selected = $derived(invoices.find((invoice) => invoice.id === selectedId));
	const alreadySent = $derived(sentIds.includes(selectedId));
	const uncertain = $derived(uncertainIds.includes(selectedId));
	const createPath = $derived(`/dashboard/invoices/new?type=fixed${demo ? '&demo=1' : ''}`);
	// Trusted, generated original artwork; never inject server SVG/HTML into the DOM.
	const logoSource = `data:image/svg+xml,${encodeURIComponent(TELEGRAM_LOGO_SVG)}`;
	const previewReady = $derived(preview !== null && previewId === selectedId && !previewLoading && !previewError);
	const amountChanged = $derived(previewReady && selected && preview &&
		invoiceAmountCents(selected.amount) !== invoiceAmountCents(preview.amount));

	function invalidatePreview() {
		previewGeneration++;
		preview = null;
		previewId = '';
		previewLoading = false;
		previewError = '';
		qr = null;
	}

	async function loadPreview() {
		invalidatePreview();
		result = ''; sendError = ''; confirmRetry = false;
		const id = selectedId;
		if (!id) return;
		const generation = previewGeneration;
		previewLoading = true;
		try {
			if (!demo && !onPreviewInvoice) throw new Error('Канонічний перегляд ще не підключено. Надсилання недоступне.');
			const now = Date.now();
			const card: TelegramInvoiceCard = demo ? {
				amount: '1280.00', reference: 'DEMO-001', recipient: 'ФОП Демонстраційний отримувач',
				issuedAt: new Date(now).toISOString(), displayExpiresAt: new Date(now + 72 * 60 * 60 * 1000).toISOString(),
				checkoutUrl: '', displayExpiryNote: '(строк демо-картки; не є платіжним рахунком)'
			} : await onPreviewInvoice!(id);
			if (disposed || generation !== previewGeneration || selectedId !== id) return;
			if (!demo) {
				const { modules } = QRCode.create(card.checkoutUrl, { errorCorrectionLevel: 'M' });
				let path = '';
				for (let row = 0; row < modules.size; row++) {
					for (let col = 0; col < modules.size; col++) {
						if (modules.data[row * modules.size + col]) path += `M${col + 4} ${row + 4}h1v1h-1z`;
					}
				}
				qr = { size: modules.size + 8, path };
			}
			preview = card;
			previewId = id;
		} catch (error) {
			if (!disposed && generation === previewGeneration) {
				previewError = error instanceof Error ? error.message : 'Не вдалося завантажити перегляд. Нічого не надіслано.';
			}
		} finally {
			if (!disposed && generation === previewGeneration) previewLoading = false;
		}
	}

	function demoInvoice(): InvoiceRecord {
		return {
			id: '00000000-0000-4000-8000-000000000001', reference: 'DEMO-001',
			title: 'Консультація та підготовка проєкту', amount: 1280, baseAmount: 1280,
			discountAmount: 0, deliveryFee: 0, currency: 'UAH', status: 'pending',
			lifecycleStatus: 'pending', type: 'fixed', channel: 'Link', createdAt: new Date().toISOString(),
			shortId: null, description: null, tableNumber: null, terminalId: null,
			paidAt: null, paidBankCode: null, expiresAt: null
		};
	}

	async function refreshInvoices() {
		if (loading || sending) return;
		loading = true;
		loadError = '';
		result = '';
		sendError = '';
		confirmRetry = false;
		const previousId = selectedId;
		invalidatePreview();
		invoices = [];
		selectedId = '';
		try {
			if (!demo && !onLoadInvoices) throw new Error('Завантаження рахунків ще не підключено.');
			const rows = demo ? [demoInvoice()] : await onLoadInvoices!();
			if (disposed) return;
			invoices = eligibleTelegramInvoices(rows);
			selectedId = invoices.some((invoice) => invoice.id === previousId) ? previousId : '';
			if (selectedId) void loadPreview();
		} catch (error) {
			if (!disposed) loadError = error instanceof Error ? error.message : 'Не вдалося завантажити рахунки. Спробуйте оновити список.';
		} finally {
			if (!disposed) loading = false;
		}
	}

	onMount(() => {
		void refreshInvoices();
		return () => { disposed = true; previewGeneration++; };
	});

	async function send() {
		if (!selected || !previewReady || loading || sending || alreadySent || (uncertain && !confirmRetry)) return;
		if (!eligibleTelegramInvoices([selected]).length) {
			loadError = 'Термін рахунку минув або його дані некоректні. Оновіть список.';
			invoices = [];
			selectedId = '';
			invalidatePreview();
			return;
		}
		const id = selected.id;
		if (!demo && !onSendInvoice) { sendError = 'Надсилання ще не підключено.'; return; }
		sending = true;
		sendError = '';
		result = '';
		confirmRetry = false;
		try {
			if (!demo) await onSendInvoice!(id);
			// Record the outcome in the owning page even if this composer was removed.
			uncertainIds = uncertainIds.filter((invoiceId) => invoiceId !== id);
			sentIds = [...sentIds, id];
			if (disposed) return;
			result = demo ? 'Демо: картку показано локально. До Telegram нічого не надсилалося.' : 'Telegram прийняв картку';
		} catch (error) {
			// A definite failure of a retry cannot resolve an earlier uncertain delivery.
			if (!(error instanceof TelegramInvoiceError) || error.deliveryUncertain) {
				if (!uncertainIds.includes(id)) uncertainIds = [...uncertainIds, id];
			}
			if (disposed) return;
			sendError = error instanceof Error ? error.message : 'Не вдалося підтвердити надсилання.';
		} finally {
			if (!disposed) sending = false;
		}
	}
</script>

<section class="composer" aria-labelledby="invoice-composer-title" aria-busy={sending}>
	<button class="back" type="button" onclick={onClose} disabled={sending}><ArrowLeft size={16} aria-hidden="true" /> До повідомлення</button>
	<header>
		<p class="eyebrow">RAKHUNOK · TELEGRAM</p>
		<h2 id="invoice-composer-title">Рахунок, який хочеться відкрити</h2>
		<p class="intro">Картка наявного рахунку — лише у налаштований оператором self-test чат. Не розсилка клієнтам.</p>
	</header>
	{#if demo}<p class="demo-note">Демо-режим: синтетичні дані, без мережі та реальних платіжних посилань.</p>{/if}
	<div class="selection-heading">
		<label for="telegram-invoice-select">Фіксований рахунок · UAH</label>
		<button class="refresh" type="button" onclick={refreshInvoices} disabled={loading || sending}><RefreshCw size={14} aria-hidden="true" /> {loading ? 'Завантаження…' : 'Оновити рахунки'}</button>
	</div>
	<select id="telegram-invoice-select" value={selectedId} disabled={loading || sending || !invoices.length} onchange={(event) => { selectedId = event.currentTarget.value; void loadPreview(); }}>
		<option value="">Оберіть рахунок для попереднього перегляду</option>
		{#each invoices as invoice (invoice.id)}
			<option value={invoice.id}>{invoice.reference} · {invoice.title} · {formatTelegramInvoiceAmount(invoice.amount)} ₴</option>
		{/each}
	</select>
	{#if loadError}<p class="error" role="alert">{loadError}</p>
	{:else if !loading && !invoices.length}<p class="hint">Немає доступних неоплачених фіксованих рахунків у гривні з чинним терміном і коректною сумою.</p>{/if}
	<div class="create-note">
		<!-- Absolute dashboard entry intentionally preserves the classic creator and demo query. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={createPath} aria-disabled={sending} onclick={(event) => { if (sending) event.preventDefault(); }}>Створити фіксований рахунок <ArrowUpRight size={14} aria-hidden="true" /></a>
		<p>Створіть класичний рахунок, потім поверніться сюди й натисніть «Оновити рахунки». Ця форма не створює замовлень.</p>
	</div>
	{#if previewLoading}<p class="hint" role="status">Завантаження перевірених даних картки…</p>{/if}
	{#if previewError}<p class="error" role="alert">{previewError}</p>{/if}
	{#if amountChanged}<p class="demo-note" role="status">Сума відрізняється від списку. На картці показано точну суму, перевірену сервером.</p>{/if}
	<figure aria-busy={previewLoading}>
		<div class="payment-card">
			<div class="card-top">
				<span class="brand"><img src={logoSource} alt="" width="32" height="34" />rakhunok</span>
				<div class="expiry"><span>Діє до</span><strong>{preview ? formatTelegramInvoiceDate(preview.displayExpiresAt) : '—'}</strong></div>
			</div>
			<div class="card-content">
				<div class="card-details">
					<p class="reference">{preview ? `№ ${preview.reference}` : 'Оберіть наявний рахунок'}</p>
					<p class="amount-label">До сплати</p>
					<p class="amount">{preview ? formatTelegramInvoiceAmount(preview.amount) : '—'}</p>
					<p class="currency">гривень · UAH</p>
					<div class="recipient"><p class="purpose-label">ОТРИМУВАЧ</p><p class="purpose">{preview?.recipient || 'Дані лише після перевірки сервером'}</p></div>
					<p class="issued">Дата виставлення · {preview ? formatTelegramInvoiceDate(preview.issuedAt) : '—'}</p>
				</div>
				<div class="qr-column">
					{#if qr && preview}
						<svg class="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR-код канонічного посилання на рахунок" shape-rendering="crispEdges"><rect width={qr.size} height={qr.size} fill="white" /><path d={qr.path} fill="#091d17" /></svg>
						<p>Скануйте для оплати</p><small>{new URL(preview.checkoutUrl).host}</small>
					{:else}
						<div class="qr-placeholder">{demo ? 'ДЕМО' : 'QR'}<small>{demo ? 'Без платіжного QR' : 'Після перевірки'}</small></div>
					{/if}
				</div>
			</div>
			<div class="card-bottom"><span>Рахунок на оплату</span><span>RAKHUNOK</span></div>
		</div>
		<div class="telegram-cta" aria-hidden="true">Відкрити рахунок <ArrowUpRight size={17} /></div>
		<figcaption>{#if preview}{preview.displayExpiryNote}. {/if}«Діє до» — лише строк показу картки: менше зі збереженого терміну рахунку та 72 годин від перевірки. Він не змінює строк рахунку. Дати — за Києвом. {demo ? 'Синтетичний приклад, без оплати.' : 'Метадані перевірено сервером. Надсилання повторно читає суму, отримувача, статус і термін; це не зафіксований платіжний знімок.'}</figcaption>
	</figure>
	{#if result}<div class="success" role="status"><Check size={17} aria-hidden="true" /><div>{result}{#if !demo}<p>Це підтвердження прийняття Telegram, а не прочитання чи оплати.</p>{/if}</div></div>{/if}
	{#if sendError && !(uncertain && sendError === TELEGRAM_DELIVERY_WARNING)}<p class="error" role="alert">{sendError}</p>{/if}
	{#if uncertain}
		<div class="warning" role="alert"><p>{TELEGRAM_DELIVERY_WARNING}</p><label><input type="checkbox" bind:checked={confirmRetry} disabled={sending} /> Я перевірив(ла) чат і погоджуюся на повтор із ризиком дубліката.</label></div>
	{/if}
	{#if !demo && !onSendInvoice}<p class="hint">Надсилання стане доступним після підключення кабінету.</p>{/if}
	<button class="send" type="button" onclick={send} disabled={!selected || !previewReady || loading || sending || alreadySent || (!demo && (!onSendInvoice || !onPreviewInvoice)) || (uncertain && !confirmRetry)}><Send size={17} aria-hidden="true" /> {sending ? 'Надсилання…' : alreadySent ? 'Картку вже надіслано в цій сесії' : 'Надіслати собі в Telegram'}</button>
	<p class="footnote">{demo ? 'Лише локальна імітація. Жодних повідомлень чи оплат.' : 'Лише ручне надсилання. Одержувача визначає сервер, а не публічний профіль.'}</p>
	<p class="footnote">Пам’ять про надсилання та непідтверджені спроби діє лише поки відкрита ця сторінка налаштувань. Перехід зі сторінки, її оновлення або зміна акаунта чи бізнесу скидає її. Це не гарантія від дублікатів — перевіряйте чат перед повтором.</p>
</section>

<style>
	.composer { color: #172b26; padding: 26px; font-size: 13px; }
	button, a, select, input { touch-action: manipulation; }
	button { cursor: pointer; }
	button:disabled { cursor: not-allowed; opacity: .5; }
	button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #059669; outline-offset: 3px; }
	.back, .refresh { display: inline-flex; align-items: center; gap: 7px; background: transparent; border: 0; color: #42645a; font-size: 12px; }
	header { margin: 24px 0; }
	.eyebrow { color: #08785a; font-size: 10px; letter-spacing: .2em; font-weight: 800; }
	h2 { font-size: clamp(21px, 4vw, 27px); line-height: 1.2; font-weight: 800; letter-spacing: -.04em; margin: 9px 0; }
	.intro, .hint, .create-note p, figcaption, .footnote { color: #597168; line-height: 1.6; }
	.selection-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 9px; flex-wrap: wrap; }
	.selection-heading label { font-weight: 700; font-size: 12px; }
	select { width: 100%; min-height: 46px; padding: 10px; border: 1px solid #cbdad3; border-radius: 10px; background: white; font: inherit; color: #183c2f; }
	.create-note { padding: 13px 0 20px; }
	.create-note a { display: inline-flex; align-items: center; gap: 5px; color: #087455; font-weight: 750; text-decoration: underline; text-underline-offset: 3px; }
	.create-note p { margin-top: 7px; font-size: 11px; }
	figure { margin: 0; }
	.payment-card { overflow: hidden; border-radius: 19px; border: 1px solid #245444; padding: 25px; color: #effff7; background: radial-gradient(ellipse at 95% 0%, #195e48 0%, transparent 65%), linear-gradient(135deg, #0c201b, #071b16); box-shadow: 0 15px 32px -20px #073f31; }
	.card-top, .card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.brand { display: inline-flex; align-items: center; gap: 7px; font-size: 21px; font-weight: 800; letter-spacing: -.06em; }
	.brand img { filter: brightness(0) saturate(100%) invert(88%) sepia(28%) saturate(698%) hue-rotate(90deg); }
	.expiry { text-align: right; flex-shrink: 0; }
	.expiry span { display: block; color: #8baf9e; font-size: 9px; letter-spacing: .12em; }
	.expiry strong { display: block; font-size: 13px; margin-top: 5px; }
	.card-top { padding-bottom: 18px; border-bottom: 1px solid #ffffff20; }
	.card-content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(100px, 34%); gap: 20px; padding-top: 21px; align-items: center; }
	.card-details { min-width: 0; }
	.reference { color: #6febb5; font-size: 11px; overflow-wrap: anywhere; }
	.amount-label { margin: 16px 0 6px; color: #8baf9e; font-size: 11px; }
	.amount { font-size: clamp(20px, 4.7vw, 39px); font-weight: 750; letter-spacing: -.055em; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
	.currency { color: #6febb5; font-size: 10px; margin-top: 7px; }
	.recipient { margin-top: 22px; padding-top: 14px; border-top: 1px solid #ffffff20; }
	.purpose-label { font-size: 9px; letter-spacing: .18em; color: #98bcac; }
	.purpose { margin-top: 7px; line-height: 1.5; overflow-wrap: anywhere; }
	.issued { color: #8baf9e; font-size: 9px; margin-top: 18px; line-height: 1.6; }
	.qr-column { text-align: center; min-width: 0; }
	.qr { display: block; width: 100%; height: auto; border: 7px solid white; border-radius: 10px; background: white; }
	.qr-column p { margin-top: 10px; font-size: 10px; }
	.qr-column small { color: #8baf9e; font-size: 9px; overflow-wrap: anywhere; }
	.qr-placeholder { aspect-ratio: 1; border: 1px dashed #54826c; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; justify-content: center; font-weight: 700; color: #b8dacc; }
	.card-bottom { border-top: 1px solid #ffffff20; padding-top: 17px; margin-top: 23px; color: #abd1bf; font-size: 10px; overflow-wrap: anywhere; }
	.telegram-cta { display: flex; align-items: center; justify-content: center; gap: 9px; padding: 13px; margin-top: 7px; border-radius: 8px; background: #e4f1f9; color: #24638e; font-weight: 700; }
	figcaption { margin: 10px 0 19px; font-size: 10px; }
	.error, .warning, .demo-note { padding: 12px; border-radius: 9px; line-height: 1.6; margin: 12px 0; }
	.error { background: #fff1f2; color: #9f1239; }
	.warning, .demo-note { background: #fffbeb; color: #854d0e; }
	.warning label { display: flex; gap: 9px; align-items: flex-start; margin-top: 10px; font-weight: 650; }
	.warning input { margin-top: 4px; flex-shrink: 0; }
	.success { display: flex; gap: 8px; padding: 13px; margin-bottom: 12px; background: #e6f7ee; border-radius: 9px; color: #086345; font-weight: 700; }
	.success p { font-size: 11px; font-weight: 400; margin-top: 4px; }
	.send { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; width: 100%; border: 1px solid #086647; border-radius: 11px; background: #075c42; color: white; font-weight: 750; padding: 12px; }
	.send:hover:not(:disabled) { background: #064c37; }
	.footnote { text-align: center; font-size: 10px; margin-top: 9px; }
	@media (max-width: 420px) { .composer { padding: 16px; } .payment-card { padding: 15px; } .brand { font-size: 17px; } .card-content { gap: 12px; grid-template-columns: minmax(0, 1fr) 100px; } .purpose { font-size: 11px; } }
</style>