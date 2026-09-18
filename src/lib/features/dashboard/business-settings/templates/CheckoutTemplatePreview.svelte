<script lang="ts">
	import {
		ArrowLeft,
		Check,
		ChevronRight,
		CreditCard,
		Gift,
		Heart,
		Info,
		MapPin,
		ReceiptText,
		ShieldCheck,
		Star,
		Truck,
		Users,
		X
	} from '@lucide/svelte';
	import type { CheckoutScenarioConfig } from '$lib/features/shared/checkout-scenario-config';
	import FuelStationTemplatePreview from './FuelStationTemplatePreview.svelte';
	import AutoServiceTemplatePreview from './AutoServiceTemplatePreview.svelte';
	import {
		buildCheckoutPreviewModel,
		type CheckoutPreviewStep,
		type CheckoutTemplateScenario
	} from './checkout-template-preview';

	let {
		scenario,
		config
	}: {
		scenario: CheckoutTemplateScenario;
		config: Partial<CheckoutScenarioConfig>;
	} = $props();

	let step = $state<CheckoutPreviewStep>('checkout');
	let enteredAmount = $state(200);
	let selectedTip = $state(10);
	let promoApplied = $state(false);
	let promoCode = $state('');
	let deliveryStep = $state<'overview' | 'recipient'>('overview');
	let paymentSheetOpen = $state(false);
	let paymentSheetView = $state<'banks' | 'methods'>('banks');
	let selectedBank = $state(0);
	let loyaltyApplied = $state(false);
	let fuelStationAmount = $state(1190);
	let autoServiceAmount = $state(200);

	const previewBanks = [
		{ name: 'Monobank', code: 'UNJS', background: 'linear-gradient(135deg, #050505, #343438)' },
		{ name: 'Приват24', code: 'PBAN', background: 'linear-gradient(135deg, #2e7d32, #1b5e20)' },
		{ name: 'Sense Bank', code: 'SENS', background: 'linear-gradient(135deg, #0d3264, #1a4f94)' }
	] as const;

	const model = $derived(buildCheckoutPreviewModel(scenario, config));
	const displayedAmount = $derived(model.isOpenAmount ? enteredAmount : model.amount);
	const discount = $derived(
		promoApplied && model.config.allow_promo ? Number(model.config.promo_discount ?? 0) : 0
	);
	const total = $derived(Math.max(0, displayedAmount - discount));
	const paymentAmount = $derived(
		scenario === 'fuel_station'
			? fuelStationAmount
			: scenario === 'vertical_auto' || scenario === 'engine_book'
				? autoServiceAmount
				: total
	);
	const theme = $derived(model.config.theme === 'light' ? 'light' : 'dark');

	function selectStep(next: CheckoutPreviewStep): void {
		if (next === 'payment') {
			step = 'checkout';
			paymentSheetView = 'banks';
			paymentSheetOpen = true;
			return;
		}

		paymentSheetOpen = false;
		step = next;
	}

	function closePaymentSheet(): void {
		if (paymentSheetView === 'methods') {
			paymentSheetView = 'banks';
			return;
		}

		paymentSheetOpen = false;
	}

	function completePayment(): void {
		paymentSheetOpen = false;
		step = 'success';
	}

	function openFuelStationPayment(amount: number): void {
		fuelStationAmount = amount;
		selectStep('payment');
	}

	function openAutoServicePayment(amount: number): void {
		autoServiceAmount = amount;
		selectStep('payment');
	}
</script>

<section class="preview-shell" aria-label="Попередній перегляд чекауту">
	<div class="step-tabs" aria-label="Етап оплати">
		<button class:active={step === 'checkout'} onclick={() => selectStep('checkout')}>Чекаут</button
		>
		<button class:active={paymentSheetOpen} onclick={() => selectStep('payment')}>Оплата</button>
		<button class:active={step === 'success'} onclick={() => selectStep('success')}>Готово</button>
	</div>

	<div class="phone" class:light={theme === 'light'}>
		<div class="phone-bar"><span></span></div>
		<header>
			<button class="icon-button" aria-label="Назад"><ArrowLeft size={16} /></button>
			<div class="merchant-mark">R</div>
			<strong>{model.merchantName}</strong>
			<div class="secure"><ShieldCheck size={13} /> Захищено</div>
		</header>

		<main class:dimmed={paymentSheetOpen} class:fuel-main={scenario === 'fuel_station' || scenario === 'vertical_auto' || scenario === 'engine_book'}>
			{#if step === 'checkout'}
				{#if scenario === 'fuel_station'}
					<FuelStationTemplatePreview onPay={openFuelStationPayment} />
				{:else if scenario === 'vertical_auto' || scenario === 'engine_book'}
					<AutoServiceTemplatePreview onPay={openAutoServicePayment} />
				{:else}
					<section class="hero">
						<span class="eyebrow">{model.contextLabel}</span>
						{#if model.isOpenAmount}
							<label class="amount-input">
								<input
									type="number"
									min="1"
									bind:value={enteredAmount}
									aria-label="Сума до сплати"
								/>
								<span>₴</span>
							</label>
						{:else}
							<strong class="amount">{displayedAmount.toLocaleString('uk-UA')} ₴</strong>
						{/if}
						<span class="status"><i></i> Очікує на оплату</span>
					</section>

					{#if model.isOpenAmount && model.quickAmounts.length}
						<div class="chips amounts">
							{#each model.quickAmounts as amount (amount)}
								<button
									class:active={enteredAmount === amount}
									onclick={() => (enteredAmount = amount)}>{amount} ₴</button
								>
							{/each}
						</div>
					{/if}

					{#if scenario === 'tips'}
						<section class="feature feature-center">
							<div class="waiter">О</div>
							<strong>Офіціант Олександр</strong>
							<span>Дякую за ваш візит</span>
							<div class="chips">
								{#each model.tipPresets as tip (tip)}
									<button class:active={selectedTip === tip} onclick={() => (selectedTip = tip)}
										>+{tip} ₴</button
									>
								{/each}
							</div>
						</section>
					{:else}
						<section class="summary">
							<div>
								<span>{scenario === 'table' ? 'Замовлення столика' : 'Замовлення'}</span><strong
									>{displayedAmount.toLocaleString('uk-UA')} ₴</strong
								>
							</div>
							{#if scenario === 'delivery' && model.config.allow_delivery}
								<div><span>Доставка · Нова пошта</span><strong>за тарифом</strong></div>
							{/if}
							{#if discount > 0}
								<div class="discount">
									<span>Знижка за промокодом</span><strong
										>−{discount.toLocaleString('uk-UA')} ₴</strong
									>
								</div>
							{/if}
							<div class="summary-total">
								<span>До сплати</span><strong>{total.toLocaleString('uk-UA')} ₴</strong>
							</div>
						</section>
					{/if}

					{#if scenario === 'delivery' && model.config.allow_delivery}
						<section class="feature">
							<div class="feature-title">
								<Truck size={16} /><strong>Доставка Новою поштою</strong>
							</div>
							{#if deliveryStep === 'overview'}
								<button class="row-action" onclick={() => (deliveryStep = 'recipient')}
									><span>Оформити отримувача</span><ChevronRight size={15} /></button
								>
							{:else}
								<div class="mini-form">
									<span>Ім’я та прізвище</span><span>+380 __ ___ __ __</span><span
										><MapPin size={13} /> Відділення або поштомат</span
									>
								</div>
							{/if}
						</section>
					{/if}

					{#if scenario === 'table' && model.config.allow_split}
						<section class="feature">
							<div class="feature-title">
								<Users size={16} /><strong>Розділити чек між друзями</strong>
							</div>
							<span>Порівну на 2 гостей · по 430 ₴</span>
						</section>
					{/if}
					{#if scenario === 'table' && model.config.allow_tips}
						<section class="feature">
							<div class="feature-title"><Heart size={16} /><strong>Чайові офіціанту</strong></div>
							<div class="chips">
								{#each model.tipPresets as tip (tip)}<button>{tip}%</button>{/each}
							</div>
						</section>
					{/if}
					{#if model.config.allow_upsell}
						<section class="feature">
							<div class="feature-title">
								<Info size={16} /><strong>Додати до замовлення</strong>
							</div>
							<button class="row-action"><span>Десерт дня · +120 ₴</span><span>+</span></button>
						</section>
					{/if}
					{#if model.config.allow_roundup}
						<section class="feature">
							<div class="feature-title">
								<Heart size={16} /><strong
									>Округлити до {Math.ceil(total / 10) * 10} ₴ на дрони ЗСУ</strong
								>
							</div>
						</section>
					{/if}
					{#if model.config.allow_loyalty}
						<section class="feature">
							<button class="row-action"
								><span class="feature-title"><Gift size={16} /> Картка лояльності</span><span
									>Сканер</span
								></button
							>
						</section>
					{/if}
					{#if scenario === 'table' && model.config.allow_compliance_card}
						<section class="feature compliance">
							<div class="feature-title">
								<ReceiptText size={16} /><strong>Фіскальний розрахунок</strong>
							</div>
							<span>Оплата продавцю та чайові розподіляються окремо</span>
						</section>
					{/if}

					<button class="primary" onclick={() => selectStep('payment')}
						>{scenario === 'tips'
							? `${model.ctaText} ${selectedTip} ₴`
							: model.ctaText}<ChevronRight size={16} /></button
					>
				{/if}
			{:else}
				<section class="success">
					<div class="success-mark"><Check size={30} /></div>
					<h3>Оплату успішно проведено</h3>
					<p>{model.contextLabel}</p>
				</section>
				{#if model.config.allow_nps_review}
					<section class="feature feature-center">
						<strong>Як вам обслуговування?</strong>
						<div class="stars" aria-label="Оцінка сервісу">
							{#each [1, 2, 3, 4, 5] as star (star)}<button aria-label={`${star} з 5`}
									><Star size={22} /></button
								>{/each}
						</div>
					</section>
				{/if}
				<button class="secondary" onclick={() => selectStep('checkout')}>Готово</button>
			{/if}
		</main>

		{#if paymentSheetOpen}
			<button
				class="sheet-backdrop"
				aria-label="Закрити вибір способу оплати"
				onclick={() => (paymentSheetOpen = false)}
			></button>
			<div class="payment-sheet" role="dialog" aria-modal="true" aria-label="Вибір способу оплати">
				<div class="sheet-handle"></div>
				{#if paymentSheetView === 'banks'}
					<div class="sheet-header">
						<button class="sheet-icon" onclick={closePaymentSheet} aria-label="Закрити"
							><X size={15} /></button
						>
						<div>
							<strong>{model.merchantName}</strong><span
								><ShieldCheck size={10} /> Захищено Rahunok · NBU 003</span
							>
						</div>
						<span></span>
					</div>
					<div class="sheet-amount">
						<strong
							>{(scenario === 'tips' ? selectedTip : paymentAmount).toLocaleString('uk-UA')} ₴</strong
						>
						<span>Без комісії</span>
					</div>
					<div class="bank-carousel" aria-label="Доступні банки">
						{#each previewBanks as bank, index (bank.code)}
							<button
								class:active={selectedBank === index}
								style={`--bank-background: ${bank.background}`}
								onclick={() => (selectedBank = index)}
								aria-label={`Обрати ${bank.name}`}
							>
								<span>{bank.name}</span><strong>{bank.code}</strong><small>A2A · NBU 003</small>
							</button>
						{/each}
					</div>
					<div class="sheet-actions">
						<button class="confirm-bank" onclick={completePayment}
							>Ви підтвердите платіж у застосунку банку</button
						>
						{#if model.config.show_other_banks}
							<button class="other-methods" onclick={() => (paymentSheetView = 'methods')}>
								<span><CreditCard size={15} /> Інші способи оплати та промокод</span><ChevronRight
									size={14}
								/>
							</button>
						{/if}
					</div>
				{:else}
					<div class="methods-header">
						<button onclick={() => (paymentSheetView = 'banks')}
							><ArrowLeft size={14} /> Pay by Bank</button
						>
						<strong>Інші варіанти</strong>
						<button
							class="sheet-icon"
							onclick={() => (paymentSheetView = 'banks')}
							aria-label="Закрити"><X size={15} /></button
						>
					</div>
					<div class="methods-content">
						{#if model.config.allow_promo}
							<section class="method-group">
								<strong>Купон або промокод</strong>
								<div class="coupon-box">
									<input
										bind:value={promoCode}
										aria-label="Промокод"
										placeholder="Введіть промокод"
									/>
									<button disabled={!promoCode.trim()} onclick={() => (promoApplied = true)}
										>{promoApplied ? 'Застосовано' : 'Застосувати'}</button
									>
								</div>
								{#if promoApplied}<span class="coupon-success"
										>Знижку {model.config.promo_discount ?? 0} ₴ активовано</span
									>{/if}
							</section>
						{/if}
						{#if model.config.allow_loyalty}
							<section class="method-group">
								<strong>Картка лояльності та бонуси</strong>
								<button class="method-row" onclick={() => (loyaltyApplied = !loyaltyApplied)}>
									<span class="method-mark loyalty"
										>{loyaltyApplied ? '✓' : ''}<Gift size={16} /></span
									>
									<span>
										<b>{loyaltyApplied ? 'Rahunok Bonus' : 'Зісканувати картку лояльності'}</b>
										<small
											>{loyaltyApplied
												? '120 ₴ бонусів · налаштувати'
												: 'Камера, штрих-код або номер картки'}</small
										>
									</span>
									<ChevronRight size={13} />
								</button>
							</section>
						{/if}
						<section class="method-group">
							<strong>Додаткові способи</strong>
							<button class="method-row" onclick={completePayment}
								><span class="method-mark apple">Apple</span><span
									><b>Apple Pay</b><small>Швидка оплата через Apple Wallet</small></span
								><ChevronRight size={13} /></button
							>
							<button class="method-row" onclick={completePayment}
								><span class="method-mark google">G</span><span
									><b>Google Pay</b><small>Швидка оплата через Google Wallet</small></span
								><ChevronRight size={13} /></button
							>
							<button class="method-row" onclick={completePayment}
								><span class="method-mark"><CreditCard size={16} /></span><span
									><b>Банківська картка</b><small>Visa, Mastercard · введення реквізитів</small
									></span
								><ChevronRight size={13} /></button
							>
						</section>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.preview-shell {
		--accent: #2563eb;
		display: flex;
		min-height: 100%;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: #f4f4f5;
		color: #18181b;
	}
	.step-tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		width: min(100%, 340px);
		padding: 3px;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		background: #fff;
	}
	.step-tabs button {
		min-height: 30px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #71717a;
		font-size: 11px;
		font-weight: 700;
	}
	.step-tabs button.active {
		background: #18181b;
		color: #fff;
	}
	.phone {
		position: relative;
		width: min(100%, 340px);
		height: min(680px, calc(90vh - 92px));
		min-height: 520px;
		overflow: hidden;
		border: 7px solid #18181b;
		border-radius: 34px;
		background: #09090b;
		color: #f4f4f5;
		box-shadow: 0 24px 60px rgba(24, 24, 27, 0.2);
	}
	.phone.light {
		background: #fafafa;
		color: #18181b;
	}
	.phone-bar {
		height: 22px;
		display: flex;
		justify-content: center;
		padding-top: 7px;
	}
	.phone-bar span {
		width: 68px;
		height: 4px;
		border-radius: 4px;
		background: #3f3f46;
	}
	header {
		display: grid;
		grid-template-columns: 30px 28px 1fr auto;
		align-items: center;
		gap: 7px;
		padding: 4px 14px 12px;
		border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
	}
	header strong {
		overflow: hidden;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.icon-button {
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
		border-radius: 50%;
		background: transparent;
		color: inherit;
	}
	.merchant-mark {
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		font-weight: 900;
	}
	.secure {
		display: flex;
		align-items: center;
		gap: 3px;
		color: #22c55e;
		font-size: 8px;
		font-weight: 700;
	}
	main {
		height: calc(100% - 62px);
		overflow-y: auto;
		padding: 14px;
		scrollbar-width: thin;
	}
	main.dimmed {
		overflow: hidden;
	}
	.hero,
	.success {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		padding: 12px 0 16px;
		text-align: center;
	}
	.eyebrow,
	.feature > span,
	.feature-center > span,
	.success p {
		color: #a1a1aa;
		font-size: 10px;
	}
	.light .eyebrow,
	.light .feature > span,
	.light .feature-center > span,
	.light .success p {
		color: #71717a;
	}
	.amount {
		font-size: 31px;
		line-height: 1;
	}
	.amount-input {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.amount-input input {
		width: 130px;
		border: 0;
		border-bottom: 1px solid #3f3f46;
		background: transparent;
		color: inherit;
		text-align: right;
		font-size: 30px;
		font-weight: 800;
		outline: none;
	}
	.amount-input span {
		font-size: 22px;
		font-weight: 800;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 5px;
		color: #a1a1aa;
		font-size: 9px;
	}
	.status i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
	}
	.summary,
	.feature {
		margin-bottom: 8px;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #18181b;
	}
	.light .summary,
	.light .feature {
		border-color: #e4e4e7;
		background: #fff;
	}
	.summary {
		padding: 5px 11px;
	}
	.summary > div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 0;
		font-size: 10px;
	}
	.summary > div + div {
		border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
	}
	.summary-total {
		font-size: 12px !important;
	}
	.discount strong {
		color: #22c55e;
	}
	.feature {
		padding: 10px 11px;
	}
	.feature-title {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
	}
	.feature-title + span {
		display: block;
		margin-top: 4px;
		padding-left: 23px;
	}
	.feature-center {
		align-items: center;
		text-align: center;
	}
	.feature-center strong,
	.feature-center span {
		display: block;
	}
	.waiter {
		display: grid;
		width: 38px;
		height: 38px;
		margin: 0 auto 6px;
		place-items: center;
		border-radius: 50%;
		background: #f59e0b;
		color: #18181b;
		font-weight: 900;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}
	.chips.amounts {
		justify-content: center;
		margin: -6px 0 10px;
	}
	.chips button {
		min-height: 28px;
		padding: 0 10px;
		border: 1px solid #3f3f46;
		border-radius: 16px;
		background: transparent;
		color: inherit;
		font-size: 10px;
		font-weight: 700;
	}
	.chips button.active {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
	}
	.row-action {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		margin-top: 7px;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 10px;
	}
	.mini-form {
		display: grid;
		gap: 5px;
		margin-top: 8px;
	}
	.mini-form span {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 7px;
		border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
		border-radius: 6px;
		color: #a1a1aa;
		font-size: 9px;
	}
	.compliance {
		border-color: #2563eb66;
	}
	.primary,
	.secondary {
		display: flex;
		width: 100%;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 0;
		border-radius: 8px;
		font-size: 11px;
		font-weight: 800;
	}
	.primary {
		background: var(--accent);
		color: #fff;
	}
	.secondary {
		background: #27272a;
		color: #fff;
	}
	.light .secondary {
		background: #e4e4e7;
		color: #18181b;
	}
	.success {
		padding-top: 52px;
	}
	.success-mark {
		display: grid;
		width: 58px;
		height: 58px;
		place-items: center;
		border-radius: 50%;
		background: #22c55e;
		color: white;
	}
	.success h3 {
		margin: 8px 0 0;
		font-size: 17px;
	}
	.stars {
		display: flex;
		justify-content: center;
		gap: 5px;
		margin-top: 10px;
	}
	.stars button {
		border: 0;
		background: transparent;
		color: #f59e0b;
	}
	.sheet-backdrop {
		position: absolute;
		z-index: 10;
		inset: 0;
		width: 100%;
		border: 0;
		background: rgba(0, 0, 0, 0.58);
	}
	.payment-sheet {
		position: absolute;
		z-index: 11;
		right: 0;
		bottom: 0;
		left: 0;
		max-height: 88%;
		overflow: hidden;
		border-radius: 18px 18px 0 0;
		background: #f8f8fa;
		color: #18181b;
		box-shadow: 0 -18px 42px rgba(0, 0, 0, 0.28);
	}
	.sheet-handle {
		width: 36px;
		height: 4px;
		margin: 7px auto 3px;
		border-radius: 3px;
		background: #d4d4d8;
	}
	.sheet-header {
		display: grid;
		grid-template-columns: 30px 1fr 30px;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 8px;
		text-align: center;
	}
	.sheet-header div {
		display: grid;
		gap: 2px;
	}
	.sheet-header strong {
		font-size: 11px;
	}
	.sheet-header span {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: #71717a;
		font-size: 7px;
	}
	.sheet-icon {
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border: 1px solid #e4e4e7;
		border-radius: 50%;
		background: #fff;
		color: #27272a;
	}
	.sheet-amount {
		display: grid;
		justify-items: center;
		gap: 3px;
		padding: 3px 0 10px;
	}
	.sheet-amount strong {
		font-size: 24px;
	}
	.sheet-amount span {
		padding: 3px 7px;
		border-radius: 10px;
		background: #dcfce7;
		color: #15803d;
		font-size: 8px;
		font-weight: 800;
	}
	.bank-carousel {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 2px 36px 11px;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.bank-carousel button {
		display: grid;
		flex: 0 0 194px;
		min-height: 105px;
		align-content: space-between;
		padding: 12px;
		border: 2px solid transparent;
		border-radius: 12px;
		background: var(--bank-background);
		color: #fff;
		text-align: left;
		scroll-snap-align: center;
		opacity: 0.7;
		transform: scale(0.94);
	}
	.bank-carousel button.active {
		border-color: #60a5fa;
		opacity: 1;
		transform: scale(1);
	}
	.bank-carousel span {
		font-size: 10px;
		font-weight: 800;
	}
	.bank-carousel strong {
		justify-self: end;
		font-size: 16px;
	}
	.bank-carousel small {
		font-size: 7px;
		opacity: 0.72;
	}
	.sheet-actions {
		display: grid;
		gap: 7px;
		padding: 0 12px 14px;
	}
	.confirm-bank {
		min-height: 39px;
		border: 0;
		border-radius: 8px;
		background: #18181b;
		color: #fff;
		font-size: 9px;
		font-weight: 800;
	}
	.other-methods {
		display: flex;
		min-height: 37px;
		align-items: center;
		justify-content: space-between;
		padding: 0 10px;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		background: #fff;
		color: #27272a;
		font-size: 9px;
		font-weight: 750;
	}
	.other-methods span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.methods-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 4px;
		padding: 6px 12px 10px;
		border-bottom: 1px solid #e4e4e7;
	}
	.methods-header > button:first-child {
		display: flex;
		align-items: center;
		gap: 3px;
		border: 0;
		background: transparent;
		color: #2563eb;
		font-size: 8px;
	}
	.methods-header > strong {
		font-size: 11px;
		white-space: nowrap;
	}
	.methods-header .sheet-icon {
		justify-self: end;
	}
	.methods-content {
		max-height: 450px;
		overflow-y: auto;
		padding: 10px 12px 14px;
	}
	.method-group {
		display: grid;
		gap: 7px;
		margin-bottom: 10px;
	}
	.method-group > strong {
		color: #71717a;
		font-size: 8px;
		text-transform: uppercase;
	}
	.coupon-box {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 5px;
	}
	.coupon-box input {
		min-width: 0;
		height: 34px;
		padding: 0 9px;
		border: 1px solid #d4d4d8;
		border-radius: 7px;
		background: #fff;
		font-size: 9px;
	}
	.coupon-box button {
		border: 0;
		border-radius: 7px;
		background: #18181b;
		color: #fff;
		font-size: 8px;
		font-weight: 800;
	}
	.coupon-box button:disabled {
		opacity: 0.4;
	}
	.coupon-success {
		color: #15803d;
		font-size: 8px;
	}
	.method-row {
		display: grid;
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 6px 8px;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		background: #fff;
		color: #27272a;
		text-align: left;
	}
	.method-row + .method-row {
		margin-top: 5px;
	}
	.method-row > span:nth-child(2) {
		display: grid;
		gap: 2px;
	}
	.method-row b {
		font-size: 9px;
	}
	.method-row small {
		color: #71717a;
		font-size: 7px;
	}
	.method-mark {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border-radius: 8px;
		background: #f4f4f5;
		font-size: 8px;
		font-weight: 900;
	}
	.method-mark.apple {
		background: #18181b;
		color: #fff;
	}
	.method-mark.google {
		color: #2563eb;
		font-size: 15px;
	}
	.method-mark.loyalty {
		color: #2563eb;
	}
	@media (max-width: 767px) {
		.preview-shell {
			padding: 12px 8px 20px;
		}
		.phone {
			height: 610px;
			min-height: 500px;
		}
	}
</style>
