<script lang="ts">
	import {
		Dumbbell,
		Plus,
		Trash2,
		Sparkles,
		ShieldCheck,
		AlertTriangle,
		MapPin,
		Calendar,
		Coins,
		Waves,
		KeyRound,
		QrCode
	} from '@lucide/svelte';
	import type {
		FitnessFlowData,
		FitnessClub,
		FitnessTariff,
		FitnessAddon
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<FitnessFlowData>;
	} = $props();

	const defaultData: FitnessFlowData = {
		clubBrand: 'Pulse Fitness Club',
		tagline: 'Сила, здоровʼя та енергія кожного дня',
		description: 'Сучасний фітнес-простір з басейном, спа-зоною та персональними тренерами',
		contacts: {
			phone: '+380 44 233 44 55',
			telegram: '@pulse_fitness_admin',
			instagram: '@pulse_fit_ua',
			address: 'вул. Спаська, 12, Київ'
		},
		modes: {
			newMembershipEnabled: true,
			renewalEnabled: true,
			addonOnlyEnabled: true,
			receptionPayEnabled: true,
			newMembershipButtonText: 'Оформити новий абонемент',
			renewalButtonText: 'Продовжити мій абонемент',
			addonOnlyButtonText: 'Докупити послуги / тренування',
			receptionPayButtonText: 'Швидка оплата на рецепції'
		},
		clubs: [
			{
				id: 'pulse_podil',
				name: 'Pulse Fitness Podil',
				address: 'вул. Спаська, 12, Київ',
				workingHours: 'Пн-Пт: 07:00 – 22:00, Сб-Нд: 08:00 – 21:00',
				phone: '+380 44 233 44 55',
				amenities: ['Тренажерна зала', 'Басейн 25м', 'Фінська сауна', 'Бокс-зона'],
				availableTariffIds: ['day', 'week', 'month']
			},
			{
				id: 'pulse_pechersk',
				name: 'Pulse Fitness Pechersk',
				address: 'бул. Лесі Українки, 26, Київ',
				workingHours: 'Пн-Нд: 07:00 – 23:00',
				phone: '+380 44 599 88 77',
				amenities: ['Тренажерна зала', 'Зона кросфіту', 'SPA-зона', 'Фіто-бар'],
				availableTariffIds: ['day', 'week', 'month']
			}
		],
		tariffs: [
			{
				id: 'day',
				name: 'Денний візит (Разовий)',
				period: 'day',
				price: 300,
				description: 'Тренажерна зала + душові на 1 день без обмеження часу',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 1,
				allowedHoursNotice: '07:00 – 22:00 у день візиту'
			},
			{
				id: 'week',
				name: 'Тижневий інтенсив',
				period: 'week',
				price: 900,
				description: '7 днів повного доступу до кардіо та силової зони',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 7,
				allowedHoursNotice: '7 календарних днів поспіль'
			},
			{
				id: 'month',
				name: 'Місячний безліміт',
				period: 'month',
				price: 1800,
				description: 'Необмежений доступ у будь-який час, вступний інструктаж тренера',
				includesGym: true,
				includesPool: false,
				includesSauna: false,
				durationDays: 30,
				allowedHoursNotice: '1 календарний місяць, щоденно 07:00 – 22:00',
				badge: 'Найпопулярніший'
			}
		],
		addons: [
			{
				id: 'pool',
				name: 'Доступ до басейну (на строк абонемента)',
				category: 'access',
				price: 600,
				priceModel: 'match_tariff',
				description: 'Доріжки 25м, аква-зона та гідромасаж',
				icon: '🏊‍♂️'
			},
			{
				id: 'locker',
				name: 'Персональна закріплена шафка',
				category: 'resource',
				price: 300,
				priceModel: 'match_tariff',
				description: 'Індивідуальна шафка в роздягальні з електронним замком',
				icon: '🔒',
				totalLockers: 150,
				availableLockers: 14
			},
			{
				id: 'trainings_4',
				name: 'Пакет 4 персональних тренувань',
				category: 'credits',
				price: 2000,
				creditCount: 4,
				priceModel: 'fixed_bundle',
				description: 'Індивідуальні тренування з топ-тренером (500 ₴/сесія)',
				icon: '🥊'
			},
			{
				id: 'towel',
				name: 'Оренда преміум-рушника (разово)',
				category: 'usage',
				price: 50,
				priceModel: 'per_use',
				description: 'Великий махровий рушник на кожне тренування',
				icon: '🧖'
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForLocker: false,
			requireManualForCorporate: true,
			telegramChat: '@pulse_fitness_admin',
			responseTimeNotice: 'Миттєве зарахування та автовидача цифрового QR-абонемента'
		},
		rules: {
			allowFreeze: true,
			maxFreezeDays: 14,
			refundNotice: 'Заморозка до 14 днів безкоштовно. Повернення коштів за правилами клубу.',
			entryMethod: 'qr_reception'
		}
	};

	let data = $state<FitnessFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts || {}) },
		modes: { ...defaultData.modes, ...(flowData?.modes || {}) },
		clubs: flowData?.clubs && flowData.clubs.length > 0 ? flowData.clubs : defaultData.clubs,
		tariffs: flowData?.tariffs && flowData.tariffs.length > 0 ? flowData.tariffs : defaultData.tariffs,
		addons: flowData?.addons && flowData.addons.length > 0 ? flowData.addons : defaultData.addons,
		approval: { ...defaultData.approval, ...(flowData?.approval || {}) },
		rules: { ...defaultData.rules, ...(flowData?.rules || {}) }
	});

	$effect(() => {
		flowData = $state.snapshot(data);
	});

	let activeTab = $state<'tariffs' | 'addons' | 'clubs' | 'rules'>('tariffs');

	// Club management
	function addClub() {
		const newId = `club_${Date.now()}`;
		data.clubs = [
			...data.clubs,
			{
				id: newId,
				name: 'Нова філія Pulse Fitness',
				address: 'м. Київ, вул. Хрещатик, 1',
				workingHours: 'Пн-Нд: 08:00 – 22:00',
				phone: '+380 44 000 00 00',
				amenities: ['Тренажерна зала', 'Кардіо-зона'],
				availableTariffIds: ['day', 'week', 'month']
			}
		];
	}

	function removeClub(id: string) {
		if (data.clubs.length <= 1) return;
		data.clubs = data.clubs.filter((c) => c.id !== id);
	}

	// Addon management
	function addAddon() {
		const newId = `addon_${Date.now()}`;
		data.addons = [
			...data.addons,
			{
				id: newId,
				name: 'Нова послуга / опція',
				category: 'usage',
				price: 200,
				priceModel: 'per_use',
				description: 'Опис додаткової послуги клубу',
				icon: '✨'
			}
		];
	}

	function removeAddon(id: string) {
		if (data.addons.length <= 1) return;
		data.addons = data.addons.filter((a) => a.id !== id);
	}
</script>

<div class="fitness-editor">
	<header class="editor-header">
		<div class="title-wrap">
			<div class="icon-badge">🏋️‍♂️</div>
			<div>
				<h3>Конфігуратор Сценарію «Фітнес-Центр / Абонементи»</h3>
				<p class="subtitle">
					Керування тарифами (300 / 900 / 1800 ₴), додатками (басейн 600 ₴, шафка 300 ₴, 4 тренування 2000 ₴), клубами та автовидачею карток
				</p>
			</div>
		</div>
	</header>

	<!-- Tabs Navigation -->
	<nav class="nav-tabs">
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'tariffs'}
			onclick={() => (activeTab = 'tariffs')}
		>
			<Calendar size={16} />
			<span>Тарифи & Періоди ({data.tariffs.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'addons'}
			onclick={() => (activeTab = 'addons')}
		>
			<Coins size={16} />
			<span>Додаткові послуги ({data.addons.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'clubs'}
			onclick={() => (activeTab = 'clubs')}
		>
			<MapPin size={16} />
			<span>Клуби & Локації ({data.clubs.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'rules'}
			onclick={() => (activeTab = 'rules')}
		>
			<ShieldCheck size={16} />
			<span>Правила & Рецепція</span>
		</button>
	</nav>

	<!-- Tab 1: Tariffs -->
	{#if activeTab === 'tariffs'}
		<section class="tab-content">
			<div class="section-intro">
				<div>
					<h4>Тарифи абонементів</h4>
					<p class="section-desc">
						Базові плани відвідування: Денний (300 ₴), Тижневий (900 ₴) та Місячний (1 800 ₴)
					</p>
				</div>
			</div>

			<div class="items-stack">
				{#each data.tariffs as tariff, idx}
					<div class="card-item">
						<div class="item-header">
							<div class="header-left">
								<span class="period-badge period-{tariff.period}">
									{tariff.period === 'day' ? 'ДЕННИЙ' : tariff.period === 'week' ? 'ТИЖНЕВИЙ' : 'МІСЯЧНИЙ'}
								</span>
								<input
									type="text"
									class="input-control font-bold"
									bind:value={tariff.name}
									placeholder="Назва тарифу"
								/>
							</div>
							<div class="price-wrap">
								<input
									type="number"
									class="input-control w-24 text-right font-bold text-emerald-600"
									bind:value={tariff.price}
									min="0"
									step="50"
								/>
								<span class="currency-tag">₴</span>
							</div>
						</div>

						<div class="grid-3 mt-3">
							<label class="lbl-block">
								<span class="lbl">Термін дії (днів)</span>
								<input
									type="number"
									class="input-control"
									bind:value={tariff.durationDays}
									min="1"
								/>
							</label>
							<label class="lbl-block">
								<span class="lbl">Бейдж (опціонально)</span>
								<input
									type="text"
									class="input-control"
									bind:value={tariff.badge}
									placeholder="Хіт, Найпопулярніший"
								/>
							</label>
							<label class="lbl-block">
								<span class="lbl">Години та умови</span>
								<input
									type="text"
									class="input-control"
									bind:value={tariff.allowedHoursNotice}
									placeholder="07:00 – 22:00"
								/>
							</label>
						</div>

						<div class="mt-3">
							<label class="lbl-block">
								<span class="lbl">Опис тарифу</span>
								<input
									type="text"
									class="input-control"
									bind:value={tariff.description}
									placeholder="Короткий опис для клієнта"
								/>
							</label>
						</div>

						<div class="zones-toggles mt-3">
							<span class="lbl mr-3">Включені зони за замовчуванням:</span>
							<label class="checkbox-inline">
								<input type="checkbox" bind:checked={tariff.includesGym} />
								<span>🏋️ Зал</span>
							</label>
							<label class="checkbox-inline">
								<input type="checkbox" bind:checked={tariff.includesPool} />
								<span>🏊 Басейн</span>
							</label>
							<label class="checkbox-inline">
								<input type="checkbox" bind:checked={tariff.includesSauna} />
								<span>🧖 Сауна</span>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Tab 2: Addons -->
	{#if activeTab === 'addons'}
		<section class="tab-content">
			<div class="section-intro flex-between">
				<div>
					<h4>Додаткові послуги та ресурси</h4>
					<p class="section-desc">
						Опції до абонемента: Басейн (+600 ₴), Закріплена шафка (+300 ₴), 4 персональні тренування (+2 000 ₴), Рушник (+50 ₴)
					</p>
				</div>
				<button type="button" class="btn-primary-sm" onclick={addAddon}>
					<Plus size={15} />
					<span>Додати опцію</span>
				</button>
			</div>

			<div class="items-stack">
				{#each data.addons as addon, idx}
					<div class="card-item">
						<div class="item-header">
							<div class="header-left">
								<input
									type="text"
									class="input-control w-12 text-center text-lg"
									bind:value={addon.icon}
									placeholder="🏷️"
								/>
								<input
									type="text"
									class="input-control font-bold"
									bind:value={addon.name}
									placeholder="Назва послуги"
								/>
							</div>
							<div class="flex items-center gap-2">
								<div class="price-wrap">
									<span class="currency-tag">+</span>
									<input
										type="number"
										class="input-control w-24 text-right font-bold text-emerald-600"
										bind:value={addon.price}
										min="0"
										step="25"
									/>
									<span class="currency-tag">₴</span>
								</div>
								<button
									type="button"
									class="btn-icon danger"
									onclick={() => removeAddon(addon.id)}
									disabled={data.addons.length <= 1}
									title="Видалити опцію"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>

						<div class="grid-3 mt-3">
							<label class="lbl-block">
								<span class="lbl">Категорія послуги</span>
								<select class="input-control" bind:value={addon.category}>
									<option value="access">Зона доступу (Басейн / SPA)</option>
									<option value="resource">Індивідуальний ресурс (Шафка)</option>
									<option value="credits">Пакет тренувань (Кредити)</option>
									<option value="usage">Витратна послуга (Рушник / Смузі)</option>
								</select>
							</label>
							<label class="lbl-block">
								<span class="lbl">Модель ціни</span>
								<select class="input-control" bind:value={addon.priceModel}>
									<option value="match_tariff">На весь строк абонемента</option>
									<option value="fixed_bundle">Фіксований пакет (сесії)</option>
									<option value="per_use">За одне використання</option>
								</select>
							</label>
							{#if addon.category === 'credits'}
								<label class="lbl-block">
									<span class="lbl">Кількість занять (кредитів)</span>
									<input
										type="number"
										class="input-control"
										bind:value={addon.creditCount}
										min="1"
										max="100"
									/>
								</label>
							{:else if addon.category === 'resource'}
								<div class="grid-2">
									<label class="lbl-block">
										<span class="lbl">Всього шафок</span>
										<input
											type="number"
											class="input-control"
											bind:value={addon.totalLockers}
											min="1"
										/>
									</label>
									<label class="lbl-block">
										<span class="lbl">Вільних</span>
										<input
											type="number"
											class="input-control"
											bind:value={addon.availableLockers}
											min="0"
										/>
									</label>
								</div>
							{:else}
								<div>
									<span class="lbl block mb-1">Статус доступності</span>
									<span class="inline-block py-1 px-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded">
										✓ Доступно для замовлення
									</span>
								</div>
							{/if}
						</div>

						<div class="mt-3">
							<label class="lbl-block">
								<span class="lbl">Опис</span>
								<input
									type="text"
									class="input-control"
									bind:value={addon.description}
									placeholder="Що входить у цю послугу"
								/>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Tab 3: Clubs -->
	{#if activeTab === 'clubs'}
		<section class="tab-content">
			<div class="section-intro flex-between">
				<div>
					<h4>Клуби та локації мережі</h4>
					<p class="section-desc">
						Локації, в яких діє абонемент або здійснюється запис на рецепції
					</p>
				</div>
				<button type="button" class="btn-primary-sm" onclick={addClub}>
					<Plus size={15} />
					<span>Додати клуб</span>
				</button>
			</div>

			<div class="items-stack">
				{#each data.clubs as club, idx}
					<div class="card-item">
						<div class="item-header">
							<div class="header-left">
								<MapPin size={18} class="text-indigo-600" />
								<input
									type="text"
									class="input-control font-bold"
									bind:value={club.name}
									placeholder="Назва філії"
								/>
							</div>
							<button
								type="button"
								class="btn-icon danger"
								onclick={() => removeClub(club.id)}
								disabled={data.clubs.length <= 1}
								title="Видалити клуб"
							>
								<Trash2 size={14} />
							</button>
						</div>

						<div class="grid-2 mt-3">
							<label class="lbl-block">
								<span class="lbl">Адреса</span>
								<input
									type="text"
									class="input-control"
									bind:value={club.address}
									placeholder="вул. Назва, номер"
								/>
							</label>
							<label class="lbl-block">
								<span class="lbl">Телефон рецепції</span>
								<input
									type="text"
									class="input-control"
									bind:value={club.phone}
									placeholder="+380..."
								/>
							</label>
						</div>

						<div class="mt-3">
							<label class="lbl-block">
								<span class="lbl">Години роботи</span>
								<input
									type="text"
									class="input-control"
									bind:value={club.workingHours}
									placeholder="Пн-Пт: 07:00 – 22:00, Сб-Нд: 08:00 – 21:00"
								/>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Tab 4: Rules -->
	{#if activeTab === 'rules'}
		<section class="tab-content">
			<div class="section-intro">
				<h4>Правила клубу та процедура входу</h4>
				<p class="section-desc">
					Налаштування електронних карток, заморозки та повідомлень у Telegram
				</p>
			</div>

			<div class="card-bordered space-y-4">
				<div class="grid-2">
					<label class="lbl-block">
						<span class="lbl">Бренд клубу</span>
						<input
							type="text"
							class="input-control"
							bind:value={data.clubBrand}
							placeholder="Pulse Fitness Club"
						/>
					</label>
					<label class="lbl-block">
						<span class="lbl">Слоган / підзаголовок</span>
						<input
							type="text"
							class="input-control"
							bind:value={data.tagline}
							placeholder="Сила та здоровʼя"
						/>
					</label>
				</div>

				<div class="grid-2">
					<label class="lbl-block">
						<span class="lbl">Telegram менеджера/рецепції</span>
						<input
							type="text"
							class="input-control"
							bind:value={data.approval.telegramChat}
							placeholder="@pulse_fitness_admin"
						/>
					</label>
					<label class="lbl-block">
						<span class="lbl">Повідомлення про зарахування</span>
						<input
							type="text"
							class="input-control"
							bind:value={data.approval.responseTimeNotice}
							placeholder="Миттєва генерація картки..."
						/>
					</label>
				</div>

				<div class="pt-3 border-t border-gray-100">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={data.approval.autoApprovalEnabled}
						/>
						<span class="font-medium">Автоматичне створення цифрової картки одразу після оплати</span>
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={data.rules.allowFreeze}
						/>
						<span class="font-medium">Дозволити клієнту заморозку абонемента (до {data.rules.maxFreezeDays} днів)</span>
					</label>
				</div>

				<div class="grid-2 pt-2">
					<label class="lbl-block">
						<span class="lbl">Спосіб контролю доступу</span>
						<select class="input-control" bind:value={data.rules.entryMethod}>
							<option value="qr_reception">QR-код на рецепції (сканує адміністратор)</option>
							<option value="turnstile">Автоматичний турнікет (оптичний зчитувач)</option>
						</select>
					</label>
					<label class="lbl-block">
						<span class="lbl">Умови повернення / правила</span>
						<input
							type="text"
							class="input-control"
							bind:value={data.rules.refundNotice}
						/>
					</label>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.fitness-editor {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		background: #ffffff;
		border-radius: 12px;
		padding: 1.25rem;
		border: 1px solid #e5e7eb;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 1rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.title-wrap {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.icon-badge {
		font-size: 1.8rem;
		line-height: 1;
		background: #eff6ff;
		padding: 0.5rem;
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
		background: #f8fafc;
		padding: 0.35rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		overflow-x: auto;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: #64748b;
		background: transparent;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.tab-btn:hover {
		color: #1e293b;
		background: rgba(255, 255, 255, 0.6);
	}

	.tab-btn.active {
		color: #0f172a;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.section-intro {
		margin-bottom: 1rem;
	}

	.section-intro h4 {
		font-size: 0.95rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0;
	}

	.section-desc {
		font-size: 0.8rem;
		color: #6b7280;
		margin: 0.2rem 0 0 0;
	}

	.items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.card-item {
		background: #fafafa;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 0.9rem;
		transition: border-color 0.15s ease;
	}

	.card-item:hover {
		border-color: #cbd5e1;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.period-badge {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		letter-spacing: 0.03em;
	}

	.period-day {
		background: #fef3c7;
		color: #92400e;
	}

	.period-week {
		background: #e0e7ff;
		color: #3730a3;
	}

	.period-month {
		background: #dcfce7;
		color: #166534;
	}

	.btn-primary-sm {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: #0f172a;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-primary-sm:hover {
		background: #1e293b;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
		background: #ffffff;
		color: #6b7280;
		cursor: pointer;
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
		gap: 0.85rem;
	}

	.grid-3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.75rem;
	}

	.lbl {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: #4b5563;
		margin-bottom: 0.25rem;
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

	.w-12 {
		width: 48px;
	}

	.w-24 {
		width: 90px;
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

	.checkbox-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: #374151;
		cursor: pointer;
		margin-right: 0.75rem;
	}

	.price-wrap {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.currency-tag {
		font-size: 0.85rem;
		font-weight: 700;
		color: #4b5563;
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
	}
</style>
