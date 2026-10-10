<script lang="ts">
	import { resolve } from '$app/paths';
	import { cachedDirectory } from '#lib/directory-cache.ts';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	import { Search, MapPin, ChevronLeft, ChevronRight, PackagePlus } from '@lucide/svelte';
	import type { City, Warehouse } from '#lib/server/tracking/np-api.ts';
	let query = $state('');
	let warehouseQuery = $state('');
	let cities = $state<City[]>([]);
	let selectedCity = $state<City | null>(null);
	let warehouses = $state<Warehouse[]>([]);
	let pageNumber = $state(1);
	let hasMore = $state(false);
	let pending = $state(false);
	let message = $state('');
	let category = $state('all');
	let loadedQuery = $state('');
	const visible = $derived(warehouses.filter(item => category === 'all' || (category === 'lockers' ? item.category === 'Postomat' : item.category !== 'Postomat')));
	async function search(city?: City, nextPage = 1) {
		if (pending) return;
		pending = true;
		message = '';
		try {
			const url = new URL(resolve('/api/v1/nova-poshta/directory'), location.origin);
			url.searchParams.set('kind', city ? 'warehouses' : 'cities');
			url.searchParams.set('q', city ? warehouseQuery : query);
			url.searchParams.set('page', String(nextPage));
			if (city) url.searchParams.set('cityRef', city.ref);
			const result = await cachedDirectory(`${url.pathname}${url.search}`, data.userId);
			if (city) { selectedCity = city; warehouses = result.data as Warehouse[]; pageNumber = nextPage; hasMore = result.hasMore === true; }
			else { cities = result.data as City[]; selectedCity = null; warehouses = []; pageNumber = nextPage; hasMore = result.hasMore === true; loadedQuery = query; }
			if (!result.data.length) message = 'За цим запитом нічого не знайдено.';
		} catch (caught) { message = caught instanceof Error ? caught.message : 'Довідник недоступний.'; }
		finally { pending = false; }
	}
</script>

<svelte:head><title>Точки отримання — Rahunok Delivery</title></svelte:head>
<main>
	<header><div><p class="eyebrow">НОВА ПОШТА</p><h1>Точки отримання</h1></div><a class="action" href={resolve('/(business)/business/new')}><PackagePlus size={20} />Підготувати відправлення</a></header>
	<form onsubmit={(event) => { event.preventDefault(); void search(); }}>
		<label>Населений пункт<input type="search" bind:value={query} minlength={2} maxlength={100} required placeholder="Назва міста або селища" /></label>
		<button type="submit" disabled={pending} title="Знайти населений пункт" aria-label="Знайти населений пункт"><Search size={20} /></button>
	</form>
	{#if !selectedCity && cities.length}<ul class="cities">{#each cities as city (city.ref)}<li><button disabled={pending} onclick={() => { warehouseQuery = ''; void search(city); }}><MapPin size={18} /><span>{city.name}<small>{city.area}</small></span><ChevronRight size={18} /></button></li>{/each}</ul>{/if}
	{#if !selectedCity && loadedQuery === query && cities.length}
		<div class="pagination"><button disabled={pending || pageNumber === 1} aria-label="Попередня сторінка міст" title="Попередня сторінка міст" onclick={() => search(undefined, pageNumber - 1)}><ChevronLeft size={20} /></button><span>Сторінка {pageNumber}</span><button disabled={pending || !hasMore} aria-label="Наступна сторінка міст" title="Наступна сторінка міст" onclick={() => search(undefined, pageNumber + 1)}><ChevronRight size={20} /></button></div>
	{/if}
	{#if selectedCity}
		<h2>{selectedCity.name}</h2>
		<form onsubmit={(event) => { event.preventDefault(); void search(selectedCity!); }}>
				<label>Відділення, поштомат або адреса<input type="search" bind:value={warehouseQuery} maxlength={100} placeholder="Номер або вулиця" /></label>
			<button type="submit" disabled={pending} title="Знайти точку" aria-label="Знайти точку"><Search size={20} /></button>
		</form>
		<div class="modes" role="group" aria-label="Тип точки">{#each [{ value: 'all', label: 'Усі' }, { value: 'branches', label: 'Відділення' }, { value: 'lockers', label: 'Поштомати' }] as option (option.value)}<button aria-pressed={category === option.value} onclick={() => category = option.value}>{option.label}</button>{/each}</div>
		<ul class="points">{#each visible as point (point.ref)}<li><div class="point-title"><MapPin size={20} /><h3>{point.name}</h3></div><p>{point.address}</p><dl><div><dt>Статус</dt><dd>{point.status === 'Working' ? 'Працює' : point.status || 'Не надано'}</dd></div><div><dt>Вага місця</dt><dd>{point.maxWeight !== null && point.maxWeight > 0 ? `${point.maxWeight} кг` : 'Не надано'}</dd></div></dl>{#if Object.keys(point.schedule).length}<details><summary>Графік роботи</summary><dl>{#each Object.entries(point.schedule) as [day, hours] (day)}<div><dt>{({ Monday: 'Понеділок', Tuesday: 'Вівторок', Wednesday: 'Середа', Thursday: 'Четвер', Friday: 'П’ятниця', Saturday: 'Субота', Sunday: 'Неділя' } as Record<string, string>)[day]}</dt><dd>{hours}</dd></div>{/each}</dl></details>{/if}</li>{/each}</ul>
		<div class="pagination"><button disabled={pending || pageNumber === 1} aria-label="Попередня сторінка" title="Попередня сторінка" onclick={() => search(selectedCity!, pageNumber - 1)}><ChevronLeft size={20} /></button><span>Сторінка {pageNumber}</span><button disabled={pending || !hasMore} aria-label="Наступна сторінка" title="Наступна сторінка" onclick={() => search(selectedCity!, pageNumber + 1)}><ChevronRight size={20} /></button></div>
	{/if}
	<p role="status">{pending ? 'Завантаження…' : message}</p>
</main>

<style>
	main { padding: 32px 24px; max-width: 1100px; margin: auto; }
	header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 28px; flex-wrap: wrap; }
	.eyebrow { font-size: 11px; color: var(--color-text-secondary); margin-bottom: 8px; }
	.action { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; min-height: 44px; color: var(--color-text-primary); }
	form { display: flex; gap: 12px; align-items: end; margin: 20px 0; }
	label { display: grid; gap: 8px; font-size: 13px; flex: 1; min-width: 0; }
	input { width: 100%; min-width: 0; padding: 10px 12px; background: white; border: 1px solid var(--color-border-default); border-radius: 6px; }
	button { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 10px; border: 1px solid var(--color-border-default); border-radius: 6px; }
	button:disabled { opacity: .45; }
	button:hover:not(:disabled) { background: var(--color-brand-50); }
	button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--color-brand-500); outline-offset: 3px; }
	.cities button { width: 100%; justify-content: start; gap: 12px; margin-bottom: 8px; text-align: left; }
	.cities span { flex: 1; }
	small { display: block; color: var(--color-text-secondary); }
	h2 { font-size: 20px; font-weight: 600; margin-top: 28px; }
	.modes { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
	.modes button[aria-pressed='true'] { background: var(--color-brand-100); }
	.points { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.points > li { padding: 20px; background: white; border: 1px solid var(--color-border-default); border-radius: 8px; overflow-wrap: anywhere; }
	.point-title { display: flex; gap: 10px; align-items: start; }
	.point-title :global(svg) { flex-shrink: 0; }
	h3 { font-size: 15px; font-weight: 650; }
	.points p { margin: 12px 0; font-size: 14px; color: var(--color-text-secondary); }
	dl > div { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; margin: 8px 0; }
	dd { text-align: right; }
	summary { cursor: pointer; padding: 12px 0; font-size: 13px; }
	.pagination { display: flex; align-items: center; gap: 16px; margin: 24px 0; font-size: 13px; }
	@media (max-width: 640px) { main { padding: 24px 16px; } .points { grid-template-columns: minmax(0, 1fr); } }
</style>