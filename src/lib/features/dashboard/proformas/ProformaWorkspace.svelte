<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		Scroll,
		FileText,
		CheckCircle2,
		Clock,
		Trash2,
		ExternalLink,
		Send,
		ShieldCheck,
		Search,
		Copy,
		Repeat,
		Folder,
		X,
		Layers
	} from '@lucide/svelte';
	import type { BusinessEntity } from '../types';
	import type { DashboardGateway } from '../api/dashboard-gateway';
	import {
		loadInvoiceRules,
		saveInvoiceRules,
		formatInvoiceNumber,
		formatPaymentPurpose,
		type InvoiceRules
	} from '../invoice-rules/invoice-rules';
	import ProformaEditor from './ProformaEditor.svelte';
	import ProformaActModal from './ProformaActModal.svelte';
	import type { ProformaAct, ProformaDraft } from './types';
	import { formatProformaMoney } from './proforma-calc';
	import {
		convertProformaToInvoice,
		deleteProforma,
		listProformas,
		saveProforma,
		saveProformaAct
	} from './proforma-repository';
	import { createSettingsRepository } from '../business-settings/settings-repository';
	import {
		defaultBusinessDraft,
		reconcileBusinessEntities,
		type BusinessDraft
	} from '../business-settings/business-settings';

	let {
		gateway,
		entities = [],
		businessContext,
		demo = false
	}: {
		gateway?: DashboardGateway;
		entities?: BusinessEntity[];
		businessContext?: { userId: string; merchantId: string; name: string };
		demo?: boolean;
	} = $props();

	let rules = $state<InvoiceRules | undefined>(undefined);
	let businessDraft = $state<BusinessDraft | undefined>(undefined);
	let loadingSettings = $state(true);
	let localEntities = $state<BusinessEntity[]>([]);
	const activeEntities = $derived(localEntities.length > 0 ? localEntities : entities);
	let activeTab = $state<'editor' | 'list'>('editor');
	let savedProformas = $state<ProformaDraft[]>([]);
	let selectedDraft = $state<ProformaDraft | undefined>(undefined);
	let loading = $state(false);
	let globalMessage = $state<string | null>(null);
	let actModalOpen = $state(false);
	let actProforma = $state<ProformaDraft | null>(null);

	// Search & Project filters
	let searchQuery = $state('');
	let selectedProjectFilter = $state<string>('all');
	let recurrenceFilterOnly = $state(false);

	const availableProjects = $derived.by(() => {
		const map = new Map<string, number>();
		for (const p of savedProformas) {
			const grp = p.projectGroup?.trim() || 'Без проєкту';
			map.set(grp, (map.get(grp) || 0) + 1);
		}
		return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
	});

	const recurrenceCount = $derived(
		savedProformas.filter((p) => p.recurrence && p.recurrence !== 'none').length
	);

	const filteredProformas = $derived.by(() => {
		let list = savedProformas;

		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter((p) => {
				const num = (p.number || '').toLowerCase();
				const client = (p.customer?.name || '').toLowerCase();
				const taxId = (p.customer?.taxId || '').toLowerCase();
				const project = (p.projectGroup || '').toLowerCase();
				const purpose = (p.purpose || '').toLowerCase();
				const items = p.items.map((i) => (i.name || '').toLowerCase()).join(' ');
				const total = p.totals?.total ? String(p.totals.total) : '';
				return (
					num.includes(q) ||
					client.includes(q) ||
					taxId.includes(q) ||
					project.includes(q) ||
					purpose.includes(q) ||
					items.includes(q) ||
					total.includes(q)
				);
			});
		}

		if (selectedProjectFilter !== 'all') {
			list = list.filter((p) => {
				const grp = p.projectGroup?.trim() || 'Без проєкту';
				return grp === selectedProjectFilter;
			});
		}

		if (recurrenceFilterOnly) {
			list = list.filter((p) => p.recurrence && p.recurrence !== 'none');
		}

		return list;
	});

	const merchantId = $derived(businessContext?.merchantId || 'default-merchant');
	const settingsRepo = createSettingsRepository();

	function openActModal(item: ProformaDraft) {
		actProforma = item;
		actModalOpen = true;
	}

	async function handleSaveAct(act: ProformaAct) {
		if (!actProforma) return;
		await saveProformaAct(merchantId, actProforma.id, act, demo);
		const idx = savedProformas.findIndex((p) => p.id === actProforma!.id);
		if (idx >= 0) {
			savedProformas[idx].act = act;
		}
		if (actProforma.id === act.proformaId) {
			actProforma.act = act;
		}
	}

	onMount(() => {
		rules = loadInvoiceRules();
		void loadSettings();
		void refreshList();
	});

	$effect(() => {
		if (businessDraft && activeEntities.length > 0) {
			reconcileBusinessEntities(businessDraft, activeEntities);
		}
	});

	async function loadSettings() {
		loadingSettings = true;
		try {
			let curEntities = entities;
			if (curEntities.length === 0 && localEntities.length === 0 && gateway && businessContext?.userId) {
				try {
					const struct = await gateway.getBusinessStructure(businessContext.userId);
					if (struct?.entities && struct.entities.length > 0) {
						localEntities = struct.entities;
						curEntities = struct.entities;
					}
				} catch {
					// ignore
				}
			}

			if (businessContext?.userId && businessContext?.merchantId) {
				const snapshot = await settingsRepo.load({
					userId: businessContext.userId,
					merchantId: businessContext.merchantId,
					demo
				});
				const loaded = snapshot.draft;
				reconcileBusinessEntities(loaded, curEntities);
				businessDraft = loaded;
			} else {
				const fallback = defaultBusinessDraft();
				reconcileBusinessEntities(fallback, curEntities);
				businessDraft = fallback;
			}
		} catch {
			const fallback = defaultBusinessDraft();
			reconcileBusinessEntities(fallback, activeEntities);
			businessDraft = fallback;
		} finally {
			loadingSettings = false;
		}
	}

	async function refreshList() {
		loading = true;
		try {
			savedProformas = await listProformas(merchantId, demo);
		} finally {
			loading = false;
		}
	}

	async function handleSaveDraft(draft: ProformaDraft) {
		await saveProforma(merchantId, draft, demo);
		await refreshList();
	}

	async function handleCreateInvoice(draft: ProformaDraft): Promise<{ invoiceId: string } | void> {
		if (!gateway) throw new Error('API кабінету недоступне.');

		const result = await convertProformaToInvoice(merchantId, draft, gateway, demo);

		await refreshList();
		return { invoiceId: result.invoiceId };
	}

	async function handleQuickCreateInvoice(item: ProformaDraft) {
		if (!gateway) return;
		try {
			globalMessage = 'Створення рахунку...';
			const res = await handleCreateInvoice(item);
			if (res) {
				globalMessage = `Рахунок № ${item.number} успішно створено!`;
				setTimeout(() => (globalMessage = null), 4000);
			}
		} catch (err) {
			globalMessage = err instanceof Error ? err.message : 'Не вдалося створити рахунок.';
			setTimeout(() => (globalMessage = null), 4000);
		}
	}

	function startNewProforma() {
		selectedDraft = undefined;
		activeTab = 'editor';
	}

	function editProforma(item: ProformaDraft) {
		selectedDraft = item;
		activeTab = 'editor';
	}

	async function handleDuplicateProforma(source: ProformaDraft) {
		const clone: ProformaDraft = JSON.parse(JSON.stringify(source));
		clone.id = `prof-${crypto.randomUUID()}`;
		const now = new Date();
		const dueDate = new Date(now);
		dueDate.setDate(dueDate.getDate() + 14);

		clone.issueDate = now.toISOString().slice(0, 10);
		clone.dueDate = dueDate.toISOString().slice(0, 10);

		if (rules) {
			clone.number = formatInvoiceNumber(rules, now);
			const updatedRules: InvoiceRules = {
				...rules,
				nextNumber: rules.nextNumber + 1
			};
			rules = updatedRules;
			saveInvoiceRules(updatedRules);
		} else {
			clone.number = `${source.number}-копія`;
		}

		clone.status = 'draft';
		delete clone.invoiceId;
		delete clone.act;
		clone.createdAt = now.toISOString();

		if (rules) {
			clone.purpose = formatPaymentPurpose(rules, {
				number: clone.number,
				date: now,
				scenario: 'fixed',
				customer: clone.customer.name
			});
		}

		await saveProforma(merchantId, clone, demo);
		await refreshList();
		selectedDraft = clone;
		activeTab = 'editor';
		globalMessage = `Проформу № ${source.number} успішно скопійовано! Відкрито нову чернетку № ${clone.number}.`;
		setTimeout(() => (globalMessage = null), 4000);
	}

	async function handleDeleteProforma(id: string) {
		await deleteProforma(merchantId, id, demo);
		await refreshList();
	}
</script>

<div class="min-h-screen bg-[#f8f9fa] px-4 py-8 sm:px-6 lg:px-8">
	<!-- Workspace Top Switcher -->
	<div class="mx-auto max-w-5xl mb-8 flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-1 rounded-xl bg-zinc-200/70 p-1">
			<button
				type="button"
				onclick={() => { selectedDraft = undefined; activeTab = 'editor'; }}
				class:bg-white={activeTab === 'editor'}
				class:shadow-sm={activeTab === 'editor'}
				class:text-zinc-950={activeTab === 'editor'}
				class="rounded-lg px-4 py-1.5 text-xs font-bold text-zinc-600 transition hover:text-zinc-950"
			>
				Конструктор рахунку
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'list')}
				class:bg-white={activeTab === 'list'}
				class:shadow-sm={activeTab === 'list'}
				class:text-zinc-950={activeTab === 'list'}
				class="rounded-lg px-4 py-1.5 text-xs font-bold text-zinc-600 transition hover:text-zinc-950 flex items-center gap-1.5"
			>
				Журнал проформ
				{#if savedProformas.length > 0}
					<span class="rounded-full bg-zinc-900 px-1.5 py-0.2 text-[10px] text-white">
						{savedProformas.length}
					</span>
				{/if}
			</button>
		</div>

		{#if activeTab === 'list'}
			<button
				type="button"
				onclick={startNewProforma}
				class="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
			>
				<Plus size={15} />
				Нова проформа
			</button>
		{/if}
	</div>

	<!-- Notification message banner -->
	{#if globalMessage}
		<div class="mx-auto max-w-5xl mb-6 rounded-xl bg-zinc-950 px-5 py-3 text-xs font-bold text-white shadow-lg flex items-center justify-between">
			<span>{globalMessage}</span>
			<button type="button" onclick={() => (globalMessage = null)} class="text-zinc-400 hover:text-white ml-3">✕</button>
		</div>
	{/if}

	{#if activeTab === 'editor'}
		{#if loadingSettings}
			<div class="mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white p-12 text-center text-xs font-semibold text-zinc-500 shadow-sm">
				Завантаження налаштувань бізнесу...
			</div>
		{:else}
			{#key `${selectedDraft?.id ?? 'new'}-${businessDraft?.mode ?? 'none'}-${activeEntities.length}-${activeEntities.map((e) => e.id).join(',')}-${businessDraft?.selectedSellerId ?? ''}`}
				<ProformaEditor
					entities={activeEntities}
					{rules}
					{businessDraft}
					initialDraft={selectedDraft}
					onSave={handleSaveDraft}
					onCreateInvoice={handleCreateInvoice}
				/>
			{/key}
		{/if}
	{:else}
		<!-- List View / Journal -->
		<div class="mx-auto max-w-5xl">
			{#if loading}
				<div class="p-12 text-center text-xs text-zinc-500">Завантаження проформ...</div>
			{:else if savedProformas.length === 0}
				<div class="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm">
					<div class="mx-auto grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600 mb-3">
						<Scroll size={24} />
					</div>
					<h3 class="text-base font-bold text-zinc-900">Немає збережених проформ</h3>
					<p class="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
						Створіть свій перший рахунок-фактуру з автоматичним підтягуванням реквізитів з профілю та правил нумерації.
					</p>
					<button
						type="button"
						onclick={startNewProforma}
						class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700"
					>
						<Plus size={15} />
						Створити рахунок-фактуру
					</button>
				</div>
			{:else}
				<!-- Search & Filter Bar -->
				<div class="mb-5 space-y-3">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="relative flex-1 min-w-[260px]">
							<Search size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Швидкий пошук за номером, клієнтом, ЄДРПОУ, послугою, проєктом або сумою..."
								class="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-10 text-xs text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
							/>
							{#if searchQuery}
								<button
									type="button"
									onclick={() => (searchQuery = '')}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
									title="Очистити пошук"
								>
									<X size={14} />
								</button>
							{/if}
						</div>

						<div class="flex items-center gap-2 shrink-0">
							<!-- Recurrence filter button -->
							<button
								type="button"
								onclick={() => (recurrenceFilterOnly = !recurrenceFilterOnly)}
								class="flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition {recurrenceFilterOnly ? 'border-purple-300 bg-purple-50 text-purple-800 shadow-sm' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}"
								title="Показати лише регулярні рахунки"
							>
								<Repeat size={14} class={recurrenceFilterOnly ? 'text-purple-600' : 'text-zinc-400'} />
								<span>Регулярні</span>
								{#if recurrenceCount > 0}
									<span class="rounded-full {recurrenceFilterOnly ? 'bg-purple-200 text-purple-900' : 'bg-zinc-100 text-zinc-600'} px-1.5 py-0.2 text-[10px]">
										{recurrenceCount}
									</span>
								{/if}
							</button>
						</div>
					</div>

					<!-- Projects Chips -->
					{#if availableProjects.length > 0}
						<div class="flex flex-wrap items-center gap-1.5 pt-0.5">
							<span class="text-[11px] font-bold text-zinc-400 mr-1 flex items-center gap-1">
								<Folder size={12} /> Проєкти:
							</span>
							<button
								type="button"
								onclick={() => (selectedProjectFilter = 'all')}
								class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {selectedProjectFilter === 'all' ? 'bg-zinc-900 text-white font-bold shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
							>
								Усі ({savedProformas.length})
							</button>

							{#each availableProjects as proj}
								<button
									type="button"
									onclick={() => (selectedProjectFilter = proj.name)}
									class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {selectedProjectFilter === proj.name ? 'bg-blue-600 text-white font-bold shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}"
								>
									{proj.name} ({proj.count})
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if filteredProformas.length === 0}
					<div class="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500 shadow-sm space-y-2">
						<p>Нічого не знайдено за вказаними критеріями пошуку.</p>
						<button
							type="button"
							onclick={() => {
								searchQuery = '';
								selectedProjectFilter = 'all';
								recurrenceFilterOnly = false;
							}}
							class="font-bold text-blue-600 hover:underline"
						>
							Скинути фільтри
						</button>
					</div>
				{:else}
					<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-200">
						{#each filteredProformas as item (item.id)}
							{@const lineCount = item.items.filter((i) => i.type === 'item').length}
							{@const totalSum = item.totals?.total ?? item.items.reduce((sum, i) => sum + (i.total || 0), 0)}
							<div class="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-zinc-50 transition">
								<div class="flex items-center gap-4">
									<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 shrink-0">
										<FileText size={18} />
									</div>
									<div>
										<div class="flex flex-wrap items-center gap-2">
											<strong class="text-sm font-extrabold text-zinc-900">
												{item.title} № {item.number}
											</strong>

											{#if item.status === 'invoice_created'}
												<span class="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
													<CheckCircle2 size={12} />
													Створено рахунок
												</span>
											{:else}
												<span class="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
													<Clock size={12} />
													Чернетка
												</span>
											{/if}

											<!-- Project Group Badge -->
											<span class="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
												<Folder size={11} class="text-zinc-500" />
												{item.projectGroup || 'Без проєкту'}
											</span>

											<!-- Recurrence Badge -->
											{#if item.recurrence && item.recurrence !== 'none'}
												<span class="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">
													<Repeat size={11} />
													{item.recurrence === 'monthly'
														? 'Регулярний (щомісяця)'
														: item.recurrence === 'weekly'
															? 'Регулярний (щотижня)'
															: item.recurrence === 'quarterly'
																? 'Регулярний (щокварталу)'
																: 'Регулярний'}
												</span>
											{/if}
										</div>

										<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
											<span>Клієнт: <strong class="text-zinc-700">{item.customer.name || 'Не вказано'}</strong></span>
											{#if item.customer.taxId}
												<span>(ЄДРПОУ: {item.customer.taxId})</span>
											{/if}
											<span>•</span>
											<span>Дата: {item.issueDate}</span>
											<span>•</span>
											<span>Позицій: {lineCount}</span>
										</div>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div class="text-right">
										<strong class="block text-sm font-black tabular-nums text-zinc-950">
											{formatProformaMoney(totalSum, item.currency)}
										</strong>
										<span class="text-[11px] text-zinc-400">
											до {item.dueDate}
										</span>
									</div>

									<div class="flex items-center gap-2">
										<!-- Duplicate Button (Копіювати) -->
										<button
											type="button"
											onclick={() => handleDuplicateProforma(item)}
											class="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 hover:text-blue-600 transition"
											title="Зкопіювати проформу та створити нову на її основі в 1 клік"
										>
											<Copy size={13} />
											<span>Копіювати</span>
										</button>

										{#if item.status === 'invoice_created' && item.invoiceId}
											<a
												href={`/dashboard/invoices/${item.invoiceId}`}
												class="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
											>
												До рахунку
												<ExternalLink size={13} />
											</a>
										{:else}
											<a
												href={`/dashboard/invoices/new?type=fixed&proformaId=${item.id}${demo ? '&demo=1' : ''}`}
												class="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
											>
												Фіксований рахунок ↗
											</a>
											<button
												type="button"
												onclick={() => handleQuickCreateInvoice(item)}
												class="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
											>
												<Send size={13} />
												Швидкий рахунок
											</button>
										{/if}

										<!-- Act button & status -->
										{#if item.act?.status === 'signed'}
											<button
												type="button"
												onclick={() => openActModal(item)}
												class="flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition"
												title="Акт підписано КЕП (Дія.Підпис)"
											>
												<ShieldCheck size={13} />
												Акт підписано
											</button>
										{:else if item.act}
											<button
												type="button"
												onclick={() => openActModal(item)}
												class="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
											>
												<FileText size={13} />
												Акт (чернетка)
											</button>
										{:else}
											<button
												type="button"
												onclick={() => openActModal(item)}
												class="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition"
											>
												<FileText size={13} />
												Створити Акт
											</button>
										{/if}

										<button
											type="button"
											onclick={() => editProforma(item)}
											class="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition"
										>
											Відкрити
										</button>
										<button
											type="button"
											onclick={() => handleDeleteProforma(item.id)}
											class="rounded-lg p-1.5 text-zinc-400 hover:text-red-600 transition"
											aria-label="Видалити"
										>
											<Trash2 size={16} />
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	{#if actModalOpen && actProforma}
		{#key `${actProforma.id}-${actProforma.act?.status ?? 'none'}`}
			<ProformaActModal
				bind:open={actModalOpen}
				proforma={actProforma}
				onSaveAct={handleSaveAct}
			/>
		{/key}
	{/if}
</div>
