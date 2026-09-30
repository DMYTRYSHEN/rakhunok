<script lang="ts">
	import { ArrowLeft, ArrowRight, Check, Fuel, Landmark, RotateCcw } from '@lucide/svelte';

	const products = [
		{ id: 'a95', label: 'А-95', price: 60, unit: 'л' },
		{ id: 'diesel', label: 'Дизель', price: 58, unit: 'л' },
		{ id: 'electric', label: 'Електрозарядка', price: 16, unit: 'кВт·год' }
	];
	const dispensers = [
		{ id: '1', label: 'Колонка 1', products: ['a95', 'diesel'] },
		{ id: '2', label: 'Колонка 2', products: ['a95', 'diesel'] },
		{ id: '3', label: 'Зарядний пост 3', products: ['electric'] }
	];
	let stage = $state<'order' | 'bank' | 'paid'>('order');
	let dispenserId = $state('');
	let productId = $state('');
	let mode = $state<'amount' | 'quantity'>('amount');
	let value = $state<number | undefined>();
	let bank = $state('');
	const dispenser = $derived(dispensers.find((item) => item.id === dispenserId));
	const availableProducts = $derived(products.filter((item) => dispenser?.products.includes(item.id)));
	const product = $derived(availableProducts.find((item) => item.id === productId));
	const maximum = $derived(mode === 'amount' ? 10000 : product?.unit === 'л' ? 150 : 200);
	const valid = $derived(Boolean(product) && value !== undefined && Number.isFinite(value) && value >= 1 && value <= maximum && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001);
	const amount = $derived(valid && product && value !== undefined ? Math.round((mode === 'amount' ? value : value * product.price) * 100) / 100 : 0);
	const quantity = $derived(valid && product && value !== undefined ? mode === 'quantity' ? value : amount / product.price : 0);
	const format = (number: number) => number.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	function reset() {
		stage = 'order';
		dispenserId = '';
		productId = '';
		mode = 'amount';
		value = undefined;
		bank = '';
	}
</script>

<div class="fuel-demo">
	<div class="demo-top"><strong>Rahunok</strong><span>ДЕМО АЗК</span></div>
	<Fuel size={28} />
	<h3>Заправка без зайвих кроків</h3>
	{#if stage === 'order'}
		<form onsubmit={(event) => { event.preventDefault(); if (valid) stage = 'bank'; }}>
			<label for="fuel-dispenser">Колонка або зарядний пост</label>
			<select id="fuel-dispenser" bind:value={dispenserId} required onchange={() => { productId = ''; value = undefined; }}>
				<option value="" disabled>Оберіть колонку</option>
				{#each dispensers as item (item.id)}<option value={item.id}>{item.label}</option>{/each}
			</select>
			<label for="fuel-product">Пальне або зарядка</label>
			<select id="fuel-product" bind:value={productId} required disabled={!dispenser} onchange={() => (value = undefined)}>
				<option value="" disabled>Оберіть продукт</option>
				{#each availableProducts as item (item.id)}<option value={item.id}>{item.label}</option>{/each}
			</select>
			{#if product}
				<p class="price">Демоціна: {format(product.price)} ₴ / {product.unit}</p>
				<div class="input-modes" role="group" aria-label="Спосіб введення">
					<button type="button" aria-pressed={mode === 'amount'} onclick={() => { mode = 'amount'; value = undefined; }}>Сума, ₴</button>
					<button type="button" aria-pressed={mode === 'quantity'} onclick={() => { mode = 'quantity'; value = undefined; }}>{product.unit === 'л' ? 'Літри' : 'кВт·год'}</button>
				</div>
				<label for="fuel-value">{mode === 'amount' ? 'Сума, ₴' : `Обсяг, ${product.unit}`}</label>
				<input id="fuel-value" type="number" inputmode="decimal" min="1" max={maximum} step="0.01" required bind:value aria-describedby="fuel-limit" />
				<p id="fuel-limit" class="price">Від 1 до {maximum} {mode === 'amount' ? '₴' : product.unit}</p>
			{/if}
			<div class="summary" aria-live="polite"><span>До сплати</span><strong>{format(amount)} ₴</strong></div>
			{#if valid}<p class="price">Орієнтовний обсяг: {format(quantity)} {product?.unit}</p>{/if}
			<button class="primary" type="submit" disabled={!valid}>Обрати банк <ArrowRight size={17} /></button>
		</form>
	{:else}
		<p class="selection">{dispenser?.label} · {product?.label}</p>
		<p class="quantity">{format(quantity)} {product?.unit}</p>
		<p class="total">{format(amount)} ₴</p>
		{#if stage === 'bank'}
			<div class="banks" role="group" aria-label="Банк покупця">
				{#each ['monobank', 'ПриватБанк', 'А-Банк'] as name (name)}
					<button type="button" aria-pressed={bank === name} onclick={() => (bank = name)}><Landmark size={17} />{name}{#if bank === name}<Check size={16} />{/if}</button>
				{/each}
			</div>
			<button class="primary" type="button" disabled={!bank || !valid} onclick={() => { if (bank && valid) stage = 'paid'; }}>Оплатити в демо <ArrowRight size={17} /></button>
			<button class="secondary" type="button" onclick={() => { stage = 'order'; bank = ''; }}><ArrowLeft size={16} /> Змінити замовлення</button>
		{:else}
			<div class="confirmation" role="status"><Check size={30} /><strong>Сплачено · демо</strong><p>Умовну оплату підтверджено. Заправка чи заряджання не запускаються.</p></div>
			<button class="secondary" type="button" onclick={reset}><RotateCcw size={16} /> Ще раз</button>
		{/if}
	{/if}
	<p class="disclaimer">Ілюстративні ціни та оплата. Без реальних переказів і керування колонкою.</p>
</div>

<style>
	.fuel-demo { min-width: 0; width: 100%; max-width: 350px; box-sizing: border-box; justify-self: center; align-self: start; padding: 24px; border: 1px solid #dce1dc; border-radius: 8px; background: white; color: #172b24; text-align: center; }
	.demo-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.demo-top span { font-size: 10px; color: #65716a; }
	h3 { margin: 12px 0 24px; font-size: 19px; line-height: 1.35; }
	form { text-align: left; }
	label { display: block; margin: 16px 0 8px; font-size: 12px; font-weight: 600; }
	select, input { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; padding: 10px; border: 1px solid #aab8af; border-radius: 4px; background: white; color: #172b24; font: inherit; font-size: 14px; }
	button { font: inherit; cursor: pointer; border-radius: 4px; }
	button:disabled { opacity: .45; cursor: not-allowed; }
	button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #edaf5f; outline-offset: 3px; }
	.price, .selection, .quantity { font-size: 12px; line-height: 1.6; color: #56635b; }
	.input-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
	.input-modes button { min-height: 44px; border: 1px solid #aab8af; background: white; color: #172b24; font-size: 13px; }
	button[aria-pressed='true'] { background: #eef5e8; border-color: #719164; }
	.summary { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e9ece8; font-size: 14px; }
	.summary strong, .total { font-variant-numeric: tabular-nums; }
	.primary, .secondary { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; min-height: 48px; padding: 10px; border: 0; font-size: 13px; font-weight: 600; }
	.primary { margin-top: 18px; background: #203e32; color: white; }
	.secondary { margin-top: 10px; background: transparent; color: #234c3d; }
	.total { margin: 12px 0 24px; font-size: 30px; font-weight: 600; overflow-wrap: anywhere; }
	.banks { display: grid; gap: 6px; }
	.banks button { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px; border: 1px solid #dce1dc; color: #172b24; background: white; font-size: 12px; }
	.banks button[aria-pressed='true'] { background: #eef5e8; border-color: #719164; }
	.confirmation { display: grid; justify-items: center; gap: 12px; color: #26725a; }
	.confirmation p { font-size: 12px; line-height: 1.6; color: #56635b; }
	.disclaimer { border-top: 1px solid #e9ece8; padding-top: 18px; margin: 18px 0 0; color: #65716a; font-size: 10px; line-height: 1.6; }
</style>