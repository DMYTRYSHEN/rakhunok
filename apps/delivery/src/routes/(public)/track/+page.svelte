<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { AlertCircle, Check, LoaderCircle, LogIn, LogOut, Package2, Pause, Play, Plus, RefreshCw, Search, Trash2, X } from '@lucide/svelte';
	import TrackingHeader from '#lib/TrackingHeader.svelte';
	import { carrierLabels, statusLabels, stateLabels, formatTime, hasCheckFailure, type Shipment, type Carrier } from '#lib/tracking-labels.ts';

	let session = $state<string | null>(null);
	let booting = $state(true);
	let sessionBusy = $state(false);
	let listBusy = $state(false);
	let detailBusy = $state(false);
	let busy = $state('');
	let error = $state('');
	let detailError = $state('');
	let notice = $state('');
	let email = $state('');
	let password = $state('');
	let trackingNumber = $state('');
	let carrier = $state<Carrier>('nova_poshta');
	let shipments = $state<Shipment[]>([]);
	let listLoaded = $state(false);
	let selectedId = $state('');
	let search = $state('');
	let filter = $state('all');
	let deleteId = $state('');
	let headerRoot: HTMLDivElement;
	let generation = 0;
	let detailSequence = 0;
	const controllers = new Set<AbortController>();
	const selected = $derived(shipments.find(shipment => shipment.id === selectedId));
	const filtered = $derived(shipments.filter(shipment => {
		const matches = `${shipment.trackingNumber} ${carrierLabels[shipment.carrier]} ${statusLabels[shipment.deliveryStatus]}`.toLocaleLowerCase('uk').includes(search.trim().toLocaleLowerCase('uk'));
		return matches && (filter === 'all' || filter === 'paused' && shipment.trackingState === 'paused'
			|| filter === 'attention' && hasCheckFailure(shipment)
			|| filter === 'completed' && shipment.trackingState === 'completed'
			|| filter === 'active' && !['paused', 'completed'].includes(shipment.trackingState));
	}));
	const events = $derived(selected ? [...selected.events].sort((first, second) =>
		Date.parse(second.occurredAt ?? second.observedAt) - Date.parse(first.occurredAt ?? first.observedAt)) : []);
	const locked = $derived(Boolean(busy) || sessionBusy || listBusy);

	function clearSession() {
		generation += 1;
		detailSequence += 1;
		for (const controller of controllers) controller.abort();
		session = null;
		shipments = [];
		selectedId = '';
		deleteId = '';
		listLoaded = false;
		detailBusy = false;
		detailError = '';
		notice = '';
		search = '';
		filter = 'all';
	}

	async function request<Value>(path: string, method = 'GET', payload?: unknown): Promise<Value> {
		const epoch = generation;
		const controller = new AbortController();
		controllers.add(controller);
		const timeout = setTimeout(() => controller.abort(), 15000);
		try {
			const response = await fetch(`${resolve('').replace(/\/$/, '')}/api/v1/${path}`, {
				method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
				headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: payload === undefined ? undefined : JSON.stringify(payload)
			});
			if (epoch !== generation) throw new Error('Запит скасовано.');
			if (response.status === 401) {
				clearSession();
				throw new Error(path === 'session' && method === 'POST' ? 'Невірний email або пароль.' : 'Увійдіть, щоб відкрити свої відправлення.');
			}
			if (response.status === 204 && response.ok) return undefined as Value;
			const result = await response.json().catch(() => null);
			if (epoch !== generation) throw new Error('Запит скасовано.');
			if (!response.ok) {
				if (response.status === 503) throw new Error('Сервіс недоступний або ще не налаштований. Спробуйте пізніше.');
				throw new Error(typeof result?.error?.message === 'string' ? result.error.message : `Не вдалося виконати запит (${response.status}).`);
			}
			if (!result || !('data' in result)) throw new Error('Сервіс повернув некоректну відповідь.');
			return result.data as Value;
		} catch (failure) {
			if (failure instanceof DOMException && failure.name === 'AbortError') throw new Error('Запит перервано або час очікування минув. Спробуйте ще раз.');
			if (failure instanceof TypeError) throw new Error('Немає з’єднання із сервісом. Перевірте мережу та повторіть запит.');
			throw failure;
		} finally {
			clearTimeout(timeout);
			controllers.delete(controller);
		}
	}

	function message(failure: unknown) { return failure instanceof Error ? failure.message : 'Сталася помилка. Спробуйте ще раз.'; }

	function upsert(shipment: Shipment) {
		const previous = shipments.find(item => item.id === shipment.id);
		if (previous && previous.revision > shipment.revision) return;
		shipments = previous ? shipments.map(item => item.id === shipment.id ? shipment : item) : [shipment, ...shipments];
	}

	async function loadList() {
		if (listBusy) return;
		listBusy = true;
		error = '';
		try {
			const data = await request<Shipment[]>('shipments');
			if (!Array.isArray(data)) throw new Error('Некоректний список відправлень.');
			shipments = data;
			listLoaded = true;
			if (selectedId && !data.some(item => item.id === selectedId)) selectedId = '';
		} catch (failure) { error = message(failure); }
		finally { listBusy = false; }
	}

	async function loadSession() {
		booting = true;
		error = '';
		try {
			const data = await request<{ id: string }>('session');
			if (!data?.id) throw new Error('Некоректна відповідь сесії.');
			session = data.id;
			await loadList();
		} catch (failure) { error = message(failure); }
		finally { booting = false; }
	}

	async function login(event: SubmitEvent) {
		event.preventDefault();
		if (sessionBusy || booting) return;
		sessionBusy = true;
		error = '';
		try {
			const data = await request<{ id: string }>('session', 'POST', { email: email.trim(), password });
			if (!data?.id) throw new Error('Некоректна відповідь сесії.');
			session = data.id;
			await loadList();
		} catch (failure) { error = message(failure); }
		finally { password = ''; sessionBusy = false; }
	}

	async function logout() {
		if (locked) return;
		sessionBusy = true;
		error = '';
		try { await request('session', 'DELETE'); clearSession(); password = ''; }
		catch (failure) { error = message(failure); }
		finally { sessionBusy = false; }
	}

	async function addShipment(event: SubmitEvent) {
		event.preventDefault();
		if (locked) return;
		busy = 'add'; error = ''; notice = '';
		try {
			const shipment = await request<Shipment>('shipments', 'POST', { tracking_number: trackingNumber.trim(), carrier_hint: carrier });
			upsert(shipment); selectedId = shipment.id; detailError = ''; detailSequence += 1; detailBusy = false;
			trackingNumber = ''; notice = 'Відправлення додано.';
		} catch (failure) { error = message(failure); }
		finally { busy = ''; }
	}

	async function selectShipment(id: string) {
		selectedId = id; deleteId = ''; detailError = ''; detailBusy = true;
		const sequence = ++detailSequence;
		try {
			const shipment = await request<Shipment>(`shipments/${encodeURIComponent(id)}`);
			if (sequence === detailSequence && selectedId === id) upsert(shipment);
		} catch (failure) { if (sequence === detailSequence) detailError = message(failure); }
		finally { if (sequence === detailSequence) detailBusy = false; }
	}

	async function mutate(shipment: Shipment, action: 'refresh' | 'pause' | 'resume' | 'delete') {
		if (locked || detailBusy) return;
		busy = shipment.id; error = ''; notice = '';
		try {
			const path = `shipments/${encodeURIComponent(shipment.id)}`;
			if (action === 'delete') {
				await request(path, 'DELETE');
				shipments = shipments.filter(item => item.id !== shipment.id);
				if (selectedId === shipment.id) selectedId = '';
				deleteId = ''; notice = 'Відправлення видалено.';
			} else {
				upsert(await request<Shipment>(path, 'POST', { action }));
				notice = action === 'refresh' ? 'Запит оновлення виконано. Перевірте час підтвердженого статусу.' : action === 'pause' ? 'Відстеження призупинено.' : 'Відстеження відновлено.';
			}
		} catch (failure) { error = message(failure); }
		finally { busy = ''; }
	}

	function openDialog(dialog: HTMLDialogElement) {
		dialog.showModal();
	}

	onMount(() => {
		for (const link of headerRoot.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
			link.setAttribute('href', link.getAttribute('href') === '/business' ? resolve('business') : resolve(''));
		}
		void loadSession();
		return () => { generation += 1; for (const controller of controllers) controller.abort(); };
	});
</script>

<svelte:head><title>Мої відправлення | Rahunok Delivery</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

{#snippet tools(shipment: Shipment)}
	<div class="tools">
		<button class="icon-button" title="Оновити статус" aria-label={`Оновити ${shipment.trackingNumber}`} disabled={locked || detailBusy || shipment.trackingState === 'paused'} onclick={() => mutate(shipment, 'refresh')}><RefreshCw size={17} class={busy === shipment.id ? 'spinning' : ''} /></button>
		<button class="icon-button" title={shipment.trackingState === 'paused' ? 'Відновити відстеження' : 'Призупинити відстеження'} aria-label={`${shipment.trackingState === 'paused' ? 'Відновити' : 'Призупинити'} ${shipment.trackingNumber}`} disabled={locked || detailBusy || shipment.trackingState === 'completed'} onclick={() => mutate(shipment, shipment.trackingState === 'paused' ? 'resume' : 'pause')}>
			{#if shipment.trackingState === 'paused'}<Play size={17} />{:else}<Pause size={17} />{/if}
		</button>
		<button class="icon-button danger" title="Видалити відправлення" aria-label={`Видалити ${shipment.trackingNumber}`} disabled={locked || detailBusy} onclick={() => { deleteId = shipment.id; }}><Trash2 size={17} /></button>
	</div>
{/snippet}

<div class="tracking-page live-page">
	<div bind:this={headerRoot}><TrackingHeader detail /></div>
	<main class="tracking-main live-main">
		<div class="workspace-heading"><div><p class="section-overline"><span class="signal-dot"></span>ОСОБИСТИЙ ПРОСТІР</p><h1>Мої відправлення</h1></div>
			{#if session}<button class="quiet-button" disabled={locked} onclick={logout}><LogOut size={17} />{sessionBusy ? 'Виходимо…' : 'Вийти'}</button>{/if}
		</div>
		{#if error}<div class="notice error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>{/if}
		{#if notice}<div class="notice success" role="status"><Check size={18} /><span>{notice}</span></div>{/if}
		{#if booting}<div class="empty" role="status"><LoaderCircle size={24} class="spinning" /><p>Перевіряємо сесію…</p></div>
		{:else if !session}
			<section class="login-section" aria-labelledby="login-heading"><h2 id="login-heading">Вхід до особистого простору</h2>
				<form onsubmit={login} class="login-form">
					<label>Email<input type="email" autocomplete="username" required maxlength="254" bind:value={email} disabled={sessionBusy} /></label>
					<label>Пароль<input type="password" autocomplete="current-password" required maxlength="1024" bind:value={password} disabled={sessionBusy} /></label>
					<button class="primary-button" disabled={sessionBusy}><LogIn size={18} />{sessionBusy ? 'Входимо…' : 'Увійти'}</button>
				</form>
				<button class="quiet-button retry" disabled={sessionBusy} onclick={loadSession}><RefreshCw size={16} />Перевірити сесію</button>
			</section>
		{:else}
			<section class="add-section" aria-labelledby="add-heading"><h2 id="add-heading">Додати відправлення</h2>
				<form class="add-form" onsubmit={addShipment}>
					<label>Перевізник<select bind:value={carrier} disabled={locked}><option value="nova_poshta">Нова пошта</option><option value="ukrposhta">Укрпошта</option><option value="meest">Meest</option></select></label>
					<label class="number-field">Номер відправлення<input required maxlength="64" pattern={carrier === 'meest' ? '[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*' : '[A-Za-z0-9]{1,64}'} autocomplete="off" bind:value={trackingNumber} disabled={locked} /></label>
					<button class="primary-button" disabled={locked || !trackingNumber.trim()}><Plus size={18} />{busy === 'add' ? 'Додаємо…' : 'Додати'}</button>
				</form>
			</section>
			<section class="shipments-section" aria-labelledby="shipments-heading">
				<div class="list-heading"><h2 id="shipments-heading">Відправлення <span class="count">{listLoaded ? shipments.length : '—'}</span></h2><button class="icon-button" title="Оновити список" aria-label="Оновити список" disabled={locked || detailBusy} onclick={loadList}><RefreshCw size={18} class={listBusy ? 'spinning' : ''} /></button></div>
				<div class="filters"><label class="search-label"><span>Пошук</span><div class="search-input"><Search size={17} /><input type="search" placeholder="Номер або перевізник" bind:value={search} /></div></label>
					<label>Стан<select bind:value={filter}><option value="all">Усі</option><option value="active">Відстежуються</option><option value="attention">Потребують уваги</option><option value="paused">Призупинені</option><option value="completed">Завершені</option></select></label>
				</div>
				{#if listBusy}<p class="loading-line" role="status"><LoaderCircle class="spinning" size={17} />Завантажуємо список…</p>{/if}
				{#if !listLoaded && !listBusy}<div class="empty"><AlertCircle size={28} /><h3>Список не завантажено</h3><button class="quiet-button" onclick={loadList} disabled={locked}><RefreshCw size={17} />Повторити</button></div>
				{:else if listLoaded && !shipments.length}<div class="empty"><Package2 size={32} /><h3>Відправлень ще немає</h3><p>Підтверджених даних про доставку поки немає.</p></div>
				{:else}
					<div class="workspace-grid"><div class="shipment-list">
						{#each filtered as shipment (shipment.id)}
							<article class:selected={selectedId === shipment.id} class="shipment-row">
								<button class="shipment-select" aria-pressed={selectedId === shipment.id} onclick={() => selectShipment(shipment.id)} disabled={locked}>
									<span class="carrier-name"><span class:red={shipment.carrier === 'nova_poshta'} class:yellow={shipment.carrier === 'ukrposhta'} class="carrier-dot"></span>{carrierLabels[shipment.carrier]}</span>
									<strong class="tracking-number">{shipment.trackingNumber}</strong>
									<span class="delivery-status">{shipment.lastSuccessAt ? statusLabels[shipment.deliveryStatus] : 'Ще немає підтвердженого статусу'}</span>
									<span class:warning={hasCheckFailure(shipment)} class="state">{stateLabels[shipment.trackingState]}</span>
									<span class="timestamp">Підтверджено: {formatTime(shipment.lastSuccessAt)}</span>
								</button>
								{@render tools(shipment)}
							</article>
						{:else}<div class="empty"><Search size={24} /><h3>Нічого не знайдено</h3><button class="quiet-button" onclick={() => { search = ''; filter = 'all'; }}>Скинути фільтри</button></div>{/each}
					</div>
					<aside class="detail" aria-label="Деталі відправлення" aria-busy={detailBusy}>
						{#if selected}
							<div class="detail-heading"><h2>Деталі відправлення</h2><button class="icon-button" title="Закрити деталі" aria-label="Закрити деталі" onclick={() => { selectedId = ''; detailSequence += 1; detailBusy = false; detailError = ''; }}><X size={18} /></button></div>
							<p class="carrier-name">{carrierLabels[selected.carrier]}</p><h3 class="detail-number">{selected.trackingNumber}</h3>
							{#if detailBusy}<p class="loading-line" role="status"><LoaderCircle size={16} class="spinning" />Завантажуємо деталі…</p>{/if}
							{#if detailError}<div class="notice error" role="alert"><span>{detailError}</span></div><button class="quiet-button" disabled={locked || detailBusy} onclick={() => selectShipment(selectedId)}><RefreshCw size={16} />Повторити</button>{/if}
							<p class="snapshot">{selected.lastSuccessAt ? statusLabels[selected.deliveryStatus] : 'Ще немає підтвердженого статусу'}</p>
							{#if hasCheckFailure(selected)}<div class="notice warning"><AlertCircle size={18} /><span>{stateLabels[selected.trackingState]}. {selected.lastSuccessAt ? 'Показано останній підтверджений стан, не результат нової перевірки.' : 'Статус доставки не підтверджено.'}</span></div>{:else}<p class="state">{stateLabels[selected.trackingState]}</p>{/if}
							<dl><div><dt>Підтверджений стан</dt><dd>{formatTime(selected.lastSuccessAt)}</dd></div><div><dt>Остання спроба перевірки</dt><dd>{formatTime(selected.lastCheckedAt)}</dd></div><div><dt>Наступна перевірка</dt><dd>{formatTime(selected.nextCheckAt)}</dd></div>
								{#if selected.lastSuccessAt && selected.providerStatusLabel}<div><dt>Статус перевізника</dt><dd>{selected.providerStatusLabel}</dd></div>{/if}
								{#if selected.lastSuccessAt && selected.providerStatusCode}<div><dt>Код перевізника</dt><dd>{selected.providerStatusCode}</dd></div>{/if}
							</dl>
							<p class="timezone">Час: Europe/Kyiv</p>{@render tools(selected)}
							<h3 class="timeline-heading">Історія подій</h3>
							<ol class="timeline">{#each events as event (event.key)}<li><strong>{statusLabels[event.deliveryStatus]}</strong>{#if event.label}<p>{event.label}</p>{/if}<time datetime={event.occurredAt ?? event.observedAt}>{formatTime(event.occurredAt ?? event.observedAt)}</time>{#if !event.occurredAt}<span class="timestamp">Час спостереження; час події невідомий</span>{/if}</li>{:else}<li class="no-events">Підтверджених подій ще немає.</li>{/each}</ol>
						{:else}<div class="empty detail-empty"><Package2 size={28} /><h3>Відправлення не вибрано</h3></div>{/if}
					</aside></div>
				{/if}
			</section>
		{/if}
	</main>
</div>

{#if deleteId && session}
	{@const target = shipments.find(shipment => shipment.id === deleteId)}
	<dialog use:openDialog class="delete-dialog" aria-labelledby="delete-heading" oncancel={(event) => { if (locked) event.preventDefault(); else deleteId = ''; }}>
		<h2 id="delete-heading">Видалити відправлення?</h2><p class="tracking-number">{target?.trackingNumber}</p>
		{#if error}<div class="notice error" role="alert">{error}</div>{/if}
		<div class="dialog-actions"><button class="quiet-button" disabled={locked} onclick={() => { deleteId = ''; }}>Скасувати</button><button class="primary-button destructive" disabled={locked || detailBusy || !target} onclick={() => target && mutate(target, 'delete')}><Trash2 size={17} />{busy ? 'Видаляємо…' : 'Видалити'}</button></div>
	</dialog>
{/if}

<style>
	.live-main { padding-bottom: 48px; }
	.workspace-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 32px 0 24px; }
	h1 { font-size: 28px; font-weight: 700; margin-top: 10px; line-height: 1.25; }
	h2, h3 { font-weight: 650; } h2 { font-size: 16px; } h3 { font-size: 14px; }
	button { cursor: pointer; } button:disabled { cursor: default; opacity: .55; }
	label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; font-weight: 650; min-width: 0; }
	input, select { width: 100%; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid #c5cbbd; border-radius: 5px; background: white; color: #20251f; font: inherit; font-size: 14px; }
	.primary-button, .quiet-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 10px 16px; border-radius: 5px; font-size: 13px; font-weight: 650; }
	.primary-button { background: #ddf988; color: #28331a; } .primary-button:hover:not(:disabled) { background: #cbea6e; }
	.quiet-button { border: 1px solid #d4d8cc; background: white; } .quiet-button:hover:not(:disabled) { background: #f0f2ea; }
	.notice { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 16px; padding: 12px 14px; border-left: 3px solid; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
	.notice :global(svg) { flex-shrink: 0; margin-top: 2px; }
	.error { background: #fae9e5; color: #943429; } .success { background: #edf4de; color: #456325; } .warning { color: #805c13; } .notice.warning { background: #fbf0be; }
	.login-section, .add-section { border-block: 1px solid #d4d8cc; padding: 24px 0; }
	.login-form { display: grid; gap: 18px; max-width: 380px; margin-top: 24px; } .retry { margin-top: 18px; }
	.add-form { display: flex; align-items: flex-end; gap: 12px; margin-top: 18px; } .add-form label:first-child { width: 200px; } .number-field { flex: 1; }
	.shipments-section { padding-top: 20px; } .list-heading, .detail-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; } .count { color: #62685d; font-size: 12px; margin-left: 8px; }
	.filters { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 12px; margin: 12px 0 24px; }
	.search-input { display: flex; align-items: center; border: 1px solid #c5cbbd; border-radius: 5px; background: white; padding-left: 12px; } .search-input input { border: 0; background: none; } .search-input :global(svg) { flex-shrink: 0; }
	.workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 28px; align-items: start; }
	.shipment-list { min-width: 0; } .shipment-row { border-bottom: 1px solid #d4d8cc; display: flex; align-items: center; gap: 8px; padding: 8px 4px; } .shipment-row.selected { background: #edf2e3; box-shadow: inset 3px 0 #567229; }
	.shipment-select { display: flex; flex: 1; min-width: 0; flex-direction: column; align-items: flex-start; text-align: left; gap: 8px; padding: 12px; border-radius: 4px; } .shipment-select:hover { background: #e9eddf; }
	.carrier-name { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #62685d; } .tracking-number { font-size: 15px; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
	.delivery-status { font-size: 13px; font-weight: 650; } .state, .timestamp, .timezone { font-size: 11px; line-height: 1.6; } .timestamp, .timezone { color: #62685d; } .state { overflow-wrap: anywhere; }
	.tools { display: flex; flex-shrink: 0; } .danger { color: #ad382d; }
	.detail { min-width: 0; padding-left: 24px; border-left: 1px solid #d4d8cc; } .detail-number { font-size: 20px; overflow-wrap: anywhere; margin: 10px 0 20px; } .snapshot { font-size: 16px; font-weight: 650; margin-bottom: 12px; }
	dl { margin: 20px 0 8px; font-size: 12px; } dl > div { padding: 10px 0; border-bottom: 1px solid #e0e4d8; } dt { color: #62685d; margin-bottom: 4px; } dd { margin: 0; overflow-wrap: anywhere; } .timezone { margin-bottom: 12px; }
	.timeline-heading { margin-top: 28px; } .timeline { padding: 0; list-style: none; margin-top: 18px; } .timeline li { position: relative; margin-left: 5px; padding: 0 0 24px 20px; border-left: 1px solid #c5cbbd; font-size: 12px; overflow-wrap: anywhere; } .timeline li::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #567229; position: absolute; left: -4px; top: 5px; } .timeline p { color: #62685d; margin: 5px 0; } .timeline time, .timeline .timestamp { display: block; color: #62685d; margin-top: 5px; } .timeline .no-events { border: 0; padding-left: 0; color: #62685d; } .timeline .no-events::before { display: none; }
	.empty { min-height: 220px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; text-align: center; padding: 24px 12px; color: #62685d; font-size: 13px; } .loading-line { display: flex; gap: 8px; align-items: center; font-size: 12px; margin: 12px 0; color: #62685d; }
	.delete-dialog { margin: auto; width: min(calc(100% - 32px), 420px); background: white; border: 0; border-radius: 8px; padding: 24px; } .delete-dialog::backdrop { background: #20251f66; } .delete-dialog p { margin: 16px 0 24px; } .dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; } .destructive { background: #ad382d; color: white; } .destructive:hover:not(:disabled) { background: #943429; }
	@media (prefers-reduced-motion: no-preference) { :global(.live-page .spinning) { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } }
	@media (max-width: 1000px) { .workspace-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 320px); gap: 16px; } .shipment-row { flex-wrap: wrap; } .shipment-row > .tools { margin-left: 8px; } .detail { padding-left: 16px; } }
	@media (max-width: 760px) { .workspace-grid { grid-template-columns: minmax(0, 1fr); } .detail { border-left: 0; border-top: 1px solid #d4d8cc; padding: 20px 0 0; } .detail-empty { min-height: 100px; } .add-form { flex-wrap: wrap; } .add-form label:first-child { width: 100%; } .number-field { flex-basis: 100%; } .add-form > button { width: 100%; } .filters { grid-template-columns: minmax(0, 1fr); } .workspace-heading { align-items: flex-start; } h1 { font-size: 24px; } .workspace-heading .quiet-button { padding: 10px; } .shipment-row { flex-wrap: nowrap; } .shipment-row .tools { flex-direction: column; } }
	@media (max-width: 360px) { .live-main { padding-inline: 16px; } .workspace-heading { flex-wrap: wrap; } }
</style>