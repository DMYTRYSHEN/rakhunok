<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		Trash2,
		Sparkles,
		Store,
		Send,
		Car,
		CreditCard,
		ShieldCheck,
		AlertTriangle
	} from '@lucide/svelte';
	import type {
		CleaningFlowData,
		CleaningServicePackage,
		CleaningAddon,
		CleaningServiceZone
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<CleaningFlowData>;
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

	onMount(() => {
		if (!flowData || Object.keys(flowData).length === 0 || !flowData.packages) {
			flowData = JSON.parse(JSON.stringify(defaultData));
		}
	});

	const data = $derived({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts ?? {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes ?? {}) },
		packages: flowData?.packages ?? defaultData.packages,
		addons: flowData?.addons ?? defaultData.addons,
		zones: flowData?.zones ?? defaultData.zones,
		propertyTypes: flowData?.propertyTypes ?? defaultData.propertyTypes,
		approval: { ...defaultData.approval, ...(flowData?.approval ?? {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment ?? {}) }
	});

	let activeTab = $state<'packages' | 'addons' | 'zones' | 'approval' | 'general'>('packages');

	function updateField<K extends keyof CleaningFlowData>(key: K, value: CleaningFlowData[K]) {
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

	// Packages
	function updatePackage(index: number, updated: CleaningServicePackage) {
		const list = [...data.packages];
		list[index] = updated;
		updateField('packages', list);
	}

	function addPackage() {
		const newPkg: CleaningServicePackage = {
			id: 'pkg_' + Date.now(),
			name: 'Новий тариф прибирання',
			description: 'Опис робіт, що входять у пакет',
			pricePerSqMeter: 45,
			minPrice: 1500,
			icon: '🧹',
			includedFeatures: ['Базове очищення поверхонь']
		};
		updateField('packages', [...data.packages, newPkg]);
	}

	function removePackage(index: number) {
		if (data.packages.length <= 1) return;
		updateField('packages', data.packages.filter((_, i) => i !== index));
	}

	// Addons
	function updateAddon(index: number, updated: CleaningAddon) {
		const list = [...data.addons];
		list[index] = updated;
		updateField('addons', list);
	}

	function addAddon() {
		const newAddon: CleaningAddon = {
			id: 'addon_' + Date.now(),
			name: 'Нова додаткова послуга',
			price: 200,
			unitLabel: 'шт',
			maxQty: 10,
			icon: '✨',
			description: 'Опис послуги'
		};
		updateField('addons', [...data.addons, newAddon]);
	}

	function removeAddon(index: number) {
		updateField('addons', data.addons.filter((_, i) => i !== index));
	}

	// Zones
	function updateZone(index: number, updated: CleaningServiceZone) {
		const list = [...data.zones];
		list[index] = updated;
		updateField('zones', list);
	}

	function addZone() {
		const newZone: CleaningServiceZone = {
			id: 'zone_' + Date.now(),
			name: 'Нова зона виїзду',
			extraFee: 300,
			description: 'Опис зони'
		};
		updateField('zones', [...data.zones, newZone]);
	}

	function removeZone(index: number) {
		updateField('zones', data.zones.filter((_, i) => i !== index));
	}
</script>

<div class="space-y-4">
	<!-- Tab Navigation -->
	<div class="flex flex-wrap gap-1.5 border-b border-zinc-200 pb-2">
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'packages' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'packages')}
		>
			<Sparkles size={14} />
			<span>Тарифи та пакети</span>
			<span class="ml-1 rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">{data.packages.length}</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'addons' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'addons')}
		>
			<span>Додаткові послуги</span>
			<span class="ml-1 rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">{data.addons.length}</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'zones' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'zones')}
		>
			<Car size={14} />
			<span>Зони виїзду</span>
			<span class="ml-1 rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">{data.zones.length}</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'approval' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'approval')}
		>
			<ShieldCheck size={14} />
			<span>Погодження й аванс</span>
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all {activeTab === 'general' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
			onclick={() => (activeTab = 'general')}
		>
			<Store size={14} />
			<span>Про компанію</span>
		</button>
	</div>

	<!-- TAB 1: PACKAGES -->
	{#if activeTab === 'packages'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Пакети прибирання (ціна за м²)</h5>
					<p class="text-[11px] text-zinc-500">
						Мінімальна вартість застосовується до базового розрахунку, якщо площа мала.
					</p>
				</div>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 shadow-xs"
					onclick={addPackage}
				>
					<Plus size={14} />
					<span>Додати пакет</span>
				</button>
			</div>

			<div class="space-y-3">
				{#each data.packages as pkg, pIndex (pkg.id)}
					<div class="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 space-y-3">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-2 flex-1">
								<input
									type="text"
									class="w-10 text-center text-lg rounded border border-zinc-200 bg-white py-1"
									bind:value={pkg.icon}
								/>
								<div class="flex-1 space-y-1">
									<input
										type="text"
										class="w-full rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-900 focus:border-cyan-500"
										placeholder="Назва пакета"
										bind:value={pkg.name}
										oninput={() => updatePackage(pIndex, pkg)}
									/>
									<input
										type="text"
										class="w-full rounded border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] text-zinc-600 focus:border-cyan-500"
										placeholder="Короткий опис робіт"
										bind:value={pkg.description}
										oninput={() => updatePackage(pIndex, pkg)}
									/>
								</div>
							</div>
							<button
								type="button"
								class="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-30"
								disabled={data.packages.length <= 1}
								onclick={() => removePackage(pIndex)}
								aria-label="Видалити пакет"
							>
								<Trash2 size={14} />
							</button>
						</div>

						<!-- Rates Grid -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-white p-2.5">
							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Ціна за 1 м²:</span>
								<div class="relative mt-1">
									<input
										type="number"
										min="10"
										step="5"
										class="w-full rounded border border-zinc-200 px-2.5 py-1 pr-7 text-xs font-extrabold text-zinc-900"
										bind:value={pkg.pricePerSqMeter}
										oninput={() => updatePackage(pIndex, pkg)}
									/>
									<span class="pointer-events-none absolute right-2.5 top-1 text-xs text-zinc-400">₴</span>
								</div>
							</label>

							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Мінімальна сума замовлення:</span>
								<div class="relative mt-1">
									<input
										type="number"
										min="100"
										step="100"
										class="w-full rounded border border-zinc-200 px-2.5 py-1 pr-7 text-xs font-extrabold text-zinc-900"
										bind:value={pkg.minPrice}
										oninput={() => updatePackage(pIndex, pkg)}
									/>
									<span class="pointer-events-none absolute right-2.5 top-1 text-xs text-zinc-400">₴</span>
								</div>
							</label>

							<div class="sm:col-span-2 pt-1 border-t border-zinc-100 flex items-center justify-between">
								<label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-700">
									<input
										type="checkbox"
										class="size-3.5 rounded accent-cyan-600"
										bind:checked={pkg.requiresInspection}
										onchange={() => updatePackage(pIndex, pkg)}
									/>
									<span>Потребує обов’язкового огляду або ручного погодження менеджером</span>
								</label>
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
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Додаткові послуги та роботи</h5>
					<p class="text-[11px] text-zinc-500">
						Вказуйте конкретну одиницю виміру (наприклад, віконна стулка, штука, посадкове місце).
					</p>
				</div>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 shadow-xs"
					onclick={addAddon}
				>
					<Plus size={14} />
					<span>Додати послугу</span>
				</button>
			</div>

			<div class="space-y-2.5">
				{#each data.addons as addon, aIndex (addon.id)}
					<div class="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
						<div class="flex items-center gap-2">
							<input
								type="text"
								class="w-9 text-center text-base rounded border border-zinc-200 py-1"
								bind:value={addon.icon}
							/>
							<input
								type="text"
								class="flex-1 rounded border border-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-900"
								placeholder="Назва послуги"
								bind:value={addon.name}
								oninput={() => updateAddon(aIndex, addon)}
							/>
							<button
								type="button"
								class="p-1 text-zinc-300 hover:text-red-500"
								onclick={() => removeAddon(aIndex)}
								aria-label="Видалити додаток"
							>
								<Trash2 size={14} />
							</button>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Вартість одиниці:</span>
								<div class="relative mt-1">
									<input
										type="number"
										min="0"
										step="50"
										class="w-full rounded border border-zinc-200 px-2.5 py-1 pr-6 text-xs font-bold text-zinc-900"
										bind:value={addon.price}
										oninput={() => updateAddon(aIndex, addon)}
									/>
									<span class="pointer-events-none absolute right-2 top-1 text-xs text-zinc-400">₴</span>
								</div>
							</label>

							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Одиниця виміру:</span>
								<input
									type="text"
									class="mt-1 w-full rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-800"
									placeholder="стулка / шт / місце"
									bind:value={addon.unitLabel}
									oninput={() => updateAddon(aIndex, addon)}
								/>
							</label>

							<label class="block text-[11px] font-semibold text-zinc-600">
								<span>Макс. кількість:</span>
								<input
									type="number"
									min="1"
									class="mt-1 w-full rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-800"
									bind:value={addon.maxQty}
									oninput={() => updateAddon(aIndex, addon)}
								/>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 3: ZONES -->
	{#if activeTab === 'zones'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Зони виїзду бригади</h5>
					<p class="text-[11px] text-zinc-500">
						Доплата за виїзд додається після базового прибирання та додаткових робіт.
					</p>
				</div>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 shadow-xs"
					onclick={addZone}
				>
					<Plus size={14} />
					<span>Додати зону</span>
				</button>
			</div>

			<div class="space-y-2">
				{#each data.zones as zone, zIndex (zone.id)}
					<div class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5">
						<Car size={16} class="text-zinc-400 ml-1" />
						<div class="flex-1 space-y-1">
							<input
								type="text"
								class="w-full rounded border border-zinc-200 px-2 py-1 text-xs font-bold text-zinc-900"
								placeholder="Назва зони"
								bind:value={zone.name}
								oninput={() => updateZone(zIndex, zone)}
							/>
							<input
								type="text"
								class="w-full rounded border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500"
								placeholder="Опис (перелік міст)"
								bind:value={zone.description}
								oninput={() => updateZone(zIndex, zone)}
							/>
						</div>
						<div class="relative w-28">
							<input
								type="number"
								min="0"
								step="50"
								class="w-full rounded border border-zinc-200 px-2 py-1 pr-6 text-right text-xs font-bold text-zinc-900"
								bind:value={zone.extraFee}
								oninput={() => updateZone(zIndex, zone)}
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-xs text-zinc-400">₴</span>
						</div>
						<button
							type="button"
							class="p-1 text-zinc-300 hover:text-red-500"
							onclick={() => removeZone(zIndex)}
							aria-label="Видалити зону"
						>
							<Trash2 size={14} />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- TAB 4: APPROVAL & DEPOSIT -->
	{#if activeTab === 'approval'}
		<div class="space-y-4">
			<!-- Auto approval -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h5 class="text-xs font-bold text-zinc-900 uppercase">Автопогодження ціни</h5>
						<p class="mt-0.5 text-[11px] text-zinc-500">
							Дозволяє клієнтам вносити аванс одразу, якщо приміщення у звичайному стані і немає додаткових складних робіт.
						</p>
					</div>
					<input
						type="checkbox"
						class="size-4.5 rounded accent-cyan-600 cursor-pointer"
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
						<strong>Безпека клінінгу:</strong> Сильне забруднення, прибирання після ремонту або невизначений стан <strong>завжди блокують автопогодження</strong> і маркуються як попередня оцінка з ручним підтвердженням менеджера.
					</span>
				</div>
			</div>

			<!-- Deposit settings -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Аванс та передоплата</h5>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Розмір авансу (% від суми):</span>
						<div class="relative mt-1">
							<input
								type="number"
								min="10"
								max="100"
								step="5"
								class="w-full rounded border border-zinc-200 px-2 py-1 pr-7 text-xs font-bold text-zinc-900"
								bind:value={data.payment.depositValue}
								oninput={() => {
									flowData = {
										...data,
										payment: { ...data.payment, depositValue: Number(data.payment.depositValue) || 30 }
									};
								}}
							/>
							<span class="pointer-events-none absolute right-2.5 top-1 text-xs text-zinc-400">%</span>
						</div>
					</label>

					<div class="flex items-center pt-5">
						<label class="flex items-center gap-2 cursor-pointer text-xs text-zinc-700">
							<input
								type="checkbox"
								class="size-3.5 rounded accent-cyan-600"
								bind:checked={data.payment.allowPostPayRemaining}
								onchange={() => {
									flowData = {
										...data,
										payment: { ...data.payment, allowPostPayRemaining: data.payment.allowPostPayRemaining }
									};
								}}
							/>
							<span>Дозволити доплату залишку після завершення клінінгу</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Telegram Notifications -->
			<div class="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
				<div class="flex items-center gap-2">
					<Send size={15} class="text-cyan-600" />
					<h5 class="text-xs font-bold text-zinc-900 uppercase">Telegram-сповіщення менеджера</h5>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Telegram логін або бот:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="@clean_orders_bot"
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
						<span>Очікуваний час відповіді:</span>
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
			<div class="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Основні дані клінінгової компанії</h5>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Назва компанії:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="Чистий Дім Клінінг"
							bind:value={data.companyName}
							oninput={() => updateField('companyName', data.companyName)}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Слоган:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="Професійний клінінг квартир та офісів"
							bind:value={data.tagline}
							oninput={() => updateField('tagline', data.tagline)}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Телефон:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="+380 67 555 33 22"
							bind:value={data.contacts.phone}
							oninput={() => updateContacts('phone', data.contacts.phone ?? '')}
						/>
					</label>
					<label class="block text-[11px] font-semibold text-zinc-600">
						<span>Адреса офісу:</span>
						<input
							type="text"
							class="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 font-normal"
							placeholder="м. Київ, вул. Васильківська, 14"
							bind:value={data.contacts.address}
							oninput={() => updateContacts('address', data.contacts.address ?? '')}
						/>
					</label>
				</div>
			</div>

			<div class="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
				<h5 class="text-xs font-bold text-zinc-900 uppercase">Доступні шляхи в мобільному чекауті</h5>
				<div class="space-y-2">
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Стандартне прибирання (Калькулятор)</strong>
							<span class="text-[11px] text-zinc-500">Площа, вибір пакета, додатки та розрахунок авансу</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-cyan-600"
							bind:checked={data.modes.standardEnabled}
							onchange={() => updateModes('standardEnabled', data.modes.standardEnabled)}
						/>
					</label>
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Складне прибирання (Ручна оцінка)</strong>
							<span class="text-[11px] text-zinc-500">Форма з фото та описом нестандартних забруднень</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-cyan-600"
							bind:checked={data.modes.customEstimateEnabled}
							onchange={() => updateModes('customEstimateEnabled', data.modes.customEstimateEnabled)}
						/>
					</label>
					<label class="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 cursor-pointer hover:bg-zinc-50">
						<div>
							<strong class="block text-xs font-semibold text-zinc-900">Оплата залишку / виконаної роботи</strong>
							<span class="text-[11px] text-zinc-500">Введення номера акта робіт або суми залишку після авансу</span>
						</div>
						<input
							type="checkbox"
							class="size-4 rounded accent-cyan-600"
							bind:checked={data.modes.finalPayEnabled}
							onchange={() => updateModes('finalPayEnabled', data.modes.finalPayEnabled)}
						/>
					</label>
				</div>
			</div>
		</div>
	{/if}
</div>
