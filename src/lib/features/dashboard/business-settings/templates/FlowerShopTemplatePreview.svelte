<script lang="ts">
	import {
		Sparkles,
		Gift,
		Truck,
		MapPin,
		Calendar,
		Clock,
		Check,
		ChevronRight,
		ChevronLeft,
		AlertTriangle,
		Send,
		Store,
		Receipt,
		ShieldCheck
	} from '@lucide/svelte';
	import type { FlowerShopFlowData } from '$lib/features/shared/checkout-scenario-config';
	import {
		calculateFlowerOrderPrice,
		pruneFlowerSelections,
		type FlowerOrderSelections
	} from '$lib/features/shared/flower-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<FlowerShopFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: FlowerShopFlowData = {
		shopName: 'Floris Квіти',
		tagline: 'Авторська флористика та свіжі букети',
		description: 'Свіжі квіти зі швидкою доставкою або самовивозом за 30 хв',
		contacts: {
			phone: '+380 67 444 55 66',
			instagram: '@floris.kyiv',
			telegram: '@floris_kyiv_bot',
			address: 'вул. Саксаганського, 42'
		},
		modes: {
			catalogEnabled: true,
			customOrderEnabled: true,
			inStorePayEnabled: true,
			catalogButtonText: 'Готовий букет',
			customOrderButtonText: 'На замовлення',
			inStoreButtonText: 'В салоні'
		},
		bouquets: [
			{
				id: 'bq_tenderness',
				name: 'Ніжність',
				category: 'Авторські',
				description: 'Французькі півонії, біла еустома, евкаліпт',
				icon: '🌸',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандартний', price: 900, isDefault: true },
					{ id: 'large', name: 'Великий', price: 1300 },
					{ id: 'vip', name: 'VIP Преміум', price: 1900 }
				]
			},
			{
				id: 'bq_roses_25',
				name: '25 червоних троянд Grand Prix',
				category: 'Монобукети',
				description: 'Еквадорські троянди 60 см у фірмовому крафті',
				icon: '🌹',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандартний (60 см)', price: 1250, isDefault: true },
					{ id: 'large', name: 'Преміум (70 см)', price: 1850 }
				]
			},
			{
				id: 'bq_mix_box',
				name: 'Сезонний мікс у капелюшній коробці',
				category: 'Композиції',
				description: 'Гортензія, кущова півонієподібна троянда',
				icon: '💐',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандарт (22 см)', price: 1100, isDefault: true },
					{ id: 'large', name: 'Великий (30 см)', price: 1650 }
				]
			}
		],
		addons: [
			{
				id: 'addon_postcard',
				name: 'Фірмова листівка з підписом',
				price: 50,
				isPostcard: true,
				description: 'Підпишемо від руки каліграфічно',
				icon: '✉️'
			},
			{
				id: 'addon_vase',
				name: 'Скляна дизайнерська ваза',
				price: 250,
				description: 'Ідеально підібрана за висотою букета',
				icon: '🏺'
			},
			{
				id: 'addon_box',
				name: 'Преміальне пакування та аквабокс',
				price: 80,
				description: 'Захисний вологостійкий резервуар для свіжості',
				icon: '🎀'
			},
			{
				id: 'addon_sweets',
				name: 'Крафтові макаруни (6 шт)',
				price: 180,
				description: 'Свіжі десерти від кондитера',
				icon: '🍬'
			}
		],
		pickupPoints: [
			{
				id: 'point_1',
				name: 'Салон Центр (Саксаганського)',
				address: 'вул. Саксаганського, 42',
				workingHours: '08:00 - 21:00'
			},
			{
				id: 'point_2',
				name: 'Студія Поділ (Спаська)',
				address: 'вул. Спаська, 12',
				workingHours: '09:00 - 20:00'
			}
		],
		deliveryZones: [
			{
				id: 'zone_a',
				name: 'Зона А (Центр, Печерськ)',
				price: 150,
				eta: 'до 60 хв',
				description: 'Швидка кур’єрська доставка'
			},
			{
				id: 'zone_b',
				name: 'Зона B (Оболонь, Позняки)',
				price: 250,
				eta: 'до 90 хв',
				description: 'Доставка по місту'
			}
		],
		customOrder: {
			minBudget: 800,
			defaultBudget: 1500,
			palettes: [
				{ id: 'pastel', name: 'Ніжна пастельна', colors: ['#fce7f3', '#fed7aa', '#e0e7ff'] },
				{ id: 'bright', name: 'Яскрава соковита', colors: ['#f43f5e', '#f59e0b', '#8b5cf6'] },
				{ id: 'white', name: 'Білосніжна класика', colors: ['#ffffff', '#f1f5f9', '#86efac'] },
				{ id: 'passion', name: 'Пристрасна червона', colors: ['#991b1b', '#ef4444', '#fbcfe8'] }
			],
			flowerOptions: ['Півонії', 'Гортензії', 'Кущові троянди', 'Еустоми', 'Тюльпани', 'Евкаліпт']
		},
		approval: {
			autoApprovalEnabled: true,
			requireManualForCustom: true,
			requireManualOutOfZone: true,
			replacementPolicy: 'same_palette',
			telegramChat: '@floris_kyiv_bot',
			responseTimeNotice: 'до 10 хвилин'
		},
		payment: {
			depositType: 'full',
			depositValue: 100,
			paymentTimeoutMinutes: 30
		}
	};

	const data = $derived<FlowerShopFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts ?? {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes ?? {}) },
		bouquets: flowData?.bouquets?.length ? flowData.bouquets : defaultData.bouquets,
		addons: flowData?.addons?.length ? flowData.addons : defaultData.addons,
		pickupPoints: flowData?.pickupPoints?.length ? flowData.pickupPoints : defaultData.pickupPoints,
		deliveryZones: flowData?.deliveryZones?.length ? flowData.deliveryZones : defaultData.deliveryZones,
		customOrder: { ...defaultData.customOrder, ...(flowData?.customOrder ?? {}) },
		approval: { ...defaultData.approval, ...(flowData?.approval ?? {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment ?? {}) }
	});

	let currentMode = $state<'catalog' | 'custom' | 'instore'>('catalog');
	let step = $state<1 | 2 | 3 | 4>(1);

	// Catalog selections (defaulting to the prompt's 1 500 ₴ case: large bouquet 1300 + postcard 50 + delivery Zone A 150 = 1500)
	let selectedBouquetId = $state<string>('bq_tenderness');
	let selectedSizeId = $state<string>('large');
	let selectedAddonIds = $state<string[]>(['addon_postcard']);
	let greetingText = $state('З днем народження, кохана! Дякую за кожну спільну мить! ❤️');
	let fulfillmentType = $state<'pickup' | 'delivery'>('delivery');
	let pickupPointId = $state('point_1');
	let deliveryZoneId = $state('zone_a');
	let deliveryAddress = $state('вул. Шовковична, 14, кв. 28');
	let isSurpriseGift = $state(true);
	let recipientName = $state('Марія Коваленко');
	let recipientPhone = $state('+380 97 123 45 67');
	let deliveryDate = $state('Сьогодні');
	let deliverySlot = $state('16:00 - 18:00');

	// Custom order selections
	let customBudget = $state(1500);
	let customPaletteId = $state('pastel');
	let customWishes = $state('Побільше білих півоній, ніжної еустоми та багато свіжого евкаліпту');

	// In-store payment
	let inStoreReceiptId = $state('FL-842');
	let inStoreAmount = $state(850);

	// Derived current bouquet
	const currentBouquet = $derived(
		data.bouquets.find((b) => b.id === selectedBouquetId) ?? data.bouquets[0]
	);

	// Sync size if bouquet changes and doesn't contain current size
	$effect(() => {
		if (currentBouquet && !currentBouquet.sizes.some((s) => s.id === selectedSizeId)) {
			const defSize = currentBouquet.sizes.find((s) => s.isDefault) ?? currentBouquet.sizes[0];
			if (defSize) {
				selectedSizeId = defSize.id;
			}
		}
	});

	// Reactive calculation
	const pricing = $derived.by(() => {
		const rawSelections: FlowerOrderSelections = {
			mode: currentMode,
			selectedBouquetId,
			selectedSizeId,
			selectedAddonIds,
			fulfillmentType,
			pickupPointId,
			deliveryZoneId,
			deliveryAddress,
			customBudget,
			customPaletteId,
			customWishes,
			hasGreetingPostcard: selectedAddonIds.includes('addon_postcard'),
			greetingText,
			isSurpriseGift,
			recipientName,
			recipientPhone,
			deliveryDate,
			deliveryTimeSlot: deliverySlot,
			inStoreReceiptId,
			inStoreAmount
		};

		const pruned = pruneFlowerSelections(rawSelections, data);
		return calculateFlowerOrderPrice(data, pruned);
	});

	function toggleAddon(addonId: string) {
		if (selectedAddonIds.includes(addonId)) {
			selectedAddonIds = selectedAddonIds.filter((id) => id !== addonId);
		} else {
			selectedAddonIds = [...selectedAddonIds, addonId];
		}
	}

	function handlePayClick() {
		if (pricing.canInstantPay) {
			onPay(pricing.totalAmount);
		} else {
			alert('Дякуємо! Ваше замовлення надіслано флористу в Telegram для перевірки наявності свіжих квітів.');
		}
	}
</script>

<div class="ios-preview-container">
	<!-- iOS Navigation Bar -->
	<header class="ios-nav-bar">
		<div class="ios-nav-content">
			<span class="ios-merchant-badge">🌸 {data.shopName}</span>
			<span class="ios-secure-tag"><ShieldCheck size={12} /> Флористика</span>
		</div>
	</header>

	<!-- iOS Segmented Mode Control -->
	<div class="ios-segmented-control">
		{#if data.modes.catalogEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'catalog'}
				onclick={() => { currentMode = 'catalog'; step = 1; }}
			>
				{data.modes.catalogButtonText || 'Букети'}
			</button>
		{/if}
		{#if data.modes.customOrderEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'custom'}
				onclick={() => (currentMode = 'custom')}
			>
				{data.modes.customOrderButtonText || 'На замовлення'}
			</button>
		{/if}
		{#if data.modes.inStorePayEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'instore'}
				onclick={() => (currentMode = 'instore')}
			>
				{data.modes.inStoreButtonText || 'В салоні'}
			</button>
		{/if}
	</div>

	<!-- CATALOG MODE (4 APPLE HIG STEP WINDOWS) -->
	{#if currentMode === 'catalog'}
		<!-- Step Header & Progress Capsules -->
		<div class="ios-step-indicator">
			<div class="ios-capsules">
				<div class="ios-capsule" class:filled={step >= 1}></div>
				<div class="ios-capsule" class:filled={step >= 2}></div>
				<div class="ios-capsule" class:filled={step >= 3}></div>
				<div class="ios-capsule" class:filled={step >= 4}></div>
			</div>
			<div class="ios-step-title-wrap">
				<span class="ios-step-sub">Крок {step} з 4</span>
				<h4 class="ios-step-title">
					{#if step === 1}
						Букет та розмір
					{:else if step === 2}
						Додатки та привітання
					{:else if step === 3}
						Отримання та адресат
					{:else if step === 4}
						Кошторис та оплата
					{/if}
				</h4>
			</div>
		</div>

		<div class="ios-window-body">
			<!-- WINDOW 1: BOUQUET & SIZE -->
			{#if step === 1}
				<!-- Bouquets List -->
				<div class="ios-card">
					<span class="ios-card-title">Оберіть букет з каталогу:</span>
					<div class="ios-items-stack">
						{#each data.bouquets as bouquet (bouquet.id)}
							<button
								type="button"
								class="ios-bouquet-row"
								class:selected={selectedBouquetId === bouquet.id}
								onclick={() => (selectedBouquetId = bouquet.id)}
							>
								<span class="ios-bq-icon">{bouquet.icon || '🌸'}</span>
								<div class="ios-bq-info">
									<div class="ios-bq-name">{bouquet.name}</div>
									<div class="ios-bq-desc">{bouquet.description}</div>
								</div>
								<strong class="ios-bq-price">
									від {bouquet.sizes[0]?.price ?? 900} ₴
								</strong>
							</button>
						{/each}
					</div>
				</div>

				<!-- Bouquet Size Chips (Replaces base price) -->
				{#if currentBouquet}
					<div class="ios-card">
						<span class="ios-card-title">Розмір букета:</span>
						<div class="ios-sizes-grid">
							{#each currentBouquet.sizes as sz (sz.id)}
								<button
									type="button"
									class="ios-size-chip"
									class:selected={selectedSizeId === sz.id}
									onclick={() => (selectedSizeId = sz.id)}
								>
									<span class="ios-size-name">{sz.name}</span>
									<strong class="ios-size-price">{sz.price} ₴</strong>
								</button>
							{/each}
						</div>
						<div class="ios-card-sub text-[11px] mt-2 text-zinc-500">
							💡 Обраний розмір замінює базову ціну букета, а не додається до неї.
						</div>
					</div>
				{/if}

			<!-- WINDOW 2: ADDONS & GREETING POSTCARD -->
			{:else if step === 2}
				<div class="ios-card">
					<span class="ios-card-title">Додати до замовлення:</span>
					<div class="ios-items-stack">
						{#each data.addons as addon (addon.id)}
							{@const checked = selectedAddonIds.includes(addon.id)}
							<button
								type="button"
								class="ios-addon-row"
								class:selected={checked}
								onclick={() => toggleAddon(addon.id)}
							>
								<span class="ios-addon-icon">{addon.icon || '🎁'}</span>
								<div class="ios-addon-info">
									<div class="ios-addon-name">{addon.name}</div>
									{#if addon.description}
										<div class="ios-addon-desc">{addon.description}</div>
									{/if}
								</div>
								<div class="ios-addon-right">
									<strong class="ios-addon-price">+{addon.price} ₴</strong>
									<span class="ios-addon-check" class:checked>{checked ? '✓' : ''}</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				{#if selectedAddonIds.includes('addon_postcard')}
					<div class="ios-card">
						<label>
							<span class="ios-card-title">✉️ Текст на листівці (каліграфічний підпис):</span>
							<textarea
								class="ios-textarea"
								rows="2"
								bind:value={greetingText}
								placeholder="Напишіть теплі слова, які флорист перенесе на фірмову листівку..."
							></textarea>
						</label>
					</div>
				{/if}

			<!-- WINDOW 3: FULFILLMENT & RECIPIENT -->
			{:else if step === 3}
				<!-- Delivery Type Toggle -->
				<div class="ios-card">
					<span class="ios-card-title">Спосіб отримання:</span>
					<div class="ios-segmented-control mb-2.5">
						<button
							type="button"
							class="ios-segment-btn"
							class:active={fulfillmentType === 'delivery'}
							onclick={() => (fulfillmentType = 'delivery')}
						>
							<Truck size={13} class="inline mr-1" /> Доставка кур'єром
						</button>
						<button
							type="button"
							class="ios-segment-btn"
							class:active={fulfillmentType === 'pickup'}
							onclick={() => (fulfillmentType = 'pickup')}
						>
							<Store size={13} class="inline mr-1" /> Самовивіз (0 ₴)
						</button>
					</div>

					{#if fulfillmentType === 'delivery'}
						<!-- Delivery Zones Selection -->
						<div class="ios-items-stack mb-2.5">
							{#each data.deliveryZones as zone (zone.id)}
								<button
									type="button"
									class="ios-zone-row"
									class:selected={deliveryZoneId === zone.id}
									onclick={() => (deliveryZoneId = zone.id)}
								>
									<div>
										<div class="ios-zone-name">{zone.name}</div>
										<div class="ios-zone-desc">{zone.description} · {zone.eta}</div>
									</div>
									<strong class="ios-zone-price">+{zone.price} ₴</strong>
								</button>
							{/each}
						</div>

						<label class="mb-2.5 block">
							<span class="ios-input-lbl">Адреса доставки:</span>
							<input
								type="text"
								class="ios-input"
								bind:value={deliveryAddress}
								placeholder="м. Київ, вул. Шовковична, 14, кв. 28"
							/>
						</label>

						<div class="ios-grid-2 mb-2.5">
							<label>
								<span class="ios-input-lbl">Бажана дата:</span>
								<input type="text" class="ios-input" bind:value={deliveryDate} />
							</label>
							<label>
								<span class="ios-input-lbl">Часовий інтервал:</span>
								<input type="text" class="ios-input" bind:value={deliverySlot} />
							</label>
						</div>

						<!-- Recipient Gift Toggle -->
						<div class="ios-gift-box">
							<label class="ios-checkbox-label">
								<input type="checkbox" class="ios-checkbox" bind:checked={isSurpriseGift} />
								<span>Це сюрприз / подарунок іншій людині 🎁</span>
							</label>

							{#if isSurpriseGift}
								<div class="ios-form-stack mt-2">
									<label>
										<span class="ios-input-lbl">Ім'я одержувача:</span>
										<input
											type="text"
											class="ios-input"
											bind:value={recipientName}
											placeholder="Марія Коваленко"
										/>
									</label>
									<label>
										<span class="ios-input-lbl">Телефон одержувача:</span>
										<input
											type="tel"
											class="ios-input"
											bind:value={recipientPhone}
											placeholder="+380..."
										/>
									</label>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Pickup Point -->
						<div class="ios-items-stack">
							{#each data.pickupPoints as pt (pt.id)}
								<button
									type="button"
									class="ios-zone-row"
									class:selected={pickupPointId === pt.id}
									onclick={() => (pickupPointId = pt.id)}
								>
									<div>
										<div class="ios-zone-name">{pt.name}</div>
										<div class="ios-zone-desc">{pt.address} ({pt.workingHours})</div>
									</div>
									<strong class="ios-zone-price text-emerald-600">0 ₴</strong>
								</button>
							{/each}
						</div>
					{/if}
				</div>

			<!-- WINDOW 4: APPLE WALLET PASS RECEIPT & CONFIRMATION -->
			{:else if step === 4}
				<!-- Apple Pass / Wallet Card -->
				<div class="ios-pass-card">
					<div class="ios-pass-head">
						<div>
							<span class="ios-pass-tag">Замовлення квітів</span>
							<h5 class="ios-pass-title">{currentBouquet.name}</h5>
						</div>
						<span class="ios-pass-badge">🌸 {pricing.fulfillmentSummary}</span>
					</div>

					<div class="ios-pass-body">
						{#each pricing.breakdown as item}
							<div class="ios-pass-row">
								<span class="ios-pass-lbl">{item.label}</span>
								<strong class="ios-pass-val">{item.amount} ₴</strong>
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
							<span>Загальна сума:</span>
							<strong class="ios-total-sum">{pricing.totalAmount} ₴</strong>
						</div>

						<div class="ios-policy-note mt-2">
							<ShieldCheck size={13} class="text-emerald-600 shrink-0 inline" />
							<span>Заміна квітів допускається виключно у тій самій кольоровій гамі.</span>
						</div>

						{#if pricing.estimateNotice}
							<div class="ios-estimate-alert">
								<AlertTriangle size={13} />
								<span>{pricing.estimateNotice}</span>
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

			{#if step < 4}
				<button
					type="button"
					class="ios-btn-primary flex-1"
					onclick={() => step = (step + 1) as 1 | 2 | 3 | 4}
				>
					{#if step === 1}
						Додатки та листівка
					{:else if step === 2}
						Доставка та час
					{:else if step === 3}
						Перейти до оплати
					{/if}
					<ChevronRight size={16} />
				</button>
			{:else}
				<button
					type="button"
					class="ios-btn-primary flex-1"
					class:estimate-btn={!pricing.canInstantPay}
					onclick={handlePayClick}
				>
					{#if !pricing.canInstantPay}
						<Send size={15} />
						<span>Надіслати флористу ({pricing.totalAmount} ₴)</span>
					{:else}
						<ShieldCheck size={16} />
						<span>Оплатити {pricing.totalAmount} ₴</span>
					{/if}
				</button>
			{/if}
		</div>

	<!-- CUSTOM ORDER MODE -->
	{:else if currentMode === 'custom'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Індивідуальний букет від флориста:</span>
				<p class="ios-card-sub">Опишіть ваші побажання щодо складу квітів, відтінків та форми композиції.</p>
				<textarea
					class="ios-textarea mt-2"
					rows="3"
					bind:value={customWishes}
					placeholder="Наприклад: більше півоній, ніжна еустома, багато свіжого евкаліпту..."
				></textarea>
			</div>

			<div class="ios-card">
				<div class="ios-grid-2">
					<label>
						<span class="ios-input-lbl">Бажаний бюджет (₴):</span>
						<input
							type="number"
							min="800"
							step="100"
							class="ios-input"
							bind:value={customBudget}
						/>
					</label>
					<label>
						<span class="ios-input-lbl">Кольорова гама:</span>
						<select class="ios-input" bind:value={customPaletteId}>
							{#each data.customOrder.palettes as pal}
								<option value={pal.id}>{pal.name}</option>
							{/each}
						</select>
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
					<span>Надіслати флористу на оцінку</span>
				</button>
			</div>
		</div>

	<!-- IN-STORE MODE -->
	{:else if currentMode === 'instore'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Оплата на касі в салоні:</span>
				<div class="ios-form-stack mt-2">
					<label>
						<span class="ios-input-lbl">Номер чека / замовлення:</span>
						<input
							type="text"
							class="ios-input"
							bind:value={inStoreReceiptId}
							placeholder="FL-..."
						/>
					</label>
					<label>
						<span class="ios-input-lbl">Сума до сплати (₴):</span>
						<input
							type="number"
							min="1"
							class="ios-input"
							bind:value={inStoreAmount}
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
					<span>Оплатити в салоні {inStoreAmount} ₴</span>
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

	.ios-items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-bouquet-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
	}

	.ios-bouquet-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-bq-icon {
		font-size: 1.4rem;
	}

	.ios-bq-info {
		flex: 1;
	}

	.ios-bq-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-bq-desc {
		font-size: 0.68rem;
		color: #8e8e93;
	}

	.ios-bq-price {
		font-size: 0.85rem;
		color: #007aff;
	}

	.ios-sizes-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
	}

	.ios-size-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.55rem 0.35rem;
		border-radius: 8px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
	}

	.ios-size-chip.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-size-name {
		font-size: 0.72rem;
		color: #636366;
	}

	.ios-size-price {
		font-size: 0.82rem;
		color: #007aff;
		margin-top: 2px;
	}

	.ios-addon-row {
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

	.ios-addon-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-addon-icon {
		font-size: 1.25rem;
	}

	.ios-addon-info {
		flex: 1;
	}

	.ios-addon-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-addon-desc {
		font-size: 0.68rem;
		color: #8e8e93;
	}

	.ios-addon-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ios-addon-price {
		font-size: 0.8rem;
		color: #007aff;
	}

	.ios-addon-check {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		border: 1px solid #c7c7cc;
		font-size: 0.65rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
	}

	.ios-addon-check.checked {
		background: #007aff;
		border-color: #007aff;
	}

	.ios-zone-row {
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

	.ios-zone-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-zone-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-zone-desc {
		font-size: 0.68rem;
		color: #8e8e93;
	}

	.ios-zone-price {
		font-size: 0.82rem;
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

	.ios-checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		color: #1c1c1e;
		cursor: pointer;
	}

	.ios-checkbox {
		width: 18px;
		height: 18px;
		accent-color: #007aff;
		cursor: pointer;
	}

	.ios-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
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

	.ios-policy-note {
		font-size: 0.7rem;
		color: #15803d;
		display: flex;
		align-items: center;
		gap: 4px;
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
