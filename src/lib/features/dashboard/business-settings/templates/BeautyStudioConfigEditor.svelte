<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Scissors,
		Plus,
		Trash2,
		Sparkles,
		Users,
		HelpCircle,
		Percent,
		Send,
		Store,
		Layers
	} from '@lucide/svelte';
	import type {
		BeautyStudioFlowData,
		BeautyQuestion,
		BeautyMaster,
		BeautyAddon
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<BeautyStudioFlowData>;
	} = $props();

	// Дефолтна структура, якщо flowData порожній
	const defaultData: BeautyStudioFlowData = {
		studioName: 'Beauty Studio',
		title: 'Салон краси та стилю',
		description: 'Стрижки, догляд та фарбування',
		contacts: {
			phone: '+380 67 000 00 00',
			instagram: '@beauty.studio',
			address: 'вул. Хрещатик, 15'
		},
		modes: {
			bookingEnabled: true,
			inSalonPayEnabled: true,
			bookingButtonText: 'Записатися на візит',
			inSalonButtonText: 'Оплатити в салоні'
		},
		services: [
			{ id: 'srv_female', name: 'Жіноча стрижка', durationMinutes: 60, basePrice: 600 },
			{ id: 'srv_male', name: 'Чоловіча стрижка', durationMinutes: 45, basePrice: 400 },
			{ id: 'srv_child', name: 'Дитяча стрижка', durationMinutes: 30, basePrice: 350 }
		],
		questions: [
			{
				id: 'q_hair_length',
				title: 'Довжина волосся',
				hint: 'Тільки для жіночої стрижки',
				required: true,
				dependsOnServiceId: 'srv_female',
				options: [
					{ id: 'opt_short', title: 'Коротке волосся', extraPrice: 0 },
					{ id: 'opt_medium', title: 'Середнє волосся', extraPrice: 150 },
					{ id: 'opt_long', title: 'Довге волосся', extraPrice: 300 }
				]
			}
		],
		masters: [
			{ id: 'm_any', name: 'Будь-який вільний майстер', role: 'Спеціаліст', extraPrice: 0 },
			{ id: 'm_reg', name: 'Звичайний майстер', role: 'Стиліст', extraPrice: 0 },
			{ id: 'm_lead', name: 'Провідний майстер', role: 'Топ-стиліст', extraPrice: 200 }
		],
		addons: [
			{
				id: 'add_care',
				name: 'Догляд та маска для волосся',
				description: 'Глибоке відновлення та живлення',
				price: 250
			}
		],
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
		bookingButtonText: flowData?.modes?.bookingButtonText ?? 'Записатися на візит',
		inSalonButtonText: flowData?.modes?.inSalonButtonText ?? 'Оплатити в салоні'
	});
	let services = $state(
		Array.isArray(flowData?.services) && flowData.services.length > 0
			? flowData.services
			: defaultData.services
	);
	let questions = $state<BeautyQuestion[]>(
		Array.isArray(flowData?.questions) ? flowData.questions : defaultData.questions
	);
	let masters = $state<BeautyMaster[]>(
		Array.isArray(flowData?.masters) ? flowData.masters : defaultData.masters
	);
	let addons = $state<BeautyAddon[]>(
		Array.isArray(flowData?.addons) ? flowData.addons : defaultData.addons
	);
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
			services: [...services],
			questions: [...questions],
			masters: [...masters],
			addons: [...addons],
			paymentModel: { ...paymentModel },
			approval: { ...approval }
		};
	}

	onMount(() => {
		if (!flowData?.services || !flowData?.questions) {
			syncToFlowData();
		}
	});

	// Дії для каталогу послуг
	function addService() {
		const newId = `srv_${Date.now()}`;
		services = [
			...services,
			{ id: newId, name: 'Нова послуга', durationMinutes: 45, basePrice: 400 }
		];
		syncToFlowData();
	}

	function removeService(index: number) {
		if (services.length <= 1) return;
		services = services.filter((_, i) => i !== index);
		syncToFlowData();
	}

	// Дії для розгалуження запитань
	function addQuestion() {
		const newId = `q_${Date.now()}`;
		questions = [
			...questions,
			{
				id: newId,
				title: 'Нове запитання',
				hint: 'Оберіть варіант',
				required: true,
				dependsOnServiceId: services[0]?.id,
				options: [
					{ id: `opt_${Date.now()}_1`, title: 'Варіант 1', extraPrice: 0 },
					{ id: `opt_${Date.now()}_2`, title: 'Варіант 2 (+100 ₴)', extraPrice: 100 }
				]
			}
		];
		syncToFlowData();
	}

	function removeQuestion(index: number) {
		questions = questions.filter((_, i) => i !== index);
		syncToFlowData();
	}

	function addOption(questionIndex: number) {
		const q = questions[questionIndex];
		const newOptId = `opt_${Date.now()}`;
		q.options = [...q.options, { id: newOptId, title: 'Новий варіант', extraPrice: 50 }];
		questions = [...questions];
		syncToFlowData();
	}

	function removeOption(questionIndex: number, optionIndex: number) {
		const q = questions[questionIndex];
		if (q.options.length <= 1) return;
		q.options = q.options.filter((_, i) => i !== optionIndex);
		questions = [...questions];
		syncToFlowData();
	}

	// Дії для майстрів
	function addMaster() {
		const newId = `m_${Date.now()}`;
		masters = [...masters, { id: newId, name: 'Ім’я майстра', role: 'Стиліст', extraPrice: 0 }];
		syncToFlowData();
	}

	function removeMaster(index: number) {
		if (masters.length <= 1) return;
		masters = masters.filter((_, i) => i !== index);
		syncToFlowData();
	}

	// Дії для догляду/додаткових послуг
	function addAddon() {
		const newId = `add_${Date.now()}`;
		addons = [...addons, { id: newId, name: 'Додаткова послуга', description: '', price: 150 }];
		syncToFlowData();
	}

	function removeAddon(index: number) {
		addons = addons.filter((_, i) => i !== index);
		syncToFlowData();
	}
</script>

<div class="beauty-configurator space-y-6 pt-1">
	<!-- Блок 1: Початковий екран та Шляхи клієнта -->
	<section class="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Store size={18} class="text-rose-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Початковий екран та Шляхи клієнта</h4>
					<p class="text-xs text-zinc-500">Клієнт може записатися на візит або сплатити послугу на місці в салоні</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<!-- Шлях Записатися -->
			<div class="rounded-lg border border-rose-200 bg-white p-3">
				<label class="flex cursor-pointer items-center gap-2 mb-2">
					<input
						type="checkbox"
						bind:checked={modes.bookingEnabled}
						onchange={syncToFlowData}
						class="size-4 rounded accent-rose-600"
					/>
					<strong class="text-xs font-semibold text-zinc-900">Шлях 1: «Записатися»</strong>
				</label>
				<span class="text-[11px] text-zinc-500 block mb-2">
					Клієнт обирає послугу, майстра, бажаний час та залишає контакт для погодження.
				</span>
				<input
					type="text"
					bind:value={modes.bookingButtonText}
					oninput={syncToFlowData}
					placeholder="Текст кнопки запису"
					class="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 outline-none focus:border-rose-500"
				/>
			</div>

			<!-- Шлях Оплатити в салоні -->
			<div class="rounded-lg border border-rose-200 bg-white p-3">
				<label class="flex cursor-pointer items-center gap-2 mb-2">
					<input
						type="checkbox"
						bind:checked={modes.inSalonPayEnabled}
						onchange={syncToFlowData}
						class="size-4 rounded accent-rose-600"
					/>
					<strong class="text-xs font-semibold text-zinc-900">Шлях 2: «Оплатити в салоні»</strong>
				</label>
				<span class="text-[11px] text-zinc-500 block mb-2">
					Миттєва оплата на стійці через QR/Apple Pay без запитів про бажаний час.
				</span>
				<input
					type="text"
					bind:value={modes.inSalonButtonText}
					oninput={syncToFlowData}
					placeholder="Текст кнопки оплати"
					class="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 outline-none focus:border-rose-500"
				/>
			</div>
		</div>

		<!-- Контакти салону -->
		<div class="mt-3 grid grid-cols-1 gap-2 pt-2 border-t border-rose-200/60 sm:grid-cols-3">
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Назва салону</span>
				<input
					type="text"
					bind:value={studioName}
					oninput={syncToFlowData}
					placeholder="Beauty Bar"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-rose-500"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Instagram / Telegram</span>
				<input
					type="text"
					bind:value={contacts.instagram}
					oninput={syncToFlowData}
					placeholder="@beauty.studio"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-rose-500"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-semibold text-zinc-700">Адреса салону</span>
				<input
					type="text"
					bind:value={contacts.address}
					oninput={syncToFlowData}
					placeholder="вул. Хрещатик, 15"
					class="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-rose-500"
				/>
			</label>
		</div>
	</section>

	<!-- Блок 2: Послуги та Базові ціни -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Scissors size={16} class="text-rose-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Каталог послуг та базові ціни</h4>
					<p class="text-xs text-zinc-500">Чоловіча, жіноча, дитяча стрижка та інші послуги</p>
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

		<div class="space-y-2">
			{#each services as item, index (item.id)}
				<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:gap-3">
					<div class="flex-1 min-w-0">
						<input
							type="text"
							bind:value={item.name}
							oninput={syncToFlowData}
							placeholder="Назва послуги"
							class="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-rose-500"
						/>
					</div>
					<div class="w-20 shrink-0">
						<div class="relative">
							<input
								type="number"
								min="15"
								step="15"
								bind:value={item.durationMinutes}
								oninput={syncToFlowData}
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-rose-500 pr-7 text-right"
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">хв</span>
						</div>
					</div>
					<div class="w-24 shrink-0">
						<div class="relative">
							<input
								type="number"
								min="0"
								step="50"
								bind:value={item.basePrice}
								oninput={syncToFlowData}
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-rose-500 pr-5 text-right"
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">₴</span>
						</div>
					</div>
					<button
						type="button"
						onclick={() => removeService(index)}
						disabled={services.length <= 1}
						title="Видалити"
						class="text-zinc-400 hover:text-red-600 disabled:opacity-30"
					>
						<Trash2 size={15} />
					</button>
				</div>
			{/each}
		</div>
	</section>

	<!-- Блок 3: Запитання та Розгалуження (Branching Questions) -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<HelpCircle size={16} class="text-indigo-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Запитання та Розгалуження (залежні ціни)</h4>
					<p class="text-xs text-zinc-500">
						Наприклад: довжина волосся показується тільки для «Жіноча стрижка». При перемиканні на чоловічу відповідь очищується!
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={addQuestion}
				class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
			>
				<Plus size={14} /> Додати запитання
			</button>
		</div>

		{#if questions.length === 0}
			<p class="text-xs text-zinc-400 italic">Немає додаткових запитань. Ціна буде фіксованою за базовим прайсом.</p>
		{:else}
			<div class="space-y-3">
				{#each questions as q, qIndex (q.id)}
					<div class="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-indigo-100">
							<div class="flex-1 min-w-0">
								<input
									type="text"
									bind:value={q.title}
									oninput={syncToFlowData}
									placeholder="Заголовок запитання (напр. Довжина волосся)"
									class="w-full font-bold text-xs text-indigo-950 bg-white rounded border border-indigo-200 px-2 py-1 outline-none focus:border-indigo-500"
								/>
							</div>

							<!-- Умова залежності -->
							<div class="flex items-center gap-2">
								<span class="text-[11px] text-indigo-900 font-semibold shrink-0">Показувати для:</span>
								<select
									bind:value={q.dependsOnServiceId}
									onchange={syncToFlowData}
									class="text-xs bg-white border border-indigo-200 rounded px-2 py-1 text-zinc-800 outline-none"
								>
									<option value={undefined}>Для всіх послуг</option>
									{#each services as s}
										<option value={s.id}>{s.name}</option>
									{/each}
								</select>
								<button
									type="button"
									onclick={() => removeQuestion(qIndex)}
									title="Видалити запитання"
									class="text-zinc-400 hover:text-red-600 ml-1"
								>
									<Trash2 size={15} />
								</button>
							</div>
						</div>

						<!-- Варіанти відповідей з доплатами -->
						<div class="space-y-1.5 pl-2">
							<span class="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Варіанти вибору та доплата:</span>
							{#each q.options as opt, optIndex (opt.id)}
								<div class="flex items-center gap-2">
									<input
										type="text"
										bind:value={opt.title}
										oninput={syncToFlowData}
										placeholder="Назва варіанта (напр. Довге волосся)"
										class="flex-1 bg-white border border-zinc-200 rounded px-2 py-0.5 text-xs text-zinc-800 outline-none focus:border-indigo-500"
									/>
									<div class="w-24 shrink-0 relative">
										<input
											type="number"
											min="0"
											step="50"
											bind:value={opt.extraPrice}
											oninput={syncToFlowData}
											class="w-full bg-white border border-zinc-200 rounded px-2 py-0.5 text-xs font-semibold text-zinc-800 outline-none focus:border-indigo-500 pr-5 text-right"
										/>
										<span class="pointer-events-none absolute right-2 top-0.5 text-[10px] text-zinc-400">₴</span>
									</div>
									<button
										type="button"
										onclick={() => removeOption(qIndex, optIndex)}
										disabled={q.options.length <= 1}
										class="text-zinc-400 hover:text-red-600 disabled:opacity-20"
									>
										<Trash2 size={13} />
									</button>
								</div>
							{/each}
							<button
								type="button"
								onclick={() => addOption(qIndex)}
								class="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold inline-flex items-center gap-1 mt-1"
							>
								<Plus size={12} /> Додати варіант
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Блок 4: Майстри та Категорії -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Users size={16} class="text-amber-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Спеціалісти / Майстри</h4>
					<p class="text-xs text-zinc-500">Звичайний майстер (+0 ₴), провідний (+200 ₴) або вільний</p>
				</div>
			</div>
			<button
				type="button"
				onclick={addMaster}
				class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
			>
				<Plus size={14} /> Додати майстра
			</button>
		</div>

		<div class="space-y-2">
			{#each masters as m, mIndex (m.id)}
				<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:gap-3">
					<div class="flex-1 min-w-0">
						<input
							type="text"
							bind:value={m.name}
							oninput={syncToFlowData}
							placeholder="Ім’я майстра"
							class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-amber-500"
						/>
					</div>
					<div class="w-32 shrink-0">
						<input
							type="text"
							bind:value={m.role}
							oninput={syncToFlowData}
							placeholder="Посада (Топ-стиліст)"
							class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-amber-500"
						/>
					</div>
					<div class="w-24 shrink-0 relative">
						<input
							type="number"
							min="0"
							step="50"
							bind:value={m.extraPrice}
							oninput={syncToFlowData}
							class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-amber-500 pr-5 text-right"
						/>
						<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">₴</span>
					</div>
					<button
						type="button"
						onclick={() => removeMaster(mIndex)}
						disabled={masters.length <= 1}
						class="text-zinc-400 hover:text-red-600 disabled:opacity-30"
					>
						<Trash2 size={15} />
					</button>
				</div>
			{/each}
		</div>
	</section>

	<!-- Блок 5: Додаткові послуги (Add-ons) -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Sparkles size={16} class="text-purple-600" />
				<div>
					<h4 class="text-sm font-bold text-zinc-900">Додаткові послуги та догляд</h4>
					<p class="text-xs text-zinc-500">Догляд та маска для волосся (+250 ₴), стайлінг тощо</p>
				</div>
			</div>
			<button
				type="button"
				onclick={addAddon}
				class="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
			>
				<Plus size={14} /> Додати послугу
			</button>
		</div>

		{#if addons.length === 0}
			<p class="text-xs text-zinc-400 italic">Немає додаткових послуг.</p>
		{:else}
			<div class="space-y-2">
				{#each addons as a, aIndex (a.id)}
					<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:gap-3">
						<div class="flex-1 min-w-0">
							<input
								type="text"
								bind:value={a.name}
								oninput={syncToFlowData}
								placeholder="Назва догляду"
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-purple-500"
							/>
						</div>
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
		{/if}
	</section>

	<!-- Блок 6: Модель оплати та Аванс -->
	<section class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
		<div class="mb-3 flex items-center gap-2">
			<Percent size={18} class="text-emerald-700" />
			<div>
				<h4 class="text-sm font-bold text-zinc-900">Модель оплати та Передоплата</h4>
				<p class="text-xs text-zinc-500">Правило списання авансу при попередньому записі</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'percent'} class:ring-emerald-600={paymentModel.type === 'percent'}>
				<input
					type="radio"
					name="beauty_pay_mode"
					value="percent"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Відсоток (%)</strong>
					<span class="text-zinc-500 text-[11px]">Наприклад 30%</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'fixed'} class:ring-emerald-600={paymentModel.type === 'fixed'}>
				<input
					type="radio"
					name="beauty_pay_mode"
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

			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'full'} class:ring-emerald-600={paymentModel.type === 'full'}>
				<input
					type="radio"
					name="beauty_pay_mode"
					value="full"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Повна сума</strong>
					<span class="text-zinc-500 text-[11px]">100% оплати</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5" class:ring-2={paymentModel.type === 'none'} class:ring-emerald-600={paymentModel.type === 'none'}>
				<input
					type="radio"
					name="beauty_pay_mode"
					value="none"
					bind:group={paymentModel.type}
					onchange={syncToFlowData}
					class="accent-emerald-600"
				/>
				<div class="text-xs">
					<strong class="block text-zinc-900">Без завдатку</strong>
					<span class="text-zinc-500 text-[11px]">0 ₴ передоплати</span>
				</div>
			</label>
		</div>

		{#if paymentModel.type === 'percent'}
			<div class="mt-3 flex items-center gap-2">
				<span class="text-xs font-semibold text-zinc-700">Розмір авансу у відсотках:</span>
				<div class="w-24 relative">
					<input
						type="number"
						min="10"
						max="100"
						step="5"
						bind:value={paymentModel.percentValue}
						oninput={syncToFlowData}
						class="w-full rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-600 pr-6 text-right"
					/>
					<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-500">%</span>
				</div>
				<span class="text-[11px] text-zinc-500">При замовленні на 1 350 ₴ аванс становитиме 405 ₴</span>
			</div>
		{:else if paymentModel.type === 'fixed'}
			<div class="mt-3 flex items-center gap-2">
				<span class="text-xs font-semibold text-zinc-700">Фіксований аванс у гривнях:</span>
				<div class="w-28 relative">
					<input
						type="number"
						min="50"
						step="50"
						bind:value={paymentModel.fixedAmount}
						oninput={syncToFlowData}
						class="w-full rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-emerald-600 pr-5 text-right"
					/>
					<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-500">₴</span>
				</div>
			</div>
		{/if}
	</section>

	<!-- Блок 7: Погодження та Сповіщення -->
	<section class="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
		<div class="mb-3 flex items-center gap-2">
			<Send size={18} class="text-blue-600" />
			<div>
				<h4 class="text-sm font-bold text-zinc-900">Погодження та Сповіщення салону</h4>
				<p class="text-xs text-zinc-500">Заявка надсилається відповідальній особі перед фіксацією та виставленням рахунку</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<label class="flex flex-col gap-1">
				<span class="text-xs font-semibold text-zinc-700">Канал погодження</span>
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
				<span class="text-xs font-semibold text-zinc-700">Орієнтовний час відповіді</span>
				<input
					type="text"
					bind:value={approval.responseTimeNotice}
					oninput={syncToFlowData}
					placeholder="до 15 хвилин"
					class="h-9 rounded-md border border-blue-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:border-blue-500"
				/>
			</label>
		</div>
	</section>
</div>
