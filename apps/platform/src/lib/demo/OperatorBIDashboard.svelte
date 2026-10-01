<script lang="ts">
	import { ArrowUpRight, ShieldAlert, Wallet, TrendingUp, BarChart3, Fingerprint } from '@lucide/svelte';
	
	let { summary, sellersCount = 0, clarificationCount = 0, navigate, personaId, navigation, icons, taskLabels, taskDetails } = $props();

	const money = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 2 }).format(minor / 100);
</script>

<div class="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-6 metrics">
	
	<!-- Left Column: Core BI Metrics & DAC7 Compliance (Deep Space + Holographic) -->
	<div class="xl:col-span-8 flex flex-col gap-8">
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Metric 1: Light Holographic -->
			<div class="relative overflow-hidden rounded-[2.5rem] antigravity-glass p-8 group">
				<div class="flex items-center justify-between text-zinc-500 mb-6">
					<span class="text-xs font-bold uppercase tracking-widest text-zinc-500">Оплати покупців</span>
					<div class="p-2.5 bg-white rounded-full shadow-sm ring-1 ring-zinc-200/50"><TrendingUp size={18} class="text-zinc-700" /></div>
				</div>
				<div class="text-4xl font-black tracking-tighter text-zinc-900">{money(summary.customerMinor)}</div>
				<div class="mt-4 flex items-center justify-between border-t border-zinc-200/60 pt-4">
					<span class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Винагороди самозайнятих</span>
					<span class="text-sm font-bold text-zinc-700">{money(summary.incomeMinor)}</span>
				</div>
			</div>
			
			<!-- Metric 2: Light Holographic -->
			<div class="relative overflow-hidden rounded-[2.5rem] antigravity-glass p-8 group">
				<div class="flex items-center justify-between text-zinc-500 mb-6">
					<span class="text-xs font-bold uppercase tracking-widest text-zinc-500">Залишок винагород</span>
					<div class="p-2.5 bg-white rounded-full shadow-sm ring-1 ring-zinc-200/50"><Wallet size={18} class="text-zinc-700" /></div>
				</div>
				<div class="text-4xl font-black tracking-tighter text-zinc-900">{money(summary.balanceMinor)}</div>
				<div class="mt-4 flex items-center justify-between border-t border-zinc-200/60 pt-4">
					<span class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Вже виплачено</span>
					<span class="text-sm font-bold text-emerald-600">{money(summary.paidMinor)}</span>
				</div>
			</div>
		</div>

		<!-- DAC7 Compliance BI Widget: Antigravity Deep Space -->
		<div class="relative overflow-hidden rounded-[2.5rem] antigravity-dark-glass p-10 text-white group">
			<!-- Mesh Aurora Glow -->
			<div class="absolute -top-[30%] -left-[10%] w-[120%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/30 via-purple-500/10 to-transparent blur-3xl pointer-events-none group-hover:from-indigo-400/40 transition-all duration-1000"></div>
			
			<div class="relative z-10 flex items-center justify-between mb-12">
				<div class="flex items-center gap-4">
					<div class="p-3 bg-white/5 rounded-2xl ring-1 ring-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.2)]"><ShieldAlert size={24} class="text-indigo-300" /></div>
					<div>
						<h3 class="text-2xl font-black tracking-tighter text-gradient-aurora">DAC7</h3>
						<p class="text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">Live Compliance Monitor</p>
					</div>
				</div>
				<button class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]" onclick={() => navigate(personaId, 'reports')}>
					Звіти <BarChart3 size={16} />
				</button>
			</div>
			
			<div class="grid grid-cols-3 gap-6 relative z-10">
				<div class="flex flex-col bg-white/5 p-5 rounded-3xl border border-white/5 backdrop-blur-sm">
					<span class="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Активні продавці</span>
					<span class="text-3xl font-black">{sellersCount}</span>
				</div>
				<div class="flex flex-col bg-white/5 p-5 rounded-3xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
					<div class="absolute top-0 right-0 p-3"><Fingerprint size={16} class="text-zinc-500/50" /></div>
					<span class="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Підзвітні (>30)</span>
					<div class="flex items-baseline gap-2">
						<span class="text-3xl font-black">{Math.floor(sellersCount * 0.8)}</span>
						<span class="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">TODO</span>
					</div>
				</div>
				<div class="flex flex-col bg-amber-500/10 p-5 rounded-3xl border border-amber-500/20 backdrop-blur-sm">
					<span class="text-amber-400/80 text-xs font-bold uppercase tracking-widest mb-2">Потребують уваги</span>
					<span class="text-3xl font-black text-amber-400">{clarificationCount}</span>
				</div>
			</div>
			
			<div class="mt-8 pt-6 border-t border-white/10 relative z-10 flex items-center justify-between">
				<div class="text-sm font-medium text-zinc-400">Податок (ПДФО 10%, ВЗ 0% | ФОП 0%): <span class="text-white font-bold ml-1">{summary.taxMinor > 0 ? money(summary.taxMinor) : '0,00'}</span></div>
				<div class="text-xs font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-3 py-1.5 rounded-full">
					AI Аналіз недоступний
				</div>
			</div>
		</div>
	</div>
	
	<!-- Right Column: Quick Actions & Workflow (Floating Islands) -->
	<div class="xl:col-span-4 flex flex-col gap-5 task-list">
		<h3 class="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-2 mb-2">Навігація Простору</h3>
		
		<div class="flex flex-col gap-4">
			{#each navigation.filter((item: any) => !['overview', 'audit'].includes(item.id)) as item (item.id)}
				{@const TaskIcon = icons[item.id]}
				<button 
					aria-label={`Відкрити: ${item.label}`} 
					onclick={() => navigate(personaId, item.id)}
					class="group flex items-center gap-5 antigravity-glass p-5 rounded-3xl text-left hover:-translate-y-1 transition-all duration-300"
				>
					<div class="flex-shrink-0 p-4 bg-zinc-900 rounded-2xl group-hover:bg-indigo-600 transition-colors shadow-lg">
						<TaskIcon size={22} strokeWidth={2} class="text-white" />
					</div>
					<div class="flex-grow">
						<div class="font-bold text-zinc-900 tracking-tight text-base mb-1">{taskLabels[item.id] ?? item.label}</div>
						<div class="text-[13px] font-medium text-zinc-500 line-clamp-2 leading-relaxed">{taskDetails[item.id]}</div>
					</div>
					<div class="flex-shrink-0 bg-zinc-50 p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
						<ArrowUpRight size={18} class="text-zinc-400 group-hover:text-indigo-600 transition-colors" />
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>
