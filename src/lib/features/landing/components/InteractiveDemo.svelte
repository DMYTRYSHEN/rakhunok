<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatMoney } from '../utils/calculator';

	let purpose = $state('Вечеря · Стіл 12');
	let amount = $state(850);
	let table = $state('Стіл 12');
	let invoice: { purpose: string; amount: number; table: string } | null = $state(null);
	let status: 'waiting' | 'processing' | 'success' = $state('waiting');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const qrCells = Array.from({ length: 49 }, (_, index) =>
		[
			0, 1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 18, 20, 22, 24, 27, 28, 29, 30, 32, 35, 36, 37,
			39, 41, 42, 43, 44, 46, 48
		].includes(index)
	);

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
		<header class="section-heading">
			<p class="eyebrow">Інтерактивне демо</p>
			<h2>Пройдіть шлях клієнта самі.</h2>
			<p class="section-copy">
				Це демонстрація інтерфейсу: реальний платіж не створюється, гроші не списуються.
			</p>
		</header>
		<div class="demo-grid">
			<form
				class="panel"
				onsubmit={(event) => {
					event.preventDefault();
					createInvoice();
				}}
			>
				<small>Інтерфейс бізнесу</small>
				<h3>Створіть тестовий рахунок</h3>
				<label>Призначення<input bind:value={purpose} maxlength="48" /></label>
				<label>Сума, ₴<input bind:value={amount} type="number" min="1" max="1000000" /></label>
				<label>Мітка або столик<input bind:value={table} maxlength="32" /></label>
				<button class="button button-primary" type="submit">Створити QR-рахунок →</button>
				<p class="microcopy">Демо не підключене до банку та не створює реального переказу.</p>
			</form>
			<div class="panel client-panel">
				<small>Інтерфейс клієнта</small>
				{#if invoice}
					<div class="phone-demo">
						<p>Отримувач <strong>Ваш бізнес</strong></p>
						<div class="payment-summary">
							<small>До сплати</small><b>{formatMoney(invoice.amount)}</b><span
								>{invoice.purpose}</span
							><small>{invoice.table}</small>
						</div>
						<div class="demo-qr" aria-label="Демонстраційний QR">
							{#each qrCells as dark, index (index)}<i class:dark></i>{/each}
						</div>
						{#if status === 'success'}<div class="success-state">
								<b>✓</b>
								<h3>Оплату підтверджено</h3>
								<p>Демо-backend отримав статус SUCCESS.</p>
							</div>{:else}<button
								class="button button-primary full"
								type="button"
								disabled={status === 'processing'}
								onclick={simulatePayment}
								>{status === 'processing'
									? 'Очікуємо відповідь банку…'
									: 'Обрати банк і підтвердити'}</button
							>{/if}
					</div>
					<div class="status-list">
						<p>
							<span>Рахунок</span><b
								>{status === 'success'
									? 'Оплату підтверджено'
									: status === 'processing'
										? 'Перевірка backend'
										: 'Очікує оплати'}</b
							>
						</p>
						<p>
							<span>Банківський статус</span><b
								>{status === 'waiting' ? 'Не отримано' : status.toUpperCase()}</b
							>
						</p>
						<p>
							<span>ПРРО</span><b
								>{status === 'success' ? 'Чек створено у демо' : 'Очікує SUCCESS'}</b
							>
						</p>
					</div>
				{:else}<div class="placeholder">
						<b>QR</b><strong>Створіть тестовий рахунок</strong>
						<p>Тут з’явиться платіжний екран із сумою, призначенням та демонстраційним QR.</p>
					</div>{/if}
			</div>
		</div>
	</div>
</section>
