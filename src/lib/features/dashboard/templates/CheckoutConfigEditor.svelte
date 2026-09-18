<script lang="ts">
	import type { CheckoutScenarioConfig } from '$lib/features/shared/checkout-scenario-config';
	import FlowDataBuilder from '../business-settings/templates/FlowDataBuilder.svelte';
	import { Plus, Trash2 } from '@lucide/svelte';

	let {
		config = $bindable({}),
		scenario = 'fixed'
	}: {
		config: Partial<CheckoutScenarioConfig>;
		scenario?: string;
	} = $props();

	type PresetKey = 'quick_amounts' | 'tip_presets';

	function updatePreset(key: PresetKey, index: number, event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value) || value < 0) return;
		const values = [...(config[key] ?? [])];
		values[index] = value;
		config = { ...config, [key]: values };
	}

	function addPreset(key: PresetKey) {
		const values = config[key] ?? [];
		if (values.length >= 12) return;
		config = { ...config, [key]: [...values, 0] };
	}

	function removePreset(key: PresetKey, index: number) {
		config = {
			...config,
			[key]: (config[key] ?? []).filter((_, itemIndex) => itemIndex !== index)
		};
	}
</script>

<div class="border-t border-zinc-100 pt-2">
	{#if scenario === 'fuel_station'}
		<div class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
			<strong class="block font-semibold">Сценарій АЗС</strong>
			<span class="mt-1 block text-xs leading-5 text-blue-800">
				Колонки, доступне пальне, стан пістолетів, ліміти та актуальна ціна надходять від
				системи АЗС під час відкриття чекауту. Шаблон зберігає лише правила сценарію.
			</span>
		</div>
	{/if}

	{#if ['vertical_auto', 'vertical_education', 'vertical_beauty', 'vertical_cleaning', 'vertical_pets', 'vertical_rental', 'vertical_services', 'engine_book'].includes(scenario)}
		<div class="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
			<div class="mb-3">
				<p class="text-xs font-bold tracking-wider text-blue-700 uppercase">
					Налаштування сценарію ({scenario === 'vertical_auto' ? 'СТО / Шиномонтаж' : 'Бронювання часу'})
				</p>
				<h4 class="text-sm font-bold text-zinc-900">
					Прайс робіт, категорії та режим роботи
				</h4>
				<p class="mt-0.5 text-xs text-zinc-500">
					Вкажіть актуальний перелік послуг вашого бізнесу. Зміни миттєво відображаються у телефоні праворуч.
				</p>
			</div>
			<FlowDataBuilder {scenario} bind:flowData={config.flow_data} />
		</div>
	{/if}

	<span class="mb-3 block text-xs font-bold tracking-wider text-zinc-500 uppercase"
		>Опції екрана платника (UX)</span
	>

	<!-- Loyalty & Discounts -->
	<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
		Лояльність та знижки
	</p>
	<div class="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Картка лояльності</strong>
				<span class="text-[11px] text-zinc-500">Сканер Apple Pass & бонуси</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_loyalty}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Промокод / знижка</strong>
				<span class="text-[11px] text-zinc-500">Поле введення купона</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_promo}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
		{#if config.allow_promo}
			<label class="sm:col-span-2">
				<span class="mb-1 block text-xs font-bold text-zinc-600">Сума знижки (₴)</span>
				<input
					type="number"
					bind:value={config.promo_discount}
					min="0"
					step="0.5"
					class="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
				/>
			</label>
		{/if}
	</div>

	<!-- HoReCa -->
	{#if scenario === 'table'}
		<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
			HoReCa / Ресторан
		</p>
		<div class="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
			<label
				class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
			>
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Чайові гостя</strong>
					<span class="text-[11px] text-zinc-500">Пресети % або фіксовані суми</span>
				</div>
				<input
					type="checkbox"
					bind:checked={config.allow_tips}
					class="size-4.5 rounded accent-blue-600"
				/>
			</label>
			<label
				class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
			>
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Поділ рахунку</strong>
					<span class="text-[11px] text-zinc-500">Split Bill між гостями</span>
				</div>
				<input
					type="checkbox"
					bind:checked={config.allow_split}
					class="size-4.5 rounded accent-blue-600"
				/>
			</label>
			<label
				class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
			>
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">DAC7 Compliance</strong>
					<span class="text-[11px] text-zinc-500">Фіскалізація та розщеплення</span>
				</div>
				<input
					type="checkbox"
					bind:checked={config.allow_compliance_card}
					class="size-4.5 rounded accent-blue-600"
				/>
			</label>
		</div>
		{#if config.allow_tips}
			<div class="mb-4 rounded-md border border-zinc-200 p-3">
				<div class="mb-2 flex items-center justify-between gap-3">
					<div>
						<strong class="block text-xs font-semibold text-zinc-900">Пресети чайових, %</strong>
						<span class="text-[11px] text-zinc-500">До 12 варіантів для швидкого вибору</span>
					</div>
					<button
						type="button"
						title="Додати пресет"
						aria-label="Додати пресет чайових"
						onclick={() => addPreset('tip_presets')}
						disabled={(config.tip_presets?.length ?? 0) >= 12}
						class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
					>
						<Plus size={16} />
					</button>
				</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each config.tip_presets ?? [] as preset, index (`table-tip-${index}`)}
						<div class="flex items-center gap-1">
							<label class="min-w-0 flex-1">
								<span class="sr-only">Пресет чайових {index + 1}</span>
								<input
									type="number"
									min="0"
									max="100"
									step="1"
									value={preset}
									oninput={(event) => updatePreset('tip_presets', index, event)}
									class="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-blue-600"
								/>
							</label>
							<button
								type="button"
								title="Видалити пресет"
								aria-label={`Видалити пресет чайових ${index + 1}`}
								onclick={() => removePreset('tip_presets', index)}
								class="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
							>
								<Trash2 size={15} />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	{#if scenario === 'tips'}
		<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Чайові / Донат</p>
		<div class="mb-4 rounded-md border border-zinc-200 p-3">
			<div class="mb-2 flex items-center justify-between gap-3">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Швидкі суми, ₴</strong>
					<span class="text-[11px] text-zinc-500">Готові суми для вибору платником</span>
				</div>
				<button
					type="button"
					title="Додати суму"
					aria-label="Додати швидку суму"
					onclick={() => addPreset('tip_presets')}
					disabled={(config.tip_presets?.length ?? 0) >= 12}
					class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
				>
					<Plus size={16} />
				</button>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each config.tip_presets ?? [] as preset, index (`tip-amount-${index}`)}
					<div class="flex items-center gap-1">
						<label class="min-w-0 flex-1">
							<span class="sr-only">Швидка сума {index + 1}</span>
							<input
								type="number"
								min="0"
								step="1"
								value={preset}
								oninput={(event) => updatePreset('tip_presets', index, event)}
								class="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-blue-600"
							/>
						</label>
						<button
							type="button"
							title="Видалити суму"
							aria-label={`Видалити швидку суму ${index + 1}`}
							onclick={() => removePreset('tip_presets', index)}
							class="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
						>
							<Trash2 size={15} />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if scenario === 'open_amount'}
		<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Відкрита сума</p>
		<div class="mb-4 rounded-md border border-zinc-200 p-3">
			<div class="mb-2 flex items-center justify-between gap-3">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Швидкі суми, ₴</strong>
					<span class="text-[11px] text-zinc-500">Підказки над цифровою клавіатурою</span>
				</div>
				<button
					type="button"
					title="Додати суму"
					aria-label="Додати швидку суму"
					onclick={() => addPreset('quick_amounts')}
					disabled={(config.quick_amounts?.length ?? 0) >= 12}
					class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
				>
					<Plus size={16} />
				</button>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#each config.quick_amounts ?? [] as amount, index (`quick-amount-${index}`)}
					<div class="flex items-center gap-1">
						<label class="min-w-0 flex-1">
							<span class="sr-only">Швидка сума {index + 1}</span>
							<input
								type="number"
								min="0"
								step="1"
								value={amount}
								oninput={(event) => updatePreset('quick_amounts', index, event)}
								class="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm outline-none focus:border-blue-600"
							/>
						</label>
						<button
							type="button"
							title="Видалити суму"
							aria-label={`Видалити швидку суму ${index + 1}`}
							onclick={() => removePreset('quick_amounts', index)}
							class="grid size-9 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
						>
							<Trash2 size={15} />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Charity -->
	<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Благодійність</p>
	<div class="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Округлення на ЗСУ</strong>
				<span class="text-[11px] text-zinc-500">Благодійний внесок решти</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_roundup}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
	</div>

	<!-- Order Enhancements -->
	<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Замовлення</p>
	<div class="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Order Bump / Upsell</strong>
				<span class="text-[11px] text-zinc-500">Допродаж перед оплатою</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_upsell}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
		{#if scenario === 'delivery'}
			<label
				class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
			>
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Блок доставки</strong>
					<span class="text-[11px] text-zinc-500">Нова Пошта / кур'єр</span>
				</div>
				<input
					type="checkbox"
					bind:checked={config.allow_delivery}
					class="size-4.5 rounded accent-blue-600"
				/>
			</label>
		{/if}
	</div>

	<!-- Payment & Post-payment -->
	<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
		Оплата та після оплати
	</p>
	<div class="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Оплата частинами (BNPL)</strong>
				<span class="text-[11px] text-zinc-500">Розбити суму на 4 платежі</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_bnpl}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Інші способи оплати</strong>
				<span class="text-[11px] text-zinc-500">Показати додаткові банки</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.show_other_banks}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
		<label
			class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
		>
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">NPS відгук</strong>
				<span class="text-[11px] text-zinc-500">Оцінка після оплати</span>
			</div>
			<input
				type="checkbox"
				bind:checked={config.allow_nps_review}
				class="size-4.5 rounded accent-blue-600"
			/>
		</label>
	</div>

	<!-- UI Customization -->
	<p class="mb-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Інтерфейс</p>
	<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
		<label>
			<span class="mb-1 block text-xs font-bold text-zinc-600">Текст кнопки оплати</span>
			<input
				bind:value={config.cta_text}
				placeholder="Перейти до оплати"
				class="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
			/>
		</label>
		<label>
			<span class="mb-1 block text-xs font-bold text-zinc-600">Тема чекауту</span>
			<select
				bind:value={config.theme}
				class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
			>
				<option value="dark">Темна</option>
				<option value="light">Світла</option>
			</select>
		</label>
	</div>
</div>
