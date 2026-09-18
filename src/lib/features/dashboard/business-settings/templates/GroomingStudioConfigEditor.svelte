<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Dog,
		Plus,
		Trash2,
		Sparkles,
		Users,
		Scale,
		Percent,
		Send,
		Store,
		Scissors,
		CheckCircle2,
		AlertTriangle
	} from '@lucide/svelte';
	import type {
		GroomingStudioFlowData,
		GroomingWeightTier,
		GroomingService,
		GroomingAddon,
		GroomingMaster,
		GroomingPetType
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<GroomingStudioFlowData>;
	} = $props();

	const defaultData: GroomingStudioFlowData = {
		studioName: 'Happy Paws Грумінг',
		title: 'Салон краси та догляду для тварин',
		description: 'Комплексний грумінг, купання, експрес-линька та СПА-догляд',
		contacts: {
			phone: '+380 67 111 22 33',
			instagram: '@happypaws.groom',
			address: 'вул. Саксаганського, 42'
		},
		modes: {
			bookingEnabled: true,
			inSalonPayEnabled: true,
			bookingButtonText: 'Записати улюбленця',
			inSalonButtonText: 'Оплатити в салоні'
		},
		supportedPets: ['dog', 'cat'],
		weightTiers: [
			{ id: 'under_5', label: 'до 5 кг включно', maxWeightKg: 5, basePrice: 700 },
			{ id: '5_to_10', label: 'понад 5 до 10 кг включно', maxWeightKg: 10, basePrice: 900 },
			{ id: '10_to_20', label: 'понад 10 до 20 кг включно', maxWeightKg: 20, basePrice: 1200 }
		],
		services: [
			{
				id: 'srv_complex',
				name: 'Комплексний грумінг (купання + стрижка)',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: true,
				weightTierPrices: {
					under_5: 700,
					'5_to_10': 900,
					'10_to_20': 1200
				},
				durationMinutes: 90
			},
			{
				id: 'srv_bath',
				name: 'Купання та сушка',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: true,
				weightTierPrices: {
					under_5: 450,
					'5_to_10': 600,
					'10_to_20': 800
				},
				durationMinutes: 60
			},
			{
				id: 'srv_nails',
				name: 'Стрижка кігтів та догляд лапок',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: false,
				weightTierPrices: {},
				fixedPrice: 150,
				durationMinutes: 15
			}
		],
		coatOptions: [
			{ id: 'short', label: 'Коротка шерсть', extraPrice: 0 },
			{ id: 'medium', label: 'Середня шерсть', extraPrice: 100 },
			{ id: 'long', label: 'Довга шерсть', extraPrice: 200 }
		],
		addons: [
			{
				id: 'add_spa',
				name: 'Додаткова доглядова процедура (СПА)',
				description: 'Гідромасажна ванна та шовкова маска',
				price: 150
			},
			{
				id: 'add_teeth',
				name: 'Ультразвукове чищення зубів',
				description: 'Гігієнічне зняття нальоту без наркозу',
				price: 250
			}
		],
		masters: [
			{
				id: 'm_natali',
				name: 'Топ-грумер Наталія',
				role: 'Стиліст котів та собак',
				extraPrice: 0,
				allowedPetTypes: ['dog', 'cat']
			}
		],
		autoApproval: {
			enabled: true,
			noticeText: 'Автопогодження діє для стандартних заявок без ковтунів'
		},
		paymentModel: {
			type: 'percent',
			percentValue: 30,
			fixedAmount: 200
		},
		approval: {
			channel: 'telegram',
			responseTimeNotice: 'до 15 хвилин'
		}
	};

	let studioName = $state(flowData?.studioName ?? defaultData.studioName);
	let contacts = $state({
		phone: flowData?.contacts?.phone ?? defaultData.contacts?.phone ?? '',
		instagram: flowData?.contacts?.instagram ?? defaultData.contacts?.instagram ?? '',
		address: flowData?.contacts?.address ?? defaultData.contacts?.address ?? ''
	});
	let modes = $state({
		bookingEnabled: flowData?.modes?.bookingEnabled ?? true,
		inSalonPayEnabled: flowData?.modes?.inSalonPayEnabled ?? true,
		bookingButtonText: flowData?.modes?.bookingButtonText ?? 'Записати улюбленця',
		inSalonButtonText: flowData?.modes?.inSalonButtonText ?? 'Оплатити в салоні'
	});
	let supportedPets = $state<GroomingPetType[]>(
		Array.isArray(flowData?.supportedPets) ? flowData.supportedPets : defaultData.supportedPets
	);
	let weightTiers = $state<GroomingWeightTier[]>(
		Array.isArray(flowData?.weightTiers) ? flowData.weightTiers : defaultData.weightTiers
	);
	let services = $state<GroomingService[]>(
		Array.isArray(flowData?.services) && flowData.services.length > 0
			? flowData.services
			: defaultData.services
	);
	let coatOptions = $state(
		Array.isArray(flowData?.coatOptions) ? flowData.coatOptions : defaultData.coatOptions
	);
	let addons = $state<GroomingAddon[]>(
		Array.isArray(flowData?.addons) ? flowData.addons : defaultData.addons
	);
	let masters = $state<GroomingMaster[]>(
		Array.isArray(flowData?.masters) ? flowData.masters : defaultData.masters
	);
	let autoApproval = $state({
		enabled: flowData?.autoApproval?.enabled ?? defaultData.autoApproval.enabled,
		noticeText: flowData?.autoApproval?.noticeText ?? defaultData.autoApproval.noticeText
	});
	let paymentModel = $state({
		type: flowData?.paymentModel?.type ?? defaultData.paymentModel.type,
		percentValue: flowData?.paymentModel?.percentValue ?? defaultData.paymentModel.percentValue,
		fixedAmount: flowData?.paymentModel?.fixedAmount ?? defaultData.paymentModel.fixedAmount
	});
	let approval = $state({
		channel: flowData?.approval?.channel ?? defaultData.approval.channel,
		responseTimeNotice: flowData?.approval?.responseTimeNotice ?? defaultData.approval.responseTimeNotice
	});

	function syncToFlowData() {
		flowData = {
			...flowData,
			studioName,
			contacts: { ...contacts },
			modes: { ...modes },
			supportedPets: [...supportedPets],
			weightTiers: [...weightTiers],
			services: [...services],
			coatOptions: [...coatOptions],
			addons: [...addons],
			masters: [...masters],
			autoApproval: { ...autoApproval },
			paymentModel: { ...paymentModel },
			approval: { ...approval }
		};
	}

	onMount(() => {
		if (!flowData?.services || !flowData?.weightTiers) {
			syncToFlowData();
		}
	});

	function togglePetType(pet: GroomingPetType) {
		if (supportedPets.includes(pet)) {
			if (supportedPets.length <= 1) return;
			supportedPets = supportedPets.filter((p) => p !== pet);
		} else {
			supportedPets = [...supportedPets, pet];
		}
		syncToFlowData();
	}

	function addService() {
		const newId = `srv_${Date.now()}`;
		services = [
			...services,
			{
				id: newId,
				name: 'Нова послуга',
				petTypes: ['dog', 'cat'],
				requiresCoatDetails: true,
				weightTierPrices: {
					under_5: 500,
					'5_to_10': 700,
					'10_to_20': 900
				},
				durationMinutes: 45
			}
		];
		syncToFlowData();
	}

	function removeService(index: number) {
		if (services.length <= 1) return;
		services = services.filter((_, i) => i !== index);
		syncToFlowData();
	}

	function addAddon() {
		const newId = `add_${Date.now()}`;
		addons = [...addons, { id: newId, name: 'Додаткова послуга', price: 100 }];
		syncToFlowData();
	}

	function removeAddon(index: number) {
		addons = addons.filter((_, i) => i !== index);
		syncToFlowData();
	}
</script>

<div class="grooming-configurator space-y-6 pt-1">
	<!-- Блок 1: Початковий екран та Шляхи клієнта -->
	<section class="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Store size={18} class="text-amber-700" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Початковий екран та Шляхи клієнта</h4>
					<p class="text-xs text-zinc-500">Запис улюбленця на процедуру або пряма оплата в салоні</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div class="rounded-lg border border-amber-200 bg-white p-3">
				<label class="flex cursor-pointer items-center gap-2 mb-2">
					<input
						type="checkbox"
						bind:checked={modes.bookingEnabled}
						onchange={syncToFlowData}
						class="size-4 rounded accent-amber-600"
					/>
					<strong class="text-xs font-semibold text-zinc-900">Шлях 1: «Записати улюбленця»</strong>
				</label>
				<span class="text-[11px] text-zinc-500 block mb-2">
					Повний квіз із вагою, станом шерсті, бажаним часом та погодженням.
				</span>
				<input
					type="text"
					bind:value={modes.bookingButtonText}
					oninput={syncToFlowData}
					placeholder="Текст кнопки запису"
					class="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 outline-none focus:border-amber-500"
				/>
			</div>

			<div class="rounded-lg border border-amber-200 bg-white p-3">
				<label class="flex cursor-pointer items-center gap-2 mb-2">
					<input
						type="checkbox"
						bind:checked={modes.inSalonPayEnabled}
						onchange={syncToFlowData}
						class="size-4 rounded accent-amber-600"
					/>
					<strong class="text-xs font-semibold text-zinc-900">Шлях 2: «Оплатити в салоні»</strong>
				</label>
				<span class="text-[11px] text-zinc-500 block mb-2">
					Пошук підготовленого рахунку або швидка оплата без повторного проходження квізу.
				</span>
				<input
					type="text"
					bind:value={modes.inSalonButtonText}
					oninput={syncToFlowData}
					placeholder="Текст кнопки оплати"
					class="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 outline-none focus:border-amber-500"
				/>
			</div>
		</div>

		<!-- Контакти салону -->
		<div class="mt-3 grid grid-cols-1 gap-2 pt-2 border-t border-amber-200/60 sm:grid-cols-3">
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Назва салону</span>
				<input
					type="text"
					bind:value={studioName}
					oninput={syncToFlowData}
					placeholder="Happy Paws"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-amber-500"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Instagram / Telegram</span>
				<input
					type="text"
					bind:value={contacts.instagram}
					oninput={syncToFlowData}
					placeholder="@happypaws.groom"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-amber-500"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Адреса салону</span>
				<input
					type="text"
					bind:value={contacts.address}
					oninput={syncToFlowData}
					placeholder="вул. Саксаганського, 42"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-amber-500"
				/>
			</label>
		</div>
	</section>

	<!-- Блок 2: Види тварин -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Dog size={16} class="text-amber-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Категорії тварин</h4>
					<p class="text-xs text-zinc-500">Оберіть види тварин, яких обслуговує ваш салон</p>
				</div>
			</div>
		</div>

		<div class="flex gap-3">
			<button
				type="button"
				class="flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer transition-all"
				class:bg-amber-50={supportedPets.includes('dog')}
				class:border-amber-400={supportedPets.includes('dog')}
				class:text-amber-950={supportedPets.includes('dog')}
				class:border-zinc-200={!supportedPets.includes('dog')}
				class:text-zinc-400={!supportedPets.includes('dog')}
				onclick={() => togglePetType('dog')}
			>
				<span>🐶 Собаки</span>
				{#if supportedPets.includes('dog')}<CheckCircle2 size={15} class="text-amber-600" />{/if}
			</button>

			<button
				type="button"
				class="flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer transition-all"
				class:bg-amber-50={supportedPets.includes('cat')}
				class:border-amber-400={supportedPets.includes('cat')}
				class:text-amber-950={supportedPets.includes('cat')}
				class:border-zinc-200={!supportedPets.includes('cat')}
				class:text-zinc-400={!supportedPets.includes('cat')}
				onclick={() => togglePetType('cat')}
			>
				<span>🐱 Коти</span>
				{#if supportedPets.includes('cat')}<CheckCircle2 size={15} class="text-amber-600" />{/if}
			</button>
		</div>
	</section>

	<!-- Блок 3: Вагова сітка та Тарифікація -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Scale size={16} class="text-indigo-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Тарифна сітка за вагою</h4>
					<p class="text-xs text-zinc-500">Неперекривні діапазони: до 5.0 кг включно, 5.1–10 кг, 10.1–20 кг</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			{#each weightTiers as tier, tIndex (tier.id)}
				<div class="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5">
					<span class="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
						{tier.label} (до {tier.maxWeightKg} кг)
					</span>
					<div class="flex items-center gap-2">
						<span class="text-xs text-zinc-600 shrink-0">Тариф:</span>
						<div class="relative flex-1">
							<input
								type="number"
								min="0"
								step="50"
								bind:value={tier.basePrice}
								oninput={syncToFlowData}
								class="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-indigo-500 pr-5 text-right"
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-[10px] text-zinc-400">₴</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Блок 4: Послуги салону -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Scissors size={16} class="text-rose-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Послуги та прив'язка до шерсті</h4>
					<p class="text-xs text-zinc-500">Вкажіть, для яких послуг потрібен детальний розрахунок шерсті та ковтунів</p>
				</div>
			</div>
			<button
				type="button"
				onclick={addService}
				class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
			>
				<Plus size={14} /> Додати послугу
			</button>
		</div>

		<div class="space-y-2.5">
			{#each services as s, sIndex (s.id)}
				<div class="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 space-y-2">
					<div class="flex items-center gap-2">
						<input
							type="text"
							bind:value={s.name}
							oninput={syncToFlowData}
							placeholder="Назва послуги"
							class="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-rose-500"
						/>
						<div class="w-20 shrink-0 relative">
							<input
								type="number"
								min="15"
								step="15"
								bind:value={s.durationMinutes}
								oninput={syncToFlowData}
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none pr-7 text-right"
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">хв</span>
						</div>
						<button
							type="button"
							onclick={() => removeService(sIndex)}
							disabled={services.length <= 1}
							class="text-zinc-400 hover:text-red-600 disabled:opacity-30"
						>
							<Trash2 size={15} />
						</button>
					</div>

					<div class="flex items-center justify-between pt-1 border-t border-zinc-200/60 text-xs">
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								bind:checked={s.requiresCoatDetails}
								onchange={syncToFlowData}
								class="size-3.5 rounded accent-rose-600"
							/>
							<span class="text-[11px] text-zinc-700">Вимагає оцінки шерсті та ковтунів (комплекс / купання)</span>
						</label>

						{#if !s.requiresCoatDetails}
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] text-zinc-500">Фіксована ціна:</span>
								<div class="w-20 relative">
									<input
										type="number"
										min="0"
										step="50"
										bind:value={s.fixedPrice}
										oninput={syncToFlowData}
										class="w-full rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs font-bold text-zinc-900 outline-none pr-4 text-right"
									/>
									<span class="pointer-events-none absolute right-1.5 top-0.5 text-[10px] text-zinc-400">₴</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Блок 5: Доплати за шерсть та Правило ковтунів -->
	<section class="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
		<div class="mb-3 flex items-center gap-2">
			<AlertTriangle size={18} class="text-amber-700" />
			<div>
				<h4 class="text-sm font-bold text-zinc-900">Шерсть та Правила оцінки при ковтунах</h4>
				<p class="text-xs text-zinc-500">Доплати за довжину та захист від неправильних фінальних цін</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3 mb-3">
			{#each coatOptions as c (c.id)}
				<div class="rounded-lg border border-amber-200 bg-white p-2">
					<span class="text-xs font-semibold text-zinc-800 block mb-1">{c.label}</span>
					<div class="relative">
						<input
							type="number"
							min="0"
							step="50"
							bind:value={c.extraPrice}
							oninput={syncToFlowData}
							class="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-bold text-zinc-900 outline-none pr-5 text-right"
						/>
						<span class="pointer-events-none absolute right-2 top-1 text-[10px] text-zinc-400">₴</span>
					</div>
				</div>
			{/each}
		</div>

		<div class="rounded-md border border-amber-300 bg-amber-100/70 p-2.5 text-xs text-amber-950">
			<strong class="font-bold">⚠️ Автоматичний виняток для ковтунів:</strong>
			<p class="mt-0.5 text-[11px] leading-4 text-amber-900">
				Якщо клієнт обирає «Є ковтуни» або «Не впевнений», система показує суму як <em>«Попередня оцінка»</em> і обов’язково вимагає підтвердження майстром перед оплатою повної вартості.
			</p>
		</div>
	</section>

	<!-- Блок 6: Додаткові процедури (СПА, чищення зубів) -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Sparkles size={16} class="text-purple-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Додаткові доглядові процедури</h4>
					<p class="text-xs text-zinc-500">СПА-маска (+150 ₴), ультразвукове чищення зубів (+250 ₴)</p>
				</div>
			</div>
			<button
				type="button"
				onclick={addAddon}
				class="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
			>
				<Plus size={14} /> Додати процедуру
			</button>
		</div>

		<div class="space-y-2">
			{#each addons as a, aIndex (a.id)}
				<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:gap-3">
					<input
						type="text"
						bind:value={a.name}
						oninput={syncToFlowData}
						placeholder="Назва процедури"
						class="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-purple-500"
					/>
					<div class="w-24 shrink-0 relative">
						<input
							type="number"
							min="0"
							step="50"
							bind:value={a.price}
							oninput={syncToFlowData}
							class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-purple-500 pr-5 text-right"
						/>
						<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">₴</span>
					</div>
					<button
						type="button"
						onclick={() => removeAddon(aIndex)}
						class="text-zinc-400 hover:text-red-600"
					>
						<Trash2 size={15} />
					</button>
				</div>
			{/each}
		</div>
	</section>

	<!-- Блок 7: Погодження та Автопогодження -->
	<section class="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Send size={18} class="text-blue-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Погодження та Автопогодження</h4>
					<p class="text-xs text-zinc-500">Автоматичне погодження однозначних тарифів або перевірка в Telegram</p>
				</div>
			</div>
		</div>

		<div class="space-y-3">
			<label class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-blue-200 bg-white p-3">
				<input
					type="checkbox"
					bind:checked={autoApproval.enabled}
					onchange={syncToFlowData}
					class="size-4 rounded accent-blue-600 mt-0.5"
				/>
				<div>
					<strong class="text-xs font-semibold text-zinc-900 block">Увімкнути Автопогодження для однозначних заявок</strong>
					<span class="text-[11px] text-zinc-500 block leading-4">
						Якщо обрано стандартну послугу без ковтунів та без особливих вимог — клієнт отримує точну ціну одразу.
						(Заявки з ковтунами завжди передаються майстру в Telegram).
					</span>
				</div>
			</label>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-xs font-semibold text-zinc-700">Канал сповіщень</span>
					<select
						bind:value={approval.channel}
						onchange={syncToFlowData}
						class="h-9 rounded-md border border-blue-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-blue-500"
					>
						<option value="telegram">Telegram (бот / чат салону)</option>
						<option value="dashboard">Резервний Dashboard</option>
					</select>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-semibold text-zinc-700">Регламент відповіді</span>
					<input
						type="text"
						bind:value={approval.responseTimeNotice}
						oninput={syncToFlowData}
						placeholder="до 15 хвилин"
						class="h-9 rounded-md border border-blue-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:border-blue-500"
					/>
				</label>
			</div>
		</div>
	</section>

	<!-- Блок 8: Модель оплати та аванс -->
	<section class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
		<div class="mb-3 flex items-center gap-2">
			<Percent size={18} class="text-emerald-700" />
			<div>
				<h4 class="text-sm font-bold text-zinc-900">Модель оплати та Аванс</h4>
				<p class="text-xs text-zinc-500">Розмір завдатку для фіксації запису</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'percent'} class:ring-emerald-600={paymentModel.type === 'percent'}>
				<input
					type="radio"
					name="groom_pay_mode"
					value="percent"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Відсоток (30%)</strong>
					<span class="text-zinc-500 text-[11px]">375 ₴ при чеку 1 250 ₴</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'fixed'} class:ring-emerald-600={paymentModel.type === 'fixed'}>
				<input
					type="radio"
					name="groom_pay_mode"
					value="fixed"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Фіксований</strong>
					<span class="text-zinc-500 text-[11px]">Наприклад 200 ₴</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'none'} class:ring-emerald-600={paymentModel.type === 'none'}>
				<input
					type="radio"
					name="groom_pay_mode"
					value="none"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Без передоплати</strong>
					<span class="text-zinc-500 text-[11px]">0 ₴ авансу</span>
				</div>
			</label>
		</div>
	</section>
</div>
