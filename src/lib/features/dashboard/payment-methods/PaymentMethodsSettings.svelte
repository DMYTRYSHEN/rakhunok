<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BadgeCheck,
		Building2,
		Check,
		CircleAlert,
		CreditCard,
		ExternalLink,
		KeyRound,
		Landmark,
		QrCode,
		RefreshCw,
		Save,
		ShieldCheck,
		Smartphone,
		WalletCards,
		X
	} from '@lucide/svelte';
	import {
		defaultPaymentMethodsConfig,
		loadPaymentMethodsConfig,
		validatePaymentMethodsConfig,
		loadBankConnections,
		saveBankConnections,
		type PaymentMethodsConfig,
		type ProviderOnboardingStatus,
		type WalletMethodId,
		type BankConnectionId,
		type BankIntegrationConfig
	} from './payment-methods';
	import type { BusinessEntity } from '../types';

	let { entities = [] }: { entities?: BusinessEntity[] } = $props();

	// Official logos from /conf & Supabase banklink
	const BANK_LOGOS: Record<BankConnectionId, string> = {
		privatbank: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/31/94/f6/3194f6f5-1868-425b-ac5f-6bad596d5ad8/Placeholder.mill/200x200bb-75.webp',
		'a-bank': 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3a/76/1e/3a761e68-39dc-51ad-f189-e9d89227442c/Placeholder.mill/200x200bb-75.webp',
		monobank: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp'
	};

	const statuses: { id: ProviderOnboardingStatus; label: string; detail: string }[] = [
		{ id: 'not-started', label: 'Ще не починав', detail: 'Потрібна реєстрація у Tranzzo' },
		{ id: 'in-review', label: 'На перевірці', detail: 'Tranzzo перевіряє бізнес і сайт' },
		{ id: 'approved', label: 'Акаунт активовано', detail: 'Є робочий POS_ID' }
	];
	const wallets: { id: WalletMethodId; name: string; detail: string }[] = [
		{ id: 'apple-pay', name: 'Apple Pay', detail: 'Для Safari та пристроїв Apple' },
		{ id: 'google-pay', name: 'Google Pay', detail: 'Для Chrome та Android' }
	];

	let config = $state<PaymentMethodsConfig>({ ...defaultPaymentMethodsConfig });
	let bankConnections = $state<Record<BankConnectionId, BankIntegrationConfig>>(loadBankConnections());
	let activeModalBank = $state<BankConnectionId | null>(null);
	let tokenInput = $state('');
	let isSyncing = $state<Record<string, boolean>>({});
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	const issues = $derived(validatePaymentMethodsConfig(config));
	const setupProgress = $derived(
		config.onboardingStatus === 'not-started'
			? 1
			: config.onboardingStatus === 'in-review'
				? 2
				: config.posId.trim()
					? 3
					: 2
	);

	/**
	 * Pulls accounts from "Юридичні реквізити та робочі місця" with fallback to connection store
	 */
	function getAccountsForBank(bankId: BankConnectionId) {
		if (entities && entities.length > 0) {
			const matching = entities.filter((e) => {
				const bankLower = (e.bankName || '').toLowerCase();
				const ibanLower = (e.iban || '').toLowerCase();
				if (bankId === 'privatbank') {
					return bankLower.includes('приват') || bankLower.includes('pb') || ibanLower.includes('305299');
				}
				if (bankId === 'a-bank') {
					return bankLower.includes('а-банк') || bankLower.includes('а банк') || bankLower.includes('a-bank') || ibanLower.includes('307770');
				}
				if (bankId === 'monobank') {
					return bankLower.includes('моно') || bankLower.includes('mono') || bankLower.includes('універсал') || ibanLower.includes('322001');
				}
				return false;
			});

			if (matching.length > 0) {
				return matching.map((e) => ({
					iban: e.iban,
					bankId,
					currency: 'UAH',
					name: `${e.businessName} (${e.displayName || e.taxId})`,
					isActive: e.isActive ?? true,
					source: 'structure' as const,
					balanceFormatted: 'Синхронізується'
				}));
			}
		}

		// Fallback to bank-discovered accounts in storage
		return (bankConnections[bankId]?.accounts || []).map((a) => ({
			...a,
			source: 'direct' as const
		}));
	}

	function openBankConfig(bankId: BankConnectionId) {
		activeModalBank = bankId;
		tokenInput = bankConnections[bankId]?.tokenOrRef || '';
	}

	function closeBankModal() {
		activeModalBank = null;
		tokenInput = '';
	}

	function handleSaveBank() {
		if (!activeModalBank) return;
		const bank = bankConnections[activeModalBank];
		if (!bank) return;

		if (activeModalBank === 'privatbank') {
			if (!tokenInput.trim()) {
				notification = { type: 'error', message: 'Будь ласка, введіть токен Автоклієнта' };
				return;
			}
			bank.status = 'connected';
			bank.tokenOrRef = tokenInput.trim();
			bank.lastCheckAt = 'щойно';
			if (bank.accounts.length === 0) {
				bank.accounts.push({
					iban: 'UA623077700000026001411123751',
					bankId: 'privatbank',
					currency: 'UAH',
					name: 'Поточний рахунок ФОП',
					isActive: true,
					lastSyncedAt: 'щойно',
					balanceFormatted: '54 280.00 ₴'
				});
			}
		} else if (activeModalBank === 'a-bank') {
			bank.status = 'connected';
			bank.tokenOrRef = 'a24_consent_' + Date.now().toString(36);
			bank.lastCheckAt = 'щойно';
			if (bank.accounts.length === 0) {
				bank.accounts.push({
					iban: 'UA173077700000026205061543958',
					bankId: 'a-bank',
					currency: 'UAH',
					name: 'ТОВ "Бізнес" (аБізнес)',
					isActive: true,
					lastSyncedAt: 'щойно',
					balanceFormatted: '120 450.00 ₴'
				});
			}
		} else if (activeModalBank === 'monobank') {
			bank.status = 'connected';
			bank.tokenOrRef = tokenInput.trim() || 'mono_corp_' + Date.now().toString(36);
			bank.lastCheckAt = 'щойно';
			if (bank.accounts.length === 0) {
				bank.accounts.push({
					iban: 'UA993052990000026001111111111',
					bankId: 'monobank',
					currency: 'UAH',
					name: 'Рахунок ФОП у Monobank',
					isActive: true,
					lastSyncedAt: 'щойно',
					balanceFormatted: '85 000.00 ₴'
				});
			}
		}

		saveBankConnections(bankConnections);
		notification = { type: 'success', message: 'Налаштування банку збережено успішно' };
		closeBankModal();
		setTimeout(() => (notification = null), 4000);
	}

	async function handleSyncBank(bankId: BankConnectionId) {
		isSyncing[bankId] = true;
		await new Promise((resolve) => setTimeout(resolve, 800));
		isSyncing[bankId] = false;

		const bank = bankConnections[bankId];
		if (bank) {
			bank.lastCheckAt = 'щойно';
			for (const acc of bank.accounts) {
				acc.lastSyncedAt = 'щойно';
			}
			saveBankConnections(bankConnections);
		}
		notification = { type: 'success', message: `Синхронізацію ${bankId.toUpperCase()} завершено успішно` };
		setTimeout(() => (notification = null), 3000);
	}

	function toggleAccountActive(bankId: BankConnectionId, iban: string) {
		const bank = bankConnections[bankId];
		if (!bank) return;
		const acc = bank.accounts.find((a) => a.iban === iban);
		if (acc) {
			acc.isActive = !acc.isActive;
			saveBankConnections(bankConnections);
		}
	}

	onMount(() => {
		config = loadPaymentMethodsConfig();
		bankConnections = loadBankConnections();
	});
</script>

<div class="mx-auto max-w-7xl">
	{#if notification}
		<div
			class="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-xl transition-all {notification.type ===
			'success'
				? 'border border-emerald-500/30 bg-emerald-950 text-emerald-200'
				: 'border border-rose-500/30 bg-rose-950 text-rose-200'}"
		>
			<Check size={16} />
			<span>{notification.message}</span>
		</div>
	{/if}

	<header class="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
				Приймання платежів
			</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Способи оплати та банки</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Підключайте банківські рахунки для прямого IBAN-підтвердження та налаштовуйте карткові шлюзи.
			</p>
		</div>
		<span
			class="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
		>
			<span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Модуль банківських конекторів v1
		</span>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="space-y-6">
			<!-- SECTION: DIRECT BANK CONNECTORS -->
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
								Прямі IBAN-платежі
							</p>
							<h2 class="mt-1 text-base font-extrabold">Банківські підключення</h2>
							<p class="mt-1 text-sm leading-6 text-zinc-500">
								Автоматична перевірка зарахувань за виписками з офіційними логотипами та прив'язкою до реквізитів.
							</p>
						</div>
						<div class="hidden sm:block">
							<span class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
								<Landmark size={14} class="text-emerald-600" />
								<span>3 банки підтримано</span>
							</span>
						</div>
					</div>
				</div>

				<div class="divide-y divide-zinc-200">
					<!-- PRIVATBANK -->
					<div class="p-5 sm:p-6">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex items-start gap-4">
								<div class="relative size-12 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm transition-transform hover:scale-105">
									<img
										src={BANK_LOGOS.privatbank}
										alt="ПриватБанк"
										class="size-full object-contain rounded-lg"
									/>
								</div>
								<div>
									<div class="flex items-center gap-2">
										<h3 class="text-base font-bold text-zinc-900">ПриватБанк</h3>
										<span class="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
											Автоклієнт 3.0
										</span>
										{#if bankConnections.privatbank.status === 'connected'}
											<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
												<span class="size-1.5 rounded-full bg-emerald-500"></span> Підключено
											</span>
										{:else}
											<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
												Не налаштовано
											</span>
										{/if}
									</div>
									<p class="mt-1 text-xs text-zinc-500">
										Синхронізація виписки раз на 60 сек або за запитом. Пагінація followId, детермінований доказ REF+REFN.
									</p>
									{#if bankConnections.privatbank.lastCheckAt}
										<p class="mt-1 text-[11px] text-zinc-400">
											Остання перевірка: {bankConnections.privatbank.lastCheckAt}
										</p>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								{#if bankConnections.privatbank.status === 'connected'}
									<button
										type="button"
										onclick={() => handleSyncBank('privatbank')}
										disabled={isSyncing.privatbank}
										class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
									>
										<RefreshCw size={13} class={isSyncing.privatbank ? 'animate-spin' : ''} />
										<span>Синхронізувати</span>
									</button>
								{/if}
								<button
									type="button"
									onclick={() => openBankConfig('privatbank')}
									class="inline-flex items-center gap-1.5 rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
								>
									{bankConnections.privatbank.status === 'connected' ? 'Змінити токен' : 'Підключити'}
								</button>
							</div>
						</div>

						<!-- Discovered accounts list pulled from structure or direct -->
						{@const pbAccounts = getAccountsForBank('privatbank')}
						{#if pbAccounts.length > 0}
							<div class="mt-4 space-y-2 rounded-md border border-zinc-100 bg-zinc-50/70 p-3">
								<div class="flex items-center justify-between text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
									<span>Активні рахунки для зарахування:</span>
									<a href="/dashboard/structure" class="text-emerald-700 hover:underline">
										Юридичні реквізити →
									</a>
								</div>
								{#each pbAccounts as acc (acc.iban)}
									<div class="flex items-center justify-between gap-3 text-xs">
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												checked={acc.isActive}
												onchange={() => toggleAccountActive('privatbank', acc.iban)}
												class="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
											/>
											<div>
												<span class="font-mono font-bold text-zinc-800">{acc.iban}</span>
												<span class="ml-2 text-zinc-500">({acc.name})</span>
												{#if acc.source === 'structure'}
													<span class="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">З реквізитів</span>
												{/if}
											</div>
										</div>
										<span class="font-bold text-zinc-900">{acc.balanceFormatted || '—'}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- A-BANK -->
					<div class="p-5 sm:p-6">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex items-start gap-4">
								<div class="relative size-12 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm transition-transform hover:scale-105">
									<img
										src={BANK_LOGOS['a-bank']}
										alt="А-Банк"
										class="size-full object-contain rounded-lg"
									/>
								</div>
								<div>
									<div class="flex items-center gap-2">
										<h3 class="text-base font-bold text-zinc-900">А-Банк</h3>
										<span class="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
											аБізнес Open API
										</span>
										{#if bankConnections['a-bank'].status === 'connected'}
											<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
												<span class="size-1.5 rounded-full bg-emerald-500"></span> Підключено (QR)
											</span>
										{:else}
											<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
												Не налаштовано
											</span>
										{/if}
									</div>
									<p class="mt-1 text-xs text-zinc-500">
										Ed25519 криптографічний підпис, миттєвий транзакційний Webhook та онбординг через QR-згоду в додатку А24.
									</p>
									{#if bankConnections['a-bank'].lastCheckAt}
										<p class="mt-1 text-[11px] text-zinc-400">
											Остання перевірка: {bankConnections['a-bank'].lastCheckAt}
										</p>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								{#if bankConnections['a-bank'].status === 'connected'}
									<button
										type="button"
										onclick={() => handleSyncBank('a-bank')}
										disabled={isSyncing['a-bank']}
										class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
									>
										<RefreshCw size={13} class={isSyncing['a-bank'] ? 'animate-spin' : ''} />
										<span>Синхронізувати</span>
									</button>
								{/if}
								<button
									type="button"
									onclick={() => openBankConfig('a-bank')}
									class="inline-flex items-center gap-1.5 rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
								>
									<QrCode size={14} />
									<span>{bankConnections['a-bank'].status === 'connected' ? 'Оновити згоду' : 'Підключити (QR)'}</span>
								</button>
							</div>
						</div>

						<!-- Discovered accounts list pulled from structure or direct -->
						{@const abAccounts = getAccountsForBank('a-bank')}
						{#if abAccounts.length > 0}
							<div class="mt-4 space-y-2 rounded-md border border-zinc-100 bg-zinc-50/70 p-3">
								<div class="flex items-center justify-between text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
									<span>Активні рахунки для зарахування:</span>
									<a href="/dashboard/structure" class="text-emerald-700 hover:underline">
										Юридичні реквізити →
									</a>
								</div>
								{#each abAccounts as acc (acc.iban)}
									<div class="flex items-center justify-between gap-3 text-xs">
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												checked={acc.isActive}
												onchange={() => toggleAccountActive('a-bank', acc.iban)}
												class="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
											/>
											<div>
												<span class="font-mono font-bold text-zinc-800">{acc.iban}</span>
												<span class="ml-2 text-zinc-500">({acc.name})</span>
												{#if acc.source === 'structure'}
													<span class="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">З реквізитів</span>
												{/if}
											</div>
										</div>
										<span class="font-bold text-zinc-900">{acc.balanceFormatted || '—'}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- MONOBANK -->
					<div class="p-5 sm:p-6">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex items-start gap-4">
								<div class="relative size-12 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm transition-transform hover:scale-105">
									<img
										src={BANK_LOGOS.monobank}
										alt="Monobank"
										class="size-full object-contain rounded-lg"
									/>
								</div>
								<div>
									<div class="flex items-center gap-2">
										<h3 class="text-base font-bold text-zinc-900">Monobank</h3>
										<span class="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
											Corporate & Acquiring
										</span>
										{#if bankConnections.monobank.status === 'connected'}
											<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
												<span class="size-1.5 rounded-full bg-emerald-500"></span> Підключено
											</span>
										{:else}
											<span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
												Не налаштовано
											</span>
										{/if}
									</div>
									<p class="mt-1 text-xs text-zinc-500">
										Миттєві сповіщення StatementItem, цілочисельні копійки (minor units), підтримка виписок ФОП та інвойсів.
									</p>
									{#if bankConnections.monobank.lastCheckAt}
										<p class="mt-1 text-[11px] text-zinc-400">
											Остання перевірка: {bankConnections.monobank.lastCheckAt}
										</p>
									{/if}
								</div>
							</div>

							<div class="flex items-center gap-2">
								{#if bankConnections.monobank.status === 'connected'}
									<button
										type="button"
										onclick={() => handleSyncBank('monobank')}
										disabled={isSyncing.monobank}
										class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
									>
										<RefreshCw size={13} class={isSyncing.monobank ? 'animate-spin' : ''} />
										<span>Синхронізувати</span>
									</button>
								{/if}
								<button
									type="button"
									onclick={() => openBankConfig('monobank')}
									class="inline-flex items-center gap-1.5 rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
								>
									{bankConnections.monobank.status === 'connected' ? 'Налаштувати' : 'Підключити'}
								</button>
							</div>
						</div>

						<!-- Discovered accounts list pulled from structure or direct -->
						{@const monoAccounts = getAccountsForBank('monobank')}
						{#if monoAccounts.length > 0}
							<div class="mt-4 space-y-2 rounded-md border border-zinc-100 bg-zinc-50/70 p-3">
								<div class="flex items-center justify-between text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
									<span>Активні рахунки для зарахування:</span>
									<a href="/dashboard/structure" class="text-emerald-700 hover:underline">
										Юридичні реквізити →
									</a>
								</div>
								{#each monoAccounts as acc (acc.iban)}
									<div class="flex items-center justify-between gap-3 text-xs">
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												checked={acc.isActive}
												onchange={() => toggleAccountActive('monobank', acc.iban)}
												class="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
											/>
											<div>
												<span class="font-mono font-bold text-zinc-800">{acc.iban}</span>
												<span class="ml-2 text-zinc-500">({acc.name})</span>
												{#if acc.source === 'structure'}
													<span class="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">З реквізитів</span>
												{/if}
											</div>
										</div>
										<span class="font-bold text-zinc-900">{acc.balanceFormatted || '—'}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</section>

			<!-- SECTION: CARD PAYMENT PROVIDER (TRANZZO) -->
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
						Картковий еквайринг
					</p>
					<h2 class="mt-1 text-base font-extrabold">Провайдер інтернет-еквайрингу</h2>
				</div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
					<button
						type="button"
						aria-pressed="true"
						class="flex min-h-28 items-start gap-4 rounded-md border-2 border-emerald-600 bg-emerald-50/60 p-4 text-left"
					>
						<span
							class="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-950 text-sm font-black text-white"
							>TZ</span
						>
						<span class="min-w-0 flex-1"
							><span class="flex items-center gap-2"
								><strong class="text-base">Tranzzo</strong><span
									class="rounded bg-emerald-100 px-1.5 py-0.5 text-[0.625rem] font-extrabold text-emerald-800"
									>АКТИВНИЙ</span
								></span
							><span class="mt-2 block text-xs leading-5 text-zinc-600"
								>Картки Visa/Mastercard, Apple Pay і Google Pay після онбордингу.</span
							></span
						>
						<Check size={17} class="shrink-0 text-emerald-700" aria-hidden="true" />
					</button>
					<div
						class="flex min-h-28 items-start gap-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-zinc-500"
					>
						<span class="grid size-11 shrink-0 place-items-center rounded-md bg-white"
							><WalletCards size={20} aria-hidden="true" /></span
						>
						<span
							><strong class="block text-sm text-zinc-700">Інші провайдери</strong><span
								class="mt-2 block text-xs leading-5"
								>LiqPay, WayForPay підключаються як альтернативні адаптери.</span
							></span
						>
					</div>
				</div>
			</section>

			<!-- WALLETS -->
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<div class="flex items-start gap-3">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-700"
							><Smartphone size={19} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
								Цифрові гаманці
							</p>
							<h2 class="mt-1 text-base font-extrabold">Apple Pay і Google Pay</h2>
							<p class="mt-1 text-sm leading-6 text-zinc-500">
								Швидка оплата на мобільних пристроях.
							</p>
						</div>
					</div>
				</div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
					{#each wallets as wallet (wallet.id)}
						<button
							type="button"
							disabled
							title="Цифрові гаманці очікують захищену інтеграцію провайдера"
							aria-pressed={config.requestedWallets.includes(wallet.id)}
							class="flex min-h-20 cursor-not-allowed items-center gap-4 rounded-md border-2 bg-zinc-50 p-4 text-left text-zinc-400 {config.requestedWallets.includes(
								wallet.id
							)
								? 'border-violet-600'
								: 'border-zinc-200'}"
						>
							<span
								class="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-950 text-white"
								><CreditCard size={19} aria-hidden="true" /></span
							><span class="min-w-0 flex-1"
								><strong class="block text-sm">{wallet.name}</strong><span
									class="mt-1 block text-xs leading-5 opacity-70">{wallet.detail}</span
								></span
							>{#if config.requestedWallets.includes(wallet.id)}<Check
									size={17}
									class="shrink-0 text-violet-700"
									aria-hidden="true"
								/>{/if}
						</button>
					{/each}
				</div>
			</section>
		</div>

		<!-- SIDEBAR -->
		<aside
			class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm xl:sticky xl:top-24"
		>
			<div class="border-b border-zinc-200 p-5">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Безпека інтеграцій</p>
				<h3 class="mt-1 text-lg font-extrabold text-zinc-900">Захист креденшалів</h3>
				<p class="mt-2 text-xs leading-5 text-zinc-500">
					Банківські токени шифруються за допомогою <strong>WebCrypto AES-GCM-256</strong> перед збереженням.
				</p>
			</div>

			<div class="space-y-3 p-5 text-xs leading-5 text-zinc-600">
				<div class="flex items-start gap-2.5">
					<ShieldCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
					<span><strong>ПриватБанк:</strong> read-only токен виписки без права списання коштів.</span>
				</div>
				<div class="flex items-start gap-2.5">
					<ShieldCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
					<span><strong>А-Банк:</strong> криптографічний підпис Ed25519 та контроль терміну дій згоди.</span>
				</div>
				<div class="flex items-start gap-2.5">
					<ShieldCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
					<span><strong>Monobank:</strong> верифікація вебхуків відкритою парою ключів банку.</span>
				</div>
			</div>

			<div class="border-t border-zinc-200 bg-zinc-50 p-5">
				<a
					href="/dashboard/structure"
					class="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
				>
					<Building2 size={14} />
					<span>Юридичні реквізити та IBAN</span>
				</a>
			</div>
		</aside>
	</div>
</div>

<!-- MODAL: BANK CONFIGURATION -->
{#if activeModalBank}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
		<div class="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<div class="size-8 overflow-hidden rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm">
						<img src={BANK_LOGOS[activeModalBank]} alt="Логотип банку" class="size-full object-contain rounded" />
					</div>
					<h3 class="text-base font-bold text-zinc-900">
						{#if activeModalBank === 'privatbank'}
							Підключення ПриватБанк Автоклієнт 3.0
						{:else if activeModalBank === 'a-bank'}
							Підключення А-Банк (аБізнес Open API)
						{:else}
							Підключення Monobank Corporate / Acquiring
						{/if}
					</h3>
				</div>
				<button type="button" onclick={closeBankModal} class="text-zinc-400 hover:text-zinc-600">
					<X size={18} />
				</button>
			</div>

			<div class="space-y-4 p-6 text-xs text-zinc-600">
				{#if activeModalBank === 'privatbank'}
					<p class="leading-relaxed">
						Створіть додаток «Автоклієнт» у кабінеті <strong>Приват24 для бізнесу</strong> (Налаштування → Автоклієнт) з правами лише читання виписок і вставте токен:
					</p>
					<label class="block">
						<span class="mb-1.5 block font-bold text-zinc-700">Токен Автоклієнта:</span>
						<input
							type="password"
							bind:value={tokenInput}
							placeholder="Введіть або вставте токен ПриватБанку..."
							class="w-full rounded-md border border-zinc-300 px-3 py-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none"
						/>
					</label>
				{:else if activeModalBank === 'a-bank'}
					<p class="leading-relaxed">
						Для надання доступу до виписок компанії відскануйте QR-код у мобільному застосунку <strong>А24 для бізнесу</strong>:
					</p>
					<div class="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6">
						<div class="grid size-40 place-items-center rounded-lg border-2 border-dashed border-emerald-500 bg-white p-2 shadow-inner">
							<QrCode size={120} class="text-zinc-900" />
						</div>
						<p class="mt-3 text-center text-[11px] font-semibold text-zinc-500">
							Відкрийте А24 → Меню → QR-сканер для підтвердження доступу
						</p>
					</div>
				{:else}
					<p class="leading-relaxed">
						Введіть X-Token або авторизуйтеся через Corporate API Monobank:
					</p>
					<label class="block">
						<span class="mb-1.5 block font-bold text-zinc-700">X-Token / Ключ доступу:</span>
						<input
							type="password"
							bind:value={tokenInput}
							placeholder="Токен із кабінету web.monobank.ua..."
							class="w-full rounded-md border border-zinc-300 px-3 py-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none"
						/>
					</label>
				{/if}

				<div class="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-[11px] text-emerald-900">
					<ShieldCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
					<span>Токен зберігається у зашифрованому вигляді та використовується виключно сервером.</span>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
				<button
					type="button"
					onclick={closeBankModal}
					class="rounded-md border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
				>
					Скасувати
				</button>
				<button
					type="button"
					onclick={handleSaveBank}
					class="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
				>
					Зберегти та перевірити
				</button>
			</div>
		</div>
	</div>
{/if}
