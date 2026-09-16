<script lang="ts">
	import type { CheckoutTemplate, TemplateCreateInput } from '../../types';
	import { createTemplate, updateTemplate } from '../../templates/template-repository';
	import CheckoutConfigEditor from '../../templates/CheckoutConfigEditor.svelte';
	import { getScenarioDefaults, resolveCheckoutConfig } from '$lib/features/shared/checkout-scenario-defaults';
	import { fade } from 'svelte/transition';

	let {
		merchantId,
		template = null,
		onSave,
		onCancel
	}: {
		merchantId: string;
		template?: CheckoutTemplate | null;
		onSave: (t: CheckoutTemplate) => void;
		onCancel: () => void;
	} = $props();

	let name = $state(template?.name || '');
	let scenarioType = $state(template?.scenario_type || 'fixed');
	let isDefault = $state(template?.is_default || false);
	let config = $state(
		template?.scenario_config || getScenarioDefaults(scenarioType as any)
	);

	let saving = $state(false);
	let error = $state<string | null>(null);
	let previewIframe: HTMLIFrameElement;

	function handleScenarioChange() {
		config = getScenarioDefaults(scenarioType as any);
	}

	async function save() {
		if (!name.trim()) {
			error = 'Введіть назву шаблону';
			return;
		}

		saving = true;
		error = null;

		try {
			const finalConfig = resolveCheckoutConfig(scenarioType as any, config);
			const input: TemplateCreateInput = {
				name: name.trim(),
				scenario_type: scenarioType,
				scenario_config: finalConfig,
				is_default: isDefault
			};

			let saved: CheckoutTemplate;
			if (template) {
				saved = await updateTemplate(merchantId, template.id, input);
			} else {
				saved = await createTemplate(merchantId, input);
			}
			onSave(saved);
		} catch (err: any) {
			error = err.message || 'Помилка при збереженні';
		} finally {
			saving = false;
		}
	}

	// Send live updates to preview iframe
	$effect(() => {
		if (previewIframe && previewIframe.contentWindow) {
			const finalConfig = resolveCheckoutConfig(scenarioType as any, config);
			previewIframe.contentWindow.postMessage(
				{
					type: 'CHECKOUT_CONFIG_UPDATE',
					scenario: scenarioType,
					config: finalConfig
				},
				'*'
			);
		}
	});
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm" transition:fade>
	<div class="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl md:flex-row">
		
		<!-- Left: Form -->
		<div class="flex h-full w-full flex-col overflow-y-auto border-r border-zinc-100 bg-white md:w-1/2 p-6">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold text-zinc-900">{template ? 'Редагування шаблону' : 'Новий шаблон'}</h2>
				<button type="button" class="text-zinc-400 hover:text-zinc-600" onclick={onCancel}>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<div class="space-y-4">
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
						<option value="fixed">Фіксована сума (Товар/Послуга)</option>
						<option value="table">HoReCa (Стіл в ресторані)</option>
						<option value="delivery">Доставка (Товар + логістика)</option>
						<option value="tips">Чайові / Донат</option>
						<option value="open_amount">Відкрита сума</option>
					</select>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={isDefault} class="size-4 rounded accent-blue-600" />
					<span class="text-sm font-medium text-zinc-700">Встановити за замовчуванням</span>
				</label>

				<div class="pt-4">
					<CheckoutConfigEditor bind:config={config} scenario={scenarioType} />
				</div>
			</div>

			<div class="mt-auto pt-6">
				{#if error}
					<p class="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
				{/if}
				<div class="flex gap-3">
					<button
						type="button"
						onclick={onCancel}
						class="flex-1 rounded-lg border border-zinc-200 py-3 font-semibold text-zinc-700 hover:bg-zinc-50"
					>
						Скасувати
					</button>
					<button
						type="button"
						onclick={save}
						disabled={saving}
						class="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
					>
						{saving ? 'Збереження...' : 'Зберегти шаблон'}
					</button>
				</div>
			</div>
		</div>

		<!-- Right: Live Preview -->
		<div class="hidden h-full w-full bg-zinc-50 md:block md:w-1/2 relative">
			<div class="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
				<span class="rounded-full bg-zinc-900/70 px-3 py-1 text-xs font-semibold tracking-wider text-white backdrop-blur-md">LIVE PREVIEW</span>
			</div>
			<!-- Embed Checkout preview route -->
			<iframe
				bind:this={previewIframe}
				src="https://letsrealtalk.com/pay/?demo=all&mode=preview"
				class="h-full w-full border-none"
				title="Checkout Preview"
			></iframe>
		</div>
	</div>
</div>
