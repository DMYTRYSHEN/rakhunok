<script lang="ts">
	import {
		Plus,
		Trash2,
		Sparkles,
		Clock,
		Calendar,
		MapPin,
		Film,
		ShieldCheck,
		AlertTriangle,
		Ticket
	} from '@lucide/svelte';
	import type {
		EventsFlowData,
		EventSession,
		EventHall,
		EventSeatCategory
	} from '$lib/features/shared/checkout-scenario-config';

	let {
		flowData = $bindable({})
	}: {
		flowData?: Partial<EventsFlowData>;
	} = $props();

	const defaultData: EventsFlowData = {
		venueName: 'Кіноконцертний комплекс «Олімп»',
		address: 'м. Київ, вул. Велика Васильківська, 55',
		description: 'Сучасні кінозали з лазерною проекцією та концертний хол з акустикою Meyer Sound',
		contacts: {
			phone: '+380 44 222 11 00',
			telegram: '@olymp_tickets_bot',
			email: 'tickets@olymp.kiev.ua'
		},
		serviceFeePerTicket: 20,
		reservationHoldMinutes: 10,
		maxTicketsPerOrder: 6,
		allowCashierMode: true,
		allowRefunds: true,
		refundNotice: 'Повернення можливе не пізніше ніж за 2 години до початку сеансу',
		sessions: [
			{
				id: 'sess_1',
				eventTitle: 'Дюна: Частина Друга (Laser)',
				format: '2D Laser',
				language: 'Український дубляж',
				hallId: 'hall_1',
				date: '2026-09-22',
				time: '19:30',
				durationMinutes: 165,
				ageRating: '16+'
			},
			{
				id: 'sess_2',
				eventTitle: 'Симфонія Всесвіту — Hans Zimmer Tribute',
				format: 'Live Concert',
				language: 'Живе виконання',
				hallId: 'hall_1',
				date: '2026-09-23',
				time: '20:00',
				durationMinutes: 120,
				ageRating: '12+'
			},
			{
				id: 'sess_3',
				eventTitle: 'Indie Wave Festival 2026',
				format: 'Open Air Festival',
				language: 'Live Sound',
				hallId: 'hall_2',
				date: '2026-09-26',
				time: '18:00',
				durationMinutes: 240,
				ageRating: '16+'
			}
		],
		halls: [
			{
				id: 'hall_1',
				name: 'Зал 1 — Premier Screen',
				type: 'seated',
				screenOrStageLabel: '🎬 ЕКРАН',
				rowsCount: 5,
				seatsPerRow: 8,
				capacity: 40,
				categories: [
					{
						id: 'cat_standard',
						name: 'Стандартне місце',
						price: 250,
						color: '#3b82f6',
						description: 'Зручні крісла, ряди 1–3'
					},
					{
						id: 'cat_premium',
						name: 'Преміальне місце',
						price: 350,
						color: '#eab308',
						description: 'Шкіряні реклайнери, ряди 4–5'
					}
				]
			},
			{
				id: 'hall_2',
				name: 'Концертний хол (Фан-зони)',
				type: 'open_zone',
				screenOrStageLabel: '🎸 ГОЛОВНА СЦЕНА',
				capacity: 500,
				categories: [
					{
						id: 'cat_fan1',
						name: 'Фан-зона 1 (під сценою)',
						price: 500,
						color: '#ec4899',
						description: 'Найближче до виконавців'
					},
					{
						id: 'cat_fan2',
						name: 'Фан-зона 2 (загальна)',
						price: 350,
						color: '#8b5cf6',
						description: 'Вільний простір, хороший огляд'
					},
					{
						id: 'cat_vip',
						name: 'VIP Lounge (балкон)',
						price: 900,
						color: '#10b981',
						description: 'Окремий бар, місця за столиками'
					}
				]
			}
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForGroupBooking: true,
			groupBookingMinSeats: 8,
			telegramChat: '@olymp_tickets_manager'
		}
	};

	let data = $state<EventsFlowData>({
		...defaultData,
		...flowData,
		contacts: { ...defaultData.contacts, ...(flowData?.contacts || {}) },
		sessions: flowData?.sessions && flowData.sessions.length > 0 ? flowData.sessions : defaultData.sessions,
		halls: flowData?.halls && flowData.halls.length > 0 ? flowData.halls : defaultData.halls,
		approval: { ...defaultData.approval, ...(flowData?.approval || {}) }
	});

	$effect(() => {
		flowData = $state.snapshot(data);
	});

	let activeTab = $state<'sessions' | 'halls' | 'pricing' | 'rules'>('sessions');

	// Session management
	function addSession() {
		const newId = `sess_${Date.now()}`;
		data.sessions = [
			...data.sessions,
			{
				id: newId,
				eventTitle: 'Новий сеанс / подія',
				format: '2D',
				language: 'Український дубляж',
				hallId: data.halls[0]?.id || 'hall_1',
				date: '2026-09-25',
				time: '19:00',
				durationMinutes: 120,
				ageRating: '16+'
			}
		];
	}

	function removeSession(id: string) {
		if (data.sessions.length <= 1) return;
		data.sessions = data.sessions.filter((s) => s.id !== id);
	}

	// Category management inside halls
	function addCategory(hallIndex: number) {
		const newId = `cat_${Date.now()}`;
		const cats = data.halls[hallIndex].categories || [];
		data.halls[hallIndex].categories = [
			...cats,
			{
				id: newId,
				name: 'Нова категорія',
				price: 300,
				color: '#10b981',
				description: 'Опис зони або крісел'
			}
		];
	}

	function removeCategory(hallIndex: number, catIndex: number) {
		const cats = data.halls[hallIndex].categories || [];
		if (cats.length <= 1) return;
		data.halls[hallIndex].categories = cats.filter((_, idx) => idx !== catIndex);
	}
</script>

<div class="events-editor">
	<header class="editor-header">
		<div class="title-wrap">
			<div class="icon-badge">🎟️</div>
			<div>
				<h3>Конфігуратор Сценарію «Концерти / Кіно / Квитки»</h3>
				<p class="subtitle">
					Керування сеансами, залами, тарифами (250 ₴ / 350 ₴), сервісним збором (20 ₴) та таймером резервування
				</p>
			</div>
		</div>
	</header>

	<!-- Tabs Navigation -->
	<nav class="nav-tabs">
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'sessions'}
			onclick={() => (activeTab = 'sessions')}
		>
			<Calendar size={16} />
			<span>Сеанси & Події ({data.sessions.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'halls'}
			onclick={() => (activeTab = 'halls')}
		>
			<Film size={16} />
			<span>Зали & Схеми ({data.halls.length})</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'pricing'}
			onclick={() => (activeTab = 'pricing')}
		>
			<Ticket size={16} />
			<span>Тарифи & Сервісний збір</span>
		</button>
		<button
			type="button"
			class="tab-btn"
			class:active={activeTab === 'rules'}
			onclick={() => (activeTab = 'rules')}
		>
			<Clock size={16} />
			<span>Резерв & Контроль</span>
		</button>
	</nav>

	<div class="tab-content">
		<!-- TAB 1: SESSIONS -->
		{#if activeTab === 'sessions'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Розклад сеансів та подій</h4>
						<p class="muted">
							Зал визначається сеансом. При зміні сеансу покупцем старий вибір місць скидається автоматично.
						</p>
					</div>
					<button type="button" class="btn-primary-sm" onclick={addSession}>
						<Plus size={15} /> Додати сеанс
					</button>
				</div>

				<div class="sessions-list">
					{#each data.sessions as session (session.id)}
						<div class="item-card">
							<div class="item-card-header">
								<input
									type="text"
									class="input-title"
									bind:value={session.eventTitle}
									placeholder="Назва фільму / події"
								/>
								<button
									type="button"
									class="btn-icon danger"
									aria-label="Видалити"
									onclick={() => removeSession(session.id)}
									disabled={data.sessions.length <= 1}
								>
									<Trash2 size={15} />
								</button>
							</div>

							<div class="grid-4">
								<label>
									<span class="lbl">Дата</span>
									<input type="date" class="input-control" bind:value={session.date} />
								</label>
								<label>
									<span class="lbl">Час</span>
									<input type="time" class="input-control" bind:value={session.time} />
								</label>
								<label>
									<span class="lbl">Зал</span>
									<select class="input-control" bind:value={session.hallId}>
										{#each data.halls as hall}
											<option value={hall.id}>{hall.name}</option>
										{/each}
									</select>
								</label>
								<label>
									<span class="lbl">Формат</span>
									<input
										type="text"
										class="input-control"
										bind:value={session.format}
										placeholder="2D, 3D, Live"
									/>
								</label>
							</div>

							<div class="grid-3">
								<label>
									<span class="lbl">Мова / Озвучення</span>
									<input
										type="text"
										class="input-control"
										bind:value={session.language}
										placeholder="Український дубляж"
									/>
								</label>
								<label>
									<span class="lbl">Тривалість (хв)</span>
									<input
										type="number"
										min="10"
										step="5"
										class="input-control"
										bind:value={session.durationMinutes}
									/>
								</label>
								<label>
									<span class="lbl">Вікове обмеження</span>
									<select class="input-control" bind:value={session.ageRating}>
										<option value="0+">0+</option>
										<option value="12+">12+</option>
										<option value="16+">16+</option>
										<option value="18+">18+</option>
									</select>
								</label>
							</div>
						</div>
					{/each}
				</div>
			</section>

		<!-- TAB 2: HALLS -->
		{:else if activeTab === 'halls'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Зали та схеми розміщення</h4>
						<p class="muted">
							Підтримуються як зали з нумерованими місцями (кіно/театр), так і відкриті простори (фан-зони).
						</p>
					</div>
				</div>

				<div class="halls-list">
					{#each data.halls as hall, hIdx (hall.id)}
						<div class="item-card">
							<div class="item-card-header">
								<input
									type="text"
									class="input-title"
									bind:value={hall.name}
									placeholder="Назва залу"
								/>
								<span class="badge-type">
									{hall.type === 'seated' ? '💺 З нумерованими місцями' : '🎸 Відкрита фан-зона'}
								</span>
							</div>

							<div class="grid-3">
								<label>
									<span class="lbl">Тип залу</span>
									<select class="input-control" bind:value={hall.type}>
										<option value="seated">Нумеровані місця (схема ряди/місця)</option>
										<option value="open_zone">Відкритий простір (фан-зони)</option>
									</select>
								</label>
								<label>
									<span class="lbl">Позначка сцени / екрана</span>
									<input
										type="text"
										class="input-control"
										bind:value={hall.screenOrStageLabel}
										placeholder="🎬 ЕКРАН або 🎸 СЦЕНА"
									/>
								</label>
								<label>
									<span class="lbl">Загальна місткість</span>
									<input
										type="number"
										min="10"
										class="input-control"
										bind:value={hall.capacity}
									/>
								</label>
							</div>

							<!-- Categories inside hall -->
							<div class="categories-sub">
								<div class="flex-between">
									<span class="lbl">Категорії місць та ціни в залі:</span>
									<button type="button" class="btn-link" onclick={() => addCategory(hIdx)}>
										+ Додати категорію
									</button>
								</div>
								<div class="cats-grid">
									{#each hall.categories as cat, cIdx (cat.id)}
										<div class="cat-pill-row">
											<input
												type="color"
												class="cat-color"
												bind:value={cat.color}
												aria-label="Колір категорії"
											/>
											<input
												type="text"
												class="input-control"
												bind:value={cat.name}
												placeholder="Назва"
											/>
											<div class="price-wrap">
												<input
													type="number"
													min="0"
													step="10"
													class="input-control w-24"
													bind:value={cat.price}
												/>
												<span class="currency-tag">₴</span>
											</div>
											{#if hall.categories.length > 1}
												<button
													type="button"
													class="btn-icon danger sm"
													onclick={() => removeCategory(hIdx, cIdx)}
													aria-label="Видалити"
												>
													<Trash2 size={13} />
												</button>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

		<!-- TAB 3: PRICING & SERVICE FEE -->
		{:else if activeTab === 'pricing'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Ціноутворення та Сервісний збір</h4>
						<p class="muted">
							Прозорі правила: сервісний збір обов'язково відображається до оплати, а не додається таємно.
						</p>
					</div>
				</div>

				<div class="callout-info">
					<Sparkles size={18} />
					<div>
						<strong>Контрольний розрахунок:</strong> 2 стандартні місця (2 × 250 ₴ = 500 ₴) + 1 преміальне місце (350 ₴) = 850 ₴.
						Сервісний збір 3 × 20 ₴ = 60 ₴. Разом до сплати: <strong>910 ₴</strong>.
					</div>
				</div>

				<div class="grid-2 form-grid">
					<div class="card-bordered">
						<h5>Сервісний збір оператора</h5>
						<label class="lbl-block">
							<span class="lbl">Розмір сервісного збору за 1 квиток (₴)</span>
							<span class="hint">Вказується окремим рядком перед оплатою</span>
							<input
								type="number"
								min="0"
								step="5"
								class="input-control"
								bind:value={data.serviceFeePerTicket}
							/>
						</label>

						<label class="lbl-block">
							<span class="lbl">Максимальна кількість квитків в одні руки</span>
							<input
								type="number"
								min="1"
								max="20"
								class="input-control"
								bind:value={data.maxTicketsPerOrder}
							/>
						</label>
					</div>

					<div class="card-bordered">
						<h5>Касовий режим та Повернення</h5>
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={data.allowCashierMode} />
							<span>Дозволити режим каси (продаж на місці)</span>
						</label>

						<label class="checkbox-label">
							<input type="checkbox" bind:checked={data.allowRefunds} />
							<span>Дозволити онлайн-повернення квитків</span>
						</label>

						<label class="lbl-block mt-2">
							<span class="lbl">Правила та терміни повернення</span>
							<input
								type="text"
								class="input-control"
								bind:value={data.refundNotice}
								placeholder="Наприклад: не пізніше ніж за 2 години до сеансу"
							/>
						</label>
					</div>
				</div>
			</section>

		<!-- TAB 4: RESERVATION & ACCESS CONTROL -->
		{:else if activeTab === 'rules'}
			<section class="section-card">
				<div class="section-header">
					<div>
						<h4>Резервування та Контроль входу</h4>
						<p class="muted">
							Серверний таймер утримання обраних місць та сканування електронних квитків контролерами на вході.
						</p>
					</div>
				</div>

				<div class="callout-warning">
					<AlertTriangle size={18} />
					<div>
						<strong>Захист від колізій та подвійного входу:</strong> Місця блокуються атомарно на сервері на {data.reservationHoldMinutes} хв.
						На вході квиток сканується онлайн: повторна спроба сканування маркується як «Уже використано».
					</div>
				</div>

				<div class="grid-2 form-grid">
					<div class="card-bordered">
						<h5>Тимчасовий резерв</h5>
						<label class="lbl-block">
							<span class="lbl">Час утримання резерву (хвилин)</span>
							<span class="hint">Таймер зворотного відліку на екрані платника</span>
							<input
								type="number"
								min="3"
								max="30"
								class="input-control"
								bind:value={data.reservationHoldMinutes}
							/>
						</label>

						<label class="checkbox-label">
							<input type="checkbox" bind:checked={data.approval.autoApprovalEnabled} />
							<span>Автоматичне підтвердження стандартних покупок</span>
						</label>
					</div>

					<div class="card-bordered">
						<h5>Групові замовлення & Telegram</h5>
						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={data.approval.requireManualForGroupBooking}
							/>
							<span>Групові бронювання потребують ручного узгодження</span>
						</label>

						<label class="lbl-block">
							<span class="lbl">Поріг для групового замовлення (від квитків)</span>
							<input
								type="number"
								min="4"
								max="50"
								class="input-control"
								bind:value={data.approval.groupBookingMinSeats}
							/>
						</label>

						<label class="lbl-block">
							<span class="lbl">Telegram-чат контролерів / адміністратора</span>
							<input
								type="text"
								class="input-control"
								bind:value={data.approval.telegramChat}
								placeholder="@event_tickets_bot"
							/>
						</label>
					</div>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.events-editor {
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
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
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
		background: #10b981;
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
		background: #10b981;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-primary-sm:hover {
		background: #059669;
	}

	.btn-link {
		background: none;
		border: none;
		color: #10b981;
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

	.sessions-list,
	.halls-list {
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

	.badge-type {
		font-size: 0.75rem;
		font-weight: 600;
		background: #e0f2fe;
		color: #0369a1;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
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

	.btn-icon.sm {
		width: 26px;
		height: 26px;
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
		gap: 0.75rem;
	}

	.grid-4 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		gap: 0.75rem;
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

	.categories-sub {
		border-top: 1px dashed #e5e7eb;
		padding-top: 0.75rem;
	}

	.cats-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.cat-pill-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
	}

	.cat-color {
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
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
