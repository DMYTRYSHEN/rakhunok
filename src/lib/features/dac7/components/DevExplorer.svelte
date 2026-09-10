<script lang="ts">
	import { Check, Copy, Terminal, Radio, Shield, Key } from '@lucide/svelte';

	let activeApiKey = $state('rhk_live_9f81a2e9b0c4d1...84a2');
	let copied = $state(false);

	function copyKey() {
		navigator.clipboard.writeText(activeApiKey);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-6">
	<!-- Banner -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white">
						<Key size={14} />
					</span>
					<h2 class="text-base font-bold text-stone-900">Кабінет розробника платформи</h2>
				</div>
				<p class="text-xs text-stone-500">
					Інтеграція REST API та Webhook для автоматизації виплат самозайнятим згідно із Законом № 4903-IX
				</p>
			</div>
			<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
				<Radio size={12} class="animate-pulse" />
				Anycast API v1.4 Active
			</span>
		</div>
	</div>

	<!-- API Keys -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-bold text-stone-900">Ключі інтеграції платформи (Merchant API)</h3>
				<p class="text-xs text-stone-500">Авторизація серверних запитів виплат та підключення Webhook</p>
			</div>
			<span class="rounded bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
				Live Edge
			</span>
		</div>

		<div class="flex items-center gap-2">
			<input
				readonly
				value={activeApiKey}
				class="w-full rounded-xl border border-stone-300 bg-stone-50 p-2.5 font-mono text-xs text-stone-800 focus:outline-none"
			/>
			<button
				type="button"
				onclick={copyKey}
				class="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-stone-800 transition"
			>
				{#if copied}
					<Check size={14} /> Скопійовано
				{:else}
					<Copy size={14} /> Копіювати
				{/if}
			</button>
		</div>
	</div>

	<!-- Webhook Events Stream -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-bold text-stone-900">Потік Webhook-подій життєвого циклу доставки</h3>
			<span class="text-xs text-stone-400">Слухач: https://api.bolt.eu/webhooks/rahunok</span>
		</div>

		<div class="space-y-2 font-mono text-xs">
			<div class="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
				<span class="text-emerald-700 font-bold">courier.delivery.delivered</span>
				<span class="text-stone-500">Order #884 · 245 ₴ (ПДФО 24.50 ₴)</span>
				<span class="text-[10px] text-emerald-600 font-bold">200 OK</span>
			</div>
			<div class="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
				<span class="text-blue-700 font-bold">payout.batch.settled</span>
				<span class="text-stone-500">Batch #bt_02070_9E71 · 630 ₴</span>
				<span class="text-[10px] text-emerald-600 font-bold">200 OK</span>
			</div>
			<div class="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
				<span class="text-purple-700 font-bold">dac7.xml.validated</span>
				<span class="text-stone-500">DPI_Report_2026_Q3_Bolt.xml</span>
				<span class="text-[10px] text-emerald-600 font-bold">200 OK</span>
			</div>
		</div>
	</div>

	<!-- cURL Example -->
	<div class="rounded-2xl border border-stone-900 bg-stone-950 p-6 text-stone-100 shadow-sm space-y-3 font-mono text-xs">
		<div class="flex items-center justify-between text-stone-400">
			<div class="flex items-center gap-2">
				<Terminal size={14} />
				<span>Приклад ініціалізації виплати через cURL</span>
			</div>
			<span class="text-[11px] text-amber-400">10% ПДФО утримується автоматично</span>
		</div>
		<pre class="overflow-x-auto text-emerald-400 bg-stone-900 p-4 rounded-xl leading-relaxed">
curl -X POST https://api.rahunok.app/v1/dac7/payouts \
  -H "Authorization: Bearer {activeApiKey}" \
  -H "Content-Type: application/json" \
  -d '&#123;
    "seller_id": "RHK-9E71AB3",
    "gross_amount": 700.00,
    "law_4903_tax_mode": "auto_10pct",
    "rail": "monobank_a2c"
  &#125;'
		</pre>
	</div>
</div>
