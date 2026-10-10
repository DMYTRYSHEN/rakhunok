<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ShippingPointsMap from '#lib/ShippingPointsMap.svelte';
	import { cachedDirectory } from '#lib/directory-cache.ts';
	import { locationCityNames, matchingLocationCity, pointDistance, recommendPoints } from '#lib/location-city.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ArrowRight, Search, Plus, Trash2, Calculator, LoaderCircle, TriangleAlert, Check, LocateFixed, Bookmark, MapPin, Package, Printer } from '@lucide/svelte';
	import type { City, Warehouse } from '#lib/server/tracking/np-api.ts';
	import type { PageProps } from './$types';
	let { form, data }: PageProps = $props();
	let senderRef = $state('');
	let contactRef = $state('');
	let contacts = $state<{ ref: string; name: string; phone: string }[]>([]);
	let accountBusy = $state(false);
	let accountMessage = $state('');
	let accountSequence = 0;
	let confirmed = $state(false);
	let attempted = $state(false);
	let attemptId = $state('');
	let customerQuery = $state('');
	const matchingCustomers = $derived((data.customers ?? []).filter(customer => `${customer.name} ${customer.phone}`.toLocaleLowerCase('uk').includes(customerQuery.trim().toLocaleLowerCase('uk'))));
	function selectCustomer(event: Event) {
		const customer = data.customers?.find(item => item.id === (event.currentTarget as HTMLSelectElement).value);
		if (customer) { recipientName = customer.name; recipientPhone = customer.phone; confirmed = false; edited = true; }
	}
	async function loadContacts() {
		const sequence = ++accountSequence;
		contactRef = ''; contacts = []; accountMessage = '';
		if (!senderRef) { accountBusy = false; return; }
		accountBusy = true;
		try {
			const response = await fetch(`${resolve('/api/v1/nova-poshta/account')}?${new URLSearchParams({ sender: senderRef })}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
			if (!response.ok) throw new Error('Account unavailable');
			const account = await response.json();
			if (disposed || sequence !== accountSequence) return;
			if (!Array.isArray(account.contacts)) throw new Error('Invalid contacts');
			contacts = account.contacts;
			if (contacts.length === 1) contactRef = contacts[0].ref;
			if (!contacts.length) accountMessage = 'У відправника немає контактів з доступним телефоном.';
		} catch { if (!disposed && sequence === accountSequence) accountMessage = 'Не вдалося завантажити контакти. Повторіть запит.'; }
		finally { if (!disposed && sequence === accountSequence) accountBusy = false; }
	}
	let favorite = $state<{ city: City; point: Warehouse } | null>(null);
	let location = $state<{ latitude: number; longitude: number } | null>(null);
	let locating = $state(false);
	let locationMessage = $state('');
	let mapVisible = $state(false);
	let nearby = $state<Warehouse[]>([]);
	let nearbyCity = $state('');
	let nearbyBusy = $state(false);
	let nearbyMessage = $state('');
	let nearbySequence = 0;
	let locationSequence = 0;
	let disposed = false;
	const favoriteKey = () => `delivery:sender:${data.userId}`;
	onMount(() => {
		attemptId = data.attemptId;
		senderRef = data.defaultSenderRef ?? '';
		contactRef = data.defaultContactRef ?? '';
		contacts = data.contacts ?? [];
		accountMessage = data.defaultsWarning ?? '';
		try {
			const saved = JSON.parse(localStorage.getItem(favoriteKey()) ?? 'null');
			if (saved && typeof saved.city?.ref === 'string' && typeof saved.city?.name === 'string' && typeof saved.point?.ref === 'string' && typeof saved.point?.number === 'string' && saved.point.cityRef === saved.city.ref) favorite = saved;
		} catch { favorite = null; }
	});
	function saveFavorite() {
		const city = routes.sender.cities.find(item => item.ref === routes.sender.cityRef);
		const point = routes.sender.points.find(item => item.ref === routes.sender.pointRef);
		if (!city || !point) return;
		try { localStorage.setItem(favoriteKey(), JSON.stringify({ city, point })); favorite = { city, point }; locationMessage = 'Місце відправлення збережено в цьому браузері.'; }
		catch { locationMessage = 'Браузер не дозволяє зберегти пункт.'; }
	}
	async function useFavorite() {
		if (!favorite) return;
		resetCity('sender');
		routes.sender.query = favorite.city.name;
		routes.sender.cities = [favorite.city];
		routes.sender.cityRef = favorite.city.ref;
		routes.sender.pointQuery = favorite.point.number;
		await directory('sender', 'warehouses');
		const point = routes.sender.points.find(item => item.ref === favorite?.point.ref);
		if (point && available(point)) routes.sender.pointRef = point.ref;
		else locationMessage = 'Збережений пункт недоступний. Оберіть інший.';
	}
	function available(point: Warehouse) { return point.status === 'Working' && ['Branch', 'Warehouse', 'Postomat'].includes(point.category); }
	function distance(point: Warehouse) {
		return location ? pointDistance(point, location) : Infinity;
	}
	function locate() {
		if (!navigator.geolocation) { locationMessage = 'Геолокація недоступна. Оберіть місто вручну.'; return; }
		const sequence = ++locationSequence;
		const routeSequence = routes.sender.sequence;
		locating = true;
		navigator.geolocation.getCurrentPosition(position => {
			if (disposed || sequence !== locationSequence) return;
			if (routeSequence !== routes.sender.sequence) { locating = false; return; }
			location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
			void resolveLocationCity(sequence, routeSequence, position.coords.accuracy);
		}, () => { if (disposed || sequence !== locationSequence) return; locating = false; locationMessage = 'Не вдалося визначити місце. Оберіть місто вручну.'; }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
	}
	async function resolveLocationCity(sequence: number, routeSequence: number, accuracy: number) {
		if (!location) return;
		const current = () => !disposed && sequence === locationSequence && routeSequence === routes.sender.sequence;
		locationMessage = 'Визначення населеного пункту…';
		try {
			const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), localityLanguage: 'uk' });
			const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
			if (!response.ok) throw new Error('Geocoder unavailable');
			const payload = await response.json();
			if (!current()) return;
			const names = locationCityNames(payload);
			if (!names.length) throw new Error('No GPS locality');
			for (const name of names) {
				const cities: City[] = [];
				let hasMore = true;
				for (let page = 1; page <= 5 && hasMore; page += 1) {
					const query = new URLSearchParams({ kind: 'cities', q: name, page: String(page) });
					const directoryResult = await cachedDirectory(`${resolve('/api/v1/nova-poshta/directory')}?${query}`, data.userId);
					if (!current()) return;
					if (!Array.isArray(directoryResult.data)) throw new Error('Invalid cities');
					cities.push(...directoryResult.data as City[]); hasMore = directoryResult.hasMore === true;
				}
				if (hasMore) continue;
				const city = matchingLocationCity(cities, name, typeof payload.principalSubdivision === 'string' ? payload.principalSubdivision : '');
				if (!city) continue;
				clearTimeout(searchTimers.sender);
				resetCity('sender');
				routes.sender.query = city.name;
				routes.sender.cities = [city];
				routes.sender.cityRef = city.ref;
				edited = true;
				locationMessage = `${city.name} · точність приблизно ${Math.round(accuracy)} м.`;
				await loadNearby(true);
				return;
			}
			locationMessage = `Знайдено: ${names[0]}. Оберіть відповідне місто з довідника.`;
			resetCity('sender'); routes.sender.query = names[0]; edited = true;
			await directory('sender', 'cities');
		} catch {
			if (current()) locationMessage = 'Координати отримано, але місто не визначено. Оберіть місто вручну для пошуку найближчих пунктів.';
		} finally {
			if (!disposed && sequence === locationSequence) locating = false;
		}
	}
	async function loadNearby(autoSelect = false) {
		const cityRef = routes.sender.cityRef;
		if (!cityRef || !location) return;
		const sequence = ++nearbySequence;
		const routeSequence = routes.sender.sequence;
		const selectedBefore = routes.sender.pointRef;
		nearbyBusy = true; nearby = []; nearbyCity = cityRef; nearbyMessage = '';
		try {
			const weight = Math.max(...seats.map(seat => Number(seat.weight)));
			const params = new URLSearchParams({ kind: 'nearby', cityRef, latitude: String(location.latitude), longitude: String(location.longitude), weight: String(weight) });
			const payload = await cachedDirectory(`${resolve('/api/v1/nova-poshta/directory')}?${params}`, data.userId, 60000);
			if (disposed || sequence !== nearbySequence || routes.sender.cityRef !== cityRef || routeSequence !== routes.sender.sequence) return;
			if (!Array.isArray(payload.data)) throw new Error('Invalid directory');
			nearby = recommendPoints(payload.data as Warehouse[], location, weight);
			nearbyMessage = !nearby.length ? 'Немає доступних пунктів у межах 1 км для цієї ваги. Скористайтеся пошуком.' : payload.hasMore ? 'Пункти в межах 1 км. Довідник завантажено частково.' : 'У межах 1 км по прямій, не пішохідний маршрут.';
			if (autoSelect && nearby[0] && routes.sender.pointRef === selectedBefore) {
				choosePoint('sender', nearby[0].ref, nearby);
				locationMessage += ` Обрано: ${nearby[0].name}.`;
			}
		} catch { if (sequence === nearbySequence) nearbyMessage = 'Не вдалося завантажити найближчі пункти. Скористайтеся пошуком.'; }
		finally { if (sequence === nearbySequence) nearbyBusy = false; }
	}
	function choosePoint(side: Side, ref: string, points: Warehouse[]) {
		const point = points.find(item => item.ref === ref);
		if (!point || !available(point)) return;
		if (!routes[side].points.some(item => item.ref === ref)) routes[side].points = [...routes[side].points, point];
		routes[side].pointRef = ref; edited = true;
	}
	function preset(weight: number, length: number, width: number, height: number) {
		seats = [{ id: nextSeat++, weight, length, width, height }]; edited = true;
	}
	type Side = 'sender' | 'recipient';
	type RouteSelection = {
		query: string; cities: City[]; cityRef: string; pointQuery: string; points: Warehouse[];
		pointRef: string; page: number; hasMore: boolean; cityPage: number; cityHasMore: boolean; busy: boolean; message: string; sequence: number;
	};
	const emptySelection = (): RouteSelection => ({ query: '', cities: [], cityRef: '', pointQuery: '', points: [], pointRef: '', page: 1, hasMore: false, cityPage: 1, cityHasMore: false, busy: false, message: '', sequence: 0 });
	let routes = $state<Record<Side, RouteSelection>>({ sender: emptySelection(), recipient: emptySelection() });
	let seats = $state([{ id: 1, weight: 1, length: 20, width: 20, height: 10 }]);
	let nextSeat = 2;
	let pending = $state(false);
	let recipientName = $state('');
	let recipientPhone = $state('');
	let description = $state('');
	let declaredCost = $state(500);
	let payer = $state('Recipient');
	let paymentMethod = $state('Cash');
	let labelVisible = $state(false);
	function printLabels() { window.print(); }
	let step = $state(0);
	let shipmentForm: HTMLFormElement;
	const steps = ['Звідки', 'Кому', 'Вантаж', 'Перевірка'];
	function advance() {
		const controls = shipmentForm.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-step]:not([hidden]) input, [data-step]:not([hidden]) select');
		for (const control of controls) { if (!control.reportValidity()) return; }
		step = Math.min(3, step + 1);
	}
	let edited = $state(false);
	const result = $derived(edited ? null : form?.result);
	const sides: { id: Side; label: string }[] = [{ id: 'sender', label: 'Відправлення' }, { id: 'recipient', label: 'Отримання' }];
	const branchRoute = $derived(sides.every(side => ['Branch', 'Warehouse'].includes(routes[side.id].points.find(point => point.ref === routes[side.id].pointRef)?.category ?? '')));
	const dimensionFields = [{ key: 'weight', label: 'Вага, кг', max: 1000 }, { key: 'length', label: 'Довжина, см', max: 300 },
		{ key: 'width', label: 'Ширина, см', max: 300 }, { key: 'height', label: 'Висота, см', max: 300 }] as const;
	const searchTimers: Partial<Record<Side, ReturnType<typeof setTimeout>>> = {};
	onDestroy(() => { disposed = true; locationSequence += 1; nearbySequence += 1; routes.sender.sequence += 1; routes.recipient.sequence += 1; for (const timer of Object.values(searchTimers)) clearTimeout(timer); });
	function queueSearch(side: Side, kind: 'cities' | 'warehouses', value: string) {
		clearTimeout(searchTimers[side]);
		if (kind === 'cities') { resetCity(side); routes[side].query = value; }
		else { routes[side].pointQuery = value; routes[side].pointRef = ''; routes[side].sequence += 1; }
		edited = true;
		searchTimers[side] = setTimeout(() => { void directory(side, kind); }, 400);
	}
	function searchOnEnter(event: KeyboardEvent, side: Side, kind: 'cities' | 'warehouses') {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (event.repeat) return;
		clearTimeout(searchTimers[side]);
		void directory(side, kind);
	}

	function resetCity(side: Side) {
		if (side === 'sender') { nearbySequence += 1; nearbyBusy = false; nearby = []; nearbyCity = ''; }
		const route = routes[side];
		route.sequence += 1;
		route.busy = false;
		route.cityRef = '';
		route.cities = [];
		route.cityPage = 1;
		route.cityHasMore = false;
		route.points = [];
		route.pointRef = '';
		route.pointQuery = '';
		route.message = '';
	}

	async function directory(side: Side, kind: 'cities' | 'warehouses', page = 1) {
		clearTimeout(searchTimers[side]);
		const route = routes[side];
		if (kind === 'cities' && route.query.trim().length < 2 || kind === 'warehouses' && !route.cityRef) return;
		const sequence = ++route.sequence;
		route.busy = true;
		route.message = '';
		if (kind === 'warehouses') { route.pointRef = ''; route.points = []; edited = true; }
		const params = new URLSearchParams({ kind, q: kind === 'cities' ? route.query.trim() : route.pointQuery.trim(), page: String(page) });
		if (kind === 'warehouses') params.set('cityRef', route.cityRef);
		try {
			const payload = await cachedDirectory(`${resolve('/api/v1/nova-poshta/directory')}?${params}`, data.userId);
			if (sequence !== route.sequence) return;
			const rows: unknown = payload.data;
			if (!Array.isArray(rows)) throw new Error('Invalid directory');
			if (kind === 'cities') {
				route.cities = rows as City[];
				route.cityPage = page;
				route.cityHasMore = payload.hasMore === true;
			} else {
				route.points = rows as Warehouse[];
				route.page = page;
				route.hasMore = payload.hasMore === true;
			}
			if (!rows.length) route.message = 'Нічого не знайдено.';
		} catch {
			if (sequence === route.sequence) route.message = 'Довідник тимчасово недоступний. Повторіть пошук.';
		} finally {
			if (sequence === route.sequence) route.busy = false;
		}
	}

	function selectCity(side: Side) {
		if (side === 'sender') { nearbySequence += 1; nearbyBusy = false; nearby = []; nearbyCity = ''; }
		clearTimeout(searchTimers[side]);
		const route = routes[side];
		route.sequence += 1;
		route.pointRef = '';
		route.points = [];
		route.pointQuery = '';
		route.page = 1;
		route.busy = false;
		if (route.cityRef) { void directory(side, 'warehouses'); if (side === 'sender' && location) void loadNearby(); }
	}
</script>

<svelte:head><title>Підготовка відправлення — Rahunok Delivery</title></svelte:head>

<main class="shipping-page">
	<header>
		<a class="back" href={resolve('/(business)/business')}><ArrowLeft size={17} /> Відправлення</a>
		<h1>Нове відправлення</h1>
		<p class="carrier">Нова пошта · Оформлення: відділення → відділення. Поштомати: лише розрахунок.</p>
	</header>
	{#if data.accountError}<p class="notice" role="status">{data.accountError} <a href={resolve('/(business)/business/integrations')}>Інтеграції</a></p>{/if}
	{#if data.documentsError}<p class="notice" role="alert">{data.documentsError}</p>{/if}
	<nav class="steps" aria-label="Кроки відправлення">{#each steps as label, index (label)}<button type="button" aria-current={step === index ? 'step' : undefined} disabled={index > step} onclick={() => { step = index; }}><span>{index + 1}</span>{label}</button>{/each}</nav>
	<form bind:this={shipmentForm} novalidate method="POST" action="?/prepare" onsubmit={(event) => { if (pending) { event.preventDefault(); return; } if (step < 3) { event.preventDefault(); advance(); } else { for (const control of shipmentForm.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')) { if (!control.checkValidity()) { event.preventDefault(); step = Number(control.closest('[data-step]')?.getAttribute('data-step') ?? 2); requestAnimationFrame(() => control.reportValidity()); break; } } } }} oninput={() => { edited = true; }} onchange={() => { edited = true; }} use:enhance={({ action, cancel }) => {
		if (action.search === '?/issue') {
			if (!confirmed || attempted || form?.issued) { cancel(); return; }
			attempted = true;
		}
		pending = true;
		return async ({ update, result: actionResult }) => { try { await update({ reset: false }); edited = false; if (actionResult.type === 'failure' && actionResult.status === 400) attempted = false; if (form?.field) step = form.field.startsWith('sender') || form.field === 'contactRef' ? 0 : form.field.startsWith('recipient') ? 1 : form.field === 'confirm' ? 3 : 2; } finally { pending = false; } };
	}}>
		<input type="hidden" name="attemptId" value={attemptId || data.attemptId} />
		<fieldset data-step="0" hidden={step !== 0}>
			<legend>Відправник у Новій пошті</legend>
			<a href={resolve('/(business)/business/settings/sender')}>Налаштування відправника</a>
			<label>Обліковий запис<select name="senderRef" bind:value={senderRef} onchange={loadContacts}><option value="">Оберіть відправника</option>{#each data.senders as sender (sender.ref)}<option value={sender.ref}>{sender.name}</option>{/each}</select></label>
			<label>Контакт відправника<select name="contactRef" bind:value={contactRef} disabled={accountBusy || !senderRef}><option value="">{accountBusy ? 'Завантаження…' : 'Оберіть контакт'}</option>{#each contacts as contact (contact.ref)}<option value={contact.ref}>{contact.name} · {contact.phone}</option>{/each}</select></label>
			{#if accountMessage}<p role="status">{accountMessage}</p><button type="button" disabled={accountBusy} onclick={loadContacts}>Повторити запит</button>{/if}
		</fieldset>
		<div class="route-grid">
			{#each sides as side (side.id)}
				{@const selected = routes[side.id].points.find(point => point.ref === routes[side.id].pointRef)}
				<fieldset data-step={side.id === 'sender' ? 0 : 1} hidden={step !== (side.id === 'sender' ? 0 : 1)}>
					<legend>{side.label}</legend>
					{#if side.id === 'sender'}<div class="quick-actions">{#if favorite}<button type="button" onclick={useFavorite} disabled={routes.sender.busy}><Bookmark size={18} />{favorite.city.name} · №{favorite.point.number}</button><button type="button" title="Забути звичний пункт" aria-label="Забути звичний пункт" onclick={() => { try { localStorage.removeItem(favoriteKey()); favorite = null; } catch { locationMessage = 'Не вдалося видалити збережений пункт.'; } }}><Trash2 size={17} /></button>{/if}<button type="button" onclick={locate} disabled={locating}><LocateFixed size={18} />{locating ? 'Визначення…' : 'Моє місце'}</button></div><p role="status" class="directory-status">{locationMessage}</p>{/if}
					{#if side.id === 'sender'}<p class="directory-status">«Моє місце» передає GPS-координати сервісу BigDataCloud для визначення міста.</p>{/if}
					<label for={`${side.id}-city-query`}>Населений пункт</label>
					<div class="search-row">
						<input id={`${side.id}-city-query`} type="search" maxlength="100" bind:value={routes[side.id].query} oninput={(event) => queueSearch(side.id, 'cities', event.currentTarget.value)} onkeydown={(event) => searchOnEnter(event, side.id, 'cities')} placeholder="Назва міста" />
						<button type="button" title="Знайти місто" aria-label="Знайти місто" disabled={routes[side.id].busy || routes[side.id].query.trim().length < 2} onclick={() => directory(side.id, 'cities')}><Search size={18} /></button>
					</div>
					<label for={`${side.id}-city`}>Місто з довідника</label>
					<select id={`${side.id}-city`} name={`${side.id}CityRef`} required bind:value={routes[side.id].cityRef} onchange={() => selectCity(side.id)} aria-invalid={form?.field === `${side.id}CityRef`}>
						<option value="">Оберіть місто</option>
						{#each routes[side.id].cities as city (city.ref)}<option value={city.ref}>{city.name}{city.area ? ` · ${city.area}` : ''}</option>{/each}
					</select>
					{#if routes[side.id].cities.length}
						<div class="pagination"><button type="button" aria-label="Попередня сторінка міст" title="Попередня сторінка міст" disabled={routes[side.id].busy || routes[side.id].cityPage === 1} onclick={() => { routes[side.id].cityRef = ''; selectCity(side.id); void directory(side.id, 'cities', routes[side.id].cityPage - 1); }}><ArrowLeft size={16} /></button><span>Міста: {routes[side.id].cityPage}</span><button type="button" aria-label="Наступна сторінка міст" title="Наступна сторінка міст" disabled={routes[side.id].busy || !routes[side.id].cityHasMore} onclick={() => { routes[side.id].cityRef = ''; selectCity(side.id); void directory(side.id, 'cities', routes[side.id].cityPage + 1); }}><ArrowRight size={16} /></button></div>
					{/if}
					<label for={`${side.id}-point-query`}>Пошук відділення / поштомата</label>
					<div class="search-row">
						<input id={`${side.id}-point-query`} type="search" maxlength="100" bind:value={routes[side.id].pointQuery} oninput={(event) => queueSearch(side.id, 'warehouses', event.currentTarget.value)} onkeydown={(event) => searchOnEnter(event, side.id, 'warehouses')} disabled={!routes[side.id].cityRef} placeholder="Номер або адреса" />
						<button type="button" title="Знайти пункт" aria-label="Знайти пункт" disabled={routes[side.id].busy || !routes[side.id].cityRef} onclick={() => directory(side.id, 'warehouses')}><Search size={18} /></button>
					</div>
					<label for={`${side.id}-point`}>Пункт з довідника</label>
					<select id={`${side.id}-point`} name={`${side.id}WarehouseRef`} required bind:value={routes[side.id].pointRef} disabled={!routes[side.id].cityRef} aria-invalid={form?.field === `${side.id}WarehouseRef`}>
						<option value="">Оберіть пункт</option>
						{#each routes[side.id].points as point (point.ref)}
							<option value={point.ref} disabled={point.status !== 'Working' || !['Branch', 'Warehouse', 'Postomat'].includes(point.category)}>{point.name}</option>
						{/each}
					</select>
					{#if selected}<p class="point-detail">{selected.address}{selected.maxWeight ? ` · до ${selected.maxWeight} кг / місце` : ''}</p>{/if}
					{#if side.id === 'sender' && selected}<button type="button" onclick={saveFavorite}><Bookmark size={17} />Відправляю звідси постійно</button>{/if}
					{#if side.id === 'sender' && location && routes.sender.cityRef}<div class="nearby"><button type="button" disabled={nearbyBusy} onclick={() => loadNearby()}><LocateFixed size={17} />{nearbyBusy ? 'Пошук найближчих…' : 'Найближчі пункти'}</button><p role="status">{nearbyMessage}</p>{#if nearbyCity === routes.sender.cityRef}{#each nearby.slice(0, 5) as point (point.ref)}<button class="point-choice" type="button" aria-pressed={routes.sender.pointRef === point.ref} onclick={() => choosePoint('sender', point.ref, nearby)}><MapPin size={18} /><span>{point.name}<small>{distance(point).toFixed(1)} км</small></span></button>{/each}{/if}</div>{/if}
					<button type="button" onclick={() => { mapVisible = !mapVisible; }} disabled={!routes[side.id].points.length}><MapPin size={17} />{mapVisible ? 'Сховати карту' : 'На карті'}</button>
					{#if mapVisible}<ShippingPointsMap points={side.id === 'sender' && nearbyCity === routes.sender.cityRef && nearby.length ? nearby : routes[side.id].points} selected={routes[side.id].pointRef} onselect={(ref) => choosePoint(side.id, ref, side.id === 'sender' && nearby.length ? nearby : routes[side.id].points)} />{/if}
					<div class="pagination">
						<button type="button" aria-label="Попередня сторінка пунктів" title="Попередня сторінка" disabled={routes[side.id].busy || routes[side.id].page <= 1 || !routes[side.id].cityRef} onclick={() => directory(side.id, 'warehouses', routes[side.id].page - 1)}><ArrowLeft size={16} /></button>
						<span>Сторінка {routes[side.id].page}</span>
						<button type="button" aria-label="Наступна сторінка пунктів" title="Наступна сторінка" disabled={routes[side.id].busy || !routes[side.id].hasMore || routes[side.id].page >= 1000} onclick={() => directory(side.id, 'warehouses', routes[side.id].page + 1)}><ArrowRight size={16} /></button>
					</div>
					<p class="directory-status" role="status">{routes[side.id].busy ? 'Завантаження…' : routes[side.id].message}</p>
				</fieldset>
			{/each}
		</div>
		<fieldset data-step="1" hidden={step !== 1}>
			<legend>Отримувач</legend>
			<a href={resolve('/(business)/business/customers')}>База клієнтів</a>
			{#if data.customersError}<p role="status">{data.customersError}</p>{/if}
			<label>Пошук клієнта<input type="search" bind:value={customerQuery} placeholder="Ім’я або телефон" /></label>
			<label>Постійний клієнт<select onchange={selectCustomer}><option value="">Новий одержувач / ручне введення</option>{#each matchingCustomers as customer (customer.id)}<option value={customer.id}>{customer.name} · {customer.phone}</option>{/each}</select></label>
			<div class="two-columns">
				<label>Прізвище, ім’я та по батькові<input bind:value={recipientName} name="recipientName" autocomplete="name" required minlength="3" maxlength="150" aria-invalid={form?.field === 'recipientName'} /></label>
				<label>Телефон<input bind:value={recipientPhone} name="recipientPhone" type="tel" autocomplete="tel" placeholder="+380" required pattern={'(?:\\+?380|0)[0-9]{9}'} maxlength="24" aria-invalid={form?.field === 'recipientPhone'} /></label>
			</div>
		</fieldset>
		<fieldset data-step="2" hidden={step !== 2}>
			<legend>Вантаж</legend>
			<div class="quick-actions"><button type="button" onclick={() => preset(0.5, 30, 20, 2)}><Package size={17} />Документи</button><button type="button" onclick={() => preset(1, 20, 20, 10)}><Package size={17} />Мала посилка</button><button type="button" onclick={() => preset(5, 40, 30, 20)}><Package size={17} />Середня посилка</button></div>
			<label>Опис<input bind:value={description} name="description" required minlength="3" maxlength="200" aria-invalid={form?.field === 'description'} /></label>
			<input type="hidden" name="seats" value={JSON.stringify(seats.map(({ weight, length, width, height }) => ({ weight, length, width, height })))} />
			{#each seats as seat, index (seat.id)}
				<div class="seat">
					<div class="seat-header"><strong>Місце {index + 1}</strong><button type="button" title="Видалити місце" aria-label={`Видалити місце ${index + 1}`} disabled={seats.length === 1} onclick={() => { seats = seats.filter(item => item.id !== seat.id); edited = true; }}><Trash2 size={17} /></button></div>
					<div class="dimensions">
						{#each dimensionFields as dimension (dimension.key)}<label>{dimension.label}<input type="number" min="0.001" max={dimension.max} step="0.001" required bind:value={seat[dimension.key]} aria-invalid={form?.field === 'seats'} /></label>{/each}
					</div>
				</div>
			{/each}
			<button class="add" type="button" disabled={seats.length >= 20} onclick={() => { seats = [...seats, { id: nextSeat++, weight: 1, length: 20, width: 20, height: 10 }]; edited = true; }}><Plus size={17} /> Додати місце</button>
		</fieldset>
		<fieldset data-step="2" hidden={step !== 2}>
			<legend>Оплата</legend>
			<div class="payment-grid">
				<label>Оголошена вартість, грн<input bind:value={declaredCost} type="number" name="declaredCost" min="0.01" max="1000000" step="0.01" required aria-invalid={form?.field === 'declaredCost'} /></label>
				<label>Платник<select bind:value={payer} name="payer"><option value="Recipient">Отримувач</option><option value="Sender">Відправник</option></select></label>
				<label>Спосіб оплати<select bind:value={paymentMethod} name="paymentMethod"><option value="Cash">Готівка</option><option value="NonCash">Безготівкова</option></select></label>
			</div>
		</fieldset>
		{#if form?.message}<p class="notice" role="status">{#if form.result}<Check size={18} />{:else}<TriangleAlert size={18} />{/if}<span>{form.message}</span></p>{/if}
		{#if step === 3}<section class="review"><h2>Маршрут</h2>{#each sides as side (side.id)}<p><strong>{side.label}</strong><br />{routes[side.id].cities.find(city => city.ref === routes[side.id].cityRef)?.name}<br />{routes[side.id].points.find(point => point.ref === routes[side.id].pointRef)?.name}</p>{/each}<h2>Отримувач і вантаж</h2><p>{recipientName} · {recipientPhone}</p><p>{description}</p><p>{seats.length} місць · {seats.reduce((total, seat) => total + Number(seat.weight || 0), 0)} кг · {declaredCost} грн</p><p>Платник: {payer === 'Recipient' ? 'отримувач' : 'відправник'} · {paymentMethod === 'Cash' ? 'готівка' : 'безготівкова'}</p><button type="button" onclick={() => { labelVisible = !labelVisible; }}><Printer size={17} />{labelVisible ? 'Сховати наліпки' : 'Чернетки наліпок'}</button></section>{/if}
		{#if step === 3}<label class="confirmation"><input type="checkbox" name="confirm" value="yes" bind:checked={confirmed} disabled={pending || attempted} /><span>Підтверджую дані та створення отримувача й експрес-накладної в моєму кабінеті Нової пошти.</span></label>{/if}
		<div class="wizard-actions">{#if step > 0}<button type="button" disabled={pending} onclick={() => { step -= 1; }}><ArrowLeft size={18} />Назад</button>{/if}{#if step < 3}<button class="primary" type="button" onclick={advance}>Далі<ArrowRight size={18} /></button>{:else}<button type="submit" disabled={pending || !routes.sender.pointRef || !routes.recipient.pointRef}>{#if pending}<LoaderCircle size={18} class="spinning" />{:else}<Calculator size={18} />{/if}Розрахувати</button><button class="primary" type="submit" formaction="?/issue" disabled={pending || attempted || !!form?.issued || !confirmed || !senderRef || !contactRef || !branchRoute || !!data.accountError || !!data.documentsError}><Check size={18} />Оформити ЕН</button>{/if}</div>
	</form>
	{#if attempted && !form?.issued && !pending}<p role="status">Запит на оформлення надіслано. Перевірте журнал ЕН і кабінет Нової пошти перед новою спробою.</p>{/if}
	{#if form?.issued}<section class="result" aria-live="polite"><h2>{form.issued.state === 'issued' ? `ЕН ${form.issued.trackingNumber}` : 'Результат потребує перевірки'}</h2><p>{form.issued.state === 'issued' ? 'Документ збережено в журналі.' : 'Автоматичне повторне оформлення заблоковано.'}</p></section>{/if}
	{#if step === 3 && labelVisible}<section class="labels" aria-label="Чернетки наліпок"><div class="print-toolbar"><h2>Наліпки · чернетка</h2><button type="button" onclick={printLabels}><Printer size={18} />Друк / PDF</button></div>{#each seats as seat, index (seat.id)}<article class="shipping-label"><strong class="draft-stamp">ЧЕРНЕТКА · НЕ ТТН</strong><h2>rahunok / delivery</h2><p>Місце {index + 1} / {seats.length}</p><hr /><strong>{recipientName}</strong><p>{recipientPhone}</p><p>{routes.recipient.cities.find(city => city.ref === routes.recipient.cityRef)?.name}</p><p>{routes.recipient.points.find(point => point.ref === routes.recipient.pointRef)?.name}</p><hr /><p>Звідки: {routes.sender.points.find(point => point.ref === routes.sender.pointRef)?.name}</p><p>{description}</p><p>{seat.weight} кг · {seat.length} × {seat.width} × {seat.height} см</p><small>Накладну не оформлено. Не для приймання перевізником.</small></article>{/each}</section>{/if}
	{#if result}
		<section class="result" aria-label="Результат підготовки" aria-live="polite">
			<h2>Підготовлено, не оформлено</h2>
			<p>{result.sender.name} → {result.recipient.name}</p>
			<dl><div><dt>Місця / вага</dt><dd>{result.seatsAmount} / {result.weight} кг</dd></div><div><dt>Орієнтовна доставка</dt><dd>{result.estimatedDeliveryDate ?? 'Розрахунок недоступний'}</dd></div><div><dt>Орієнтовна вартість доставки</dt><dd>{result.cost === null ? 'Розрахунок недоступний' : `${result.cost.toFixed(2)} грн`}</dd></div></dl>
			<p class="limitation">Це розрахунок, не оформлена ЕН. Безготівкова оплата потребує відповідного договору Нової пошти.</p>
		</section>
	{/if}
	<section class="document-journal" aria-label="Журнал експрес-накладних">
		<h2>Журнал ЕН</h2>
		{#if !data.documents.length}<p>{data.documentsError || 'Оформлених експрес-накладних ще немає.'}</p>{/if}
		{#each data.documents as document (document.id)}
			<article class="document-row">
				<strong>{document.trackingNumber ?? 'Непідтверджена спроба'}</strong>
				<time datetime={document.createdAt}>{document.createdAt.slice(0, 16).replace('T', ' ')} UTC</time>
				{#if document.state === 'issued'}<div class="document-links">{#each [{ id: 'waybill', label: 'ЕН PDF' }, { id: 'a4', label: 'Маркування A4' }, { id: 'zebra', label: 'Zebra 100×100' }] as format (format.id)}<a href={`${resolve('/api/v1/nova-poshta/documents/[id]/print', { id: document.id })}?format=${format.id}`}><Printer size={17} />{format.label}</a>{/each}</div>{:else}<p>Стан: {document.state === 'submitting' ? 'запит надіслано' : 'результат невідомий'}. Перевірте <a href="https://my.novaposhta.ua/" target="_blank" rel="noopener noreferrer">кабінет Нової пошти</a>. Повторне оформлення цих даних заблоковано.</p>{/if}
			</article>
		{/each}
	</section>
</main>

<style>
	.confirmation { display: flex; align-items: flex-start; gap: 12px; line-height: 1.6; }
	.confirmation input { flex: 0 0 20px; width: 20px; height: 20px; margin-top: 2px; }
	.document-journal { margin-top: 32px; border-top: 1px solid var(--color-border-default); padding-top: 24px; }
	.document-row { padding: 16px 0; border-bottom: 1px solid var(--color-border-default); overflow-wrap: anywhere; }
	.document-row time { display: block; font-size: 12px; margin: 8px 0; color: var(--color-text-secondary); }
	.document-links { display: flex; flex-wrap: wrap; gap: 16px; }
	.document-links a { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
	.wizard-actions { flex-wrap: wrap; }
	.shipping-page { --shipping-border: var(--color-border-default); }
	.labels { margin-top: 24px; } .print-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
	.shipping-label { box-sizing: border-box; max-width: 400px; border: 1px solid #18251f; border-radius: 0; padding: 20px; background: white; color: #111; margin: 16px 0; overflow-wrap: anywhere; }
	.shipping-label p { font-size: 13px; margin: 10px 0; } .shipping-label small { display: block; font-size: 11px; } .draft-stamp { display: block; border: 2px solid #111; padding: 8px; font-size: 14px; margin-bottom: 14px; }
	@media print { :global(body *) { visibility: hidden; } .labels, .labels * { visibility: visible; } .labels { position: absolute; left: 0; top: 0; margin: 0; width: 100%; } .print-toolbar { display: none; } .shipping-label { width: 100mm; max-width: none; min-height: 150mm; margin: 0; break-after: page; break-inside: avoid; } }
	.quick-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
	.nearby { margin: 18px 0; } .nearby p { font-size: 12px; color: #66726b; }
	.point-choice { display: flex; width: 100%; text-align: left; justify-content: flex-start; margin-top: 6px; }
	.point-choice span { min-width: 0; overflow-wrap: anywhere; } .point-choice small { display: block; color: #66726b; margin-top: 4px; }
	.point-choice[aria-pressed='true'] { background: var(--color-brand-50); border-color: var(--color-brand-600); }
	[hidden] { display: none !important; }
	.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin-bottom: 24px; border-bottom: 1px solid #cbd6cf; }
	.steps button { border: 0; border-radius: 0; padding: 12px 4px; font-size: 12px; color: #66726b; }
	.steps button[aria-current='step'] { color: var(--color-text-primary); border-bottom: 3px solid var(--color-brand-600); font-weight: 700; }
	.steps span { font-weight: 700; }
	.wizard-actions { display: flex; justify-content: space-between; gap: 12px; position: sticky; bottom: 76px; padding: 12px 0; background: var(--color-surface, white); z-index: 2; }
	.wizard-actions .primary { margin-left: auto; }
	.review { border-top: 1px solid #cbd6cf; padding-top: 20px; }
	.shipping-page { max-width: 960px; margin: 0 auto; padding: 28px 24px 100px; color: var(--color-text-primary, #18251f); font-family: 'Manrope Variable', sans-serif; letter-spacing: 0; }
	header { margin-bottom: 28px; } h1 { font-size: 26px; line-height: 1.3; font-weight: 650; margin: 16px 0 6px; } h2 { font-size: 20px; margin: 0 0 14px; } .carrier, .point-detail { color: var(--color-text-secondary, #66726b); font-size: 13px; }
	.back { display: inline-flex; gap: 8px; align-items: center; color: var(--color-text-primary); font-size: 13px; text-decoration: none; }
	form { display: grid; gap: 26px; } fieldset { min-width: 0; margin: 0; padding: 18px 0 0; border: 0; border-top: 1px solid var(--color-border-default, #dce3df); } legend { font-weight: 650; font-size: 16px; padding: 0 12px 0 0; }
	.route-grid { display: grid; grid-template-columns: minmax(0, 1fr); } .two-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; } label { display: block; font-size: 13px; font-weight: 550; margin: 0 0 9px; }
	input, select { display: block; box-sizing: border-box; width: 100%; min-width: 0; height: 44px; margin-top: 7px; padding: 0 11px; border: 1px solid #cbd6cf; border-radius: 6px; background: white; color: #18251f; font: inherit; font-size: 14px; } select { text-overflow: ellipsis; } input[aria-invalid='true'], select[aria-invalid='true'] { border-color: #ba413a; }
	.search-row { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; } .search-row input { margin: 0; flex: 1; } button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; min-width: 44px; border: 1px solid #cbd6cf; border-radius: 6px; background: white; color: #176947; cursor: pointer; font: inherit; font-size: 13px; padding: 8px 12px; } button:disabled { opacity: .5; cursor: default; } button:hover:not(:disabled) { background: #edf6f0; } :is(button, input, select, a):focus-visible { outline: 2px solid #23825b; outline-offset: 3px; }
	.pagination { display: flex; align-items: center; gap: 12px; font-size: 12px; margin-top: 12px; } .directory-status { min-height: 20px; font-size: 12px; color: #86602a; margin: 8px 0 0; }
	.seat { border-bottom: 1px solid #dce3df; padding: 12px 0; } .seat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; } .dimensions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; } .add { margin-top: 14px; } .payment-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
	.primary { justify-self: start; background: var(--color-brand-600); color: white; border-color: var(--color-brand-600); padding: 11px 18px; } .primary:hover:not(:disabled) { background: var(--color-brand-700); } .notice { display: flex; gap: 10px; align-items: start; font-size: 13px; margin: 0; } .notice :global(svg) { flex-shrink: 0; }
	.result { border-top: 2px solid #23825b; margin-top: 28px; padding-top: 22px; } .result p { font-size: 14px; overflow-wrap: anywhere; } dl { margin: 18px 0; } dl div { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #dce3df; padding: 12px 0; font-size: 13px; } dt { color: #66726b; } dd { margin: 0; text-align: right; } .limitation { color: #66726b; line-height: 1.7; }
	:is(input, select, button) { border-color: var(--shipping-border); border-radius: 8px; }
	button:not(.primary) { color: var(--color-text-primary); }
	button:hover:not(:disabled):not(.primary) { background: var(--color-brand-50); }
	:is(button, input, select, a):focus-visible { outline-color: var(--color-brand-500); }
	.steps, .review, .seat, dl div, .result { border-color: var(--shipping-border); }
	.nearby p, .point-choice small, .steps button, dt, .limitation { color: var(--color-text-secondary); }
	:global(.spinning) { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { :global(.spinning) { animation: none; } }
	@media (max-width: 640px) { .shipping-page { padding: 20px 16px 100px; } h1 { font-size: 23px; } .route-grid, .two-columns, .payment-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; } .dimensions { grid-template-columns: repeat(2, minmax(0, 1fr)); } .primary { width: 100%; } }
</style>