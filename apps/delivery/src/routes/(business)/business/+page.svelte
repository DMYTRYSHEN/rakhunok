<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Package2, Plus, RefreshCw, Search, Trash2, ArrowLeft, ChevronRight, Copy, X } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { normalizeTrackingNumber, suggestCarrier, type SuggestedCarrier } from '#lib/carrier-detection.ts';
	import type { Shipment } from '#lib/server/tracking/store.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let searchQuery = $state('');
	let selectedCarrier = $state('');
	let pending = $state(false);
	let mode = $state('active');
	let createDialog: HTMLDialogElement;
	let deleteDialog: HTMLDialogElement;
	let deleteId = $state('');
	let copyMessage = $state('');
	let newNumber = $state('');
	let newCarrier = $state<SuggestedCarrier | ''>('');
	let manualCarrier = $state(false);
	const suggestedCarrier = $derived(suggestCarrier(newNumber));
	function changeNumber(event: Event) {
		newNumber = normalizeTrackingNumber((event.currentTarget as HTMLInputElement).value);
		if (!manualCarrier) newCarrier = suggestCarrier(newNumber) ?? '';
	}
	const completed = new Set<Shipment['deliveryStatus']>(['delivered', 'returned', 'cancelled']);
	const selectedShipment = $derived(data.shipments.find(row => row.id === page.url.searchParams.get('shipment')));
	function openShipment(id?: string) {
		const url = new URL(page.url.href);
		if (id) url.searchParams.set('shipment', id); else url.searchParams.delete('shipment');
		copyMessage = '';
		return goto(url, { reset: false });
	}
	async function copyNumber(number: string) {
		try { await navigator.clipboard.writeText(number); copyMessage = 'Номер скопійовано.'; }
		catch { copyMessage = 'Не вдалося скопіювати номер. Скопіюйте його вручну.'; }
	}
	const carriers: Record<Shipment['carrier'], string> = { nova_poshta: 'Нова пошта', ukrposhta: 'Укрпошта', meest: 'Meest' };
	const trackingNumberPattern = '[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*';
	const statuses: Record<Shipment['deliveryStatus'], string> = {
		unknown: 'Статус невідомий', label_created: 'Накладну створено', accepted: 'Прийнято перевізником',
		in_transit: 'У дорозі', customs: 'Митне оформлення', ready_for_pickup: 'До отримання',
		out_for_delivery: 'Передано кур’єру', delivered: 'Вручено', delivery_attempt_failed: 'Невдала спроба вручення',
		refused: 'Відмова від отримання', return_in_transit: 'Повертається відправнику', returned: 'Повернено',
		cancelled: 'Скасовано', lost: 'Втрату підтверджено', damaged: 'Пошкодження підтверджено', exception: 'Проблема доставки'
	};
	const health: Record<Shipment['trackingState'], string> = {
		pending: 'Очікує перевірки', active: 'Відстеження активне', needs_carrier: 'Потрібне підключення перевізника',
		needs_verification: 'Потрібна верифікація', not_found: 'Не знайдено у перевізника',
		rate_limited: 'Ліміт запитів перевізника', provider_unavailable: 'Перевізник недоступний',
		access_denied: 'Доступ перевізника відхилено', unsupported: 'Відстеження не підтримується',
		paused: 'Відстеження призупинено', completed: 'Відстеження завершено', expired: 'Термін відстеження минув'
	};
	const visibleShipments = $derived(data.shipments.filter((row) =>
		(mode === 'all' || (mode === 'completed' ? completed.has(row.deliveryStatus) : !completed.has(row.deliveryStatus))) &&
		(!selectedCarrier || row.carrier === selectedCarrier) &&
		`${row.trackingNumber} ${carriers[row.carrier]} ${row.providerStatusLabel ?? statuses[row.deliveryStatus]}`
			.toLocaleLowerCase('uk-UA').includes(searchQuery.trim().toLocaleLowerCase('uk-UA'))
	));
	const dateFormat = new Intl.DateTimeFormat('uk-UA', {
		timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short'
	});
	function formatTime(value: string | null) {
		return value && Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value)) : 'Ще не було';
	}
	const submit: SubmitFunction = ({ cancel }) => {
		if (pending) { cancel(); return; }
		pending = true;
		return async ({ update }) => {
			try { await update(); } finally { pending = false; }
		};
	};
	const createSubmit: SubmitFunction = ({ cancel }) => {
		if (pending) { cancel(); return; }
		pending = true;
		return async ({ update, result }) => {
			try {
				await update();
				if (result.type === 'success' && typeof result.data?.shipmentId === 'string') {
					newNumber = ''; newCarrier = ''; manualCarrier = false;
					createDialog.close();
					await openShipment(result.data.shipmentId);
				}
			} finally { pending = false; }
		};
	};
	const deleteSubmit: SubmitFunction = ({ cancel }) => {
		if (pending) { cancel(); return; }
		pending = true;
		return async ({ update, result }) => {
			try {
				await update();
				if (result.type === 'success') { deleteDialog.close(); await openShipment(); }
			} finally { pending = false; }
		};
	};
</script>

<svelte:head><title>Відправлення — Rahunok Business</title></svelte:head>

{#snippet createFields()}
		<label>Номер накладної
			<input name="trackingNumber" value={newNumber} oninput={changeNumber} required maxlength={64} pattern={trackingNumberPattern} disabled={pending} autocomplete="off" />
		</label>
		<label>Перевізник
			<select name="carrier" bind:value={newCarrier} onchange={() => { manualCarrier = Boolean(newCarrier); }} required disabled={pending}>
				<option value="">Оберіть перевізника</option>
				<option value="nova_poshta">Нова пошта</option>
				<option value="ukrposhta">Укрпошта</option>
				<option value="meest">Meest</option>
			</select>
			<small aria-live="polite">{manualCarrier ? 'Обрано вручну' : suggestedCarrier ? 'За форматом номера' : newNumber ? 'Формат неоднозначний' : ''}</small>
		</label>
		<button type="submit" class="create-button" disabled={pending}><Plus size={16} /> Додати</button>
{/snippet}
<main class="business-content">
	<header class="page-header">
		{#if selectedShipment}<button type="button" class="icon-button" aria-label="Назад до відправлень" onclick={() => openShipment()}><ArrowLeft size={22} /></button>{/if}
		<div>
		<div class="business-eyebrow"><Package2 size={14} /> РОБОЧИЙ ПРОСТІР</div>
		<h1>{selectedShipment ? 'Деталі відправлення' : 'Відправлення'}</h1>
		</div>
		{#if !selectedShipment}
		<div class="header-actions">
			<a class="new-shipment" href={resolve('/(business)/business/new')}><Plus size={18} /><span>Створити відправлення</span></a>
			<button class="icon-button" type="button" aria-label="Додати наявну накладну" title="Додати наявну накладну" onclick={() => createDialog.showModal()}><Package2 size={22} /></button>
		</div>
		{/if}
	</header>
	{#if !selectedShipment}<form method="POST" action="?/create" use:enhance={createSubmit} class="create-form desktop-create" aria-busy={pending}>{@render createFields()}</form>{/if}
	<div class="message" role="status">{form?.message ?? (pending ? 'Виконується запит…' : '')}</div>
	{#if !selectedShipment}
	<div class="modes" role="group" aria-label="Стан відправлень">
		{#each [{ value: 'active', label: 'Активні' }, { value: 'completed', label: 'Завершені' }, { value: 'all', label: 'Усі' }] as option (option.value)}<button type="button" aria-pressed={mode === option.value} onclick={() => mode = option.value}>{option.label}</button>{/each}
	</div>
	<div class="filters">
		<label class="search"><span><Search size={14} /> Пошук відправлень</span><input type="search" bind:value={searchQuery} /></label>
		<label>Перевізник
			<select bind:value={selectedCarrier}>
				<option value="">Усі перевізники</option>
				<option value="nova_poshta">Нова пошта</option>
				<option value="ukrposhta">Укрпошта</option>
				<option value="meest">Meest</option>
			</select>
		</label>
	</div>
	{/if}
	<section aria-label="Відправлення" aria-busy={pending}>
		{#each selectedShipment ? [selectedShipment] : visibleShipments as row (row.id)}
			<article class="shipment">
				{#if !selectedShipment}
					<button type="button" class="shipment-link" onclick={() => openShipment(row.id)} aria-label={`Відкрити відправлення ${row.trackingNumber}`}><span class="carrier-mark"><Package2 size={22} /></span><span><strong>{row.trackingNumber}</strong><span>{carriers[row.carrier]}</span><span class="delivery-status">{row.providerStatusLabel || statuses[row.deliveryStatus]}</span><small>{health[row.trackingState]} · {formatTime(row.lastCheckedAt)}</small></span><ChevronRight size={20} /></button>
				{:else}
				<div class="shipment-grid">
					<div><h2>{row.trackingNumber}</h2><p>{carriers[row.carrier]}</p></div>
					<div><p class="delivery-status">{row.providerStatusLabel || statuses[row.deliveryStatus]}</p><p>{health[row.trackingState]}</p></div>
					<dl>
						<div><dt>Остання перевірка (Київ)</dt><dd>{formatTime(row.lastCheckedAt)}</dd></div>
						<div><dt>Успішне оновлення (Київ)</dt><dd>{formatTime(row.lastSuccessAt)}</dd></div>
					</dl>
					<div class="actions">
						<form method="POST" action="?/refresh" use:enhance={submit}>
							<input type="hidden" name="id" value={row.id} />
							<button type="submit" disabled={pending} title="Оновити відправлення" aria-label={`Оновити відправлення ${row.trackingNumber}`}><RefreshCw size={16} /></button>
						</form>
						<button type="button" title="Скопіювати номер" aria-label="Скопіювати номер накладної" onclick={() => copyNumber(row.trackingNumber)}><Copy size={16} /></button>
						<button type="button" disabled={pending} title="Видалити відправлення" aria-label={`Видалити відправлення ${row.trackingNumber}`} onclick={() => { deleteId = row.id; deleteDialog.showModal(); }}><Trash2 size={16} /></button>
					</div>
				</div>
				<p role="status">{copyMessage}</p>
				{#if row.carrier === 'nova_poshta' && row.details}
					<dl class="shipment-facts">
						<div><dt>Маршрут</dt><dd>{row.details.origin.city ?? 'Не надано'} → {row.details.destination.city ?? 'Не надано'}</dd></div>
						<div><dt>Вага / місць</dt><dd>{row.details.cargo.weight ?? '—'} кг / {row.details.cargo.seats ?? '—'}</dd></div>
						<div><dt>Оголошена вартість</dt><dd>{row.details.amounts.declared ?? '—'} грн</dd></div>
						<div><dt>Вартість доставки</dt><dd>{row.details.amounts.delivery ?? '—'} грн</dd></div>
						<div><dt>Накладну створено (час НП)</dt><dd>{row.details.dates.created?.value ?? 'Не надано'}</dd></div>
						<div><dt>Очікувана доставка (час НП)</dt><dd>{row.details.dates.estimatedDelivery?.value ?? 'Не надано'}</dd></div>
						<div><dt>Отримано (час НП)</dt><dd>{row.details.dates.received?.value ?? 'Не надано'}</dd></div>
						<div><dt>Сканування статусу (час НП)</dt><dd>{row.details.dates.scanned?.value ?? 'Не надано'}</dd></div>
						<div><dt>Початок зберігання (час НП)</dt><dd>{row.details.dates.storageStarted?.value ?? 'Не надано'}</dd></div>
						<div><dt>Платне зберігання з (час НП)</dt><dd>{row.details.dates.paidStorageStarts?.value ?? 'Не надано'}</dd></div>
					</dl>
				{/if}
				{#if row.trackingState === 'access_denied' || row.trackingState === 'needs_carrier'}
					<a href={resolve('/(business)/business/integrations')}>Перевірити ключ перевізника</a>
				{/if}
				<details open>
					<summary>{row.carrier === 'nova_poshta' ? 'Зафіксовані зміни статусу' : 'Історія подій'} ({row.events.length})</summary>
					{#if row.carrier === 'nova_poshta'}<p>Джерело: перевірки Rahunok. Повний маршрутний журнал Нової пошти до початку відстеження недоступний у цьому підключенні.</p>{/if}
					{#each row.events as event (event.key)}
						<div class="event"><p>{event.label || statuses[event.deliveryStatus]}</p><p>{event.occurredAt ? `Подія: ${formatTime(event.occurredAt)} · ` : ''}Зафіксовано: {formatTime(event.observedAt)} (Київ)</p></div>
					{:else}<p class="event">Подій перевізника ще немає.</p>{/each}
				</details>
				{/if}
			</article>
		{:else}
			<div class="empty">
				<Package2 size={28} />
				<h2>{data.shipments.length ? 'Нічого не знайдено' : 'У вас ще немає відправлень'}</h2>
				{#if data.shipments.length}<button type="button" onclick={() => { searchQuery = ''; selectedCarrier = ''; mode = 'all'; }}>Скинути фільтри</button>{:else}<p>Додайте номер накладної.</p><button type="button" class="create-button" onclick={() => createDialog.showModal()}><Plus size={18} />Додати відправлення</button>{/if}
			</div>
		{/each}
	</section>
</main>

<dialog bind:this={createDialog} class="sheet" aria-labelledby="create-title">
	<header><h2 id="create-title">Додати наявну накладну</h2><button type="button" class="icon-button" aria-label="Закрити додавання" onclick={() => createDialog.close()}><X size={22} /></button></header>
	<form method="POST" action="?/create" use:enhance={createSubmit} class="create-form sheet-form" aria-busy={pending}>{@render createFields()}</form>
	<p role="status">{form?.message ?? (pending ? 'Зберігаємо відправлення…' : '')}</p>
</dialog>
<dialog bind:this={deleteDialog} class="sheet" aria-labelledby="delete-title">
	<header><h2 id="delete-title">Видалити відправлення?</h2><button type="button" class="icon-button" aria-label="Скасувати видалення" onclick={() => deleteDialog.close()}><X size={22} /></button></header>
	<p>Відправлення та його історію буде видалено з вашого списку. Це не скасовує доставку у перевізника.</p>
	<form method="POST" action="?/delete" use:enhance={deleteSubmit}><input type="hidden" name="id" value={deleteId} /><button type="submit" disabled={pending}><Trash2 size={18} />Видалити зі списку</button></form>
	<p role="status">{form?.message ?? ''}</p>
</dialog>

<style>
	.page-header { display: flex; align-items: center; gap: 12px; }
	.page-header > div { flex: 1; min-width: 0; }
	.icon-button { width: 44px; height: 44px; padding: 0; flex-shrink: 0; }
	.header-actions { display: flex; align-items: center; gap: 8px; }
	.new-shipment { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 16px; border-radius: 8px; background: var(--color-brand-600); color: white; font-size: 13px; font-weight: 650; }
	.new-shipment:hover { background: var(--color-brand-700); }
	.new-shipment { min-width: 0; text-align: center; }
	.new-shipment span { min-width: 0; overflow-wrap: anywhere; }
	.new-shipment :global(svg) { flex-shrink: 0; }
	@media (max-width: 640px) { .page-header { flex-wrap: wrap; } .header-actions { width: 100%; } .new-shipment { flex: 1; } }
	.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 8px; background: var(--color-brand-50); max-width: 480px; }
	.modes button { border: 0; background: transparent; }
	.modes button[aria-pressed='true'] { background: white; box-shadow: 0 1px 3px rgb(0 0 0 / 8%); font-weight: 650; }
	.shipment-link { width: 100%; border: 0; background: transparent; padding: 0; text-align: left; justify-content: flex-start; gap: 14px; }
	.shipment-link > span:nth-child(2) { display: grid; gap: 6px; flex: 1; min-width: 0; }
	.shipment-link strong { font-size: 15px; overflow-wrap: anywhere; }
	.shipment-link small { color: var(--color-text-secondary); line-height: 1.6; }
	.carrier-mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; background: var(--color-brand-50); flex-shrink: 0; }
	.sheet { width: min(480px, 100%); max-width: 100%; max-height: 90dvh; border: 0; border-radius: 8px; padding: 24px; margin: auto; color: var(--color-text-primary); background: white; }
	.sheet::backdrop { background: rgb(0 0 0 / 35%); }
	.sheet header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
	.sheet h2 { min-width: 0; overflow-wrap: anywhere; font-size: 19px; }
	.sheet p { margin: 16px 0; font-size: 14px; line-height: 1.6; }
	.create-form.sheet-form { grid-template-columns: minmax(0, 1fr); }
	.business-content { max-width: 1320px; width: 100%; min-width: 0; padding: 38px 40px; color: var(--color-text-primary, #27371b); letter-spacing: 0; }
	.business-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; color: var(--color-text-secondary); }
	h1 { font-size: 30px; font-weight: 650; margin: 13px 0 28px; }
	h2 { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
	p { margin: 4px 0; }
	label { display: grid; gap: 8px; min-width: 0; font-size: 12px; }
	input, select, button { box-sizing: border-box; border: 1px solid var(--color-border-default); border-radius: 8px; background: white; color: inherit; font: inherit; }
	input, select { width: 100%; min-width: 0; min-height: 46px; padding: 10px 12px; }
	button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 16px; font-size: 12px; cursor: pointer; }
	button:hover { background: var(--color-brand-50); }
	button.create-button:hover { background: var(--color-brand-700); }
	button:disabled { opacity: .5; cursor: wait; }
	input:focus-visible, select:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--color-brand-500); outline-offset: 2px; }
	.create-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; align-items: end; gap: 12px; }
	.create-button { background: var(--color-brand-600); color: white; border-color: var(--color-brand-600); min-height: 46px; font-weight: 700; }
	.message { min-height: 44px; padding-block: 10px; font-size: 13px; overflow-wrap: anywhere; }
	.filters { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; padding-block: 18px; border-top: 1px solid var(--color-border-default); }
	.search span { display: flex; align-items: center; gap: 8px; }
	.shipment { border-bottom: 1px solid var(--color-border-default); padding-block: 20px; font-size: 12px; overflow-wrap: anywhere; }
	.shipment-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.3fr) auto; gap: 18px; align-items: start; }
	.shipment-grid > div, dl { min-width: 0; }
	.shipment-grid p, dt { color: var(--color-text-secondary); }
	.shipment-grid .delivery-status { color: var(--color-text-primary, #27371b); font-weight: 650; }
	dl { margin: 0; display: grid; gap: 8px; }
	.shipment-facts { grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px; padding-block: 20px; }
	dd { margin: 2px 0 0; font-variant-numeric: tabular-nums; }
	.actions { display: flex; gap: 8px; }
	.actions button { width: 44px; height: 44px; padding: 0; }
	details { margin-top: 16px; }
	summary { cursor: pointer; color: var(--color-text-primary); padding-block: 4px; }
	.event { padding: 10px 0; border-top: 1px solid var(--color-border-subtle); }
	.event p:last-child { color: var(--color-text-secondary); }
	.empty { display: grid; justify-items: center; gap: 14px; padding: 50px 16px; text-align: center; }
	@media (max-width: 1100px) { .business-content { padding: 28px 24px; } .shipment-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
	@media (max-width: 1023px) { .desktop-create, .business-eyebrow { display: none; } .business-content { padding: 22px 16px; } h1 { font-size: 24px; margin: 0; } .page-header { margin-bottom: 16px; } .sheet { margin: auto auto 0; border-radius: 8px 8px 0 0; padding-bottom: calc(24px + env(safe-area-inset-bottom)); } }
	@media (max-width: 700px) { .create-form, .filters, .shipment-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
