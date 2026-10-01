<script lang="ts">
	import {
		CreditCard,
		History,
		QrCode,
		ShieldCheck,
		ShoppingCart,
		Store,
		Wallet,
		RefreshCw
	} from '@lucide/svelte';
	import type { Dac7Gateway } from '../dac7-gateway';

	let {
		gateway,
		demo = false,
		activeTab = 'business_hub'
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		activeTab?: string;
	} = $props();

	let paymentStatus = $state<'idle' | 'processing' | 'success'>('idle');

	function simulateClientPayment() {
		paymentStatus = 'processing';
		setTimeout(() => {
			paymentStatus = 'success';
			alert(
				"Оплата клієнта успішна! Згенеровано Payment Ledger Event. Згідно з моделлю VARUS: Оплата клієнта ≠ Дохід кур'єра. Ці кошти акумулюються на загальному рахунку платформи до моменту розщеплення (Split)."
			);
			setTimeout(() => {
				paymentStatus = 'idle';
			}, 3000);
		}, 1500);
	}
</script>

<div class="mx-auto max-w-7xl space-y-6">
	{#if activeTab === 'business_hub'}
		<!-- Business Hub -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span
							class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white"
						>
							<Store size={14} />
						</span>
						<h2 class="text-base font-bold text-stone-900">
							Кабінет Мерчанта (VARUS / Restaurant)
						</h2>
					</div>
					<p class="text-xs text-stone-500">
						Управління фінансовими потоками комерційного партнера. Інтеграція з платформою доставки.
					</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Виторг за сьогодні</span>
				<div class="text-xl font-black text-stone-900">124 500 ₴</div>
				<p class="text-xs text-stone-500">Доступно до виводу на IBAN</p>
			</div>
			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Успішних транзакцій</span>
				<div class="text-xl font-black text-stone-900">342</div>
				<p class="text-xs text-stone-500">Google Pay / Apple Pay / Картки</p>
			</div>
			<div class="space-y-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<span class="text-xs font-semibold text-stone-400">Комісія еквайрингу</span>
				<div class="text-xl font-black text-emerald-600">1.2%</div>
				<p class="text-xs text-stone-500">Спеціальний тариф</p>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-sm font-bold text-stone-900">
				Останні платежі клієнтів (Payment Ledger)
			</h3>
			<div class="divide-y divide-stone-100">
				{#each [{ id: 'pay_991', time: '2 хв тому', sum: '850 ₴', via: 'Apple Pay' }, { id: 'pay_990', time: '14 хв тому', sum: '1 200 ₴', via: 'Google Pay' }, { id: 'pay_989', time: '21 хв тому', sum: '340 ₴', via: 'Mastercard' }] as p}
					<div class="flex items-center justify-between py-3">
						<div>
							<div class="text-sm font-bold text-stone-900">Замовлення #{p.id}</div>
							<div class="text-xs text-stone-500">{p.time} · {p.via}</div>
						</div>
						<div class="font-bold text-emerald-600">+{p.sum}</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if activeTab === 'business_checkout'}
		<!-- Checkout Simulation -->
		<div class="mx-auto mt-8 max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="mb-8 space-y-2 text-center">
				<div
					class="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm"
				>
					<ShoppingCart size={24} />
				</div>
				<h2 class="text-xl font-bold text-stone-900">VARUS Checkout</h2>
				<p class="text-sm text-stone-500">Симуляція оплати замовлення клієнтом</p>
			</div>

			<div class="mb-6 space-y-3 rounded-xl bg-stone-50 p-4">
				<div class="flex justify-between text-sm">
					<span class="text-stone-500">Сума замовлення</span>
					<span class="font-bold text-stone-900">850 ₴</span>
				</div>
				<div class="flex justify-between text-sm">
					<span class="text-stone-500">Пакет послуг доставки</span>
					<span class="font-bold text-stone-900">80 ₴</span>
				</div>
				<div class="flex justify-between border-t border-stone-200 pt-3 text-base">
					<span class="font-bold text-stone-900">До сплати</span>
					<span class="font-black text-emerald-600">930 ₴</span>
				</div>
			</div>

			{#if paymentStatus === 'idle'}
				<button
					onclick={simulateClientPayment}
					class="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-900 text-[15px] font-bold text-white shadow-md transition hover:bg-stone-800"
				>
					<Wallet size={18} /> Оплатити 930 ₴
				</button>
			{:else if paymentStatus === 'processing'}
				<button
					disabled
					class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-200 text-[15px] font-bold text-stone-500 transition"
				>
					<RefreshCw size={18} class="animate-spin" /> Обробка платежу...
				</button>
			{:else}
				<button
					disabled
					class="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[15px] font-bold text-emerald-600 transition"
				>
					<ShieldCheck size={18} /> Оплачено успішно
				</button>
			{/if}

			<p class="mt-6 text-center text-[11px] leading-relaxed text-stone-400">
				Згідно з моделлю VARUS, цей платіж фіксується у Payment Ledger як єдине ціле. Кошти за
				послугу доставки (80 ₴) не є прямою винагородою конкретному кур'єру. Логістичний рушій
				призначить кур'єра (ASSIGNED), а після виконання (DELIVERED) створить Income Event у Courier
				Income Ledger на суму його особистої винагороди (напр. 100 ₴).
			</p>
		</div>
	{/if}
</div>
