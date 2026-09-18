<script lang="ts">
	import type { CheckoutTemplate, TemplateCreateInput } from '../../types';
	import { createTemplate, updateTemplate } from '../../templates/template-repository';
	import CheckoutConfigEditor from '../../templates/CheckoutConfigEditor.svelte';
	import CheckoutTemplatePreview from './CheckoutTemplatePreview.svelte';
	import {
		isCheckoutTemplateScenario,
		type CheckoutTemplateScenario
	} from './checkout-template-preview';
	import {
		getScenarioDefaults,
		resolveCheckoutConfig
	} from '$lib/features/shared/checkout-scenario-defaults';
	import { templateInvoiceType } from '../../templates/template-invoice';
	import FlowDataBuilder from './FlowDataBuilder.svelte';
	import { Eye, Settings2, X } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';

	let {
		merchantId,
		demo = false,
		template = null,
		onSave,
		onCancel
	}: {
		merchantId: string;
		demo?: boolean;
		template?: CheckoutTemplate | null;
		onSave: (t: CheckoutTemplate) => void;
		onCancel: () => void;
	} = $props();
	const initialTemplate = untrack(() => template);
	const initialScenario: CheckoutTemplateScenario =
		initialTemplate && isCheckoutTemplateScenario(initialTemplate.scenario_type)
			? initialTemplate.scenario_type
			: 'fixed';
	let name = $state(initialTemplate?.name ?? '');
	let scenarioType = $state<CheckoutTemplateScenario>(initialScenario);
	let confirmedScenario = initialScenario;
	let isDefault = $state(initialTemplate?.is_default ?? false);
	const rawInitialConfig = initialTemplate?.scenario_config ?? getScenarioDefaults(initialScenario);
	if (!rawInitialConfig.flow_data || typeof rawInitialConfig.flow_data !== 'object') {
		rawInitialConfig.flow_data = {};
	}
	let config = $state(rawInitialConfig);
	let mobileView = $state<'settings' | 'preview'>('settings');

	let saving = $state(false);
	let error = $state<string | null>(null);
	const initialSnapshot = JSON.stringify({
		name: initialTemplate?.name ?? '',
		scenarioType: initialScenario,
		isDefault: initialTemplate?.is_default ?? false,
		config: rawInitialConfig
	});
	const dirty = $derived(
		JSON.stringify({ name, scenarioType, isDefault, config }) !== initialSnapshot
	);
	const scenarioConfigDirty = $derived(
		JSON.stringify(config) !== JSON.stringify(getScenarioDefaults(confirmedScenario))
	);

	function handleScenarioChange() {
		const nextScenario = scenarioType;
		if (nextScenario === confirmedScenario) return;
		if (
			scenarioConfigDirty &&
			!window.confirm('Змінити цей сценарій? Незбережені налаштування конфігурації буде скинуто.')
		) {
			scenarioType = confirmedScenario;
			return;
		}
		confirmedScenario = nextScenario;
		const defaults = getScenarioDefaults(nextScenario);
		if (!defaults.flow_data || typeof defaults.flow_data !== 'object') {
			defaults.flow_data = {};
		}
		config = defaults;
	}

	function closeEditor() {
		if (saving) return;
		if (dirty && !window.confirm('Закрити редактор і відкинути незбережені зміни?')) return;
		onCancel();
	}

	onMount(() => {
		const guard = (event: BeforeUnloadEvent) => {
			if (!dirty) return;
			event.preventDefault();
		};
		window.addEventListener('beforeunload', guard);
		return () => window.removeEventListener('beforeunload', guard);
	});

	async function save() {
		if (!name.trim()) {
			error = 'Введіть назву шаблону';
			return;
		}

		saving = true;
		error = null;

		try {
			const finalConfig = resolveCheckoutConfig(scenarioType, config);
			if (!['fixed', 'open_amount', 'table', 'delivery', 'tips'].includes(scenarioType)) {
				finalConfig.checkout_flow = {
					id: scenarioType,
					version: 1,
					invoice_type: finalConfig.checkout_flow?.invoice_type ?? templateInvoiceType(scenarioType)
				};
			}
			const input: TemplateCreateInput = {
				name: name.trim(),
				scenario_type: scenarioType,
				scenario_config: finalConfig,
				is_default: isDefault
			};

			let saved: CheckoutTemplate;
			if (template) {
				saved = await updateTemplate(merchantId, template.id, input, demo);
			} else {
				saved = await createTemplate(merchantId, input, demo);
			}
			onSave(saved);
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Помилка при збереженні';
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-0 backdrop-blur-sm sm:p-4"
>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="template-editor-title"
		class="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[94vh] sm:rounded-lg md:h-[90vh]"
	>
		<header
			class="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 sm:px-6"
		>
			<div class="min-w-0">
				<h2 id="template-editor-title" class="text-xl font-bold text-zinc-900">
					{template ? 'Редагування шаблону' : 'Новий шаблон'}
				</h2>
				<p class="text-xs font-medium text-zinc-500" aria-live="polite">
					{dirty ? 'Є незбережені зміни' : 'Усі зміни збережено'}
				</p>
			</div>
			<button
				type="button"
				aria-label="Закрити редактор"
				class="grid size-10 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
				onclick={closeEditor}
			>
				<X size={20} />
			</button>
		</header>

		<div
			class="grid grid-cols-2 gap-1 border-b border-zinc-200 bg-zinc-100 p-1 md:hidden"
			aria-label="Режим редактора"
		>
			<button
				type="button"
				class:active={mobileView === 'settings'}
				onclick={() => (mobileView = 'settings')}
			>
				<Settings2 size={16} /> Налаштування
			</button>
			<button
				type="button"
				class:active={mobileView === 'preview'}
				onclick={() => (mobileView = 'preview')}
			>
				<Eye size={16} /> Прев’ю
			</button>
		</div>

		<div class="min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
			<div
				class:hidden={mobileView !== 'settings'}
				class="h-full overflow-y-auto border-zinc-200 bg-white p-4 pb-28 sm:p-6 sm:pb-28 md:block md:border-r"
			>
				<section aria-labelledby="template-basics" class="space-y-4">
					<div>
						<p class="text-xs font-bold tracking-wider text-blue-700 uppercase">Крок 1</p>
						<h3 id="template-basics" class="text-base font-bold text-zinc-900">Основне</h3>
					</div>

					<label class="block">
						<span class="mb-1 block text-sm font-semibold text-zinc-700">Назва шаблону</span>
						<input
							type="text"
							bind:value={name}
							placeholder="Наприклад: Тераса, VIP зал..."
							class="w-full rounded-lg border border-zinc-200 p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</label>

					<label class="block">
						<span class="mb-1 block text-sm font-semibold text-zinc-700">Тип чекауту</span>
						<select
							bind:value={scenarioType}
							onchange={handleScenarioChange}
							class="w-full rounded-lg border border-zinc-200 bg-white p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						>
							<optgroup label="Rahunok Engines">
								<option value="engine_buy">Buy (Товар &rarr; Кошик &rarr; Оплата)</option>
								<option value="engine_order">Order (Вибір &rarr; Кастомізація &rarr; Оплата)</option>
								<option value="engine_book">Book (Послуга &rarr; Слот &rarr; Передоплата)</option>
								<option value="engine_quote">Quote (Калькулятор ціни &rarr; Оплата)</option>
								<option value="engine_deliver">Deliver (Товар &rarr; Адреса &rarr; Доставка)</option>
								<option value="engine_split">Split (Спільний рахунок &rarr; Частки)</option>
							</optgroup>
							<optgroup label="Готові індустрії (Вертикалі)">
								<option value="vertical_food">🍕 Кафе / Доставка їжі</option>
								<option value="vertical_flowers">🌸 Квіти</option>
								<option value="vertical_auto">🚗 СТО / Шиномонтаж</option>
								<option value="vertical_beauty">💇 Салон краси / Барбершоп</option>
								<option value="vertical_cleaning">🧹 Клінінг</option>
								<option value="vertical_pets">🐕 Грумінг / Ветклініка</option>
								<option value="vertical_rental">🏕️ Оренда / Прокат</option>
								<option value="vertical_education">📚 Репетитори / Тренери</option>
								<option value="vertical_services">🔧 Майстри / Ремонт</option>
								<option value="vertical_delivery">📦 Мікроперевезення / Доставка</option>
								<option value="vertical_print">🖨️ Друкарня / Виготовлення</option>
								<option value="vertical_gifts">🎁 Подарунки / Індивідуальне замовлення</option>
							</optgroup>
							<optgroup label="Базові сценарії (Legacy)">
								<option value="fixed">Фіксована сума (Товар/Послуга)</option>
								<option value="table">HoReCa (Стіл в закладі)</option>
								<option value="delivery">Доставка (Товар + Логістика)</option>
								<option value="tips">Чайові / Донат</option>
								<option value="open_amount">Вільна сума</option>
								<option value="fuel_station">АЗС (Відпуск з колонки)</option>
							</optgroup>
						</select>
					</label>

					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							bind:checked={isDefault}
							class="size-4 rounded accent-blue-600"
						/>
						<span class="text-sm font-medium text-zinc-700">Встановити за замовчуванням</span>
					</label>
				</section>

				{#if ['vertical_auto', 'vertical_education', 'vertical_beauty', 'vertical_cleaning', 'vertical_pets', 'vertical_rental', 'vertical_services', 'engine_book'].includes(scenarioType)}
					<section aria-labelledby="template-flow-builder" class="mt-8 border-t border-zinc-200 pt-6">
						<div class="mb-2">
							<p class="text-xs font-bold tracking-wider text-blue-700 uppercase">Конфігуратор послуг</p>
							<h3 id="template-flow-builder" class="text-base font-bold text-zinc-900">
								Прайс робіт, категорії та режим роботи
							</h3>
							<p class="mt-1 text-sm text-zinc-500">
								Вкажіть актуальний перелік послуг вашого бізнесу. Вони миттєво з'являться на прев'ю праворуч.
							</p>
						</div>
						<FlowDataBuilder scenario={scenarioType} bind:flowData={config.flow_data} />
					</section>
				{/if}

				<section aria-labelledby="template-options" class="mt-8 border-t border-zinc-200 pt-6">
					<p class="text-xs font-bold tracking-wider text-blue-700 uppercase">Опції чекауту</p>
					<h3 id="template-options" class="text-base font-bold text-zinc-900">
						Додаткові налаштування
					</h3>
					<p class="mt-1 text-sm text-zinc-500">
						Лояльність, чайові, промокоди та інші параметри.
					</p>
					<CheckoutConfigEditor bind:config scenario={scenarioType} />
				</section>
			</div>

			<div
				class:hidden={mobileView !== 'preview'}
				class="relative h-full min-h-0 overflow-y-auto bg-zinc-50 md:block"
			>
				<div
					class="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-md"
				>
					<div>
						<p class="text-xs font-bold tracking-wider text-blue-700 uppercase">Крок 3</p>
						<h3 class="text-sm font-bold text-zinc-900">Перевірка вигляду</h3>
					</div>
					<span class="text-xs font-medium text-zinc-500">Без реальної оплати</span>
				</div>
				<CheckoutTemplatePreview scenario={scenarioType} {config} />
			</div>
		</div>

		<footer
			class="flex shrink-0 items-center gap-3 border-t border-zinc-200 bg-white px-4 py-3 sm:justify-end sm:px-6"
		>
			{#if error}
				<p class="mr-auto text-sm font-medium text-red-600" role="alert">{error}</p>
			{/if}
			<button
				type="button"
				onclick={closeEditor}
				disabled={saving}
				class="min-h-11 flex-1 rounded-md border border-zinc-300 px-5 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:flex-none"
			>
				Скасувати
			</button>
			<button
				type="button"
				onclick={save}
				disabled={saving || !dirty}
				class="min-h-11 flex-1 rounded-md bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
			>
				{saving ? 'Збереження...' : template ? 'Зберегти зміни' : 'Створити шаблон'}
			</button>
		</footer>
	</div>
</div>

<style>
	[aria-label='Режим редактора'] button {
		display: flex;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 6px;
		color: #52525b;
		font-size: 13px;
		font-weight: 700;
	}
	[aria-label='Режим редактора'] button.active {
		background: white;
		color: #18181b;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
	}
</style>
