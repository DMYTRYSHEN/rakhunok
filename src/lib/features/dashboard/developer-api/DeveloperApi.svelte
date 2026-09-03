<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BarChart3,
		Check,
		Clock3,
		Copy,
		Eye,
		EyeOff,
		ExternalLink,
		KeyRound,
		Plus,
		ReceiptText,
		TerminalSquare,
		Trash2
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type {
		DashboardGateway,
		DeveloperSession,
		MerchantApiKey
	} from '../api/dashboard-gateway';

	let { gateway, merchantId }: { gateway: DashboardGateway; merchantId: string } = $props();

	type Endpoint = {
		id: 'list' | 'create' | 'get' | 'update' | 'stats';
		method: 'GET' | 'POST' | 'PATCH';
		path: string;
		title: string;
		description: string;
		response: string;
		example: (baseUrl: string) => string;
	};

	const apiPath = '/api/v1';
	const endpoints: Endpoint[] = [
		{
			id: 'list',
			method: 'GET',
			path: '/orders?status=pending&limit=50&offset=0',
			title: 'Список рахунків',
			description: 'Фільтрація за статусом і пагінація через limit та offset.',
			response: '200 · orders, total, limit, offset',
			example: (baseUrl) => `curl "${baseUrl}/orders?status=pending&limit=50&offset=0" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`
		},
		{
			id: 'create',
			method: 'POST',
			path: '/orders',
			title: 'Створити рахунок',
			description: 'Створює рахунок, платіжне посилання та NBU 003 QR payload.',
			response: '201 · success, order, share, nbuQr',
			example: (baseUrl) => `curl -X POST "${baseUrl}/orders" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "fixed",
    "order_number": "4812-A",
    "title": "Оплата замовлення 4812-A",
    "description": "Капучино та десерт",
    "base_amount": 180.00,
    "total_amount": 180.00,
    "items": [
      {"name": "Капучино", "quantity": 2, "unit_price": 75.00, "total_price": 150.00}
    ]
  }'`
		},
		{
			id: 'get',
			method: 'GET',
			path: '/orders/{id}',
			title: 'Отримати рахунок',
			description: 'Повертає рахунок за UUID або коротким кодом.',
			response: '200 · Order  |  404 · Not found',
			example: (baseUrl) => `curl "${baseUrl}/orders/ORDER_ID" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`
		},
		{
			id: 'update',
			method: 'PATCH',
			path: '/orders/{id}',
			title: 'Оновити рахунок',
			description: 'Оновлює статус або суму. Статуси: pending, preparing, ready, paid, cancelled.',
			response: '200 · success, order',
			example: (baseUrl) => `curl -X PATCH "${baseUrl}/orders/ORDER_ID" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "ready"}'`
		},
		{
			id: 'stats',
			method: 'GET',
			path: '/stats/summary',
			title: 'Статистика продажів',
			description: 'Підсумки рахунків, оборот за весь час і сьогодні та конверсія оплат.',
			response: '200 · totals, volume, conversion_pct',
			example: (baseUrl) => `curl "${baseUrl}/stats/summary" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`
		}
	];

	let selectedId = $state<Endpoint['id']>('create');
	let copied = $state(false);
	let tokenCopied = $state(false);
	let keyCopied = $state(false);
	let revealToken = $state(false);
	let loadingCredentials = $state(true);
	let credentialsError = $state('');
	let developerSession = $state<DeveloperSession | null>(null);
	let apiKeys = $state<MerchantApiKey[]>([]);
	let keyName = $state('Production integration');
	let expiry = $state<'30' | '90' | 'never'>('90');
	let creatingKey = $state(false);
	let revokingKeyId = $state<string | null>(null);
	let createdApiKey = $state<string | null>(null);
	let apiBase = $derived(
		typeof window === 'undefined' ? apiPath : `${window.location.origin}${apiPath}`
	);
	let selected = $derived(endpoints.find((endpoint) => endpoint.id === selectedId) ?? endpoints[1]);
	let selectedExample = $derived(selected.example(apiBase));
	let maskedToken = $derived(
		developerSession
			? `${developerSession.accessToken.slice(0, 18)}${'•'.repeat(24)}`
			: 'Недоступний'
	);
	let tokenExpiry = $derived(
		developerSession?.expiresAt
			? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(
					developerSession.expiresAt * 1000
				)
			: 'Невідомо'
	);

	onMount(async () => {
		const [sessionResult, apiKeysResult] = await Promise.allSettled([
			gateway.getDeveloperSession(),
			gateway.listMerchantApiKeys(merchantId)
		]);

		if (sessionResult.status === 'fulfilled') developerSession = sessionResult.value;
		if (apiKeysResult.status === 'fulfilled') apiKeys = apiKeysResult.value;

		const errorResult = sessionResult.status === 'rejected' ? sessionResult : apiKeysResult;
		if (errorResult.status === 'rejected') {
			credentialsError =
				errorResult.reason instanceof Error
					? errorResult.reason.message
					: 'Не вдалося завантажити доступи.';
		}

		loadingCredentials = false;
	});

	async function copyExample() {
		const example = developerSession
			? selectedExample.replace('YOUR_ACCESS_TOKEN', developerSession.accessToken)
			: selectedExample;
		await navigator.clipboard.writeText(example);
		copied = true;
		window.setTimeout(() => (copied = false), 1500);
	}

	async function copyToken() {
		if (!developerSession) return;
		await navigator.clipboard.writeText(developerSession.accessToken);
		tokenCopied = true;
		window.setTimeout(() => (tokenCopied = false), 1500);
	}

	async function copyCreatedKey() {
		if (!createdApiKey) return;
		await navigator.clipboard.writeText(createdApiKey);
		keyCopied = true;
		window.setTimeout(() => (keyCopied = false), 1500);
	}

	async function createApiKey() {
		if (!keyName.trim()) return;
		creatingKey = true;
		credentialsError = '';
		try {
			const expiresAt =
				expiry === 'never'
					? null
					: new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString();
			const result = await gateway.createMerchantApiKey(merchantId, {
				name: keyName,
				expiresAt
			});
			createdApiKey = result.apiKey;
			apiKeys = [result.record, ...apiKeys];
			keyName = '';
		} catch (error) {
			credentialsError = error instanceof Error ? error.message : 'Не вдалося створити API key.';
		} finally {
			creatingKey = false;
		}
	}

	async function revokeApiKey(apiKey: MerchantApiKey) {
		if (!confirm(`Відкликати ключ “${apiKey.name}”? Цю дію не можна скасувати.`)) return;
		revokingKeyId = apiKey.id;
		credentialsError = '';
		try {
			await gateway.revokeMerchantApiKey(merchantId, apiKey.id);
			apiKeys = apiKeys.map((item) =>
				item.id === apiKey.id ? { ...item, revokedAt: new Date().toISOString() } : item
			);
		} catch (error) {
			credentialsError = error instanceof Error ? error.message : 'Не вдалося відкликати API key.';
		} finally {
			revokingKeyId = null;
		}
	}

	function formatDate(value: string | null) {
		return value
			? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(new Date(value))
			: 'Без строку';
	}
</script>

<div class="mx-auto max-w-6xl">
	<header class="border-b border-zinc-200 pb-7">
		<div>
			<div>
				<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">
					OpenAPI 3.1 · v1.1.0
				</p>
				<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">API для розробників</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
					Чинний контракт для створення рахунків, керування їхнім станом і отримання статистики
					продавця.
				</p>
			</div>
		</div>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0 space-y-5">
			<div class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
				<div class="flex items-start gap-3">
					<span class="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"
						><KeyRound size={18} /></span
					>
					<div>
						<h2 class="text-base font-extrabold">Короткостроковий JWT</h2>
						<p class="mt-1 text-sm leading-6 text-zinc-500">
							Поточний Supabase access token для швидкої перевірки API від імені вашого користувача.
							Не передавайте його в query-параметрах або логах.
						</p>
					</div>
				</div>
				{#if loadingCredentials}
					<p class="mt-5 text-sm text-zinc-500">Завантажуємо доступи…</p>
				{:else}
					<div class="mt-5 flex min-w-0 items-center gap-2 rounded-md bg-zinc-950 p-2 pl-3">
						<code class="min-w-0 flex-1 truncate text-xs text-zinc-100">
							{revealToken && developerSession ? developerSession.accessToken : maskedToken}
						</code>
						<button
							type="button"
							onclick={() => (revealToken = !revealToken)}
							class="grid size-8 shrink-0 place-items-center rounded text-zinc-300 hover:bg-zinc-800 hover:text-white"
							aria-label={revealToken ? 'Приховати JWT' : 'Показати JWT'}
							title={revealToken ? 'Приховати JWT' : 'Показати JWT'}
							disabled={!developerSession}
						>
							{#if revealToken}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
						</button>
						<button
							type="button"
							onclick={copyToken}
							class="grid size-8 shrink-0 place-items-center rounded text-zinc-300 hover:bg-zinc-800 hover:text-white"
							aria-label="Скопіювати JWT"
							title="Скопіювати JWT"
							disabled={!developerSession}
						>
							{#if tokenCopied}<Check size={16} />{:else}<Copy size={16} />{/if}
						</button>
					</div>
					<p class="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
						<Clock3 size={13} /> Діє до {tokenExpiry}
					</p>
				{/if}
				<div class="mt-5 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
					<span class="text-xs font-bold tracking-wide text-zinc-500 uppercase">Base URL</span>
					<code class="overflow-x-auto rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-800"
						>{apiBase}</code
					>
					<span class="text-xs font-bold tracking-wide text-zinc-500 uppercase">Заголовок</span>
					<code class="overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
						>Authorization: Bearer YOUR_ACCESS_TOKEN</code
					>
				</div>
			</div>

			<div class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 class="text-base font-extrabold">Merchant API keys</h2>
						<p class="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
							Ключ зберігається лише як SHA-256 hash. Повне значення доступне один раз після
							створення.
						</p>
					</div>
				</div>

				{#if credentialsError}
					<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{credentialsError}
					</p>
				{/if}

				{#if createdApiKey}
					<div class="mt-4 border-l-4 border-emerald-500 bg-emerald-50 p-4">
						<p class="text-sm font-extrabold text-emerald-900">Збережіть ключ зараз</p>
						<p class="mt-1 text-xs leading-5 text-emerald-800">
							Після закриття цього повідомлення повне значення відновити неможливо.
						</p>
						<div class="mt-3 flex min-w-0 items-center gap-2">
							<code
								class="min-w-0 flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-xs text-zinc-900"
							>
								{createdApiKey}
							</code>
							<button
								type="button"
								onclick={copyCreatedKey}
								class="grid size-9 shrink-0 place-items-center rounded-md border border-emerald-300 bg-white text-emerald-800"
								aria-label="Скопіювати API key"
								title="Скопіювати API key"
							>
								{#if keyCopied}<Check size={16} />{:else}<Copy size={16} />{/if}
							</button>
						</div>
						<button
							type="button"
							onclick={() => (createdApiKey = null)}
							class="mt-3 text-xs font-bold text-emerald-900 underline underline-offset-2"
						>
							Я зберіг ключ
						</button>
					</div>
				{/if}

				<form
					class="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
					onsubmit={(event) => {
						event.preventDefault();
						void createApiKey();
					}}
				>
					<label class="grid gap-1.5 text-xs font-bold text-zinc-600">
						Назва
						<input
							bind:value={keyName}
							maxlength="80"
							placeholder="Production integration"
							class="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
						/>
					</label>
					<label class="grid gap-1.5 text-xs font-bold text-zinc-600">
						Строк дії
						<select
							bind:value={expiry}
							class="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
						>
							<option value="30">30 днів</option>
							<option value="90">90 днів</option>
							<option value="never">Без строку</option>
						</select>
					</label>
					<button
						type="submit"
						disabled={creatingKey || !keyName.trim()}
						class="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus size={16} />
						{creatingKey ? 'Створюємо…' : 'Створити'}
					</button>
				</form>

				<div class="mt-5 divide-y divide-zinc-200 border-t border-zinc-200">
					{#if !loadingCredentials && apiKeys.length === 0}
						<p class="py-5 text-sm text-zinc-500">Merchant API keys ще не створені.</p>
					{/if}
					{#each apiKeys as apiKey (apiKey.id)}
						<div class="flex flex-wrap items-center gap-3 py-4">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<p class="truncate text-sm font-bold text-zinc-900">{apiKey.name}</p>
									<span class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
										{apiKey.keyPrefix}…
									</span>
									{#if apiKey.revokedAt}
										<span class="text-xs font-bold text-red-600">Відкликано</span>
									{/if}
								</div>
								<p class="mt-1 text-xs text-zinc-500">
									Створено {formatDate(apiKey.createdAt)} · Діє до {formatDate(apiKey.expiresAt)}
								</p>
							</div>
							{#if !apiKey.revokedAt}
								<button
									type="button"
									onclick={() => revokeApiKey(apiKey)}
									disabled={revokingKeyId === apiKey.id}
									class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
									aria-label={`Відкликати ${apiKey.name}`}
									title="Відкликати API key"
								>
									<Trash2 size={16} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
					<div>
						<p class="text-xs font-bold text-zinc-500">{selected.method} {selected.path}</p>
						<h2 class="mt-1 text-sm font-extrabold">{selected.title}</h2>
					</div>
					<button
						type="button"
						onclick={copyExample}
						class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 hover:border-blue-400 hover:text-blue-700"
						aria-label="Скопіювати cURL приклад"
						title="Скопіювати cURL"
					>
						{#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}
					</button>
				</div>
				<pre class="overflow-x-auto bg-zinc-950 p-5 text-xs leading-6 text-zinc-100"><code
						>{selectedExample}</code
					></pre>
				<div class="grid gap-2 border-t border-zinc-200 px-5 py-4 text-xs sm:grid-cols-2">
					<p class="leading-5 text-zinc-500">{selected.description}</p>
					<p class="font-mono leading-5 text-zinc-700 sm:text-right">{selected.response}</p>
				</div>
			</div>
		</section>

		<aside class="h-fit rounded-lg border border-zinc-200 bg-white p-5">
			<div class="flex items-center gap-2">
				<TerminalSquare size={18} />
				<h2 class="text-sm font-extrabold">Merchant endpoints</h2>
			</div>
			<div class="mt-4 space-y-2" role="region" aria-label="Операції Merchant API">
				{#each endpoints as endpoint (endpoint.id)}
					<button
						type="button"
						onclick={() => {
							selectedId = endpoint.id;
							copied = false;
						}}
						class="flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left font-mono text-xs transition-colors"
						class:border-blue-300={selectedId === endpoint.id}
						class:bg-blue-50={selectedId === endpoint.id}
						class:border-zinc-200={selectedId !== endpoint.id}
						aria-pressed={selectedId === endpoint.id}
					>
						<b
							class:text-emerald-700={endpoint.method === 'GET'}
							class:text-blue-700={endpoint.method === 'POST'}
							class:text-amber-700={endpoint.method === 'PATCH'}>{endpoint.method}</b
						>
						<span class="min-w-0 truncate">{endpoint.path}</span>
					</button>
				{/each}
			</div>

			<div class="mt-5 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">
				<p class="flex items-center gap-2 font-bold text-zinc-800">
					<ReceiptText size={15} /> Рахунки
				</p>
				<p class="mt-1">Типи: fixed, open_amount, table, delivery.</p>
				<p class="mt-4 flex items-center gap-2 font-bold text-zinc-800">
					<BarChart3 size={15} /> Аналітика
				</p>
				<p class="mt-1">Обсяги повертаються у гривнях.</p>
			</div>

			<a
				href={resolve('/api' as '/')}
				target="_blank"
				rel="noreferrer"
				class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700"
				>Стан API <ExternalLink size={15} /></a
			>
		</aside>
	</div>
</div>
