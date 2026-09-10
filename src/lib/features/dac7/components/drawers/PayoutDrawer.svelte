<script lang="ts">
	import {
		AlertTriangle,
		Ban,
		CircleCheck,
		CreditCard,
		Layers,
		Receipt,
		ShieldCheck,
		X
	} from '@lucide/svelte';
	import type { Dac7Payout } from '../../types';
	import { fmt, PO_META } from '../../mockData';

	let {
		payout = null,
		onClose
	}: {
		payout: Dac7Payout | null;
		onClose: () => void;
	} = $props();
</script>

{#if payout}
	<div
		class="animate-fadeIn fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
	>
		<button
			type="button"
			class="fixed inset-0 h-full w-full cursor-default bg-transparent"
			onclick={onClose}
			aria-label="Закрити"
		></button>

		<div
			class="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-stone-200 px-6 py-4">
				<div class="flex items-center gap-2">
					<Receipt class="size-5 text-stone-700" />
					<h2 class="text-base font-bold text-stone-900">Деталізація банківської виплати</h2>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="cursor-pointer rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
				>
					<X class="size-5" />
				</button>
			</div>

			<div class="flex-1 space-y-6 p-6 text-xs">
				<!-- Hero sum -->
				<div class="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center">
					<div class="text-3xl font-black text-stone-900 tabular-nums">{fmt(payout.net)} ₴</div>
					<div class="mt-1 text-xs text-stone-500">Фактична виплата на IBAN · {payout.seller}</div>
					<div class="mt-3">
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold {PO_META[
								payout.st
							]?.t === 'ok'
								? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
								: payout.st === 'hold'
									? 'border border-amber-200 bg-amber-50 text-amber-700'
									: 'border border-red-200 bg-red-50 text-red-700'}"
						>
							<span class="size-1.5 rounded-full bg-current"></span>
							{PO_META[payout.st]?.l || payout.st}
						</span>
					</div>
				</div>

				<!-- Ledger Breakdown -->
				<div class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">ID Транзакції:</span>
						<span class="font-mono font-bold text-stone-800">{payout.id}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">ID Кур'єра:</span>
						<span class="font-mono text-stone-800">{payout.sid}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Нараховано доходу (Gross):</span>
						<span class="font-bold text-stone-900">{fmt(payout.gross)} ₴</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Утримано 10% ПДФО:</span>
						<span class="font-bold text-emerald-700">−{fmt(payout.tax)} ₴</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Військовий збір:</span>
						<span class="font-bold text-stone-400">−0.00 ₴ (0%)</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Платіжний рейл:</span>
						<span class="font-semibold text-stone-800">{payout.rail}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Дата та час:</span>
						<span class="text-stone-600">{payout.date}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Незмінний запис Payout Ledger:</span>
						<span class="font-mono text-xs text-sky-700">led_01J8ZKR9</span>
					</div>
				</div>

				{#if payout.st === 'hold'}
					<div
						class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
					>
						<AlertTriangle class="mt-0.5 size-4 shrink-0" />
						<div>
							<div class="font-bold">Виплату призупинено (AML/KYC Hold)</div>
							<div class="mt-0.5 text-[11px] text-amber-700/80">
								Очікується підтвердження оновленого сертифікату Дія.Підпис або розблокування після
								ручної перевірки комплаєнс-офіцером.
							</div>
						</div>
					</div>
				{/if}

				<!-- Immutable Audit Trail -->
				<div class="space-y-3">
					<div class="text-xs font-bold text-stone-900">Журнал аудиту транзакції (Hash-Chain)</div>
					<div class="ml-2 space-y-2 border-l-2 border-stone-100 pl-4">
						<div class="relative">
							<div class="absolute top-1 -left-[21px] size-2.5 rounded-full bg-emerald-500"></div>
							<div class="font-bold text-stone-900">payments.authorized</div>
							<div class="text-[11px] text-stone-400">
								{payout.date} · Замовлення клієнта сплачено
							</div>
						</div>
						<div class="relative">
							<div class="absolute top-1 -left-[21px] size-2.5 rounded-full bg-emerald-500"></div>
							<div class="font-bold text-stone-900">split.completed</div>
							<div class="text-[11px] text-stone-400">
								Розщеплення коштів: Мерчант / Кур'єр / Платформа
							</div>
						</div>
						<div class="relative">
							<div class="absolute top-1 -left-[21px] size-2.5 rounded-full bg-emerald-500"></div>
							<div class="font-bold text-stone-900">tax.calculated</div>
							<div class="text-[11px] text-stone-400">
								ПДФО {fmt(payout.tax)} ₴ (10%) · Закон № 4903-IX
							</div>
						</div>
						<div class="relative">
							<div class="absolute top-1 -left-[21px] size-2.5 rounded-full bg-stone-900"></div>
							<div class="font-bold text-stone-900">payout.settled</div>
							<div class="text-[11px] text-stone-400">Перераховано через {payout.rail} на IBAN</div>
						</div>
					</div>
				</div>
			</div>

			<div class="flex justify-end border-t border-stone-200 bg-stone-50 p-4 px-6">
				<button
					type="button"
					onclick={onClose}
					class="cursor-pointer rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Закрити
				</button>
			</div>
		</div>
	</div>
{/if}
