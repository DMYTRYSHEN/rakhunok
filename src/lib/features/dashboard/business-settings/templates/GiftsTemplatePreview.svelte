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
		FileCode,
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
			personalizedButtonText: 'Персоналізувати',
			readyGiftButtonText: 'Готові подарунки',
			customIdeaButtonText: 'Власна ідея',
			directInvoiceButtonText: 'Оплатити рахунок'
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

<div class="preview-container">
	<!-- Store Brand Header -->
	<header class="store-hero">
		<div class="store-badge">🎁 Майстерня Подарунків</div>
		<h2 class="store-title">{mergedData.storeName}</h2>
		<p class="store-tagline">{mergedData.tagline}</p>
	</header>

	<!-- Mode Selector Tabs -->
	<nav class="mode-tabs">
		{#if mergedData.modes.personalizedEnabled}
			<button
				type="button"
				class="mode-tab"
				class:active={currentMode === 'personalized'}
				onclick={() => (currentMode = 'personalized')}
			>
				<Sparkles size={14} />
				<span>{mergedData.modes.personalizedButtonText || 'Персоналізація'}</span>
			</button>
		{/if}
		{#if mergedData.modes.readyGiftEnabled}
			<button
				type="button"
				class="mode-tab"
				class:active={currentMode === 'ready'}
				onclick={() => (currentMode = 'ready')}
			>
				<Package size={14} />
				<span>{mergedData.modes.readyGiftButtonText || 'Готові подарунки'}</span>
			</button>
		{/if}
		{#if mergedData.modes.customIdeaEnabled}
			<button
				type="button"
				class="mode-tab"
				class:active={currentMode === 'custom_idea'}
				onclick={() => (currentMode = 'custom_idea')}
			>
				<Gift size={14} />
				<span>{mergedData.modes.customIdeaButtonText || 'Власна ідея'}</span>
			</button>
		{/if}
		{#if mergedData.modes.directInvoiceEnabled}
			<button
				type="button"
				class="mode-tab"
				class:active={currentMode === 'direct_invoice'}
				onclick={() => (currentMode = 'direct_invoice')}
			>
				<Receipt size={14} />
				<span>{mergedData.modes.directInvoiceButtonText || 'Оплата'}</span>
			</button>
		{/if}
	</nav>

	<!-- MAIN CONTENT AREA -->
	<div class="flow-content">
		<!-- MODE 1: PERSONALIZED OR READY -->
		{#if currentMode === 'personalized' || currentMode === 'ready'}
			<!-- 1. Product Selection -->
			<section class="flow-section">
				<div class="section-title">
					<span class="step-num">1</span>
					<span>Оберіть виріб-основу</span>
				</div>
				<div class="products-selector">
					{#each mergedData.products as prod (prod.id)}
						<button
							type="button"
							class="product-card-btn"
							class:selected={selections.productId === prod.id}
							onclick={() => {
								selections.productId = prod.id;
								if (prod.colors && prod.colors.length > 0) {
									selections.colorId = prod.colors[0].id;
								}
							}}
						>
							<div class="prod-top">
								<span class="prod-name">{prod.name}</span>
								<span class="prod-price">{prod.basePrice} ₴/шт</span>
							</div>
							<p class="prod-desc">{prod.description}</p>
						</button>
					{/each}
				</div>

				<!-- Color selection -->
				{#if currentProduct && currentProduct.colors && currentProduct.colors.length > 0}
					<div class="sub-block">
						<span class="sub-title">Оберіть колір виробу:</span>
						<div class="colors-row">
							{#each currentProduct.colors as color (color.id)}
								<button
									type="button"
									class="color-btn"
									class:selected={selections.colorId === color.id}
									onclick={() => (selections.colorId = color.id)}
								>
									<span class="color-swatch" style="background-color: {color.hex || '#333333'}"></span>
									<span>{color.name}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Quantity stepper -->
				<div class="sub-block flex-between qty-block">
					<div>
						<span class="sub-title">Кількість виробів:</span>
						<span class="sub-hint">Разові послуги (макет і доставка) не множаться на тираж</span>
					</div>
					<div class="stepper">
						<button
							type="button"
							class="stepper-btn"
							aria-label="Зменшити кількість"
							disabled={selections.quantity <= 1}
							onclick={() => updateQuantity(-1)}
						>
							<Minus size={15} />
						</button>
						<span class="stepper-val">{selections.quantity} шт</span>
						<button
							type="button"
							class="stepper-btn"
							aria-label="Збільшити кількість"
							onclick={() => updateQuantity(1)}
						>
							<Plus size={15} />
						</button>
					</div>
				</div>
			</section>

			<!-- 2. Personalization Block (Only in Personalized Mode) -->
			{#if currentMode === 'personalized'}
				<section class="flow-section">
					<div class="section-title">
						<span class="step-num">2</span>
						<span>Персоналізація та нанесення</span>
					</div>

					<!-- Single name vs Multiple names -->
					<div class="multi-name-toggle">
						<button
							type="button"
							class="toggle-opt"
							class:active={!selections.isMultiName}
							onclick={() => (selections.isMultiName = false)}
						>
							Одне нанесення на всі {selections.quantity} шт
						</button>
						<button
							type="button"
							class="toggle-opt"
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
							Різні імена для кожного з {selections.quantity} шт
						</button>
					</div>

					<!-- Method selection -->
					<div class="options-grid">
						{#each mergedData.personalization as opt (opt.id)}
							<button
								type="button"
								class="opt-btn"
								class:selected={selections.personalizationId === opt.id}
								onclick={() => (selections.personalizationId = opt.id)}
							>
								<div class="opt-name">{opt.name}</div>
								<div class="opt-price">+{opt.pricePerItem} ₴/шт</div>
							</button>
						{/each}
					</div>

					<!-- Text input or multi-names list -->
					{#if !selections.isMultiName}
						<div class="input-wrap">
							<label>
								<span class="sub-title">Текст для гравіювання / тиснення:</span>
								<input
									type="text"
									class="control-input"
									bind:value={selections.customText}
									placeholder="Наприклад: Yurii Dmytryshen або ініціали"
								/>
							</label>
						</div>
					{:else}
						<div class="multi-names-list">
							<span class="sub-title">Вкажіть ім'я для кожного з {selections.quantity} виробів:</span>
							{#if selections.multiNames}
								{#each selections.multiNames as _, idx}
									<div class="name-row">
										<span class="name-idx">#{idx + 1}</span>
										<input
											type="text"
											class="control-input"
											bind:value={selections.multiNames[idx]}
											placeholder="Ім'я для виробу #{idx + 1}"
											aria-label="Ім'я для виробу #{idx + 1}"
										/>
									</div>
								{/each}
							{/if}
						</div>
					{/if}

					<!-- Mockup Notice & Checkbox -->
					<div class="mockup-card">
						<div class="mockup-header">
							<div class="mockup-icon">📐</div>
							<div>
								<strong>Розроблення спільного макета дизайнером</strong>
								<p class="mockup-note">
									+{mergedData.mockup.mockupFee} ₴ разово на замовлення (не множиться на кількість).
								</p>
							</div>
							<label class="mockup-checkbox">
								<input type="checkbox" bind:checked={selections.includeMockup} />
								<span>Включено</span>
							</label>
						</div>
					</div>
				</section>
			{/if}

			<!-- 3. Packaging -->
			<section class="flow-section">
				<div class="section-title">
					<span class="step-num">{currentMode === 'personalized' ? '3' : '2'}</span>
					<span>Святкове пакування</span>
				</div>
				<div class="options-grid">
					{#each mergedData.packaging as pack (pack.id)}
						<button
							type="button"
							class="opt-btn pack-btn"
							class:selected={selections.packagingId === pack.id}
							onclick={() => (selections.packagingId = pack.id)}
						>
							<span class="pack-icon">{pack.icon || '🎁'}</span>
							<div class="opt-name">{pack.name}</div>
							<div class="opt-price">
								{pack.pricePerItem > 0 ? `+${pack.pricePerItem} ₴/шт` : 'Включено (0 ₴)'}
							</div>
						</button>
					{/each}
				</div>
			</section>

			<!-- 4. Delivery & Recipient -->
			<section class="flow-section">
				<div class="section-title">
					<span class="step-num">{currentMode === 'personalized' ? '4' : '3'}</span>
					<span>Отримання замовлення</span>
				</div>

				<div class="delivery-toggle">
					<button
						type="button"
						class="toggle-btn"
						class:active={selections.deliveryType === 'delivery'}
						onclick={() => (selections.deliveryType = 'delivery')}
					>
						<Truck size={16} />
						<span>Доставка (+{mergedData.delivery.deliveryFee} ₴)</span>
					</button>
					<button
						type="button"
						class="toggle-btn"
						class:active={selections.deliveryType === 'pickup'}
						onclick={() => (selections.deliveryType = 'pickup')}
					>
						<ShieldCheck size={16} />
						<span>Самовивіз із майстерні (0 ₴)</span>
					</button>
				</div>

				{#if selections.deliveryType === 'delivery'}
					<div class="input-wrap">
						<label>
							<span class="sub-title">Адреса доставки (Нова Пошта / кур’єр):</span>
							<input
								type="text"
								class="control-input"
								bind:value={selections.deliveryAddress}
								placeholder="м. Київ, відділення НП №12 або адреса"
							/>
						</label>
					</div>

					<!-- Gift to another person -->
					<div class="gift-recipient-wrap">
						<label class="checkbox-row">
							<input type="checkbox" bind:checked={selections.isGiftForRecipient} />
							<span>Це подарунок іншій людині 🎁</span>
						</label>

						{#if selections.isGiftForRecipient}
							<div class="recipient-fields">
								<label>
									<span class="sub-title">Ім'я одержувача:</span>
									<input
										type="text"
										class="control-input"
										bind:value={selections.recipientName}
										placeholder="Ім'я та прізвище"
									/>
								</label>
								<label>
									<span class="sub-title">Телефон одержувача:</span>
									<input
										type="tel"
										class="control-input"
										bind:value={selections.recipientPhone}
										placeholder="+380..."
									/>
								</label>
								<p class="privacy-note">
									🔒 Контакти використовуються виключно кур'єрською службою для вручення посилки
									і не додаються до рекламних розсилок.
								</p>
							</div>
						{/if}
					</div>
				{:else}
					<div class="pickup-info-box">
						<strong>Самовивіз:</strong> {mergedData.delivery.pickupPoints[0]?.name || 'Майстерня Wood & Craft'}
						<p class="muted">{mergedData.delivery.pickupPoints[0]?.address} ({mergedData.delivery.pickupPoints[0]?.workingHours})</p>
					</div>
				{/if}
			</section>

			<!-- 5. Mockup Approval Lifecycle Visualizer (Only in Personalized Mode) -->
			{#if currentMode === 'personalized' && selections.includeMockup}
				<section class="flow-section mockup-review-section">
					<div class="section-title">
						<span class="step-num">5</span>
						<span>Погодження макета та виробництво</span>
					</div>

					<div class="mockup-status-box" class:approved={selections.mockupApproved}>
						<div class="status-badge-row">
							<span class="version-tag">Версія: {selections.mockupVersion || 'v1.0'}</span>
							<span class="status-tag" class:ok={selections.mockupApproved}>
								{selections.mockupApproved ? '✅ Макет затверджено клієнтом' : '⏳ Очікує вашого затвердження'}
							</span>
						</div>

						<div class="mockup-preview-render">
							<div class="preview-notebook">
								<div class="notebook-cover" style="background-color: {currentProduct.colors?.find(c => c.id === selections.colorId)?.hex || '#222222'}">
									<div class="engraving-text">
										{#if !selections.isMultiName}
											{selections.customText || 'Ваш напис'}
										{:else}
											{selections.multiNames?.[0] || 'Ім’я на виробі'}
										{/if}
									</div>
									<div class="notebook-strap"></div>
								</div>
							</div>
							<p class="mockup-caption">Електронне розміщення дизайну на виробі</p>
						</div>

						<div class="mockup-actions">
							<button
								type="button"
								class="btn-approve"
								class:active={selections.mockupApproved}
								onclick={() => (selections.mockupApproved = true)}
							>
								<Check size={16} />
								<span>{selections.mockupApproved ? 'Макет затверджено' : 'Погодити до виготовлення'}</span>
							</button>
							<button
								type="button"
								class="btn-reject"
								onclick={() => {
									selections.mockupApproved = false;
									selections.mockupVersion = 'v1.1 (правки)';
									alert('Коментар надіслано дизайнеру. Нова версія макета потребуватиме повторного погодження.');
								}}
							>
								<span>Потрібні зміни</span>
							</button>
						</div>

						<div class="production-rule-alert">
							<AlertTriangle size={15} />
							<span>
								{priceResult.productionNotice}
							</span>
						</div>
					</div>
				</section>
			{/if}

		<!-- MODE 2: CUSTOM IDEA -->
		{:else if currentMode === 'custom_idea'}
			<section class="flow-section">
				<div class="section-title">
					<span class="step-num">✨</span>
					<span>Індивідуальне замовлення під ключ</span>
				</div>

				<div class="callout-idea">
					<strong>Ручна оцінка майстерні:</strong> Опишіть вашу ідею (матеріали, габарити, гравіювання).
					Майстер прорахує точну вартість і терміни та надішле пропозицію.
				</div>

				<div class="input-wrap">
					<label>
						<span class="sub-title">Опис ідеї або технічне завдання:</span>
						<textarea
							class="control-textarea"
							rows="3"
							bind:value={selections.customIdeaDescription}
							placeholder="Який виріб потрібен, тираж, форма, побажання до пакування..."
						></textarea>
					</label>
				</div>

				<div class="grid-2-cols">
					<label>
						<span class="sub-title">Орієнтовний бюджет (₴):</span>
						<input
							type="number"
							min="500"
							step="100"
							class="control-input"
							bind:value={selections.customIdeaBudget}
						/>
						<span class="sub-hint">Бюджет є орієнтиром, а не фіксованою ціною</span>
					</label>
					<label>
						<span class="sub-title">Бажана дата готовності:</span>
						<input
							type="date"
							class="control-input"
							bind:value={selections.customIdeaDeadline}
						/>
					</label>
				</div>
			</section>

		<!-- MODE 3: DIRECT INVOICE -->
		{:else if currentMode === 'direct_invoice'}
			<section class="flow-section">
				<div class="section-title">
					<span class="step-num">🧾</span>
					<span>Оплата за погодженим рахунком</span>
				</div>

				<div class="grid-2-cols">
					<label>
						<span class="sub-title">Номер рахунку / замовлення:</span>
						<input
							type="text"
							class="control-input"
							bind:value={selections.invoiceNumber}
							placeholder="INV-..."
						/>
					</label>
					<label>
						<span class="sub-title">Сума до сплати (₴):</span>
						<input
							type="number"
							min="1"
							class="control-input"
							bind:value={selections.invoiceAmount}
						/>
					</label>
				</div>
			</section>
		{/if}
	</div>

	<!-- Sticky Summary & Checkout Footer -->
	<footer class="pricing-summary">
		<div class="breakdown-list">
			{#each priceResult.breakdown as item}
				<div class="breakdown-row" class:onetime={item.isOneTimeFee}>
					<span class="item-label">
						{item.label}
						{#if item.isOneTimeFee}
							<span class="onetime-tag">разово</span>
						{/if}
					</span>
					<span class="item-val">{item.isFree ? 'Безкоштовно' : `${item.amount} ₴`}</span>
				</div>
			{/each}
		</div>

		<div class="totals-section">
			<div class="total-row">
				<span class="lbl-total">Загальна вартість:</span>
				<strong class="total-amount">{priceResult.totalAmount} ₴</strong>
			</div>

			{#if priceResult.depositAmount < priceResult.totalAmount && priceResult.depositAmount > 0}
				<div class="split-pay-row">
					<div class="deposit-badge">
						<span>Аванс ({priceResult.depositPercent}%):</span>
						<strong>{priceResult.depositAmount} ₴</strong>
					</div>
					<div class="remaining-badge">
						<span>Залишок після виготовлення:</span>
						<strong>{priceResult.remainingAmount} ₴</strong>
					</div>
				</div>
			{/if}

			{#if priceResult.estimateNotice}
				<div class="estimate-notice-bar">
					<AlertTriangle size={14} />
					<span>{priceResult.estimateNotice}</span>
				</div>
			{/if}

			<button
				type="button"
				class="pay-btn"
				class:blocked={!priceResult.canInstantPay}
				onclick={handlePayClick}
			>
				{#if !priceResult.canInstantPay}
					<Send size={18} />
					<span>Надіслати на оцінку майстру</span>
				{:else if priceResult.depositAmount < priceResult.totalAmount && priceResult.depositAmount > 0}
					<ShieldCheck size={18} />
					<span>Внести аванс {priceResult.depositAmount} ₴</span>
				{:else}
					<ShieldCheck size={18} />
					<span>Оплатити {priceResult.totalAmount} ₴</span>
				{/if}
			</button>

			<div class="lead-time-footer">
				<span>🕒 {priceResult.leadTimeNotice}</span>
			</div>
		</div>
	</footer>
</div>

<style>
	.preview-container {
		display: flex;
		flex-direction: column;
		background: #f8fafc;
		border-radius: 12px;
		overflow: hidden;
		font-family: inherit;
		color: #0f172a;
	}

	.store-hero {
		background: linear-gradient(135deg, #1e293b, #0f172a);
		color: #ffffff;
		padding: 1.25rem 1rem;
		text-align: center;
	}

	.store-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		color: #f472b6;
		background: rgba(244, 114, 182, 0.15);
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		margin-bottom: 0.4rem;
	}

	.store-title {
		font-size: 1.15rem;
		font-weight: 700;
		margin: 0;
	}

	.store-tagline {
		font-size: 0.78rem;
		color: #94a3b8;
		margin: 0.25rem 0 0 0;
	}

	.mode-tabs {
		display: flex;
		background: #ffffff;
		border-bottom: 1px solid #e2e8f0;
		padding: 0.35rem 0.5rem;
		gap: 0.35rem;
		overflow-x: auto;
	}

	.mode-tab {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.75rem;
		border: none;
		background: transparent;
		font-size: 0.8rem;
		font-weight: 500;
		color: #64748b;
		border-radius: 6px;
		cursor: pointer;
		white-space: nowrap;
	}

	.mode-tab.active {
		background: #fdf2f8;
		color: #db2777;
		font-weight: 600;
	}

	.flow-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.flow-section {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.92rem;
		font-weight: 700;
		color: #1e293b;
	}

	.step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: #ec4899;
		color: #ffffff;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.products-selector {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.product-card-btn {
		border: 1.5px solid #e2e8f0;
		background: #fafafa;
		border-radius: 8px;
		padding: 0.75rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.product-card-btn.selected {
		border-color: #ec4899;
		background: #fdf2f8;
	}

	.prod-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.prod-name {
		font-weight: 600;
		font-size: 0.88rem;
		color: #0f172a;
	}

	.prod-price {
		font-weight: 700;
		font-size: 0.88rem;
		color: #db2777;
	}

	.prod-desc {
		font-size: 0.75rem;
		color: #64748b;
		margin: 0;
	}

	.sub-block {
		border-top: 1px dashed #e2e8f0;
		padding-top: 0.75rem;
	}

	.sub-title {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: #475569;
		margin-bottom: 0.35rem;
	}

	.sub-hint {
		display: block;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.colors-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.color-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		border-radius: 20px;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.color-btn.selected {
		border-color: #ec4899;
		background: #fdf2f8;
		font-weight: 600;
		color: #db2777;
	}

	.color-swatch {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.15);
	}

	.flex-between {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #f1f5f9;
		padding: 0.2rem;
		border-radius: 8px;
	}

	.stepper-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		border-radius: 6px;
		cursor: pointer;
	}

	.stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.stepper-val {
		font-size: 0.85rem;
		font-weight: 700;
		padding: 0 0.5rem;
	}

	.multi-name-toggle {
		display: flex;
		background: #f1f5f9;
		border-radius: 6px;
		padding: 0.2rem;
		gap: 0.2rem;
	}

	.toggle-opt {
		flex: 1;
		border: none;
		background: transparent;
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		color: #475569;
		border-radius: 4px;
		cursor: pointer;
		text-align: center;
	}

	.toggle-opt.active {
		background: #ffffff;
		color: #0f172a;
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.options-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.opt-btn {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		border-radius: 8px;
		padding: 0.6rem;
		text-align: left;
		cursor: pointer;
	}

	.opt-btn.selected {
		border-color: #ec4899;
		background: #fdf2f8;
	}

	.opt-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #1e293b;
		margin-bottom: 0.15rem;
	}

	.opt-price {
		font-size: 0.75rem;
		font-weight: 700;
		color: #db2777;
	}

	.pack-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
	}

	.pack-icon {
		font-size: 1.2rem;
	}

	.control-input {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		box-sizing: border-box;
		background: #ffffff;
	}

	.control-textarea {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		box-sizing: border-box;
		background: #ffffff;
		resize: vertical;
	}

	.multi-names-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.name-idx {
		font-size: 0.78rem;
		font-weight: 700;
		color: #64748b;
		width: 24px;
	}

	.mockup-card {
		background: #fdf4ff;
		border: 1px solid #f0abfc;
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
	}

	.mockup-header {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.mockup-icon {
		font-size: 1.4rem;
	}

	.mockup-note {
		font-size: 0.72rem;
		color: #86198f;
		margin: 0.15rem 0 0 0;
	}

	.mockup-checkbox {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #86198f;
		cursor: pointer;
	}

	.delivery-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
	}

	.toggle-btn.active {
		border-color: #ec4899;
		background: #fdf2f8;
		color: #db2777;
		font-weight: 600;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
	}

	.gift-recipient-wrap {
		border-top: 1px dashed #e2e8f0;
		padding-top: 0.6rem;
	}

	.recipient-fields {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #f8fafc;
		border-radius: 6px;
	}

	.privacy-note {
		font-size: 0.68rem;
		color: #64748b;
		margin: 0;
		line-height: 1.35;
	}

	.pickup-info-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 0.65rem;
		font-size: 0.8rem;
	}

	/* Mockup Review Visualizer */
	.mockup-review-section {
		border-color: #c084fc;
		background: #faf5ff;
	}

	.mockup-status-box {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.status-badge-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.version-tag {
		font-size: 0.72rem;
		font-weight: 700;
		background: #e9d5ff;
		color: #6b21a8;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}

	.status-tag {
		font-size: 0.75rem;
		font-weight: 600;
		color: #b45309;
	}

	.status-tag.ok {
		color: #15803d;
	}

	.mockup-preview-render {
		background: #ffffff;
		border: 1px solid #e9d5ff;
		border-radius: 8px;
		padding: 1.25rem 0.5rem 0.75rem 0.5rem;
		text-align: center;
	}

	.preview-notebook {
		display: inline-block;
		margin: 0 auto;
	}

	.notebook-cover {
		width: 140px;
		height: 180px;
		border-radius: 6px 12px 12px 6px;
		box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.25);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		color: #ffffff;
	}

	.engraving-text {
		font-family: 'Georgia', serif;
		font-size: 0.85rem;
		color: #f59e0b;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
		text-align: center;
		letter-spacing: 0.5px;
	}

	.notebook-strap {
		position: absolute;
		right: 15px;
		top: 0;
		bottom: 0;
		width: 10px;
		background: rgba(255, 255, 255, 0.15);
	}

	.mockup-caption {
		font-size: 0.7rem;
		color: #6b7280;
		margin: 0.5rem 0 0 0;
	}

	.mockup-actions {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 0.5rem;
	}

	.btn-approve {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		background: #10b981;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.55rem;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-approve.active {
		background: #059669;
	}

	.btn-reject {
		background: #ffffff;
		border: 1px solid #d1d5db;
		color: #4b5563;
		border-radius: 6px;
		padding: 0.55rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.production-rule-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		background: #fef3c7;
		border: 1px solid #fde68a;
		border-radius: 6px;
		padding: 0.5rem 0.65rem;
		font-size: 0.72rem;
		color: #92400e;
		line-height: 1.35;
	}

	.callout-idea {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		padding: 0.75rem;
		font-size: 0.8rem;
		color: #166534;
		line-height: 1.4;
	}

	.grid-2-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	/* Summary & Checkout Footer */
	.pricing-summary {
		background: #ffffff;
		border-top: 1px solid #e2e8f0;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.breakdown-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		border-bottom: 1px solid #f1f5f9;
		padding-bottom: 0.65rem;
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #475569;
	}

	.breakdown-row.onetime {
		color: #0f172a;
		font-weight: 500;
	}

	.onetime-tag {
		font-size: 0.65rem;
		background: #f1f5f9;
		color: #64748b;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		margin-left: 0.25rem;
	}

	.totals-section {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.lbl-total {
		font-size: 0.92rem;
		font-weight: 700;
		color: #0f172a;
	}

	.total-amount {
		font-size: 1.25rem;
		font-weight: 800;
		color: #0f172a;
	}

	.split-pay-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.deposit-badge {
		background: #fdf2f8;
		border: 1px solid #fbcfe8;
		border-radius: 6px;
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
		font-size: 0.72rem;
		color: #be185d;
	}

	.deposit-badge strong {
		font-size: 0.95rem;
		color: #9d174d;
	}

	.remaining-badge {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
		font-size: 0.72rem;
		color: #475569;
	}

	.remaining-badge strong {
		font-size: 0.95rem;
		color: #1e293b;
	}

	.estimate-notice-bar {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 6px;
		padding: 0.45rem 0.6rem;
		font-size: 0.72rem;
		color: #92400e;
	}

	.pay-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem;
		background: #ec4899;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.92rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(236, 72, 153, 0.25);
		transition: all 0.15s ease;
	}

	.pay-btn:hover:not(.blocked) {
		background: #db2777;
	}

	.pay-btn.blocked {
		background: #3b82f6;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.25);
	}

	.lead-time-footer {
		text-align: center;
		font-size: 0.72rem;
		color: #64748b;
	}
</style>
