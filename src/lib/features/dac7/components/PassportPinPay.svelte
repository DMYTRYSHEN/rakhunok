<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		CheckCircle2,
		Copy,
		CreditCard,
		Fingerprint,
		KeyRound,
		Lock,
		QrCode,
		RefreshCw,
		ShieldCheck,
		Smartphone,
		Store,
		Tag
	} from '@lucide/svelte';
	import type { Dac7LoyaltyCard, Dac7PinPaySession } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoLoyaltyCards } from '../mockData';

	let {
		gateway,
		demo = false
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
	} = $props();

	let currentPin = $state('84192');
	let secondsLeft = $state(28);
	let loyaltyCards = $state<Dac7LoyaltyCard[]>(demoLoyaltyCards);
	let loading = $state(true);
	let biometricState = $state<'idle' | 'scanning' | 'authorized'>('authorized');
	let timer: any = null;

	async function loadLoyalty() {
		loading = true;
		loyaltyCards = await gateway.getLoyaltyCards(demo);
		loading = false;
	}

	function refreshPin() {
		currentPin = Math.floor(10000 + Math.random() * 90000).toString();
		secondsLeft = 30;
	}

	function startTimer() {
		timer = setInterval(() => {
			if (secondsLeft > 1) {
				secondsLeft -= 1;
			} else {
				refreshPin();
			}
		}, 1000);
	}

	async function testBiometric() {
		biometricState = 'scanning';
		setTimeout(() => {
			biometricState = 'authorized';
		}, 1200);
	}

	onMount(() => {
		loadLoyalty();
		startTimer();
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="space-y-6">
	<!-- Banner -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white">
						<Lock size={14} />
					</span>
					<h2 class="text-base font-bold text-stone-900">
						Rahunok Auth • Passkeys & 5-значний pinPay для КСО
					</h2>
				</div>
				<p class="text-xs text-stone-500">
					Безпарольна біометрична ідентифікація (FIDO2 / FaceID) та інтеграція програм лояльності рітейлу (VARUS, Сільпо, АТБ)
				</p>
			</div>

			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">
					<ShieldCheck size={13} />
					Passkey WebAuthn Активний
				</span>
			</div>
		</div>
	</div>

	<!-- 5-digit pinPay Generator & Passkey Biometric Hub -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- 5-digit pinPay Generator Card -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-bold text-stone-900">Динамічний PIN для кас самообслуговування</h3>
					<p class="text-xs text-stone-500">Введіть цей код на КСО або покажіть штрихкод</p>
				</div>
				<button
					type="button"
					onclick={refreshPin}
					class="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
					title="Оновити PIN"
				>
					<RefreshCw size={15} />
				</button>
			</div>

			<!-- Large PIN display -->
			<div class="flex flex-col items-center justify-center rounded-2xl bg-stone-900 py-8 px-4 text-white space-y-3">
				<span class="text-xs text-stone-400 uppercase tracking-widest font-semibold">
					pinPay Код авторизації
				</span>
				<div class="flex items-center gap-3 font-mono text-4xl sm:text-5xl font-black tracking-widest text-emerald-400">
					{#each currentPin.split('') as digit}
						<span class="grid size-12 sm:size-14 place-items-center rounded-xl bg-stone-800 shadow-inner border border-stone-700/50">
							{digit}
						</span>
					{/each}
				</div>

				<div class="flex items-center gap-2 text-xs text-stone-400 pt-2">
					<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span>Дійсний ще {secondsLeft} секунд</span>
				</div>
			</div>

			<div class="text-xs text-stone-500 space-y-1 text-center sm:text-left">
				<p>• Працює без інтернет-з'єднання на терміналі за стандартом TOTP RFC 6238.</p>
				<p>• Автоматично списує або нараховує бонуси підключеної мережі супермаркетів.</p>
			</div>
		</div>

		<!-- Passkey & Biometric Status -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-bold text-stone-900">Біометричні ключі доступу (Passkeys)</h3>
					<p class="text-xs text-stone-500">Апаратна автентифікація через Secure Enclave</p>
				</div>
				<span class="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
					FIDO2 L2
				</span>
			</div>

			<div class="space-y-3">
				<div class="flex items-center justify-between p-3.5 rounded-xl border border-stone-200 bg-stone-50 text-xs">
					<div class="flex items-center gap-3">
						<div class="grid size-9 place-items-center rounded-lg bg-stone-900 text-white">
							<Fingerprint size={18} />
						</div>
						<div>
							<div class="font-bold text-stone-900">Apple TouchID / FaceID</div>
							<div class="text-stone-500 text-[11px]">iPhone 15 Pro • Останній вхід: щойно</div>
						</div>
					</div>
					<span class="text-emerald-700 font-bold">Активний</span>
				</div>

				<div class="flex items-center justify-between p-3.5 rounded-xl border border-stone-200 bg-stone-50 text-xs">
					<div class="flex items-center gap-3">
						<div class="grid size-9 place-items-center rounded-lg bg-stone-900 text-white">
							<KeyRound size={18} />
						</div>
						<div>
							<div class="font-bold text-stone-900">Windows Hello Passkey</div>
							<div class="text-stone-500 text-[11px]">TPM 2.0 • Прив'язано</div>
						</div>
					</div>
					<span class="text-emerald-700 font-bold">Активний</span>
				</div>
			</div>

			<button
				type="button"
				onclick={testBiometric}
				class="w-full rounded-xl border border-stone-300 bg-white py-2.5 text-xs font-bold text-stone-800 hover:bg-stone-50 transition"
			>
				{#if biometricState === 'scanning'}
					Сканування відбитка / FaceID...
				{:else}
					Перевірити біометрію пристрою
				{/if}
			</button>
		</div>
	</div>

	<!-- Loyalty Cards Hub -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-bold text-stone-900">Підключені картки лояльності рітейлу (КСО)</h3>
				<p class="text-xs text-stone-500">Автоматичне застосування знижок при скануванні pinPay</p>
			</div>
			<span class="text-xs text-stone-400">Карток прив'язано: {loyaltyCards.length}</span>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each loyaltyCards as card}
				<div class="flex flex-col justify-between rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-4">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="rounded-lg px-2 py-1 text-xs font-black {card.logoBg} {card.textColor}">
								{card.networkName}
							</span>
							<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
								Знижка {card.discountPct}%
							</span>
						</div>
						<div>
							<h4 class="text-xs font-bold text-stone-900">{card.cardName}</h4>
							<p class="font-mono text-xs text-stone-400">{card.cardNumber}</p>
						</div>
					</div>

					<div class="border-t border-stone-200/60 pt-3 flex items-center justify-between text-xs">
						<span class="text-stone-500">Баланс бонусів:</span>
						<span class="font-black text-stone-900">{card.points.toLocaleString('uk-UA')} б.</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
