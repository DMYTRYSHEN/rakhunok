<script>
	import { Package, Clock, CircleCheck, Undo2, TrendingUp, TrendingDown, Download, TriangleAlert } from '@lucide/svelte';

	let activeTab = $state('Аналітика');

	// Metrics Data
	const metrics = {
		total: { value: '1,247', trend: '+12%', isPositive: true },
		avgDeliveryTime: { value: '2.3 дні', trend: '-8%', isPositive: true },
		onTimeRate: { value: '94.2%', trend: '+1.5%', isPositive: true },
		returnRate: { value: '3.1%', trend: '-0.4%', isPositive: true }
	};

	// Status Breakdown
	const statuses = [
		{ label: 'У дорозі', count: 340, percent: 27, color: 'bg-brand-500' },
		{ label: 'До отримання', count: 89, percent: 7, color: 'bg-warning-accent' },
		{ label: 'Вручено', count: 780, percent: 63, color: 'bg-success-accent' },
		{ label: 'Повернуто', count: 38, percent: 3, color: 'bg-red-500' }
	];

	// Carrier Performance
	const carriers = [
		{ name: 'Нова пошта', logo: 'N', volume: 856, time: '1.8 дні', success: '96.5%', sla: 'Дотримано', slaColor: 'success' },
		{ name: 'Укрпошта', logo: 'U', volume: 245, time: '3.5 дні', success: '89.0%', sla: 'Ризик', slaColor: 'warning' },
		{ name: 'Meest', logo: 'M', volume: 146, time: '2.1 дні', success: '95.2%', sla: 'Дотримано', slaColor: 'success' }
	];

	// Daily Volume
	const dailyVolume = [
		{ day: 'Пн', count: 180, height: '60%' },
		{ day: 'Вв', count: 210, height: '70%' },
		{ day: 'Ср', count: 195, height: '65%' },
		{ day: 'Чт', count: 240, height: '80%' },
		{ day: 'Пт', count: 280, height: '95%' },
		{ day: 'Сб', count: 120, height: '40%' },
		{ day: 'Нд', count: 90, height: '30%' }
	];

	// Top Exceptions
	const exceptions = [
		{ issue: 'Не забрано вчасно', count: 45, trend: 'up' },
		{ issue: 'Невдала спроба вручення', count: 12, trend: 'down' },
		{ issue: 'Затримка перевізника', count: 8, trend: 'up' }
	];

	let selectedPeriod = $state('Місяць');
	const periods = ['Сьогодні', 'Тиждень', 'Місяць', 'Квартал'];
</script>

<div class="flex min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans overflow-clip">
	<!-- Sidebar -->
	

	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto">
		<div class="max-w-[1320px] mx-auto p-5 sm:p-8">
			<!-- Header & Period Selector -->
			<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
				<div>
					<h1 class="text-[26px] font-bold tracking-tight">Аналітика</h1>
					<p class="text-text-secondary text-[14px] mt-1">Огляд ефективності логістики</p>
				</div>
				
				<div class="flex items-center gap-1 bg-white border border-[var(--color-border-subtle)] rounded-xl p-1 shadow-sm">
					{#each periods as period}
						<button 
							onclick={() => selectedPeriod = period}
							class="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all {selectedPeriod === period ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-text-secondary hover:text-text-primary'}"
						>
							{period}
						</button>
					{/each}
				</div>
			</div>

			<!-- Metrics Row -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
				<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
					<div class="flex items-center gap-3 text-text-secondary mb-3">
						<Package class="" size={16} />
						<span class="text-[13px] font-medium">Загальна кількість</span>
					</div>
					<div class="flex items-end justify-between">
						<span class="text-[24px] font-bold tracking-tight">{metrics.total.value}</span>
						<span class="flex items-center gap-1 text-[12px] font-medium text-success-text bg-success-bg px-2 py-1 rounded-full">
							<TrendingUp class="" size={16} /> {metrics.total.trend}
						</span>
					</div>
				</div>

				<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
					<div class="flex items-center gap-3 text-text-secondary mb-3">
						<Clock class="" size={16} />
						<span class="text-[13px] font-medium">Середній час</span>
					</div>
					<div class="flex items-end justify-between">
						<span class="text-[24px] font-bold tracking-tight">{metrics.avgDeliveryTime.value}</span>
						<span class="flex items-center gap-1 text-[12px] font-medium text-success-text bg-success-bg px-2 py-1 rounded-full">
							<TrendingDown class="" size={16} /> {metrics.avgDeliveryTime.trend}
						</span>
					</div>
				</div>

				<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
					<div class="flex items-center gap-3 text-text-secondary mb-3">
						<CircleCheck class="" size={16} />
						<span class="text-[13px] font-medium">Вчасні доставки</span>
					</div>
					<div class="flex items-end justify-between">
						<span class="text-[24px] font-bold tracking-tight text-success-accent">{metrics.onTimeRate.value}</span>
						<span class="flex items-center gap-1 text-[12px] font-medium text-success-text bg-success-bg px-2 py-1 rounded-full">
							<TrendingUp class="" size={16} /> {metrics.onTimeRate.trend}
						</span>
					</div>
				</div>

				<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
					<div class="flex items-center gap-3 text-text-secondary mb-3">
						<Undo2 class="" size={16} />
						<span class="text-[13px] font-medium">Повернення</span>
					</div>
					<div class="flex items-end justify-between">
						<span class="text-[24px] font-bold tracking-tight">{metrics.returnRate.value}</span>
						<span class="flex items-center gap-1 text-[12px] font-medium text-success-text bg-success-bg px-2 py-1 rounded-full">
							<TrendingDown class="" size={16} /> {metrics.returnRate.trend}
						</span>
					</div>
				</div>
			</div>

			<!-- Delivery Status Breakdown -->
			<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm mb-8">
				<h2 class="text-[16px] font-semibold mb-6">Статуси відправлень</h2>
				
				<!-- Stacked Bar -->
				<div class="flex h-4 rounded-full overflow-clip mb-4">
					{#each statuses as status}
						<div 
							class="h-full {status.color} transition-all duration-300" 
							style="width: {status.percent}%"
							title="{status.label}: {status.count}"
						></div>
					{/each}
				</div>
				
				<!-- Legend -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
					{#each statuses as status}
						<div>
							<div class="flex items-center gap-2 mb-1">
								<div class="w-2.5 h-2.5 rounded-full {status.color}"></div>
								<span class="text-[13px] text-text-secondary">{status.label}</span>
							</div>
							<div class="flex items-baseline gap-2 pl-4.5">
								<span class="text-[18px] font-semibold">{status.count}</span>
								<span class="text-[12px] text-text-tertiary">{status.percent}%</span>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
				<!-- Main Left Column -->
				<div class="lg:col-span-2 space-y-8">
					<!-- Carrier Performance Table -->
					<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl shadow-sm overflow-clip">
						<div class="p-5 border-b border-[var(--color-border-subtle)] flex justify-between items-center">
							<h2 class="text-[16px] font-semibold">Ефективність перевізників</h2>
							<button class="text-[13px] text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1">
								<Download class="" size={16} /> Експорт
							</button>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse">
								<thead>
									<tr class="bg-surface text-text-secondary text-[12px] border-b border-[var(--color-border-subtle)]">
										<th class="px-5 py-3 font-medium">Перевізник</th>
										<th class="px-5 py-3 font-medium">Відправлень</th>
										<th class="px-5 py-3 font-medium">Сер. час</th>
										<th class="px-5 py-3 font-medium">Успішність</th>
										<th class="px-5 py-3 font-medium">SLA</th>
									</tr>
								</thead>
								<tbody class="text-[14px]">
									{#each carriers as carrier}
										<tr class="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-gray-50/50 transition-colors">
											<td class="px-5 py-4">
												<div class="flex items-center gap-3">
													<div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-[14px]">
														{carrier.logo}
													</div>
													<span class="font-medium">{carrier.name}</span>
												</div>
											</td>
											<td class="px-5 py-4">{carrier.volume}</td>
											<td class="px-5 py-4">{carrier.time}</td>
											<td class="px-5 py-4">{carrier.success}</td>
											<td class="px-5 py-4">
												<span class="px-2.5 py-1 rounded-full text-[12px] font-medium {carrier.slaColor === 'success' ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text'}">
													{carrier.sla}
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<!-- Right Column -->
				<div class="space-y-8">
					<!-- Daily Volume Chart -->
					<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
						<h2 class="text-[16px] font-semibold mb-6">Об'єм за тиждень</h2>
						
						<div class="h-40 flex items-end justify-between gap-2 mb-2">
							{#each dailyVolume as day, i}
								<div class="flex flex-col items-center gap-2 flex-1 group">
									<div class="relative w-full flex justify-center h-full items-end">
										<!-- Use background color vars that match theme -->
										<div class="w-full max-w-[32px] {i === 4 ? 'bg-brand-500' : 'bg-[#dbe4ff]'} rounded-t-md transition-all duration-300 group-hover:bg-[#bacaff]" style="height: {day.height}"></div>
										<!-- Tooltip -->
										<div class="absolute -top-8 bg-gray-800 text-white text-[11px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
											{day.count}
										</div>
									</div>
									<span class="text-[12px] text-text-secondary {i === 4 ? 'font-semibold text-text-primary' : ''}">{day.day}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Top Exceptions -->
					<div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 shadow-sm">
						<div class="flex items-center gap-2 mb-6">
							<TriangleAlert class="text-warning-accent" size={16} />
							<h2 class="text-[16px] font-semibold">Проблемні зони</h2>
						</div>
						
						<div class="space-y-4">
							{#each exceptions as exception}
								<div class="flex items-center justify-between">
									<span class="text-[14px] text-text-primary">{exception.issue}</span>
									<div class="flex items-center gap-2">
										<span class="font-semibold text-[14px]">{exception.count}</span>
										{#if exception.trend === 'up'}
											<TrendingUp class="text-red-500" size={16} />
										{:else}
											<TrendingDown class="text-success-accent" size={16} />
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	</main>
</div>

<style>
	:global(:root) {
		--color-brand-50: var(--color-brand-50);
		--color-brand-500: var(--color-brand-600);
		--color-brand-600: #2b4fd4;
		--color-brand-700: var(--color-brand-600);
		
		--color-surface: #fafbfc;
		--color-surface-raised: #ffffff;
		--color-surface-overlay: rgba(255,255,255,0.92);
		
		--color-border-subtle: #f0f0f2;
		--color-border-default: #e5e5ea;
		
		--color-text-primary: #1a1a2e;
		--color-text-secondary: #6b7280;
		--color-text-tertiary: #9ca3af;
		
		--color-success-bg: #ecfdf5;
		--color-success-text: #065f46;
		--color-success-accent: #10b981;
		
		--color-warning-bg: #fffbeb;
		--color-warning-text: #92400e;
		--color-warning-accent: #f59e0b;
	}
</style>
