<script lang="ts">
	import { Check, Copy, ExternalLink, KeyRound, TerminalSquare } from '@lucide/svelte';

	const apiBase = '/api/v1';
	const createExample = `curl -X POST "${apiBase}/orders" \\
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"fixed","title":"Оплата замовлення","amount":500}'`;
	let copied = $state(false);

	async function copyExample() {
		await navigator.clipboard.writeText(createExample);
		copied = true;
		window.setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="mx-auto max-w-6xl">
	<header class="border-b border-zinc-200 pb-7">
		<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">Інтеграція</p>
		<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">API для розробників</h1>
		<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Чинні Worker endpoints для створення та керування рахунками продавця.</p>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="space-y-5">
			<div class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
				<div class="flex items-start gap-3"><span class="grid size-10 place-items-center rounded-md bg-blue-50 text-blue-700"><KeyRound size={18} /></span><div><h2 class="text-base font-extrabold">Авторизація</h2><p class="mt-1 text-sm leading-6 text-zinc-500">Merchant endpoints приймають поточний Supabase JWT у заголовку Bearer. Dashboard ніколи не показує і не зберігає токен окремо.</p></div></div>
				<code class="mt-5 block overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">Authorization: Bearer YOUR_SUPABASE_JWT</code>
			</div>

			<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
				<div class="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><div><p class="text-xs font-bold text-zinc-500">ПРИКЛАД</p><h2 class="mt-1 text-sm font-extrabold">Створити рахунок</h2></div><button type="button" onclick={copyExample} class="grid size-9 place-items-center rounded-md border border-zinc-200" aria-label="Скопіювати приклад">{#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}</button></div>
				<pre class="overflow-x-auto bg-zinc-950 p-5 text-xs leading-6 text-zinc-100"><code>{createExample}</code></pre>
			</div>
		</section>

		<aside class="h-fit rounded-lg border border-zinc-200 bg-white p-5">
			<div class="flex items-center gap-2"><TerminalSquare size={18} /><h2 class="text-sm font-extrabold">Merchant endpoints</h2></div>
			<ul class="mt-4 space-y-3 font-mono text-xs"><li><b class="text-emerald-700">GET</b> /orders</li><li><b class="text-blue-700">POST</b> /orders</li><li><b class="text-emerald-700">GET</b> /orders/:id</li><li><b class="text-amber-700">PATCH</b> /orders/:id</li><li><b class="text-emerald-700">GET</b> /stats/summary</li></ul>
			<a href="/api" target="_blank" rel="noreferrer" class="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-700">API status <ExternalLink size={15} /></a>
		</aside>
	</div>
</div>