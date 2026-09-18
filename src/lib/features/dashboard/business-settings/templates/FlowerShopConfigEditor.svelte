<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		Trash2,
		Sparkles,
		Store,
		Send,
		Truck,
		MapPin,
		Gift,
		Palette,
		CreditCard,
		CheckCircle2,
		AlertTriangle
	} from '@lucide/svelte';
	import type {
		FlowerShopFlowData,
		FlowerBouquet,
		FlowerBouquetSize,
		FlowerAddon,
		FlowerPickupPoint,
		FlowerDeliveryZone
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<FlowerShopFlowData>;
	} = $props();

	const defaultData: FlowerShopFlowData = {
		shopName: 'Floris Квіти',
		tagline: 'Авторська флористика та свіжі букети',
		description: 'Свіжі квіти з швидкою доставкою по місту або самовивозом за 30 хвилин',
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
				description: 'Французькі півонії, біла еустома, евкаліпт та ніжна маттіола',
				icon: '🌸',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандартний', price: 900, isDefault: true },
					{ id: 'large', name: 'Великий (Пишний)', price: 1300 },
					{ id: 'vip', name: 'VIP Преміум', price: 1900 }
				]
			},
			{
				id: 'bq_roses_25',
				name: '25 червоних троянд Grand Prix',
				category: 'Монобукети',
				description: 'Класичні еквадорські оксамитові троянди 60 см у фірмовому крафті',
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
				description: 'Гортензія, півонієподібні троянди, оксіпеталум та евкаліпт',
				icon: '💐',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандарт (діаметр 22 см)', price: 1100, isDefault: true },
					{ id: 'large', name: 'Великий (діаметр 30 см)', price: 1650 }
				]
			}
		],
		addons: [
			{
				id: 'addon_postcard',
				name: 'Фірмова листівка з підписом від руки',
				price: 50,
				isPostcard: true,
				description: 'Каліграфічний теплий підпис флористом перед доставкою',
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
				name: 'Преміальне пакування та атласна стрічка',
				price: 80,
				description: 'Захисний вологостійкий аквабокс для тривалого транспортування',
				icon: '🎀'
			},
			{
				id: 'addon_sweets',
				name: 'Крафтові макаруни (6 шт)',
				price: 180,
				description: 'Свіжі десерти у подарунковій коробці',
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
				name: 'Зона А (Центр, Печерськ, Шевченківський)',
				price: 150,
				eta: 'до 60 хв',
				description: 'Швидка доставка кур’єром салону'
			},
			{
				id: 'zone_b',
				name: 'Зона B (Оболонь, Позняки, Теремки, Академмістечко)',
				price: 250,
				eta: 'до 90 хв',
				description: 'Доставка по всьому місту'
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

	onMount(() => {
		if (!flowData || Object.keys(flowData).length === 0 || !flowData.bouquets) {
			flowData = JSON.parse(JSON.stringify(defaultData));
		}
	});

	// Safe accessors with defaults
	const data = $derived({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts ?? {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes ?? {}) },
		bouquets: flowData?.bouquets ?? defaultData.bouquets,
		addons: flowData?.addons ?? defaultData.addons,
		pickupPoints: flowData?.pickupPoints ?? defaultData.pickupPoints,
		deliveryZones: flowData?.deliveryZones ?? defaultData.deliveryZones,
		customOrder: { ...defaultData.customOrder, ...(flowData?.customOrder ?? {}) },
		approval: { ...defaultData.approval, ...(flowData?.approval ?? {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment ?? {}) }
	});

	let activeTab = $state<'general' | 'catalog' | 'addons' | 'delivery' | 'approval'>('catalog');

	function updateField<K extends keyof FlowerShopFlowData>(key: K, value: FlowerShopFlowData[K]) {
		flowData = { ...data, [key]: value };
	}

	function updateContacts(field: string, value: string) {
		flowData = {
			...data,
			contacts: { ...data.contacts, [field]: value }
		};
	}

	function updateModes(field: string, value: boolean | string) {
		flowData = {
			...data,
			modes: { ...data.modes, [field]: value }
		};
	}

	// Bouquets management
	function addBouquet() {
		const newId = 'bq_' + Date.now();
		const newBouquet: FlowerBouquet = {
			id: newId,
			name: 'Новий авторський букет',
			category: 'Авторські',
			description: 'Опис складу квітів та оформлення',
			icon: '💐',
			isAvailable: true,
			sizes: [
				{ id: 'standard', name: 'Стандартний', price: 950, isDefault: true },
				{ id: 'large', name: 'Великий', price: 1450 }
			]
		};
		updateField('bouquets', [...data.bouquets, newBouquet]);
	}

	function updateBouquet(index: number, updated: FlowerBouquet) {
		const list = [...data.bouquets];
		list[index] = updated;
		updateField('bouquets', list);
	}

	function removeBouquet(index: number) {
		updateField('bouquets', data.bouquets.filter((_, i) => i !== index));
	}

	function addSizeToBouquet(bIndex: number) {
		const bouquet = { ...data.bouquets[bIndex] };
		const sizeId = 'size_' + Date.now();
		bouquet.sizes = [
			...bouquet.sizes,
			{ id: sizeId, name: 'VIP Розмір', price: 1800, isDefault: false }
		];
		updateBouquet(bIndex, bouquet);
	}

	function removeSizeFromBouquet(bIndex: number, sIndex: number) {
		const bouquet = { ...data.bouquets[bIndex] };
		if (bouquet.sizes.length <= 1) return; // Keep at least one size
		bouquet.sizes = bouquet.sizes.filter((_, i) => i !== sIndex);
		updateBouquet(bIndex, bouquet);
	}

	// Addons management
	function addAddon() {
		const newAddon: FlowerAddon = {
			id: 'addon_' + Date.now(),
			name: 'Новий супутній товар',
			price: 100,
			icon: '🎁',
			description: 'Опис товару або послуги'
		};
		updateField('addons', [...data.addons, newAddon]);
	}

	function updateAddon(index: number, updated: FlowerAddon) {
		const list = [...data.addons];
		list[index] = updated;
		updateField('addons', list);
	}

	function removeAddon(index: number) {
		updateField('addons', data.addons.filter((_, i) => i !== index));
	}

	// Delivery Zones management
	function addDeliveryZone() {
		const newZone: FlowerDeliveryZone = {
			id: 'zone_' + Date.now(),
			name: 'Нова зона доставки',
			price: 180,
			eta: 'до 60 хв'
		};
		updateField('deliveryZones', [...data.deliveryZones, newZone]);
	}

	function removeDeliveryZone(index: number) {
		updateField('deliveryZones', data.deliveryZones.filter((_, i) => i !== index));
	}

	// Pickup Points management
	function addPickupPoint() {
		const newPoint: FlowerPickupPoint = {
			id: 'point_' + Date.now(),
			name: 'Нова точка видачі',
			address: 'вул. Нова, 1',
			workingHours: '09:00 - 20:00'
		};
		updateField('pickupPoints', [...data.pickupPoints, newPoint]);
	}

	function removePickupPoint(index: number) {
		updateField('pickupPoints', data.pickupPoints.filter((_, i) => i !== index));
	}
</script>

<div class="space-y-4">
	<!-- Tab Navigation -->
	<div class="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-2">
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'catalog' ? 'bg-pink-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'catalog')}
		>
			<Sparkles size={14} />
			<span>Каталог букетів</span>
			<span class="ml-1 rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">{data.bouquets.length}</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'addons' ? 'bg-pink-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'addons')}
		>
			<Gift size={14} />
			<span>Додатки та листівки</span>
			<span class="ml-1 rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">{data.addons.length}</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'delivery' ? 'bg-pink-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'delivery')}
		>
			<Truck size={14} />
			<span>Доставка та самовивіз</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'approval' ? 'bg-pink-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'approval')}
		>
			<Send size={14} />
			<span>Погодження та Telegram</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'general' ? 'bg-pink-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'general')}
		>
			<Store size={14} />
			<span>Про магазин</span>
		</button>
	</div>

	<!-- TAB 1: CATALOG -->
	{#if activeTab === 'catalog'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Каталог авторських букетів</h5>
					<p class="text-[11px] text-zinc-500">
						Розміри замінюють базову ціну букета (великий розмір замінює стандартний).
					</p>
				</div>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-pink-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-pink-700 shadow-xs"
					onclick={addBouquet}
				>
					<Plus size={14} />
					<span>Додати букет</span>
				</button>
			</div>

			<div class="space-y-3">
				{#each data.bouquets as bouquet, bIndex (bouquet.id)}
					<div class="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 space-y-3">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-2 flex-1">
								<input
									type="text"
									class="w-10 text-center text-lg rounded border border-zinc-200 bg-white py-1"
									bind:value={bouquet.icon}
								/>
								<div class="flex-1">
									<input
										type="text"
										class="w-full rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-900 focus:border-pink-500"
										placeholder="Назва букета"
										bind:value={bouquet.name}
										oninput={() => updateBouquet(bIndex, bouquet)}
									/>
									<input
										type="text"
										class="mt-1 w-full rounded border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] text-zinc-600 focus:border-pink-500"
										placeholder="Склад (півонії, еустома, евкаліпт...)"
										bind:value={bouquet.description}
										oninput={() => updateBouquet(bIndex, bouquet)}
									/>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<label class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px]">
									<input
										type="checkbox"
										class="size-3.5 rounded accent-pink-600"
										bind:checked={bouquet.isAvailable}
										onchange={() => updateBouquet(bIndex, bouquet)}
									/>
									<span class={bouquet.isAvailable ? 'text-emerald-700 font-semibold' : 'text-zinc-400'}>
										{bouquet.isAvailable ? 'В наявності' : 'Немає'}
									</span>
								</label>
								<button
									type="button"
									class="p-1 text-zinc-400 hover:text-red-600"
									onclick={() => removeBouquet(bIndex)}
									aria-label="Видалити букет"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>

						<!-- Bouquet Sizes Table -->
						<div class="rounded-lg border border-zinc-200 bg-white p-2.5">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-[11px] font-bold text-zinc-700 uppercase">Розміри та фіксовані ціни:</span>
								<button
									type="button"
									class="flex items-center gap-1 text-[11px] font-semibold text-pink-600 hover:text-pink-700"
									onclick={() => addSizeToBouquet(bIndex)}
								>
									<Plus size={12} />
									<span>Додати розмір</span>
								</button>
							</div>
							<div class="space-y-1.5">
								{#each bouquet.sizes as size, sIndex (size.id)}
									<div class="flex items-center gap-2">
										<input
											type="text"
											class="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-800"
											placeholder="Назва розміру (Стандартний / Великий)"
											bind:value={size.name}
											oninput={() => updateBouquet(bIndex, bouquet)}
										/>
										<div class="relative w-28">
											<input
												type="number"
												min="0"
												step="50"
												class="w-full rounded border border-zinc-200 px-2 py-1 pr-6 text-right text-xs font-bold text-zinc-900"
												bind:value={size.price}
												oninput={() => updateBouquet(bIndex, bouquet)}
											/>
											<span class="pointer-events-none absolute right-2 top-1 text-xs text-zinc-400">₴</span>
										</div>
										<button
											type="button"
											class="p-1 text-zinc-300 hover:text-red-500 disabled:opacity-30"
											disabled={bouquet.sizes.length <= 1}
											onclick={() => removeSizeFromBouquet(bIndex, sIndex)}
											aria-label="Видалити розмір"
										>
											<Trash2 size={13} />
										</button>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 2: ADDONS -->
	{#if activeTab === 'addons'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Додаткові товари та листівки</h5>
					<p class="text-[11px] text-zinc-500">
						Листівка автоматично відкриває поле введення тексту привітання для покупця.
					</p>
				</div>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-pink-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-pink-700 shadow-xs"
					onclick={addAddon}
				>
					<Plus size={14} />
					<span>Додати товар</span>
				</button>
			</div>

			<div class="space-y-2.5">
				{#each data.addons as addon, index (addon.id)}
					<div class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5">
						<input
							type="text"
							class="w-9 text-center text-base rounded border border-zinc-200 py-1"
							bind:value={addon.icon}
						/>
						<div class="flex-1 space-y-1">
							<input
								type="text"
								class="w-full rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-900"
								placeholder="Назва товару (Листівка, Ваза...)"
								bind:value={addon.name}
								oninput={() => updateAddon(index, addon)}
							/>
							<div class="flex items-center gap-3">
								<label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-600">
									<input
										type="checkbox"
										class="size-3.5 rounded accent-pink-600"
										bind:checked={addon.isPostcard}
										onchange={() => updateAddon(index, addon)}
									/>
									<span class={addon.isPostcard ? 'text-pink-700 font-medium' : ''}>
										Це листівка (запитувати текст привітання)
									</span>
								</label>
							</div>
						</div>
						<div class="relative w-24">
							<input
								type="number"
								min="0"
								step="10"
								class="w-full rounded border border-zinc-200 px-2 py-1 pr-6 text-right text-xs font-bold text-zinc-900"
								bind:value={addon.price}
								oninput={() => updateAddon(index, addon)}
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-xs text-zinc-400">₴</span>
						</div>
						<button
							type="button"
							class="p-1.5 text-zinc-300 hover:text-red-500"
							onclick={() => removeAddon(index)}
							aria-label="Видалити додаток"
						>
							<Trash2 size={14} />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 3: DELIVERY & PICKUP -->
	{#if activeTab === 'delivery'}
		<div class="space-y-4">
			<!-- Delivery Zones -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h5 class="text-xs font-bold text-zinc-900 uppercase">Зони кур'єрської доставки</h5>
						<p class="text-[11px] text-zinc-500">
							Тарифи додаються до вартості букета при оформленні доставки.
						</p>
					</div>
					<button
						type="button"
						class="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
						onclick={addDeliveryZone}
					>
						<Plus size={13} />
						<span>Додати зону</span>
					</button>
				</div>
				<div class="space-y-2">
					{#each data.deliveryZones as zone, zIndex (zone.id)}
						<div class="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
							<Truck size={15} class="text-zinc-500 ml-1" />
							<input
								type="text"
								class="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900"
								placeholder="Назва зони (Зона А - Центр)"
								bind:value={zone.name}
							/>
							<input
								type="text"
								class="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600"
								placeholder="Час (до 60 хв)"
								bind:value={zone.eta}
							/>
							<div class="relative w-24">
								<input
									type="number"
									min="0"
									step="10"
									class="w-full rounded border border-zinc-200 bg-white px-2 py-1 pr-6 text-right text-xs font-bold text-zinc-900"
									bind:value={zone.price}
								/>
								<span class="pointer-events-none absolute right-2 top-1 text-xs text-zinc-400">₴</span>
							</div>
							<button
								type="button"
								class="p-1 text-zinc-400 hover:text-red-500"
								onclick={() => removeDeliveryZone(zIndex)}
								aria-label="Видалити зону"
							>
								<Trash2 size={13} />
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- Pickup Points -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h5 class="text-xs font-bold text-zinc-900 uppercase">Точки самовивозу (безкоштовно)</h5>
						<p class="text-[11px] text-zinc-500">
							При самовивозі адреса одержувача не запитується, вартість доставки = 0 ₴.
						</p>
					</div>
					<button
						type="button"
						class="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
						onclick={addPickupPoint}
					>
						<Plus size={13} />
						<span>Додати точку</span>
					</button>
				</div>
				<div class="space-y-2">
					{#each data.pickupPoints as point, pIndex (point.id)}
						<div class="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
							<MapPin size={15} class="text-zinc-500 ml-1" />
							<input
								type="text"
								class="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900"
								placeholder="Адреса салону"
								bind:value={point.address}
							/>
							<input
								type="text"
								class="w-32 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600"
								placeholder="Години (08:00 - 21:00)"
								bind:value={point.workingHours}
							/>
							<button
								type="button"
								class="p-1 text-zinc-400 hover:text-red-500"
								onclick={() => removePickupPoint(pIndex)}
								aria-label="Видалити точку"
							>
								<Trash2 size={13} />
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB 4: APPROVAL & TELEGRAM -->
	{#if activeTab === 'approval'}
		<div class="space-y-4">
			<!-- Auto Approval Box -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h5 class="text-xs font-bold text-zinc-900 uppercase">Автопогодження замовлень</h5>
						<p class="mt-0.5 text-[11px] text-zinc-500">
							Коли увімкнено: клієнти можуть миттєво оплатити готові букети в наявності у межах визначених зон доставки.
						</p>
					</div>
					<input
						type="checkbox"
						class="size-4.5 rounded accent-pink-600 cursor-pointer"
						bind:checked={data.approval.autoApprovalEnabled}
						onchange={() => {
							flowData = {
								...data,
								approval: { ...data.approval, autoApprovalEnabled: data.approval.autoApprovalEnabled }
							};
						}}
					/>
				</div>

				<div class="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200 flex gap-2">
					<AlertTriangle size={15} class="shrink-0 text-amber-600 mt-0.5" />
					<span>
						<strong>Безпека замовлень:</strong> Індивідуальні букети, замовлення за межі зон або відсутність квітів на складі <strong>завжди потребують ручного погодження флористом</strong>, навіть при увімкненому автопогодженні.
					</span>
				</div>
			</div>

			<!-- Replacement Policy -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Політика замін квітів</h5>
				<p class="text-[11px] text-zinc-500">
					Як діяти, якщо певної квітки немає на вітрині на момент складання:
				</p>
				<div class="space-y-1.5 pt-1">
					<label class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
						<input
							type="radio"
							name="replPolicy"
							value="same_palette"
							checked={data.approval.replacementPolicy === 'same_palette'}
							onchange={() => {
								flowData = {
									...data,
									approval: { ...data.approval, replacementPolicy: 'same_palette' }
								};
							}}
							class="accent-pink-600"
						/>
						<span>Дозволити заміну еквівалентними квітами у тій самій кольоровій гамі та бюджеті</span>
					</label>
					<label class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
						<input
							type="radio"
							name="replPolicy"
							value="manual_approval"
							checked={data.approval.replacementPolicy === 'manual_approval'}
							onchange={() => {
								flowData = {
									...data,
									approval: { ...data.approval, replacementPolicy: 'manual_approval' }
								};
							}}
							class="accent-pink-600"
						/>
						<span>Лише за попереднім погодженням з клієнтом (фото в чат)</span>
					</label>
					<label class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
						<input
							type="radio"
							name="replPolicy"
							value="no_replacements"
							checked={data.approval.replacementPolicy === 'no_replacements'}
							onchange={() => {
								flowData = {
									...data,
									approval: { ...data.approval, replacementPolicy: 'no_replacements' }
								};
							}}
							class="accent-pink-600"
						/>
						<span>Категорично без замін (відхилити, якщо квітки немає)</span>
					</label>
				</div>
			</div>

			<!-- Telegram Notifications -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
				<div class="flex items-center gap-2">
					<Send size={15} class="text-blue-500" />
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Telegram-сповіщення флориста</h5>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Telegram логін або бот:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="@floris_orders_bot"
							bind:value={data.approval.telegramChat}
							oninput={() => {
								flowData = {
									...data,
									approval: { ...data.approval, telegramChat: data.approval.telegramChat }
								};
							}}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Обіцяний час відповіді:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="до 10-15 хвилин"
							bind:value={data.approval.responseTimeNotice}
							oninput={() => {
								flowData = {
									...data,
									approval: { ...data.approval, responseTimeNotice: data.approval.responseTimeNotice }
								};
							}}
						/>
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB 5: GENERAL -->
	{#if activeTab === 'general'}
		<div class="space-y-4">
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Основні дані салону квітів</h5>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Назва салону / бренду:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="Floris Квіти"
							bind:value={data.shopName}
							oninput={() => updateField('shopName', data.shopName)}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Слоган / короткий підпис:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="Авторська флористика та свіжі букети"
							bind:value={data.tagline}
							oninput={() => updateField('tagline', data.tagline)}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Телефон для зв'язку:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="+380 67 444 55 66"
							bind:value={data.contacts.phone}
							oninput={() => updateContacts('phone', data.contacts.phone ?? '')}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Instagram / соцмережі:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="@floris.kyiv"
							bind:value={data.contacts.instagram}
							oninput={() => updateContacts('instagram', data.contacts.instagram ?? '')}
						/>
					</label>
				</div>
			</div>

			<!-- Customer Paths Toggles -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Доступні шляхи для покупця в чекауті</h5>
				<div class="space-y-2">
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Готовий букет (Каталог)</strong>
							<span class="text-[11px] text-zinc-500">Вибір розміру, додатки, самовивіз або доставка</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-pink-600"
							bind:checked={data.modes.catalogEnabled}
							onchange={() => updateModes('catalogEnabled', data.modes.catalogEnabled)}
						/>
					</label>
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Букет на замовлення (Індивідуальний)</strong>
							<span class="text-[11px] text-zinc-500">Побажання, орієнтовний бюджет, палітра та погодження</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-pink-600"
							bind:checked={data.modes.customOrderEnabled}
							onchange={() => updateModes('customOrderEnabled', data.modes.customOrderEnabled)}
						/>
					</label>
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Оплата в магазині (Касовий чек)</strong>
							<span class="text-[11px] text-zinc-500">Введення номера чека або швидка оплата на вітрині</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-pink-600"
							bind:checked={data.modes.inStorePayEnabled}
							onchange={() => updateModes('inStorePayEnabled', data.modes.inStorePayEnabled)}
						/>
					</label>
				</div>
			</div>
		</div>
	{/if}
</div>
