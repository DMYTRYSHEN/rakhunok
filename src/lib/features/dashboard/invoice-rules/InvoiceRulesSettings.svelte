<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BadgeCheck,
		Braces,
		Building2,
		Check,
		Clock3,
		FileDigit,
		QrCode,
		Save,
		UserRound
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import {
		defaultInvoiceRules,
		formatInvoiceNumber,
		formatPaymentPurpose,
		loadInvoiceRules,
		saveInvoiceRules,
		suggestedPurposeTemplate,
		taxIdLabel,
		validateInvoiceRules,
		type BusinessLegalForm,
		type InvoiceRules,
		type VatStatus
	} from './invoice-rules';

	type LegalProfile = {
		id: BusinessLegalForm;
		name: string;
		description: string;
		icon: Component;
	};

	const profiles: LegalProfile[] = [
		{ id: 'tov', name: 'ТОВ', description: 'Юридична особа', icon: Building2 },
		{ id: 'fop', name: 'ФОП', description: 'Фізична особа-підприємець', icon: BadgeCheck },
		{
			id: 'self-employed',
			name: 'Самозайнята особа',
			description: 'Фізична особа з незалежною професійною діяльністю',
			icon: UserRound
		}
	];

	const placeholders = [
		'{number}',
		'{date}',
		'{scenario}',
		'{amount}',
		'{customer}',
		'{contract}',
		'{tax}'
	];
	let rules = $state<InvoiceRules>({ ...defaultInvoiceRules });
	let saved = $state(false);
	let purposeInput: HTMLTextAreaElement;
	let previewScenario = $state<
		'fixed' | 'open_amount' | 'table' | 'delivery' | 'recurring' | 'rtp'
	>('fixed');
	const previewNumber = $derived(formatInvoiceNumber(rules, new Date()));
	const previewPurpose = $derived(
		formatPaymentPurpose(rules, {
			number: previewNumber,
			date: new Date(),
			scenario: previewScenario,
			amount: 1250,
			customer: 'Іваненко Іван',
			contract: 'Договір 12/08'
		})
	);
	const issues = $derived(validateInvoiceRules(rules));

	onMount(() => {
		rules = loadInvoiceRules();
	});

	function selectProfile(legalForm: BusinessLegalForm) {
		rules.legalForm = legalForm;
		rules.purposeTemplate = suggestedPurposeTemplate(legalForm, rules.vatStatus);
		saved = false;
	}

	function selectVat(vatStatus: VatStatus) {
		rules.vatStatus = vatStatus;
		rules.purposeTemplate = suggestedPurposeTemplate(rules.legalForm, vatStatus);
		saved = false;
	}

	function insertPlaceholder(placeholder: string) {
		const start = purposeInput.selectionStart;
		const end = purposeInput.selectionEnd;
		rules.purposeTemplate = `${rules.purposeTemplate.slice(0, start)}${placeholder}${rules.purposeTemplate.slice(end)}`;
		requestAnimationFrame(() => {
			purposeInput.focus();
			purposeInput.setSelectionRange(start + placeholder.length, start + placeholder.length);
		});
		saved = false;
	}

	function persist() {
		if (issues.length) return;
		saveInvoiceRules(rules);
		saved = true;
	}
</script>

<div class="mx-auto max-w-7xl">
	<header class="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">
				Автоматизація рахунків
			</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Правила рахунків</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Браузерний профіль формує preview нумерації, призначення платежу та параметрів QR без запису
				в базу.
			</p>
		</div>
		<span
			class="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"
		>
			<span class="size-1.5 rounded-full bg-amber-500"></span> Зберігається у цьому браузері
		</span>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
		<div class="space-y-6">
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-4 sm:px-6">
					<div class="flex items-center gap-3">
						<span class="grid size-9 place-items-center rounded-md bg-blue-50 text-blue-700"
							><Building2 size={18} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold text-zinc-500">Крок 1</p>
							<h2 class="text-base font-extrabold">Профіль отримувача</h2>
						</div>
					</div>
				</div>
				<div class="p-5 sm:p-6">
					<div class="grid gap-2 md:grid-cols-3" aria-label="Організаційна форма">
						{#each profiles as profile (profile.id)}
							{@const Icon = profile.icon}
							<button
								type="button"
								onclick={() => selectProfile(profile.id)}
								aria-pressed={rules.legalForm === profile.id}
								class="flex min-h-24 items-start gap-3 rounded-md border-2 p-3 text-left {rules.legalForm ===
								profile.id
									? 'border-blue-600 bg-blue-50/50'
									: 'border-zinc-200'}"
							>
								<span
									class="grid size-9 shrink-0 place-items-center rounded-md bg-white text-zinc-700"
									><Icon size={17} aria-hidden="true" /></span
								>
								<span class="min-w-0 flex-1"
									><strong class="block text-sm">{profile.name}</strong><span
										class="mt-1 block text-xs leading-4 text-zinc-500">{profile.description}</span
									></span
								>
								{#if rules.legalForm === profile.id}<Check
										size={16}
										class="shrink-0 text-blue-700"
										aria-hidden="true"
									/>{/if}
							</button>
						{/each}
					</div>

					<div class="mt-5 grid gap-4 sm:grid-cols-2">
						<div>
							<span class="mb-2 block text-xs font-bold text-zinc-600">Статус ПДВ</span>
							<div class="grid grid-cols-2 rounded-md bg-zinc-100 p-1">
								<button
									type="button"
									onclick={() => selectVat('vat')}
									class="h-10 rounded-sm text-xs font-bold {rules.vatStatus === 'vat'
										? 'bg-white shadow-sm'
										: 'text-zinc-500'}">Платник ПДВ</button
								>
								<button
									type="button"
									onclick={() => selectVat('no-vat')}
									class="h-10 rounded-sm text-xs font-bold {rules.vatStatus === 'no-vat'
										? 'bg-white shadow-sm'
										: 'text-zinc-500'}">Без ПДВ</button
								>
							</div>
						</div>
						<label
							><span class="mb-2 block text-xs font-bold text-zinc-600"
								>{taxIdLabel(rules.legalForm)}</span
							><input
								bind:value={rules.taxId}
								oninput={() => (saved = false)}
								inputmode="numeric"
								maxlength="10"
								placeholder={rules.legalForm === 'tov' ? '8 цифр' : '10 цифр'}
								class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
							/></label
						>
					</div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-4 sm:px-6">
					<div class="flex items-center gap-3">
						<span class="grid size-9 place-items-center rounded-md bg-emerald-50 text-emerald-700"
							><FileDigit size={18} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold text-zinc-500">Крок 2</p>
							<h2 class="text-base font-extrabold">Нумерація</h2>
						</div>
					</div>
				</div>
				<div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Префікс</span><input
							bind:value={rules.invoicePrefix}
							oninput={() => (saved = false)}
							maxlength="20"
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm font-bold uppercase outline-none focus:border-blue-600"
						/></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Наступний номер</span><input
							bind:value={rules.nextNumber}
							oninput={() => (saved = false)}
							type="number"
							min="1"
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm font-bold outline-none focus:border-blue-600"
						/></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Кількість цифр</span><input
							bind:value={rules.padding}
							oninput={() => (saved = false)}
							type="number"
							min="1"
							max="12"
							class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
						/></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Скидання лічильника</span
						><select
							bind:value={rules.resetPeriod}
							onchange={() => (saved = false)}
							class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-600"
							><option value="never">Ніколи</option><option value="yearly">Щороку</option><option
								value="monthly">Щомісяця</option
							></select
						></label
					>
					<div class="rounded-md bg-zinc-950 p-4 text-white sm:col-span-2 lg:col-span-4">
						<span class="text-[0.6875rem] font-bold tracking-[0.12em] text-zinc-400 uppercase"
							>Наступний Reference</span
						><strong class="mt-2 block font-mono text-lg">{previewNumber}</strong><span
							class="mt-1 block text-xs text-zinc-400"
							>{previewNumber.length}/35 символів QR 003</span
						>
					</div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-4 sm:px-6">
					<div class="flex items-center gap-3">
						<span class="grid size-9 place-items-center rounded-md bg-amber-50 text-amber-700"
							><Braces size={18} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold text-zinc-500">Крок 3</p>
							<h2 class="text-base font-extrabold">Призначення платежу</h2>
						</div>
					</div>
				</div>
				<div class="p-5 sm:p-6">
					<div class="mb-3 flex flex-wrap gap-2">
						{#each placeholders as placeholder (placeholder)}<button
								type="button"
								onclick={() => insertPlaceholder(placeholder)}
								class="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs font-bold text-zinc-700 hover:border-blue-300"
								>{placeholder}</button
							>{/each}
					</div>
					<label
						><span class="sr-only">Шаблон призначення платежу</span><textarea
							bind:this={purposeInput}
							bind:value={rules.purposeTemplate}
							oninput={() => (saved = false)}
							rows="4"
							class="w-full resize-y rounded-md border border-zinc-200 p-3 text-sm leading-6 outline-none focus:border-blue-600"
						></textarea></label
					>
					<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<select
							bind:value={previewScenario}
							class="h-10 rounded-md border border-zinc-200 bg-white px-3 text-xs font-bold"
							><option value="fixed">Фіксований рахунок</option><option value="open_amount"
								>Вільна сума</option
							><option value="table">За столиком</option><option value="delivery">Доставка</option
							><option value="recurring">Рекурентний платіж</option><option value="rtp"
								>RTP-запит</option
							></select
						><span class="text-xs text-zinc-500">{previewPurpose.length}/420 символів</span>
					</div>
					<div class="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
						<span class="text-[0.6875rem] font-bold tracking-[0.12em] text-zinc-500 uppercase"
							>Приклад</span
						>
						<p class="mt-2 text-sm leading-6 text-zinc-800">{previewPurpose}</p>
					</div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-4 sm:px-6">
					<div class="flex items-center gap-3">
						<span class="grid size-9 place-items-center rounded-md bg-violet-50 text-violet-700"
							><QrCode size={18} aria-hidden="true" /></span
						>
						<div>
							<p class="text-xs font-bold text-zinc-500">Крок 4</p>
							<h2 class="text-base font-extrabold">Миттєвий платіж</h2>
						</div>
					</div>
				</div>
				<div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Функція переказу</span><select
							bind:value={rules.qrFunction}
							onchange={() => (saved = false)}
							class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
							><option value="UCT">UCT · кредитовий</option><option value="ICT"
								>ICT · миттєвий</option
							><option value="XCT">XCT · будь-який</option></select
						></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600"
							>Категорія / ціль ISO 20022</span
						><input
							bind:value={rules.qrCategory}
							oninput={() => (saved = false)}
							maxlength="9"
							class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm uppercase outline-none focus:border-blue-600"
						/></label
					>
					<label
						class="flex min-h-16 items-center justify-between gap-4 rounded-md border border-zinc-200 px-4"
						><span
							><strong class="block text-sm">Дозволити зміну суми</strong><span
								class="mt-1 block text-xs text-zinc-500">Для рахунків із вільною сумою</span
							></span
						><input
							type="checkbox"
							bind:checked={rules.allowAmountEdit}
							onchange={() => (saved = false)}
							class="size-5 accent-blue-600"
						/></label
					>
					<label
						><span class="mb-2 block text-xs font-bold text-zinc-600">Строк дії</span><select
							value={rules.expiryHours ?? 'never'}
							onchange={(event) => {
								const value = event.currentTarget.value;
								rules.expiryHours = value === 'never' ? null : Number(value);
								saved = false;
							}}
							class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
							><option value="1">1 година</option><option value="24">24 години</option><option
								value="72">3 доби</option
							><option value="168">7 діб</option><option value="never">Без обмеження</option
							></select
						></label
					>
					<div
						class="rounded-md border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950 sm:col-span-2"
					>
						Профіль відповідає полям формату 003 за постановою НБУ №97 від 19.08.2025 у редакції зі
						змінами №128. Це конфігурація продукту, а не індивідуальна юридична чи податкова
						консультація.
					</div>
				</div>
			</section>
		</div>

		<aside
			class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-white xl:sticky xl:top-24"
		>
			<div class="border-b border-zinc-200 p-5">
				<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Активний профіль</p>
				<strong class="mt-2 block text-lg"
					>{profiles.find((profile) => profile.id === rules.legalForm)?.name}</strong
				><span class="mt-1 block text-xs text-zinc-500"
					>{rules.vatStatus === 'vat' ? 'Платник ПДВ' : 'Без ПДВ'} · UTF-8</span
				>
			</div>
			<div class="p-5">
				<dl class="space-y-3 text-xs">
					<div class="flex justify-between gap-3">
						<dt class="text-zinc-500">Reference</dt>
						<dd class="text-right font-mono font-bold">{previewNumber}</dd>
					</div>
					<div class="flex justify-between gap-3">
						<dt class="text-zinc-500">QR</dt>
						<dd class="font-bold">003 · {rules.qrFunction}</dd>
					</div>
					<div class="flex justify-between gap-3">
						<dt class="text-zinc-500">Категорія</dt>
						<dd class="font-mono font-bold">{rules.qrCategory}</dd>
					</div>
					<div class="flex justify-between gap-3">
						<dt class="text-zinc-500">Діє</dt>
						<dd class="font-bold">
							{rules.expiryHours === null ? 'Безстроково' : `${rules.expiryHours} год`}
						</dd>
					</div>
				</dl>
				{#if issues.length}<div class="mt-5 rounded-md border border-red-200 bg-red-50 p-3">
						<p class="text-xs font-extrabold text-red-900">Потрібно виправити</p>
						<ul class="mt-2 space-y-1 text-xs leading-5 text-red-800">
							{#each issues as issue (issue)}<li>· {issue}</li>{/each}
						</ul>
					</div>{/if}
				<button
					type="button"
					onclick={persist}
					disabled={issues.length > 0}
					class="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-extrabold text-white hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-500"
					><Save size={17} aria-hidden="true" />
					{saved ? 'Правила збережено' : 'Зберегти правила'}</button
				>
				{#if saved}<p
						class="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700"
					>
						<Check size={14} aria-hidden="true" /> Локальний preview оновлено
					</p>{/if}
			</div>
			<div class="flex items-start gap-3 border-t border-zinc-200 bg-zinc-50 p-5">
				<Clock3 size={16} class="mt-0.5 shrink-0 text-zinc-500" aria-hidden="true" />
				<p class="text-xs leading-5 text-zinc-600">
					Лічильник зараз не збільшується. Серверний запис буде підключено лише після перевірки
					schema та RLS.
				</p>
			</div>
		</aside>
	</div>
</div>
