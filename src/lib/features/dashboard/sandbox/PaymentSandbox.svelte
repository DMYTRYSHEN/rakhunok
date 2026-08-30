<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		CheckmarkCircle02Icon,
		Clock01Icon,
		FlaskConicalIcon,
		SecurityCheckIcon
	} from '@hugeicons/core-free-icons';

	type SandboxResult = {
		event: {
			deliveryId: string;
			eventType: 'payment.succeeded';
			createdAt: string;
			payment: {
				id: string;
				amountMinor: number;
				currency: 'UAH';
				status: 'succeeded';
				bankCode: 'UNJS';
			};
		};
		headers: Record<string, string>;
		verified: boolean;
	};

	let running = $state(false);
	let error = $state<string | null>(null);
	let events = $state<SandboxResult[]>([]);

	const money = new Intl.NumberFormat('uk-UA', {
		style: 'currency',
		currency: 'UAH',
		minimumFractionDigits: 2
	});
	const dateTime = new Intl.DateTimeFormat('uk-UA', {
		dateStyle: 'short',
		timeStyle: 'medium'
	});

	async function simulatePayment() {
		if (running) return;
		running = true;
		error = null;
		try {
			const response = await fetch('/dashboard/api/sandbox/simulate', {
				method: 'POST',
				headers: { Accept: 'application/json' }
			});
			if (!response.ok) throw new Error('Demo endpoint відхилив запит.');
			const result = (await response.json()) as SandboxResult;
			if (!result.verified) throw new Error('Підпис callback не пройшов перевірку.');
			events = [result, ...events].slice(0, 10);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Не вдалося виконати моделювання.';
		} finally {
			running = false;
		}
	}
</script>

<div class="space-y-7">
	<header
		class="flex flex-col gap-5 border-b border-zinc-200 pb-7 lg:flex-row lg:items-end lg:justify-between"
	>
		<div class="max-w-2xl">
			<p class="mb-2 text-xs font-extrabold tracking-[0.14em] text-emerald-700 uppercase">
				KSO Sandbox
			</p>
			<h1 class="text-2xl font-extrabold text-zinc-950 sm:text-3xl">Пісочниця платежів</h1>
			<p class="mt-3 text-sm leading-6 text-zinc-600">
				Перевірте модельований платіж і підписаний callback без змін рахунків, виплат або
				банківських даних.
			</p>
		</div>
		<button
			type="button"
			disabled={running}
			onclick={simulatePayment}
			class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-extrabold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
		>
			<HugeiconsIcon icon={FlaskConicalIcon} size={18} aria-hidden="true" />
			{running ? 'Моделювання…' : 'Змоделювати оплату'}
		</button>
	</header>

	<section
		aria-label="Властивості пісочниці"
		class="grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 md:grid-cols-3"
	>
		<div class="bg-white p-5">
			<HugeiconsIcon
				icon={SecurityCheckIcon}
				size={20}
				className="mb-4 text-emerald-700"
				aria-hidden="true"
			/>
			<p class="text-sm font-extrabold text-zinc-950">HMAC-SHA256</p>
			<p class="mt-1 text-xs leading-5 text-zinc-500">
				Підпис і payload перевіряються через Web Crypto.
			</p>
		</div>
		<div class="bg-white p-5">
			<HugeiconsIcon
				icon={CheckmarkCircle02Icon}
				size={20}
				className="mb-4 text-blue-700"
				aria-hidden="true"
			/>
			<p class="text-sm font-extrabold text-zinc-950">Без записів</p>
			<p class="mt-1 text-xs leading-5 text-zinc-500">
				Подія не потрапляє у production Supabase або settlement flow.
			</p>
		</div>
		<div class="bg-white p-5">
			<HugeiconsIcon
				icon={Clock01Icon}
				size={20}
				className="mb-4 text-amber-700"
				aria-hidden="true"
			/>
			<p class="text-sm font-extrabold text-zinc-950">Поточна сесія</p>
			<p class="mt-1 text-xs leading-5 text-zinc-500">Журнал зберігається лише на цій сторінці.</p>
		</div>
	</section>

	{#if error}
		<p
			role="alert"
			class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
		>
			{error}
		</p>
	{/if}

	<section aria-labelledby="sandbox-events-title">
		<div class="mb-4 flex items-end justify-between gap-4">
			<div>
				<h2 id="sandbox-events-title" class="text-lg font-extrabold text-zinc-950">
					Callback-події
				</h2>
				<p class="mt-1 text-xs text-zinc-500">Останні 10 перевірок у цій вкладці</p>
			</div>
			<span class="text-xs font-bold text-zinc-500">{events.length} подій</span>
		</div>

		{#if events.length === 0}
			<div
				class="grid min-h-48 place-items-center rounded-md border border-dashed border-zinc-300 bg-white px-6 text-center"
			>
				<div>
					<HugeiconsIcon
						icon={FlaskConicalIcon}
						size={28}
						className="mx-auto text-zinc-400"
						aria-hidden="true"
					/>
					<p class="mt-3 text-sm font-bold text-zinc-700">Подій ще немає</p>
					<p class="mt-1 text-xs text-zinc-500">
						Запустіть моделювання, щоб побачити підписаний callback.
					</p>
				</div>
			</div>
		{:else}
			<div class="overflow-hidden rounded-md border border-zinc-200 bg-white">
				{#each events as result (result.event.deliveryId)}
					<article
						class="grid gap-4 border-b border-zinc-100 p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<p class="text-sm font-extrabold text-zinc-950">{result.event.eventType}</p>
								<span
									class="rounded bg-emerald-50 px-2 py-1 text-[0.625rem] font-extrabold text-emerald-800 uppercase"
									>Підпис перевірено</span
								>
							</div>
							<p
								class="mt-2 truncate font-mono text-[0.6875rem] text-zinc-500"
								title={result.event.deliveryId}
							>
								{result.event.deliveryId}
							</p>
							<p
								class="mt-1 truncate font-mono text-[0.6875rem] text-zinc-400"
								title={result.headers['Rahunok-Signature']}
							>
								{result.headers['Rahunok-Signature']}
							</p>
						</div>
						<div class="sm:text-right">
							<p class="text-sm font-extrabold text-zinc-950">
								{money.format(result.event.payment.amountMinor / 100)}
							</p>
							<time datetime={result.event.createdAt} class="mt-1 block text-xs text-zinc-500"
								>{dateTime.format(new Date(result.event.createdAt))}</time
							>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
