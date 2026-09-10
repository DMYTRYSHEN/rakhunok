<script lang="ts">
	import { ExternalLink, RefreshCw, Server, ShieldCheck } from '@lucide/svelte';

	let isChecking = $state(false);
	let confAlive = $state<boolean | null>(null);

	async function checkConf() {
		isChecking = true;
		try {
			const res = await fetch('http://localhost:5176/conf/', { method: 'HEAD', mode: 'no-cors' });
			confAlive = true;
			window.location.href = 'http://localhost:5176/conf/';
		} catch {
			confAlive = false;
		} finally {
			isChecking = false;
		}
	}
</script>

<svelte:head>
	<title>Conf · Налаштування банківських інтеграцій</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-2xl text-center">
		<div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
			<ShieldCheck size={14} />
			<span>Робоче місце параметрів банківських інтеграцій</span>
		</div>

		<h1 class="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
			Кабінет <span class="text-emerald-400">/conf</span>
		</h1>

		<p class="mt-4 text-sm leading-relaxed text-zinc-400">
			У цій конфігурації монорепозиторію застосунок <code>/conf</code> є окремим мікрофронтендом у 
			папці <code>apps/conf</code>, оптимізованим для незалежного розгортання та керування банківськими маршрутами.
		</p>

		<div class="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-left shadow-xl backdrop-blur">
			<div class="flex items-center gap-3">
				<Server class="text-emerald-400" size={22} />
				<h2 class="text-base font-bold text-white">Як відкрити Conf у режимі розробки:</h2>
			</div>

			<ol class="mt-4 space-y-3 text-xs leading-5 text-zinc-300">
				<li class="flex items-start gap-2">
					<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-emerald-400">1</span>
					<span>Відкрийте другий термінал у корені проєкту.</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-emerald-400">2</span>
					<span>Запустіть команду: <code class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-emerald-300">npm run dev:conf</code> (сервер стартує на порту 5176).</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-emerald-400">3</span>
					<span>Перейдіть за посиланням <a class="font-bold text-emerald-400 underline hover:text-emerald-300" href="http://localhost:5176/conf/" target="_blank">http://localhost:5176/conf/</a> або натисніть кнопку нижче.</span>
				</li>
			</ol>

			<div class="mt-6 flex flex-wrap items-center gap-3">
				<a
					href="http://localhost:5176/conf/"
					class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400"
				>
					<span>Відкрити Conf (порт 5176)</span>
					<ExternalLink size={14} />
				</a>

				<button
					type="button"
					onclick={checkConf}
					disabled={isChecking}
					class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-750 disabled:opacity-50"
				>
					<RefreshCw size={14} class={isChecking ? 'animate-spin' : ''} />
					<span>Перевірити доступність</span>
				</button>
			</div>

			{#if confAlive === false}
				<p class="mt-3 text-xs text-rose-400">
					Сервер Conf на порту 5176 не відповідає. Будь ласка, виконайте в терміналі: <code>npm run dev:conf</code>
				</p>
			{/if}
		</div>

		<div class="mt-8 flex justify-center gap-4 text-xs text-zinc-500">
			<a href="/dashboard" class="hover:text-zinc-300">← Повернутися в Dashboard</a>
			<span>·</span>
			<a href="/corex" class="hover:text-zinc-300">Оглядач Corex →</a>
		</div>
	</div>
</div>
