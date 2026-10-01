<script lang="ts">
	import {
		CheckCircle2,
		ChevronRight,
		Layers,
		Receipt,
		ShieldCheck,
		Truck,
		X
	} from '@lucide/svelte';
	import type { Dac7IncomeTransaction } from '../../types';
	import { fmt } from '../../mockData';

	let {
		tx = null,
		onClose
	}: {
		tx: Dac7IncomeTransaction | null;
		onClose: () => void;
	} = $props();
</script>

{#if tx}
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
			class="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-stone-200 px-6 py-4">
				<div class="flex items-center gap-2">
					<Truck class="size-5 text-emerald-600" />
					<h2 class="text-base font-bold text-stone-900">Деталізація доставки</h2>
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
				<div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
					<div class="text-3xl font-black text-emerald-800 tabular-nums">+{fmt(tx.net)} ₴</div>
					<div class="mt-1 text-xs font-medium text-emerald-700">
						Винагорода кур'єра за доставку
					</div>
					<div class="mt-0.5 text-[11px] text-stone-500">{tx.p} · {tx.d}</div>
				</div>

				<div class="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">ID Транзакції:</span>
						<span class="font-mono font-bold text-stone-800">{tx.id}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Номер замовлення VARUS:</span>
						<span class="font-mono text-stone-800">{tx.orderId || 'ORD-VARUS-9821'}</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Статус життєвого циклу:</span>
						<span
							class="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700"
						>
							{tx.deliveryStatus}
						</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Нарахована винагорода (Gross):</span>
						<span class="font-bold text-stone-900">{fmt(tx.gross)} ₴</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Утримано 10% ПДФО:</span>
						<span class="font-bold text-emerald-700">−{fmt(tx.tax)} ₴</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Військовий збір:</span>
						<span class="font-bold text-stone-400">−0.00 ₴ (0%)</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Чистими до виплати (Net):</span>
						<span class="font-black text-stone-900">{fmt(tx.net)} ₴</span>
					</div>
					<div class="flex justify-between p-3.5">
						<span class="text-stone-400">Час виконання доставки:</span>
						<span class="text-stone-600">{tx.date} о {tx.time}</span>
					</div>
				</div>

				<div
					class="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
				>
					<ShieldCheck class="mt-0.5 size-4 shrink-0 text-emerald-700" />
					<div class="text-[11.5px] leading-relaxed">
						Винагороду зафіксовано в **Courier Income Ledger**. Податки утримані автоматично
						відповідно до Закону № 4903-IX. Жодних звітів до податкової самостійно подавати не
						потрібно.
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
