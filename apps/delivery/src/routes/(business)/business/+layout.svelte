<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Package2, TriangleAlert, MapPin, ChartNoAxesColumn, Plug, Settings, Menu, X, LogOut, Users } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import TrackingApiExample from '#lib/TrackingApiExample.svelte';
	let { children }: LayoutProps = $props();
	let moreDialog: HTMLDialogElement;
	const pathname = $derived(page.url.pathname.replace(/\/$/, ''));
	const items = [
		{ href: resolve('/(business)/business'), label: 'Відправлення', icon: Package2 },
		{ href: resolve('/(business)/business/attention'), label: 'Потребують уваги', icon: TriangleAlert },
		{ href: resolve('/(business)/business/points'), label: 'Точки отримання', icon: MapPin },
		{ href: resolve('/(business)/business/analytics'), label: 'Аналітика', icon: ChartNoAxesColumn },
		{ href: resolve('/(business)/business/customers'), label: 'Клієнти', icon: Users },
		{ href: resolve('/(business)/business/integrations'), label: 'Інтеграції', icon: Plug },
		{ href: resolve('/(business)/business/settings'), label: 'Налаштування', icon: Settings },
		{ href: resolve('/(business)/business/settings/sender'), label: 'Відправник', icon: Users }
	];
	const selectedItem = $derived(items.filter((item) => {
		const itemPath = new URL(item.href, page.url.href).pathname.replace(/\/+$/, '');
		return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
	}).sort((left, right) => right.href.length - left.href.length)[0]);
	const sections = {
		attention: {
			intro: 'Відправлення із затримкою, невдалою доставкою або поверненням.',
			columns: ['Накладна', 'Перевізник', 'Причина уваги', 'Остання подія'],
			empty: 'Список проблемних відправлень ще не сформовано',
			detail: 'Тут з’являться підтверджені перевізником проблеми та час останньої події. Автоматичний відбір ще не активовано.'
		},
		points: {
			intro: 'Відділення та поштомати, пов’язані з вашими відправленнями.',
			columns: ['Точка отримання', 'Перевізник', 'Адреса', 'Графік роботи'],
			empty: 'Довідник точок отримання ще не синхронізовано',
			detail: 'Після підключення довідників тут будуть актуальні адреси, типи точок і графіки роботи. Дані довідників перевізників поки не завантажуються.'
		},
		analytics: {
			intro: 'Підсумки доставки за перевізниками на основі історії ваших відправлень.',
			columns: ['Перевізник', 'Відправлення', 'Доставлено', 'Повернення', 'Час доставки'],
			empty: 'Звіт ще не розраховано',
			detail: 'Тут з’являться кількість доставок, повернень і тривалість доставки за обраний період. Розрахунок звітів ще не активовано; відсутні значення не замінюються нулями.'
		}
	};
	const sectionKey = $derived(selectedItem ? new URL(selectedItem.href, page.url.href).pathname.split('/').filter(Boolean).at(-1) : undefined);
	const report = $derived(sectionKey && sectionKey in sections ? sections[sectionKey as keyof typeof sections] : undefined);
</script>

<svelte:head>
	{#if selectedItem && selectedItem !== items[0]}<title>{selectedItem.label} — Rahunok Delivery</title>{/if}
</svelte:head>

<div class="delivery-business-shell">
	<aside class="delivery-business-sidebar">
		<a href={resolve('/(public)')} class="delivery-business-brand" aria-label="Rahunok Delivery: головна"><span><Package2 size={21} strokeWidth={1.8} /></span><strong>rahunok<small>/ delivery</small></strong></a>
		<nav aria-label="Розділи кабінету">
			{#each items as item (item.href)}
				<a href={item.href} aria-current={selectedItem === item ? 'page' : undefined} title={item.label}><item.icon size={19} strokeWidth={1.8} /><span>{item.label}</span></a>
			{/each}
		</nav>
		<div class="delivery-business-account"><span>R</span><div>Особистий кабінет<small>Google</small></div><form method="POST" action={resolve('/logout')}><button type="submit">Вийти</button></form></div>
	</aside>
	<div class="delivery-business-content">
		{#if selectedItem && (sectionKey === 'attention' || sectionKey === 'analytics' || pathname === new URL(resolve('/(business)/business/settings'), page.url.href).pathname)}
			<main class="section-empty">
				<h1>{selectedItem.label}</h1>
				{#if report}
					<p class="section-intro">{report.intro}</p>
					<div class="table-scroll">
						<table>
							<caption class="sr-only">{selectedItem.label}</caption>
							<thead><tr>{#each report.columns as column (column)}<th scope="col">{column}</th>{/each}</tr></thead>
							<tbody></tbody>
						</table>
					</div>
					<div class="empty-content"><selectedItem.icon size={32} strokeWidth={1.5} /><h2>{report.empty}</h2><p role="status">{report.detail}</p><a class="action-link" href={resolve('/(business)/business')}><Package2 size={17} />Мої відправлення</a></div>
				{:else if sectionKey === 'settings'}
					<p class="section-intro">Обліковий запис, робочий простір і сповіщення про доставку.</p>
					<nav aria-label="Налаштування доставки">
						<a class="action-link" href={resolve('/(business)/business/settings/sender')}><Package2 size={17} />Відправник Нової пошти</a>
						<a class="action-link" href={resolve('/(business)/business/integrations')}><Plug size={17} />Ключі перевізників</a>
						<a class="action-link" href={resolve('/(business)/business/customers')}><Users size={17} />Постійні клієнти</a>
					</nav>
					<dl class="settings-list">
						<div><dt>Спосіб входу</dt><dd>Google</dd></div>
						<div><dt>Робочий простір</dt><dd>Особистий кабінет</dd></div>
						<div><dt>Профіль компанії</dt><dd>Назва, реквізити та контакти компанії. Редагування й збереження ще недоступні.</dd></div>
						<div><dt>Сповіщення</dt><dd>Зміна статусу, затримка та повернення. Канали сповіщень ще не підключені.</dd></div>
						<div><dt>Команда та доступ</dt><dd>Учасники й ролі робочого простору. Запрошення учасників ще недоступні.</dd></div>
					</dl>
					<TrackingApiExample origin={page.url.origin} />
				{/if}
			</main>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>

<nav class="mobile-tabs" aria-label="Мобільна навігація">
	{#each items.slice(0, 3) as item, index (item.href)}
		<a href={item.href} aria-current={selectedItem === item ? 'page' : undefined}><item.icon size={22} /><span>{['Відправлення', 'Увага', 'Точки'][index]}</span></a>
	{/each}
	<button type="button" aria-label="Інші розділи" aria-haspopup="dialog" class:active={items.slice(3).includes(selectedItem!)} onclick={() => moreDialog.showModal()}><Menu size={22} /><span>Ще</span></button>
</nav>
<dialog bind:this={moreDialog} class="more-dialog" aria-labelledby="more-title">
	<header><h2 id="more-title">Особистий кабінет</h2><button type="button" aria-label="Закрити меню" onclick={() => moreDialog.close()}><X size={22} /></button></header>
	<nav aria-label="Додаткові розділи">
		{#each items.slice(3) as item (item.href)}<a href={item.href} onclick={() => moreDialog.close()} aria-current={selectedItem === item ? 'page' : undefined}><item.icon size={22} /><span>{item.label}</span></a>{/each}
	</nav>
	<form method="POST" action={resolve('/logout')}><button class="logout-button" type="submit"><LogOut size={20} />Вийти з облікового запису</button></form>
</dialog>

<style>
	.mobile-tabs { display: none; }
	.more-dialog { width: min(100%, 480px); max-width: 100%; max-height: 85dvh; margin: auto auto 0; padding: 24px 20px calc(24px + env(safe-area-inset-bottom)); border: 0; border-radius: 8px 8px 0 0; background: var(--color-surface); color: var(--color-text-primary); }
	.more-dialog::backdrop { background: rgb(0 0 0 / 35%); }
	.more-dialog header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
	.more-dialog h2 { font-size: 18px; font-weight: 650; }
	.more-dialog button { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; }
	.more-dialog nav a { min-height: 56px; font-size: 15px; }
	.logout-button { margin-top: 24px; font-size: 14px; }
	a:focus-visible, button:focus-visible { outline: 2px solid var(--color-brand-500); outline-offset: 3px; }
	.delivery-business-shell { display: grid; grid-template-columns: 224px minmax(0, 1fr); min-height: 100dvh; font-family: var(--font-sans); background: var(--color-surface); color: var(--color-text-primary); }
	.delivery-business-sidebar { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; background: var(--color-surface); border-right: 1px solid var(--color-border-default); padding: 24px 12px 16px; }
	.delivery-business-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 26px; }
	.delivery-business-brand > span { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; border-radius: 8px; background: var(--color-brand-600); color: white; }
	.delivery-business-brand strong { font-size: 18px; font-weight: 800; }
	.delivery-business-brand small { display: block; font-size: 10px; font-weight: 500; color: var(--color-text-secondary); }
	nav { display: flex; flex-direction: column; gap: 4px; }
	nav a { display: flex; align-items: center; gap: 11px; min-height: 46px; padding: 10px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
	nav a :global(svg) { flex-shrink: 0; width: 19px; height: 19px; }
	nav a:hover { background: var(--color-brand-50); color: var(--color-text-primary); }
	nav a[aria-current='page'] { background: var(--color-brand-100); color: var(--color-text-primary); }
	.delivery-business-account { display: flex; align-items: center; gap: 10px; margin-top: auto; padding: 18px 8px 0; border-top: 1px solid var(--color-border-default); font-size: 11px; font-weight: 650; }
	.delivery-business-account > span { display: grid; place-items: center; width: 32px; height: 32px; background: var(--color-brand-100); border-radius: 50%; }
	.delivery-business-account small { display: block; margin-top: 4px; font-size: 10px; font-weight: 500; color: var(--color-text-secondary); }
	.delivery-business-content { min-width: 0; }
	.section-empty { padding: 32px 24px; }
	.section-empty p { color: var(--color-text-secondary); font-size: 14px; line-height: 1.6; }
	.section-intro { margin: 12px 0 32px; max-width: 720px; }
	.table-scroll { overflow-x: auto; border-block: 1px solid var(--color-border-default); }
	table { width: 100%; border-collapse: collapse; min-width: 620px; text-align: left; }
	th { padding: 16px; font-size: 12px; font-weight: 600; background: var(--color-brand-50); border-bottom: 1px solid var(--color-border-default); }
	.empty-content { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; max-width: 600px; margin: auto; padding: 32px 0; }
	.section-empty h2 { font-size: 17px; font-weight: 600; line-height: 1.4; }
	.empty-content :global(svg) { flex-shrink: 0; color: var(--color-text-secondary); }
	.action-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: var(--color-text-primary); font-size: 14px; font-weight: 600; }
	.settings-list > div { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; padding: 22px 0; border-top: 1px solid var(--color-border-default); font-size: 14px; line-height: 1.6; }
	dt { font-weight: 600; }
	dd { color: var(--color-text-secondary); }
	@media (max-width: 640px) {
		.section-empty { padding: 24px 16px; }
		.settings-list > div { grid-template-columns: minmax(0, 1fr); gap: 12px; }
		table { min-width: 560px; }
		.empty-content { max-width: 300px; }
	}
	.delivery-business-content :global(main) { min-width: 0; }
	.delivery-business-content :global(.rounded-xl), .delivery-business-content :global(.rounded-2xl) { border-radius: 8px; }
	.delivery-business-content :global(h1), .delivery-business-content :global(main > div > header h2) { font-size: 28px; font-weight: 650; line-height: 1.3; }
	.delivery-business-content :global(input:not([type='checkbox']):not([type='range'])), .delivery-business-content :global(select) { min-height: 44px; }
	@media (max-width: 1023px) {
		.delivery-business-shell { display: block; }
		.delivery-business-sidebar { position: sticky; height: auto; z-index: 20; padding: calc(12px + env(safe-area-inset-top)) 16px 12px; border-right: 0; border-bottom: 1px solid var(--color-border-default); }
		.delivery-business-brand { padding: 0; }
		.delivery-business-brand small { display: inline; margin-left: 8px; }
		.delivery-business-sidebar nav, .delivery-business-account { display: none; }
		.delivery-business-content { padding-bottom: calc(84px + env(safe-area-inset-bottom)); }
		.mobile-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: fixed; z-index: 30; bottom: 0; inset-inline: 0; padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); background: var(--color-surface); border-top: 1px solid var(--color-border-default); gap: 4px; }
		.mobile-tabs a, .mobile-tabs button { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; min-height: 56px; padding: 6px 0; border: 0; border-radius: 6px; background: transparent; font-size: 10px; font-weight: 600; color: var(--color-text-secondary); }
		.mobile-tabs a[aria-current='page'], .mobile-tabs button.active { background: var(--color-brand-100); color: var(--color-text-primary); }
		.table-scroll { display: none; }
		.empty-content { align-items: flex-start; text-align: left; max-width: none; border-top: 1px solid var(--color-border-default); }
	}
</style>