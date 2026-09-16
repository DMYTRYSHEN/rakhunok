<script lang="ts">
	import type {
		FuelStationDispenser,
		FuelStationFlowData,
		FuelStationInputMode,
		FuelStationProduct
	} from '../../../../../src/lib/features/shared/fuel-station-flow.ts';
	import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';

	const flow = checkout.resolvedScenario.config?.flow_data as FuelStationFlowData;
	const snapshot = flow.snapshot!;
	const initialSelection = flow.selection;

	let step = $state<1 | 2 | 3>(1);
	let dispenserId = $state(initialSelection?.dispenser_id ?? '');
	let productId = $state(initialSelection?.product_id ?? '');
	let inputMode = $state<FuelStationInputMode>(
		initialSelection?.quantity.mode ?? flow.policy.default_input_mode
	);
	let inputValue = $state(initialSelection?.quantity.value ?? 0);

	const selectedDispenser = $derived(snapshot.dispensers.find((item) => item.id === dispenserId));
	const availableProducts = $derived(
		snapshot.products.filter(
			(product) =>
				product.status === 'available' && selectedDispenser?.product_ids.includes(product.id)
		)
	);
	const selectedProduct = $derived(availableProducts.find((item) => item.id === productId));
	const currentLimit = $derived(snapshot.limits.find((item) => item.mode === inputMode));
	const estimatedLiters = $derived(
		selectedProduct
			? inputMode === 'liters'
				? inputValue
				: inputValue / selectedProduct.price_per_unit
			: 0
	);
	const estimatedAmount = $derived(
		selectedProduct
			? inputMode === 'amount'
				? inputValue
				: inputValue * selectedProduct.price_per_unit
			: 0
	);
	const quantityIsValid = $derived(
		Boolean(currentLimit) &&
			inputValue >= (currentLimit?.min ?? Infinity) &&
			inputValue <= (currentLimit?.max ?? -Infinity)
	);
	const quoteMatches = $derived.by(() => {
		const quote = flow.quote;
		if (!quote || !initialSelection || !selectedProduct || !quantityIsValid) return false;
		return (
			quote.snapshot_id === snapshot.snapshot_id &&
			quote.revision === snapshot.revision &&
			quote.dispenser_id === dispenserId &&
			quote.product_id === productId &&
			quote.input_mode === inputMode &&
			quote.input_value === inputValue &&
			quote.currency === selectedProduct.currency &&
			quote.expires_at > new Date().toISOString() &&
			Math.abs(quote.estimated_amount - estimatedAmount) <= 0.01
		);
	});

	function selectDispenser(dispenser: FuelStationDispenser): void {
		if (!canSelectDispenser(dispenser)) return;
		dispenserId = dispenser.id;
		productId = '';
		vibrate(8);
	}

	function canSelectDispenser(dispenser: FuelStationDispenser): boolean {
		return flow.policy.require_connected_nozzle
			? dispenser.status === 'connected'
			: dispenser.status === 'available' || dispenser.status === 'connected';
	}

	function selectProduct(product: FuelStationProduct): void {
		productId = product.id;
		vibrate(8);
	}

	function selectMode(mode: FuelStationInputMode): void {
		inputMode = mode;
		const limit = snapshot.limits.find((item) => item.mode === mode);
		inputValue = limit?.min ?? 0;
		vibrate(6);
	}

	function adjustValue(direction: -1 | 1): void {
		if (!currentLimit) return;
		const next = inputValue + direction * currentLimit.step;
		inputValue = Math.min(currentLimit.max, Math.max(currentLimit.min, next));
		vibrate(6);
	}

	function next(): void {
		if (step === 1 && dispenserId) step = 2;
		else if (step === 2 && productId) {
			const limit = snapshot.limits.find((item) => item.mode === inputMode);
			if (inputValue === 0) inputValue = limit?.min ?? 0;
			step = 3;
		}
		vibrate(8);
	}

	function back(): void {
		if (step > 1) {
			step = (step - 1) as 1 | 2;
			vibrate(6);
		} else if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		}
	}

	function pay(): void {
		if (!quoteMatches || !flow.quote) return;
		checkout.keypadValue = String(flow.quote.estimated_amount).replace('.', ',');
		checkout.openPaymentSheet();
	}

	function statusLabel(dispenser: FuelStationDispenser): string {
		if (dispenser.status === 'connected') return 'Пістолет підключено';
		if (dispenser.status === 'available') return 'Вільна';
		if (dispenser.status === 'occupied') return 'Зайнята';
		return 'Недоступна';
	}
</script>

<div class="screen-content fuel-flow">
	<nav class="order-nav">
		<button class="order-nav-btn" onclick={back} aria-label="Назад">←</button>
		<div class="station-title">
			<strong>{snapshot.station.label}</strong>
			{#if snapshot.station.address}<span>{snapshot.station.address}</span>{/if}
		</div>
		<button class="order-nav-btn" onclick={() => checkout.openActionSheet()} aria-label="Дії"
			>•••</button
		>
	</nav>

	<div class="wizard-progress" aria-label={`Крок ${step} з 3`}>
		{#each [1, 2, 3] as segment (segment)}
			<div class="wp-seg" class:done={segment <= step}></div>
		{/each}
	</div>

	{#if step === 1}
		<section class="fuel-step">
			<div class="step-kicker">Крок 1 з 3</div>
			<h1>Оберіть колонку</h1>
			<p>Номер вказаний на корпусі колонки поруч з авто.</p>
			<div class="dispenser-grid">
				{#each snapshot.dispensers as dispenser (dispenser.id)}
					<button
						class="dispenser"
						class:selected={dispenser.id === dispenserId}
						class:connected={dispenser.status === 'connected'}
						disabled={!canSelectDispenser(dispenser)}
						onclick={() => selectDispenser(dispenser)}
					>
						<strong>{dispenser.number}</strong>
						<span>{statusLabel(dispenser)}</span>
					</button>
				{/each}
			</div>
			<button class="order-cta" disabled={!dispenserId} onclick={next}>Продовжити</button>
		</section>
	{:else if step === 2}
		<section class="fuel-step">
			<div class="step-kicker">Крок 2 з 3 · колонка {selectedDispenser?.number}</div>
			<h1>Оберіть пальне</h1>
			<p>Показуємо лише продукти, доступні на обраній колонці.</p>
			<div class="product-list">
				{#each availableProducts as product (product.id)}
					<button
						class="product"
						class:selected={product.id === productId}
						onclick={() => selectProduct(product)}
					>
						<span><strong>{product.label}</strong><small>{product.code}</small></span>
						<span class="price">{formatNumber(product.price_per_unit)} ₴/л</span>
					</button>
				{/each}
			</div>
			<button class="order-cta" disabled={!productId} onclick={next}>Продовжити</button>
		</section>
	{:else}
		<section class="fuel-step">
			<div class="step-kicker">Крок 3 з 3 · колонка {selectedDispenser?.number}</div>
			<h1>Скільки заправити?</h1>
			<p>{selectedProduct?.label} за {formatNumber(selectedProduct?.price_per_unit ?? 0)} ₴/л</p>

			<div class="mode-switch">
				{#each flow.policy.allowed_input_modes as mode (mode)}
					<button class:active={mode === inputMode} onclick={() => selectMode(mode)}>
						{mode === 'liters' ? 'Літри' : 'Сума'}
					</button>
				{/each}
			</div>

			<div class="quantity-control">
				<button onclick={() => adjustValue(-1)} aria-label="Зменшити">−</button>
				<div>
					<strong>{formatNumber(inputValue)}</strong>
					<span>{inputMode === 'liters' ? 'л' : '₴'}</span>
				</div>
				<button onclick={() => adjustValue(1)} aria-label="Збільшити">+</button>
			</div>

			<div class="estimate">
				<span>{inputMode === 'liters' ? 'Орієнтовна сума' : 'Орієнтовний об’єм'}</span>
				<strong>
					{inputMode === 'liters'
						? `${formatNumber(estimatedAmount)} ₴`
						: `${formatNumber(estimatedLiters)} л`}
				</strong>
			</div>

			{#if !quoteMatches}
				<div class="quote-state" role="status">
					Очікуємо актуальну пропозицію від АЗС для цього вибору
				</div>
			{/if}
			<button class="order-cta" disabled={!quoteMatches} onclick={pay}>
				{quoteMatches && flow.quote
					? `Перейти до оплати · ${formatNumber(flow.quote.estimated_amount)} ₴`
					: 'Очікуємо ціну АЗС'}
			</button>
		</section>
	{/if}
</div>

<style>
	.fuel-flow {
		color: var(--order-text);
	}
	.station-title {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
	}
	.station-title strong {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 14px;
	}
	.station-title span {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--order-text-dim);
		font-size: 11px;
	}
	.fuel-step {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.step-kicker {
		margin-bottom: 7px;
		color: var(--order-text-dim);
		font-size: 12px;
		font-weight: 700;
	}
	h1 {
		margin: 0 0 7px;
		font-size: 27px;
		line-height: 1.1;
		letter-spacing: 0;
	}
	p {
		margin: 0 0 22px;
		color: var(--order-text-dim);
		font-size: 13px;
		line-height: 1.45;
	}
	.dispenser-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 22px;
	}
	.dispenser {
		min-height: 112px;
		padding: 16px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--order-surface);
		color: var(--order-text);
		text-align: left;
	}
	.dispenser strong {
		display: block;
		margin-bottom: 19px;
		font-size: 30px;
	}
	.dispenser span {
		color: var(--order-text-dim);
		font-size: 12px;
		font-weight: 600;
	}
	.dispenser.connected span {
		color: var(--accent);
	}
	.dispenser.selected,
	.product.selected {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.dispenser:disabled {
		opacity: 0.42;
	}
	.product-list {
		display: grid;
		gap: 9px;
		margin-bottom: 22px;
	}
	.product {
		display: flex;
		min-height: 70px;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--order-surface);
		color: var(--order-text);
		text-align: left;
	}
	.product strong,
	.product small {
		display: block;
	}
	.product strong {
		margin-bottom: 4px;
		font-size: 16px;
	}
	.product small {
		color: var(--order-text-dim);
	}
	.price {
		font-size: 14px;
		font-weight: 700;
	}
	.mode-switch {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
		padding: 4px;
		border-radius: 8px;
		background: var(--order-surface);
	}
	.mode-switch button {
		height: 40px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--order-text-dim);
		font-weight: 700;
	}
	.mode-switch button.active {
		background: var(--order-surface-2);
		color: var(--order-text);
	}
	.quantity-control {
		display: grid;
		grid-template-columns: 52px 1fr 52px;
		align-items: center;
		gap: 12px;
		margin: 26px 0 18px;
		text-align: center;
	}
	.quantity-control button {
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: 50%;
		background: var(--order-surface);
		color: var(--order-text);
		font-size: 27px;
	}
	.quantity-control strong {
		font-size: 44px;
		font-variant-numeric: tabular-nums;
	}
	.quantity-control span {
		margin-left: 6px;
		color: var(--order-text-dim);
		font-size: 18px;
	}
	.estimate {
		display: flex;
		justify-content: space-between;
		padding: 16px;
		border-radius: 8px;
		background: var(--order-surface);
		font-size: 13px;
	}
	.estimate span {
		color: var(--order-text-dim);
	}
	.quote-state {
		margin: 12px 0;
		color: var(--order-text-dim);
		font-size: 12px;
		line-height: 1.4;
		text-align: center;
	}
	@media (max-width: 360px) {
		.dispenser-grid {
			grid-template-columns: 1fr;
		}
		.dispenser {
			min-height: 84px;
		}
		.station-title strong,
		.station-title span {
			max-width: 180px;
		}
	}
</style>
