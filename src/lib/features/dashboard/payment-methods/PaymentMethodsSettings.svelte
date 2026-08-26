<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BadgeCheck,
		Check,
		CircleAlert,
		CreditCard,
		ExternalLink,
		KeyRound,
		Save,
		ShieldCheck,
		Smartphone,
		WalletCards
	} from '@lucide/svelte';
	import {
		defaultPaymentMethodsConfig,
		loadPaymentMethodsConfig,
		validatePaymentMethodsConfig,
		type PaymentMethodsConfig,
		type ProviderOnboardingStatus,
		type WalletMethodId
	} from './payment-methods';

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

	onMount(() => {
		config = loadPaymentMethodsConfig();
	});
</script>

<div class="mx-auto max-w-7xl">
	<header class="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">Приймання платежів</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Способи оплати</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Оберіть платіжного провайдера та підготуйте цифрові гаманці для checkout.
			</p>
		</div>
		<span class="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
			<span class="size-1.5 rounded-full bg-amber-500"></span> Чернетка інтеграції
		</span>
	</header>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="space-y-6">
			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Платіжне рішення</p>
					<h2 class="mt-1 text-base font-extrabold">Оберіть провайдера</h2>
				</div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
					<button type="button" aria-pressed="true" class="flex min-h-28 items-start gap-4 rounded-md border-2 border-emerald-600 bg-emerald-50/60 p-4 text-left">
						<span class="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-950 text-sm font-black text-white">TZ</span>
						<span class="min-w-0 flex-1"><span class="flex items-center gap-2"><strong class="text-base">Tranzzo</strong><span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[0.625rem] font-extrabold text-emerald-800">ДЛЯ ПІДКЛЮЧЕННЯ</span></span><span class="mt-2 block text-xs leading-5 text-zinc-600">Картки, Apple Pay і Google Pay після онбордингу мерчанта.</span></span>
						<Check size={17} class="shrink-0 text-emerald-700" aria-hidden="true" />
					</button>
					<div class="flex min-h-28 items-start gap-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-zinc-500">
						<span class="grid size-11 shrink-0 place-items-center rounded-md bg-white"><WalletCards size={20} aria-hidden="true" /></span>
						<span><strong class="block text-sm text-zinc-700">Інші провайдери</strong><span class="mt-2 block text-xs leading-5">LiqPay, WayForPay та інші з'являться як окремі адаптери.</span></span>
					</div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6">
					<div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"><BadgeCheck size={19} aria-hidden="true" /></span><div><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Tranzzo</p><h2 class="mt-1 text-base font-extrabold">Статус онбордингу</h2><p class="mt-1 text-sm leading-6 text-zinc-500">Позначте фактичний етап у кабінеті провайдера.</p></div></div>
				</div>
				<div class="p-5 sm:p-6">
					<div class="grid gap-2 md:grid-cols-3">
						{#each statuses as status (status.id)}
							<button type="button" disabled title="Статус має надходити із захищеної серверної інтеграції" aria-pressed={config.onboardingStatus === status.id} class="min-h-20 cursor-not-allowed rounded-md border-2 p-3 text-left opacity-60 {config.onboardingStatus === status.id ? 'border-blue-600 bg-blue-50' : 'border-zinc-200'}"><strong class="block text-sm">{status.label}</strong><span class="mt-1 block text-xs leading-5 text-zinc-500">{status.detail}</span></button>
						{/each}
					</div>

					<div class="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
						<label><span class="mb-2 block text-xs font-bold text-zinc-600">POS_ID</span><input value={config.posId} disabled title="POS_ID має надходити із захищеної серверної інтеграції" autocomplete="off" placeholder="Отримайте після активації в Tranzzo" class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm disabled:bg-zinc-100 disabled:text-zinc-400" /></label>
						<a href="https://tranzzo.com/" target="_blank" rel="noreferrer" class="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50">Відкрити Tranzzo <ExternalLink size={15} aria-hidden="true" /></a>
					</div>
					<div class="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4"><KeyRound size={18} class="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" /><p class="text-xs leading-5 text-amber-950"><strong>Секретні ключі тут не вводяться.</strong> API_KEY, API_SECRET та ключ webhook мають зберігатися на сервері. Підключення платежів стане активним лише після створення захищеного backend-з'єднання.</p></div>
				</div>
			</section>

			<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="border-b border-zinc-200 px-5 py-5 sm:px-6"><div class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-700"><Smartphone size={19} aria-hidden="true" /></span><div><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Цифрові гаманці</p><h2 class="mt-1 text-base font-extrabold">Apple Pay і Google Pay</h2><p class="mt-1 text-sm leading-6 text-zinc-500">Вибір стане доступним після підтвердження акаунта і POS_ID.</p></div></div></div>
				<div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
					{#each wallets as wallet (wallet.id)}
						<button type="button" disabled title="Цифрові гаманці очікують захищену інтеграцію провайдера" aria-pressed={config.requestedWallets.includes(wallet.id)} class="flex min-h-20 cursor-not-allowed items-center gap-4 rounded-md border-2 bg-zinc-50 p-4 text-left text-zinc-400 {config.requestedWallets.includes(wallet.id) ? 'border-violet-600' : 'border-zinc-200'}">
							<span class="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-950 text-white"><CreditCard size={19} aria-hidden="true" /></span><span class="min-w-0 flex-1"><strong class="block text-sm">{wallet.name}</strong><span class="mt-1 block text-xs leading-5 opacity-70">{wallet.detail}</span></span>{#if config.requestedWallets.includes(wallet.id)}<Check size={17} class="shrink-0 text-violet-700" aria-hidden="true" />{/if}
						</button>
					{/each}
				</div>
			</section>
		</div>

		<aside class="h-fit overflow-hidden rounded-lg border border-zinc-200 bg-white xl:sticky xl:top-24">
			<div class="border-b border-zinc-200 p-5"><p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Готовність</p><div class="mt-3 flex items-end justify-between"><strong class="text-3xl">{setupProgress}/4</strong><span class="text-xs font-bold text-zinc-500">кроки</span></div><div class="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100"><div class="h-full bg-emerald-500 transition-all" style:width={`${setupProgress * 25}%`}></div></div></div>
			<ol class="space-y-4 p-5 text-xs">
				<li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Check size={13} aria-hidden="true" /></span><span><strong class="block text-zinc-900">Провайдер обрано</strong><span class="mt-1 block leading-5 text-zinc-500">Tranzzo</span></span></li>
				<li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full {setupProgress >= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'}">{#if setupProgress >= 2}<Check size={13} aria-hidden="true" />{:else}2{/if}</span><span><strong class="block text-zinc-900">Онбординг</strong><span class="mt-1 block leading-5 text-zinc-500">Реєстрація і перевірка бізнесу</span></span></li>
				<li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full {setupProgress >= 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'}">{#if setupProgress >= 3}<Check size={13} aria-hidden="true" />{:else}3{/if}</span><span><strong class="block text-zinc-900">Ідентифікатор точки</strong><span class="mt-1 block leading-5 text-zinc-500">POS_ID із кабінету Tranzzo</span></span></li>
				<li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500">4</span><span><strong class="block text-zinc-900">Серверне підключення</strong><span class="mt-1 block leading-5 text-zinc-500">Ключі, webhook і тестовий платіж</span></span></li>
			</ol>
			<div class="border-t border-zinc-200 p-5">
				{#if issues.length}<div class="mb-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"><CircleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" /> {issues[0]}</div>{/if}
				<button type="button" disabled title="Налаштування провайдера очікує захищений backend" class="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-zinc-200 px-4 text-sm font-extrabold text-zinc-500"><Save size={17} aria-hidden="true" /> Очікує backend</button>
				<p class="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-500"><ShieldCheck size={15} class="mt-0.5 shrink-0" aria-hidden="true" /> Збережені локально дані не активують приймання платежів.</p>
			</div>
		</aside>
	</div>
</div>