<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { BusinessEntity, DashboardMerchant } from '../types';
	import { createSettingsRepository, SettingsConflictError } from './settings-repository';
	import { defaultFinancePurposeTemplate, financePurposeTokens } from './finance-purpose';
	import {
		businessDraftScope, businessInvoicePreview, copySellerRules, defaultBusinessDraft,
		defaultSellerDraft, isSafeSellerId, settingsHref,
		BusinessDraftConflictError, isBusinessDraftStorageEvent, reconcileBusinessEntities,
		type BusinessDraft, type BusinessSettingsView, type SellerDraft
	} from './business-settings';

	let { merchant, entities, userId, demo = false, view }: {
		merchant: DashboardMerchant; entities: BusinessEntity[]; userId: string;
		demo?: boolean; view: BusinessSettingsView;
	} = $props();
	const uid = $props.id();
	const tabs: { view: BusinessSettingsView; label: string }[] = [
		{ view: 'structure', label: 'Структура бізнесу' },
		{ view: 'invoice-rules', label: 'Правила рахунків' },
		{ view: 'payment-methods', label: 'Приймання платежів' }
	];
	const modes: { value: BusinessDraft['mode']; title: string; detail: string }[] = [
		{ value: 'unconfigured', title: 'Ще не налаштовано', detail: 'Без обраної моделі приймання' },
		{ value: 'direct', title: 'На власний IBAN', detail: 'Кожен продавець — окремий отримувач' },
		{ value: 'finance-company', title: 'Через фінкомпанію', detail: 'Спільний отримувач, окремі ID продавців' }
	];
	const panel = 'rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900';
	const input = 'mt-2 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
	let draft = $state<BusinessDraft>(defaultBusinessDraft());
	let ready = $state(false);
	let loadedScope = $state('');
	let baseline: string | null = null;
	let revision = $state(0);
	let busy = $state(false);
	let generation = 0;
	const repository = createSettingsRepository();
	let storageConflict = $state(false);
	let dirty = $state(false);
	let feedback = $state('');
	let error = $state('');
	let copyFrom = $state('');
	let previewDate = $state(new Date());
	const sellers = $derived(entities.filter((entity) => isSafeSellerId(entity.id)));
	const scope = $derived(businessDraftScope(userId, merchant.id, demo));
	const sameScope = $derived(scope === loadedScope);
	const selected = $derived(sellers.find((entity) => entity.id === draft.selectedSellerId));
	const seller = $derived(selected ? draft.sellers[selected.id] : undefined);
	const preview = $derived(selected && seller ? businessInvoicePreview(draft, selected, previewDate) : null);
	const title = $derived(tabs.find((tab) => tab.view === view)?.label);

	// This effect invalidates external async work; it is not derived draft state.
	$effect(() => {
		scope;
		// Invalidate even A → B → A transitions before an old request settles.
		untrack(() => {
			++generation;
			busy = false;
			ready = false;
			loadedScope = '';
			feedback = '';
			error = '';
			copyFrom = '';
			storageConflict = false;
		});
	});

	$effect(() => {
		const available = sellers;
		if (!ready || !sameScope) return;
		// Only entity availability triggers reconciliation; field edits never reload storage.
		untrack(() => {
			reconcileBusinessEntities(draft, available);
			if (!available.some((entity) => entity.id === copyFrom)) copyFrom = '';
		});
	});

	function storageChanged(event: StorageEvent) {
		if (!demo || !ready || !sameScope) return;
		try {
			if (!isBusinessDraftStorageEvent(event, loadedScope)) return;
			storageConflict = true;
			feedback = '';
		} catch (cause) {
			storageConflict = true;
			error = cause instanceof Error ? cause.message : 'Сховище недоступне.';
		}
	}
	function reloadDraft() {
		if (busy) return;
		if (dirty && !window.confirm('Відкинути всі незбережені правки та завантажити актуальну чернетку?')) return;
		readDraft();
	}
	function changed() { dirty = true; feedback = ''; error = ''; }
	function selectSeller(id: string, markDirty = true) {
		const entity = sellers.find((item) => item.id === id);
		if (!entity) return;
		if (!Object.hasOwn(draft.sellers, id)) draft.sellers[id] = defaultSellerDraft(entity);
		if (demo && draft.selectedSellerId !== id && markDirty) changed();
		draft.selectedSellerId = id;
		copyFrom = '';
		feedback = '';
	}
	async function readDraft() {
		const request = ++generation;
		const requestedScope = scope;
		const context = { userId, merchantId: merchant.id, demo };
		busy = true;
		ready = false;
		error = '';
		feedback = '';
		copyFrom = '';
		try {
			const snapshot = await repository.load(context);
			if (request !== generation || requestedScope !== scope) return;
			const next = snapshot.draft;
			reconcileBusinessEntities(next, sellers);
			const requested = new URL(window.location.href).searchParams.get('entityId');
			const selectedId = sellers.some((item) => item.id === requested) ? requested!
				: sellers.some((item) => item.id === next.selectedSellerId) ? next.selectedSellerId : sellers[0]?.id ?? '';
			next.selectedSellerId = selectedId;
			draft = next;
			baseline = snapshot.baseline;
			revision = snapshot.revision;
			storageConflict = false;
			loadedScope = scope;
			dirty = false;
			feedback = requested && requested !== selectedId ? 'Продавця з посилання не знайдено. Обрано доступного продавця.' : '';
			previewDate = new Date();
			ready = true;
		} catch (cause) {
			if (request === generation && requestedScope === scope) error = cause instanceof Error ? cause.message : 'Не вдалося прочитати чернетку.';
		} finally { if (request === generation && requestedScope === scope) busy = false; }
	}
	async function save() {
		if (!ready || !sameScope || storageConflict || busy) return;
		const request = ++generation;
		const requestedScope = scope;
		const context = { userId, merchantId: merchant.id, demo };
		busy = true;
		try {
			const snapshot = await repository.save(context, draft, baseline, revision);
			if (request !== generation || requestedScope !== scope) return;
			baseline = snapshot.baseline;
			revision = snapshot.revision;
			dirty = false;
			error = '';
			feedback = demo ? 'Усі чернетки збережено лише в цьому браузері. Робочі платежі не змінено.'
				: `Усі налаштування збережено в базі однією транзакцією. Версія ${revision}. Робочі платежі не змінено.`;
		} catch (cause) {
			if (request !== generation || requestedScope !== scope) return;
			if (cause instanceof BusinessDraftConflictError || cause instanceof SettingsConflictError) storageConflict = true;
			feedback = '';
			error = cause instanceof Error ? cause.message : 'Не вдалося зберегти чернетку.';
		} finally { if (request === generation && requestedScope === scope) busy = false; }
	}
	function copyRules() {
		if (!selected || !seller || copyFrom === selected.id) return;
		const source = sellers.find((entity) => entity.id === copyFrom);
		if (!source || !window.confirm('Скопіювати правила? ПДВ, наступний номер і дані підключення цього продавця залишаться без змін.')) return;
		draft.sellers[selected.id] = copySellerRules(draft.sellers[source.id] ?? defaultSellerDraft(source), seller);
		changed();
		feedback = 'Правила скопійовано в чернетку. Збережіть усі зміни.';
	}
	function vatLabel(value: SellerDraft['vatStatus'] | undefined) {
		return value === 'vat' ? 'Платник ПДВ' : value === 'no-vat' ? 'Без ПДВ' : 'ПДВ не визначено';
	}
	beforeNavigate((navigation) => {
		if (!dirty || navigation.willUnload) return;
		if (!window.confirm('Є незбережені чернетки. Залишити сторінку без збереження?')) navigation.cancel();
	});
	onMount(() => {
		readDraft();
		const guard = (event: BeforeUnloadEvent) => {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', guard);
		return () => { ++generation; window.removeEventListener('beforeunload', guard); };
	});
</script>

<svelte:window onstorage={storageChanged} />

<section class="mx-auto mb-8 max-w-7xl space-y-5 text-zinc-950 dark:text-zinc-100" aria-label="Налаштування бізнесу — чернетки">
	<header class="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5 sm:p-7 dark:border-zinc-800 dark:from-blue-950 dark:via-zinc-900 dark:to-emerald-950">
		<p class="text-xs font-bold tracking-widest text-blue-700 uppercase dark:text-blue-300">Бізнес / {demo ? 'демо-чернетка' : 'налаштування облікового запису'}</p>
		<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">{title}</h1>
		<p class="mt-3 break-words text-lg font-semibold">{merchant.businessName || merchant.displayName}</p>
		<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Один бізнес — окремі правила для кожного ТОВ та ФОП. У цій версії доступний поточний бізнес кабінету; додавання інших бізнесів потребує серверної інтеграції.</p>
		<div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<label class="block w-full text-sm font-semibold sm:max-w-sm" for={`${uid}-seller`}>Продавець
				<select id={`${uid}-seller`} class={input} value={draft.selectedSellerId} disabled={busy || !ready || !sameScope || !sellers.length} onchange={(event) => selectSeller(event.currentTarget.value)}>
					{#if !sellers.length}<option value="">Немає продавців</option>{/if}
					{#each sellers as entity (entity.id)}<option value={entity.id}>{entity.displayName || entity.businessName}</option>{/each}
				</select>
			</label>
			<span class="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{busy ? 'Обмін зі сховищем…' : dirty ? 'Є незбережені зміни' : demo ? 'Лише локальні налаштування' : `Не застосовано до платежів · версія ${revision}`}</span>
		</div>
		<nav class="mt-5 flex flex-wrap gap-2" aria-label="Розділи налаштувань бізнесу">
			{#each tabs as tab (tab.view)}
				<a href={resolve(settingsHref(tab.view, sameScope ? draft.selectedSellerId : '', demo) as '/')} aria-current={view === tab.view ? 'page' : undefined} class="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors {view === tab.view ? 'bg-blue-600 text-white' : 'bg-white/70 text-zinc-700 hover:bg-blue-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}">{tab.label}</a>
			{/each}
		</nav>
	</header>
	<div class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">Ці дані не впливають на створення рахунків, QR або приймання платежів. Не вводьте паролі, токени чи API-ключі. Введений ID — неперевірена чернетка, не активація.</div>
	{#if error}<p role="alert" class="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>{/if}
	{#if feedback}<p role="status" class="text-sm text-blue-700 dark:text-blue-300">{feedback}</p>{/if}
	{#if storageConflict && sameScope}
		<div class={panel} role="alert"><p>Сховище змінилося або версія застаріла. Ваші правки залишаються на екрані; збереження заблоковано до явного перезавантаження чернетки.</p><button type="button" disabled={busy} class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white" onclick={reloadDraft}>Відкинути локальні правки й завантажити актуальну чернетку</button></div>
	{/if}
	{#if !sameScope && ready}
		<div class={panel}><p>Контекст користувача або бізнесу змінився. Стару чернетку приховано; збереження заблоковано.</p><button type="button" class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white" onclick={() => { if (!dirty || window.confirm('Відкинути незбережені зміни попереднього контексту?')) readDraft(); }}>Завантажити поточний контекст</button></div>
	{:else if !ready}
		<div class={panel}><p>Чернетка ще не завантажена. Редагування недоступне, щоб не перезаписати дані.</p><button type="button" disabled={busy} class="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white" onclick={reloadDraft}>Повторити читання</button></div>
	{:else if !sellers.length}
		<div class="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"><h2 class="text-lg font-bold">Спочатку додайте продавця</h2><p class="mt-2 text-sm text-zinc-500">Нові записи тут не створюються. Скористайтеся керуванням структурою нижче.</p><a class="mt-4 inline-block text-sm font-semibold text-blue-600 dark:text-blue-300" href={resolve(settingsHref('structure', '', demo) as '/')}>Відкрити структуру бізнесу →</a></div>
	{:else}
		<form onsubmit={(event) => { event.preventDefault(); save(); }} oninput={changed} onchange={changed} class="space-y-5">
			<fieldset disabled={busy} class="min-w-0 space-y-5 border-0 p-0">
			{#if view === 'structure'}
				<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{#each sellers as entity (entity.id)}
						<button type="button" onclick={() => selectSeller(entity.id)} aria-pressed={selected?.id === entity.id} class="min-w-0 rounded-xl border p-5 text-left {selected?.id === entity.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}">
							<strong class="block break-words">{entity.displayName || entity.businessName}</strong><span class="mt-2 block text-xs text-zinc-500">{entity.businessType.toUpperCase()} · {entity.isActive ? 'Активний запис' : 'Неактивний запис'}</span>
							<span class="mt-3 block text-sm">{vatLabel(draft.sellers[entity.id]?.vatStatus)}</span><span class="mt-1 block text-xs text-zinc-500">Профіль: {demo ? 'локальна демо-чернетка' : 'налаштування облікового запису, не застосовано до платежів'} · {draft.sellers[entity.id]?.providerSellerId ? 'ID внесено, не перевірено' : 'ID не задано'}</span>
						</button>
					{/each}
				</div>
				{#if selected && seller}
					<section class={panel}><h2 class="text-lg font-bold">Профіль продавця</h2><dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt class="text-zinc-500">Юридична назва · лише читання</dt><dd class="mt-1 break-words font-semibold">{selected.businessName}</dd></div><div><dt class="text-zinc-500">Податковий код · лише читання</dt><dd class="mt-1 font-mono">{selected.taxId || 'Не вказано'}</dd></div><div class="sm:col-span-2"><dt class="text-zinc-500">Власний IBAN · {selected.bankName || 'Банк не вказано'}</dt><dd class="mt-1 break-all font-mono">{selected.iban || 'Не вказано'}</dd></div></dl>
						<label class="mt-5 block max-w-sm text-sm font-semibold">Статус ПДВ — чернетка<select class={input} bind:value={seller.vatStatus}><option value="unknown">Не визначено</option><option value="vat">Платник ПДВ</option><option value="no-vat">Без ПДВ</option></select></label><p class="mt-3 text-xs leading-5 text-zinc-500">ПДВ не визначається юридичною формою автоматично. Назва, код, IBAN та додавання продавців редагуються в наявному блоці структури нижче.</p>
					</section>
				{/if}
			{:else if view === 'invoice-rules' && seller}
				<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
					<section class={panel}><h2 class="text-lg font-bold">Нумерація та призначення</h2><p class="mt-1 text-sm text-zinc-500">Окремі правила для кожного продавця</p>
						<div class="mt-5 grid gap-4 sm:grid-cols-3"><label class="text-sm font-semibold">Префікс<input class={input} maxlength="20" bind:value={seller.prefix} /></label><label class="text-sm font-semibold">Наступний номер<input class={input} type="number" min="1" max="999999999999" step="1" required bind:value={seller.nextNumber} /></label><label class="text-sm font-semibold">Кількість цифр<input class={input} type="number" min="1" max="12" step="1" required bind:value={seller.padding} /></label></div>
						<label class="mt-5 block text-sm font-semibold">Шаблон призначення<input class={input} maxlength="420" required bind:value={seller.purposeTemplate} /></label><p class="mt-2 text-xs text-zinc-500">Підстановки: {'{number}'} — номер, {'{date}'} — дата, {'{tax}'} — ПДВ.</p>
						<div class="mt-5 grid gap-4 sm:grid-cols-2"><label class="text-sm font-semibold">Категорія QR<input class={input} pattern={'[A-Z0-9]{4}/[A-Z0-9]{4}'} maxlength="9" aria-describedby={`${uid}-qr-note`} required bind:value={seller.qrCategory} /></label><label class="text-sm font-semibold">Функція QR<select class={input} bind:value={seller.qrFunction}><option>UCT</option><option>ICT</option><option>XCT</option></select></label></div><p id={`${uid}-qr-note`} class="mt-2 text-xs leading-5 text-zinc-500">Лише синтаксис чернетки: по 4 великі латинські літери або цифри через /, наприклад EPAY/MP2B. Це не підтверджує чинність кодів ISO чи сумісність із провайдером.</p><label class="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" class="size-4 accent-blue-600" bind:checked={seller.allowAmountEdit} />Дозволити зміну суми — лише намір у чернетці</label>
						<div class="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800"><label class="block text-sm font-semibold">Копіювати правила від<select class={input} bind:value={copyFrom}><option value="">Оберіть іншого продавця</option>{#each sellers.filter((entity) => entity.id !== selected?.id) as entity (entity.id)}<option value={entity.id}>{entity.displayName || entity.businessName}</option>{/each}</select></label><button type="button" disabled={!copyFrom} onclick={copyRules} class="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700">Копіювати правила</button><p class="mt-2 text-xs leading-5 text-zinc-500">ПДВ, наступний номер, ID провайдера та решта даних підключення поточного продавця зберігаються.</p></div>
					</section>
					<aside class={panel}><p class="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-300">Попередній перегляд</p><h2 class="mt-3 break-all font-mono text-2xl font-bold">{preview?.number}</h2><p class="mt-3 text-xs leading-5 text-zinc-500">Лічильник не атомарний: номер не резервується й не використовується для реального рахунку.</p><h3 class="mt-6 text-sm font-bold">Призначення бізнесу</h3><p class="mt-2 break-words text-sm leading-6">{preview?.businessPurpose}</p><h3 class="mt-6 text-sm font-bold">Фінальне призначення · {draft.mode === 'finance-company' ? 'фінкомпанія' : draft.mode === 'direct' ? 'власний IBAN' : 'модель не обрана'}</h3><p class="mt-2 break-words rounded-xl bg-zinc-50 p-4 text-sm leading-6 dark:bg-zinc-950">{preview?.finalPurpose}</p><p class="mt-3 text-xs leading-5 text-zinc-500">Для фінкомпанії коди та ID платежу додаються окремо від шаблону бізнесу. Це ілюстрація, не підтверджений формат провайдера. Реальний ID створює сервер. QR не генерується.</p></aside>
				</div>
			{:else if view === 'payment-methods'}
				<section class={panel}><h2 class="text-lg font-bold">Модель приймання платежів</h2><p class="mt-1 text-sm text-zinc-500">Одна модель для бізнесу, окремі дані підключення продавців.</p><div class="mt-5 grid gap-3 md:grid-cols-3">{#each modes as mode (mode.value)}<label class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 {draft.mode === mode.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-zinc-200 dark:border-zinc-700'}"><input class="mt-1 accent-blue-600" type="radio" name={`${uid}-mode`} value={mode.value} bind:group={draft.mode} /><span><strong class="block text-sm">{mode.title}</strong><span class="mt-2 block text-xs leading-5 text-zinc-500">{mode.detail}</span></span></label>{/each}</div></section>
				{#if draft.mode === 'finance-company'}
					<section class={panel}><h2 class="text-lg font-bold">Отримувач — фінансова компанія</h2><p class="mt-1 text-sm text-zinc-500">Реквізити не перевірені. Заповнення не підключає платежі.</p><div class="mt-5 grid gap-4 md:grid-cols-2"><label class="text-sm font-semibold">Назва фінкомпанії<input class={input} maxlength="200" bind:value={draft.financeName} /></label><label class="text-sm font-semibold">ЄДРПОУ / РНОКПП<input class={input} inputmode="numeric" maxlength="10" pattern={'([0-9]{8}|[0-9]{10})'} bind:value={draft.financeTaxId} /></label><label class="text-sm font-semibold md:col-span-2">IBAN фінкомпанії<input class={input} placeholder="UA…" maxlength="29" pattern={'UA[0-9]{27}'} bind:value={draft.financeIban} /></label></div></section>
					<section class={panel} aria-label="Правила призначення фінкомпанії">
						<h2 class="text-lg font-bold">Правила призначення платежу</h2>
						<p class="mt-2 text-sm text-zinc-500">Шаблон фінкомпанії · версія формату 1. Не погоджено провайдером, не активовано.</p>
						<label class="mt-4 block text-sm font-semibold">Шаблон фінкомпанії
							<input class={input} maxlength="1000" required value={draft.financePurposeTemplate ?? defaultFinancePurposeTemplate}
								oninput={(event) => { draft.version = 2; draft.financePurposeTemplate = event.currentTarget.value; changed(); }} />
						</label>
						<p class="mt-3 break-words text-xs leading-6 text-zinc-500">Дозволені підстановки: {financePurposeTokens.map((token) => `{${token}}`).join(', ')}.</p>
						<p class="mt-2 text-xs leading-5 text-zinc-500">business_purpose — призначення бізнесу; seller_* — власні реквізити продавця; provider_* — коди підключення; contract_reference — договір. payment_id створюється лише сервером для справжнього платежу.</p>
						<h3 class="mt-5 text-sm font-bold">Приклад для обраного продавця</h3>
						<p class="mt-2 break-words rounded-xl bg-zinc-50 p-4 text-sm leading-6 dark:bg-zinc-950">{preview?.finalPurpose}</p>
						<p class="mt-3 text-xs text-zinc-500">Обмеження редактора не є підтвердженням формату або ліміту конкретного провайдера.</p>
					</section>
				{:else if draft.mode === 'direct' && selected}
					<section class={panel}><h2 class="text-lg font-bold">Власний рахунок продавця</h2><p class="mt-3 break-words text-sm">{selected.businessName} · {selected.bankName || 'Банк не вказано'}</p><p class="mt-2 break-all font-mono text-sm">{selected.iban || 'IBAN не вказано'}</p><p class="mt-3 text-sm text-zinc-500">Статус банківського підключення: невідомий. IBAN показано з наявного профілю; це не підтвердження готовності приймати платежі.</p></section>
				{/if}
				{#if draft.mode === 'finance-company'}
				<section class={panel}><h2 class="text-lg font-bold">Продавці та їхні ID</h2><div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800"><tr><th class="p-3">Продавець</th><th class="p-3">ID у провайдера</th><th class="p-3">Стан чернетки</th></tr></thead><tbody>{#each sellers as entity (entity.id)}<tr class="border-b border-zinc-100 dark:border-zinc-800"><td class="p-3"><button type="button" class="text-left font-semibold text-blue-600 dark:text-blue-300" onclick={() => selectSeller(entity.id)}>{entity.displayName || entity.businessName}</button></td><td class="max-w-64 break-all p-3 font-mono">{draft.sellers[entity.id]?.providerSellerId || 'Не задано'}</td><td class="p-3 text-zinc-500">{draft.sellers[entity.id]?.providerSellerId ? 'ID внесено · не перевірено' : 'Не заповнено · не перевірено'}</td></tr>{/each}</tbody></table></div></section>
				{#if selected && seller}
					<section class={panel}><h2 class="text-lg font-bold">Підключення: {selected.displayName || selected.businessName}</h2><div class="mt-5 grid gap-4 md:grid-cols-3"><label class="text-sm font-semibold">ID продавця у провайдера<input class={input} maxlength="200" autocomplete="off" bind:value={seller.providerSellerId} /></label><label class="text-sm font-semibold">Код провайдера<input class={input} maxlength="200" autocomplete="off" bind:value={seller.providerCode} /></label><label class="text-sm font-semibold">Номер договору<input class={input} maxlength="200" bind:value={seller.contractReference} /></label></div><button type="button" disabled aria-describedby={`${uid}-verify-note`} class="mt-5 cursor-not-allowed rounded-lg bg-zinc-200 px-5 py-2.5 text-sm font-bold text-zinc-500 dark:bg-zinc-800">Перевірити підключення</button><p id={`${uid}-verify-note`} class="mt-3 text-xs leading-5 text-zinc-500">Перевірка недоступна: захищений серверний API ще не інтегровано. ID не є секретом, але сам по собі не підтверджує договір, готовність або активацію. Не вставляйте сюди облікові дані.</p></section>
				{/if}
				{/if}
			{/if}
			{#if !selected}<p class="text-sm text-zinc-500">Оберіть доступного продавця. Попередній запис міг бути видалений.</p>{/if}
			<footer class="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"><p class="text-xs leading-5 text-zinc-500">{demo ? 'Зберігаються всі продавці та модель бізнесу в цьому браузері.' : 'Усі продавці та модель бізнесу зберігаються разом у базі. Старі локальні чернетки не імпортуються автоматично.'}<br />Перемикання продавця не скидає незбережені правки.</p><button type="submit" disabled={busy || !dirty || storageConflict || !sameScope || !ready} class="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Зберегти всі чернетки</button></footer>
			</fieldset>
		</form>
	{/if}
</section>