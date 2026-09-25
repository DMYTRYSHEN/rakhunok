<script lang="ts">
	import { tick } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Search from '@lucide/svelte/icons/search';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Check from '@lucide/svelte/icons/check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Utensils from '@lucide/svelte/icons/utensils';

	const products = [
		{ id: 'espresso', name: 'Еспресо', detail: '30 мл', category: 'Напої', price: 6500, image: 'espresso' },
		{ id: 'cappuccino', name: 'Капучино', detail: '250 мл', category: 'Напої', price: 8500, image: 'cappuccino' },
		{ id: 'croissant', name: 'Круасан', detail: 'Вершковий · 80 г', category: 'Сніданки', price: 9500, image: 'croissant' },
		{ id: 'toast', name: 'Тост з авокадо', detail: '220 г', category: 'Сніданки', price: 18500, image: 'toast' },
		{ id: 'salad', name: 'Зелений салат', detail: '280 г', category: 'Кухня', price: 21000, image: 'salad' },
		{ id: 'cake', name: 'Чизкейк', detail: '150 г', category: 'Десерти', price: 14500, image: 'cake' }
	];
	const categories = ['Усі', 'Напої', 'Сніданки', 'Кухня', 'Десерти'];
	const currency = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 2 });
	let search = $state('');
	let category = $state('Усі');
	let quantities = $state<Record<string, number>>({});
	let table = $state('');
	let note = $state('');
	let confirmed = $state(false);
	let confirmClear = $state(false);
	let cartOpen = $state(false);
	let cartHeading: HTMLHeadingElement;
	let menuHeading: HTMLHeadingElement;
	let cartToggle: HTMLButtonElement;
	const cartId = $props.id();
	const filtered = $derived(products.filter(product => (category === 'Усі' || product.category === category) && product.name.toLocaleLowerCase('uk-UA').includes(search.trim().toLocaleLowerCase('uk-UA'))));
	const lines = $derived(products.filter(product => (quantities[product.id] ?? 0) > 0));
	const count = $derived(lines.reduce((total, product) => total + (quantities[product.id] ?? 0), 0));
	const total = $derived(lines.reduce((total, product) => total + product.price * (quantities[product.id] ?? 0), 0));

	function changeQuantity(id: string, delta: number) {
		if (confirmed) return;
		quantities = { ...quantities, [id]: Math.max(0, Math.min(99, (quantities[id] ?? 0) + delta)) };
		confirmClear = false;
	}

	function reset() {
		quantities = {};
		note = '';
		table = '';
		confirmed = false;
		confirmClear = false;
	}

	async function toggleCart() {
		cartOpen = !cartOpen;
		await tick();
		const target = cartOpen ? cartHeading : count > 0 ? cartToggle : menuHeading;
		target.focus({ preventScroll: true });
		target.scrollIntoView({ block: 'nearest' });
	}
</script>

<section class="waiter-menu" class:cart-open={cartOpen} class:empty-cart={count === 0 && !cartOpen} aria-label="Демонстраційне меню">
	<button class="cart-toggle" type="button" bind:this={cartToggle} aria-expanded={cartOpen} aria-controls={cartId} onclick={toggleCart}>
		{#if cartOpen}<ArrowLeft size={20} aria-hidden="true" /><span>До меню</span>{:else}<ShoppingBag size={20} aria-hidden="true" /><span>Кошик · {count}</span>{/if}
		<strong aria-live="polite">{currency.format(total / 100)}</strong>
	</button>
	<div class="menu-heading"><div><p>Меню закладу</p><h1 bind:this={menuHeading} tabindex="-1">Товари</h1></div><span class="demo-label">Демо · без оплати</span></div>
	<div class="waiter-layout">
		<div class="catalog">
			<label class="product-search"><Search size={19} aria-hidden="true" /><input type="search" bind:value={search} placeholder="Пошук страви чи напою" aria-label="Пошук товарів" /></label>
			<div class="categories" role="group" aria-label="Категорії товарів">
				{#each categories as item (item)}<button type="button" aria-pressed={category === item} onclick={() => category = item}>{item}</button>{/each}
			</div>
			<div class="product-grid">
				{#each filtered as product (product.id)}
					<button class="product" type="button" aria-label={`Додати ${product.name}`} disabled={confirmed || (quantities[product.id] ?? 0) >= 99} onclick={() => changeQuantity(product.id, 1)}>
						<div class="product-photo"><img src={`/app/menu/${product.image}.jpg`} alt={product.name} loading="lazy" width="400" height="300" />{#if quantities[product.id]}<span class="quantity-badge">{quantities[product.id]}</span>{/if}</div>
						<div class="product-info"><strong>{product.name}</strong><small>{product.detail}</small><span class="product-price">{currency.format(product.price / 100)}<Plus size={18} aria-hidden="true" /></span></div>
					</button>
				{:else}
					<div class="no-products"><Search size={28} aria-hidden="true" /><p>Нічого не знайдено</p><button type="button" onclick={() => { search = ''; category = 'Усі'; }}>Скинути фільтри</button></div>
				{/each}
			</div>
		</div>
		<aside id={cartId} class="order-composer" aria-label="Демонстраційне замовлення">
			<div class="order-heading"><h2 bind:this={cartHeading} tabindex="-1"><ShoppingBag size={21} aria-hidden="true" />Замовлення <span>{count}</span></h2>{#if count > 0 && !confirmed}<button class="icon-button" type="button" title="Очистити замовлення" aria-label="Очистити замовлення" onclick={() => confirmClear = !confirmClear}><Trash2 size={18} aria-hidden="true" /></button>{/if}</div>
			{#if confirmClear}<div class="clear-confirm"><span>Очистити замовлення?</span><button type="button" onclick={reset}>Очистити</button><button type="button" onclick={() => confirmClear = false}>Залишити</button></div>{/if}
			{#if confirmed}
				<div class="demo-confirmation" role="status"><Check size={22} aria-hidden="true" /><div><strong>Демо-замовлення сформовано</strong><p>Стіл {table} · Не надіслано на кухню</p></div></div>
			{:else}
				<label class="table-field"><Utensils size={18} aria-hidden="true" /><span>Стіл (демо)</span><select aria-label="Стіл демонстраційного замовлення" bind:value={table}><option value="">Оберіть стіл</option>{#each Array.from({ length: 8 }, (_, index) => String(index + 1)) as number (number)}<option value={number}>Стіл {number}</option>{/each}</select></label>
			{/if}
			<div class="order-lines">
				{#each lines as product (product.id)}
					<div class="order-line"><div class="line-description"><strong>{product.name}</strong><small>{currency.format(product.price / 100)} / шт.</small></div><strong class="line-total">{currency.format(product.price * (quantities[product.id] ?? 0) / 100)}</strong><div class="quantity-control"><button type="button" disabled={confirmed} aria-label={`Зменшити ${product.name}`} onclick={() => changeQuantity(product.id, -1)}><Minus size={16} aria-hidden="true" /></button><output aria-label={`Кількість ${product.name}`}>{quantities[product.id]}</output><button type="button" disabled={confirmed || (quantities[product.id] ?? 0) >= 99} aria-label={`Збільшити ${product.name}`} onclick={() => changeQuantity(product.id, 1)}><Plus size={16} aria-hidden="true" /></button></div></div>
				{:else}<div class="empty-order"><ShoppingBag size={36} strokeWidth={1.25} aria-hidden="true" /><strong>Замовлення порожнє</strong></div>{/each}
			</div>
			{#if count > 0}
				<label class="order-note">Примітка<textarea bind:value={note} readonly={confirmed} maxlength="300" rows="2" placeholder="Наприклад, без цукру"></textarea></label>
			{/if}
			<div class="order-summary"><span>Разом</span><output aria-label="Сума демонстраційного замовлення" aria-live="polite">{currency.format(total / 100)}</output></div>
			{#if confirmed}<button class="submit-demo" type="button" onclick={reset}>Нове замовлення<Plus size={20} aria-hidden="true" /></button>
			{:else}<button class="submit-demo" type="button" disabled={!count || !table} onclick={() => { confirmed = true; confirmClear = false; }}>Сформувати демо<ArrowRight size={20} aria-hidden="true" /></button>{/if}
		</aside>
	</div>
</section>

<style>
	.waiter-menu { padding: 24px 20px; color: var(--ink); }
	.cart-toggle { display: none; }
	.empty-cart .cart-toggle:not(:focus), .empty-cart .order-composer:not(:focus-within) { display: none; }
	.empty-cart .waiter-layout:not(:has(.order-composer:focus-within)) { grid-template-columns: minmax(0, 1fr); }
	.menu-heading, .order-heading, .product-price, .order-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.menu-heading { margin-bottom: 24px; flex-wrap: wrap; }
	.menu-heading p { color: var(--muted); font-size: 12px; margin: 0 0 6px; }
	h1 { font-size: 28px; font-weight: 550; margin: 0; }
	.demo-label { color: var(--muted); font-size: 12px; padding: 6px 0; border-bottom: 2px solid var(--brand); }
	.waiter-layout { display: grid; gap: 28px; }
	.catalog { min-width: 0; }
	.product-search { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 12px; background: var(--key); border: 1px solid var(--line); border-radius: 8px; color: var(--muted); }
	input { min-width: 0; width: 100%; min-height: 46px; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 14px; }
	.categories { display: flex; gap: 16px; overflow-x: auto; margin: 12px 0 20px; }
	.categories button { flex-shrink: 0; min-height: 44px; padding: 8px 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font: inherit; font-size: 13px; }
	.categories button[aria-pressed='true'] { border-color: var(--ink); color: var(--ink); }
	.product-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; }
	.product { min-width: 0; text-align: left; padding: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel); color: var(--ink); font: inherit; }
	.product-photo { position: relative; aspect-ratio: 1.333333; }
	.product-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.quantity-badge { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; min-width: 28px; height: 28px; padding-inline: 5px; background: var(--action); color: white; border-radius: 6px; font-size: 13px; font-weight: 650; }
	.product-info { display: grid; gap: 6px; padding: 12px; }
	.product-info strong { font-size: 14px; min-height: 38px; overflow-wrap: anywhere; }
	.product-info small { color: var(--muted); font-size: 12px; }
	.product-price { margin-top: 8px; font-size: 14px; font-weight: 600; }
	.product-price :global(svg) { flex-shrink: 0; color: var(--brand); }
	.order-composer { min-width: 0; border-top: 1px solid var(--line); padding-top: 20px; }
	h2 { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 550; margin: 0; }
	h2 span { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
	.icon-button, .quantity-control button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 6px; background: var(--key); color: var(--ink); flex-shrink: 0; }
	.table-field { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-block: 16px; border-bottom: 1px solid var(--line); font-size: 13px; }
	.table-field select { flex: 1; min-width: 120px; min-height: 44px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; }
	.order-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding-block: 16px; border-bottom: 1px solid var(--line); }
	.line-description { display: grid; gap: 6px; }
	.line-description strong { font-size: 14px; overflow-wrap: anywhere; }
	.line-description small { font-size: 12px; color: var(--muted); }
	.line-total { font-size: 14px; font-variant-numeric: tabular-nums; }
	.quantity-control { display: flex; align-items: center; grid-column: 1 / -1; }
	.quantity-control output { text-align: center; width: 40px; font-size: 14px; font-variant-numeric: tabular-nums; }
	.empty-order { display: grid; justify-items: center; gap: 16px; padding: 40px 0; color: var(--muted); font-size: 14px; }
	.order-note { display: grid; gap: 8px; margin-block: 20px; font-size: 12px; color: var(--muted); }
	textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; }
	.order-summary { margin-block: 24px; font-size: 14px; }
	.order-summary output { font-size: 24px; font-weight: 550; font-variant-numeric: tabular-nums; }
	.submit-demo { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 52px; padding: 12px 16px; border: 0; border-radius: 8px; background: var(--action); color: white; font: inherit; font-size: 14px; font-weight: 600; }
	button:disabled { opacity: .45; cursor: default; }
	.demo-confirmation { display: flex; gap: 10px; margin-top: 16px; padding: 16px 0; color: var(--success); border-bottom: 1px solid var(--line); }
	.demo-confirmation :global(svg) { flex-shrink: 0; }
	.demo-confirmation strong { font-size: 14px; }
	.demo-confirmation p { font-size: 12px; line-height: 1.5; margin: 6px 0 0; color: var(--muted); }
	.clear-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 16px; font-size: 13px; }
	.clear-confirm button, .no-products button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--key); color: var(--ink); font: inherit; }
	.no-products { grid-column: 1 / -1; display: grid; justify-items: center; padding: 32px 0; color: var(--muted); font-size: 14px; }
	@media (hover: hover) { .product:hover:not(:disabled) { border-color: var(--brand); } }
	@media (min-width: 640px) { .waiter-layout { grid-template-columns: minmax(0, 1fr) minmax(240px, .8fr); } .order-composer { border-top: 0; border-left: 1px solid var(--line); padding: 0 0 0 24px; } }
	@media (min-width: 900px) { .waiter-menu { margin-left: 208px; padding: 28px 32px 32px 0; } }
	@media (max-width: 639px) {
		.waiter-menu { padding: 0 12px 16px; }
		.cart-toggle { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; width: 100%; min-height: 52px; padding: 8px 0; border: 0; border-bottom: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: .875rem; text-align: left; }
		.cart-toggle strong { margin-left: auto; font-variant-numeric: tabular-nums; }
		.cart-toggle :global(svg) { flex-shrink: 0; }
		.menu-heading { margin: 12px 0; gap: 8px; }
		h1 { font-size: 1.5rem; }
		.menu-heading p { display: none; }
		.categories { margin: 4px 0 12px; }
		.order-composer { display: none; padding-top: 12px; border: 0; }
		.cart-open .order-composer { display: block; }
		.cart-open .catalog, .cart-open .menu-heading { display: none; }
		.order-heading { scroll-margin-top: 64px; }
		h2 { font-size: 1rem; flex-wrap: wrap; }
		.product-info strong, .product-price, .line-description strong, .line-total, .submit-demo { font-size: .875rem; }
		.product-info small, .demo-label, .line-description small { font-size: .75rem; }
		.table-field, .categories button, .order-note { font-size: .8125rem; }
		.order-summary output { font-size: 1.5rem; }
		.line-total { overflow-wrap: anywhere; }
	}
</style>