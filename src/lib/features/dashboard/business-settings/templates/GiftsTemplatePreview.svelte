<script lang="ts">
	import {
		Gift,
		Sparkles,
		Check,
		AlertTriangle,
		Send,
		Receipt,
		ShieldCheck,
		Truck,
		Plus,
		Minus,
		Calendar,
		FileCheck,
		ChevronRight,
		ChevronLeft,
		User,
		Phone,
		Package
	} from '@lucide/svelte';
	import type {
		GiftsFlowData,
		GiftsProductBase
	} from '$lib/features/shared/checkout-scenario-config';
	import {
		calculateGiftsOrderPrice,
		pruneGiftsSelections,
		type GiftsOrderSelections,
		type GiftsOrderMode
	} from '$lib/features/shared/gifts-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<GiftsFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: GiftsFlowData = {
		storeName: 'Майстерня Подарунків Wood & Craft',
		tagline: 'Індивідуальні подарунки, персоналізація та брендування виробів',
		description: 'Лазерне гравіювання, тиснення та подарункові набори ручної роботи',
		contacts: {
			phone: '+380 67 444 22 11',
			telegram: '@gift_craft_bot',
			instagram: '@wood_craft_gifts',
			address: 'м. Київ, вул. Воздвиженська, 21'
		},
		modes: {
			personalizedEnabled: true,
			readyGiftEnabled: true,
			customIdeaEnabled: true,
			directInvoiceEnabled: true,
			personalizedButtonText: 'Персоналізація',
			readyGiftButtonText: 'Готові подарунки',
			customIdeaButtonText: 'Власна ідея',
			directInvoiceButtonText: 'Оплата'
		},
		products: [
			{
				id: 'notebook',
				name: 'Блокнот з еко-шкіри',
				description: 'Щільний папір у крапку 100 г/м², закладка, кишенька для дрібниць та резинка-фіксатор',
				basePrice: 450,
				materials: ['Італійська еко-шкіра'],
				colors: [
					{ id: 'black', name: 'Чорний графіт', hex: '#222222' },
					{ id: 'emerald', name: 'Смарагдовий', hex: '#1b4d3e' },
					{ id: 'cognac', name: 'Коньячний', hex: '#9e472a' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			},
			{
				id: 'thermo_cup',
				name: 'Термочашка 450 мл',
				description: 'Подвійні вакуумні стінки, герметичний клапан, тримає тепло до 8 годин',
				basePrice: 550,
				materials: ['Нержавіюча харчова сталь 304'],
				colors: [
					{ id: 'matte_black', name: 'Матовий чорний', hex: '#1a1a1a' },
					{ id: 'white', name: 'Перлинний білий', hex: '#f7f7f7' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			},
			{
				id: 'hoodie',
				name: 'Худі Oversize Unisex',
				description: 'Преміум тринитка на флісі 320 г/м², глибокий подвійний капюшон',
				basePrice: 1200,
				sizes: ['S', 'M', 'L', 'XL'],
				colors: [
					{ id: 'charcoal', name: 'Антрацит', hex: '#333333' },
					{ id: 'beige', name: 'Бежевий пісок', hex: '#d8c2aa' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			}
		],
		personalization: [
			{
				id: 'engraving',
				name: 'Іменне нанесення (гравіювання / тиснення)',
				pricePerItem: 120,
				maxChars: 60,
				fonts: ['Класичний Serif', 'Мінімалістичний Sans', 'Каліграфічний Script', 'Сучасний Моно'],
				placements: ['По центру обкладинки', 'Правий нижній кутик', 'По центру внизу']
			},
			{
				id: 'color_print',
				name: 'Кольоровий стійкий друк',
				pricePerItem: 180,
				maxChars: 100,
				fonts: ['Bold Modern', 'Elegant Script', 'Clean Sans'],
				placements: ['Фронтальна частина', 'Широке нанесення']
			}
		],
		packaging: [
			{
				id: 'box',
				name: 'Подарункова коробка зі стрічкою',
				pricePerItem: 80,
				description: 'Цупкий крафтовий картон, паперовий наповнювач та атласна стрічка',
				icon: '🎁'
			},
			{
				id: 'wooden_box',
				name: 'Дерев’яний подарунковий бокс',
				pricePerItem: 180,
				description: 'Масив вільхи з магнітним замком та фірмовим гравіюванням',
				icon: '🪵'
			},
			{
				id: 'none',
				name: 'Без подарункового пакування',
				pricePerItem: 0,
				description: 'Транспортувальне еко-пакування',
				icon: '📦'
			}
		],
		mockup: {
			requireMockupForPersonalized: true,
			mockupFee: 300,
			allowSharedMockupForIdenticalItems: true,
			differentDesignsRequireManualQuote: true,
			leadTimeDays: 3
		},
		delivery: {
			allowPickup: true,
			allowDelivery: true,
			pickupPoints: [
				{
					id: 'showroom_kyiv',
					name: 'Шоурум & Майстерня Wood & Craft',
					address: 'м. Київ, вул. Воздвиженська, 21',
					workingHours: 'Пн–Сб: 10:00 – 19:00'
				}
			],
			deliveryFee: 150,
			freeDeliveryThreshold: 3000,
			deliveryTimeNotice: '1-2 дні Новою Поштою або кур’єром'
		},
		approval: {
			autoApprovalEnabled: true,
			requireManualForCustomFiles: true,
			requireManualForTightDeadlines: true,
			telegramChat: '@gift_craft_manager',
			responseTimeNotice: 'до 15 хвилин'
		},
		payment: {
			depositType: 'percent',
			depositValue: 50,
			allowRemainingOnDelivery: true
		}
	};

	let mergedData = $derived<GiftsFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts || {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes || {}) },
		products: flowData?.products && flowData.products.length > 0 ? flowData.products : defaultData.products,
		personalization: flowData?.personalization && flowData.personalization.length > 0 ? flowData.personalization : defaultData.personalization,
		packaging: flowData?.packaging && flowData.packaging.length > 0 ? flowData.packaging : defaultData.packaging,
		mockup: { ...defaultData.mockup, ...(flowData?.mockup || {}) },
		delivery: { ...defaultData.delivery, ...(flowData?.delivery || {}) },
		approval: { ...defaultData.approval, ...(flowData?.approval || {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment || {}) }
	});

	// Default selections: notebook, 2 pcs, engraving (+120), box (+80), mockup (+300), delivery (+150) = 1 750 грн!
	let currentMode = $state<GiftsOrderMode>('personalized');
	let step = $state<1 | 2 | 3 | 4>(1);

	let selections = $state<GiftsOrderSelections>({
		mode: 'personalized',
		productId: 'notebook',
		colorId: 'black',
		quantity: 2,
		hasPersonalization: true,
		personalizationId: 'engraving',
		personalizationType: 'text',
		customText: 'Yurii Dmytryshen',
		isMultiName: false,
		multiNames: ['Олександр', 'Максим'],
		packagingId: 'box',
		includeMockup: true,
		mockupVersion: 'v1.0',
		mockupApproved: false,
		deliveryType: 'delivery',
		deliveryAddress: 'м. Київ, вул. Хрещатик, 24, кв. 12',
		isGiftForRecipient: false,
		recipientName: '',
		recipientPhone: '',
		customIdeaBudget: 2500,
		customIdeaDescription: 'Корпоративний набір для IT-команди з індивідуальним тисненням логотипу',
		invoiceNumber: 'INV-4821',
		invoiceAmount: 1750
	});

	// Synchronize mode
	$effect(() => {
		selections.mode = currentMode;
	});

	// Prune selections on product or dependency change
	let prunedSelections = $derived(pruneGiftsSelections(mergedData, selections));

	// Calculate live pricing breakdown
	let priceResult = $derived(calculateGiftsOrderPrice(mergedData, prunedSelections));

	// Selected product reference
	let currentProduct = $derived<GiftsProductBase>(
		mergedData.products.find((p) => p.id === prunedSelections.productId) || mergedData.products[0]
	);

	let isPackagingStep = $derived(
		(currentMode === 'personalized' && step === 3) || (currentMode === 'ready' && step === 2)
	);
	let isSummaryStep = $derived(
		(currentMode === 'personalized' && step === 4) || (currentMode === 'ready' && step === 3)
	);

	function updateQuantity(delta: number) {
		const newQty = Math.max(1, Math.min(50, (selections.quantity || 1) + delta));
		selections.quantity = newQty;
		if (selections.isMultiName) {
			const current = [...(selections.multiNames || [])];
			if (current.length < newQty) {
				while (current.length < newQty) {
					current.push(`Отримувач #${current.length + 1}`);
				}
			} else {
				current.length = newQty;
			}
			selections.multiNames = current;
		}
	}

	function handlePayClick() {
		if (!priceResult.canInstantPay && priceResult.isEstimate) {
			alert('Дякуємо! Ваша заявка надіслана майстру. Після узгодження макета та вартості рахунок надійде в Telegram.');
			return;
		}
		// In personalized orders, paying deposit
		const amountToPay = priceResult.depositAmount > 0 ? priceResult.depositAmount : priceResult.totalAmount;
		onPay(amountToPay);
	}
</script>

<div class="ios-preview-container">
	<!-- iOS Navigation Bar -->
	<header class="ios-nav-bar">
		<div class="ios-nav-content">
			<span class="ios-merchant-badge">🎁 {mergedData.storeName}</span>
			<span class="ios-secure-tag"><ShieldCheck size={12} /> Захищено</span>
		</div>
	</header>

	<!-- iOS Segmented Mode Control -->
	<div class="ios-segmented-control">
		{#if mergedData.modes.personalizedEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'personalized'}
				onclick={() => { currentMode = 'personalized'; step = 1; }}
			>
				{mergedData.modes.personalizedButtonText || 'Персоналізація'}
			</button>
		{/if}
		{#if mergedData.modes.readyGiftEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'ready'}
				onclick={() => { currentMode = 'ready'; step = 1; }}
			>
				{mergedData.modes.readyGiftButtonText || 'Готові'}
			</button>
		{/if}
		{#if mergedData.modes.customIdeaEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'custom_idea'}
				onclick={() => (currentMode = 'custom_idea')}
			>
				{mergedData.modes.customIdeaButtonText || 'Власна ідея'}
			</button>
		{/if}
		{#if mergedData.modes.directInvoiceEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'direct_invoice'}
				onclick={() => (currentMode = 'direct_invoice')}
			>
				{mergedData.modes.directInvoiceButtonText || 'Оплата'}
			</button>
		{/if}
	</div>

	<!-- MODE 1: PERSONALIZED OR READY (APPLE HIG STEP WINDOWS) -->
	{#if currentMode === 'personalized' || currentMode === 'ready'}
		<!-- Step Header & Progress Capsules -->
		<div class="ios-step-indicator">
			<div class="ios-capsules">
				<div class="ios-capsule" class:filled={step >= 1}></div>
				{#if currentMode === 'personalized'}
					<div class="ios-capsule" class:filled={step >= 2}></div>
				{/if}
				<div class="ios-capsule" class:filled={step >= 3}></div>
				<div class="ios-capsule" class:filled={step >= 4}></div>
			</div>
			<div class="ios-step-title-wrap">
				<span class="ios-step-sub">Крок {step} з {currentMode === 'personalized' ? 4 : 3}</span>
				<h4 class="ios-step-title">
					{#if step === 1}
						Виріб, колір та тираж
					{:else if step === 2}
						{currentMode === 'personalized' ? 'Персоналізація та нанесення' : 'Пакування та отримання'}
					{:else if step === 3}
						{currentMode === 'personalized' ? 'Пакування та отримання' : 'Макет, кошторис та аванс'}
					{:else}
						Макет, кошторис та аванс
					{/if}
				</h4>
			</div>
		</div>

		<div class="ios-window-body">
			<!-- WINDOW 1: PRODUCT, COLOR, QUANTITY -->
			{#if step === 1}
				<!-- Products Stack -->
				<div class="ios-card">
					<span class="ios-card-title">Оберіть виріб-основу:</span>
					<div class="ios-items-stack">
						{#each mergedData.products as prod (prod.id)}
							<button
								type="button"
								class="ios-product-row"
								class:selected={selections.productId === prod.id}
								onclick={() => {
									selections.productId = prod.id;
									if (prod.colors && prod.colors.length > 0) {
										selections.colorId = prod.colors[0].id;
									}
								}}
							>
								<div class="ios-prod-info">
									<div class="ios-prod-name">{prod.name}</div>
									<div class="ios-prod-desc">{prod.description}</div>
								</div>
								<div class="ios-prod-price">
									{prod.basePrice} ₴/шт
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Color selection -->
				{#if currentProduct && currentProduct.colors && currentProduct.colors.length > 0}
					<div class="ios-card">
						<span class="ios-card-title">Колір виробу:</span>
						<div class="ios-colors-row">
							{#each currentProduct.colors as color (color.id)}
								<button
									type="button"
									class="ios-color-chip"
									class:selected={selections.colorId === color.id}
									onclick={() => (selections.colorId = color.id)}
								>
									<span class="ios-color-dot" style="background-color: {color.hex || '#333333'}"></span>
									<span>{color.name}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Quantity Stepper -->
				<div class="ios-card ios-card-stepper">
					<div>
						<span class="ios-card-title mb-0">Кількість виробів:</span>
						<span class="ios-card-sub">Разові послуги (макет і доставка) не множаться</span>
					</div>
					<div class="ios-stepper">
						<button
							type="button"
							class="ios-stepper-btn"
							aria-label="Зменшити"
							disabled={selections.quantity <= 1}
							onclick={() => updateQuantity(-1)}
						>
							<Minus size={14} />
						</button>
						<span class="ios-stepper-val">{selections.quantity} шт</span>
						<button
							type="button"
							class="ios-stepper-btn"
							aria-label="Збільшити"
							onclick={() => updateQuantity(1)}
						>
							<Plus size={14} />
						</button>
					</div>
				</div>

			<!-- WINDOW 2: PERSONALIZATION (ONLY PERSONALIZED MODE) -->
			{:else if step === 2 && currentMode === 'personalized'}
				<!-- Multi-name toggle -->
				<div class="ios-card">
					<span class="ios-card-title">Формат персоналізації:</span>
					<div class="ios-segmented-control mb-2">
						<button
							type="button"
							class="ios-segment-btn"
							class:active={!selections.isMultiName}
							onclick={() => (selections.isMultiName = false)}
						>
							Одне нанесення на всі {selections.quantity} шт
						</button>
						<button
							type="button"
							class="ios-segment-btn"
							class:active={selections.isMultiName}
							onclick={() => {
								selections.isMultiName = true;
								if (!selections.multiNames || selections.multiNames.length !== selections.quantity) {
									const list: string[] = [];
									for (let i = 0; i < selections.quantity; i++) {
										list.push(selections.multiNames?.[i] || `Отримувач #${i + 1}`);
									}
									selections.multiNames = list;
								}
							}}
						>
							Різні імена для кожного ({selections.quantity})
						</button>
					</div>

					<!-- Method selection -->
					<div class="ios-items-stack">
						{#each mergedData.personalization as opt (opt.id)}
							<button
								type="button"
								class="ios-opt-row"
								class:selected={selections.personalizationId === opt.id}
								onclick={() => (selections.personalizationId = opt.id)}
							>
								<span class="ios-opt-title">{opt.name}</span>
								<strong class="ios-opt-price">+{opt.pricePerItem} ₴/шт</strong>
							</button>
						{/each}
					</div>
				</div>

				<!-- Text input or names list -->
				<div class="ios-card">
					{#if !selections.isMultiName}
						<label>
							<span class="ios-input-lbl">Текст для нанесення / гравіювання:</span>
							<input
								type="text"
								class="ios-input"
								bind:value={selections.customText}
								placeholder="Наприклад: Yurii Dmytryshen"
							/>
						</label>
					{:else}
						<span class="ios-input-lbl">Ім'я для кожного з {selections.quantity} виробів:</span>
						<div class="ios-names-list">
							{#if selections.multiNames}
								{#each selections.multiNames as _, idx}
									<div class="ios-name-row">
										<span class="ios-name-idx">#{idx + 1}</span>
										<input
											type="text"
											class="ios-input"
											bind:value={selections.multiNames[idx]}
											placeholder="Ім'я виробу #{idx + 1}"
											aria-label="Ім'я виробу #{idx + 1}"
										/>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<!-- Mockup Inclusion -->
				<div class="ios-card">
					<label class="ios-switch-row">
						<div>
							<strong class="ios-switch-title">Спільний макет дизайнером</strong>
							<p class="ios-switch-desc">+{mergedData.mockup.mockupFee} ₴ разово на все замовлення</p>
						</div>
						<input type="checkbox" class="ios-checkbox" bind:checked={selections.includeMockup} />
					</label>
				</div>

			<!-- WINDOW 3: PACKAGING & DELIVERY -->
			{:else if isPackagingStep}
				<!-- Packaging Card -->
				<div class="ios-card">
					<span class="ios-card-title">Святкове пакування:</span>
					<div class="ios-items-stack">
						{#each mergedData.packaging as pack (pack.id)}
							<button
								type="button"
								class="ios-pack-row"
								class:selected={selections.packagingId === pack.id}
								onclick={() => (selections.packagingId = pack.id)}
							>
								<span class="ios-pack-icon">{pack.icon || '🎁'}</span>
								<div class="ios-pack-content">
									<div class="ios-pack-name">{pack.name}</div>
									<div class="ios-pack-desc">{pack.description}</div>
								</div>
								<strong class="ios-pack-price">
									{pack.pricePerItem > 0 ? `+${pack.pricePerItem} ₴/шт` : '0 ₴'}
								</strong>
							</button>
						{/each}
					</div>
				</div>

				<!-- Delivery Type Toggle -->
				<div class="ios-card">
					<span class="ios-card-title">Спосіб отримання:</span>
					<div class="ios-segmented-control mb-2.5">
						<button
							type="button"
							class="ios-segment-btn"
							class:active={selections.deliveryType === 'delivery'}
							onclick={() => (selections.deliveryType = 'delivery')}
						>
							<Truck size={13} class="inline mr-1" /> Доставка (+{mergedData.delivery.deliveryFee} ₴)
						</button>
						<button
							type="button"
							class="ios-segment-btn"
							class:active={selections.deliveryType === 'pickup'}
							onclick={() => (selections.deliveryType = 'pickup')}
						>
							<ShieldCheck size={13} class="inline mr-1" /> Самовивіз (0 ₴)
						</button>
					</div>

					{#if selections.deliveryType === 'delivery'}
						<label>
							<span class="ios-input-lbl">Адреса доставки (Нова Пошта / кур’єр):</span>
							<input
								type="text"
								class="ios-input"
								bind:value={selections.deliveryAddress}
								placeholder="м. Київ, відділення НП №12 або адреса"
							/>
						</label>

						<div class="ios-gift-recipient mt-3">
							<label class="ios-checkbox-label">
								<input type="checkbox" class="ios-checkbox" bind:checked={selections.isGiftForRecipient} />
								<span>Це подарунок іншій людині 🎁</span>
							</label>

							{#if selections.isGiftForRecipient}
								<div class="ios-form-stack mt-2">
									<label>
										<span class="ios-input-lbl">Ім'я одержувача:</span>
										<input
											type="text"
											class="ios-input"
											bind:value={selections.recipientName}
											placeholder="Марія Коваленко"
										/>
									</label>
									<label>
										<span class="ios-input-lbl">Телефон одержувача:</span>
										<input
											type="tel"
											class="ios-input"
											bind:value={selections.recipientPhone}
											placeholder="+380..."
										/>
									</label>
								</div>
							{/if}
						</div>
					{:else}
						<div class="ios-pickup-card">
							<strong>{mergedData.delivery.pickupPoints[0]?.name || 'Майстерня Wood & Craft'}</strong>
							<p>{mergedData.delivery.pickupPoints[0]?.address} ({mergedData.delivery.pickupPoints[0]?.workingHours})</p>
						</div>
					{/if}
				</div>

			<!-- WINDOW 4: MOCKUP LIFECYCLE & APPLE WALLET PASS RECEIPT -->
			{:else if isSummaryStep}
				{#if currentMode === 'personalized' && selections.includeMockup}
					<!-- Mockup Lifecycle Review Card -->
					<div class="ios-card ios-mockup-card">
						<div class="ios-mockup-head">
							<span class="ios-mockup-ver">Макет {selections.mockupVersion || 'v1.0'}</span>
							<span class="ios-mockup-status" class:approved={selections.mockupApproved}>
								{selections.mockupApproved ? '✅ Затверджено' : '⏳ Очікує затвердження'}
							</span>
						</div>

						<div class="ios-mockup-render">
							<div class="ios-notebook-mock" style="background-color: {currentProduct.colors?.find(c => c.id === selections.colorId)?.hex || '#222222'}">
								<div class="ios-engraving-text">
									{#if !selections.isMultiName}
										{selections.customText || 'Yurii Dmytryshen'}
									{:else}
										{selections.multiNames?.[0] || 'Олександр'}
									{/if}
								</div>
								<div class="ios-notebook-ribbon"></div>
							</div>
							<span class="ios-mockup-caption">Візуалізація лазерного гравіювання</span>
						</div>

						<div class="ios-mockup-buttons">
							<button
								type="button"
								class="ios-btn-approve"
								class:active={selections.mockupApproved}
								onclick={() => (selections.mockupApproved = true)}
							>
								<Check size={14} />
								<span>{selections.mockupApproved ? 'Макет погоджено' : 'Погодити до виготовлення'}</span>
							</button>
							<button
								type="button"
								class="ios-btn-changes"
								onclick={() => {
									selections.mockupApproved = false;
									selections.mockupVersion = 'v1.1 (правки)';
									alert('Коментар надіслано дизайнеру. Нова версія буде підготовлена для повторного погодження.');
								}}
							>
								Потрібні зміни
							</button>
						</div>
					</div>
				{/if}

				<!-- Apple Pass / Wallet Style Card -->
				<div class="ios-pass-card">
					<div class="ios-pass-head">
						<div>
							<span class="ios-pass-tag">Індивідуальне замовлення</span>
							<h5 class="ios-pass-title">{currentProduct.name} ({selections.quantity} шт)</h5>
						</div>
						<span class="ios-pass-badge">🎁 В роботі</span>
					</div>

					<div class="ios-pass-body">
						{#each priceResult.breakdown as item}
							<div class="ios-pass-row">
								<span class="ios-pass-lbl">
									{item.label}
									{#if item.isOneTimeFee}<span class="ios-onetime-pill">разово</span>{/if}
								</span>
								<strong class="ios-pass-val">
									{item.isFree ? '0 ₴' : `${item.amount} ₴`}
								</strong>
							</div>
						{/each}
					</div>

					<div class="ios-pass-cut">
						<div class="ios-cut-left"></div>
						<div class="ios-cut-line"></div>
						<div class="ios-cut-right"></div>
					</div>

					<div class="ios-pass-footer">
						<div class="ios-pass-total-row">
							<span>Загальна вартість:</span>
							<strong class="ios-total-sum">{priceResult.totalAmount} ₴</strong>
						</div>

						{#if priceResult.depositAmount < priceResult.totalAmount && priceResult.depositAmount > 0}
							<div class="ios-split-pills">
								<div class="ios-split-pill deposit">
									<span class="pill-lbl">Аванс ({priceResult.depositPercent}%):</span>
									<strong class="pill-val">{priceResult.depositAmount} ₴</strong>
								</div>
								<div class="ios-split-pill remaining">
									<span class="pill-lbl">Залишок після виготовлення:</span>
									<strong class="pill-val">{priceResult.remainingAmount} ₴</strong>
								</div>
							</div>
						{/if}

						{#if priceResult.estimateNotice}
							<div class="ios-estimate-alert">
								<AlertTriangle size={13} />
								<span>{priceResult.estimateNotice}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Apple Style Floating Bottom Bar -->
		<div class="ios-bottom-bar">
			{#if step > 1}
				<button
					type="button"
					class="ios-btn-secondary"
					onclick={() => step = (step - 1) as 1 | 2 | 3 | 4}
				>
					<ChevronLeft size={16} /> Назад
				</button>
			{/if}

			{#if step < (currentMode === 'personalized' ? 4 : 3)}
				<button
					type="button"
					class="ios-btn-primary flex-1"
					onclick={() => step = (step + 1) as 1 | 2 | 3 | 4}
				>
					{#if step === 1}
						{currentMode === 'personalized' ? 'Персоналізація' : 'Пакування та доставка'}
					{:else if step === 2}
						Пакування та отримання
					{:else if step === 3}
						Підсумок замовлення
					{/if}
					<ChevronRight size={16} />
				</button>
			{:else}
				<button
					type="button"
					class="ios-btn-primary flex-1"
					class:estimate-btn={!priceResult.canInstantPay}
					onclick={handlePayClick}
				>
					{#if !priceResult.canInstantPay}
						<Send size={15} />
						<span>Надіслати на оцінку майстру</span>
					{:else if priceResult.depositAmount < priceResult.totalAmount && priceResult.depositAmount > 0}
						<ShieldCheck size={16} />
						<span>Внести аванс {priceResult.depositAmount} ₴</span>
					{:else}
						<ShieldCheck size={16} />
						<span>Оплатити {priceResult.totalAmount} ₴</span>
					{/if}
				</button>
			{/if}
		</div>

	<!-- MODE 2: CUSTOM IDEA -->
	{:else if currentMode === 'custom_idea'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Індивідуальне замовлення під ключ:</span>
				<p class="ios-card-sub">Опишіть вашу ідею. Майстер прорахує точну вартість і терміни виготовлення.</p>
				<textarea
					class="ios-textarea mt-2"
					rows="3"
					bind:value={selections.customIdeaDescription}
					placeholder="Який виріб потрібен, матеріали, тираж, форма, побажання до пакування..."
				></textarea>
			</div>

			<div class="ios-card">
				<div class="ios-grid-2">
					<label>
						<span class="ios-input-lbl">Орієнтовний бюджет (₴):</span>
						<input
							type="number"
							min="500"
							step="100"
							class="ios-input"
							bind:value={selections.customIdeaBudget}
						/>
					</label>
					<label>
						<span class="ios-input-lbl">Бажана дата:</span>
						<input
							type="text"
							class="ios-input"
							bind:value={selections.customIdeaDeadline}
							placeholder="дд.мм.рррр"
						/>
					</label>
				</div>
			</div>

			<div class="ios-bottom-bar">
				<button
					type="button"
					class="ios-btn-primary w-full"
					onclick={handlePayClick}
				>
					<Send size={15} />
					<span>Надіслати заявку на прорахунок</span>
				</button>
			</div>
		</div>

	<!-- MODE 3: DIRECT INVOICE -->
	{:else if currentMode === 'direct_invoice'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Оплата за погодженим рахунком:</span>
				<div class="ios-form-stack mt-2">
					<label>
						<span class="ios-input-lbl">Номер рахунку / замовлення:</span>
						<input
							type="text"
							class="ios-input"
							bind:value={selections.invoiceNumber}
							placeholder="INV-..."
						/>
					</label>
					<label>
						<span class="ios-input-lbl">Сума до сплати (₴):</span>
						<input
							type="number"
							min="1"
							class="ios-input"
							bind:value={selections.invoiceAmount}
						/>
					</label>
				</div>
			</div>

			<div class="ios-bottom-bar">
				<button
					type="button"
					class="ios-btn-primary w-full"
					onclick={handlePayClick}
				>
					<Receipt size={16} />
					<span>Оплатити рахунок {selections.invoiceAmount} ₴</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.ios-preview-container {
		display: flex;
		flex-direction: column;
		background: #f2f2f7;
		font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
		color: #1c1c1e;
		min-height: 520px;
		border-radius: 18px;
		overflow: hidden;
		position: relative;
		padding-bottom: 72px;
	}

	.ios-nav-bar {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
		padding: 0.65rem 1rem;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.ios-nav-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-merchant-badge {
		font-size: 0.85rem;
		font-weight: 700;
		color: #1c1c1e;
	}

	.ios-secure-tag {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.7rem;
		font-weight: 500;
		color: #34c759;
		background: rgba(52, 199, 89, 0.12);
		padding: 2px 8px;
		border-radius: 12px;
	}

	.ios-segmented-control {
		display: flex;
		background: #e3e3e8;
		border-radius: 9px;
		padding: 2px;
		margin: 0.75rem 1rem 0 1rem;
	}

	.ios-segment-btn {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 0.78rem;
		font-weight: 500;
		color: #636366;
		padding: 0.35rem 0.5rem;
		border-radius: 7px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
		text-align: center;
	}

	.ios-segment-btn.active {
		background: #ffffff;
		color: #1c1c1e;
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.ios-step-indicator {
		padding: 0.85rem 1rem 0.25rem 1rem;
	}

	.ios-capsules {
		display: flex;
		gap: 4px;
		margin-bottom: 0.4rem;
	}

	.ios-capsule {
		flex: 1;
		height: 3px;
		background: #d1d1d6;
		border-radius: 2px;
		transition: background 0.3s ease;
	}

	.ios-capsule.filled {
		background: #007aff;
	}

	.ios-step-sub {
		font-size: 0.7rem;
		font-weight: 600;
		color: #007aff;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.ios-step-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: #1c1c1e;
		margin: 0;
	}

	.ios-window-body {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ios-card {
		background: #ffffff;
		border-radius: 14px;
		padding: 0.85rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		border: 0.5px solid rgba(0, 0, 0, 0.08);
	}

	.ios-card-title {
		display: block;
		font-size: 0.82rem;
		font-weight: 600;
		color: #3a3a3c;
		margin-bottom: 0.5rem;
	}

	.ios-card-sub {
		font-size: 0.72rem;
		color: #8e8e93;
		margin: 0;
	}

	.ios-card-stepper {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-product-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.ios-product-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-prod-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-prod-desc {
		font-size: 0.68rem;
		color: #8e8e93;
		max-width: 180px;
	}

	.ios-prod-price {
		font-size: 0.88rem;
		font-weight: 700;
		color: #007aff;
	}

	.ios-colors-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.ios-color-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		font-size: 0.74rem;
		cursor: pointer;
		font-weight: 500;
	}

	.ios-color-chip.selected {
		border-color: #007aff;
		background: #f0f7ff;
		color: #007aff;
		font-weight: 600;
	}

	.ios-color-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.15);
	}

	.ios-stepper {
		display: flex;
		align-items: center;
		background: #f2f2f7;
		border-radius: 8px;
		padding: 2px;
		gap: 6px;
	}

	.ios-stepper-btn {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.ios-stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ios-stepper-val {
		font-size: 0.82rem;
		font-weight: 700;
		color: #1c1c1e;
		min-width: 44px;
		text-align: center;
	}

	.ios-opt-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
	}

	.ios-opt-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-opt-title {
		font-size: 0.78rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-opt-price {
		font-size: 0.8rem;
		color: #007aff;
	}

	.ios-input-lbl {
		display: block;
		font-size: 0.74rem;
		font-weight: 600;
		color: #3a3a3c;
		margin-bottom: 0.35rem;
	}

	.ios-input, .ios-textarea {
		width: 100%;
		border: 1px solid #e5e5ea;
		background: #f9f9fb;
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		font-size: 0.8rem;
		color: #1c1c1e;
		outline: none;
		box-sizing: border-box;
	}

	.ios-input:focus, .ios-textarea:focus {
		border-color: #007aff;
		background: #ffffff;
	}

	.ios-names-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ios-name-idx {
		font-size: 0.75rem;
		font-weight: 700;
		color: #8e8e93;
		width: 22px;
	}

	.ios-switch-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
	}

	.ios-switch-title {
		font-size: 0.8rem;
		color: #1c1c1e;
		display: block;
	}

	.ios-switch-desc {
		font-size: 0.7rem;
		color: #8e8e93;
		margin: 0;
	}

	.ios-checkbox {
		width: 18px;
		height: 18px;
		accent-color: #007aff;
		cursor: pointer;
	}

	.ios-pack-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
	}

	.ios-pack-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-pack-icon {
		font-size: 1.25rem;
	}

	.ios-pack-content {
		flex: 1;
	}

	.ios-pack-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-pack-desc {
		font-size: 0.68rem;
		color: #8e8e93;
	}

	.ios-pack-price {
		font-size: 0.82rem;
		color: #007aff;
	}

	.ios-checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		color: #1c1c1e;
		cursor: pointer;
	}

	.ios-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-pickup-card {
		background: #f2f2f7;
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		font-size: 0.75rem;
	}

	.ios-pickup-card strong {
		display: block;
		color: #1c1c1e;
	}

	.ios-pickup-card p {
		color: #636366;
		margin: 2px 0 0 0;
	}

	.ios-mockup-card {
		border-color: #3b82f6;
		background: #fbfdff;
	}

	.ios-mockup-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.6rem;
	}

	.ios-mockup-ver {
		font-size: 0.72rem;
		font-weight: 700;
		color: #007aff;
		background: #e5f1ff;
		padding: 2px 6px;
		border-radius: 6px;
	}

	.ios-mockup-status {
		font-size: 0.72rem;
		font-weight: 600;
		color: #d97706;
	}

	.ios-mockup-status.approved {
		color: #16a34a;
	}

	.ios-mockup-render {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem 0;
	}

	.ios-notebook-mock {
		width: 140px;
		height: 90px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.ios-engraving-text {
		color: rgba(255, 255, 255, 0.85);
		font-family: Georgia, serif;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.5px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.ios-notebook-ribbon {
		position: absolute;
		right: 14px;
		top: 0;
		bottom: 0;
		width: 8px;
		background: rgba(0, 0, 0, 0.25);
	}

	.ios-mockup-caption {
		font-size: 0.65rem;
		color: #8e8e93;
		margin-top: 0.4rem;
	}

	.ios-mockup-buttons {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	.ios-btn-approve {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: #16a34a;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0.45rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.ios-btn-approve.active {
		background: #15803d;
	}

	.ios-btn-changes {
		border: 1px solid #e5e5ea;
		background: #ffffff;
		color: #636366;
		border-radius: 8px;
		padding: 0.45rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}

	/* Apple Pass / Wallet Ticket */
	.ios-pass-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		border: 0.5px solid rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}

	.ios-pass-head {
		padding: 0.85rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
	}

	.ios-pass-tag {
		font-size: 0.68rem;
		font-weight: 600;
		color: #007aff;
		text-transform: uppercase;
		display: block;
	}

	.ios-pass-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #1c1c1e;
		margin: 2px 0 0 0;
	}

	.ios-pass-badge {
		font-size: 0.65rem;
		font-weight: 600;
		color: #ec4899;
		background: #fdf2f8;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.ios-pass-body {
		padding: 0.5rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.ios-pass-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.78rem;
	}

	.ios-pass-lbl {
		color: #636366;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.ios-onetime-pill {
		font-size: 0.62rem;
		background: #e5e5ea;
		color: #3a3a3c;
		padding: 1px 4px;
		border-radius: 4px;
	}

	.ios-pass-val {
		color: #1c1c1e;
	}

	.ios-pass-cut {
		display: flex;
		align-items: center;
		position: relative;
		margin: 0.35rem 0;
	}

	.ios-cut-left, .ios-cut-right {
		width: 14px;
		height: 14px;
		background: #f2f2f7;
		border-radius: 50%;
	}

	.ios-cut-left {
		margin-left: -7px;
	}

	.ios-cut-right {
		margin-right: -7px;
	}

	.ios-cut-line {
		flex: 1;
		border-bottom: 1px dashed #d1d1d6;
	}

	.ios-pass-footer {
		padding: 0.5rem 0.85rem 0.85rem 0.85rem;
	}

	.ios-pass-total-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.ios-total-sum {
		font-size: 1.25rem;
		font-weight: 800;
		color: #007aff;
	}

	.ios-split-pills {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}

	.ios-split-pill {
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		font-size: 0.7rem;
	}

	.ios-split-pill.deposit {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
	}

	.ios-split-pill.deposit .pill-lbl {
		color: #166534;
		display: block;
	}

	.ios-split-pill.deposit .pill-val {
		color: #15803d;
		font-size: 0.82rem;
	}

	.ios-split-pill.remaining {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
	}

	.ios-split-pill.remaining .pill-lbl {
		color: #475569;
		display: block;
	}

	.ios-split-pill.remaining .pill-val {
		color: #334155;
		font-size: 0.82rem;
	}

	.ios-estimate-alert {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 0.5rem;
		background: #fffbeb;
		border: 1px solid #fef3c7;
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		font-size: 0.7rem;
		color: #b45309;
	}

	/* Fixed Bottom Action Bar */
	.ios-bottom-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 0.65rem 1rem;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-top: 0.5px solid rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 0.5rem;
		z-index: 20;
	}

	.ios-btn-secondary {
		background: #e5e5ea;
		color: #1c1c1e;
		border: none;
		border-radius: 12px;
		padding: 0.6rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.ios-btn-primary {
		background: #007aff;
		color: #ffffff;
		border: none;
		border-radius: 12px;
		padding: 0.65rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
		transition: background 0.15s ease;
	}

	.ios-btn-primary:active {
		background: #0062cc;
	}

	.ios-btn-primary.estimate-btn {
		background: #f59e0b;
		box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
	}

	.ios-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
</style>
