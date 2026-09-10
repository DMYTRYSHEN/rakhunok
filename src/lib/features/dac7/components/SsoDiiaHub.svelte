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
		demo = false
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
	} = $props();

	let sessions = $state<Dac7DiiaSession[]>(demoDiiaLogs);
	let loading = $state(true);
	let simulatedQrOpen = $state(false);
	let verificationStatus = $state<string | null>(null);

	async function loadSessions() {
		loading = true;
		sessions = await gateway.getDiiaSessions(demo);
		loading = false;
	}

	function triggerSimulatedSign() {
		simulatedQrOpen = true;
		verificationStatus = 'Очікування підписання через мобільний додаток Дія...';
		setTimeout(() => {
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
			verificationStatus = 'Успішно підписано КЕП через Дія.Підпис! Особу та РНОКПП верифіковано.';
			setTimeout(() => {
				simulatedQrOpen = false;
				verificationStatus = null;
			}, 3000);
		}, 2000);
	}

	onMount(() => {
		loadSessions();
	});
</script>

<div class="space-y-6">
	<!-- Banner -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white">
						<Fingerprint size={14} />
					</span>
					<h2 class="text-base font-bold text-stone-900">
						Rahunok ID • SSO & Верифікація через Дія.Підпис
					</h2>
				</div>
				<p class="text-xs text-stone-500">
					Провайдер авторизації для цифрових платформ: миттєва перевірка податкового номера РНОКПП та підписання договорів-оферт
				</p>
			</div>

			<button
				type="button"
				onclick={triggerSimulatedSign}
				class="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
			>
				<QrCode size={14} />
				<span>Тестова сесія Дія.Підпис</span>
			</button>
		</div>

		{#if verificationStatus}
			<div class="mt-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold text-sky-800">
				<Smartphone size={16} class="animate-bounce" />
				<span>{verificationStatus}</span>
			</div>
		{/if}
	</div>

	<!-- Info Card -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1.5">
			<span class="font-bold text-stone-900">1. Стандарт КЕП / P7S</span>
			<p class="text-stone-500 text-[11px] leading-relaxed">
				Формування кваліфікованого електронного підпису з міткою точного часу згідно з Законом «Про електронні довірчі послуги».
			</p>
		</div>
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1.5">
			<span class="font-bold text-stone-900">2. Верифікація РНОКПП</span>
			<p class="text-stone-500 text-[11px] leading-relaxed">
				Гарантує точність ідентифікації платника податків для передачі даних у річний звіт DAC7/DPI до Державної податкової служби.
			</p>
		</div>
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1.5">
			<span class="font-bold text-stone-900">3. Cross-Platform SSO</span>
			<p class="text-stone-500 text-[11px] leading-relaxed">
				Один обліковий запис Rahunok ID діє для всіх підключених сервісів: Bolt, Uklon, Glovo та супермаркетів.
			</p>
		</div>
	</div>

	<!-- Sessions Table -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-bold text-stone-900">Журнал сесій верифікації Дія.Підпис</h3>
			<button
				type="button"
				onclick={loadSessions}
				class="rounded-lg border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
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
						<th class="p-3 font-bold text-right">Час</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100 text-stone-700">
					{#if loading}
						<tr>
							<td colspan="5" class="p-4 text-center text-stone-400">Завантаження сесій...</td>
						</tr>
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
									<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
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
</div>
