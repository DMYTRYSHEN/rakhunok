<script lang="ts">
	import { untrack } from 'svelte';
	import {
		BadgeCheck,
		Building2,
		Check,
		CloudCog,
		Copy,
		CreditCard,
		Landmark,
		MapPin,
		MoreHorizontal,
		Plus,
		Radio,
		Save,
		Store,
		Trash2,
		Webhook,
		X
	} from '@lucide/svelte';
	import type { BusinessEntity, BusinessEntityInput, DashboardMerchant, PosTerminal, TerminalInput } from '../types';

	type Section = 'entities' | 'accounts' | 'terminals';
	type EntityDraft = {
		id: string;
		name: string;
		legalName: string;
		edrpou: string;
		city: string;
		isPrimary: boolean;
		local: boolean;
	};
	type AccountDraft = {
		id: string;
		entityId: string;
		bank: string;
		iban: string;
		currency: string;
		local: boolean;
	};

	let {
		merchant,
		initialEntities,
		initialTerminals,
		onUpdateMerchantName,
		onCreateEntity,
		onUpdateEntity,
		onDeleteEntity,
		onCreateTerminal,
		onUpdateTerminal,
		onDeleteTerminal
	}: {
		merchant: DashboardMerchant;
		initialEntities: BusinessEntity[];
		initialTerminals: PosTerminal[];
		onUpdateMerchantName: (name: string) => Promise<void>;
		onCreateEntity: (input: BusinessEntityInput) => Promise<void>;
		onUpdateEntity: (entityId: string, input: BusinessEntityInput) => Promise<void>;
		onDeleteEntity: (entityId: string) => Promise<void>;
		onCreateTerminal: (input: TerminalInput) => Promise<void>;
		onUpdateTerminal: (terminalId: string, input: TerminalInput) => Promise<void>;
		onDeleteTerminal: (terminalId: string) => Promise<void>;
	} = $props();

	let section = $state<Section>('entities');
	let entities = $state<EntityDraft[]>([]);
	let accounts = $state<AccountDraft[]>([]);
	let terminals = $state<PosTerminal[]>([]);
	let selectedEntityId = $state('');
	let editor = $state<'entity' | 'account' | 'terminal' | null>(null);
	let saved = $state(false);
	let pending = $state(false);
	let actionError = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let merchantName = $state('');
	let endpointCopied = $state(false);

	let entityName = $state('');
	let legalName = $state('');
	let edrpou = $state('');
	let entityType = $state<BusinessEntity['businessType']>('fop');
	let entityBank = $state('');
	let entityIban = $state('');
	let accountBank = $state('monobank');
	let accountIban = $state('');
	let terminalName = $state('');
	let terminalCode = $state('');
	let terminalType = $state<PosTerminal['type']>('table');

	const activeEntity = $derived(entities.find((entity) => entity.id === selectedEntityId));
	const entityTerminals = $derived(terminals.filter((terminal) => terminal.entityId === selectedEntityId));
	const kasaTerminals = $derived(entityTerminals.filter((terminal) => terminal.type === 'kasa'));
	const entityAccounts = $derived(accounts.filter((account) => account.entityId === selectedEntityId));
	const deviceEndpoint = 'wss://api.rakhunok.com/device/{deviceId}';
	const paymentEventExample = `{
  "paymentId": "P123456",
  "status": "SUCCESS",
  "amount": 25000,
  "currency": "UAH",
	"deviceId": "KIOSK-001",
	"client": {
		"id": "C789012",
		"returning": true
	}
}`;

	async function copyDeviceEndpoint() {
		await navigator.clipboard.writeText(deviceEndpoint);
		endpointCopied = true;
		window.setTimeout(() => (endpointCopied = false), 1500);
	}

	$effect(() => {
		const nextEntities = initialEntities.map((entity, index) => ({
			id: entity.id,
			name: entity.displayName,
			legalName: entity.businessName,
			edrpou: entity.taxId,
			city: entity.bankName,
			isPrimary: index === 0,
			local: false
		}));
		entities = nextEntities;
		accounts = [];
		terminals = [...initialTerminals];
		const currentEntityId = untrack(() => selectedEntityId);
		if (!nextEntities.some((entity) => entity.id === currentEntityId)) selectedEntityId = nextEntities[0]?.id ?? '';
		if (!untrack(() => merchantName)) merchantName = merchant.displayName;
	});

	function openEditor(nextEditor: 'entity' | 'account' | 'terminal') {
		editingId = null;
		editor = nextEditor;
		saved = false;
	}

	function closeEditor() {
		editor = null;
		editingId = null;
		entityName = '';
		legalName = '';
		edrpou = '';
		entityBank = '';
		entityIban = '';
		accountIban = '';
		terminalName = '';
		terminalCode = '';
	}

	function editEntity(entityId: string) {
		const entity = initialEntities.find((item) => item.id === entityId);
		if (!entity) return;
		editingId = entity.id;
		entityType = entity.businessType;
		entityName = entity.displayName;
		legalName = entity.businessName;
		edrpou = entity.taxId;
		entityBank = entity.bankName;
		entityIban = entity.iban;
		editor = 'entity';
	}

	function editTerminal(terminalId: string) {
		const terminal = terminals.find((item) => item.id === terminalId);
		if (!terminal) return;
		editingId = terminal.id;
		selectedEntityId = terminal.entityId;
		terminalName = terminal.name;
		terminalCode = terminal.code;
		terminalType = terminal.type;
		editor = 'terminal';
	}

	async function addEntity() {
		if (pending || !entityName.trim() || !legalName.trim() || !edrpou.trim() || !entityBank.trim() || !/^UA[A-Z0-9]{27}$/.test(entityIban.replace(/\s+/g, '').toUpperCase())) return;
		pending = true;
		actionError = null;
		try {
			const input = { businessType: entityType, businessName: legalName.trim(), displayName: entityName.trim(), taxId: edrpou.trim(), bankName: entityBank.trim(), iban: entityIban.replace(/\s+/g, '').toUpperCase() };
			if (editingId) await onUpdateEntity(editingId, input); else await onCreateEntity(input);
			closeEditor();
		} catch (error) { actionError = error instanceof Error ? error.message : 'Не вдалося створити бізнес.'; }
		finally { pending = false; }
	}

	function addAccount() {
		if (!accountIban.trim() || !selectedEntityId) return;
		accounts = [
			...accounts,
			{
				id: `local-account-${Date.now()}`,
				entityId: selectedEntityId,
				bank: accountBank,
				iban: accountIban.trim(),
				currency: 'UAH',
				local: true
			}
		];
		closeEditor();
	}

	async function addTerminal() {
		if (!terminalName.trim() || !terminalCode.trim() || !selectedEntityId) return;
		pending = true;
		actionError = null;
		try {
			const input = { entityId: selectedEntityId, name: terminalName.trim(), code: terminalCode.trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, '-'), type: terminalType };
			if (editingId) await onUpdateTerminal(editingId, input); else await onCreateTerminal(input);
			closeEditor();
		} catch (error) { actionError = error instanceof Error ? error.message : 'Не вдалося створити робоче місце.'; }
		finally { pending = false; }
	}

	async function deleteEntity(id: string) {
		if (pending || !confirm('Видалити юридичну особу? Пов’язані термінали можуть заблокувати дію.')) return;
		pending = true;
		try { await onDeleteEntity(id); } catch (error) { actionError = error instanceof Error ? error.message : 'Не вдалося видалити бізнес.'; }
		finally { pending = false; }
	}

	function deleteAccount(id: string) {
		accounts = accounts.filter((account) => account.id !== id);
	}

	async function deleteTerminal(id: string) {
		if (pending || !confirm('Видалити це робоче місце?')) return;
		pending = true;
		try { await onDeleteTerminal(id); } catch (error) { actionError = error instanceof Error ? error.message : 'Не вдалося видалити робоче місце.'; }
		finally { pending = false; }
	}

	async function saveDisplayName() {
		if (pending || !merchantName.trim()) return;
		pending = true;
		try { await onUpdateMerchantName(merchantName.trim()); saved = true; window.setTimeout(() => (saved = false), 1800); }
		catch (error) { actionError = error instanceof Error ? error.message : 'Не вдалося зберегти назву.'; }
		finally { pending = false; }
	}

	function terminalTypeLabel(type: PosTerminal['type']) {
		return {
			table: 'Столик',
			kasa: 'Каса',
			dynamic_qr: 'Динамічний QR',
			nfc_tag: 'NFC-мітка',
			courier: 'Кур’єр'
		}[type];
	}
</script>

<div class="mx-auto max-w-7xl">
	<header class="flex flex-col justify-between gap-5 border-b border-zinc-200 pb-7 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">Керування</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Структура бізнесу</h1>
			<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
				Юридичні особи, банківські рахунки та точки, де ваша команда приймає оплату.
			</p>
		</div>
		<div class="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
			<span class="size-1.5 rounded-full bg-emerald-600"></span> Захищено RLS
		</div>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
		<aside class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-white lg:sticky lg:top-24">
			<div class="border-b border-zinc-200 p-4">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Активний бізнес</p>
				<select bind:value={selectedEntityId} class="mt-3 h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-600" aria-label="Активний бізнес">
					{#each entities as entity (entity.id)}<option value={entity.id}>{entity.name}</option>{/each}
				</select>
			</div>
			<nav class="p-2" aria-label="Розділи структури бізнесу">
				<button type="button" onclick={() => (section = 'entities')} class:bg-zinc-950={section === 'entities'} class:text-white={section === 'entities'} class="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-bold text-zinc-600"><Building2 size={17} aria-hidden="true" /> Бізнеси <span class="ml-auto text-xs opacity-60">{entities.length}</span></button>
				<button type="button" onclick={() => (section = 'accounts')} class:bg-zinc-950={section === 'accounts'} class:text-white={section === 'accounts'} class="mt-1 flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-bold text-zinc-600"><Landmark size={17} aria-hidden="true" /> Рахунки <span class="ml-auto text-xs opacity-60">{entityAccounts.length}</span></button>
				<button type="button" onclick={() => (section = 'terminals')} class:bg-zinc-950={section === 'terminals'} class:text-white={section === 'terminals'} class="mt-1 flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-bold text-zinc-600"><Store size={17} aria-hidden="true" /> Робочі місця <span class="ml-auto text-xs opacity-60">{entityTerminals.length}</span></button>
			</nav>
		</aside>

		<div class="min-w-0 space-y-5">
			{#if actionError}<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{actionError}</p>{/if}
			{#if activeEntity}
				<section class="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
					<label>
						<span class="mb-2 block text-xs font-bold text-zinc-500">Публічна назва</span>
						<input bind:value={merchantName} class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm font-bold outline-none focus:border-blue-600" />
					</label>
					<button type="button" disabled={pending || !merchantName.trim()} onclick={saveDisplayName} class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:bg-zinc-200 disabled:text-zinc-500">
						<Save size={17} aria-hidden="true" /> {saved ? 'Збережено' : 'Зберегти назву'}
					</button>
				</section>
			{/if}

			{#if section === 'entities'}
				<section>
					<div class="mb-4 flex items-center justify-between gap-4"><div><h2 class="text-lg font-extrabold">Бізнеси</h2><p class="mt-1 text-xs text-zinc-500">Окремі юридичні особи або напрями роботи.</p></div><button type="button" onclick={() => openEditor('entity')} class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-extrabold text-white"><Plus size={16} aria-hidden="true" /> Додати</button></div>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each entities as entity (entity.id)}
							<article
								class:border-blue-500={entity.id === selectedEntityId}
								class:ring-1={entity.id === selectedEntityId}
								class:ring-blue-500={entity.id === selectedEntityId}
								class:border-zinc-200={entity.id !== selectedEntityId}
								class="rounded-lg border bg-white p-5"
							>
								<div class="flex items-start justify-between gap-3">
									<span class="grid size-10 place-items-center rounded-md bg-zinc-100">
										<Building2 size={18} aria-hidden="true" />
									</span>
									{#if !entity.isPrimary}
										<button
											type="button"
											onclick={() => deleteEntity(entity.id)}
											class="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
											aria-label="Видалити бізнес"
										>
											<Trash2 size={16} aria-hidden="true" />
										</button>
									{:else}
										<span class="rounded-sm bg-emerald-50 px-2 py-1 text-[0.625rem] font-bold text-emerald-700">ОСНОВНИЙ</span>
									{/if}
								</div>
								<h3 class="mt-4 text-base font-extrabold">{entity.name}</h3>
								<p class="mt-1 text-xs text-zinc-500">{entity.legalName}</p>
								<div class="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs">
									<span class="inline-flex items-center gap-1.5 text-zinc-500"><MapPin size={14} aria-hidden="true" /> {entity.city}</span>
									<div class="flex items-center gap-3"><button type="button" onclick={() => editEntity(entity.id)} class="font-bold text-zinc-600">Редагувати</button><button type="button" onclick={() => (selectedEntityId = entity.id)} class="font-bold text-blue-700">Обрати</button></div>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{:else if section === 'accounts'}
				<section>
					<div class="mb-4 flex items-center justify-between gap-4"><div><h2 class="text-lg font-extrabold">Банківські рахунки</h2><p class="mt-1 text-xs text-zinc-500">Куди надходять оплати цього бізнесу.</p></div><button type="button" disabled title="Схема банківських рахунків ще не підтверджена" class="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-200 px-3 text-sm font-extrabold text-zinc-500"><Plus size={16} aria-hidden="true" /> Додати</button></div>
					<div class="space-y-3">
						{#each entityAccounts as account (account.id)}
							<article class="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center">
								<span class="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-950 text-white">
									<CreditCard size={19} aria-hidden="true" />
								</span>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="text-sm font-extrabold">{account.bank}</h3>
										{#if account.local}<span class="rounded-sm bg-amber-50 px-2 py-0.5 text-[0.625rem] font-bold text-amber-800">ЧЕРНЕТКА</span>{/if}
									</div>
									<p class="mt-1 truncate font-mono text-xs text-zinc-500">{account.iban}</p>
								</div>
								<span class="text-xs font-bold text-zinc-500">{account.currency}</span>
								{#if account.local}
									<button type="button" onclick={() => deleteAccount(account.id)} class="grid size-9 place-items-center rounded-md text-zinc-400 hover:text-red-600" aria-label="Видалити рахунок"><Trash2 size={16} aria-hidden="true" /></button>
								{:else}
									<button type="button" class="grid size-9 place-items-center rounded-md text-zinc-400" aria-label="Дії рахунку"><MoreHorizontal size={18} aria-hidden="true" /></button>
								{/if}
							</article>
						{:else}
							<div class="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">Для цього бізнесу ще немає рахунків.</div>
						{/each}
					</div>
				</section>
			{:else}
				<section>
					<div class="mb-4 flex items-center justify-between gap-4"><div><h2 class="text-lg font-extrabold">Робочі місця</h2><p class="mt-1 text-xs text-zinc-500">Каси, столики, NFC та QR-точки оплати.</p></div><button type="button" disabled={!selectedEntityId} onclick={() => openEditor('terminal')} class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500"><Plus size={16} aria-hidden="true" /> Створити</button></div>
					<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
						{#each entityTerminals as terminal, index (terminal.id)}
							<article class:border-t={index > 0} class:border-zinc-100={index > 0} class="flex items-center gap-4 p-4 sm:p-5">
								<span class="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100"><Store size={18} aria-hidden="true" /></span>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="text-sm font-extrabold">{terminal.name}</h3>
										<span class="rounded-sm bg-emerald-50 px-2 py-0.5 text-[0.625rem] font-bold text-emerald-700">АКТИВНЕ</span>
									</div>
									<p class="mt-1 text-xs text-zinc-500">{terminalTypeLabel(terminal.type)} · {terminal.code}</p>
								</div>
								<button type="button" onclick={() => editTerminal(terminal.id)} class="grid size-9 place-items-center rounded-md text-zinc-400 hover:text-blue-700" aria-label="Редагувати робоче місце"><MoreHorizontal size={18} aria-hidden="true" /></button>
								<button type="button" disabled={pending} onclick={() => deleteTerminal(terminal.id)} class="grid size-9 place-items-center rounded-md text-zinc-400 hover:text-red-600 disabled:opacity-40" aria-label="Прибрати робоче місце"><Trash2 size={16} aria-hidden="true" /></button>
							</article>
						{:else}
							<div class="p-10 text-center text-sm text-zinc-500">Для цього бізнесу ще немає робочих місць.</div>
						{/each}
					</div>

					<section class="mt-5 border-y border-zinc-200 bg-zinc-950 px-5 py-6 text-white sm:rounded-lg sm:border sm:p-6" aria-labelledby="device-gateway-title">
						<div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
							<div class="max-w-2xl">
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-sm bg-[#c9ff4a] px-2 py-1 text-[0.625rem] font-extrabold text-zinc-950">ПЛАТНИЙ МОДУЛЬ</span>
									<span class="rounded-sm border border-white/20 bg-white/10 px-2 py-1 text-[0.625rem] font-bold text-zinc-200">ГОТУЄТЬСЯ</span>
								</div>
								<h2 id="device-gateway-title" class="mt-4 text-lg font-extrabold">Device Event Gateway</h2>
								<p class="mt-2 text-sm leading-6 text-zinc-300">
									Статус платежу від банку буде доставлятися конкретній касі самообслуговування або системі ERP/CRM мерчанта без polling.
								</p>
							</div>
							<button type="button" disabled title="Потребує активації Cloudflare Durable Objects і Queues" class="h-10 shrink-0 rounded-md bg-white/10 px-4 text-sm font-bold text-zinc-400">
								Підключення готується
							</button>
						</div>

						<div class="mt-6 grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 md:grid-cols-3" aria-label="Маршрут події оплати">
							<div class="bg-zinc-950 p-4">
								<Webhook size={18} class="text-[#c9ff4a]" aria-hidden="true" />
								<p class="mt-3 text-xs font-extrabold">1. Банк → Worker</p>
								<p class="mt-1 text-xs leading-5 text-zinc-400">Перевірка підпису, idempotency та запис статусу платежу.</p>
							</div>
							<div class="bg-zinc-950 p-4">
								<CloudCog size={18} class="text-[#c9ff4a]" aria-hidden="true" />
								<p class="mt-3 text-xs font-extrabold">2. Queue → Durable Object</p>
								<p class="mt-1 text-xs leading-5 text-zinc-400">Надійна черга, повторна доставка та WebSocket Hibernation.</p>
							</div>
							<div class="bg-zinc-950 p-4">
								<Radio size={18} class="text-[#c9ff4a]" aria-hidden="true" />
								<p class="mt-3 text-xs font-extrabold">3. Каса або ERP/CRM</p>
								<p class="mt-1 text-xs leading-5 text-zinc-400">WebSocket для IoT або підписаний webhook для системи мерчанта.</p>
							</div>
						</div>

						<div class="mt-5 grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
							<div class="min-w-0 bg-zinc-950 p-4 sm:p-5">
								<p class="text-[0.625rem] font-extrabold text-[#c9ff4a]">WSS ENDPOINT · PREVIEW</p>
								<div class="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/30 p-2 pl-3">
									<code class="min-w-0 flex-1 break-all font-mono text-xs text-zinc-100">{deviceEndpoint}</code>
									<button type="button" onclick={copyDeviceEndpoint} class="grid size-9 shrink-0 place-items-center rounded-md border border-white/15 text-zinc-300 hover:text-white" aria-label="Скопіювати WSS endpoint" title="Скопіювати endpoint">
										{#if endpointCopied}<Check size={16} aria-hidden="true" />{:else}<Copy size={16} aria-hidden="true" />{/if}
									</button>
								</div>
								<ol class="mt-5 grid gap-3 text-xs leading-5 text-zinc-300 sm:grid-cols-2">
									<li><b class="text-white">1. Створіть касу.</b> Для робочого місця типу «Каса» буде видано унікальний <code>deviceId</code>.</li>
									<li><b class="text-white">2. Підключіться.</b> Замініть <code>{'{deviceId}'}</code> у WSS-адресі та передайте виданий device credential.</li>
									<li><b class="text-white">3. Слухайте події.</b> Після підтвердження банком з’єднання отримає JSON зі статусом платежу.</li>
									<li><b class="text-white">4. Підтвердьте обробку.</b> Каса надсилає ACK, а після reconnect запитує пропущені події за cursor.</li>
								</ol>
								<p class="mt-4 text-xs leading-5 text-amber-200">Endpoint стане доступним після активації модуля. Формат device credential та ACK буде зафіксовано в API-документації.</p>
							</div>
							<div class="min-w-0 bg-zinc-950 p-4 sm:p-5">
								<p class="text-[0.625rem] font-extrabold text-zinc-400">ПРИКЛАД ПОДІЇ</p>
								<pre class="mt-3 max-w-full overflow-x-auto rounded-md bg-black/30 p-4 text-xs leading-6 text-zinc-100"><code>{paymentEventExample}</code></pre>
								<p class="mt-3 text-xs leading-5 text-zinc-400"><code>amount</code> передається у копійках: <code>25000</code> означає 250,00 UAH.</p>
								<p class="mt-2 text-xs leading-5 text-zinc-400"><code>client</code> є опціональним: об’єкт надходить лише для клієнта, якого сервіс уже розпізнав; для нового або невідомого платника поле відсутнє.</p>
							</div>
						</div>

						<div class="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p class="text-xs font-bold text-zinc-400">Каси, готові до майбутнього підключення</p>
								<p class="mt-1 text-sm font-extrabold">
									{kasaTerminals.length > 0 ? kasaTerminals.map((terminal) => terminal.name).join(', ') : 'Додайте робоче місце типу «Каса»'}
								</p>
							</div>
							<p class="max-w-md text-xs leading-5 text-zinc-400">
								WebSocket прискорює доставку, але не є журналом. Після reconnect каса відновить пропущені події за cursor з надійного сховища.
							</p>
						</div>
					</section>
				</section>
			{/if}
		</div>
	</div>
</div>

{#if editor}
	<div class="fixed inset-0 z-50 grid place-items-end bg-zinc-950/45 sm:place-items-center sm:p-5" role="presentation">
		<div role="dialog" aria-modal="true" aria-labelledby="structure-editor-title" class="w-full rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-lg sm:p-6">
			<div class="flex items-start justify-between gap-4"><div><p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">{editingId ? 'Редагування' : 'Новий запис'}</p><h2 id="structure-editor-title" class="mt-1 text-xl font-extrabold">{editor === 'entity' ? (editingId ? 'Редагувати бізнес' : 'Новий бізнес') : editor === 'account' ? 'Новий рахунок' : editingId ? 'Редагувати робоче місце' : 'Нове робоче місце'}</h2></div><button type="button" onclick={closeEditor} class="grid size-10 place-items-center rounded-md border border-zinc-200" aria-label="Закрити"><X size={18} aria-hidden="true" /></button></div>
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				{#if editor === 'entity'}
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Тип</span><select bind:value={entityType} class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"><option value="fop">ФОП</option><option value="tov">ТОВ</option><option value="self_employed">Самозайнята особа</option><option value="ngo">ГО</option></select></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Публічна назва</span><input bind:value={entityName} placeholder="Rahunok Coffee Podil" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Юридична назва</span><input bind:value={legalName} placeholder="ТОВ «Приклад»" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">ЄДРПОУ</span><input bind:value={edrpou} inputmode="numeric" placeholder="12345678" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Банк</span><input bind:value={entityBank} placeholder="Назва банку" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label class="sm:col-span-2"><span class="mb-2 block text-xs font-bold text-zinc-600">IBAN</span><input bind:value={entityIban} placeholder="UA та 27 символів" class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm uppercase outline-none focus:border-blue-600" /></label>
				{:else if editor === 'account'}
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Банк</span><select bind:value={accountBank} class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"><option>monobank</option><option>ПриватБанк</option><option>ПУМБ</option><option>Ощадбанк</option></select></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Валюта</span><input value="UAH" disabled class="h-12 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm" /></label>
					<label class="sm:col-span-2"><span class="mb-2 block text-xs font-bold text-zinc-600">IBAN</span><input bind:value={accountIban} placeholder="UA123456789..." class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm outline-none focus:border-blue-600" /></label>
				{:else}
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Назва</span><input bind:value={terminalName} placeholder="Стіл 8" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label><span class="mb-2 block text-xs font-bold text-zinc-600">Код</span><input bind:value={terminalCode} placeholder="table-8" class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600" /></label>
					<label class="sm:col-span-2"><span class="mb-2 block text-xs font-bold text-zinc-600">Тип</span><select bind:value={terminalType} class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"><option value="table">Столик</option><option value="kasa">Каса</option><option value="dynamic_qr">Динамічний QR</option><option value="nfc_tag">NFC-мітка</option><option value="courier">Кур’єр</option></select></label>
				{/if}
			</div>
			<div class="mt-6 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950">Юридичні особи та робочі місця зберігаються в Supabase під чинною RLS-політикою.</div>
			<div class="mt-5 flex justify-end gap-2"><button type="button" onclick={closeEditor} class="h-11 rounded-md border border-zinc-200 px-4 text-sm font-bold">Скасувати</button><button type="button" onclick={editor === 'entity' ? addEntity : editor === 'account' ? addAccount : addTerminal} disabled={pending || (editor === 'entity' ? !entityName.trim() || !legalName.trim() || !edrpou.trim() || !entityBank.trim() || !entityIban.trim() : editor === 'account' ? !accountIban.trim() : !terminalName.trim() || !terminalCode.trim())} class="h-11 rounded-md bg-blue-600 px-4 text-sm font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500">{pending ? 'Зберігаємо…' : 'Зберегти'}</button></div>
		</div>
	</div>
{/if}