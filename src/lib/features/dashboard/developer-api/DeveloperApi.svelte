<script lang="ts">
	import {
		BarChart3,
		Check,
		Copy,
		ExternalLink,
		KeyRound,
		ReceiptText,
		TerminalSquare
	} from '@lucide/svelte';

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
	let apiBase = $state(apiPath);
	let selected = $derived(endpoints.find((endpoint) => endpoint.id === selectedId) ?? endpoints[1]);
	let selectedExample = $derived(selected.example(apiBase));

	$effect(() => {
		apiBase = `${window.location.origin}${apiPath}`;
	});

	async function copyExample() {
		await navigator.clipboard.writeText(selectedExample);
		copied = true;
		window.setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="mx-auto max-w-6xl">
	<header class="border-b border-zinc-200 pb-7">
		<div>
			<div>
				<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">OpenAPI 3.1 · v1.1.0</p>
				<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">API для розробників</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
					Чинний контракт для створення рахунків, керування їхнім станом і отримання
					статистики продавця.
				</p>
			</div>
		</div>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0 space-y-5">
			<div class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
				<div class="flex items-start gap-3">
					<span class="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"><KeyRound size={18} /></span>
					<div>
						<h2 class="text-base font-extrabold">Bearer-авторизація</h2>
						<p class="mt-1 text-sm leading-6 text-zinc-500">Захищені merchant endpoints приймають JWT, отриманий під час входу, у заголовку Authorization. Не передавайте токен у query-параметрах або клієнтських логах.</p>
					</div>
				</div>
				<div class="mt-5 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
					<span class="text-xs font-bold tracking-wide text-zinc-500 uppercase">Base URL</span>
					<code class="overflow-x-auto rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-800">{apiBase}</code>
					<span class="text-xs font-bold tracking-wide text-zinc-500 uppercase">Заголовок</span>
					<code class="overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 text-xs text-zinc-100">Authorization: Bearer YOUR_ACCESS_TOKEN</code>
				</div>
			</div>

			<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
					<div><p class="text-xs font-bold text-zinc-500">{selected.method} {selected.path}</p><h2 class="mt-1 text-sm font-extrabold">{selected.title}</h2></div>
					<button type="button" onclick={copyExample} class="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 hover:border-blue-400 hover:text-blue-700" aria-label="Скопіювати cURL приклад" title="Скопіювати cURL">
						{#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}
					</button>
				</div>
				<pre class="overflow-x-auto bg-zinc-950 p-5 text-xs leading-6 text-zinc-100"><code>{selectedExample}</code></pre>
				<div class="grid gap-2 border-t border-zinc-200 px-5 py-4 text-xs sm:grid-cols-2">
					<p class="leading-5 text-zinc-500">{selected.description}</p>
					<p class="font-mono leading-5 text-zinc-700 sm:text-right">{selected.response}</p>
				</div>
			</div>
		</section>

		<aside class="h-fit rounded-lg border border-zinc-200 bg-white p-5">
			<div class="flex items-center gap-2"><TerminalSquare size={18} /><h2 class="text-sm font-extrabold">Merchant endpoints</h2></div>
			<div class="mt-4 space-y-2" role="region" aria-label="Операції Merchant API">
				{#each endpoints as endpoint}
					<button type="button" onclick={() => { selectedId = endpoint.id; copied = false; }} class="flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left font-mono text-xs transition-colors" class:border-blue-300={selectedId === endpoint.id} class:bg-blue-50={selectedId === endpoint.id} class:border-zinc-200={selectedId !== endpoint.id} aria-pressed={selectedId === endpoint.id}>
						<b class:text-emerald-700={endpoint.method === 'GET'} class:text-blue-700={endpoint.method === 'POST'} class:text-amber-700={endpoint.method === 'PATCH'}>{endpoint.method}</b>
						<span class="min-w-0 truncate">{endpoint.path}</span>
					</button>
				{/each}
			</div>

			<div class="mt-5 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">
				<p class="flex items-center gap-2 font-bold text-zinc-800"><ReceiptText size={15} /> Рахунки</p>
				<p class="mt-1">Типи: fixed, open_amount, table, delivery.</p>
				<p class="mt-4 flex items-center gap-2 font-bold text-zinc-800"><BarChart3 size={15} /> Аналітика</p>
				<p class="mt-1">Обсяги повертаються у гривнях.</p>
			</div>

			<a href="/api" target="_blank" rel="noreferrer" class="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Стан API <ExternalLink size={15} /></a>
		</aside>
	</div>
</div>