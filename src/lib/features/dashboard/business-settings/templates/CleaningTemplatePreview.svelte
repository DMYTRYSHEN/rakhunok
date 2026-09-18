<script lang="ts">
	import {
		Sparkles,
		Check,
		ChevronRight,
		AlertTriangle,
		Send,
		Store,
		Receipt,
		ShieldCheck,
		Car,
		Plus,
		Minus,
		Calendar,
		Clock,
		MapPin
	} from '@lucide/svelte';
	import type {
		CleaningFlowData,
		CleaningObjectType,
		CleaningCondition
	} from '$lib/features/shared/checkout-scenario-config';
	import {
		calculateCleaningOrderPrice,
		pruneCleaningSelections,
		type CleaningOrderSelections
	} from '$lib/features/shared/cleaning-pricing';

	let {
		flowData = {},
		onPay
	}: {
		flowData?: Partial<CleaningFlowData>;
		onPay: (amount: number) => void;
	} = $props();

	const defaultData: CleaningFlowData = {
		companyName: 'Чистий Дім Клінінг',
		tagline: 'Професійний клінінг квартир, будинків та офісів',
		description: 'Генеральне та підтримувальне прибирання, миття вікон та хімчистка меблів',
		contacts: {
			phone: '+380 67 555 33 22',
			telegram: '@clean_kyiv_bot',
			viber: '+380675553322',
			address: 'м. Київ, вул. Васильківська, 14'
		},
		modes: {
			standardEnabled: true,
			customEstimateEnabled: true,
			finalPayEnabled: true,
			standardButtonText: 'Розрахувати прибирання',
			customButtonText: 'Складне прибирання',
			finalPayButtonText: 'Оплатити залишок'
		},
		propertyTypes: [
			{ id: 'apartment', label: 'Квартира', icon: '🏢' },
			{ id: 'house', label: 'Приватний будинок', icon: '🏡' },
			{ id: 'office', label: 'Офіс / Комерція', icon: '💼' }
		],
		packages: [
			{
				id: 'maintenance',
				name: 'Підтримувальне прибирання',
				description: 'Знепилення поверхонь, пилосос, вологе миття підлоги, дезінфекція санвузлів',
				pricePerSqMeter: 35,
				minPrice: 1200,
				icon: '✨',
				includedFeatures: [
					'Сухе та вологе прибирання підлоги',
					'Протирання відкритих поверхонь до 1.8 м',
					'Миття та дезінфекція сантехніки'
				],
				excludedFeatures: ['Миття вікон', 'Очищення стійкого жиру в духовці']
			},
			{
				id: 'general',
				name: 'Генеральне прибирання',
				description: 'Глибоке очищення від стелі до підлоги, миття кахлю на всю висоту, фасадів та дверей',
				pricePerSqMeter: 60,
				minPrice: 2400,
				icon: '🧼',
				includedFeatures: [
					'Глибоке знежирення кухонних зон',
					'Очищення кахлю, швів та вапняного нальоту',
					'Миття дверей, плінтусів, розеток, вимикачів'
				]
			},
			{
				id: 'post_construction',
				name: 'Після ремонту',
				description: 'Видалення дрібнодисперсного будівельного пилу, слідів скотчу, ґрунтовки, фарби та затирки',
				pricePerSqMeter: 85,
				minPrice: 3500,
				icon: '🏗️',
				requiresInspection: true,
				includedFeatures: [
					'Робота промисловими пилососами',
					'Спеціальні розчинники для фарби та цементу',
					'Миття всіх поверхонь у 3 етапи'
				]
			}
		],
		addons: [
			{
				id: 'addon_window',
				name: 'Стандартна віконна стулка (з обох боків)',
				price: 150,
				unitLabel: 'стулка',
				maxQty: 30,
				description: 'Склопакет, рама, підвіконня та відлив',
				icon: '🪟'
			},
			{
				id: 'addon_oven',
				name: 'Духовка всередині (видалення нагару)',
				price: 300,
				unitLabel: 'шт',
				maxQty: 3,
				description: 'Професійна антижирова термообробка',
				icon: '🍳'
			},
			{
				id: 'addon_fridge',
				name: 'Холодильник всередині',
				price: 250,
				unitLabel: 'шт',
				maxQty: 3,
				description: 'Миття поличок, контейнерів та дезодорація',
				icon: '🧊'
			},
			{
				id: 'addon_sofa',
				name: 'Хімчистка прямого дивана',
				price: 600,
				unitLabel: 'посадкове місце',
				maxQty: 5,
				description: 'Екстракторне видалення плям та запахів',
				icon: '🛋️'
			},
			{
				id: 'addon_microwave',
				name: 'Мікрохвильова піч всередині',
				price: 150,
				unitLabel: 'шт',
				maxQty: 3,
				description: 'Очищення від жиру та залишків їжі',
				icon: '🍽️'
			}
		],
		zones: [
			{
				id: 'zone_a',
				name: 'Зона А (в межах Києва)',
				extraFee: 0,
				description: 'Виїзд бригади включено у вартість'
			},
			{
				id: 'zone_b',
				name: 'Зона Б (Передмістя до 20 км)',
				extraFee: 200,
				description: 'Ірпінь, Буча, Вишгород, Бровари, Бориспіль, Вишневе'
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForHeavyCondition: true,
			requireManualForPostConstruction: true,
			telegramChat: '@clean_kyiv_bot',
			responseTimeNotice: 'до 10-15 хвилин'
		},
		payment: {
			depositType: 'percent',
			depositValue: 30,
			allowPostPayRemaining: true
		}
	};

	const data = $derived<CleaningFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts ?? {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes ?? {}) },
		packages: flowData?.packages?.length ? flowData.packages : defaultData.packages,
		addons: flowData?.addons?.length ? flowData.addons : defaultData.addons,
		zones: flowData?.zones?.length ? flowData.zones : defaultData.zones,
		propertyTypes: flowData?.propertyTypes?.length ? flowData.propertyTypes : defaultData.propertyTypes,
		approval: { ...defaultData.approval, ...(flowData?.approval ?? {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment ?? {}) }
	});

	// Active mode
	let currentMode = $state<'standard' | 'custom' | 'final'>('standard');

	// Standard order selections (Defaulting to the prompt's 4 100 ₴ case: general, 50 m², oven 1, window 4, zone B)
	let selectedPropertyType = $state<CleaningObjectType>('apartment');
	let selectedPackageId = $state('general');
	let squareMeters = $state(50);
	let selectedCondition = $state<CleaningCondition>('normal');
	let addonQuantities = $state<Record<string, number>>({
		addon_oven: 1,
		addon_window: 4
	});
	let selectedZoneId = $state('zone_b');
	let address = $state('м. Ірпінь, вул. Соборна, 105, кв. 14');
	let desiredDate = $state('Завтра');
	let desiredTime = $state('09:00 - 10:00');
	let contactName = $state('Олександр');
	let contactPhone = $state('+380 67 111 22 33');

	// Custom estimate selections
	let customNotes = $state('Після будівельників: пил на стінах, залишки шпаклівки на кахлі, захисна стрічка на вікнах');

	// Final payment
	let finalReceiptId = $state('ACT-912');
	let finalAmount = $state(2870);

	// Submitted state
	let requestSubmitted = $state(false);

	// Calculation
	const pricing = $derived.by(() => {
		const rawSelections: CleaningOrderSelections = {
			mode: currentMode,
			propertyType: selectedPropertyType,
			packageId: selectedPackageId,
			squareMeters,
			condition: selectedCondition,
			addonQuantities,
			zoneId: selectedZoneId,
			address,
			desiredDate,
			desiredTimeSlot: desiredTime,
			contactName,
			contactPhone,
			customNotes,
			finalReceiptId,
			finalAmount
		};

		const pruned = pruneCleaningSelections(rawSelections, data);
		return calculateCleaningOrderPrice(data, pruned);
	});

	function updateAddonQty(addonId: string, delta: number) {
		const current = addonQuantities[addonId] || 0;
		const next = Math.max(0, current + delta);
		if (next === 0) {
			const clone = { ...addonQuantities };
			delete clone[addonId];
			addonQuantities = clone;
		} else {
			addonQuantities = { ...addonQuantities, [addonId]: next };
		}
	}

	function handleAction() {
		if (pricing.canInstantPay) {
			onPay(pricing.depositAmount);
		} else {
			requestSubmitted = true;
		}
	}
</script>

<div class="cleaning-phone-preview flex flex-col h-full bg-zinc-50 text-zinc-900 select-none pb-8 text-left">
	<!-- Top Brand Header -->
	<div class="border-b border-cyan-100 bg-linear-to-r from-cyan-50 via-teal-50 to-white px-4 py-3">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-extrabold text-cyan-950 flex items-center gap-1.5">
					<span>🧹</span>
					<span>{data.companyName}</span>
				</h3>
				<p class="text-[11px] text-cyan-800/80 line-clamp-1">{data.tagline}</p>
			</div>
			<div class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
				<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>Бригади вільні</span>
			</div>
		</div>

		<!-- Path Switcher (3 Customer Paths) -->
		<div class="mt-2.5 flex rounded-lg bg-cyan-100/70 p-0.5 text-[11px] font-semibold">
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'standard' ? 'bg-white text-cyan-950 shadow-xs' : 'text-cyan-900/70 hover:text-cyan-950'}"
				onclick={() => { currentMode = 'standard'; requestSubmitted = false; }}
			>
				🧼 Калькулятор
			</button>
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'custom' ? 'bg-white text-cyan-950 shadow-xs' : 'text-cyan-900/70 hover:text-cyan-950'}"
				onclick={() => { currentMode = 'custom'; requestSubmitted = false; }}
			>
				⚠️ Складний клінінг
			</button>
			<button
				type="button"
				class="flex-1 rounded-md py-1 text-center transition-all {currentMode === 'final' ? 'bg-white text-cyan-950 shadow-xs' : 'text-cyan-900/70 hover:text-cyan-950'}"
				onclick={() => { currentMode = 'final'; requestSubmitted = false; }}
			>
				💳 Оплата залишку
			</button>
		</div>
	</div>

	<!-- SUBMITTED SCREEN -->
	{#if requestSubmitted}
		<div class="flex-1 p-5 flex flex-col items-center justify-center text-center space-y-4">
			<div class="size-14 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 shadow-inner">
				<Send size={26} />
			</div>
			<div>
				<h4 class="text-base font-bold text-zinc-900">Заявку на клінінг надіслано!</h4>
				<p class="mt-1 text-xs text-zinc-500 leading-relaxed max-w-xs">
					Менеджер перевірить графік вільних клінерів та зв'яжеться з вами в Telegram для узгодження часу та підтвердження вартості.
				</p>
			</div>
			<div class="w-full rounded-xl border border-zinc-200 bg-white p-3.5 text-left text-xs space-y-1.5">
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Розрахункова вартість:</span>
					<strong class="text-zinc-900">{pricing.totalAmount.toLocaleString('uk-UA')} ₴</strong>
				</div>
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Аванс після погодження:</span>
					<span class="text-cyan-700 font-semibold">{pricing.depositAmount.toLocaleString('uk-UA')} ₴</span>
				</div>
				<div class="flex justify-between font-medium text-zinc-600">
					<span>Час відповіді менеджера:</span>
					<span class="text-zinc-800">{data.approval.responseTimeNotice || 'до 15 хв'}</span>
				</div>
			</div>
			<button
				type="button"
				class="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800"
				onclick={() => (requestSubmitted = false)}
			>
				Повернутись до калькулятора
			</button>
		</div>
	{:else}
		<!-- PATH 1: STANDARD CALCULATOR -->
		{#if currentMode === 'standard'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<!-- Step 1: Property Type -->
				<section>
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-1.5">1. Тип приміщення:</span>
					<div class="grid grid-cols-3 gap-2">
						{#each data.propertyTypes as prop (prop.id)}
							<button
								type="button"
								class="rounded-xl border p-2 text-center transition-all {selectedPropertyType === prop.id ? 'border-cyan-600 bg-cyan-50/50 text-cyan-950 font-bold ring-1 ring-cyan-600' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'}"
								onclick={() => (selectedPropertyType = prop.id)}
							>
								<span class="block text-xl mb-0.5">{prop.icon}</span>
								<span class="block text-[11px] leading-tight">{prop.label}</span>
							</button>
						{/each}
					</div>
				</section>

				<!-- Step 2: Cleaning Package Selection -->
				<section>
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block mb-1.5">2. Вид прибирання:</span>
					<div class="space-y-2">
						{#each data.packages as pkg (pkg.id)}
							<button
								type="button"
								class="w-full text-left rounded-xl border p-2.5 transition-all flex items-start gap-2.5 {selectedPackageId === pkg.id ? 'border-cyan-500 bg-cyan-50/40 ring-1 ring-cyan-500' : 'border-zinc-200 bg-white hover:border-zinc-300'}"
								onclick={() => (selectedPackageId = pkg.id)}
							>
								<span class="text-xl mt-0.5">{pkg.icon || '🧼'}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between">
										<strong class="text-xs font-bold text-zinc-900">{pkg.name}</strong>
										<span class="text-xs font-extrabold text-cyan-700">{pkg.pricePerSqMeter} ₴/м²</span>
									</div>
									<p class="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{pkg.description}</p>
									<span class="text-[10px] text-zinc-400 mt-0.5 block">
										Мінімальне замовлення: {pkg.minPrice} ₴
									</span>
								</div>
							</button>
						{/each}
					</div>
				</section>

				<!-- Step 3: Square Meters Area Input -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">3. Площа приміщення:</span>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="15"
								max="500"
								class="w-16 rounded border border-zinc-200 px-1.5 py-0.5 text-right text-sm font-extrabold text-cyan-800"
								bind:value={squareMeters}
							/>
							<span class="text-xs font-bold text-zinc-500">м²</span>
						</div>
					</div>
					<input
						type="range"
						min="15"
						max="250"
						step="1"
						class="w-full accent-cyan-600 cursor-pointer"
						bind:value={squareMeters}
					/>
					<div class="flex justify-between gap-1 text-[10px] text-zinc-400 pt-0.5">
						<button type="button" class="underline" onclick={() => (squareMeters = 35)}>35 м² (1-кімн)</button>
						<button type="button" class="underline" onclick={() => (squareMeters = 50)}>50 м² (2-кімн)</button>
						<button type="button" class="underline" onclick={() => (squareMeters = 75)}>75 м² (3-кімн)</button>
						<button type="button" class="underline" onclick={() => (squareMeters = 120)}>120 м² (будинок)</button>
					</div>
				</section>

				<!-- Step 4: Condition of the property -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">4. Стан забруднення:</span>
					<div class="grid grid-cols-2 gap-1.5">
						<button
							type="button"
							class="rounded-lg border p-2 text-left transition-all {selectedCondition === 'normal' ? 'border-cyan-600 bg-cyan-50 font-bold text-cyan-950 ring-1 ring-cyan-600' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}"
							onclick={() => (selectedCondition = 'normal')}
						>
							<span class="block text-xs">✨ Звичайний стан</span>
							<span class="block text-[10px] text-zinc-400">Побутовий пил</span>
						</button>
						<button
							type="button"
							class="rounded-lg border p-2 text-left transition-all {selectedCondition === 'heavy' ? 'border-amber-600 bg-amber-50 font-bold text-amber-950 ring-1 ring-amber-600' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}"
							onclick={() => (selectedCondition = 'heavy')}
						>
							<span class="block text-xs">⚠️ Сильне забруднення</span>
							<span class="block text-[10px] text-amber-700">Потребує оцінки</span>
						</button>
						<button
							type="button"
							class="rounded-lg border p-2 text-left transition-all {selectedCondition === 'post_construction' ? 'border-amber-600 bg-amber-50 font-bold text-amber-950 ring-1 ring-amber-600' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}"
							onclick={() => (selectedCondition = 'post_construction')}
						>
							<span class="block text-xs">🏗️ Після ремонту</span>
							<span class="block text-[10px] text-amber-700">Будівельний пил</span>
						</button>
						<button
							type="button"
							class="rounded-lg border p-2 text-left transition-all {selectedCondition === 'unsure' ? 'border-amber-600 bg-amber-50 font-bold text-amber-950 ring-1 ring-amber-600' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}"
							onclick={() => (selectedCondition = 'unsure')}
						>
							<span class="block text-xs">❓ Не впевнений</span>
							<span class="block text-[10px] text-zinc-400">Узгодити з менеджером</span>
						</button>
					</div>
				</section>

				<!-- Step 5: Addons with Stepper Counters -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2.5">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">5. Додаткові роботи:</span>
					<div class="space-y-2">
						{#each data.addons as addon (addon.id)}
							{@const qty = addonQuantities[addon.id] || 0}
							<div class="flex items-center justify-between rounded-lg border border-zinc-100 p-2 hover:bg-zinc-50">
								<div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
									<span class="text-base shrink-0">{addon.icon || '✨'}</span>
									<div class="min-w-0">
										<strong class="block text-xs font-semibold text-zinc-900 truncate">{addon.name}</strong>
										<span class="block text-[10px] text-zinc-500">+{addon.price} ₴ / {addon.unitLabel}</span>
									</div>
								</div>
								<!-- Counter Controls -->
								<div class="flex items-center gap-2 shrink-0">
									<button
										type="button"
										class="size-6 rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center disabled:opacity-30"
										disabled={qty <= 0}
										onclick={() => updateAddonQty(addon.id, -1)}
										aria-label="Зменшити кількість"
									>
										<Minus size={12} />
									</button>
									<span class="w-5 text-center text-xs font-bold text-zinc-900">{qty}</span>
									<button
										type="button"
										class="size-6 rounded-md bg-cyan-100 text-cyan-800 hover:bg-cyan-200 flex items-center justify-center disabled:opacity-30"
										disabled={qty >= (addon.maxQty || 20)}
										onclick={() => updateAddonQty(addon.id, 1)}
										aria-label="Збільшити кількість"
									>
										<Plus size={12} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Step 6: Zone & Address -->
				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2.5">
					<span class="text-[10px] font-bold tracking-wider text-zinc-400 uppercase block">6. Локація та виїзд:</span>
					<div class="space-y-2">
						<label class="block text-[11px] font-semibold text-zinc-600">
							<span>Зона виїзду:</span>
							<select
								class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
								bind:value={selectedZoneId}
							>
								{#each data.zones as zone (zone.id)}
									<option value={zone.id}>{zone.name} {zone.extraFee > 0 ? `(+${zone.extraFee} ₴)` : '(Без доплат)'}</option>
								{/each}
							</select>
						</label>

						<label class="block text-[11px] font-semibold text-zinc-600">
							<span>Адреса об’єкта:</span>
							<input
								type="text"
								class="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
								placeholder="м. Київ, вул. Хрещатик, 15, кв. 10"
								bind:value={address}
							/>
						</label>
					</div>
				</section>
			</div>
		{/if}

		<!-- PATH 2: CUSTOM HEAVY CLEANING -->
		{#if currentMode === 'custom'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<div class="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
					<div class="flex items-center gap-2 text-amber-900 font-bold text-xs">
						<AlertTriangle size={16} class="text-amber-600" />
						<span>Складний або нестандартний клінінг</span>
					</div>
					<p class="text-[11px] text-amber-900 leading-relaxed">
						Приміщення після ремонту, сильних забруднень, затоплень або пожеж оцінюються індивідуально після перегляду фото або безкоштовного виїзду технолога.
					</p>
				</div>

				<section class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2.5">
					<label class="block text-[11px] font-bold text-zinc-700">
						<span>Опишіть ситуацію та обсяг робіт:</span>
						<textarea
							rows="3"
							class="mt-1 w-full rounded-lg border border-zinc-200 p-2 text-xs text-zinc-800 focus:border-cyan-500 focus:outline-none font-normal"
							placeholder="Які зони потребують особливої уваги? Будівельний пил, плями фарби, жир..."
							bind:value={customNotes}
						></textarea>
					</label>

					<label class="block text-[11px] font-bold text-zinc-700">
						<span>Орієнтовна площа (м²):</span>
						<input
							type="number"
							class="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-normal"
							bind:value={squareMeters}
						/>
					</label>

					<div class="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-zinc-500 bg-zinc-50">
						<span class="block text-lg mb-1">📸</span>
						<span class="block text-xs font-semibold text-zinc-700">Додати фото забруднень</span>
						<span class="block text-[10px] text-zinc-400 mt-0.5">Фото надсилаються менеджеру в Telegram</span>
					</div>
				</section>
			</div>
		{/if}

		<!-- PATH 3: FINAL POST-PAYMENT -->
		{#if currentMode === 'final'}
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<div class="rounded-xl border border-zinc-200 bg-white p-4 text-center space-y-3">
					<div class="size-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 mx-auto">
						<Receipt size={22} />
					</div>
					<div>
						<h4 class="text-sm font-bold text-zinc-900">Оплата виконаного прибирання</h4>
						<p class="text-xs text-zinc-500 mt-0.5">Введіть номер акта робіт або суму залишку після авансу</p>
					</div>

					<div class="space-y-2 pt-2">
						<label class="block text-[10px] font-bold text-zinc-500 text-left uppercase">
							<span>Номер акта / рахунка:</span>
							<input
								type="text"
								class="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-mono font-bold text-center text-zinc-900"
								placeholder="ACT-912"
								bind:value={finalReceiptId}
							/>
						</label>
						<label class="block text-[10px] font-bold text-zinc-500 text-left uppercase">
							<span>Сума залишку до сплати (₴):</span>
							<input
								type="number"
								min="100"
								step="50"
								class="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-base font-extrabold text-center text-cyan-800"
								bind:value={finalAmount}
							/>
						</label>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SUMMARY & CTA -->
		<div class="border-t border-zinc-200 bg-white p-4 shadow-lg space-y-3">
			<!-- Detailed breakdown -->
			<div class="space-y-1 text-xs">
				{#each pricing.breakdown as row}
					<div class="flex items-center justify-between text-zinc-600">
						<span class="line-clamp-1 pr-2">{row.label}</span>
						<span class="font-medium whitespace-nowrap {row.isFree ? 'text-emerald-700 font-bold' : 'text-zinc-800'}">
							{row.isFree ? '0 ₴' : `${row.amount.toLocaleString('uk-UA')} ₴`}
						</span>
					</div>
				{/each}

				<div class="flex items-center justify-between border-t border-zinc-100 pt-1.5 text-xs text-zinc-500">
					<span>Повна вартість робіт:</span>
					<strong class="text-zinc-900">{pricing.totalAmount.toLocaleString('uk-UA')} ₴</strong>
				</div>

				{#if currentMode === 'standard' && !pricing.isEstimate}
					<div class="flex items-center justify-between text-sm font-extrabold text-cyan-900 bg-cyan-50/70 p-2 rounded-lg">
						<span>Аванс 30% (до сплати):</span>
						<span class="text-base text-cyan-800">{pricing.depositAmount.toLocaleString('uk-UA')} ₴</span>
					</div>
					<div class="flex items-center justify-between text-[11px] text-zinc-400 px-1">
						<span>Залишок після виконання:</span>
						<span>{pricing.remainingAmount.toLocaleString('uk-UA')} ₴</span>
					</div>
				{/if}
			</div>

			<!-- Notice Banner if Estimate -->
			{#if pricing.isEstimate}
				<div class="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200 flex gap-1.5">
					<AlertTriangle size={14} class="shrink-0 text-amber-600 mt-0.5" />
					<span>{pricing.estimateNotice}</span>
				</div>
			{/if}

			<!-- Action Button -->
			<button
				type="button"
				class="w-full rounded-xl py-3 text-xs font-extrabold text-white transition-all shadow-md flex items-center justify-center gap-2 {pricing.canInstantPay ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-zinc-900 hover:bg-zinc-800'}"
				onclick={handleAction}
			>
				{#if pricing.canInstantPay}
					<span>Сплатити аванс {pricing.depositAmount.toLocaleString('uk-UA')} ₴</span>
					<ChevronRight size={15} />
				{:else}
					<Send size={14} />
					<span>Погодити з менеджером у Telegram</span>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.cleaning-phone-preview {
		font-family: inherit;
	}
</style>
