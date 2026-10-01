<script lang="ts">
	import {
		AlertTriangle,
		ArrowRight,
		CircleCheck,
		Columns,
		FileSpreadsheet,
		FileText,
		Play,
		RefreshCw,
		ShieldAlert,
		Upload,
		X
	} from '@lucide/svelte';
	import { validateIban, parseIban } from '../iban';
	import { fmt } from '../mockData';

	let { onClose }: { onClose?: () => void } = $props();

	let step = $state<1 | 2 | 3>(1);
	let isProcessing = $state(false);

	const demoRows = [
		{
			name: 'Олексій Ткаченко',
			rnokpp: '3091248192',
			iban: 'UA513220010000026200000002384',
			gross: 5000,
			desc: 'Послуги курʼєрської доставки за тиждень'
		},
		{
			name: 'Марія Гнатюк',
			rnokpp: '2987654321',
			iban: 'UA893052990000026000987654321',
			gross: 8500,
			desc: 'Транспортні послуги (ФОП - 0% утримання)'
		},
		{
			name: 'Олександр Мороз',
			rnokpp: '3328127399',
			iban: 'UA123456789012345678901234567',
			gross: 3000,
			desc: 'Преміальні нарахування'
		}
	];

	const validatedRows = $derived(
		demoRows.map((r) => {
			const isIbanValid = validateIban(r.iban);
			const isFop = r.desc.includes('ФОП');
			// 10% PIT, NO military tax!
			const tax = isFop ? 0 : Math.round(r.gross * 0.1);
			const net = r.gross - tax;
			return {
				...r,
				isIbanValid,
				isFop,
				tax,
				net,
				status: isIbanValid ? 'ok' : 'invalid_iban'
			};
		})
	);

	function startImport() {
		isProcessing = true;
		setTimeout(() => {
			isProcessing = false;
			step = 3;
		}, 1500);
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
	<!-- Top Bar -->
	<div class="flex items-center justify-between border-b border-stone-200 pb-4">
		<div class="flex items-center gap-2.5">
			<span class="grid size-9 place-items-center rounded-xl bg-stone-900 text-white">
				<FileSpreadsheet class="size-5" />
			</span>
			<div>
				<h2 class="text-base font-bold text-stone-900">
					Майстер імпорту реєстрів виплат (CSV / Excel)
				</h2>
				<p class="text-xs text-stone-500">
					Пакетна валідація IBAN (Modulo 97), розрахунок 10% ПДФО та підготовка Payout Ledger Batch
				</p>
			</div>
		</div>
		{#if onClose}
			<button
				type="button"
				onclick={onClose}
				class="cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
			>
				<X class="size-5" />
			</button>
		{/if}
	</div>

	<!-- Step Indicators -->
	<div class="flex items-center justify-between px-4 text-xs font-semibold">
		<span class={step >= 1 ? 'font-bold text-stone-900' : 'text-stone-400'}>1. Вибір файлу</span>
		<span class="text-stone-300">———</span>
		<span class={step >= 2 ? 'font-bold text-stone-900' : 'text-stone-400'}
			>2. Валідація IBAN та 10% ПДФО</span
		>
		<span class="text-stone-300">———</span>
		<span class={step >= 3 ? 'font-bold text-stone-900' : 'text-stone-400'}>3. Створення батчу</span
		>
	</div>

	<!-- Step 1: Upload / Demo Data -->
	{#if step === 1}
		<div
			class="space-y-4 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/60 p-8 text-center"
		>
			<div class="mx-auto grid size-12 place-items-center rounded-full bg-stone-200 text-stone-600">
				<Upload class="size-6" />
			</div>
			<div class="space-y-1">
				<div class="text-sm font-bold text-stone-900">Перетягніть реєстр або завантажте файл</div>
				<p class="text-xs text-stone-500">Підтримуються формати .CSV, .XLSX (до 20 000 рядків)</p>
			</div>
			<div class="flex justify-center gap-3 pt-2">
				<button
					type="button"
					onclick={() => (step = 2)}
					class="cursor-pointer rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Використати тестовий реєстр VARUS (3 записи)
				</button>
			</div>
		</div>

		<!-- Step 2: Validation Table -->
	{:else if step === 2}
		<div class="space-y-4">
			<div class="overflow-hidden rounded-xl border border-stone-200 text-xs">
				<table class="w-full text-left">
					<thead class="border-b border-stone-200 bg-stone-50 font-semibold text-stone-500">
						<tr>
							<th class="p-3">Кур'єр / РНОКПП</th>
							<th class="p-3">IBAN рахунок</th>
							<th class="p-3 text-right">Нараховано</th>
							<th class="p-3 text-right">ПДФО 10%</th>
							<th class="p-3 text-right">До виплати (Net)</th>
							<th class="p-3 text-center">Статус</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100 text-stone-700">
						{#each validatedRows as row}
							<tr class="hover:bg-stone-50/50">
								<td class="p-3">
									<div class="font-bold text-stone-900">{row.name}</div>
									<div class="font-mono text-[10.5px] text-stone-400">{row.rnokpp}</div>
								</td>
								<td class="p-3 font-mono text-[11px]">
									{row.iban}
								</td>
								<td class="p-3 text-right font-mono font-bold">{fmt(row.gross)} ₴</td>
								<td class="p-3 text-right font-mono font-bold text-emerald-700">
									{row.tax > 0 ? `−${fmt(row.tax)} ₴` : '0 ₴ (ФОП)'}
								</td>
								<td class="p-3 text-right font-mono font-black text-stone-900">{fmt(row.net)} ₴</td>
								<td class="p-3 text-center">
									{#if row.status === 'ok'}
										<span
											class="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700"
										>
											<CircleCheck class="size-3" /> Валідний
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 font-bold text-red-700"
										>
											<AlertTriangle class="size-3" /> Помилка IBAN
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="flex items-center justify-between pt-2">
				<button
					type="button"
					onclick={() => (step = 1)}
					class="cursor-pointer rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
				>
					Назад
				</button>
				<button
					type="button"
					onclick={startImport}
					disabled={isProcessing}
					class="flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800"
				>
					{#if isProcessing}
						<RefreshCw class="size-4 animate-spin" /> Обробка батчу...
					{:else}
						<Play class="size-4" /> Сформувати виплатний батч
					{/if}
				</button>
			</div>
		</div>

		<!-- Step 3: Success Batch -->
	{:else if step === 3}
		<div class="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center">
			<div
				class="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500 text-white shadow-sm"
			>
				<CircleCheck class="size-7" />
			</div>
			<div class="space-y-1">
				<h3 class="text-base font-bold text-emerald-950">Батч виплат успішно створено!</h3>
				<p class="text-xs text-emerald-800">
					Сформовано реєстр **BATCH-2026/09-VARUS** на суму **15 150.00 ₴**. Утримано **1 350.00 ₴**
					(10% ПДФО). Військовий збір = 0.00 ₴.
				</p>
			</div>
			<div class="flex justify-center gap-3 pt-2 text-xs">
				<button
					type="button"
					onclick={() => (step = 1)}
					class="cursor-pointer rounded-xl bg-stone-900 px-5 py-2.5 font-bold text-white transition hover:bg-stone-800"
				>
					Завантажити ще один файл
				</button>
			</div>
		</div>
	{/if}
</div>
