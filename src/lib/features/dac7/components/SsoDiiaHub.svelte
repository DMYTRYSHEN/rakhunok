<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CheckCircle2,
		Fingerprint,
		Key,
		QrCode,
		RefreshCw,
		ShieldCheck,
		Smartphone,
		UserCheck
	} from '@lucide/svelte';
	import type { Dac7DiiaSession } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';
	import { demoDiiaLogs } from '../mockData';

	let {
		gateway,
		demo = false,
		activeTab = 'sso_verify'
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		activeTab?: string;
	} = $props();

	let sessions = $state<Dac7DiiaSession[]>(demoDiiaLogs);
	let loading = $state(false);

	// Verification state
	let verifyStep = $state(1);

	async function loadSessions() {
		loading = true;
		sessions = await gateway.getDiiaSessions(demo);
		loading = false;
	}

	function triggerSimulatedSign() {
		verifyStep = 2;
		setTimeout(() => {
			verifyStep = 3;
			setTimeout(() => {
				verifyStep = 4;
				const newSession: Dac7DiiaSession = {
					id: `diia_sess_${Date.now()}`,
					sessionId: `sess_${Math.random().toString(36).slice(2, 8)}`,
					rnokpp: '3091248192',
					name: 'Олексій Ткаченко',
					status: 'Підтверджено',
					p7sHash: 'sha256_e10adc3949ba59abbe56e057f20f883e',
					date: 'щойно',
					tenant: 'Bolt Food'
				};
				sessions = [newSession, ...sessions];
			}, 2000);
		}, 1500);
	}

	onMount(() => {
		loadSessions();
	});
</script>

<div class="mx-auto max-w-5xl space-y-6">
	{#if activeTab === 'sso_verify'}
		<!-- Verification Flow -->
		<div class="mx-auto mt-10 max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="mb-8 space-y-2 text-center">
				<div
					class="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm"
				>
					<Fingerprint size={24} />
				</div>
				<h2 class="text-xl font-bold text-stone-900">Верифікація Дія.Підпис</h2>
				<p class="text-sm text-stone-500">Авторизація для Bolt Food</p>
			</div>

			<div
				class="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-stone-200 before:to-transparent md:before:mx-auto md:before:translate-x-0"
			>
				{#each [{ s: 1, t: 'Ініціалізація сесії', d: 'Створення запиту до API Дії' }, { s: 2, t: 'Очікування підпису', d: 'Відкрийте застосунок Дія та підпишіть запит' }, { s: 3, t: 'Отримання КЕП (P7S)', d: 'Завантаження та валідація підпису' }, { s: 4, t: 'Успішна авторизація', d: 'РНОКПП та ПІБ підтверджено' }] as step}
					<div
						class="group is-active relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse"
					>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white {verifyStep >
							step.s
								? 'bg-emerald-500 text-white'
								: verifyStep === step.s
									? 'bg-stone-900 text-white shadow-[0_0_0_4px_rgba(28,25,23,0.1)]'
									: 'bg-stone-200 text-stone-400'} z-10 shrink-0 transition-all duration-500 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"
						>
							{#if verifyStep > step.s}
								<CheckCircle2 size={18} />
							{:else}
								<span class="text-xs font-bold">{step.s}</span>
							{/if}
						</div>

						<div
							class="w-[calc(100%-4rem)] rounded-xl border p-4 md:w-[calc(50%-2.5rem)] {verifyStep ===
							step.s
								? 'border-stone-900 bg-stone-50'
								: 'border-stone-100 bg-white'} shadow-sm transition-all duration-300"
						>
							<div class="mb-1 flex items-center justify-between">
								<h3 class="text-sm font-bold text-stone-900">{step.t}</h3>
							</div>
							<div class="text-xs text-stone-500">{step.d}</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-8 text-center">
				{#if verifyStep === 1}
					<button
						onclick={triggerSimulatedSign}
						class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-stone-800"
					>
						<QrCode size={18} /> Сканувати Дія.Підпис
					</button>
				{:else if verifyStep < 4}
					<div class="inline-flex items-center gap-2 text-sm font-semibold text-stone-500">
						<RefreshCw size={16} class="animate-spin" /> Обробка...
					</div>
				{:else}
					<div
						class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-600"
					>
						<CheckCircle2 size={18} /> Верифікацію завершено
					</div>
				{/if}
			</div>
		</div>
	{:else if activeTab === 'sso_hub'}
		<!-- SSO Hub -->
		<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<h2 class="text-base font-bold text-stone-900">Журнал сесій верифікації Дія.Підпис</h2>
					<p class="text-xs text-stone-500">
						Логування успішних P7S підписів для передачі даних у річний звіт DAC7/DPI до Державної
						податкової служби.
					</p>
				</div>
				<button
					type="button"
					onclick={loadSessions}
					class="cursor-pointer rounded-lg border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
				>
					Оновити
				</button>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-stone-200 bg-stone-50/70 text-stone-500">
						<tr>
							<th class="p-3 font-bold">Особа / РНОКПП</th>
							<th class="p-3 font-bold">Платформа</th>
							<th class="p-3 font-bold">Криптографічний хеш P7S</th>
							<th class="p-3 font-bold">Статус КЕП</th>
							<th class="p-3 text-right font-bold">Час</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100 text-stone-700">
						{#if loading}
							<tr
								><td colspan="5" class="p-4 text-center text-stone-400">Завантаження сесій...</td
								></tr
							>
						{:else}
							{#each sessions as s}
								<tr class="hover:bg-stone-50/50">
									<td class="p-3">
										<div class="font-semibold text-stone-900">{s.name}</div>
										<div class="font-mono text-[11px] text-stone-400">РНОКПП: {s.rnokpp}</div>
									</td>
									<td class="p-3 font-medium text-stone-700">{s.tenant}</td>
									<td class="p-3 font-mono text-[11px] text-stone-500">{s.p7sHash}</td>
									<td class="p-3">
										<span
											class="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700"
										>
											<CheckCircle2 size={11} /> Підтверджено
										</span>
									</td>
									<td class="p-3 text-right text-stone-400">{s.date}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
