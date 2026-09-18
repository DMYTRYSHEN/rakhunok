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
		AlertTriangle,
		Send,
		Store,
		Receipt,
		ShieldCheck,
		ArrowLeft
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
			catalogButtonText: 'Обрати готовий букет',
			customOrderButtonText: 'Індивідуальний букет',
			inStoreButtonText: 'Оплатити в магазині'
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
				name: 'Преміальне пакування та стрічка',
				price: 80,
				description: 'Захисний вологостійкий аквабокс',
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

	// Active mode
	let currentMode = $state<'catalog' | 'custom' | 'instore'>('catalog');

	// Catalog selections (defaulting to the prompt's 1 500 ₴ case: large bouquet + postcard + delivery Zone A)
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

	// Confirmation state
	let requestSubmitted = $state(false);

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

	function handleAction() {
		if (pricing.canInstantPay) {
			onPay(pricing.totalAmount);
		} else {
			requestSubmitted = true;
		}
	}
</script>

<div class="flower-phone-preview flex flex-col h-full bg-zinc-50 text-zinc-900 select-none pb-8 text-left">
	<!-- Top Brand Banner -->
	<div class="border-b border-pink-100 bg-linear-to-r from-pink-50 via-rose-50 to-white px-4 py-3">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-extrabold text-pink-950 flex items-center gap-1.5">
					<span>🌸</span>
					<span>{data.shopName}</span>
				</h3>
				<p class="text-[11px] text-pink-800/80 line-clamp-1">{data.tagline}</p>
			</div>
			<div class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
				<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>Приймаємо</span>
			</div>
		</div>

		<!-- Path Switcher (3 Customer Paths) -->
		<div class="mt-2.5 flex rounded-lg bg-pink-100/70 p-0.5 text-[11px] font-semibold">
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'catalog' ? 'bg-white text-pink-900 shadow-xs' : 'text-pink-900/70 hover:text-pink-950'}"
				onclick={() => { currentMode = 'catalog'; requestSubmitted = false; }}
			>
				💐 Букети
			</button>
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'custom' ? 'bg-white text-pink-900 shadow-xs' : 'text-pink-900/70 hover:text-pink-950'}"
				onclick={() => { currentMode = 'custom'; requestSubmitted = false; }}
			>
				✨ На замовлення
			</button>
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'instore' ? 'bg-white text-pink-900 shadow-xs' : 'text-pink-900/70 hover:text-pink-950'}"
				onclick={() => { currentMode = 'instore'; requestSubmitted = false; }}
			>
				🏪 В салоні
			</button>
		</div>
	</div>

	<!-- SUBMITTED SCREEN -->
	{#if requestSubmitted}
		<div class="flex-1 p-5 flex flex-col items-center justify-center text-center space-y-4">
			<div class="size-14 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shadow-inner">
				<Send size={26} />
			</div>
			<div>
				<h4 class="text-base font-bold text-zinc-900">Запит успішно надіслано!</h4>
				<p class="mt-1 text-xs text-zinc-500 leading-relaxed max-w-xs">
					Флорист отримав параметри вашого замовлення у Telegram. Ми перевіримо свіжість квітів та надішлемо вам фото букета перед оплатою.
				</p>
			</div>
			<div class="w-full rounded-xl border border-zinc-200 bg-white p-3.5 text-left text-xs space-y-1.5">
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Орієнтовна сума:</span>
					<strong class="text-zinc-900">{pricing.totalAmount.toLocaleString('uk-UA')} ₴</strong>
				</div>
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Спосіб:</span>
					<span class="text-zinc-800">{pricing.fulfillmentSummary}</span>
				</div>
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Очікування відповіді:</span>
					<span class="text-pink-700 font-semibold">{data.approval.responseTimeNotice || 'до 10 хв'}</span>
				</div>
			</div>
			<button
				type="button"
				class="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800"
				onclick={() => (requestSubmitted = false)}
			>
				Повернутись до замовлення
			</button>
		</div>
	{:else}
		<!-- PATH 1: READY CATALOG -->
		{#if currentMode === 'catalog'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<!-- Bouquet Card Selection -->
				<section>
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-1.5">1. Оберіть букет:</span>
					<div class="space-y-2">
						{#each data.bouquets as bouquet (bouquet.id)}
							<button
								type="button"
								class="w-full text-left rounded-xl border p-2.5 transition-all flex items-start gap-2.5 {selectedBouquetId === bouquet.id ? 'border-pink-500 bg-pink-50/40 ring-1 ring-pink-500' : 'border-zinc-200 bg-white hover:border-zinc-300'}"
								onclick={() => (selectedBouquetId = bouquet.id)}
							>
								<span class="text-2xl mt-0.5">{bouquet.icon || '🌸'}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between">
										<strong class="text-xs font-bold text-zinc-900">{bouquet.name}</strong>
										<span class="text-xs font-extrabold text-pink-700">від {bouquet.sizes[0]?.price ?? 900} ₴</span>
									</div>
									<p class="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{bouquet.description}</p>
									{#if !bouquet.isAvailable}
										<span class="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800">
											Під замовлення
										</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</section>

				<!-- Bouquet Size Selector (Prompt requirement: large replaces standard) -->
				{#if currentBouquet}
					<section class="rounded-xl border border-zinc-200 bg-white p-3">
						<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-2">2. Розмір букета:</span>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{#each currentBouquet.sizes as size (size.id)}
								<button
									type="button"
									class="rounded-lg border p-2 text-center transition-all {selectedSizeId === size.id ? 'border-pink-600 bg-pink-50 text-pink-950 font-bold ring-1 ring-pink-600' : 'border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100'}"
									onclick={() => (selectedSizeId = size.id)}
								>
									<span class="block text-xs">{size.name}</span>
									<span class="block text-xs font-extrabold text-pink-700 mt-0.5">{size.price} ₴</span>
								</button>
							{/each}
						</div>
						<div class="mt-2 rounded bg-zinc-50 p-2 text-[10px] text-zinc-500 border border-zinc-100 flex items-center gap-1.5">
							<ShieldCheck size={13} class="text-emerald-600 shrink-0" />
							<span>Обраний розмір замінює базову ціну, а не сумується до неї.</span>
						</div>
					</section>
				{/if}

				<!-- Add-ons (Postcard + Vase + Box) -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2.5">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">3. Додати до букета:</span>
					<div class="space-y-1.5">
						{#each data.addons as addon (addon.id)}
							<label class="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-100 p-2 hover:bg-zinc-50">
								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										class="size-4 rounded accent-pink-600"
										checked={selectedAddonIds.includes(addon.id)}
										onchange={() => toggleAddon(addon.id)}
									/>
									<span class="text-base">{addon.icon || '🎁'}</span>
									<div>
										<strong class="block text-xs font-semibold text-zinc-900">{addon.name}</strong>
										{#if addon.description}
											<span class="block text-[10px] text-zinc-500">{addon.description}</span>
										{/if}
									</div>
								</div>
								<span class="text-xs font-bold text-zinc-800">+{addon.price} ₴</span>
							</label>
						{/each}
					</div>

					<!-- Postcard Text Area (Conditional) -->
					{#if selectedAddonIds.includes('addon_postcard')}
						<div class="pt-1.5 border-t border-dashed border-zinc-200">
							<label class="block text-[11px] font-bold text-pink-900 mb-1">
								<span>✉️ Текст привітання на листівці:</span>
								<textarea
									rows="2"
									class="mt-1 w-full rounded-lg border border-pink-200 bg-pink-50/30 p-2 text-xs text-zinc-800 focus:border-pink-500 focus:outline-none font-normal"
									placeholder="Напишіть теплі слова... Флорист напише каліграфічно"
									bind:value={greetingText}
								></textarea>
							</label>
						</div>
					{/if}
				</section>

				<!-- Fulfillment Method (Pickup vs Delivery) -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2.5">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">4. Спосіб отримання:</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all {fulfillmentType === 'pickup' ? 'border-pink-600 bg-pink-50 text-pink-950 ring-1 ring-pink-600' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}"
							onclick={() => (fulfillmentType = 'pickup')}
						>
							<Store size={14} />
							<span>Самовивіз (0 ₴)</span>
						</button>
						<button
							type="button"
							class="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all {fulfillmentType === 'delivery' ? 'border-pink-600 bg-pink-50 text-pink-950 ring-1 ring-pink-600' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}"
							onclick={() => (fulfillmentType = 'delivery')}
						>
							<Truck size={14} />
							<span>Доставка кур'єром</span>
						</button>
					</div>

					{#if fulfillmentType === 'pickup'}
						<!-- Pickup point selection -->
						<div class="space-y-1.5 pt-1">
							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Оберіть салон для самовивозу:</span>
								<select
									class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
									bind:value={pickupPointId}
								>
									{#each data.pickupPoints as point (point.id)}
										<option value={point.id}>{point.name} — {point.address} ({point.workingHours})</option>
									{/each}
								</select>
							</label>
							<span class="block text-[10px] text-zinc-400">
								* При самовивозі адреса одержувача не запитується. Букет буде готовий до вашого візиту.
							</span>
						</div>
					{:else}
						<!-- Delivery fields -->
						<div class="space-y-2 pt-1">
							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Зона доставки:</span>
								<select
									class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
									bind:value={deliveryZoneId}
								>
									{#each data.deliveryZones as zone (zone.id)}
										<option value={zone.id}>{zone.name} (+{zone.price} ₴ · {zone.eta})</option>
									{/each}
									<option value="out_of_zone">За межі визначених зон (ручний прорахунок флористом)</option>
								</select>
							</label>

							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Адреса доставки:</span>
								<input
									type="text"
									class="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
									placeholder="вул. Хрещатик, 15, кв. 10"
									bind:value={deliveryAddress}
								/>
							</label>

							<!-- Gift for someone else toggle -->
							<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-pink-100 bg-pink-50/50 p-2">
								<input
									type="checkbox"
									class="size-3.5 rounded accent-pink-600"
									bind:checked={isSurpriseGift}
								/>
								<span class="text-xs font-semibold text-pink-950">Це подарунок іншій людині 🎁</span>
							</label>

							{#if isSurpriseGift}
								<div class="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-2 border border-zinc-200">
									<label class="block text-[10px] font-medium text-zinc-500">
										<span>Ім’я одержувача:</span>
										<input
											type="text"
											class="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 font-normal"
											placeholder="Марія"
											bind:value={recipientName}
										/>
									</label>
									<label class="block text-[10px] font-medium text-zinc-500">
										<span>Телефон одержувача:</span>
										<input
											type="text"
											class="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 font-normal"
											placeholder="+380..."
											bind:value={recipientPhone}
										/>
									</label>
									<span class="col-span-2 text-[10px] text-zinc-400">
										Контакти одержувача суто для кур'єра (ніяких SMS розсилок чи маркетингу).
									</span>
								</div>
							{/if}
						</div>
					{/if}
				</section>
			</div>
		{/if}

		<!-- PATH 2: CUSTOM BOUQUET -->
		{#if currentMode === 'custom'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<div class="rounded-xl border border-pink-200 bg-pink-50/40 p-3">
					<div class="flex items-center gap-1.5 text-pink-900 font-bold text-xs">
						<Sparkles size={15} class="text-pink-600" />
						<span>Індивідуальний букет від флориста</span>
					</div>
					<p class="mt-1 text-[11px] text-pink-800 leading-relaxed">
						Вкажіть ваш бюджет та побажання. Флорист підбере найкращі свіжі квіти з сьогоднішньої поставки та погодить фото букета перед оплатою.
					</p>
				</div>

				<!-- Budget Slider / Buttons -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Орієнтовний бюджет:</span>
						<strong class="text-sm font-extrabold text-pink-700">{customBudget} ₴</strong>
					</div>
					<input
						type="range"
						min="800"
						max="5000"
						step="100"
						class="w-full accent-pink-600 cursor-pointer"
						bind:value={customBudget}
					/>
					<div class="flex justify-between gap-1 text-[10px] text-zinc-400">
						<button type="button" class="underline" onclick={() => (customBudget = 1000)}>1 000 ₴</button>
						<button type="button" class="underline" onclick={() => (customBudget = 1500)}>1 500 ₴</button>
						<button type="button" class="underline" onclick={() => (customBudget = 2500)}>2 500 ₴</button>
						<button type="button" class="underline" onclick={() => (customBudget = 4000)}>4 000 ₴</button>
					</div>
				</section>

				<!-- Color Palette Selector -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">Колірна гама букета:</span>
					<div class="grid grid-cols-2 gap-2">
						{#each data.customOrder.palettes as palette (palette.id)}
							<button
								type="button"
								class="flex items-center gap-2 rounded-lg border p-2 text-left transition-all {customPaletteId === palette.id ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600' : 'border-zinc-200 bg-zinc-50'}"
								onclick={() => (customPaletteId = palette.id)}
							>
								<div class="flex -space-x-1 shrink-0">
									{#each palette.colors as color}
										<span class="size-3.5 rounded-full border border-white shadow-xs" style="background-color: {color};"></span>
									{/each}
								</div>
								<span class="text-xs font-semibold text-zinc-800 line-clamp-1">{palette.name}</span>
							</button>
						{/each}
					</div>
				</section>

				<!-- Wishes text -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-1.5">
					<label class="block text-[11px] font-bold text-zinc-700">
						<span>Побажання по квітах та оформленню:</span>
						<textarea
							rows="2"
							class="mt-1 w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-pink-500 focus:outline-none font-normal"
							placeholder="Наприклад: побільше півоній, без гвоздик, додати евкаліпт..."
							bind:value={customWishes}
						></textarea>
					</label>
				</section>

				<!-- Delivery for Custom -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">Отримання:</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class="rounded-lg border py-1.5 text-xs font-bold {fulfillmentType === 'pickup' ? 'border-pink-600 bg-pink-50 text-pink-900' : 'border-zinc-200 text-zinc-600'}"
							onclick={() => (fulfillmentType = 'pickup')}
						>
							Самовивіз (0 ₴)
						</button>
						<button
							type="button"
							class="rounded-lg border py-1.5 text-xs font-bold {fulfillmentType === 'delivery' ? 'border-pink-600 bg-pink-50 text-pink-900' : 'border-zinc-200 text-zinc-600'}"
							onclick={() => (fulfillmentType = 'delivery')}
						>
							Доставка (+150 ₴)
						</button>
					</div>
				</section>
			</div>
		{/if}

		<!-- PATH 3: IN-STORE QUICK PAY -->
		{#if currentMode === 'instore'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<div class="rounded-xl border border-zinc-200 bg-white p-4 text-center space-y-3">
					<div class="size-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 mx-auto">
						<Receipt size={22} />
					</div>
					<div>
						<h4 class="text-sm font-bold text-zinc-900">Оплата на касі в салоні</h4>
						<p class="text-xs text-zinc-500 mt-0.5">Введіть номер чека, який назвав флорист, або суму</p>
					</div>

					<div class="space-y-2 pt-2">
						<label class="block text-[10px] font-bold text-zinc-500 text-left uppercase">
							<span>Номер замовлення / чека:</span>
							<input
								type="text"
								class="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono font-bold text-center text-zinc-900"
								placeholder="FL-842"
								bind:value={inStoreReceiptId}
							/>
						</label>
						<label class="block text-[10px] font-bold text-zinc-500 text-left uppercase">
							<span>Сума до сплати (₴):</span>
							<input
								type="number"
								min="10"
								step="50"
								class="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-base font-extrabold text-center text-pink-700"
								bind:value={inStoreAmount}
							/>
						</label>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SUMMARY & CTA -->
		<div class="border-t border-zinc-200 bg-white p-4 shadow-lg space-y-3">
			<!-- Breakdown rows -->
			<div class="space-y-1 text-xs">
				{#each pricing.breakdown as row}
					<div class="flex items-center justify-between text-zinc-600">
						<span class="line-clamp-1 pr-2">{row.label}</span>
						<span class="font-medium whitespace-nowrap {row.isFree ? 'text-emerald-700 font-bold' : 'text-zinc-800'}">
							{row.isFree ? 'Безкоштовно' : `${row.amount} ₴`}
						</span>
					</div>
				{/each}
				<div class="flex items-center justify-between border-t border-zinc-100 pt-1.5 text-sm font-extrabold text-zinc-900">
					<span>Разом до сплати:</span>
					<span class="text-pink-700 text-base">{pricing.totalAmount.toLocaleString('uk-UA')} ₴</span>
				</div>
			</div>

			<!-- Notice Banner for Estimates or Approvals -->
			{#if pricing.isEstimate}
				<div class="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200 flex gap-1.5">
					<AlertTriangle size={14} class="shrink-0 text-amber-600 mt-0.5" />
					<span>{pricing.estimateNotice}</span>
				</div>
			{/if}

			<!-- Action Button -->
			<button
				type="button"
				class="w-full rounded-xl py-3 text-xs font-extrabold text-white transition-all shadow-md flex items-center justify-center gap-2 {pricing.canInstantPay ? 'bg-pink-600 hover:bg-pink-700' : 'bg-zinc-900 hover:bg-zinc-800'}"
				onclick={handleAction}
			>
				{#if pricing.canInstantPay}
					<span>Оплатити {pricing.totalAmount.toLocaleString('uk-UA')} ₴</span>
					<ChevronRight size={15} />
				{:else}
					<Send size={14} />
					<span>Погодити з флористом у Telegram</span>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.flower-phone-preview {
		font-family: inherit;
	}
</style>
