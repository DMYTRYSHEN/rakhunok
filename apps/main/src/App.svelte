<script lang="ts">
	import { SERVICES, CATEGORIES } from './data';
	import type { EnvironmentKey, ServiceCategory, ServiceItem } from './types';
	import {
		Globe,
		LayoutDashboard,
		CreditCard,
		Smartphone,
		Cpu,
		Truck,
		QrCode,
		Headphones,
		Building2,
		Landmark,
		Network,
		Sparkles,
		Bot,
		FileText,
		Receipt,
		ArrowRight,
		ArrowLeft,
		ExternalLink,
		Copy,
		Check,
		Search,
		Grid,
		Presentation
	} from '@lucide/svelte';

	// Icon lookup
	const icons: Record<string, any> = {
		Globe,
		LayoutDashboard,
		CreditCard,
		Smartphone,
		Cpu,
		Truck,
		QrCode,
		Headphones,
		Building2,
		Landmark,
		Network,
		Sparkles,
		Bot,
		FileText,
		Receipt
	};

	let selectedEnv = $state<EnvironmentKey>('prod');
	let activeIndex = $state(0);
	let viewMode = $state<'presentation' | 'gallery'>('presentation');
	let selectedCategory = $state<ServiceCategory>('all');
	let searchQuery = $state('');
	let copiedId = $state<string | null>(null);

	const environments = [
		{ key: 'prod' as const, label: 'rhnk.to', detail: 'Production' },
		{ key: 'staging' as const, label: 'rhnk.pp.ua', detail: 'Staging' },
		{ key: 'local' as const, label: 'localhost', detail: 'Dev Ports' }
	];

	const activeService = $derived(SERVICES[activeIndex]);

	const filteredServices = $derived(
		SERVICES.filter((service) => {
			const matchesCategory =
				selectedCategory === 'all' ||
				(selectedCategory === 'next_step'
					? service.isNextStep
					: service.categoryId === selectedCategory);
			const query = searchQuery.trim().toLowerCase();
			const matchesSearch =
				!query ||
				service.title.toLowerCase().includes(query) ||
				service.subtitle.toLowerCase().includes(query) ||
				service.tagline.toLowerCase().includes(query) ||
				service.description.toLowerCase().includes(query) ||
				service.tags.some((tag) => tag.toLowerCase().includes(query));
			return matchesCategory && matchesSearch;
		})
	);

	function nextSlide() {
		activeIndex = (activeIndex + 1) % SERVICES.length;
	}

	function prevSlide() {
		activeIndex = (activeIndex - 1 + SERVICES.length) % SERVICES.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

		if (e.key === 'ArrowRight' || e.key === 'Space') {
			e.preventDefault();
			nextSlide();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prevSlide();
		} else if (e.key >= '1' && e.key <= '9') {
			const idx = Number.parseInt(e.key, 10) - 1;
			if (idx < SERVICES.length) {
				activeIndex = idx;
			}
		} else if (e.key === 'Enter') {
			const url = activeService.paths[selectedEnv];
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}

	async function copyUrl(service: ServiceItem) {
		const url = service.paths[selectedEnv];
		try {
			await navigator.clipboard.writeText(url);
			copiedId = service.id;
			setTimeout(() => {
				if (copiedId === service.id) copiedId = null;
			}, 2000);
		} catch (err) {
			console.error('Copy failed', err);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans antialiased selection:bg-black selection:text-white flex flex-col justify-between">
	<!-- Top Minimal Navigation Bar -->
	<header class="sticky top-0 z-50 bg-[#fbfbfd]/80 backdrop-blur-xl border-b border-black/[0.04]">
		<div class="max-w-7xl mx-auto px-6 sm:px-12 h-20 flex items-center justify-between gap-6">
			<!-- Logo & Quiet Manifest -->
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs tracking-tighter shadow-sm">
					R
				</div>
				<div>
					<span class="text-sm font-semibold tracking-tight text-[#1d1d1f]">RAHUNOK</span>
					<span class="text-xs text-[#86868b] ml-1.5 font-light hidden sm:inline">Екосистема</span>
				</div>
			</div>

			<!-- Center: View Mode Segmented Control -->
			<div class="inline-flex p-1 rounded-full bg-[#f5f5f7] border border-black/[0.04] shadow-inner">
				<button
					type="button"
					onclick={() => (viewMode = 'presentation')}
					class="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 {viewMode === 'presentation'
						? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
						: 'text-[#86868b] hover:text-black'}"
				>
					<Presentation size={13} strokeWidth={2} />
					<span>Презентація</span>
				</button>
				<button
					type="button"
					onclick={() => (viewMode = 'gallery')}
					class="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 {viewMode === 'gallery'
						? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
						: 'text-[#86868b] hover:text-black'}"
				>
					<Grid size={13} strokeWidth={2} />
					<span>Всі сервіси</span>
					<span class="text-[10px] text-[#86868b] font-mono">{SERVICES.length}</span>
				</button>
			</div>

			<!-- Right: Target Environment Pill -->
			<div class="inline-flex p-1 rounded-full bg-[#f5f5f7] border border-black/[0.04]">
				{#each environments as env}
					<button
						type="button"
						onclick={() => (selectedEnv = env.key)}
						class="px-3 py-1 rounded-full text-[11px] font-medium transition-all {selectedEnv === env.key
							? 'bg-white text-black shadow-sm font-semibold'
							: 'text-[#86868b] hover:text-black'}"
					>
						{env.label}
					</button>
				{/each}
			</div>
		</div>
	</header>

	{#if viewMode === 'presentation'}
		<!-- PRESENTATION MODE: Jony Ive Keynote View -->
		<main class="flex-1 max-w-6xl mx-auto w-full px-6 sm:px-12 py-12 sm:py-20 flex flex-col justify-center">
			<!-- Slide Index & Headline -->
			<div class="flex items-baseline justify-between border-b border-black/[0.05] pb-6 mb-12">
				<div class="flex items-center gap-3">
					<span class="text-4xl sm:text-6xl font-light text-[#86868b]/40 font-mono tracking-tighter">
						{activeService.index}
					</span>
					<div class="h-8 w-px bg-black/[0.08]"></div>
					<div>
						<div class="text-[11px] uppercase tracking-widest text-[#86868b] font-medium flex items-center gap-1.5">
							<span>{activeService.category}</span>
							{#if activeService.isNextStep}
								<span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200/60 inline-flex items-center gap-1">
									<Sparkles size={10} class="text-blue-600 animate-pulse" />
									Next Step
								</span>
							{/if}
						</div>
						<div class="text-xs font-medium text-[#1d1d1f]">
							{activeService.badge}
						</div>
					</div>
				</div>

				<!-- Slide Dots / Scrubbers -->
				<div class="flex items-center gap-1.5">
					{#each SERVICES as s, i}
						<button
							type="button"
							onclick={() => (activeIndex = i)}
							aria-label="Перейти до слайду {s.index}"
							class="h-1.5 rounded-full transition-all duration-300 {activeIndex === i
								? 'w-8 bg-black'
								: s.isNextStep
									? 'w-2 bg-blue-400 hover:bg-blue-600'
									: 'w-1.5 bg-black/15 hover:bg-black/40'}"
						></button>
					{/each}
				</div>
			</div>

			<!-- Main Product Showcase Grid -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
				<!-- Left Hero Content (7 Cols) -->
				<div class="lg:col-span-7 space-y-8">
					<div>
						{#if activeService.isNextStep}
							<div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold tracking-wide mb-3 shadow-sm">
								<Sparkles size={13} class="text-blue-600 animate-pulse" />
								<span>Наступний крок: App Clips & Open Banking</span>
							</div>
						{/if}
						<h2 class="text-4xl sm:text-6xl font-semibold tracking-tight text-[#1d1d1f] leading-[1.08]">
							{activeService.title}
						</h2>
						<p class="text-xl sm:text-2xl text-[#86868b] font-light mt-3 leading-snug">
							{activeService.tagline}
						</p>
					</div>

					<!-- Essence Statement -->
					<p class="text-base sm:text-lg text-[#1d1d1f]/80 font-normal leading-relaxed max-w-xl">
						{activeService.essence}
					</p>

					<!-- Detailed Description -->
					<p class="text-sm text-[#86868b] font-normal leading-relaxed max-w-xl">
						{activeService.description}
					</p>

					<!-- Key Features - Clean Monoline -->
					<div class="pt-4 border-t border-black/[0.04] space-y-2.5">
						{#each activeService.features as feat}
							<div class="flex items-center gap-3 text-sm text-[#1d1d1f]">
								<div class="w-1.5 h-1.5 rounded-full bg-black/40 shrink-0"></div>
								<span class="font-light">{feat}</span>
							</div>
						{/each}
					</div>

					<!-- Direct Action Button & URL copy -->
					<div class="pt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
						<a
							href={activeService.paths[selectedEnv]}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full {activeService.isNextStep
								? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
								: 'bg-black hover:bg-black/90'} text-white font-medium text-sm transition-all shadow-md hover:shadow-lg group"
						>
							<span>{activeService.isNextStep ? 'Концепт & Прев’ю' : `Відкрити ${activeService.title}`}</span>
							<ArrowRight size={16} class="group-hover:translate-x-1 transition-transform" />
						</a>

						<button
							type="button"
							onclick={() => copyUrl(activeService)}
							class="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-full bg-white border border-black/[0.08] hover:border-black/[0.2] text-xs font-medium text-[#1d1d1f] transition-all shadow-sm"
						>
							{#if copiedId === activeService.id}
								<Check size={14} class="text-emerald-600" />
								<span>Посилання скопійовано</span>
							{:else}
								<Copy size={14} class="text-[#86868b]" />
								<span class="font-mono text-[#86868b] truncate max-w-[200px]">
									{activeService.paths[selectedEnv]}
								</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Right Architectural Card (5 Cols) -->
				<div class="lg:col-span-5 space-y-6">
					<!-- Hero Spec Box -->
					<div class="bg-white rounded-3xl p-8 sm:p-10 border border-black/[0.05] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
						<!-- Metric Hero Callout -->
						<div>
							<div class="text-5xl sm:text-6xl font-light tracking-tight text-[#1d1d1f]">
								{activeService.keyMetric}
							</div>
							<div class="text-xs uppercase tracking-wider text-[#86868b] font-medium mt-1">
								{activeService.metricLabel}
							</div>
						</div>

						<div class="h-px bg-black/[0.05]"></div>

						<!-- Role in Flow -->
						<div>
							<div class="text-[11px] uppercase tracking-wider text-[#86868b] font-medium mb-1.5">
								Роль в екосистемі
							</div>
							<div class="text-sm font-normal text-[#1d1d1f] leading-relaxed">
								{activeService.roleInFlow}
							</div>
						</div>

						<!-- Technologies Used -->
						<div>
							<div class="text-[11px] uppercase tracking-wider text-[#86868b] font-medium mb-2.5">
								Стек реалізації
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each activeService.tags as tag}
									<span class="text-xs font-normal px-3 py-1 rounded-full {activeService.isNextStep ? 'bg-blue-50 text-blue-800 border border-blue-200/50' : 'bg-[#f5f5f7] text-[#1d1d1f]'}">
										{tag}
									</span>
								{/each}
							</div>
						</div>
					</div>

					<!-- Bottom Navigation Hints -->
					<div class="flex items-center justify-between px-2 pt-2 text-xs text-[#86868b]">
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={prevSlide}
								class="w-10 h-10 rounded-full border border-black/[0.08] bg-white flex items-center justify-center text-black hover:border-black/30 transition shadow-sm"
								aria-label="Попередній сервіс"
							>
								<ArrowLeft size={16} />
							</button>
							<button
								type="button"
								onclick={nextSlide}
								class="w-10 h-10 rounded-full border border-black/[0.08] bg-white flex items-center justify-center text-black hover:border-black/30 transition shadow-sm"
								aria-label="Наступний сервіс"
							>
								<ArrowRight size={16} />
							</button>
						</div>

						<div class="text-[11px] font-light hidden sm:block">
							Клавіші <kbd class="px-1.5 py-0.5 rounded bg-black/5 font-mono">←</kbd> <kbd class="px-1.5 py-0.5 rounded bg-black/5 font-mono">→</kbd> або <kbd class="px-1.5 py-0.5 rounded bg-black/5 font-mono">Space</kbd>
						</div>
					</div>
				</div>
			</div>
		</main>
	{:else}
		<!-- GALLERY MODE: Crisp Minimalist Architecture Overview -->
		<main class="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-12 py-12">
			<!-- Header inside gallery -->
			<div class="max-w-2xl mb-12">
				<h2 class="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
					Усі {SERVICES.length} модулів.
				</h2>
				<p class="text-base sm:text-lg text-[#86868b] font-light mt-2">
					Кожен компонент виконує одну роль бездоганно. Разом вони формують найчистіший платіжний досвід в Україні.
				</p>
			</div>

			<!-- Filter Bar -->
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-8 mb-8 border-b border-black/[0.04]">
				<!-- Category Pill Filter -->
				<div class="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
					{#each CATEGORIES as cat}
						<button
							type="button"
							onclick={() => (selectedCategory = cat.id)}
							class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap {selectedCategory === cat.id
								? 'bg-black text-white'
								: 'bg-[#f5f5f7] text-[#86868b] hover:text-black'}"
						>
							{cat.label}
						</button>
					{/each}
				</div>

				<!-- Search Input -->
				<div class="relative w-full sm:w-72">
					<Search size={14} class="absolute left-3.5 top-3 text-[#86868b]" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Пошук модулів..."
						class="w-full bg-[#f5f5f7] rounded-full pl-9 pr-4 py-2 text-xs text-[#1d1d1f] placeholder-[#86868b] outline-none focus:ring-1 focus:ring-black transition"
					/>
				</div>
			</div>

			<!-- Pure White Cards Grid with Generous Air -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
				{#each filteredServices as s (s.id)}
					<article class="bg-white rounded-3xl p-8 border {s.isNextStep ? 'border-blue-300/80 bg-gradient-to-b from-blue-50/25 to-white shadow-[0_8px_30px_rgba(37,99,235,0.06)]' : 'border-black/[0.05] shadow-[0_4px_20px_rgb(0,0,0,0.03)]'} hover:shadow-[0_12px_40px_rgb(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
						<div>
							<div class="flex items-baseline justify-between mb-4">
								<span class="text-2xl font-light font-mono {s.isNextStep ? 'text-blue-600/70 font-semibold' : 'text-[#86868b]/40'}">
									{s.index}
								</span>
								<div class="flex items-center gap-1.5">
									{#if s.isNextStep}
										<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
											Next Step
										</span>
									{/if}
									<span class="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
										{s.category}
									</span>
								</div>
							</div>

							<h3 class="text-2xl font-semibold tracking-tight text-[#1d1d1f] group-hover:text-black transition-colors">
								{s.title}
							</h3>
							<p class="text-xs text-[#86868b] font-light mt-1">
								{s.tagline}
							</p>

							<p class="text-sm text-[#1d1d1f]/80 font-normal mt-4 leading-relaxed">
								{s.essence}
							</p>

							<!-- Metric Pill -->
							<div class="mt-6 p-4 rounded-2xl {s.isNextStep ? 'bg-blue-50/50 border border-blue-200/50' : 'bg-[#fbfbfd] border border-black/[0.03]'}">
								<div class="text-2xl font-light text-[#1d1d1f] tracking-tight">{s.keyMetric}</div>
								<div class="text-[10px] uppercase tracking-wider text-[#86868b] mt-0.5">{s.metricLabel}</div>
							</div>
						</div>

						<!-- Card Bottom Action -->
						<div class="mt-8 pt-4 border-t border-black/[0.04] flex items-center justify-between">
							<a
								href={s.paths[selectedEnv]}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-xs font-semibold {s.isNextStep ? 'text-blue-600 hover:text-blue-700' : 'text-black hover:opacity-70'} transition group"
							>
								<span>{s.isNextStep ? 'Концепт' : 'Відкрити'}</span>
								<ArrowRight size={13} class="group-hover:translate-x-0.5 transition-transform" />
							</a>

							<button
								type="button"
								onclick={() => copyUrl(s)}
								title="Скопіювати посилання"
								class="text-xs text-[#86868b] hover:text-black transition"
							>
								{#if copiedId === s.id}
									<span class="text-emerald-600 font-medium">Скопійовано</span>
								{:else}
									<span class="font-mono">{selectedEnv}</span>
								{/if}
							</button>
						</div>
					</article>
				{/each}
			</div>
		</main>
	{/if}

	<!-- Minimal Footer -->
	<footer class="max-w-7xl mx-auto w-full px-6 sm:px-12 py-8 border-t border-black/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#86868b] font-light">
		<div>
			RAHUNOK · Продумано до найдрібніших деталей в Україні.
		</div>
		<div class="flex items-center gap-6">
			<span>Стандарт НБУ QR 003</span>
			<span>Безпека RLS</span>
			<span class="font-mono">rhnk.to</span>
		</div>
	</footer>
</div>
