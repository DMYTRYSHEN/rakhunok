<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	
	let { balance, currency = "₴", trend = "+ Активно" }: { balance: number, currency?: string, trend?: string } = $props();
	
	const formatted = $derived(new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2 }).format(balance / 100));
</script>

<div class="relative overflow-hidden rounded-[2.5rem] antigravity-glass p-8 transition-all hover:scale-[1.01] duration-500 ease-out group">
	<!-- Holographic Aura -->
	<div class="absolute -inset-32 bg-gradient-to-tr from-emerald-400/20 via-transparent to-indigo-400/20 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none"></div>
	
	<div class="relative z-10 flex items-center justify-between mb-10">
		<div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-white/90 backdrop-blur-md shadow-sm">
			<Sparkles size={16} class="text-indigo-500" />
			<span class="text-[11px] font-extrabold uppercase tracking-widest text-zinc-700">Доступно до виплати</span>
		</div>
		<div class="flex items-center text-xs font-bold text-emerald-700 bg-emerald-100/60 border border-emerald-200/50 px-3 py-1.5 rounded-full backdrop-blur-md">
			{trend}
		</div>
	</div>
	
	<div class="relative z-10 flex items-baseline gap-2">
		<span class="text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-600">{formatted}</span>
		<span class="text-3xl font-bold text-zinc-400/80">{currency}</span>
	</div>
</div>
