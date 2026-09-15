<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BadgePercent,
		Building2,
		Calendar,
		Check,
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		ChevronUp,
		Copy,
		CreditCard,
		ExternalLink,
		Eye,
		FileText,
		Folder,
		GripVertical,
		Landmark,
		MinusCircle,
		MoreVertical,
		Pencil,
		Plus,
		Repeat,
		RotateCw,
		Save,
		Send,
		ShieldCheck,
		Store,
		Trash2,
		Users,
		WalletCards,
		X,
		XCircle
	} from '@lucide/svelte';
	import type { BusinessEntity } from '../types';
	import type { InvoiceRules } from '../invoice-rules/invoice-rules';
	import { formatPaymentPurpose } from '../invoice-rules/invoice-rules';
	import type { ProformaCurrency, ProformaDraft, ProformaItem } from './types';
	import type { BusinessDraft } from '../business-settings/business-settings';
	import { businessInvoicePreview } from '../business-settings/business-settings';
	import {
		calculateLineTotal,
		calculateProformaTotals,
		createInitialProformaDraft,
		formatCurrencySign,
		formatProformaMoney
	} from './proforma-calc';
	import ProformaPreviewModal from './ProformaPreviewModal.svelte';
	import ProformaActModal from './ProformaActModal.svelte';
	import {
		loadBankConnections,
		loadPaymentMethodsConfig,
		type BankAccountConfig,
		type BankConnectionId,
		type BankIntegrationConfig,
		type PaymentMethodsConfig
	} from '../payment-methods/payment-methods';

	const BANK_LOGOS: Record<BankConnectionId, string> = {
		privatbank: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/31/94/f6/3194f6f5-1868-425b-ac5f-6bad596d5ad8/Placeholder.mill/200x200bb-75.webp',
		'a-bank': 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3a/76/1e/3a761e68-39dc-51ad-f189-e9d89227442c/Placeholder.mill/200x200bb-75.webp',
		monobank: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp'
	};

	const BANK_LABELS: Record<BankConnectionId, string> = {
		privatbank: 'ПриватБанк (Приват24)',
		'a-bank': 'А-Банк (аБізнес)',
		monobank: 'Monobank'
	};

	let {
		entities = [],
		rules,
		businessDraft,
		onSave,
		onSend,
		onCreateInvoice,
		initialDraft
	}: {
		entities?: BusinessEntity[];
		rules?: InvoiceRules;
		businessDraft?: BusinessDraft;
		onSave?: (draft: ProformaDraft) => Promise<void> | void;
		onSend?: (draft: ProformaDraft) => Promise<void> | void;
		onCreateInvoice?: (draft: ProformaDraft) => Promise<{ invoiceId: string } | void>;
		initialDraft?: ProformaDraft;
	} = $props();

	function initDraft(): ProformaDraft {
		return initialDraft
			? $state.snapshot(initialDraft)
			: createInitialProformaDraft(entities, rules, businessDraft);
	}

	let draft = $state<ProformaDraft>(initDraft());

	let previewOpen = $state(false);
	let actModalOpen = $state(false);
	let sellerModalOpen = $state(false);
	let customerModalOpen = $state(false);
	let paymentMethodModalOpen = $state(false);
	let recurrenceModalOpen = $state(false);
	let projectModalOpen = $state(false);
	let notesOpen = $state(Boolean(draft.notes));
	let editPurposeOpen = $state(false);
	let saving = $state(false);
	let sending = $state(false);
	let creatingInvoice = $state(false);
	let actionMessage = $state<string | null>(null);

	let bankConnections = $state<Record<BankConnectionId, BankIntegrationConfig>>(loadBankConnections());
	let paymentMethodsConfig = $state<PaymentMethodsConfig>(loadPaymentMethodsConfig());

	onMount(() => {
		bankConnections = loadBankConnections();
		paymentMethodsConfig = loadPaymentMethodsConfig();
	});

	// Auto-select seller from entities when available
	$effect(() => {
		if (entities.length > 0) {
			if (!draft.seller.entityId || draft.seller.name === 'Моя компанія') {
				const target =
					(businessDraft?.selectedSellerId && entities.find((e) => e.id === businessDraft.selectedSellerId)) ||
					entities[0];
				if (target) {
					selectSeller(target);
				}
			} else {
				const current = entities.find((e) => e.id === draft.seller.entityId);
				if (current) {
					if (!draft.seller.iban && current.iban) draft.seller.iban = current.iban;
					if (!draft.seller.bankName && current.bankName) draft.seller.bankName = current.bankName;
					if (!draft.seller.taxId && current.taxId) draft.seller.taxId = current.taxId;
					if (draft.paymentMethod.type === 'iban' && (!draft.paymentMethod.details || draft.paymentMethod.details === 'Обов’язкове поле')) {
						draft.paymentMethod.details = `IBAN: ${current.iban}${current.bankName ? ` (${current.bankName})` : ''}`;
					}
				}
			}
		}
	});

	const connectedBankAccounts = $derived.by(() => {
		const list: Array<{
			id: string;
			bankId: BankConnectionId;
			bankLabel: string;
			accountName: string;
			iban: string;
			balanceFormatted?: string;
			isActive: boolean;
			logo: string;
		}> = [];

		const bankKeys: BankConnectionId[] = ['privatbank', 'a-bank', 'monobank'];
		for (const bankId of bankKeys) {
			const bank = bankConnections[bankId];
			if (bank && bank.accounts && bank.accounts.length > 0) {
				for (const acc of bank.accounts) {
					list.push({
						id: `${bankId}-${acc.iban}`,
						bankId,
						bankLabel: BANK_LABELS[bankId] || bankId,
						accountName: acc.name || BANK_LABELS[bankId],
						iban: acc.iban,
						balanceFormatted: acc.balanceFormatted,
						isActive: acc.isActive,
						logo: BANK_LOGOS[bankId]
					});
				}
			}
		}
		return list;
	});

	function selectPaymentOption(option: {
		type: 'iban' | 'card' | 'cash';
		name: string;
		details: string;
		iban?: string;
		bankName?: string;
	}) {
		draft.paymentMethod = {
			type: option.type,
			name: option.name,
			details: option.details
		};
		if (option.iban) {
			draft.seller.iban = option.iban;
		}
		if (option.bankName) {
			draft.seller.bankName = option.bankName;
		}
		paymentMethodModalOpen = false;
	}

	// Derived totals
	let totals = $derived(calculateProformaTotals(draft.items, draft.taxRate, draft.adjustment || 0));

	let currentSellerDraft = $derived(
		draft.seller.entityId && businessDraft?.sellers ? businessDraft.sellers[draft.seller.entityId] : undefined
	);

	// Re-calculate line total when price/qty/discount changes
	function updateLine(index: number) {
		const item = draft.items[index];
		if (!item || item.type === 'heading') return;
		item.total = calculateLineTotal(item.price, item.quantity, item.discountPercent);
	}

	function addItem() {
		draft.items.push({
			id: `item-${crypto.randomUUID()}`,
			type: 'item',
			name: '',
			description: '',
			price: 0,
			quantity: 1,
			unit: 'послуга',
			discountPercent: 0,
			total: 0
		});
	}

	function addHeading() {
		draft.items.push({
			id: `heading-${crypto.randomUUID()}`,
			type: 'heading',
			name: 'Новий розділ',
			price: 0,
			quantity: 0,
			unit: '',
			discountPercent: 0,
			total: 0
		});
	}

	function removeItem(index: number) {
		draft.items.splice(index, 1);
	}

	function moveItem(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= draft.items.length) return;
		const [moved] = draft.items.splice(index, 1);
		draft.items.splice(newIndex, 0, moved);
	}

	function selectSeller(entity: BusinessEntity) {
		const sellerDraft = businessDraft?.sellers ? businessDraft.sellers[entity.id] : undefined;
		const isVat =
			sellerDraft?.vatStatus === 'vat' ||
			(sellerDraft?.vatStatus !== 'no-vat' && entity.businessType === 'tov');

		draft.seller = {
			entityId: entity.id,
			name: entity.displayName || entity.businessName,
			taxId: entity.taxId,
			iban: entity.iban,
			bankName: entity.bankName,
			vatStatus: isVat ? 'vat' : 'no-vat',
			legalAddress: ''
		};

		// 20% VAT according to Ukrainian law if VAT payer, 0% otherwise
		draft.taxRate = isVat ? 20 : 0;

		// Payment method from business acceptance model:
		const mode = businessDraft?.mode ?? 'direct';
		if (mode === 'finance-company') {
			draft.paymentMethod = {
				type: 'iban',
				name: `Оплата через фінкомпанію (${businessDraft?.financeName || 'Фінкомпанія'})`,
				details: businessDraft?.financeIban
					? `IBAN: ${businessDraft.financeIban} (ЄДРПОУ: ${businessDraft.financeTaxId})`
					: 'IBAN фінкомпанії не вказано'
			};
		} else {
			draft.paymentMethod = {
				type: 'iban',
				name: 'Безготівковий розрахунок (Власний IBAN)',
				details: entity.iban
					? `IBAN: ${entity.iban}${entity.bankName ? ` (${entity.bankName})` : ''}`
					: 'Обов’язкове поле'
			};
		}

		// Numbering: take prefix and nextNumber from sellerDraft if present
		if (sellerDraft && sellerDraft.prefix) {
			const seq =
				Number.isSafeInteger(sellerDraft.nextNumber) && sellerDraft.nextNumber > 0
					? String(sellerDraft.nextNumber).padStart(Math.min(12, Math.max(1, sellerDraft.padding || 1)), '0')
					: '001';
			draft.number = [sellerDraft.prefix, seq].filter(Boolean).join('-');
		}

		// Purpose: take from sellerDraft / businessDraft preview or rules
		if (businessDraft) {
			const prev = businessInvoicePreview(businessDraft, entity, new Date(draft.issueDate || Date.now()));
			draft.purpose = prev.finalPurpose;
		} else {
			refreshPurpose();
		}

		sellerModalOpen = false;
	}

	function refreshPurpose() {
		const currentEntity = entities.find((e) => e.id === draft.seller.entityId);
		if (businessDraft && currentEntity) {
			const prev = businessInvoicePreview(businessDraft, currentEntity, new Date(draft.issueDate || Date.now()));
			draft.purpose = prev.finalPurpose;
		} else if (rules) {
			draft.purpose = formatPaymentPurpose(rules, {
				number: draft.number,
				date: new Date(draft.issueDate || Date.now()),
				scenario: 'fixed',
				customer: draft.customer.name
			});
		} else {
			draft.purpose = `Оплата згідно рахунку №${draft.number} від ${new Date(draft.issueDate || Date.now()).toLocaleDateString('uk-UA')}, ${draft.taxRate > 0 ? `у т.ч. ПДВ ${draft.taxRate}%` : 'без ПДВ'}.`;
		}
	}

	async function handleSaveDraft() {
		saving = true;
		actionMessage = null;
		try {
			if (draft.status !== 'invoice_created') {
				draft.status = 'draft';
			}
			draft.totals = totals;
			await onSave?.(draft);
			actionMessage = 'Чернетку успішно збережено!';
			setTimeout(() => (actionMessage = null), 3000);
		} finally {
			saving = false;
		}
	}

	async function handleCreateInvoice() {
		creatingInvoice = true;
		actionMessage = null;
		try {
			draft.totals = totals;
			const res = await onCreateInvoice?.(draft);
			if (res && res.invoiceId) {
				draft.status = 'invoice_created';
				draft.invoiceId = res.invoiceId;
			}
			actionMessage = 'Офіційний рахунок успішно створено!';
			setTimeout(() => (actionMessage = null), 4000);
		} catch (err) {
			actionMessage = err instanceof Error ? err.message : 'Не вдалося створити рахунок.';
			setTimeout(() => (actionMessage = null), 5000);
		} finally {
			creatingInvoice = false;
		}
	}

	async function handleSend() {
		sending = true;
		actionMessage = null;
		try {
			draft.totals = totals;
			await onSend?.(draft);
			actionMessage = 'Рахунок надіслано!';
			setTimeout(() => (actionMessage = null), 4000);
		} finally {
			sending = false;
		}
	}
</script>

<div class="mx-auto max-w-5xl pb-32 text-zinc-900">
	<!-- Top Bar / Header -->
	<header class="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
		<div class="flex items-center gap-3">
			<input
				type="text"
				bind:value={draft.title}
				class="border-b-2 border-dotted border-zinc-400 bg-transparent text-2xl font-black tracking-tight text-zinc-950 focus:border-blue-600 focus:outline-none"
				placeholder="Рахунок-фактура"
			/>
			<div class="flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 shadow-sm">
				<span class="text-xs font-bold text-zinc-400 mr-1.5">№</span>
				<input
					type="text"
					bind:value={draft.number}
					class="w-24 text-sm font-extrabold text-zinc-900 bg-transparent focus:outline-none"
					placeholder="01-123"
				/>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<!-- Issue Date -->
			<label class="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs shadow-sm hover:border-zinc-300">
				<Calendar size={16} class="text-zinc-400" />
				<div>
					<span class="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Дата рахунку</span>
					<input
						type="date"
						bind:value={draft.issueDate}
						onchange={refreshPurpose}
						class="text-xs font-bold text-zinc-900 bg-transparent focus:outline-none cursor-pointer"
					/>
				</div>
			</label>

			<!-- Due Date -->
			<label class="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs shadow-sm hover:border-zinc-300">
				<Calendar size={16} class="text-zinc-400" />
				<div>
					<span class="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Оплатити до</span>
					<input
						type="date"
						bind:value={draft.dueDate}
						class="text-xs font-bold text-zinc-900 bg-transparent focus:outline-none cursor-pointer"
					/>
				</div>
			</label>
		</div>
	</header>

	<!-- Status Banner if Invoice was created -->
	{#if draft.status === 'invoice_created' && draft.invoiceId}
		<div class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 shadow-sm">
			<div class="flex items-center gap-3.5">
				<div class="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
					<CheckCircle2 size={22} />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<strong class="text-sm font-extrabold">Рахунок успішно створено!</strong>
						<span class="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
							№ {draft.number}
						</span>
					</div>
					<p class="mt-0.5 text-xs text-emerald-700">
						Рахунок додано в систему оплат (розділ «Рахунки»). Клієнт може оплатити його онлайн або через IBAN.
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2.5">
				<a
					href={`/dashboard/invoices/${draft.invoiceId}`}
					class="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
				>
					Переглянути в «Рахунки» ↗
				</a>
				<a
					href={`/pay/${draft.invoiceId}`}
					target="_blank"
					rel="noreferrer"
					class="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 transition"
				>
					Сторінка оплати
				</a>
			</div>
		</div>
	{/if}

	<!-- Seller & Buyer Section (2 cards) -->
	<section class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
		<!-- From (Від кого) -->
		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-bold text-zinc-700">Від кого (Продавець)</span>
				{#if businessDraft?.mode}
					<span class="text-[10px] text-zinc-400">
						{businessDraft.mode === 'finance-company' ? 'Через фінкомпанію' : 'Власний IBAN'}
					</span>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (sellerModalOpen = true)}
				class="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
			>
				<div class="flex items-center gap-3.5 text-left min-w-0">
					<div class="grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition shrink-0">
						<Store size={20} />
					</div>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<strong class="text-sm font-bold text-zinc-900 truncate">
								{draft.seller.name || 'Вибрати продавця'}
							</strong>
							{#if draft.taxRate === 20}
								<span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 shrink-0">
									ПДВ 20%
								</span>
							{:else}
								<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
									Без ПДВ
								</span>
							{/if}
						</div>
						<div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
							{#if draft.seller.taxId}
								<span>ЄДРПОУ: {draft.seller.taxId}</span>
							{/if}
							{#if draft.seller.iban}
								<span>•</span>
								<span class="font-mono text-[11px]">{draft.seller.iban.slice(0, 14)}...</span>
							{/if}
						</div>
					</div>
				</div>
				<ChevronRight size={18} class="text-zinc-400 group-hover:text-zinc-700 shrink-0 ml-2" />
			</button>
		</div>

		<!-- To (Кому) -->
		<div>
			<span class="mb-2 block text-xs font-bold text-zinc-700">Кому</span>
			<button
				type="button"
				onclick={() => (customerModalOpen = true)}
				class="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
			>
				<div class="flex items-center gap-3.5 text-left">
					<div class="grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
						<Users size={20} />
					</div>
					<div>
						<strong class="block text-sm font-bold text-zinc-900">
							{draft.customer.name || 'Вибрати або створити кому'}
						</strong>
						<span class="text-xs text-zinc-500">
							{draft.customer.taxId ? `ЄДРПОУ: ${draft.customer.taxId}` : 'Клієнт'}
						</span>
					</div>
				</div>
				<ChevronRight size={18} class="text-zinc-400 group-hover:text-zinc-700" />
			</button>
		</div>
	</section>

	<!-- Line Items Table -->
	<section class="mt-10">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-base font-extrabold text-zinc-950">Перелік товарів та послуг</h2>
			<div class="flex items-center gap-2">
				<select
					bind:value={draft.currency}
					class="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 shadow-sm focus:outline-none"
				>
					<option value="UAH">Гривня, ₴</option>
					<option value="USD">Долар, $</option>
					<option value="EUR">Євро, €</option>
				</select>
			</div>
		</div>

		<!-- Table Container -->
		<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
			<div class="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 text-[11px] font-bold text-zinc-500 grid grid-cols-12 gap-3 items-center">
				<div class="col-span-1 text-center w-8"></div>
				<div class="col-span-5">Найменування</div>
				<div class="col-span-2 text-right">Ціна, {formatCurrencySign(draft.currency)}</div>
				<div class="col-span-1 text-center">Кількість</div>
				<div class="col-span-1 text-center">Знижка</div>
				<div class="col-span-2 text-right">Сума</div>
			</div>

			<div class="divide-y divide-zinc-100">
				{#each draft.items as item, index (item.id)}
					{#if item.type === 'heading'}
						<!-- Heading row -->
						<div class="flex items-center justify-between bg-zinc-50 px-4 py-3">
							<div class="flex items-center gap-2 flex-1">
								<span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Розділ:</span>
								<input
									type="text"
									bind:value={item.name}
									class="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-zinc-900 focus:border-zinc-300 focus:bg-white focus:outline-none"
									placeholder="Введіть назву розділу..."
								/>
							</div>
							<button
								type="button"
								onclick={() => removeItem(index)}
								class="text-zinc-400 hover:text-red-500 p-1"
								aria-label="Видалити розділ"
							>
								<Trash2 size={16} />
							</button>
						</div>
					{:else}
						<!-- Item row -->
						<div class="grid grid-cols-12 gap-3 items-start px-4 py-3.5 hover:bg-zinc-50/50 transition">
							<!-- Reorder buttons -->
							<div class="col-span-1 flex flex-col items-center gap-1 text-zinc-400 pt-1.5">
								<button
									type="button"
									disabled={index === 0}
									onclick={() => moveItem(index, 'up')}
									class="hover:text-zinc-700 disabled:opacity-20"
									aria-label="Вгору"
								>
									<ChevronUp size={14} />
								</button>
								<button
									type="button"
									disabled={index === draft.items.length - 1}
									onclick={() => moveItem(index, 'down')}
									class="hover:text-zinc-700 disabled:opacity-20"
									aria-label="Вниз"
								>
									<ChevronDown size={14} />
								</button>
							</div>

							<!-- Name & Description -->
							<div class="col-span-5 space-y-1.5">
								<div class="relative flex items-center">
									<input
										type="text"
										bind:value={item.name}
										class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 focus:border-blue-600 focus:outline-none"
										placeholder="Назва товару або послуги"
									/>
									{#if item.name}
										<button
											type="button"
											onclick={() => (item.name = '')}
											class="absolute right-2 text-zinc-300 hover:text-zinc-600"
										>
											<XCircle size={14} />
										</button>
									{/if}
								</div>
								<input
									type="text"
									bind:value={item.description}
									class="w-full rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-1 text-[11px] text-zinc-600 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
									placeholder="Додатковий опис або деталізація..."
								/>
							</div>

							<!-- Price -->
							<div class="col-span-2">
								<input
									type="number"
									step="0.01"
									bind:value={item.price}
									oninput={() => updateLine(index)}
									class="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-right text-xs font-bold tabular-nums text-zinc-900 focus:border-blue-600 focus:outline-none"
									placeholder="0.00"
								/>
							</div>

							<!-- Quantity & Unit -->
							<div class="col-span-1 flex items-center gap-1">
								<input
									type="number"
									min="1"
									bind:value={item.quantity}
									oninput={() => updateLine(index)}
									class="w-12 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-xs font-bold tabular-nums text-zinc-900 focus:border-blue-600 focus:outline-none"
								/>
								<span class="text-[11px] text-zinc-500">{item.unit}</span>
							</div>

							<!-- Discount -->
							<div class="col-span-1">
								<input
									type="number"
									min="0"
									max="100"
									bind:value={item.discountPercent}
									oninput={() => updateLine(index)}
									class="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-zinc-700 focus:border-blue-600 focus:outline-none"
									placeholder="0%"
								/>
							</div>

							<!-- Line Total & Delete -->
							<div class="col-span-2 flex items-center justify-end gap-2 pt-1.5">
								<span class="text-xs font-bold tabular-nums text-zinc-950">
									{formatProformaMoney(item.total, draft.currency)}
								</span>
								<button
									type="button"
									onclick={() => removeItem(index)}
									class="text-zinc-300 hover:text-red-500 p-1 transition"
									aria-label="Видалити"
								>
									<Trash2 size={16} />
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<!-- Add Actions Under Table -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 p-4">
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={addItem}
						class="flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 active:scale-95 transition"
					>
						<Plus size={15} />
						Додати продукт або послугу
					</button>
					<button
						type="button"
						onclick={addHeading}
						class="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
					>
						<span class="font-serif font-black text-sm">A</span>
						Додати заголовок
					</button>
				</div>

				<button
					type="button"
					onclick={() => alert('Каталог товарів та послуг у розробці')}
					class="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition"
				>
					<Folder size={15} />
					Обрати з каталогу
				</button>
			</div>
		</div>
	</section>

	<!-- Two-column Bottom Section -->
	<section class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
		<!-- Left: Payment Method, Purpose, Notes -->
		<div class="space-y-6 lg:col-span-7">
			<!-- Payment Method -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-bold text-zinc-700">Спосіб оплати</span>
					<div class="flex items-center gap-2">
						<span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
							{#if businessDraft?.mode === 'finance-company'}
								Модель: Через фінкомпанію
							{:else if businessDraft?.mode === 'direct'}
								Модель: На власний IBAN
							{:else}
								Модель: Власний IBAN
							{/if}
						</span>
						<button
							type="button"
							onclick={() => (paymentMethodModalOpen = true)}
							class="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
						>
							Змінити
						</button>
					</div>
				</div>

				<button
					type="button"
					onclick={() => (paymentMethodModalOpen = true)}
					class="group flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow text-left"
				>
					<div class="flex items-center gap-3.5 min-w-0 flex-1">
						<div class="grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition shrink-0">
							{#if draft.paymentMethod.type === 'iban'}
								<Landmark size={20} />
							{:else if draft.paymentMethod.type === 'card'}
								<CreditCard size={20} />
							{:else}
								<WalletCards size={20} />
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<strong class="block text-sm font-bold text-zinc-900 truncate">
									{draft.paymentMethod.name}
								</strong>
								<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 shrink-0">
									Способи оплати та банки
								</span>
							</div>
							<span class="text-xs text-zinc-500 font-mono block break-all mt-0.5">
								{draft.paymentMethod.details}
							</span>
						</div>
					</div>
					<ChevronRight size={18} class="text-zinc-400 group-hover:text-zinc-700 shrink-0 ml-2" />
				</button>

				{#if businessDraft?.mode === 'finance-company' && currentSellerDraft}
					<div class="mt-2.5 rounded-xl bg-zinc-50 p-2.5 text-[11px] text-zinc-600 border border-zinc-100 space-y-1">
						<span class="font-bold text-zinc-800 block">Дані підключення продавця:</span>
						<div class="flex flex-wrap gap-x-3 gap-y-1">
							<span>ID продавця у провайдері: <strong class="font-mono text-zinc-900">{currentSellerDraft.providerSellerId || 'Не вказано'}</strong></span>
							{#if currentSellerDraft.providerCode}
								<span>Код: <strong class="font-mono text-zinc-900">{currentSellerDraft.providerCode}</strong></span>
							{/if}
							{#if currentSellerDraft.contractReference}
								<span>Договір: <strong class="font-mono text-zinc-900">{currentSellerDraft.contractReference}</strong></span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Payment Purpose -->
			<div>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-bold text-zinc-700">Призначення платежу</span>
					<button
						type="button"
						onclick={() => (editPurposeOpen = !editPurposeOpen)}
						class="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
					>
						<Pencil size={13} />
						{editPurposeOpen ? 'Згорнути' : 'Редагувати'}
					</button>
				</div>
				<div class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
					{#if editPurposeOpen}
						<textarea
							rows="3"
							bind:value={draft.purpose}
							class="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
						></textarea>
						<button
							type="button"
							onclick={refreshPurpose}
							class="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
						>
							<RotateCw size={12} />
							Відновити шаблон за замовчуванням
						</button>
					{:else}
						<p class="text-xs font-medium text-zinc-800 leading-relaxed">
							{draft.purpose}
						</p>
					{/if}
				</div>
			</div>

			<!-- Notes Button -->
			<div>
				{#if notesOpen}
					<div class="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
						<span class="block text-xs font-bold text-zinc-700">Примітки / умови договору</span>
						<textarea
							rows="3"
							bind:value={draft.notes}
							class="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
							placeholder="Вкажіть додаткові коментарі, умови оплати, гарантії чи реквізити..."
						></textarea>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (notesOpen = true)}
						class="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
					>
						<FileText size={15} />
						Додати примітки
					</button>
				{/if}
			</div>
		</div>

		<!-- Right: Financial Summary -->
		<div class="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-5">
			<div class="space-y-3 text-xs text-zinc-600">
				<div class="flex items-center justify-between">
					<span>Сума</span>
					<strong class="text-sm font-extrabold text-zinc-900 tabular-nums">
						{formatProformaMoney(totals.subtotal, draft.currency)}
					</strong>
				</div>

				<div class="flex items-center justify-between">
					<span>Знижка</span>
					<span class="font-bold tabular-nums text-zinc-900">
						{totals.discountTotal > 0 ? `- ${formatProformaMoney(totals.discountTotal, draft.currency)}` : '0.00 ₴'}
					</span>
				</div>

				<div class="flex items-center justify-between">
					<span>Податок</span>
					<span class="font-semibold text-zinc-800">
						{draft.taxRate > 0 ? `${draft.taxRate}% ПДВ: ${formatProformaMoney(totals.taxAmount, draft.currency)}` : 'Без податків'}
					</span>
				</div>

				<div class="flex items-center justify-between">
					<span>Коригування</span>
					<span class="text-zinc-500">Немає</span>
				</div>
			</div>

			<div class="border-t border-zinc-200 pt-4">
				<div class="flex items-baseline justify-between">
					<span class="text-sm font-bold text-zinc-900">Всього</span>
					<strong class="text-2xl font-black text-zinc-950 tabular-nums">
						{formatProformaMoney(totals.total, draft.currency)}
					</strong>
				</div>
				<button
					type="button"
					onclick={() => alert('Конвертація валют за офіційним курсом НБУ')}
					class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-blue-600 transition"
				>
					<Repeat size={13} />
					Конвертація валюти
				</button>
			</div>
		</div>
	</section>

	<!-- Additional Settings (3 Cards in a row) -->
	<section class="mt-10">
		<h3 class="mb-3 text-xs font-bold text-zinc-700">Додаткові налаштування</h3>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<!-- Appearance -->
			<button
				type="button"
				class="group flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow"
			>
				<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
					<Pencil size={18} />
				</div>
				<div>
					<strong class="block text-xs font-bold text-zinc-900">Налаштування вигляду</strong>
					<span class="text-[11px] text-zinc-500">{draft.appearanceTemplate}</span>
				</div>
			</button>

			<!-- Recurrence -->
			<button
				type="button"
				onclick={() => (recurrenceModalOpen = true)}
				class="group flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow"
			>
				<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-purple-50 group-hover:text-purple-600 transition">
					<Repeat size={18} />
				</div>
				<div>
					<strong class="block text-xs font-bold text-zinc-900">Регулярність рахунку</strong>
					<span class="text-[11px] text-zinc-500 font-semibold">
						{#if draft.recurrence === 'monthly'}
							Щомісяця (Регулярний)
						{:else if draft.recurrence === 'weekly'}
							Щотижня
						{:else if draft.recurrence === 'quarterly'}
							Щокварталу
						{:else}
							Без повтору
						{/if}
					</span>
				</div>
			</button>

			<!-- Projects & Groups -->
			<button
				type="button"
				onclick={() => (projectModalOpen = true)}
				class="group flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow"
			>
				<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
					<Folder size={18} />
				</div>
				<div>
					<strong class="block text-xs font-bold text-zinc-900">Проєкти та групи</strong>
					<span class="text-[11px] text-zinc-500 font-semibold">{draft.projectGroup || 'Без проєкту'}</span>
				</div>
			</button>
		</div>
	</section>

	<!-- Feedback Message -->
	{#if actionMessage}
		<div class="fixed bottom-24 right-8 z-40 rounded-xl bg-zinc-950 px-5 py-3 text-xs font-bold text-white shadow-xl">
			{actionMessage}
		</div>
	{/if}

	<!-- Sticky Action Bar -->
	<footer class="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-6 py-3.5 backdrop-blur shadow-lg">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={() => (previewOpen = true)}
					class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
				>
					<Eye size={16} />
					Передогляд
				</button>
				<button
					type="button"
					onclick={() => (actModalOpen = true)}
					class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
				>
					<ShieldCheck size={16} class={draft.act?.status === 'signed' ? 'text-emerald-600' : 'text-blue-600'} />
					{draft.act?.status === 'signed' ? 'Акт підписано (Дія)' : 'Акт'}
				</button>
				<button
					type="button"
					onclick={handleSaveDraft}
					disabled={saving}
					class="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 active:scale-95 transition disabled:opacity-50"
				>
					<Save size={16} />
					{saving ? 'Збереження...' : 'Зберегти чернетку'}
				</button>
			</div>

			<div class="flex items-center gap-3">
				{#if draft.status === 'invoice_created' && draft.invoiceId}
					<a
						href={`/dashboard/invoices/${draft.invoiceId}`}
						class="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition"
					>
						<CheckCircle2 size={16} />
						Рахунок створено ↗
					</a>
				{:else}
					<a
						href={`/dashboard/invoices/new?type=fixed&proformaId=${draft.id}`}
						class="hidden sm:flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
					>
						Створити як Фіксований рахунок ↗
					</a>
					<button
						type="button"
						onclick={handleCreateInvoice}
						disabled={creatingInvoice || totals.total <= 0}
						class="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
					>
						<Send size={16} />
						{creatingInvoice ? 'Створення рахунку...' : 'Створити рахунок'}
					</button>
				{/if}
			</div>
		</div>
	</footer>

	<!-- Preview Modal -->
	<ProformaPreviewModal bind:open={previewOpen} {draft} {totals} />

	<!-- Act Modal -->
	{#if actModalOpen}
		{#key `${draft.id}-${draft.act?.status ?? 'none'}`}
			<ProformaActModal
				bind:open={actModalOpen}
				proforma={draft}
				onSaveAct={(act) => {
					draft.act = act;
					if (onSave) void onSave(draft);
				}}
			/>
		{/key}
	{/if}

	<!-- Seller Modal -->
	{#if sellerModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
			<div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
				<div class="flex items-center justify-between shrink-0">
					<div>
						<h3 class="text-base font-extrabold text-zinc-950">Вибір продавця (Структура бізнесу)</h3>
						<p class="text-xs text-zinc-500">Оберіть юридичну особу чи ФОП з налаштованими реквізитами та податками</p>
					</div>
					<button type="button" onclick={() => (sellerModalOpen = false)} class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
						<X size={18} />
					</button>
				</div>

				<!-- Business Acceptance Model Card -->
				<div class="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 shrink-0">
					<div class="flex flex-wrap items-center justify-between gap-2 font-bold">
						<span>Модель приймання платежів:</span>
						<span class="rounded-md bg-blue-200/80 px-2 py-0.5 text-[11px] font-extrabold text-blue-950">
							{#if businessDraft?.mode === 'finance-company'}
								Через фінкомпанію
							{:else if businessDraft?.mode === 'direct'}
								На власний IBAN
							{:else}
								Власний IBAN (за замовчуванням)
							{/if}
						</span>
					</div>
					<p class="mt-1 text-[11px] text-blue-800">
						{#if businessDraft?.mode === 'finance-company'}
							Одна модель для бізнесу: спільний отримувач <strong class="text-blue-950">{businessDraft.financeName || 'Фінкомпанія'}</strong> (IBAN: {businessDraft.financeIban || 'не вказано'}), а дані підключення зберігаються окремо для кожного продавця.
						{:else if businessDraft?.mode === 'direct'}
							Пряма модель: кожен продавець є окремим отримувачем коштів безпосередньо на власний IBAN.
						{:else}
							Прямі безготівкові платежі на рахунок обраного продавця.
						{/if}
					</p>
				</div>

				<!-- Seller List -->
				<div class="divide-y divide-zinc-100 overflow-y-auto space-y-2 pr-1">
					{#each entities as entity}
						{@const sellerDraft = businessDraft?.sellers ? businessDraft.sellers[entity.id] : undefined}
						{@const isVat = sellerDraft?.vatStatus === 'vat' || (sellerDraft?.vatStatus !== 'no-vat' && entity.businessType === 'tov')}
						{@const isSelected = draft.seller.entityId === entity.id}
						<button
							type="button"
							onclick={() => selectSeller(entity)}
							class="flex w-full items-start justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {isSelected ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
						>
							<div class="space-y-1.5 min-w-0 pr-3">
								<div class="flex flex-wrap items-center gap-2">
									<strong class="text-sm font-bold text-zinc-950">{entity.displayName || entity.businessName}</strong>
									<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
										{entity.businessType}
									</span>
									{#if isVat}
										<span class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">
											Платник ПДВ 20%
										</span>
									{:else}
										<span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
											Без ПДВ
										</span>
									{/if}
								</div>

								<div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-600">
									<span>ЄДРПОУ/РНОКПП: <strong class="font-mono text-zinc-900">{entity.taxId}</strong></span>
									{#if entity.iban}
										<span>• IBAN: <span class="font-mono text-[11px] text-zinc-800">{entity.iban}</span></span>
									{/if}
									{#if entity.bankName}
										<span>({entity.bankName})</span>
									{/if}
								</div>

								{#if businessDraft?.mode === 'finance-company' && sellerDraft}
									<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600 bg-zinc-100/70 px-2.5 py-1.5 rounded-lg">
										<span class="font-semibold text-zinc-700">Підключення:</span>
										<span>ID: <strong class="text-zinc-900 font-mono">{sellerDraft.providerSellerId || '—'}</strong></span>
										{#if sellerDraft.providerCode}
											<span>Код: <strong class="text-zinc-900 font-mono">{sellerDraft.providerCode}</strong></span>
										{/if}
										{#if sellerDraft.contractReference}
											<span>Договір: <strong class="text-zinc-900 font-mono">{sellerDraft.contractReference}</strong></span>
										{/if}
									</div>
								{/if}
							</div>

							<div class="shrink-0 pt-1">
								{#if isSelected}
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
										<CheckCircle2 size={13} />
										Обрано
									</span>
								{:else}
									<span class="text-xs font-bold text-blue-600 hover:text-blue-800">
										Обрати →
									</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Customer Modal -->
	{#if customerModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
			<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-base font-bold text-zinc-900">Реквізити клієнта (Кому)</h3>
					<button type="button" onclick={() => (customerModalOpen = false)} class="text-zinc-400 hover:text-zinc-600">
						<X size={18} />
					</button>
				</div>
				<div class="space-y-3 text-xs">
					<label class="block">
						<span class="font-bold text-zinc-700 block mb-1">Назва компанії або ПІБ</span>
						<input
							type="text"
							bind:value={draft.customer.name}
							oninput={refreshPurpose}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 focus:border-blue-600 focus:outline-none"
							placeholder="ТОВ «Клієнт» або Іваненко І.І."
						/>
					</label>
					<label class="block">
						<span class="font-bold text-zinc-700 block mb-1">ЄДРПОУ або РНОКПП</span>
						<input
							type="text"
							bind:value={draft.customer.taxId}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 focus:border-blue-600 focus:outline-none"
							placeholder="12345678"
						/>
					</label>
					<label class="block">
						<span class="font-bold text-zinc-700 block mb-1">Email для відправки</span>
						<input
							type="email"
							bind:value={draft.customer.email}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 focus:border-blue-600 focus:outline-none"
							placeholder="client@example.com"
						/>
					</label>
					<label class="block">
						<span class="font-bold text-zinc-700 block mb-1">Телефон</span>
						<input
							type="tel"
							bind:value={draft.customer.phone}
							class="w-full rounded-lg border border-zinc-200 px-3 py-2 focus:border-blue-600 focus:outline-none"
							placeholder="+380..."
						/>
					</label>
				</div>
				<div class="pt-2 flex justify-end">
					<button
						type="button"
						onclick={() => (customerModalOpen = false)}
						class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
					>
						Зберегти клієнта
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Payment Method Modal (Способи оплати та банки) -->
	{#if paymentMethodModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
			<div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
				<div class="flex items-center justify-between shrink-0">
					<div>
						<h3 class="text-base font-extrabold text-zinc-950">Спосіб оплати та рахунки</h3>
						<p class="text-xs text-zinc-500">Вибір рахунку або платіжного методу з розділу «Способи оплати та банки»</p>
					</div>
					<button type="button" onclick={() => (paymentMethodModalOpen = false)} class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
						<X size={18} />
					</button>
				</div>

				<!-- Acceptance Model Banner -->
				<div class="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 shrink-0">
					<div class="flex flex-wrap items-center justify-between gap-2 font-bold">
						<span>Поточна модель бізнесу:</span>
						<span class="rounded-md bg-blue-200/80 px-2 py-0.5 text-[11px] font-extrabold text-blue-950">
							{#if businessDraft?.mode === 'finance-company'}
								Через фінкомпанію
							{:else if businessDraft?.mode === 'direct'}
								На власний IBAN
							{:else}
								Власний IBAN
							{/if}
						</span>
					</div>
					<p class="mt-1 text-[11px] text-blue-800">
						{#if businessDraft?.mode === 'finance-company'}
							Кошти надходять на рахунок фінкомпанії <strong class="text-blue-950">{businessDraft.financeName || 'Фінкомпанія'}</strong> з подальшим розподілом продавцям.
						{:else}
							Пряме зарахування коштів клієнтів на банківські IBAN рахунки вашого бізнесу чи обраного продавця.
						{/if}
					</p>
				</div>

				<!-- Options List -->
				<div class="overflow-y-auto space-y-4 pr-1">
					<!-- Group 1: Connected Banks from Payment Methods -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
								Підключені рахунки банків (Способи оплати та банки)
							</span>
							<span class="text-[10px] text-zinc-400">
								Синхронізовані акаунти
							</span>
						</div>

						<div class="space-y-2">
							{#if connectedBankAccounts.length === 0}
								<div class="rounded-xl border border-dashed border-zinc-200 p-3 text-center text-xs text-zinc-500">
									Немає підключених банківських акаунтів. Додайте їх у розділі «Способи оплати та банки».
								</div>
							{:else}
								{#each connectedBankAccounts as bankAcc}
									{@const isSelected = draft.seller.iban === bankAcc.iban || draft.paymentMethod.details.includes(bankAcc.iban)}
									<button
										type="button"
										onclick={() =>
											selectPaymentOption({
												type: 'iban',
												name: bankAcc.accountName,
												details: `IBAN: ${bankAcc.iban} (${bankAcc.bankLabel})`,
												iban: bankAcc.iban,
												bankName: bankAcc.bankLabel
											})}
										class="flex w-full items-center justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {isSelected ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
									>
										<div class="flex items-center gap-3 min-w-0 pr-2">
											<div class="grid size-10 place-items-center rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/60">
												{#if bankAcc.logo}
													<img src={bankAcc.logo} alt={bankAcc.bankLabel} class="size-full object-cover" />
												{:else}
													<Landmark size={18} class="text-zinc-600" />
												{/if}
											</div>
											<div class="space-y-0.5 min-w-0">
												<div class="flex items-center gap-2">
													<strong class="text-xs font-bold text-zinc-950 truncate">{bankAcc.accountName}</strong>
													{#if bankAcc.isActive}
														<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Активний</span>
													{/if}
												</div>
												<span class="font-mono text-[11px] text-zinc-600 block truncate">{bankAcc.iban}</span>
												{#if bankAcc.balanceFormatted}
													<span class="text-[11px] font-semibold text-zinc-800 block">Баланс: {bankAcc.balanceFormatted}</span>
												{/if}
											</div>
										</div>

										<div class="shrink-0">
											{#if isSelected}
												<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
													<Check size={12} />
													Обрано
												</span>
											{:else}
												<span class="text-xs font-bold text-blue-600 hover:text-blue-800">Обрати →</span>
											{/if}
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<!-- Group 2: Business Entities / Sellers Accounts -->
					{#if entities.length > 0}
						<div>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
									Рахунки продавців (Структура бізнесу)
								</span>
								<span class="text-[10px] text-zinc-400">
									Юрособи та ФОП
								</span>
							</div>

							<div class="space-y-2">
								{#each entities as ent}
									{#if ent.iban}
										{@const isSelected = draft.seller.iban === ent.iban}
										<button
											type="button"
											onclick={() =>
												selectPaymentOption({
													type: 'iban',
													name: ent.displayName || ent.businessName,
													details: `IBAN: ${ent.iban}${ent.bankName ? ` (${ent.bankName})` : ''}`,
													iban: ent.iban,
													bankName: ent.bankName
												})}
											class="flex w-full items-center justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {isSelected ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
										>
											<div class="flex items-center gap-3 min-w-0 pr-2">
												<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700 shrink-0">
													<Building2 size={18} />
												</div>
												<div class="space-y-0.5 min-w-0">
													<div class="flex items-center gap-2">
														<strong class="text-xs font-bold text-zinc-950 truncate">{ent.displayName || ent.businessName}</strong>
														<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-700">{ent.businessType}</span>
														{#if draft.seller.entityId === ent.id}
															<span class="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-700">Поточний продавець</span>
														{/if}
													</div>
													<span class="font-mono text-[11px] text-zinc-600 block truncate">{ent.iban}</span>
													{#if ent.bankName}
														<span class="text-[11px] text-zinc-500 block">{ent.bankName} (ЄДРПОУ: {ent.taxId})</span>
													{/if}
												</div>
											</div>

											<div class="shrink-0">
												{#if isSelected}
													<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
														<Check size={12} />
														Обрано
													</span>
												{:else}
													<span class="text-xs font-bold text-blue-600 hover:text-blue-800">Обрати →</span>
												{/if}
											</div>
										</button>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<!-- Group 3: Finance Company (if configured) -->
					{#if businessDraft?.mode === 'finance-company' || businessDraft?.financeIban}
						<div>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
									Фінансова компанія (Спільний отримувач)
								</span>
							</div>

							<button
								type="button"
								onclick={() =>
									selectPaymentOption({
										type: 'iban',
										name: `Оплата через фінкомпанію (${businessDraft?.financeName || 'Фінкомпанія'})`,
										details: businessDraft?.financeIban
											? `IBAN: ${businessDraft.financeIban} (ЄДРПОУ: ${businessDraft.financeTaxId || '—'})`
											: 'IBAN фінкомпанії не вказано'
									})}
								class="flex w-full items-center justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {draft.paymentMethod.name.includes('фінкомпанію') || (Boolean(businessDraft?.financeIban) && draft.paymentMethod.details.includes(businessDraft?.financeIban || '')) ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
							>
								<div class="flex items-center gap-3 min-w-0 pr-2">
									<div class="grid size-10 place-items-center rounded-xl bg-purple-50 text-purple-700 shrink-0">
										<Building2 size={18} />
									</div>
									<div class="space-y-0.5 min-w-0">
										<strong class="text-xs font-bold text-zinc-950 block">{businessDraft?.financeName || 'Фінкомпанія'}</strong>
										{#if businessDraft?.financeIban}
											<span class="font-mono text-[11px] text-zinc-600 block">{businessDraft.financeIban}</span>
											<span class="text-[11px] text-zinc-500 block">ЄДРПОУ: {businessDraft.financeTaxId || '—'}</span>
										{:else}
											<span class="text-[11px] text-amber-600 block">Реквізити не налаштовані</span>
										{/if}
									</div>
								</div>

								<div class="shrink-0">
									{#if draft.paymentMethod.name.includes('фінкомпанію') || (Boolean(businessDraft?.financeIban) && draft.paymentMethod.details.includes(businessDraft?.financeIban || ''))}
										<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
											<Check size={12} />
											Обрано
										</span>
									{:else}
										<span class="text-xs font-bold text-blue-600 hover:text-blue-800">Обрати →</span>
									{/if}
								</div>
							</button>
						</div>
					{/if}

					<!-- Group 4: Online Cards / Wallets -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
								Онлайн-еквайринг та платіжні картки
							</span>
							<span class="text-[10px] font-semibold text-zinc-500">
								{paymentMethodsConfig.onboardingStatus === 'approved' ? 'Підключено' : 'Tranzzo'}
							</span>
						</div>

						<button
							type="button"
							onclick={() =>
								selectPaymentOption({
									type: 'card',
									name: 'Онлайн-оплата (Visa / Mastercard, Apple Pay, Google Pay)',
									details: 'Миттєва оплата карткою через захищений шлюз Tranzzo'
								})}
							class="flex w-full items-center justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {draft.paymentMethod.type === 'card' ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
						>
							<div class="flex items-center gap-3 min-w-0 pr-2">
								<div class="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
									<CreditCard size={18} />
								</div>
								<div class="space-y-0.5 min-w-0">
									<strong class="text-xs font-bold text-zinc-950 block">Платіжні картки та Apple Pay / Google Pay</strong>
									<span class="text-[11px] text-zinc-500 block">Клієнт зможе оплатити рахунок онлайн на платіжній сторінці</span>
								</div>
							</div>

							<div class="shrink-0">
								{#if draft.paymentMethod.type === 'card'}
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
										<Check size={12} />
										Обрано
									</span>
								{:else}
									<span class="text-xs font-bold text-blue-600 hover:text-blue-800">Обрати →</span>
								{/if}
							</div>
						</button>
					</div>

					<!-- Group 5: Cash / POS -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">
								Інші способи
							</span>
						</div>

						<button
							type="button"
							onclick={() =>
								selectPaymentOption({
									type: 'cash',
									name: 'Готівковий розрахунок / POS-термінал',
									details: 'Оплата в касі або кур’єру при отриманні товару чи наданні послуги'
								})}
							class="flex w-full items-center justify-between p-3.5 text-left rounded-xl transition hover:bg-zinc-50 border {draft.paymentMethod.type === 'cash' ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20' : 'border-zinc-200/80'}"
						>
							<div class="flex items-center gap-3 min-w-0 pr-2">
								<div class="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700 shrink-0">
									<WalletCards size={18} />
								</div>
								<div class="space-y-0.5 min-w-0">
									<strong class="text-xs font-bold text-zinc-950 block">Готівковий розрахунок / POS-термінал</strong>
									<span class="text-[11px] text-zinc-500 block">Оплата готівкою або через POS-термінал на місці</span>
								</div>
							</div>

							<div class="shrink-0">
								{#if draft.paymentMethod.type === 'cash'}
									<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
										<Check size={12} />
										Обрано
									</span>
								{:else}
									<span class="text-xs font-bold text-blue-600 hover:text-blue-800">Обрати →</span>
								{/if}
							</div>
						</button>
					</div>
				</div>

				<!-- Footer -->
				<div class="pt-3 border-t border-zinc-100 flex items-center justify-between shrink-0">
					<a
						href="/dashboard/payment-methods"
						target="_blank"
						class="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
					>
						<span>Налаштувати у «Способи оплати та банки»</span>
						<ExternalLink size={13} />
					</a>
					<button
						type="button"
						onclick={() => (paymentMethodModalOpen = false)}
						class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition"
					>
						Закрити
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Recurrence Modal -->
	{#if recurrenceModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
			<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="grid size-8 place-items-center rounded-lg bg-purple-100 text-purple-700">
							<Repeat size={16} />
						</div>
						<h3 class="text-base font-extrabold text-zinc-950">Періодичність рахунку</h3>
					</div>
					<button type="button" onclick={() => (recurrenceModalOpen = false)} class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
						<X size={18} />
					</button>
				</div>

				<p class="text-xs text-zinc-500">
					Вкажіть, чи є цей рахунок регулярним (підписка, щомісячні послуги, оренда). Регулярні рахунки зручно фільтрувати та копіювати в один клік у Журналі.
				</p>

				<div class="space-y-2">
					{#each [
						{ id: 'none', label: 'Без повтору', desc: 'Звичайний разовий рахунок' },
						{ id: 'monthly', label: 'Щомісяця', desc: 'Регулярний рахунок за абонплату чи щомісячні послуги' },
						{ id: 'weekly', label: 'Щотижня', desc: 'Повторюється щотижнево' },
						{ id: 'quarterly', label: 'Щокварталу', desc: 'Виставляється раз на квартал (3 місяці)' }
					] as opt}
						<button
							type="button"
							onclick={() => {
								draft.recurrence = opt.id as any;
								recurrenceModalOpen = false;
							}}
							class="flex w-full items-center justify-between p-3 text-left rounded-xl transition border {(draft.recurrence || 'none') === opt.id ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20' : 'border-zinc-200 hover:bg-zinc-50'}"
						>
							<div>
								<strong class="text-xs font-bold text-zinc-900 block">{opt.label}</strong>
								<span class="text-[11px] text-zinc-500 block">{opt.desc}</span>
							</div>
							{#if (draft.recurrence || 'none') === opt.id}
								<span class="rounded-full bg-purple-600 p-1 text-white">
									<Check size={12} />
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Project Group Modal -->
	{#if projectModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
			<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="grid size-8 place-items-center rounded-lg bg-blue-100 text-blue-700">
							<Folder size={16} />
						</div>
						<h3 class="text-base font-extrabold text-zinc-950">Проєкт або група</h3>
					</div>
					<button type="button" onclick={() => (projectModalOpen = false)} class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
						<X size={18} />
					</button>
				</div>

				<p class="text-xs text-zinc-500">
					Розподіл проформ за проєктами дозволяє зручно групувати, фільтрувати та вести окремий облік у Журналі.
				</p>

				<div class="space-y-3">
					<label class="block">
						<span class="text-xs font-bold text-zinc-700 block mb-1">Назва проєкту:</span>
						<input
							type="text"
							bind:value={draft.projectGroup}
							placeholder="Наприклад: Основний проєкт, Аутсорсинг, Маркетинг..."
							class="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
						/>
					</label>

					<div>
						<span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
							Швидкий вибір популярних проєктів:
						</span>
						<div class="flex flex-wrap gap-1.5">
							{#each ['Основний проєкт', 'IT Послуги', 'Аутсорсинг', 'Маркетинг', 'Консалтинг', 'Підтримка'] as tag}
								<button
									type="button"
									onclick={() => (draft.projectGroup = tag)}
									class="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition {draft.projectGroup === tag ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : ''}"
								>
									{tag}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="pt-3 border-t border-zinc-100 flex justify-end">
					<button
						type="button"
						onclick={() => (projectModalOpen = false)}
						class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
					>
						Готово
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
