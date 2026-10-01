<script lang="ts">
	import { Building2, CircleCheck } from '@lucide/svelte';

	let {
		selectedMfo = '',
		onSelectBank
	}: {
		selectedMfo?: string;
		onSelectBank?: (bank: { name: string; mfo: string; fastPayout: boolean }) => void;
	} = $props();

	export const UKRAINIAN_BANKS = [
		{
			mfo: '322001',
			name: 'Монобанк (АТ "Універсал Банк")',
			badge: 'mono',
			color: 'bg-stone-900 text-white',
			fastPayout: true
		},
		{
			mfo: '305299',
			name: 'ПриватБанк (АТ КБ "ПриватБанк")',
			badge: 'privat',
			color: 'bg-emerald-600 text-white',
			fastPayout: true
		},
		{
			mfo: '380805',
			name: 'Райффайзен Банк',
			badge: 'raif',
			color: 'bg-amber-400 text-stone-900 font-bold',
			fastPayout: true
		},
		{
			mfo: '334850',
			name: 'ПУМБ (Перший Український Міжнародний)',
			badge: 'pumb',
			color: 'bg-rose-700 text-white',
			fastPayout: true
		},
		{
			mfo: '300346',
			name: 'Sense Bank (Сенс Банк)',
			badge: 'sense',
			color: 'bg-blue-600 text-white',
			fastPayout: true
		},
		{
			mfo: '322669',
			name: 'Ощадбанк (Державний Ощадний Банк)',
			badge: 'oschad',
			color: 'bg-emerald-800 text-white',
			fastPayout: false
		},
		{
			mfo: '351005',
			name: 'Укрсиббанк (BNP Paribas Group)',
			badge: 'ukrsib',
			color: 'bg-emerald-700 text-white',
			fastPayout: true
		}
	];

	const detectedBank = $derived(UKRAINIAN_BANKS.find((b) => selectedMfo.startsWith(b.mfo)) || null);

	function choose(b: (typeof UKRAINIAN_BANKS)[0]) {
		if (onSelectBank) onSelectBank(b);
	}
</script>

<div class="space-y-3">
	{#if detectedBank}
		<div
			class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs"
		>
			<div class="flex items-center gap-2.5">
				<span
					class="rounded-lg px-2 py-1 text-[11px] font-black tracking-wider uppercase {detectedBank.color}"
				>
					{detectedBank.badge}
				</span>
				<div>
					<div class="font-bold text-stone-900">{detectedBank.name}</div>
					<div class="font-mono text-[10.5px] text-stone-500">МФО: {detectedBank.mfo}</div>
				</div>
			</div>
			{#if detectedBank.fastPayout}
				<span
					class="rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800"
				>
					СЕП-4 24/7 Онлайн
				</span>
			{/if}
		</div>
	{:else}
		<div class="text-[11px] text-stone-400">
			Оберіть банк або введіть перші 6 цифр МФО для автоматичного визначення
		</div>
		<div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
			{#each UKRAINIAN_BANKS as b}
				<button
					type="button"
					onclick={() => choose(b)}
					class="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 text-left transition hover:bg-stone-50"
				>
					<span
						class="grid size-6 place-items-center rounded-md text-[9px] font-black uppercase {b.color}"
					>
						{b.badge.slice(0, 2)}
					</span>
					<div class="truncate">
						<div class="truncate text-[11px] font-bold text-stone-800">{b.name.split(' ')[0]}</div>
						<div class="font-mono text-[9.5px] text-stone-400">{b.mfo}</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
