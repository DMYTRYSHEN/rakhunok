<script lang="ts">
	import {
		Check,
		Clock,
		MapPin,
		Minus,
		Plus,
		ShoppingBag,
		Truck,
		Utensils
	} from '@lucide/svelte';

	let {
		onPay,
		scenario = 'vertical_food'
	}: {
		onPay: (amount: number) => void;
		scenario?: string;
	} = $props();

	type MenuItem = {
		id: string;
		name: string;
		description: string;
		basePrice: number;
		category: string;
		imageEmoji: string;
		modifiers: { id: string; name: string; price: number }[];
	};

	const menuItems: MenuItem[] = [
		{
			id: 'pizza_1',
			name: 'Піца «4 сири»',
			description: 'Моцарела, горгонзола, пармезан, рікота, вершковий соус',
			basePrice: 290,
			category: 'pizza',
			imageEmoji: '🍕',
			modifiers: [
				{ id: 'extra_cheese', name: 'Подвійний сир', price: 45 },
				{ id: 'truffle', name: 'Трюфельна олія', price: 35 }
			]
		},
		{
			id: 'pizza_2',
			name: 'Піца «Пепероні Діабло»',
			description: 'Пікантна салямі, моцарела, томати сан-марцано, халапеньйо',
			basePrice: 275,
			category: 'pizza',
			imageEmoji: '🍕',
			modifiers: [
				{ id: 'jalapeno', name: 'Екстра халапеньйо', price: 25 },
				{ id: 'extra_cheese', name: 'Подвійний сир', price: 45 }
			]
		},
		{
			id: 'burger_1',
			name: 'Бургер «Black Angus»',
			description: 'Соковита яловича котлета, чедер, карамелізована цибуля, соус BBQ',
			basePrice: 240,
			category: 'burger',
			imageEmoji: '🍔',
			modifiers: [
				{ id: 'bacon', name: 'Хрусткий бекон', price: 35 },
				{ id: 'patty', name: 'Додаткова котлета', price: 85 }
			]
		},
		{
			id: 'snack_1',
			name: 'Картопля фрі з соусом',
			description: 'Хрустка картопля з сіллю та фірмовим сирним соусом',
			basePrice: 95,
			category: 'snack',
			imageEmoji: '🍟',
			modifiers: [{ id: 'extra_sauce', name: 'Додатковий соус', price: 20 }]
		},
		{
			id: 'drink_1',
			name: 'Лимонад цитрусовий 0.5л',
			description: 'Свіжий апельсин, лимон, м’ята, газована вода',
			basePrice: 65,
			category: 'drink',
			imageEmoji: '🥤',
			modifiers: []
		}
	];

	let cart = $state<Record<string, { qty: number; selectedModifiers: string[] }>>({
		pizza_1: { qty: 1, selectedModifiers: ['extra_cheese'] },
		drink_1: { qty: 1, selectedModifiers: [] }
	});

	let deliveryType = $state<'delivery' | 'takeout'>('delivery');
	let address = $state('вул. Хрещатик, 24, кв. 12');
	let phone = $state('+380 67 333 44 55');
	let deliveryTime = $state<'asap' | 'scheduled'>('asap');

	function updateQty(id: string, delta: number) {
		const current = cart[id]?.qty || 0;
		const next = current + delta;
		if (next <= 0) {
			const copy = { ...cart };
			delete copy[id];
			cart = copy;
		} else {
			cart = {
				...cart,
				[id]: {
					qty: next,
					selectedModifiers: cart[id]?.selectedModifiers || []
				}
			};
		}
	}

	function toggleModifier(itemId: string, modId: string) {
		if (!cart[itemId]) return;
		const currentMods = cart[itemId].selectedModifiers;
		const exists = currentMods.includes(modId);
		cart = {
			...cart,
			[itemId]: {
				...cart[itemId],
				selectedModifiers: exists
					? currentMods.filter((m) => m !== modId)
					: [...currentMods, modId]
			}
		};
	}

	const subtotal = $derived.by(() => {
		let sum = 0;
		for (const [id, itemCart] of Object.entries(cart)) {
			const item = menuItems.find((m) => m.id === id);
			if (!item) continue;
			let itemPrice = item.basePrice;
			for (const modId of itemCart.selectedModifiers) {
				const mod = item.modifiers.find((m) => m.id === modId);
				if (mod) itemPrice += mod.price;
			}
			sum += itemPrice * itemCart.qty;
		}
		return sum;
	});

	const deliveryFee = $derived(deliveryType === 'delivery' ? (subtotal > 500 ? 0 : 50) : 0);
	const takeoutDiscount = $derived(deliveryType === 'takeout' ? Math.round(subtotal * 0.1) : 0);
	const total = $derived(Math.max(0, subtotal + deliveryFee - takeoutDiscount));

	function handlePay() {
		onPay(total > 0 ? total : 290);
	}
</script>

<div class="food-checkout">
	<!-- Delivery or Takeout Selector -->
	<div class="delivery-tabs">
		<button
			type="button"
			class="del-tab"
			class:active={deliveryType === 'delivery'}
			onclick={() => (deliveryType = 'delivery')}
		>
			<Truck size={15} />
			<span>Доставка кур’єром</span>
		</button>
		<button
			type="button"
			class="del-tab"
			class:active={deliveryType === 'takeout'}
			onclick={() => (deliveryType = 'takeout')}
		>
			<ShoppingBag size={15} />
			<span>Самовивіз (-10%)</span>
		</button>
	</div>

	<!-- Menu catalog -->
	<div class="section-title">
		<Utensils size={14} class="text-orange-500" />
		<strong>Меню ресторану:</strong>
	</div>

	<div class="menu-list">
		{#each menuItems as item (item.id)}
			{@const cartItem = cart[item.id]}
			<div class="menu-card" class:in-cart={Boolean(cartItem && cartItem.qty > 0)}>
				<div class="item-head">
					<span class="item-icon">{item.imageEmoji}</span>
					<div class="item-meta">
						<strong>{item.name}</strong>
						<p>{item.description}</p>
					</div>
					<span class="price">{item.basePrice} ₴</span>
				</div>

				<!-- Modifiers if in cart -->
				{#if cartItem && cartItem.qty > 0 && item.modifiers.length > 0}
					<div class="modifiers-row">
						{#each item.modifiers as mod (mod.id)}
							{@const selected = cartItem.selectedModifiers.includes(mod.id)}
							<button
								type="button"
								class="mod-tag"
								class:selected
								onclick={() => toggleModifier(item.id, mod.id)}
							>
								{selected ? '✓ ' : '+ '}
								{mod.name} (+{mod.price} ₴)
							</button>
						{/each}
					</div>
				{/if}

				<div class="item-actions">
					{#if !cartItem || cartItem.qty === 0}
						<button
							type="button"
							class="btn-add"
							onclick={() => updateQty(item.id, 1)}
						>
							<Plus size={14} /> Додати
						</button>
					{:else}
						<div class="counter">
							<button type="button" onclick={() => updateQty(item.id, -1)} aria-label="Зменшити">
								<Minus size={14} />
							</button>
							<span>{cartItem.qty}</span>
							<button type="button" onclick={() => updateQty(item.id, 1)} aria-label="Збільшити">
								<Plus size={14} />
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Delivery Details -->
	{#if deliveryType === 'delivery'}
		<div class="delivery-card">
			<label class="input-row">
				<span class="lbl"><MapPin size={13} /> Адреса доставки:</span>
				<input type="text" bind:value={address} placeholder="Вулиця, будинок, квартира" />
			</label>
			<label class="input-row">
				<span class="lbl">Телефон отримувача:</span>
				<input type="text" bind:value={phone} placeholder="+380..." />
			</label>
			<div class="time-row">
				<span class="lbl"><Clock size={13} /> Час доставки:</span>
				<div class="time-chips">
					<button
						type="button"
						class:active={deliveryTime === 'asap'}
						onclick={() => (deliveryTime = 'asap')}
					>
						Якнайшвидше (~35-45 хв)
					</button>
					<button
						type="button"
						class:active={deliveryTime === 'scheduled'}
						onclick={() => (deliveryTime = 'scheduled')}
					>
						На 19:30
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="takeout-card">
			<p>📍 <strong>Адреса закладу:</strong> вул. Володимирська, 14 (Київ)</p>
			<small>Готовність замовлення: через 20 хвилин</small>
		</div>
	{/if}

	<!-- Summary & Checkout CTA -->
	<div class="summary-box">
		<div class="sum-line">
			<span>Страви:</span>
			<strong>{subtotal} ₴</strong>
		</div>
		{#if deliveryType === 'delivery'}
			<div class="sum-line">
				<span>Доставка:</span>
				<strong>{deliveryFee === 0 ? 'Безкоштовно' : `${deliveryFee} ₴`}</strong>
			</div>
		{:else if takeoutDiscount > 0}
			<div class="sum-line text-emerald-600">
				<span>Знижка за самовивіз (10%):</span>
				<strong>−{takeoutDiscount} ₴</strong>
			</div>
		{/if}
		<div class="sum-line total">
			<span>До сплати:</span>
			<strong>{total} ₴</strong>
		</div>
	</div>

	<button type="button" class="btn-checkout" onclick={handlePay}>
		Оформити замовлення • {total} ₴
	</button>
</div>

<style>
	.food-checkout {
		padding: 12px 14px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.delivery-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		background: #f4f4f5;
		padding: 3px;
		border-radius: 10px;
	}
	.del-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 4px;
		font-size: 11px;
		font-weight: 700;
		color: #71717a;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.del-tab.active {
		background: #ffffff;
		color: #18181b;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #27272a;
	}
	.menu-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.menu-card {
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		transition: border-color 0.15s;
	}
	.menu-card.in-cart {
		border-color: #f97316;
		background: #fffbf7;
	}
	.item-head {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.item-icon {
		font-size: 22px;
		line-height: 1;
	}
	.item-meta {
		flex: 1;
		min-width: 0;
	}
	.item-meta strong {
		display: block;
		font-size: 12px;
		color: #18181b;
	}
	.item-meta p {
		font-size: 10px;
		color: #71717a;
		margin-top: 1px;
		line-height: 1.3;
	}
	.price {
		font-size: 12px;
		font-weight: 800;
		color: #ea580c;
		white-space: nowrap;
	}
	.modifiers-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding-top: 4px;
		border-top: 1px dashed #f4f4f5;
	}
	.mod-tag {
		background: #f4f4f5;
		border: 1px solid #e4e4e7;
		border-radius: 6px;
		padding: 3px 6px;
		font-size: 9px;
		font-weight: 600;
		color: #52525b;
		cursor: pointer;
	}
	.mod-tag.selected {
		background: #ffedd5;
		border-color: #fdba74;
		color: #c2410c;
	}
	.item-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 2px;
	}
	.btn-add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: #fff7ed;
		border: 1px solid #fed7aa;
		color: #ea580c;
		font-size: 11px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 6px;
		cursor: pointer;
	}
	.counter {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #ea580c;
		color: #ffffff;
		border-radius: 6px;
		padding: 2px 6px;
	}
	.counter button {
		background: transparent;
		border: none;
		color: #ffffff;
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 2px;
	}
	.counter span {
		font-size: 11px;
		font-weight: 800;
		min-width: 14px;
		text-align: center;
	}
	.delivery-card,
	.takeout-card {
		background: #fafafa;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.input-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lbl {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 700;
		color: #52525b;
	}
	.input-row input {
		background: #ffffff;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		padding: 5px 8px;
		font-size: 11px;
		color: #18181b;
		outline: none;
	}
	.time-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.time-chips {
		display: flex;
		gap: 6px;
		margin-top: 2px;
	}
	.time-chips button {
		flex: 1;
		padding: 5px;
		font-size: 10px;
		font-weight: 600;
		background: #ffffff;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		cursor: pointer;
		color: #52525b;
	}
	.time-chips button.active {
		border-color: #ea580c;
		background: #fff7ed;
		color: #c2410c;
		font-weight: 700;
	}
	.takeout-card p {
		font-size: 11px;
		color: #27272a;
	}
	.takeout-card small {
		font-size: 10px;
		color: #16a34a;
		font-weight: 600;
	}
	.summary-box {
		background: #fafafa;
		border-radius: 8px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sum-line {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #52525b;
	}
	.sum-line.total {
		border-top: 1px solid #e4e4e7;
		padding-top: 4px;
		margin-top: 2px;
		font-size: 13px;
		font-weight: 800;
		color: #18181b;
	}
	.btn-checkout {
		width: 100%;
		background: #ea580c;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 11px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(234, 88, 12, 0.3);
	}
	.btn-checkout:hover {
		background: #c2410c;
	}
</style>
