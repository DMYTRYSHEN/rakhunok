<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		Trash2,
		Sparkles,
		Store,
		Send,
		Truck,
		CreditCard,
		ShieldCheck,
		Gift,
		FileCode,
		Layers,
		AlertTriangle
	} from '@lucide/svelte';
	import type {
		GiftsFlowData,
		GiftsProductBase,
		GiftsPersonalizationOption,
		GiftsPackagingOption,
		GiftsPickupPoint
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<GiftsFlowData>;
	} = $props();

	const defaultData: GiftsFlowData = {
		storeName: 'Майстерня Подарунків Wood & Craft',
		tagline: 'Індивідуальні подарунки, персоналізація та брендування виробів',
		description: 'Лазерне гравіювання, тиснення та подарункові набори ручної роботи',
		contacts: {
			phone: '+380 67 444 22 11',
			telegram: '@gift_craft_bot',
			instagram: '@wood_craft_gifts',
			address: 'м. Київ, вул. Воздвиженська, 21'
		},
		modes: {
			personalizedEnabled: true,
			readyGiftEnabled: true,
			customIdeaEnabled: true,
			directInvoiceEnabled: true,
			personalizedButtonText: 'Персоналізувати',
			readyGiftButtonText: 'Готові подарунки',
			customIdeaButtonText: 'Власна ідея',
			directInvoiceButtonText: 'Оплатити рахунок'
		},
		products: [
			{
				id: 'notebook',
				name: 'Блокнот з еко-шкіри',
				description: 'Щільний папір у крапку 100 г/м², закладка, кишенька для дрібниць та резинка-фіксатор',
				basePrice: 450,
				materials: ['Італійська еко-шкіра'],
				colors: [
					{ id: 'black', name: 'Чорний графіт', hex: '#222222' },
					{ id: 'emerald', name: 'Смарагдовий', hex: '#1b4d3e' },
					{ id: 'cognac', name: 'Коньячний', hex: '#9e472a' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			},
			{
				id: 'thermo_cup',
				name: 'Термочашка 450 мл',
				description: 'Подвійні вакуумні стінки, герметичний клапан, тримає тепло до 8 годин',
				basePrice: 550,
				materials: ['Нержавіюча харчова сталь 304'],
				colors: [
					{ id: 'matte_black', name: 'Матовий чорний', hex: '#1a1a1a' },
					{ id: 'white', name: 'Перлинний білий', hex: '#f7f7f7' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			},
			{
				id: 'hoodie',
				name: 'Худі Oversize Unisex',
				description: 'Преміум тринитка на флісі 320 г/м², глибокий подвійний капюшон',
				basePrice: 1200,
				sizes: ['S', 'M', 'L', 'XL'],
				colors: [
					{ id: 'charcoal', name: 'Антрацит', hex: '#333333' },
					{ id: 'beige', name: 'Бежевий пісок', hex: '#d8c2aa' }
				],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			}
		],
		personalization: [
			{
				id: 'engraving',
				name: 'Іменне нанесення (гравіювання / тиснення)',
				pricePerItem: 120,
				maxChars: 60,
				fonts: ['Класичний Serif', 'Мінімалістичний Sans', 'Каліграфічний Script', 'Сучасний Моно'],
				placements: ['По центру обкладинки', 'Правий нижній кутик', 'По центру внизу']
			},
			{
				id: 'color_print',
				name: 'Кольоровий стійкий друк',
				pricePerItem: 180,
				maxChars: 100,
				fonts: ['Bold Modern', 'Elegant Script', 'Clean Sans'],
				placements: ['Фронтальна частина', 'Широке нанесення']
			}
		],
		packaging: [
			{
				id: 'box',
				name: 'Подарункова коробка зі стрічкою',
				pricePerItem: 80,
				description: 'Цупкий крафтовий картон, паперовий наповнювач та атласна стрічка',
				icon: '🎁'
			},
			{
				id: 'wooden_box',
				name: 'Дерев’яний подарунковий бокс',
				pricePerItem: 180,
				description: 'Масив вільхи з магнітним замком та фірмовим гравіюванням',
				icon: '🪵'
			},
			{
				id: 'none',
				name: 'Без подарункового пакування',
				pricePerItem: 0,
				description: 'Транспортувальне еко-пакування',
				icon: '📦'
			}
		],
		mockup: {
			requireMockupForPersonalized: true,
			mockupFee: 300,
			allowSharedMockupForIdenticalItems: true,
			differentDesignsRequireManualQuote: true,
			leadTimeDays: 3
		},
		delivery: {
			allowPickup: true,
			allowDelivery: true,
			pickupPoints: [
				{
					id: 'showroom_kyiv',
					name: 'Шоурум & Майстерня Wood & Craft',
					address: 'м. Київ, вул. Воздвиженська, 21',
					workingHours: 'Пн–Сб: 10:00 – 19:00'
				}
			],
			deliveryFee: 150,
			freeDeliveryThreshold: 3000,
			deliveryTimeNotice: '1-2 дні Новою Поштою або кур’єром'
		},
		approval: {
			autoApprovalEnabled: true,
			requireManualForCustomFiles: true,
			requireManualForTightDeadlines: true,
			telegramChat: '@gift_craft_manager',
			responseTimeNotice: 'до 15 хвилин'
		},
		payment: {
			depositType: 'percent',
			depositValue: 50,
			allowRemainingOnDelivery: true
		}
	};

	let data = $state<GiftsFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts || {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes || {}) },
		products: flowData?.products && flowData.products.length > 0 ? flowData.products : defaultData.products,
		personalization: flowData?.personalization && flowData.personalization.length > 0 ? flowData.personalization : defaultData.personalization,
		packaging: flowData?.packaging && flowData.packaging.length > 0 ? flowData.packaging : defaultData.packaging,
		mockup: { ...defaultData.mockup, ...(flowData?.mockup || {}) },
		delivery: {
			...defaultData.delivery,
			...(flowData?.delivery || {}),
			pickupPoints: flowData?.delivery?.pickupPoints || defaultData.delivery.pickupPoints
		},
		approval: { ...defaultData.approval, ...(flowData?.approval || {}) },
		payment: { ...defaultData.payment, ...(flowData?.payment || {}) }
	});

	$effect(() => {
		flowData = $state.snapshot(data);
	});

	let activeTab = $state<'products' | 'personalization' | 'packaging' | 'mockup' | 'delivery' | 'approval'>('products');

	// Product management
	function addProduct() {
		const newId = `prod_${Date.now()}`;
		data.products = [
			...data.products,
			{
				id: newId,
				name: 'Новий виріб',
				description: 'Опис матеріалу та характеристик',
				basePrice: 500,
				materials: ['Дерево / Шкіра'],
				colors: [{ id: 'natural', name: 'Натуральний', hex: '#d2b48c' }],
				allowCustomText: true,
				allowFileUpload: true,
				inStock: true
			}
		];
	}

	function removeProduct(id: string) {
		if (data.products.length <= 1) return;
		data.products = data.products.filter((p) => p.id !== id);
	}

	function addColor(productIndex: number) {
		const colors = data.products[productIndex].colors || [];
		data.products[productIndex].colors = [
			...colors,
			{ id: `c_${Date.now()}`, name: 'Новий колір', hex: '#333333' }
		];
	}

	function removeColor(productIndex: number, colorIndex: number) {
		const colors = data.products[productIndex].colors || [];
		if (colors.length <= 1) return;
		data.products[productIndex].colors = colors.filter((_, idx) => idx !== colorIndex);
	}

	// Personalization management
	function addPersonalizationOption() {
		const newId = `pers_${Date.now()}`;
		data.personalization = [
			...data.personalization,
			{
				id: newId,
				name: 'Нове нанесення',
				pricePerItem: 150,
				maxChars: 50,
				fonts: ['Serif', 'Sans'],
				placements: ['По центру']
			}
		];
	}

	function removePersonalizationOption(id: string) {
		if (data.personalization.length <= 1) return;
		data.personalization = data.personalization.filter((p) => p.id !== id);
	}

	// Packaging management
	function addPackagingOption() {
		const newId = `pack_${Date.now()}`;
		data.packaging = [
			...data.packaging,
			{
				id: newId,
				name: 'Нове пакування',
				pricePerItem: 100,
				description: 'Опис подарункового пакування',
				icon: '🎁'
			}
		];
	}

	function removePackagingOption(id: string) {
		if (data.packaging.length <= 1) return;
		data.packaging = data.packaging.filter((p) => p.id !== id);
	}

	// Delivery points
	function addPickupPoint() {
		const newId = `point_${Date.now()}`;
		data.delivery.pickupPoints = [
			...data.delivery.pickupPoints,
			{
				id: newId,
				name: 'Нова точка видачі',
				address: 'м. Київ, вул...',
				workingHours: 'Пн-Пт 10:00 - 19:00'
			}
		];
	}

	function removePickupPoint(id: string) {
		if (data.delivery.pickupPoints.length <= 1) return;
		data.delivery.pickupPoints = data.delivery.pickupPoints.filter((p) => p.id !== id);
	}
</script>

<div class="gifts-editor">
	<header class="editor-header">
		<div class="title-wrap">
			<div class="icon-badge">🎁</div>
			<div>
				<h3>Конфігуратор Сценарію «Подарунки / Індивідуальне Замовлення»</h3>
				<p class="subtitle">
					Поодиничні націнки, разове розроблення спільного макета, аванс 50% та обов’язкове погодження макета перед виготовленням
				</p>
			</div>
		</div>
	</header>

	<!-- Tabs Navigation -->
	<nav class="nav-tabs">
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'products'}
			onclick={() => (activeTab = 'products')}
		>
			<Gift size={16} />
			<span>Товари-основи ({data.products.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'personalization'}
			onclick={() => (activeTab = 'personalization')}
		>
			<Sparkles size={16} />
			<span>Персоналізація</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'packaging'}
			onclick={() => (activeTab = 'packaging')}
		>
			<Layers size={16} />
			<span>Пакування ({data.packaging.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'mockup'}
			onclick={() => (activeTab = 'mockup')}
		>
			<FileCode size={16} />
			<span>Макет і Виробництво</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'delivery'}
			onclick={() => (activeTab = 'delivery')}
		>
			<Truck size={16} />
			<span>Отримання & Доставка</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'approval'}
			onclick={() => (activeTab = 'approval')}
		>
			<CreditCard size={16} />
			<span>Аванс & Погодження</span>
		</button>
	</nav>

	<div class="tab-content">
		<!-- TAB 1: PRODUCTS -->
		{#if activeTab === 'products'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Товари та основи для персоналізації</h4>
						<p class="muted">
							Вироби, на які наноситься дизайн (блокноти, термокружки, худі тощо). Базова ціна діє за одиницю товару.
						</p>
					</div>
					<button type="button" class="btn-primary-sm" onclick={addProduct}>
						<Plus size={15} /> Додати виріб
					</button>
				</div>

				<div class="products-list">
					{#each data.products as prod, pIdx (prod.id)}
						<div class="item-card">
							<div class="item-card-header">
								<div class="flex-row">
									<input
										type="text"
										class="input-title"
										bind:value={prod.name}
										placeholder="Назва товару"
									/>
									<label class="stock-toggle">
										<input type="checkbox" bind:checked={prod.inStock} />
										<span>В наявності</span>
									</label>
								</div>
								<button
									type="button"
									class="btn-icon danger"
									aria-label="Видалити"
									onclick={() => removeProduct(prod.id)}
									disabled={data.products.length <= 1}
								>
									<Trash2 size={15} />
								</button>
							</div>

							<div class="grid-2">
								<div>
									<label>
										<span class="lbl">Опис товару</span>
										<textarea
											class="input-textarea"
											rows="2"
											bind:value={prod.description}
											placeholder="Матеріал, характеристики, особливості"
										></textarea>
									</label>
								</div>

								<div class="grid-2 inner-grid">
									<div>
										<label>
											<span class="lbl">Базова ціна за шт (₴)</span>
											<input
												type="number"
												min="0"
												step="10"
												class="input-control"
												bind:value={prod.basePrice}
											/>
										</label>
									</div>
									<div class="checkbox-group">
										<label class="checkbox-label">
											<input type="checkbox" bind:checked={prod.allowCustomText} />
											<span>Дозволити текст / напис</span>
										</label>
										<label class="checkbox-label">
											<input type="checkbox" bind:checked={prod.allowFileUpload} />
											<span>Дозволити векторний файл</span>
										</label>
									</div>
								</div>
							</div>

							<!-- Colors management -->
							<div class="colors-section">
								<div class="colors-header">
									<span class="lbl">Доступні кольори / відтінки:</span>
									<button type="button" class="btn-link" onclick={() => addColor(pIdx)}>
										+ Додати колір
									</button>
								</div>
								<div class="color-pills">
									{#if prod.colors}
										{#each prod.colors as col, cIdx}
											<div class="color-pill">
												<input
													type="color"
													class="color-picker"
													bind:value={col.hex}
													aria-label="Колір"
												/>
												<input
													type="text"
													class="color-name-input"
													bind:value={col.name}
													placeholder="Назва кольору"
												/>
												{#if prod.colors.length > 1}
													<button
														type="button"
														class="color-del-btn"
														onclick={() => removeColor(pIdx, cIdx)}
													>
														×
													</button>
												{/if}
											</div>
										{/each}
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

		<!-- TAB 2: PERSONALIZATION -->
		{:else if activeTab === 'personalization'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Способи нанесення та персоналізації</h4>
						<p class="muted">
							Налаштуйте доплату за кожен виріб (наприклад, +120 грн/од за іменне гравіювання).
						</p>
					</div>
					<button type="button" class="btn-primary-sm" onclick={addPersonalizationOption}>
						<Plus size={15} /> Додати нанесення
					</button>
				</div>

				<div class="callout-info">
					<Sparkles size={18} />
					<div>
						<strong>Поодинична націнка:</strong> Вартість нанесення множиться на кількість виробів
						(наприклад, 2 блокноти × 120 ₴ = 240 ₴). Натомість розроблення макета є разовою послугою
						на все замовлення.
					</div>
				</div>

				<div class="options-list">
					{#each data.personalization as opt (opt.id)}
						<div class="item-card">
							<div class="item-card-header">
								<input
									type="text"
									class="input-title"
									bind:value={opt.name}
									placeholder="Назва методу (наприклад, Лазерне гравіювання)"
								/>
								<button
									type="button"
									class="btn-icon danger"
									aria-label="Видалити"
									onclick={() => removePersonalizationOption(opt.id)}
									disabled={data.personalization.length <= 1}
								>
									<Trash2 size={15} />
								</button>
							</div>

							<div class="grid-3">
								<label>
									<span class="lbl">Доплата за одиницю (₴/шт)</span>
									<input
										type="number"
										min="0"
										step="10"
										class="input-control"
										bind:value={opt.pricePerItem}
									/>
								</label>
								<label>
									<span class="lbl">Макс. кількість символів</span>
									<input
										type="number"
										min="10"
										max="500"
										class="input-control"
										bind:value={opt.maxChars}
									/>
								</label>
								<div>
									<span class="lbl">Позиції нанесення (через кому)</span>
									<input
										type="text"
										class="input-control"
										value={opt.placements.join(', ')}
										onchange={(e) => {
											opt.placements = e.currentTarget.value
												.split(',')
												.map((s) => s.trim())
												.filter(Boolean);
										}}
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

		<!-- TAB 3: PACKAGING -->
		{:else if activeTab === 'packaging'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Подарункове пакування</h4>
						<p class="muted">
							Коробки, дерев’яні бокси та святкове пакування. Оплачується за кожну одиницю виробу.
						</p>
					</div>
					<button type="button" class="btn-primary-sm" onclick={addPackagingOption}>
						<Plus size={15} /> Додати пакування
					</button>
				</div>

				<div class="options-list">
					{#each data.packaging as pack (pack.id)}
						<div class="item-card">
							<div class="item-card-header">
								<div class="flex-row">
									<input
										type="text"
										class="input-icon-sm"
										bind:value={pack.icon}
										placeholder="🎁"
									/>
									<input
										type="text"
										class="input-title"
										bind:value={pack.name}
										placeholder="Назва пакування"
									/>
								</div>
								<button
									type="button"
									class="btn-icon danger"
									aria-label="Видалити"
									onclick={() => removePackagingOption(pack.id)}
									disabled={data.packaging.length <= 1}
								>
									<Trash2 size={15} />
								</button>
							</div>

							<div class="grid-2">
								<label>
									<span class="lbl">Опис пакування</span>
									<input
										type="text"
										class="input-control"
										bind:value={pack.description}
										placeholder="Матеріал, наповнювач, стрічка..."
									/>
								</label>
								<label>
									<span class="lbl">Ціна за одиницю виробу (₴/шт)</span>
									<input
										type="number"
										min="0"
										step="10"
										class="input-control"
										bind:value={pack.pricePerItem}
									/>
								</label>
							</div>
						</div>
					{/each}
				</div>
			</section>

		<!-- TAB 4: MOCKUP & PRODUCTION -->
		{:else if activeTab === 'mockup'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Правила макетування та допуску до виготовлення</h4>
						<p class="muted">
							Ключовий виробничий принцип: оплата авансу сама по собі НЕ дозволяє виготовлення без погодженого макета.
						</p>
					</div>
				</div>

				<div class="callout-warning">
					<AlertTriangle size={18} />
					<div>
						<strong>Контрольне правило безпеки:</strong> Нова версія макета (v2) скасовує погодження
						попередньої версії. Стара кнопка клієнта не може погодити новий файл. Виготовлення дозволене лише
						при статусі «Макет затверджено» та внесенні авансу.
					</div>
				</div>

				<div class="grid-2 form-grid">
					<div class="card-bordered">
						<h5>Розроблення макета</h5>
						<label class="lbl-block">
							<span class="lbl">Вартість розроблення одного спільного макета (₴)</span>
							<span class="hint">Разова доплата на все замовлення (не множиться на кількість виробів)</span>
							<input
								type="number"
								min="0"
								step="50"
								class="input-control"
								bind:value={data.mockup.mockupFee}
							/>
						</label>

						<label class="lbl-block">
							<span class="lbl">Строк виготовлення (робочих днів)</span>
							<input
								type="number"
								min="1"
								max="30"
								class="input-control"
								bind:value={data.mockup.leadTimeDays}
							/>
						</label>
					</div>

					<div class="card-bordered">
						<h5>Політика погодження дизайну</h5>
						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.mockup.requireMockupForPersonalized}
							/>
							<span>Обов’язкове погодження макета перед виготовленням</span>
						</label>

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.mockup.allowSharedMockupForIdenticalItems}
							/>
							<span>Застосовувати один спільний макет для партії однакових виробів</span>
						</label>

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.mockup.differentDesignsRequireManualQuote}
							/>
							<span>Різні імена / різні макети переводять замовлення на ручну оцінку дизайнера</span>
						</label>
					</div>
				</div>
			</section>

		<!-- TAB 5: DELIVERY -->
		{:else if activeTab === 'delivery'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Самовивіз та доставка</h4>
						<p class="muted">
							Точки видачі з шоуруму та кур'єрські тарифи на доставку замовлення.
						</p>
					</div>
				</div>

				<div class="grid-2 form-grid">
					<div class="card-bordered">
						<h5>Тариф доставки</h5>
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={data.delivery.allowDelivery} />
							<span>Дозволити доставку (кур’єр / Нова Пошта)</span>
						</label>

						<label class="lbl-block">
							<span class="lbl">Вартість доставки замовлення (₴)</span>
							<span class="hint">Разова доплата на все замовлення</span>
							<input
								type="number"
								min="0"
								step="10"
								class="input-control"
								bind:value={data.delivery.deliveryFee}
							/>
						</label>

						<label class="lbl-block">
							<span class="lbl">Безкоштовна доставка від суми (₴)</span>
							<input
								type="number"
								min="0"
								step="100"
								class="input-control"
								bind:value={data.delivery.freeDeliveryThreshold}
							/>
						</label>
					</div>

					<div class="card-bordered">
						<div class="flex-between">
							<h5>Точки самовивозу</h5>
							<button type="button" class="btn-link" onclick={addPickupPoint}>
								+ Додати точку
							</button>
						</div>

						<label class="checkbox-label">
							<input type="checkbox" bind:checked={data.delivery.allowPickup} />
							<span>Дозволити самовивіз із майстерні (0 ₴)</span>
						</label>

						{#each data.delivery.pickupPoints as point (point.id)}
							<div class="point-item">
								<div class="flex-between">
									<input
										type="text"
										class="input-control font-bold"
										bind:value={point.name}
										placeholder="Назва точки"
									/>
									<button
										type="button"
										class="btn-icon danger"
										onclick={() => removePickupPoint(point.id)}
										disabled={data.delivery.pickupPoints.length <= 1}
									>
										<Trash2 size={13} />
									</button>
								</div>
								<input
									type="text"
									class="input-control"
									bind:value={point.address}
									placeholder="Адреса"
								/>
								<input
									type="text"
									class="input-control text-sm"
									bind:value={point.workingHours}
									placeholder="Години роботи"
								/>
							</div>
						{/each}
					</div>
				</div>
			</section>

		<!-- TAB 6: APPROVAL & PAYMENT -->
		{:else if activeTab === 'approval'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Умови оплати, аванс та Telegram</h4>
						<p class="muted">
							Налаштування безпечного розрахунку: аванс (за замовчуванням 50%) та правила автопогодження.
						</p>
					</div>
				</div>

				<div class="grid-2 form-grid">
					<div class="card-bordered">
						<h5>Умови оплати</h5>
						<label class="lbl-block">
							<span class="lbl">Тип платежу</span>
							<select class="input-control" bind:value={data.payment.depositType}>
								<option value="percent">Аванс (відсоток від замовлення)</option>
								<option value="full">100% повна передоплата</option>
							</select>
						</label>

						{#if data.payment.depositType === 'percent'}
							<label class="lbl-block">
								<span class="lbl">Розмір авансу (%)</span>
								<input
									type="number"
									min="10"
									max="90"
									step="5"
									class="input-control"
									bind:value={data.payment.depositValue}
								/>
							</label>
						{/if}

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.payment.allowRemainingOnDelivery}
							/>
							<span>Залишок сплачується після виготовлення або при отриманні</span>
						</label>
					</div>

					<div class="card-bordered">
						<h5>Погодження та Telegram</h5>
						<label class="lbl-block">
							<span class="lbl">Telegram-чат / бот для сповіщень</span>
							<input
								type="text"
								class="input-control"
								bind:value={data.approval.telegramChat}
								placeholder="@gift_orders_bot"
							/>
						</label>

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.approval.autoApprovalEnabled}
							/>
							<span>Автопогодження стандартних замовлень (з точною ціною та наявними матеріалами)</span>
						</label>

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.approval.requireManualForCustomFiles}
							/>
							<span>Векторні файли клієнтів завжди перевіряються дизайнером вручну</span>
						</label>

						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.approval.requireManualForTightDeadlines}
							/>
							<span>Термінові замовлення потребують ручного підтвердження майстерні</span>
						</label>
					</div>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.gifts-editor {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.editor-header {
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color, #e5e7eb);
	}

	.title-wrap {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.icon-badge {
		font-size: 1.8rem;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fdf2f8;
		border: 1px solid #fbcfe8;
		border-radius: 10px;
	}

	h3 {
		font-size: 1.15rem;
		font-weight: 700;
		color: #111827;
		margin: 0;
	}

	.subtitle {
		font-size: 0.82rem;
		color: #6b7280;
		margin: 0.2rem 0 0 0;
	}

	.nav-tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.9rem;
		border: none;
		background: transparent;
		font-size: 0.85rem;
		font-weight: 500;
		color: #4b5563;
		border-radius: 6px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.tab-btn.active {
		background: #ec4899;
		color: #ffffff;
		font-weight: 600;
	}

	.section-card {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h4 {
		font-size: 1.05rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.25rem 0;
	}

	h5 {
		font-size: 0.95rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 0.85rem 0;
	}

	.muted {
		font-size: 0.8rem;
		color: #6b7280;
		margin: 0;
	}

	.hint {
		font-size: 0.72rem;
		color: #6b7280;
		margin-bottom: 0.25rem;
		display: block;
	}

	.btn-primary-sm {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.8rem;
		background: #ec4899;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-primary-sm:hover {
		background: #db2777;
	}

	.btn-link {
		background: none;
		border: none;
		color: #ec4899;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
	}

	.btn-link:hover {
		text-decoration: underline;
	}

	.callout-info {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		color: #1e40af;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.callout-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 8px;
		color: #92400e;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.products-list,
	.options-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.item-card {
		border: 1px solid #e5e7eb;
		background: #fafafa;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.item-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.flex-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.input-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #111827;
		padding: 0.35rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: #ffffff;
		flex: 1;
	}

	.input-icon-sm {
		width: 44px;
		text-align: center;
		font-size: 1.1rem;
		padding: 0.35rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: #ffffff;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1px solid #e5e7eb;
		background: #ffffff;
		border-radius: 6px;
		cursor: pointer;
		color: #4b5563;
	}

	.btn-icon.danger:hover:not(:disabled) {
		background: #fef2f2;
		color: #ef4444;
		border-color: #fecaca;
	}

	.btn-icon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.grid-3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 1rem;
	}

	.inner-grid {
		align-items: flex-start;
	}

	.lbl {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: #4b5563;
		margin-bottom: 0.25rem;
	}

	.lbl-block {
		display: block;
		margin-bottom: 0.85rem;
	}

	.input-control {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.85rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: #ffffff;
		color: #111827;
		box-sizing: border-box;
	}

	.input-textarea {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.82rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: #ffffff;
		color: #111827;
		box-sizing: border-box;
		resize: vertical;
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 1.25rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		color: #374151;
		cursor: pointer;
		margin-bottom: 0.4rem;
	}

	.stock-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: #059669;
		cursor: pointer;
		white-space: nowrap;
	}

	.colors-section {
		border-top: 1px dashed #e5e7eb;
		padding-top: 0.75rem;
	}

	.colors-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.color-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.color-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: #ffffff;
		border: 1px solid #d1d5db;
		border-radius: 20px;
		padding: 0.2rem 0.5rem 0.2rem 0.3rem;
	}

	.color-picker {
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		padding: 0;
		background: none;
	}

	.color-name-input {
		font-size: 0.78rem;
		border: none;
		outline: none;
		width: 90px;
		color: #1f2937;
	}

	.color-del-btn {
		border: none;
		background: none;
		color: #9ca3af;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.15rem;
	}

	.color-del-btn:hover {
		color: #ef4444;
	}

	.card-bordered {
		border: 1px solid #e5e7eb;
		background: #fafafa;
		border-radius: 8px;
		padding: 1rem;
	}

	.flex-between {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.point-item {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}

	.font-bold {
		font-weight: 600;
	}

	.text-sm {
		font-size: 0.78rem;
		color: #6b7280;
	}
</style>
