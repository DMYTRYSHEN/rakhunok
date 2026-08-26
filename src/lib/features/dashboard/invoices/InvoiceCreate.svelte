<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Building2,
		Check,
		ChevronRight,
		CircleDollarSign,
		Delete,
		MapPin,
		Package,
		Plus,
		QrCode,
		ReceiptText,
		Repeat2,
		RotateCcw,
		Send,
		Settings2,
		Store,
		Utensils,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import {
		defaultInvoiceRules,
		formatInvoiceNumber,
		formatPaymentPurpose,
		loadInvoiceRules,
		saveInvoiceRules,
		type InvoiceRules
	} from '../invoice-rules/invoice-rules';
	import type { InvoiceCreateInput, InvoiceType, PosTerminal } from '../types';
	import { formatMoney } from '../utils/format';

	type Scenario = {
		id: InvoiceType;
		name: string;
		description: string;
		icon: Component;
	};

	let {
		terminals: initialTerminals,
		onCreate,
		demo = false
	}: {
		terminals: PosTerminal[];
		onCreate?: (input: InvoiceCreateInput) => Promise<{ id: string }>;
		demo?: boolean;
	} = $props();

	const scenarios: Scenario[] = [
		{
			id: 'fixed',
			name: 'Фіксований рахунок',
			description: 'Інтернет-магазин, послуги, рахунок на суму',
			icon: ReceiptText
		},
		{
			id: 'open_amount',
			name: 'Вільна сума',
			description: 'Клієнт сам вказує суму: каса або донат',
			icon: CircleDollarSign
		},
		{
			id: 'table',
			name: 'Рахунок за столиком',
			description: 'Ресторан, номер столика та чайові',
			icon: Utensils
		},
		{
			id: 'delivery',
			name: 'Нова пошта / Доставка',
			description: 'Відділення, поштамат і розрахунок',
			icon: Package
		},
		{
			id: 'recurring',
			name: 'Рекурентний платіж',
			description: 'Задана сума з повторенням за розкладом',
			icon: Repeat2
		},
		{
			id: 'rtp',
			name: 'RTP-запит',
			description: 'Запит постійному клієнту за його ідентифікатором',
			icon: Send
		}
	];

	let scenario = $state<InvoiceType>('fixed');
	let amount = $state('0');
	let deliveryFee = $state('0');
	let minimumAmount = $state('0');
	let recurrenceInterval = $state('monthly');
	let recurrenceCount = $state('');
	let rtpCustomerId = $state('');
	let title = $state('');
	let reference = $state('');
	let invoiceRules = $state<InvoiceRules>({ ...defaultInvoiceRules });
	let referenceOverridden = $state(false);
	let purposeOverridden = $state(false);
	let memo = $state('');
	let terminalId = $state('');
	let allowTips = $state(true);
	let deliveryCity = $state('Київ');
	let deliveryBranch = $state('Відділення №24');
	let terminalDialogOpen = $state(false);
	let terminalName = $state('');
	let terminalCode = $state('');
	let terminalType = $state<PosTerminal['type']>('table');
	let localTerminals = $state<PosTerminal[]>([]);
	let previewOpen = $state(false);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let appliedScenarioParam = $state<string | null>(null);

	const terminals = $derived([...initialTerminals, ...localTerminals]);
	const selectedScenario = $derived(scenarios.find((item) => item.id === scenario) ?? scenarios[0]);
	const numericAmount = $derived(Number.parseFloat(amount) || 0);
	const total = $derived(
		numericAmount + (scenario === 'delivery' ? Number.parseFloat(deliveryFee) || 0 : 0)
	);
	const selectedTerminal = $derived(terminals.find((terminal) => terminal.id === terminalId));
	const generatedReference = $derived(formatInvoiceNumber(invoiceRules, new Date()));
	const generatedPurpose = $derived(
		formatPaymentPurpose(invoiceRules, {
			number: generatedReference,
			date: new Date(),
			scenario,
			amount: total
		})
	);
	const canPreview = $derived(
		(scenario !== 'table' || Boolean(terminalId)) &&
			(scenario !== 'rtp' || Boolean(rtpCustomerId.trim()))
	);

	$effect(() => {
		if (!terminalId && initialTerminals[0]) terminalId = initialTerminals[0].id;
	});

	$effect(() => {
		if (!referenceOverridden) reference = generatedReference;
		if (!purposeOverridden) title = generatedPurpose;
	});

	$effect(() => {
		const requestedScenario = page.url.searchParams.get('type');
		if (requestedScenario === appliedScenarioParam) return;
		appliedScenarioParam = requestedScenario;
		if (scenarios.some((item) => item.id === requestedScenario)) {
			chooseScenario(requestedScenario as InvoiceType);
		}
	});

	onMount(() => {
		invoiceRules = loadInvoiceRules();
	});

	function chooseScenario(nextScenario: InvoiceType) {
		scenario = nextScenario;
		amount = '0';
		deliveryFee = '0';
		minimumAmount = '0';
		previewOpen = false;
	}

	function restoreGeneratedFields() {
		referenceOverridden = false;
		purposeOverridden = false;
		reference = generatedReference;
		title = generatedPurpose;
	}

	function appendAmount(key: string) {
		if (key === 'backspace') {
			amount = amount.length > 1 ? amount.slice(0, -1) : '0';
			return;
		}
		if (key === '.' && amount.includes('.')) return;
		amount = amount === '0' && key !== '.' ? key : `${amount}${key}`;
	}

	function addAmount(value: number) {
		amount = String((Number.parseFloat(amount) || 0) + value);
	}

	function createLocalTerminal() {
		const name = terminalName.trim();
		const code = terminalCode.trim().toLocaleLowerCase('uk-UA').replace(/\s+/g, '-');
		if (!name || !code) return;
		const terminal: PosTerminal = {
			id: `local-${Date.now()}`,
			name,
			code,
			type: terminalType,
			entityId: 'local-draft',
			isActive: true
		};
		localTerminals = [...localTerminals, terminal];
		terminalId = terminal.id;
		terminalName = '';
		terminalCode = '';
		terminalDialogOpen = false;
	}

	async function createInvoice() {
		if (!onCreate || submitting || scenario === 'recurring' || scenario === 'rtp') return;
		submitting = true;
		submitError = null;
		try {
			const result = await onCreate({
				type: scenario,
				reference: reference.trim(),
				title: title.trim() || reference.trim(),
				description:
					scenario === 'delivery' ? `${deliveryCity}, ${deliveryBranch}` : memo.trim() || undefined,
				amount: numericAmount,
				deliveryFee: scenario === 'delivery' ? Number.parseFloat(deliveryFee) || 0 : undefined,
				tableNumber:
					scenario === 'table'
						? Number.parseInt(selectedTerminal?.code.match(/\d+/)?.[0] || '', 10) || undefined
						: undefined
			});
			invoiceRules = { ...invoiceRules, nextNumber: invoiceRules.nextNumber + 1 };
			saveInvoiceRules(invoiceRules);
			await goto(resolve(`/dashboard/invoices/${result.id}` as '/'));
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Не вдалося створити рахунок.';
			submitting = false;
		}
	}
</script>

<div class="mx-auto max-w-7xl">
	<header class="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<a
				href={resolve(demo ? '/dashboard/invoices?demo=1' : '/dashboard/invoices')}
				class="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-950"
			>
				<ArrowLeft size={15} aria-hidden="true" /> До рахунків
			</a>
			<p class="mt-5 text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">
				Створення рахунку
			</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Бізнес-сценарій оплати</h1>
			<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
				Гнучкі налаштування під онлайн-замовлення, ресторанні столики, касу та доставку.
			</p>
		</div>
		<span
			class="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
		>
			<span class="size-1.5 rounded-full bg-amber-500"></span> Чернетка без запису
		</span>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
		<div class="space-y-6">
			<section
				class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2"
				aria-label="Бізнес-сценарій оплати"
			>
				{#each scenarios as item (item.id)}
					{@const Icon = item.icon}
					<button
						type="button"
						onclick={() => chooseScenario(item.id)}
						aria-pressed={scenario === item.id}
						class="relative flex min-h-32 min-w-0 flex-col items-start gap-3 rounded-lg border-2 bg-white p-3 text-left transition-colors sm:min-h-28 sm:flex-row sm:items-center sm:p-4 {scenario ===
						item.id
							? 'border-blue-600'
							: 'border-zinc-200 hover:border-zinc-300'}"
					>
						<span
							class="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-700 sm:size-11"
						>
							<Icon size={20} aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<strong class="block text-xs leading-5 sm:text-sm">{item.name}</strong>
							<span class="mt-1 hidden text-xs leading-5 text-zinc-500 sm:block"
								>{item.description}</span
							>
						</span>
						{#if scenario === item.id}<Check
								size={18}
								class="absolute top-3 right-3 shrink-0 text-blue-600 sm:static"
								aria-hidden="true"
							/>{/if}
					</button>
				{/each}
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div
					class="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6"
				>
					<div>
						<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">
							Деталі рахунку
						</p>
						<h2 class="mt-1 text-base font-extrabold">{selectedScenario.name}</h2>
					</div>
					<a
						href={resolve(demo ? '/dashboard/invoice-rules?demo=1' : '/dashboard/invoice-rules')}
						class="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
						><Settings2 size={14} aria-hidden="true" /> Правила</a
					>
				</div>

				<div class="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
					<label class="sm:col-span-2">
						<span class="mb-2 block text-xs font-bold text-zinc-600">Отримувач</span>
						<div
							class="flex h-12 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3"
						>
							<Building2 size={17} class="text-zinc-500" aria-hidden="true" />
							<span class="text-sm font-semibold">Rahunok Coffee · основний рахунок</span>
						</div>
					</label>

					<label>
						<span class="mb-2 block text-xs font-bold text-zinc-600">Номер рахунку</span>
						<input
							bind:value={reference}
							oninput={() => (referenceOverridden = true)}
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
						/>
					</label>

					<label>
						<span class="mb-2 block text-xs font-bold text-zinc-600">Призначення платежу</span>
						<input
							bind:value={title}
							oninput={() => (purposeOverridden = true)}
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
						/>
					</label>

					<div
						class="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"
					>
						<span
							>Автоматично за профілем: {invoiceRules.legalForm === 'tov'
								? 'ТОВ'
								: invoiceRules.legalForm === 'fop'
									? 'ФОП'
									: 'Самозайнята особа'} · {invoiceRules.vatStatus === 'vat' ? 'з ПДВ' : 'без ПДВ'} ·
							QR 003</span
						>
						<button
							type="button"
							onclick={restoreGeneratedFields}
							class="inline-flex shrink-0 items-center gap-1.5 font-extrabold text-blue-800"
							><RotateCcw size={14} aria-hidden="true" /> Відновити за правилами</button
						>
					</div>

					<label
						class={scenario === 'fixed' || scenario === 'recurring' || scenario === 'rtp'
							? 'sm:col-span-2'
							: ''}
					>
						<span class="mb-2 block text-xs font-bold text-zinc-600"
							>{scenario === 'delivery' ? 'Вартість товарів' : 'Сума до сплати'}</span
						>
						<div class="relative">
							<input
								bind:value={amount}
								inputmode="decimal"
								class="h-12 w-full rounded-md border border-zinc-200 px-3 pr-10 text-sm font-bold tabular-nums outline-none focus:border-blue-600"
							/><span class="absolute top-3.5 right-3 text-sm text-zinc-400">₴</span>
						</div>
					</label>

					{#if scenario === 'open_amount'}
						<label>
							<span class="mb-2 block text-xs font-bold text-zinc-600">Мінімальна сума</span>
							<div class="relative">
								<input
									bind:value={minimumAmount}
									inputmode="decimal"
									class="h-12 w-full rounded-md border border-zinc-200 px-3 pr-10 text-sm outline-none focus:border-blue-600"
								/><span class="absolute top-3.5 right-3 text-sm text-zinc-400">₴</span>
							</div>
						</label>
						<div
							class="flex items-center rounded-md border border-blue-200 bg-blue-50 px-4 text-xs leading-5 text-blue-950"
						>
							Сума 0 грн дозволена: клієнт зможе вказати її під час оплати.
						</div>
					{/if}

					{#if scenario === 'recurring'}
						<label
							><span class="mb-2 block text-xs font-bold text-zinc-600">Період повторення</span
							><select
								bind:value={recurrenceInterval}
								class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
								><option value="weekly">Щотижня</option><option value="monthly">Щомісяця</option
								><option value="quarterly">Щокварталу</option><option value="yearly">Щороку</option
								></select
							></label
						>
						<label
							><span class="mb-2 block text-xs font-bold text-zinc-600">Кількість повторень</span
							><input
								bind:value={recurrenceCount}
								inputmode="numeric"
								placeholder="Без обмеження"
								class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
							/></label
						>
						<div
							class="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950 sm:col-span-2"
						>
							Чернетка сценарію. Фактичне списання за розкладом потребуватиме згоди клієнта,
							токенізації та серверної інтеграції провайдера.
						</div>
					{/if}

					{#if scenario === 'rtp'}
						<label class="sm:col-span-2"
							><span class="mb-2 block text-xs font-bold text-zinc-600"
								>Ідентифікатор постійного клієнта</span
							><input
								bind:value={rtpCustomerId}
								autocomplete="off"
								placeholder="Наприклад, customer_1049"
								class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm outline-none focus:border-blue-600"
							/></label
						>
						<div
							class="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950 sm:col-span-2"
						>
							Чернетка RTP. Запит не буде надіслано, доки не з'явиться захищений реєстр клієнтів,
							їхня згода та серверний канал доставки.
						</div>
					{/if}

					{#if scenario === 'table'}
						<div>
							<div class="mb-2 flex items-center justify-between gap-3">
								<span class="text-xs font-bold text-zinc-600">Робоче місце / термінал</span>
								<button
									type="button"
									disabled
									title="Створення терміналів очікує backend CRUD та RLS"
									class="inline-flex items-center gap-1 text-xs font-bold text-zinc-400"
									><Plus size={14} aria-hidden="true" /> Створити</button
								>
							</div>
							<select
								bind:value={terminalId}
								class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-600"
							>
								<option value="">Оберіть робоче місце</option>
								{#each terminals as terminal (terminal.id)}<option value={terminal.id}
										>{terminal.name} · {terminal.code}</option
									>{/each}
							</select>
						</div>
						<label
							class="flex min-h-12 items-center justify-between gap-4 rounded-md border border-zinc-200 px-3 sm:col-span-2"
						>
							<span
								><strong class="block text-sm">Чайові гостя</strong><span
									class="text-xs text-zinc-500">5%, 10% або 15% під час оплати</span
								></span
							>
							<input type="checkbox" bind:checked={allowTips} class="size-5 accent-blue-600" />
						</label>
					{/if}

					{#if scenario === 'delivery'}
						<label
							><span class="mb-2 block text-xs font-bold text-zinc-600">Вартість доставки</span>
							<div class="relative">
								<input
									bind:value={deliveryFee}
									inputmode="decimal"
									class="h-12 w-full rounded-md border border-zinc-200 px-3 pr-10 text-sm outline-none focus:border-blue-600"
								/><span class="absolute top-3.5 right-3 text-sm text-zinc-400">₴</span>
							</div></label
						>
						<label
							><span class="mb-2 block text-xs font-bold text-zinc-600">Місто</span><input
								bind:value={deliveryCity}
								class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
							/></label
						>
						<label class="sm:col-span-2"
							><span class="mb-2 block text-xs font-bold text-zinc-600"
								>Відділення або поштомат</span
							>
							<div class="relative">
								<MapPin
									size={17}
									class="absolute top-3.5 left-3 text-zinc-400"
									aria-hidden="true"
								/><input
									bind:value={deliveryBranch}
									class="h-12 w-full rounded-md border border-zinc-200 pr-3 pl-10 text-sm outline-none focus:border-blue-600"
								/>
							</div></label
						>
					{/if}

					<label class="sm:col-span-2">
						<span class="mb-2 block text-xs font-bold text-zinc-600">Примітка для команди</span>
						<textarea
							bind:value={memo}
							rows="3"
							placeholder="Необов’язково"
							class="w-full resize-none rounded-md border border-zinc-200 p-3 text-sm outline-none focus:border-blue-600"
						></textarea>
					</label>
				</div>
			</section>
		</div>

		<aside
			class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-white xl:sticky xl:top-24"
		>
			<div class="border-b border-zinc-200 p-5">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Сума рахунку</p>
				<div class="mt-3 flex items-baseline justify-between gap-3">
					<strong class="text-4xl font-extrabold tabular-nums">{formatMoney(total)}</strong>
				</div>
				{#if scenario === 'open_amount'}<p class="mt-2 text-xs text-zinc-500">
						Клієнт зможе змінити суму від {formatMoney(Number.parseFloat(minimumAmount) || 0)}.
					</p>{/if}
			</div>

			{#if scenario !== 'open_amount'}
				<div class="p-5">
					<div class="grid grid-cols-3 gap-2">
						{#each [50, 100, 500] as quick (quick)}<button
								type="button"
								onclick={() => addAmount(quick)}
								class="h-10 rounded-md bg-zinc-100 text-xs font-bold hover:bg-zinc-200"
								>+{quick}</button
							>{/each}
					</div>
					<div class="mt-3 grid grid-cols-3 gap-2">
						{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as key (key)}<button
								type="button"
								onclick={() => appendAmount(key)}
								class="h-12 rounded-md border border-zinc-200 text-base font-bold hover:bg-zinc-50"
								>{key}</button
							>{/each}
						<button
							type="button"
							onclick={() => appendAmount('backspace')}
							class="grid h-12 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
							aria-label="Видалити цифру"><Delete size={18} aria-hidden="true" /></button
						>
					</div>
				</div>
			{/if}

			<div class="border-t border-zinc-200 p-5">
				<dl class="space-y-3 text-xs">
					<div class="flex justify-between gap-3">
						<dt class="text-zinc-500">Сценарій</dt>
						<dd class="text-right font-bold">{selectedScenario.name}</dd>
					</div>
					{#if selectedTerminal && scenario === 'table'}<div class="flex justify-between gap-3">
							<dt class="text-zinc-500">Термінал</dt>
							<dd class="text-right font-bold">{selectedTerminal.name}</dd>
						</div>{/if}
					{#if scenario === 'delivery'}<div class="flex justify-between gap-3">
							<dt class="text-zinc-500">Доставка</dt>
							<dd class="text-right font-bold">
								{formatMoney(Number.parseFloat(deliveryFee) || 0)}
							</dd>
						</div>{/if}
				</dl>
				<button
					type="button"
					disabled={!canPreview}
					onclick={() => (previewOpen = true)}
					class="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-extrabold text-white hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-500"
					>Переглянути рахунок <ChevronRight size={17} aria-hidden="true" /></button
				>
			</div>
		</aside>
	</div>
</div>

{#if terminalDialogOpen}
	<div
		class="fixed inset-0 z-50 grid place-items-end bg-zinc-950/45 p-0 sm:place-items-center sm:p-5"
		role="presentation"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="terminal-dialog-title"
			class="w-full rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-lg sm:p-6"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">
						Структура бізнесу
					</p>
					<h2 id="terminal-dialog-title" class="mt-1 text-xl font-extrabold">Нове робоче місце</h2>
					<p class="mt-1 text-sm text-zinc-500">Локальна чернетка для цього рахунку.</p>
				</div>
				<button
					type="button"
					onclick={() => (terminalDialogOpen = false)}
					class="grid size-10 place-items-center rounded-md border border-zinc-200"
					aria-label="Закрити"><X size={18} aria-hidden="true" /></button
				>
			</div>
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				<label
					><span class="mb-2 block text-xs font-bold text-zinc-600">Назва</span><input
						bind:value={terminalName}
						placeholder="Наприклад, Стіл 8"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/></label
				>
				<label
					><span class="mb-2 block text-xs font-bold text-zinc-600">Код</span><input
						bind:value={terminalCode}
						placeholder="table-8"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/></label
				>
				<label class="sm:col-span-2"
					><span class="mb-2 block text-xs font-bold text-zinc-600">Тип робочого місця</span><select
						bind:value={terminalType}
						class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
						><option value="table">Столик</option><option value="kasa">Каса</option><option
							value="dynamic_qr">Динамічний QR</option
						><option value="nfc_tag">NFC-мітка</option><option value="courier">Кур’єр</option
						></select
					></label
				>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => (terminalDialogOpen = false)}
					class="h-11 rounded-md border border-zinc-200 px-4 text-sm font-bold">Скасувати</button
				><button
					type="button"
					onclick={createLocalTerminal}
					disabled={!terminalName.trim() || !terminalCode.trim()}
					class="inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500"
					><Store size={17} aria-hidden="true" /> Додати місце</button
				>
			</div>
		</div>
	</div>
{/if}

{#if previewOpen}
	<div
		class="fixed inset-0 z-50 grid place-items-end bg-zinc-950/45 sm:place-items-center sm:p-5"
		role="presentation"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="invoice-preview-title"
			class="w-full rounded-t-xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-lg sm:p-6"
		>
			<div class="flex items-start justify-between">
				<div>
					<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">
						Попередній перегляд
					</p>
					<h2 id="invoice-preview-title" class="mt-1 text-xl font-extrabold">{reference}</h2>
				</div>
				<button
					type="button"
					onclick={() => (previewOpen = false)}
					class="grid size-10 place-items-center rounded-md border border-zinc-200"
					aria-label="Закрити"><X size={18} aria-hidden="true" /></button
				>
			</div>
			<div class="mt-6 grid place-items-center rounded-lg bg-zinc-950 p-8 text-white">
				<QrCode size={112} strokeWidth={1.2} aria-hidden="true" />
				<p class="mt-4 text-sm font-bold">{title}</p>
				<strong class="mt-2 text-3xl tabular-nums">{formatMoney(total)}</strong>
			</div>
			{#if scenario === 'recurring' || scenario === 'rtp'}
				<div
					class="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
				>
					Сценарій очікує захищений backend-контракт і поки не створює записів.
				</div>
			{:else if submitError}<p class="mt-5 text-sm text-red-700" role="alert">{submitError}</p>{/if}
			<button
				type="button"
				onclick={createInvoice}
				disabled={!onCreate || submitting || scenario === 'recurring' || scenario === 'rtp'}
				class="mt-4 h-12 w-full rounded-md bg-blue-600 text-sm font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500"
				>{submitting ? 'Створюємо…' : 'Створити рахунок і QR'}</button
			>
		</div>
	</div>
{/if}
