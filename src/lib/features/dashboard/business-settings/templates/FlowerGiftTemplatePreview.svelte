<script lang="ts">
	import {
		Calendar,
		Check,
		Clock,
		Gift,
		Heart,
		MapPin,
		Sparkles
	} from '@lucide/svelte';

	let {
		onPay,
		scenario = 'vertical_flowers'
	}: {
		onPay: (amount: number) => void;
		scenario?: string;
	} = $props();

	type ProductItem = {
		id: string;
		name: string;
		description: string;
		basePrice: number;
		icon: string;
	};

	const products: ProductItem[] = scenario === 'vertical_gifts' ? [
		{ id: 'g_1', name: 'Бокс «Premium Relax»', description: 'Аромасвічка, натуральний мед, чай, шовкова маска', basePrice: 1150, icon: '🎁' },
		{ id: 'g_2', name: 'Бокс «Sweet Delight»', description: 'Бельгійський шоколад, макаруни, горіхи в карамелі', basePrice: 850, icon: '🍫' },
		{ id: 'g_3', name: 'Бокс «Gentleman Set»', description: 'Шкіряний кардхолдер, кава, крафтовий шоколад', basePrice: 1400, icon: '💼' }
	] : scenario === 'vertical_print' ? [
		{ id: 'pr_1', name: 'Фірмові футболки з принтом (від 5 шт)', description: 'Преміум бавовна 100%, стійкий DTF друк', basePrice: 850, icon: '👕' },
		{ id: 'pr_2', name: 'Візитки Touch Cover (100 шт)', description: 'Оксамитовий папір + шовкотрафарет / тиснення', basePrice: 650, icon: '💳' },
		{ id: 'pr_3', name: 'Брендовані горнятка (від 10 шт)', description: 'Кераміка, сублімаційний повноколірний друк', basePrice: 950, icon: '☕' }
	] : [
		{ id: 'fl_1', name: 'Букет «Ніжний світанок»', description: 'Півонії Сара Бернар, біла еустома, евкаліпт', basePrice: 950, icon: '🌸' },
		{ id: 'fl_2', name: '25 червоних троянд Grand Prix', description: 'Класичні еквадорські троянди 60 см у крафті', basePrice: 1250, icon: '🌹' },
		{ id: 'fl_3', name: 'Сезонний квітковий мікс у капелюшній коробці', description: 'Гортензія, кущова півонієподібна троянда', basePrice: 750, icon: '💐' }
	];

	let selectedProductId = $state(products[0].id);
	let selectedSize = $state<'standard' | 'large' | 'premium'>('standard');
	let addPostcard = $state(true);
	let postcardText = $state('З днем народження, найкраща у світі! Нехай твої очі сяють від щастя! ❤️');
	let isSurprise = $state(true);
	let deliveryDate = $state('Сьогодні (до 19:00)');
	let deliveryWindow = $state('16:00 - 19:00');
	let recipientAddress = $state('вул. Шовковична, 10, кв. 44');
	let recipientPhone = $state('+380 99 777 88 99');

	const selectedProduct = $derived(products.find((p) => p.id === selectedProductId) ?? products[0]);

	const sizeModifier = $derived(
		selectedSize === 'premium' ? 1.75 : selectedSize === 'large' ? 1.35 : 1.0
	);

	const productPrice = $derived(Math.round(selectedProduct.basePrice * sizeModifier));
	const deliveryFee = 100;
	const total = $derived(productPrice + deliveryFee);

	function handlePay() {
		onPay(total);
	}
</script>

<div class="flower-checkout">
	<!-- Heading / Catalog -->
	<div class="section-title">
		<Sparkles size={14} class="text-pink-500" />
		<strong>{scenario === 'vertical_gifts' ? 'Оберіть подарунковий набір:' : scenario === 'vertical_print' ? 'Оберіть продукцію для друку:' : 'Оберіть авторський букет:'}</strong>
	</div>

	<div class="product-cards">
		{#each products as p (p.id)}
			<button
				type="button"
				class="prod-card"
				class:selected={p.id === selectedProductId}
				onclick={() => (selectedProductId = p.id)}
			>
				<span class="prod-icon">{p.icon}</span>
				<div class="prod-info">
					<strong>{p.name}</strong>
					<p>{p.description}</p>
				</div>
				<span class="prod-price">{p.basePrice} ₴</span>
			</button>
		{/each}
	</div>

	<!-- Size / Format Selector -->
	<div class="size-section">
		<span class="sec-label">Розмір / формат композиції:</span>
		<div class="size-pills">
			<button
				type="button"
				class:active={selectedSize === 'standard'}
				onclick={() => (selectedSize = 'standard')}
			>
				<strong>S</strong>
				<span>Стандарт</span>
			</button>
			<button
				type="button"
				class:active={selectedSize === 'large'}
				onclick={() => (selectedSize = 'large')}
			>
				<strong>M</strong>
				<span>Пишний (+35%)</span>
			</button>
			<button
				type="button"
				class:active={selectedSize === 'premium'}
				onclick={() => (selectedSize = 'premium')}
			>
				<strong>L</strong>
				<span>VIP Преміум (+75%)</span>
			</button>
		</div>
	</div>

	<!-- Greeting Postcard -->
	<div class="postcard-box">
		<label class="postcard-toggle">
			<input type="checkbox" bind:checked={addPostcard} />
			<div>
				<div class="flex items-center gap-1.5">
					<Gift size={13} class="text-pink-600" />
					<strong>Безкоштовна фірмова листівка</strong>
				</div>
				<small>Флорист підпише від руки перед відправкою</small>
			</div>
		</label>

		{#if addPostcard}
			<textarea
				bind:value={postcardText}
				placeholder="Напишіть теплий текст для отримувача..."
				rows="2"
				class="postcard-input"
			></textarea>
		{/if}
	</div>

	<!-- Delivery Window & Surprise Mode -->
	<div class="delivery-details">
		<div class="time-select-row">
			<label class="field-half">
				<span class="fl-lbl"><Calendar size={12} /> Дата доставки:</span>
				<select bind:value={deliveryDate}>
					<option value="Сьогодні (до 19:00)">Сьогодні</option>
					<option value="Завтра">Завтра</option>
					<option value="Післязавтра">Післязавтра</option>
				</select>
			</label>
			<label class="field-half">
				<span class="fl-lbl"><Clock size={12} /> Час вручення:</span>
				<select bind:value={deliveryWindow}>
					<option value="10:00 - 13:00">10:00 - 13:00</option>
					<option value="13:00 - 16:00">13:00 - 16:00</option>
					<option value="16:00 - 19:00">16:00 - 19:00</option>
					<option value="19:00 - 22:00">19:00 - 22:00</option>
				</select>
			</label>
		</div>

		<label class="fl-input">
			<span class="fl-lbl"><MapPin size={12} /> Адреса отримувача:</span>
			<input type="text" bind:value={recipientAddress} placeholder="Місто, вулиця, під'їзд" />
		</label>

		<label class="fl-input">
			<span class="fl-lbl">Телефон отримувача:</span>
			<input type="text" bind:value={recipientPhone} placeholder="+380..." />
		</label>

		<label class="surprise-toggle">
			<input type="checkbox" bind:checked={isSurprise} />
			<span>🤫 <strong>Доставка-сюрприз</strong> (не повідомляти що це квіти до вручення)</span>
		</label>
	</div>

	<!-- Price Summary -->
	<div class="summary-box">
		<div class="sum-row">
			<span>Букет ({selectedSize.toUpperCase()}):</span>
			<strong>{productPrice} ₴</strong>
		</div>
		<div class="sum-row">
			<span>Кур’єрська доставка:</span>
			<strong>{deliveryFee} ₴</strong>
		</div>
		<div class="sum-row total">
			<span>До сплати:</span>
			<strong>{total} ₴</strong>
		</div>
	</div>

	<button type="button" class="btn-pay" onclick={handlePay}>
		Замовити доставку • {total} ₴
	</button>
</div>

<style>
	.flower-checkout {
		padding: 12px 14px 20px;
		display: flex;
		flex-direction: column;
		gap: 11px;
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #18181b;
	}
	.product-cards {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.prod-card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #ffffff;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 9px 12px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}
	.prod-card.selected {
		border-color: #ec4899;
		background: #fdf2f8;
	}
	.prod-icon {
		font-size: 24px;
		line-height: 1;
	}
	.prod-info {
		flex: 1;
		min-width: 0;
	}
	.prod-info strong {
		display: block;
		font-size: 11px;
		color: #18181b;
	}
	.prod-info p {
		font-size: 10px;
		color: #71717a;
		line-height: 1.3;
		margin-top: 1px;
	}
	.prod-price {
		font-size: 12px;
		font-weight: 800;
		color: #db2777;
		white-space: nowrap;
	}
	.size-section {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.sec-label {
		font-size: 10px;
		font-weight: 700;
		color: #52525b;
	}
	.size-pills {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
	}
	.size-pills button {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 2px;
		border-radius: 8px;
		border: 1px solid #e4e4e7;
		background: #ffffff;
		cursor: pointer;
	}
	.size-pills button.active {
		border-color: #db2777;
		background: #fdf2f8;
		color: #be185d;
	}
	.size-pills button strong {
		font-size: 13px;
	}
	.size-pills button span {
		font-size: 9px;
		color: #71717a;
	}
	.size-pills button.active span {
		color: #be185d;
		font-weight: 600;
	}
	.postcard-box {
		background: #fff1f2;
		border: 1px solid #fecdd3;
		border-radius: 10px;
		padding: 9px 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.postcard-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.postcard-toggle strong {
		display: block;
		font-size: 11px;
		color: #9f1239;
	}
	.postcard-toggle small {
		font-size: 9px;
		color: #be123c;
	}
	.postcard-input {
		background: #ffffff;
		border: 1px solid #fda4af;
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 10px;
		color: #18181b;
		resize: none;
		outline: none;
	}
	.delivery-details {
		background: #fafafa;
		border: 1px solid #e4e4e7;
		border-radius: 10px;
		padding: 9px 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.time-select-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.field-half {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.fl-lbl {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 9px;
		font-weight: 700;
		color: #52525b;
	}
	.field-half select,
	.fl-input input {
		background: #ffffff;
		border: 1px solid #d4d4d8;
		border-radius: 6px;
		padding: 5px 6px;
		font-size: 10px;
		color: #18181b;
		outline: none;
	}
	.fl-input {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.surprise-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: #3f3f46;
		cursor: pointer;
		padding-top: 3px;
	}
	.summary-box {
		background: #fafafa;
		border-radius: 8px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sum-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #52525b;
	}
	.sum-row.total {
		border-top: 1px solid #e4e4e7;
		padding-top: 4px;
		margin-top: 2px;
		font-size: 13px;
		font-weight: 800;
		color: #18181b;
	}
	.btn-pay {
		width: 100%;
		background: #db2777;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 11px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(219, 39, 119, 0.3);
	}
	.btn-pay:hover {
		background: #be185d;
	}
</style>
