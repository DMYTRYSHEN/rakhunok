<script lang="ts">
	import {
		Calendar,
		Clock,
		Plus,
		Trash2,
		Wrench,
		Car,
		Layers
	} from '@lucide/svelte';

	export type BookingCategory = {
		id: string;
		title: string;
		subtitle?: string;
		icon?: string;
		modifier: number;
	};

	export type BookingService = {
		id: string;
		name: string;
		durationMinutes: number;
		basePrice: number;
	};

	export type BookingSchedule = {
		startHour: string; // "09:00"
		endHour: string;   // "19:00"
		slotDurationMinutes: number; // 45
		workDays: 'all' | 'mon_sat' | 'mon_fri';
		depositAmount: number;
		calendarSyncUrl?: string;
	};

	export type ConfiguratorFlowData = {
		engine?: string;
		categories?: BookingCategory[];
		services?: BookingService[];
		schedule?: BookingSchedule;
		[key: string]: unknown;
	};

	let {
		scenario = 'vertical_auto',
		flowData = $bindable({})
	}: {
		scenario?: string;
		flowData: Record<string, unknown>;
	} = $props();

	// Ініціалізація структури, якщо порожня
	if (!flowData.services || !Array.isArray(flowData.services)) {
		flowData.services = [
			{ id: 'srv_1', name: 'Комплексний шиномонтаж (4 шт)', durationMinutes: 45, basePrice: 800 },
			{ id: 'srv_2', name: 'Балансування коліс', durationMinutes: 30, basePrice: 400 },
			{ id: 'srv_3', name: 'Діагностика ходової частини', durationMinutes: 30, basePrice: 350 }
		];
	}

	if (!flowData.categories || !Array.isArray(flowData.categories)) {
		flowData.categories = [
			{ id: 'sedan', title: 'Легкове авто', subtitle: 'Седан, хетчбек', icon: '🚗', modifier: 1.0 },
			{ id: 'suv', title: 'Кросовер / SUV', subtitle: 'Позашляховик', icon: '🚙', modifier: 1.25 },
			{ id: 'van', title: 'Мікроавтобус', subtitle: 'Бус, комерційний', icon: '🚐', modifier: 1.5 }
		];
	}

	if (!flowData.schedule || typeof flowData.schedule !== 'object') {
		flowData.schedule = {
			startHour: '09:00',
			endHour: '19:00',
			slotDurationMinutes: 45,
			workDays: 'mon_sat',
			depositAmount: 200,
			calendarSyncUrl: ''
		};
	}

	let services = $state<BookingService[]>(flowData.services as BookingService[]);
	let categories = $state<BookingCategory[]>(flowData.categories as BookingCategory[]);
	let schedule = $state<BookingSchedule>(flowData.schedule as BookingSchedule);
	let enableCategories = $state(categories.length > 0);

	function syncToFlowData() {
		flowData = {
			...flowData,
			services: [...services],
			categories: enableCategories ? [...categories] : [],
			schedule: { ...schedule }
		};
	}

	function addService() {
		const newId = `srv_${Date.now()}`;
		services = [...services, { id: newId, name: 'Нова послуга', durationMinutes: 30, basePrice: 300 }];
		syncToFlowData();
	}

	function removeService(index: number) {
		if (services.length <= 1) return;
		services = services.filter((_, i) => i !== index);
		syncToFlowData();
	}

	function addCategory() {
		const newId = `cat_${Date.now()}`;
		categories = [...categories, { id: newId, title: 'Нова категорія', subtitle: '', icon: '⚙️', modifier: 1.0 }];
		syncToFlowData();
	}

	function removeCategory(index: number) {
		if (categories.length <= 1) return;
		categories = categories.filter((_, i) => i !== index);
		syncToFlowData();
	}
</script>

<div class="configurator-shell space-y-6 pt-2">
	<!-- Секція 1: Перелік послуг та прайс -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<div class="flex items-center gap-2">
					<Wrench size={16} class="text-blue-600" />
					<h4 class="text-sm font-bold text-zinc-900">Перелік послуг та вартість</h4>
				</div>
				<p class="text-xs text-zinc-500">Клієнт зможе обрати ці послуги під час запису.</p>
			</div>
			<button
				type="button"
				onclick={addService}
				class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
			>
				<Plus size={14} /> Додати послугу
			</button>
		</div>

		<div class="space-y-2.5">
			{#each services as item, index (item.id)}
				<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:gap-3">
					<div class="flex-1 min-w-0">
						<span class="sr-only">Назва послуги</span>
						<input
							type="text"
							bind:value={item.name}
							oninput={syncToFlowData}
							placeholder="Назва послуги"
							class="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 outline-none focus:border-blue-500"
						/>
					</div>

					<div class="w-24 shrink-0">
						<span class="sr-only">Тривалість</span>
						<div class="relative">
							<input
								type="number"
								min="10"
								step="5"
								bind:value={item.durationMinutes}
								oninput={syncToFlowData}
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 pr-7 text-right"
							/>
							<span class="pointer-events-none absolute right-2 top-1 text-[11px] text-zinc-400">хв</span>
						</div>
					</div>

					<div class="w-28 shrink-0">
						<span class="sr-only">Базова ціна</span>
						<div class="relative">
							<input
								type="number"
								min="0"
								step="10"
								bind:value={item.basePrice}
								oninput={syncToFlowData}
								class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-bold text-zinc-900 outline-none focus:border-blue-500 pr-5 text-right"
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

	<!-- Секція 2: Категорії / Типи авто -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center justify-between">
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					bind:checked={enableCategories}
					onchange={syncToFlowData}
					class="size-4 rounded accent-blue-600"
				/>
				<div>
					<div class="flex items-center gap-2">
						<Layers size={16} class="text-indigo-600" />
						<strong class="text-sm font-bold text-zinc-900">Категорії / Варіанти об'єктів</strong>
					</div>
					<p class="text-xs text-zinc-500">Наприклад, типи авто (Седан, SUV, Бус) з коефіцієнтом вартості.</p>
				</div>
			</label>

			{#if enableCategories}
				<button
					type="button"
					onclick={addCategory}
					class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
				>
					<Plus size={14} /> Додати категорію
				</button>
			{/if}
		</div>

		{#if enableCategories}
			<div class="space-y-2 pt-2 border-t border-zinc-100">
				{#each categories as cat, idx (cat.id)}
					<div class="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2">
						<input
							type="text"
							bind:value={cat.icon}
							oninput={syncToFlowData}
							maxlength="2"
							class="w-8 rounded-md border border-zinc-200 bg-white py-1 text-center text-sm"
						/>
						<input
							type="text"
							bind:value={cat.title}
							oninput={syncToFlowData}
							placeholder="Назва категорії"
							class="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900"
						/>
						<div class="w-28 flex items-center gap-1">
							<span class="text-[10px] text-zinc-500">Коефіцієнт:</span>
							<input
								type="number"
								min="0.5"
								max="3.0"
								step="0.05"
								bind:value={cat.modifier}
								oninput={syncToFlowData}
								class="w-14 rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-right"
							/>
						</div>
						<button
							type="button"
							onclick={() => removeCategory(idx)}
							disabled={categories.length <= 1}
							class="text-zinc-400 hover:text-red-600 disabled:opacity-30"
						>
							<Trash2 size={15} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Секція 3: Графік роботи та Завдаток -->
	<section class="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
		<div class="mb-3 flex items-center gap-2">
			<Clock size={16} class="text-emerald-600" />
			<h4 class="text-sm font-bold text-zinc-900">Робочий графік та модель оплати</h4>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-zinc-600">Години роботи</span>
				<div class="flex items-center gap-1.5">
					<input
						type="time"
						bind:value={schedule.startHour}
						onchange={syncToFlowData}
						class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
					/>
					<span class="text-xs text-zinc-400">&mdash;</span>
					<input
						type="time"
						bind:value={schedule.endHour}
						onchange={syncToFlowData}
						class="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
					/>
				</div>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-zinc-600">Робочі дні</span>
				<select
					bind:value={schedule.workDays}
					onchange={syncToFlowData}
					class="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900"
				>
					<option value="all">Щодня (Пн-Нд)</option>
					<option value="mon_sat">Пн - Сб (6 днів)</option>
					<option value="mon_fri">Пн - Пт (5 днів)</option>
				</select>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs font-medium text-zinc-600">Фіксований завдаток (₴)</span>
				<input
					type="number"
					min="50"
					step="50"
					bind:value={schedule.depositAmount}
					oninput={syncToFlowData}
					class="rounded-md border border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5 text-xs font-bold text-emerald-950"
				/>
			</label>
		</div>

		<!-- Синхронізація iCal -->
		<div class="mt-4 border-t border-zinc-100 pt-3">
			<label class="flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
						<Calendar size={13} class="text-blue-600" /> Google Calendar / iCal URL (Синхронізація)
					</span>
					<span class="text-[10px] text-zinc-400">Варіант В</span>
				</div>
				<input
					type="url"
					bind:value={schedule.calendarSyncUrl}
					oninput={syncToFlowData}
					placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
					class="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400"
				/>
				<span class="text-[10px] text-zinc-500">
					Зайнятий час у вашому Google Calendar автоматично блокуватиме слоти на чекауті.
				</span>
			</label>
		</div>
	</section>
</div>
