<script lang="ts">
	import {
		Sparkles,
		Check,
		ChevronRight,
		ChevronLeft,
		AlertTriangle,
		Send,
		Receipt,
		ShieldCheck,
		Car,
		Plus,
		Minus,
		Calendar,
		Clock,
		MapPin,
		User,
		Phone,
		Building,
		Home,
		Briefcase
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

	let data = $derived<CleaningFlowData>({
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

	// Active mode & Apple HIG 4-Step Window State
	let currentMode = $state<'standard' | 'custom' | 'final'>('standard');
	let step = $state<1 | 2 | 3 | 4>(1);

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
		addonQuantities = { ...addonQuantities, [addonId]: next };
	}

	function handleAction() {
		if (currentMode === 'standard') {
			if (pricing.canInstantPay && pricing.depositAmount > 0) {
				onPay(pricing.depositAmount);
			} else {
				alert('Вашу заявку на оцінку надіслано менеджеру. Ми зв’яжемося з вами протягом 15 хвилин.');
			}
		} else if (currentMode === 'custom') {
			alert('Заявку на складне прибирання надіслано. Очікуйте дзвінка для узгодження кошторису.');
		} else if (currentMode === 'final') {
			onPay(finalAmount);
		}
	}
</script>

<div class="cleaning-apple-container">
	<!-- iOS Navigation Bar -->
	<header class="ios-nav-bar">
		<div class="ios-nav-content">
			<span class="ios-merchant-badge">🧹 {data.companyName}</span>
			<span class="ios-secure-tag"><ShieldCheck size={12} /> Захищено</span>
		</div>
	</header>

	<!-- iOS Segmented Mode Control -->
	<div class="ios-segmented-control">
		{#if data.modes.standardEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'standard'}
				onclick={() => { currentMode = 'standard'; step = 1; }}
			>
				{data.modes.standardButtonText || 'Калькулятор'}
			</button>
		{/if}
		{#if data.modes.customEstimateEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'custom'}
				onclick={() => (currentMode = 'custom')}
			>
				{data.modes.customButtonText || 'Складне'}
			</button>
		{/if}
		{#if data.modes.finalPayEnabled}
			<button
				type="button"
				class="ios-segment-btn"
				class:active={currentMode === 'final'}
				onclick={() => (currentMode = 'final')}
			>
				{data.modes.finalPayButtonText || 'Каса'}
			</button>
		{/if}
	</div>

	<!-- STANDARD CLEANING (4 APPLE HIG STEP WINDOWS) -->
	{#if currentMode === 'standard'}
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
						Об’єкт, тариф та площа
					{:else if step === 2}
						Стан та додаткові послуги
					{:else if step === 3}
						Зона виїзду, дата та адреса
					{:else if step === 4}
						Кошторис та аванс 30%
					{/if}
				</h4>
			</div>
		</div>

		<div class="ios-window-body">
			<!-- WINDOW 1: PROPERTY, PACKAGE, AREA -->
			{#if step === 1}
				<!-- Property Types Inset Card -->
				<div class="ios-card">
					<span class="ios-card-title">Тип приміщення:</span>
					<div class="ios-pill-grid">
						{#each data.propertyTypes as pt (pt.id)}
							<button
								type="button"
								class="ios-choice-card"
								class:selected={selectedPropertyType === pt.id}
								onclick={() => (selectedPropertyType = pt.id)}
							>
								<span class="ios-choice-icon">{pt.icon}</span>
								<span class="ios-choice-label">{pt.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Package Selector Card -->
				<div class="ios-card">
					<span class="ios-card-title">Вид прибирання:</span>
					<div class="ios-items-stack">
						{#each data.packages as pkg (pkg.id)}
							<button
								type="button"
								class="ios-package-row"
								class:selected={selectedPackageId === pkg.id}
								onclick={() => (selectedPackageId = pkg.id)}
							>
								<div class="ios-pkg-left">
									<span class="ios-pkg-icon">{pkg.icon}</span>
									<div>
										<div class="ios-pkg-name">{pkg.name}</div>
										<div class="ios-pkg-desc">{pkg.description}</div>
									</div>
								</div>
								<div class="ios-pkg-right">
									<strong class="ios-pkg-price">{pkg.pricePerSqMeter} ₴/м²</strong>
									<span class="ios-pkg-min">від {pkg.minPrice} ₴</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Square Meters Slider Card -->
				<div class="ios-card">
					<div class="ios-card-head">
						<span class="ios-card-title">Площа приміщення:</span>
						<strong class="ios-meter-display">{squareMeters} м²</strong>
					</div>

					<input
						type="range"
						min="15"
						max="300"
						step="1"
						class="ios-slider"
						bind:value={squareMeters}
						aria-label="Площа приміщення у квадратних метрах"
					/>

					<div class="ios-quick-chips">
						{#each [35, 50, 75, 120] as preset}
							<button
								type="button"
								class="ios-chip"
								class:active={squareMeters === preset}
								onclick={() => (squareMeters = preset)}
							>
								{preset} м²
							</button>
						{/each}
					</div>
				</div>

			<!-- WINDOW 2: CONDITION & ADDONS -->
			{:else if step === 2}
				<!-- Condition Inset Card -->
				<div class="ios-card">
					<span class="ios-card-title">Стан об’єкта:</span>
					<div class="ios-condition-grid">
						<button
							type="button"
							class="ios-condition-btn"
							class:selected={selectedCondition === 'normal'}
							onclick={() => (selectedCondition = 'normal')}
						>
							<strong>Звичайний</strong>
							<small>Стандартне забруднення</small>
						</button>
						<button
							type="button"
							class="ios-condition-btn"
							class:selected={selectedCondition === 'heavy'}
							onclick={() => (selectedCondition = 'heavy')}
						>
							<strong>Сильне забруднення</strong>
							<small>Потребує оцінки менеджером</small>
						</button>
						<button
							type="button"
							class="ios-condition-btn"
							class:selected={selectedCondition === 'post_construction'}
							onclick={() => (selectedCondition = 'post_construction')}
						>
							<strong>Після ремонту</strong>
							<small>Будівельний пил і затирка</small>
						</button>
					</div>
				</div>

				<!-- Addons Card with Steppers -->
				<div class="ios-card">
					<span class="ios-card-title">Додаткові роботи:</span>
					<div class="ios-addons-list">
						{#each data.addons as addon (addon.id)}
							{@const qty = addonQuantities[addon.id] || 0}
							<div class="ios-addon-row">
								<div class="ios-addon-info">
									<span class="ios-addon-icon">{addon.icon || '🧼'}</span>
									<div>
										<span class="ios-addon-name">{addon.name}</span>
										<span class="ios-addon-rate">+{addon.price} ₴ / {addon.unitLabel}</span>
									</div>
								</div>
								<div class="ios-stepper">
									<button
										type="button"
										class="ios-step-btn"
										disabled={qty <= 0}
										onclick={() => updateAddonQty(addon.id, -1)}
										aria-label="Зменшити"
									>
										<Minus size={13} />
									</button>
									<span class="ios-step-num">{qty}</span>
									<button
										type="button"
										class="ios-step-btn"
										onclick={() => updateAddonQty(addon.id, 1)}
										aria-label="Збільшити"
									>
										<Plus size={13} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>

			<!-- WINDOW 3: ZONE, DATE, TIME, ADDRESS -->
			{:else if step === 3}
				<!-- Zone Card -->
				<div class="ios-card">
					<span class="ios-card-title">Зона виїзду бригади:</span>
					<div class="ios-items-stack">
						{#each data.zones as zone (zone.id)}
							<button
								type="button"
								class="ios-zone-row"
								class:selected={selectedZoneId === zone.id}
								onclick={() => (selectedZoneId = zone.id)}
							>
								<div>
									<div class="ios-zone-name">{zone.name}</div>
									<div class="ios-zone-desc">{zone.description}</div>
								</div>
								<strong class="ios-zone-price">
									{zone.extraFee === 0 ? 'Включено (0 ₴)' : `+${zone.extraFee} ₴`}
								</strong>
							</button>
						{/each}
					</div>
				</div>

				<!-- Address & Contacts Card -->
				<div class="ios-card">
					<span class="ios-card-title">Адреса та бажаний час:</span>
					<div class="ios-form-stack">
						<label>
							<span class="ios-input-lbl">Адреса об’єкта:</span>
							<input
								type="text"
								class="ios-input"
								bind:value={address}
								placeholder="м. Київ, вул. Хрещатик, 1, кв. 15"
							/>
						</label>

						<div class="ios-grid-2">
							<label>
								<span class="ios-input-lbl">Бажана дата:</span>
								<input type="text" class="ios-input" bind:value={desiredDate} />
							</label>
							<label>
								<span class="ios-input-lbl">Час початку:</span>
								<input type="text" class="ios-input" bind:value={desiredTime} />
							</label>
						</div>

						<label>
							<span class="ios-input-lbl">Номер телефону для зв'язку:</span>
							<input
								type="tel"
								class="ios-input"
								bind:value={contactPhone}
								placeholder="+380..."
							/>
						</label>
					</div>
				</div>

			<!-- WINDOW 4: APPLE WALLET PASS STYLE TICKET & SUMMARY -->
			{:else if step === 4}
				<div class="ios-pass-card">
					<div class="ios-pass-head">
						<div>
							<span class="ios-pass-tag">Калькулятор прибирання</span>
							<h5 class="ios-pass-title">{pricing.summaryLabel}</h5>
						</div>
						<span class="ios-pass-sqm">{squareMeters} м²</span>
					</div>

					<div class="ios-pass-body">
						{#each pricing.breakdown as item}
							<div class="ios-pass-row">
								<span class="ios-pass-lbl">{item.label}</span>
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
							<strong class="ios-total-sum">{pricing.totalAmount} ₴</strong>
						</div>

						<div class="ios-split-pills">
							<div class="ios-split-pill deposit">
								<span class="pill-lbl">Аванс для виїзду (30%):</span>
								<strong class="pill-val">{pricing.depositAmount} ₴</strong>
							</div>
							<div class="ios-split-pill remaining">
								<span class="pill-lbl">Залишок після прибирання:</span>
								<strong class="pill-val">{pricing.remainingAmount} ₴</strong>
							</div>
						</div>

						{#if pricing.estimateNotice}
							<div class="ios-estimate-alert">
								<AlertTriangle size={14} />
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
						Додаткові роботи
					{:else if step === 2}
						Адреса та час
					{:else if step === 3}
						Перейти до розрахунку
					{/if}
					<ChevronRight size={16} />
				</button>
			{:else}
				<button
					type="button"
					class="ios-btn-primary flex-1"
					class:estimate-btn={!pricing.canInstantPay}
					onclick={handleAction}
				>
					{#if !pricing.canInstantPay}
						<Send size={16} />
						<span>Надіслати на погодження менеджеру</span>
					{:else}
						<ShieldCheck size={16} />
						<span>Внести аванс {pricing.depositAmount} ₴</span>
					{/if}
				</button>
			{/if}
		</div>

	<!-- MODE 2: CUSTOM ESTIMATE -->
	{:else if currentMode === 'custom'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Заявка на складне прибирання:</span>
				<p class="ios-card-sub">
					Для об'єктів після пожежі/затоплення або приміщень з нестандартними вимогами.
				</p>
				<textarea
					class="ios-textarea"
					rows="3"
					bind:value={customNotes}
					placeholder="Опишіть стан об’єкта..."
				></textarea>
			</div>

			<div class="ios-card">
				<span class="ios-card-title">Контакти для зв'язку:</span>
				<input type="text" class="ios-input mb-2" bind:value={address} placeholder="Адреса" />
				<input type="tel" class="ios-input" bind:value={contactPhone} placeholder="Телефон" />
			</div>

			<div class="ios-estimate-alert">
				<AlertTriangle size={15} />
				<span>Моментальна оплата заблокована. Менеджер погодить остаточний кошторис перед виїздом.</span>
			</div>

			<button type="button" class="ios-btn-primary full-width" onclick={handleAction}>
				<Send size={16} /> Надіслати заявку
			</button>
		</div>

	<!-- MODE 3: FINAL CASHIER PAYMENT -->
	{:else if currentMode === 'final'}
		<div class="ios-window-body">
			<div class="ios-card">
				<span class="ios-card-title">Оплата залишку на місці:</span>
				<div class="ios-form-stack">
					<label>
						<span class="ios-input-lbl">Номер акта робіт:</span>
						<input type="text" class="ios-input" bind:value={finalReceiptId} />
					</label>
					<label>
						<span class="ios-input-lbl">Сума до сплати (₴):</span>
						<input type="number" class="ios-input" bind:value={finalAmount} />
					</label>
				</div>
			</div>

			<button type="button" class="ios-btn-primary full-width" onclick={handleAction}>
				<ShieldCheck size={16} /> Оплатити залишок {finalAmount} ₴
			</button>
		</div>
	{/if}
</div>

<style>
	.cleaning-apple-container {
		font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
		background: #f2f2f7;
		color: #1c1c1e;
		border-radius: 16px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.ios-nav-bar {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
		padding: 0.75rem 1rem;
	}

	.ios-nav-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-merchant-badge {
		font-weight: 700;
		font-size: 0.9rem;
		color: #1c1c1e;
	}

	.ios-secure-tag {
		font-size: 0.72rem;
		font-weight: 600;
		color: #34c759;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
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
		font-size: 0.75rem;
		color: #8e8e93;
		margin: 0 0 0.5rem 0;
	}

	.ios-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-pill-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.4rem;
	}

	.ios-choice-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.6rem 0.25rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
	}

	.ios-choice-card.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-choice-icon {
		font-size: 1.3rem;
		margin-bottom: 0.2rem;
	}

	.ios-choice-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.ios-package-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.65rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
	}

	.ios-package-row.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-pkg-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ios-pkg-icon {
		font-size: 1.3rem;
	}

	.ios-pkg-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.ios-pkg-desc {
		font-size: 0.68rem;
		color: #8e8e93;
		max-width: 170px;
	}

	.ios-pkg-right {
		text-align: right;
	}

	.ios-pkg-price {
		font-size: 0.88rem;
		font-weight: 700;
		color: #007aff;
		display: block;
	}

	.ios-pkg-min {
		font-size: 0.65rem;
		color: #8e8e93;
	}

	.ios-meter-display {
		font-size: 1.15rem;
		font-weight: 800;
		color: #007aff;
	}

	.ios-slider {
		width: 100%;
		accent-color: #007aff;
		margin: 0.4rem 0 0.6rem 0;
	}

	.ios-quick-chips {
		display: flex;
		gap: 0.4rem;
	}

	.ios-chip {
		flex: 1;
		border: 1px solid #e5e5ea;
		background: #f2f2f7;
		padding: 0.35rem 0.2rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #3a3a3c;
		cursor: pointer;
	}

	.ios-chip.active {
		background: #007aff;
		color: #ffffff;
		border-color: #007aff;
	}

	.ios-condition-grid {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.ios-condition-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #e5e5ea;
		background: #ffffff;
		cursor: pointer;
		text-align: left;
	}

	.ios-condition-btn.selected {
		border-color: #007aff;
		background: #f0f7ff;
	}

	.ios-condition-btn strong {
		font-size: 0.8rem;
		color: #1c1c1e;
	}

	.ios-condition-btn small {
		font-size: 0.68rem;
		color: #8e8e93;
	}

	.ios-addons-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ios-addon-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0;
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
	}

	.ios-addon-row:last-child {
		border-bottom: none;
	}

	.ios-addon-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ios-addon-icon {
		font-size: 1.2rem;
	}

	.ios-addon-name {
		font-size: 0.78rem;
		font-weight: 600;
		color: #1c1c1e;
		display: block;
	}

	.ios-addon-rate {
		font-size: 0.68rem;
		color: #007aff;
		font-weight: 600;
	}

	.ios-stepper {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: #f2f2f7;
		padding: 0.2rem;
		border-radius: 8px;
	}

	.ios-step-btn {
		width: 24px;
		height: 24px;
		border: none;
		background: #ffffff;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.ios-step-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.ios-step-num {
		font-size: 0.8rem;
		font-weight: 700;
		min-width: 20px;
		text-align: center;
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
		font-size: 0.8rem;
		color: #007aff;
	}

	.ios-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ios-input-lbl {
		display: block;
		font-size: 0.72rem;
		font-weight: 600;
		color: #636366;
		margin-bottom: 0.2rem;
	}

	.ios-input {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		border: 1px solid #d1d1d6;
		border-radius: 8px;
		background: #ffffff;
		box-sizing: border-box;
		color: #1c1c1e;
	}

	.ios-textarea {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		border: 1px solid #d1d1d6;
		border-radius: 8px;
		background: #ffffff;
		box-sizing: border-box;
		color: #1c1c1e;
		resize: vertical;
	}

	.ios-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	/* Apple Pass / Wallet Card */
	.ios-pass-card {
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		border: 0.5px solid rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}

	.ios-pass-head {
		background: linear-gradient(135deg, #007aff, #0056b3);
		color: #ffffff;
		padding: 0.85rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ios-pass-tag {
		font-size: 0.65rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.8);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.ios-pass-title {
		margin: 0.15rem 0 0 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.ios-pass-sqm {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.ios-pass-body {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.ios-pass-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: #636366;
	}

	.ios-pass-val {
		color: #1c1c1e;
	}

	.ios-pass-cut {
		display: flex;
		align-items: center;
		position: relative;
		margin: 0.25rem 0;
	}

	.ios-cut-left, .ios-cut-right {
		width: 14px;
		height: 14px;
		background: #f2f2f7;
		border-radius: 50%;
	}

	.ios-cut-left { margin-left: -7px; }
	.ios-cut-right { margin-right: -7px; }

	.ios-cut-line {
		flex: 1;
		border-top: 1px dashed #d1d1d6;
	}

	.ios-pass-footer {
		padding: 0.5rem 1rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.ios-pass-total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
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
	}

	.ios-split-pill {
		border-radius: 8px;
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
	}

	.ios-split-pill.deposit {
		background: #e8f5e9;
		border: 0.5px solid #a5d6a7;
		color: #2e7d32;
	}

	.ios-split-pill.remaining {
		background: #f5f5f7;
		border: 0.5px solid #e0e0e0;
		color: #616161;
	}

	.pill-lbl {
		font-size: 0.65rem;
		font-weight: 600;
	}

	.pill-val {
		font-size: 0.95rem;
		font-weight: 800;
	}

	.ios-estimate-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		background: #fff3e0;
		border: 0.5px solid #ffe0b2;
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		font-size: 0.72rem;
		color: #e65100;
	}

	.ios-bottom-bar {
		padding: 0.5rem 1rem 1rem 1rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.ios-btn-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		background: #007aff;
		color: #ffffff;
		border: none;
		border-radius: 12px;
		padding: 0.75rem;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
		transition: all 0.2s ease;
	}

	.ios-btn-primary:hover {
		background: #0062cc;
	}

	.ios-btn-primary.estimate-btn {
		background: #ff9500;
		box-shadow: 0 2px 6px rgba(255, 149, 0, 0.3);
	}

	.ios-btn-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		background: #e5e5ea;
		color: #1c1c1e;
		border: none;
		border-radius: 12px;
		padding: 0.75rem 1rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}

	.full-width {
		width: 100%;
		margin-top: 0.5rem;
	}

	.flex-1 {
		flex: 1;
	}

	.mb-2 {
		margin-bottom: 0.5rem;
	}
</style>
