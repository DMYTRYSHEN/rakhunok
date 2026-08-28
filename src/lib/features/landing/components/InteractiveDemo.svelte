<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatMoney } from '../utils/calculator';

	let purpose = $state('Вечеря · Стіл 12');
	let amount = $state(850);
	let table = $state('Стіл 12');
	let invoice: { purpose: string; amount: number; table: string } | null = $state(null);
	let status: 'waiting' | 'processing' | 'success' = $state('waiting');
	let selectedBank = $state('Bank Lviv Online');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const banks = ['Bank Lviv Online', 'monobank', 'ПриватБанк'];

	function createInvoice() {
		if (!Number.isFinite(amount) || amount < 1) return;
		clearTimeout(timer);
		invoice = {
			purpose: purpose.trim() || 'Замовлення',
			amount,
			table: table.trim() || 'Без мітки'
		};
		status = 'waiting';
	}

	function simulatePayment() {
		status = 'processing';
		timer = setTimeout(() => (status = 'success'), 1500);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<section class="section" id="demo">
	<div class="container">
		<header class="integration-heading">
			<p class="eyebrow"><i></i> Integrations · живий сценарій без реального списання</p>
			<h2>Додайте Pay by Bank<br />до будь-якого checkout.</h2>
			<p>Вбудуйте у власний checkout, надішліть платіжне посилання або покажіть QR. Rahunok працює поверх вашого поточного сценарію, не змінюючи операційні процеси.</p>
		</header>

		<div class="integration-shell" data-state={invoice ? status : 'empty'}>
			<div class="integration-intro">
				<span>PAYMENT FLOW / 01</span>
				<h3>Прямий платіж<br />з рахунку на рахунок.</h3>
				<p>Без картки посередині.</p>
				<div class="account-route" aria-label="Шлях платежу">
					<div><i>UA</i><span><b>Клієнт</b><small>рахунок у банку</small></span></div>
					<strong><i></i><span>миттєвий переказ</span></strong>
					<div><i>R/</i><span><b>Ваш бізнес</b><small>IBAN рахунок</small></span></div>
				</div>
			</div>

			<div class="integration-live">
				<div class="integration-live-head"><span><i></i> LIVE SANDBOX</span><b>Гроші не списуються</b></div>
				<div class="integration-grid">
					<form class="integration-step integration-form" onsubmit={(event) => { event.preventDefault(); createInvoice(); }}>
						<header><span>01</span><div><small>Ваш checkout</small><h4>Створіть рахунок</h4></div></header>
						<label><span>Що оплачує клієнт</span><input bind:value={purpose} maxlength="48" /></label>
						<div class="demo-input-row">
							<label><span>Сума, ₴</span><input bind:value={amount} type="number" min="1" max="1000000" /></label>
							<label><span>Мітка</span><input bind:value={table} maxlength="32" /></label>
						</div>
						<button class="integration-action" type="submit">Створити платіж <span>→</span></button>
					</form>

					<div class="integration-step integration-checkout">
						<header><span>02</span><div><small>Клієнт</small><h4>Обирає свій банк</h4></div></header>
						{#if invoice}
							<div class="embedded-checkout">
								<div class="embedded-summary"><span>Rahunok Coffee · {invoice.table}</span><strong>{formatMoney(invoice.amount)}</strong><small>{invoice.purpose}</small></div>
								<div class="embedded-banks">
									{#each banks as bank (bank)}
										<button type="button" class:active={selectedBank === bank} onclick={() => (selectedBank = bank)}><i>{bank === 'Bank Lviv Online' ? 'BL' : bank.slice(0, 2)}</i><span><b>{bank}</b><small>Pay by Bank</small></span><em>›</em></button>
									{/each}
								</div>
								<button class="integration-action" type="button" disabled={status === 'processing'} onclick={simulatePayment}>{status === 'processing' ? `Підтвердження у ${selectedBank}…` : status === 'success' ? 'Оплату підтверджено' : `Продовжити з ${selectedBank}`}</button>
							</div>
						{:else}
							<div class="integration-empty"><i>+</i><span><b>Checkout готовий</b><small>Створіть платіж на першому кроці</small></span></div>
						{/if}
					</div>

					<div class="integration-step integration-result">
						<header><span>03</span><div><small>Rahunok backend</small><h4>Підтверджує оплату</h4></div></header>
						<div class="verification-orbit" class:processing={status === 'processing'} class:success={status === 'success'}><i>R/</i><span></span><b>{status === 'success' ? '✓' : status === 'processing' ? '•••' : '03'}</b></div>
						<div class="verification-copy"><strong>{status === 'success' ? 'Verified SUCCESS' : status === 'processing' ? 'Перевіряємо webhook' : 'Очікуємо платіж'}</strong><p>{status === 'success' ? `${formatMoney(invoice?.amount ?? amount)} зараховано на IBAN бізнесу. Рахунок можна закривати.` : 'Статус у checkout зміниться лише після server-side підтвердження банку.'}</p></div>
						<div class="verification-meta"><span>BANK CALLBACK</span><i>→</i><span>WEBHOOK</span><i>→</i><b>LEDGER</b></div>
					</div>
				</div>
			</div>

			<footer class="integration-footer"><span>Hosted Checkout</span><span>Web SDK</span><span>Payment Links</span><span>QR · NFC</span><b>Одна інтеграція</b></footer>
		</div>
	</div>
</section>
