<script lang="ts">
	import { onMount } from 'svelte';
	import type { CheckoutTemplate } from '../../types';
	import { listTemplates, deleteTemplate, setDefaultTemplate } from '../../templates/template-repository';
	import TemplateEditor from './TemplateEditor.svelte';

	let { merchantId }: { merchantId: string } = $props();

	let templates = $state<CheckoutTemplate[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let editorOpen = $state(false);
	let editingTemplate = $state<CheckoutTemplate | null>(null);

	onMount(async () => {
		await load();
	});

	async function load() {
		loading = true;
		try {
			templates = await listTemplates(merchantId);
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		editingTemplate = null;
		editorOpen = true;
	}

	function openEdit(t: CheckoutTemplate) {
		editingTemplate = t;
		editorOpen = true;
	}

	async function remove(id: string) {
		if (!confirm('Видалити цей шаблон?')) return;
		try {
			await deleteTemplate(id);
			templates = templates.filter(t => t.id !== id);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function makeDefault(id: string) {
		try {
			await setDefaultTemplate(merchantId, id);
			await load(); // Reload to get updated default status
		} catch (err: any) {
			alert(err.message);
		}
	}

	function onEditorSave(saved: CheckoutTemplate) {
		editorOpen = false;
		load();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold text-zinc-900">Шаблони чекауту</h2>
			<p class="text-sm text-zinc-500">Налаштуйте візуальний вигляд та функції екрана оплати.</p>
		</div>
		<button
			onclick={openCreate}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
		>
			+ Створити шаблон
		</button>
	</div>

	{#if error}
		<div class="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
	{/if}

	{#if loading}
		<div class="flex h-32 items-center justify-center text-zinc-400">Завантаження...</div>
	{:else if templates.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center">
			<div class="mb-4 flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
			</div>
			<h3 class="text-sm font-bold text-zinc-900">Немає шаблонів</h3>
			<p class="mt-1 text-sm text-zinc-500">Створіть свій перший шаблон, щоб пришвидшити виставлення рахунків.</p>
			<button onclick={openCreate} class="mt-4 text-sm font-bold text-blue-600 hover:text-blue-800">
				Створити зараз &rarr;
			</button>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each templates as t (t.id)}
				<div class="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
					<div class="border-b border-zinc-100 p-4">
						<div class="flex items-start justify-between">
							<div>
								<h3 class="font-bold text-zinc-900 line-clamp-1">{t.name}</h3>
								<p class="text-xs text-zinc-500 capitalize">{t.scenario_type}</p>
							</div>
							{#if t.is_default}
								<span class="rounded bg-blue-50 px-2 py-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase">Default</span>
							{/if}
						</div>
					</div>
					
					<div class="bg-zinc-50 p-4 flex gap-2 justify-end mt-auto">
						{#if !t.is_default}
							<button 
								onclick={() => makeDefault(t.id)}
								class="text-xs font-semibold text-zinc-500 hover:text-blue-600 mr-auto"
							>
								Зробити основним
							</button>
						{/if}
						<button 
							onclick={() => remove(t.id)}
							class="text-xs font-semibold text-red-600 hover:text-red-800"
						>
							Видалити
						</button>
						<button 
							onclick={() => openEdit(t)}
							class="text-xs font-semibold text-blue-600 hover:text-blue-800"
						>
							Редагувати
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if editorOpen}
	<TemplateEditor 
		{merchantId}
		template={editingTemplate} 
		onSave={onEditorSave} 
		onCancel={() => editorOpen = false} 
	/>
{/if}
