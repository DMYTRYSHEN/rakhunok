<script lang="ts">
	import { ChevronRight, Fuel, Minus, Plus } from '@lucide/svelte';

	let { onPay }: { onPay: (amount: number) => void } = $props();

	type FuelProduct = {
		id: 'a95' | 'diesel';
		label: string;
		code: string;
		price: number;
	};

	const dispensers = [
		{ id: '1', number: 1, status: 'available' },
		{ id: '2', number: 2, status: 'connected' },
		{ id: '3', number: 3, status: 'occupied' },
		{ id: '4', number: 4, status: 'available' }
	] as const;
	const products: FuelProduct[] = [
		{ id: 'a95', label: 'Бензин А-95', code: 'A95', price: 59.5 },
		{ id: 'diesel', label: 'Дизель', code: 'ДП', price: 57.9 }
	];

	let fuelStep = $state<1 | 2 | 3>(1);
	let dispenserId = $state('');
	let productId = $state<FuelProduct['id'] | ''>('');
	let inputMode = $state<'liters' | 'amount'>('liters');
	let inputValue = $state(20);

	const selectedDispenser = $derived(dispensers.find((item) => item.id === dispenserId));
	const selectedProduct = $derived(products.find((item) => item.id === productId));
	const amount = $derived(
		selectedProduct ? (inputMode === 'liters' ? inputValue * selectedProduct.price : inputValue) : 0
	);
	const liters = $derived(
		selectedProduct ? (inputMode === 'liters' ? inputValue : inputValue / selectedProduct.price) : 0
	);

	function selectDispenser(id: string): void {
		dispenserId = id;
		productId = '';
	}

	function selectMode(mode: 'liters' | 'amount'): void {
		inputMode = mode;
		inputValue = mode === 'liters' ? 20 : 1000;
	}

	function adjustValue(direction: -1 | 1): void {
		const step = inputMode === 'liters' ? 1 : 100;
		const minimum = inputMode === 'liters' ? 1 : 100;
		inputValue = Math.max(minimum, inputValue + direction * step);
	}
</script>

<section class="fuel-preview" aria-label="Демонстрація чекауту АЗС">
	<div class="fuel-progress" aria-label={`Крок ${fuelStep} з 3`}>
		{#each [1, 2, 3] as segment (segment)}
			<span class:active={segment <= fuelStep}></span>
		{/each}
	</div>

	{#if fuelStep === 1}
		<div class="fuel-heading">
			<span>Крок 1 з 3</span>
			<h3>Оберіть колонку</h3>
			<p>Номер вказаний на колонці поруч з авто.</p>
		</div>
		<div class="dispenser-grid">
			{#each dispensers as dispenser (dispenser.id)}
				<button
					class:selected={dispenser.id === dispenserId}
					class:connected={dispenser.status === 'connected'}
					disabled={dispenser.status === 'occupied'}
					onclick={() => selectDispenser(dispenser.id)}
					aria-label={`Колонка ${dispenser.number}, ${dispenser.status === 'connected' ? 'пістолет підключено' : dispenser.status === 'occupied' ? 'зайнята' : 'вільна'}`}
				>
					<strong>{dispenser.number}</strong>
					<small>
						{dispenser.status === 'connected'
							? 'Пістолет підключено'
							: dispenser.status === 'occupied'
								? 'Зайнята'
								: 'Вільна'}
					</small>
				</button>
			{/each}
		</div>
		<button class="fuel-primary" disabled={!dispenserId} onclick={() => (fuelStep = 2)}>
			Продовжити <ChevronRight size={15} />
		</button>
	{:else if fuelStep === 2}
		<button class="fuel-back" onclick={() => (fuelStep = 1)}>Назад до колонок</button>
		<div class="fuel-heading">
			<span>Крок 2 з 3 · колонка {selectedDispenser?.number}</span>
			<h3>Оберіть пальне</h3>
			<p>Продукти, доступні на обраній колонці.</p>
		</div>
		<div class="product-list">
			{#each products as product (product.id)}
				<button class:selected={product.id === productId} onclick={() => (productId = product.id)}>
					<span class="fuel-mark"><Fuel size={16} /></span>
					<span><strong>{product.label}</strong><small>{product.code}</small></span>
					<b>{product.price.toLocaleString('uk-UA')} ₴/л</b>
				</button>
			{/each}
		</div>
		<button class="fuel-primary" disabled={!productId} onclick={() => (fuelStep = 3)}>
			Продовжити <ChevronRight size={15} />
		</button>
	{:else}
		<button class="fuel-back" onclick={() => (fuelStep = 2)}>Назад до пального</button>
		<div class="fuel-heading">
			<span>Крок 3 з 3 · колонка {selectedDispenser?.number}</span>
			<h3>Скільки заправити?</h3>
			<p>{selectedProduct?.label} · {selectedProduct?.price.toLocaleString('uk-UA')} ₴/л</p>
		</div>
		<div class="mode-switch">
			<button class:active={inputMode === 'liters'} onclick={() => selectMode('liters')}
				>Літри</button
			>
			<button class:active={inputMode === 'amount'} onclick={() => selectMode('amount')}
				>Сума</button
			>
		</div>
		<div class="quantity">
			<button onclick={() => adjustValue(-1)} aria-label="Зменшити"><Minus size={16} /></button>
			<strong
				>{inputValue.toLocaleString('uk-UA')}
				<span>{inputMode === 'liters' ? 'л' : '₴'}</span></strong
			>
			<button onclick={() => adjustValue(1)} aria-label="Збільшити"><Plus size={16} /></button>
		</div>
		<div class="fuel-total">
			<span>{inputMode === 'liters' ? 'До сплати' : 'Орієнтовний об’єм'}</span>
			<strong>
				{inputMode === 'liters'
					? `${amount.toLocaleString('uk-UA')} ₴`
					: `${liters.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} л`}
			</strong>
		</div>
		<button class="fuel-primary" onclick={() => onPay(amount)}>
			Перейти до оплати · {amount.toLocaleString('uk-UA')} ₴
		</button>
	{/if}
</section>

<style>
	.fuel-preview {
		display: flex;
		min-height: 100%;
		flex-direction: column;
	}
	.fuel-progress {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin-bottom: 20px;
	}
	.fuel-progress span {
		height: 3px;
		border-radius: 2px;
		background: #3f3f46;
	}
	.fuel-progress span.active {
		background: #2563eb;
	}
	.fuel-heading span,
	.fuel-heading p {
		color: #a1a1aa;
		font-size: 10px;
	}
	.fuel-heading h3 {
		margin: 5px 0;
		font-size: 22px;
		letter-spacing: 0;
	}
	.fuel-heading p {
		margin: 0 0 18px;
	}
	.dispenser-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin-bottom: 18px;
	}
	.dispenser-grid button {
		display: grid;
		min-height: 88px;
		align-content: space-between;
		padding: 12px;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #18181b;
		color: #fff;
		text-align: left;
	}
	.dispenser-grid button strong {
		font-size: 25px;
	}
	.dispenser-grid button small {
		color: #a1a1aa;
		font-size: 9px;
	}
	.dispenser-grid button.connected small {
		color: #22c55e;
	}
	.dispenser-grid button.selected,
	.product-list button.selected {
		border-color: #3b82f6;
		box-shadow: inset 0 0 0 1px #3b82f6;
	}
	.dispenser-grid button:disabled {
		opacity: 0.4;
	}
	.fuel-primary {
		display: flex;
		width: 100%;
		min-height: 42px;
		align-items: center;
		justify-content: center;
		gap: 5px;
		margin-top: auto;
		border: 0;
		border-radius: 8px;
		background: #2563eb;
		color: #fff;
		font-size: 11px;
		font-weight: 800;
	}
	.fuel-primary:disabled {
		opacity: 0.4;
	}
	.fuel-back {
		align-self: flex-start;
		margin-bottom: 12px;
		padding: 0;
		border: 0;
		background: transparent;
		color: #60a5fa;
		font-size: 9px;
	}
	.product-list {
		display: grid;
		gap: 8px;
		margin-bottom: 18px;
	}
	.product-list button {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 8px;
		min-height: 60px;
		padding: 9px;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #18181b;
		color: #fff;
		text-align: left;
	}
	.product-list span:nth-child(2) {
		display: grid;
		gap: 2px;
	}
	.product-list small {
		color: #a1a1aa;
	}
	.product-list b {
		font-size: 10px;
	}
	.fuel-mark {
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		border-radius: 7px;
		background: #27272a;
	}
	.mode-switch {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
		padding: 4px;
		border-radius: 8px;
		background: #18181b;
	}
	.mode-switch button {
		min-height: 34px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #a1a1aa;
		font-size: 10px;
		font-weight: 700;
	}
	.mode-switch button.active {
		background: #27272a;
		color: #fff;
	}
	.quantity {
		display: grid;
		grid-template-columns: 38px 1fr 38px;
		align-items: center;
		gap: 8px;
		margin: 24px 0 16px;
		text-align: center;
	}
	.quantity button {
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: #27272a;
		color: #fff;
	}
	.quantity strong {
		font-size: 30px;
	}
	.quantity span {
		color: #a1a1aa;
		font-size: 14px;
	}
	.fuel-total {
		display: flex;
		justify-content: space-between;
		margin-bottom: 14px;
		padding: 11px;
		border-radius: 8px;
		background: #18181b;
		font-size: 10px;
	}
	.fuel-total span {
		color: #a1a1aa;
	}
	:global(.light) .fuel-progress span:not(.active) {
		background: #d4d4d8;
	}
	:global(.light) .fuel-heading span,
	:global(.light) .fuel-heading p,
	:global(.light) .dispenser-grid button small,
	:global(.light) .product-list small,
	:global(.light) .quantity span,
	:global(.light) .fuel-total span {
		color: #71717a;
	}
	:global(.light) .dispenser-grid button,
	:global(.light) .product-list button,
	:global(.light) .mode-switch,
	:global(.light) .fuel-total {
		border-color: #e4e4e7;
		background: #fff;
		color: #18181b;
	}
</style>
