<script lang="ts">
	let { period = "Q3 2026", amount = 0, status = "pending" }: { period?: string, amount?: number, status?: "completed" | "pending" | "upcoming" } = $props();
	
	const formatted = $derived(new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(amount / 100));
</script>

<div class="flex flex-col rounded-[2.5rem] antigravity-glass p-8 h-full">
	<h3 class="text-sm font-extrabold uppercase tracking-widest text-zinc-400 mb-8">Шлях виплати</h3>
	
	<div class="relative ml-2 space-y-10 before:absolute before:inset-0 before:ml-[7px] before:h-full before:w-[2px] before:-translate-x-px before:bg-gradient-to-b before:from-emerald-500 before:via-indigo-300/50 before:to-zinc-200/50">
		
		<div class="relative flex items-center gap-6">
			<div class="absolute -left-[3px] flex size-4 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-4 ring-white"></div>
			<div class="ml-8 flex flex-col">
				<span class="font-bold text-zinc-900 tracking-tight">Зароблено за період</span>
				<span class="text-sm text-zinc-500 font-medium mt-0.5">{period} • {formatted}</span>
			</div>
		</div>

		<div class="relative flex items-center gap-6">
			<div class="absolute -left-[3px] flex size-4 items-center justify-center rounded-full {status === 'completed' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-4 ring-white' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] ring-4 ring-indigo-50 animate-pulse'}"></div>
			<div class="ml-8 flex flex-col">
				<span class="font-bold {status === 'completed' ? 'text-zinc-900' : 'text-indigo-600'} tracking-tight">Перевірка DAC7</span>
				<span class="text-sm {status === 'completed' ? 'text-zinc-500' : 'text-indigo-500/80'} font-medium mt-0.5">{status === 'completed' ? 'Завершено успішно' : 'Синхронізація (SCA/RTP)'}</span>
			</div>
		</div>

		<div class="relative flex items-center gap-6">
			<div class="absolute -left-[3px] flex size-4 items-center justify-center rounded-full {status === 'completed' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-4 ring-white' : 'bg-zinc-200 ring-4 ring-white'}"></div>
			<div class="ml-8 flex flex-col">
				<span class="font-bold {status === 'completed' ? 'text-zinc-900' : 'text-zinc-400'} tracking-tight">Маршрутизація (СЕП-4.1)</span>
				<span class="text-sm {status === 'completed' ? 'text-zinc-500' : 'text-zinc-400'} font-medium mt-0.5">{status === 'completed' ? 'Виплачено на рахунок' : 'Очікує виконання'}</span>
			</div>
		</div>
	</div>
</div>
