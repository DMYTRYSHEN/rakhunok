<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { BusinessEntity } from '../types';
	import { businessDraftScope, businessInvoicePreview, isBusinessDraftStorageEvent, settingsHref, type BusinessDraft } from './business-settings';
	import { createSettingsRepository } from './settings-repository';
	let { entity, context, demo = false }: {
		entity: BusinessEntity;
		context: { userId: string; merchantId: string; name: string };
		demo?: boolean;
	} = $props();
	let draft = $state<BusinessDraft | null>(null);
	let error = $state('');
	let loading = $state(false);
	let errorScope = $state('');
	let generation = 0;
	let loadedScope = $state('');
	const repository = createSettingsRepository();
	const scope = $derived(businessDraftScope(context.userId, context.merchantId, demo));
	const seller = $derived(draft?.sellers[entity.id]);
	const preview = $derived(scope === loadedScope && draft && seller ? businessInvoicePreview(draft, entity) : null);
	async function reloadDraft() {
		const request = ++generation;
		const requestedScope = scope;
		loading = true;
		draft = null;
		error = '';
		try {
			const snapshot = await repository.load({ ...context, demo });
			if (request !== generation || requestedScope !== scope) return;
			draft = snapshot.draft;
			loadedScope = requestedScope;
			error = '';
		} catch (cause) {
			if (request !== generation || requestedScope !== scope) return;
			draft = null;
			errorScope = requestedScope;
			error = cause instanceof Error ? cause.message : 'Чернетку не завантажено.';
		} finally { if (request === generation && requestedScope === scope) loading = false; }
	}
	function storageChanged(event: StorageEvent) {
		if (!demo) return;
		try {
			if (isBusinessDraftStorageEvent(event, businessDraftScope(context.userId, context.merchantId, demo))) reloadDraft();
		} catch {
			reloadDraft();
		}
	}
	// Reload external storage on scope changes, not on edits to the loaded snapshot.
	$effect(() => { scope; untrack(() => { void reloadDraft(); }); });
	onMount(() => () => { ++generation; });
</script>

<svelte:window onstorage={storageChanged} onfocus={reloadDraft} />

<aside class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-zinc-900" aria-label="Чернетка налаштувань продавця">
	<p class="font-bold">{context.name} → {entity.displayName}</p>
	<p class="mt-2 text-xs leading-5 text-zinc-600">Лише перегляд нових налаштувань. Вони ще не застосовуються до полів цього рахунку, отримувача або платежу.</p>
	{#if error && errorScope === scope}<p role="alert" class="mt-3 text-red-700">{error}</p>
	{:else if loading || scope !== loadedScope}<p role="status" class="mt-3 text-xs text-zinc-500">Завантаження налаштувань продавця…</p>
	{:else if preview && draft && seller}
		<dl class="mt-4 grid gap-3 sm:grid-cols-2">
			<div><dt class="text-xs text-zinc-500">Правила · номер-приклад</dt><dd class="break-all font-semibold">{preview.number}</dd></div>
			<div><dt class="text-xs text-zinc-500">ПДВ · чернетка</dt><dd>{seller.vatStatus === 'vat' ? 'Платник ПДВ' : seller.vatStatus === 'no-vat' ? 'Без ПДВ' : 'Не визначено'}</dd></div>
			<div><dt class="text-xs text-zinc-500">Режим · чернетка</dt><dd>{draft.mode === 'finance-company' ? 'Через фінкомпанію' : draft.mode === 'direct' ? 'Напряму' : 'Не налаштовано'}</dd></div>
			<div><dt class="text-xs text-zinc-500">Запланований отримувач</dt><dd class="break-words">{preview.payee || 'Не вказано'}</dd></div>
		</dl>
		<p class="mt-3 text-xs text-amber-800 dark:text-amber-300">Підключення не перевірено. Чернетка не дозволяє приймати оплату через фінкомпанію.</p>
		<details class="mt-3"><summary class="cursor-pointer font-semibold">Приклад призначення за новими правилами</summary><p class="mt-2 break-words leading-6">{preview.finalPurpose}</p></details>
	{:else}<p class="mt-3 text-xs text-zinc-500">Окремі правила цього продавця ще не збережено.</p>{/if}
	<div class="mt-4 flex flex-wrap gap-4 text-xs font-bold text-blue-700 dark:text-blue-300">
		<a href={resolve(settingsHref('invoice-rules', entity.id, demo) as '/')}>Правила продавця →</a>
		<a href={resolve(settingsHref('payment-methods', entity.id, demo) as '/')}>Приймання платежів →</a>
	</div>
</aside>