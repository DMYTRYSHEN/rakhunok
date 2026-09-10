<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AlertCircle,
		ArrowDownRight,
		Building2,
		CheckCircle2,
		Coins,
		Download,
		FileCode2,
		FileSpreadsheet,
		Plus,
		Receipt,
		ShieldCheck,
		Users
	} from '@lucide/svelte';
	import type { Dac7Payout, Dac7Seller } from '../types';
	import type { Dac7Gateway } from '../dac7-gateway';

	let {
		gateway,
		demo = false
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
	} = $props();

	let payouts = $state<Dac7Payout[]>([]);
	let sellers = $state<Dac7Seller[]>([]);
	let loading = $state(true);
	let xmlModalOpen = $state(false);
	let xmlReportContent = $state('');
	let xmlValidated = $state(false);
	let batchStatus = $state<string | null>(null);

	async function loadData() {
		loading = true;
		[payouts, sellers] = await Promise.all([
			gateway.getPayouts(demo),
			gateway.getSellers(demo)
		]);
		loading = false;
	}

	const totalGross = $derived(payouts.reduce((sum, p) => sum + p.gross, 0));
	const totalTax = $derived(payouts.reduce((sum, p) => sum + p.tax, 0));
	const totalNet = $derived(payouts.reduce((sum, p) => sum + p.net, 0));

	async function runBatchPayout() {
		batchStatus = '?????????? ?????????????? ????? ?????? ?? ????...';
		const targetSeller = sellers[0] || {
			id: 'RHK-9E71AB3',
			name: '??????? ????????',
			isFop: false
		};

		const newPayout = await gateway.createPayout({
			sellerId: targetSeller.id,
			sellerName: targetSeller.name,
			gross: 950,
			isFop: !!targetSeller.isFop,
			rail: 'Monobank A2C (IBAN)'
		});

		payouts = [newPayout, ...payouts];
		batchStatus = `???? ??????? ??????????! ?????????? 950 ?, ???????? 10% ???? (${newPayout.tax} ?), ???????????? ${newPayout.net} ?.`;
		setTimeout(() => (batchStatus = null), 6000);
	}

	function generateXmlReport() {
		const now = new Date().toISOString();
		xmlReportContent = `<?xml version="1.0" encoding="UTF-8"?>
<DPI_Report xmlns="urn:oecd:ties:dpi:v1" version="1.0">
  <DocSpec>
    <DocRefId>RHK-UA-2026-Q3-BOLT-001</DocRefId>
    <CorrDocRefId></CorrDocRefId>
    <DocTypeIndic>OECD1</DocTypeIndic>
  </DocSpec>
  <PlatformOperator>
    <Jurisdiction>UA</Jurisdiction>
    <Name>Bolt Operations O? / ??? ????? ????????? ????????</Name>
    <TIN jurisdiction="UA">43102914</TIN>
    <LawFramework>Law_4903_IX_Digital_Platforms</LawFramework>
  </PlatformOperator>
  <ReportableSellers count="${sellers.length}">
${sellers
	.map(
		(s) => `    <Seller>
      <Identity>
        <Name>${s.name}</Name>
        <RNOKPP>${s.rnokpp || '3091248192'}</RNOKPP>
        <Status>${s.isFop ? 'FOP' : 'Individual_Law_4903'}</Status>
        <KYCLevel>${s.kyc}</KYCLevel>
      </Identity>
      <FinancialDetails>
        <GrossTurnover currency="UAH">${s.earned.toFixed(2)}</GrossTurnover>
        <TaxWithheld rate="${s.isFop ? '0%' : '10%'}">${(s.isFop ? 0 : s.earned * 0.1).toFixed(2)}</TaxWithheld>
        <NetPayout currency="UAH">${(s.earned * (s.isFop ? 1 : 0.9)).toFixed(2)}</NetPayout>
      </FinancialDetails>
    </Seller>`
	)
	.join('\n')}
  </ReportableSellers>
  <Summary>
    <TotalGross currency="UAH">${totalGross.toFixed(2)}</TotalGross>
    <TotalTaxPIT currency="UAH">${totalTax.toFixed(2)}</TotalTaxPIT>
    <TotalNetSettled currency="UAH">${totalNet.toFixed(2)}</TotalNetSettled>
    <GeneratedAt>${now}</GeneratedAt>
  </Summary>
</DPI_Report>`;

		xmlValidated = true;
		xmlModalOpen = true;
	}

	function downloadXml() {
		const blob = new Blob([xmlReportContent], { type: 'application/xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `DPI_DAC7_Report_${new Date().toISOString().slice(0, 10)}.xml`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		loadData();
	});
</script>

<div class="space-y-6">
	<!-- Banner -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="inline-flex size-6 items-center justify-center rounded-md bg-stone-900 text-white">
						<Building2 size={14} />
					</span>
					<h2 class="text-base font-bold text-stone-900">
						??????? ????????? ? Bolt Food (??????? CFO)
					</h2>
				</div>
				<p class="text-xs text-stone-500">
					?????????? ?????: ???????????? ?????????? 10% ????, ?????? ??????? ?? ??????? ?? ??????????? ????????? DAC7
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={runBatchPayout}
					class="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-stone-800 transition"
				>
					<Coins size={14} />
					<span>?????????? ???? ??????</span>
				</button>

				<button
					type="button"
					onclick={generateXmlReport}
					class="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 shadow-sm hover:bg-stone-50 transition"
				>
					<FileCode2 size={14} />
					<span>???? DAC7 / DPI (XML)</span>
				</button>
			</div>
		</div>

		{#if batchStatus}
			<div class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
				<CheckCircle2 size={16} />
				<span>{batchStatus}</span>
			</div>
		{/if}
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">?????? ?????? (Gross)</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-stone-900">{totalGross.toLocaleString('uk-UA')} ?</span>
				<span class="text-xs font-bold text-stone-400">100%</span>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">???????? ???? 10% (???)</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-rose-600">-{totalTax.toLocaleString('uk-UA')} ?</span>
				<span class="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
					????? ? 4903-IX
				</span>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">????????? ???'???? (Net)</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-emerald-600">{totalNet.toLocaleString('uk-UA')} ?</span>
				<span class="text-xs font-bold text-emerald-600">90%</span>
			</div>
		</div>

		<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-1">
			<span class="text-xs font-semibold text-stone-400">???????? ???'????</span>
			<div class="flex items-baseline justify-between">
				<span class="text-xl font-black text-stone-900">{sellers.length}</span>
				<span class="text-xs text-stone-400">????????????</span>
			</div>
		</div>
	</div>

	<!-- Payouts Table -->
	<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-sm font-bold text-stone-900">??????? ?????? ?? ????????? ???????</h3>
				<p class="text-xs text-stone-500">???????????? ???????? 10% ??????? ????????? ?? ??????????? ??????</p>
			</div>
			<span class="text-xs text-stone-400">?????? ??????: {payouts.length}</span>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="border-b border-stone-200 bg-stone-50/70 text-stone-500">
					<tr>
						<th class="p-3 font-bold">????????? / ??????????</th>
						<th class="p-3 font-bold">????? ???????</th>
						<th class="p-3 font-bold">?????????? (Gross)</th>
						<th class="p-3 font-bold">???? 10%</th>
						<th class="p-3 font-bold">?? ??????? (Net)</th>
						<th class="p-3 font-bold">??????</th>
						<th class="p-3 font-bold text-right">???</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-stone-100 text-stone-700">
					{#if loading}
						<tr>
							<td colspan="7" class="p-4 text-center text-stone-400">???????????? ??????...</td>
						</tr>
					{:else}
						{#each payouts as p}
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-medium text-stone-900">{p.seller}</td>
								<td class="p-3 font-mono text-stone-500">{p.rail}</td>
								<td class="p-3 font-semibold text-stone-900">{p.gross.toFixed(2)} ?</td>
								<td class="p-3 font-bold text-rose-600">
									{p.tax > 0 ? `-${p.tax.toFixed(2)} ?` : '0.00 ? (???)'}
								</td>
								<td class="p-3 font-bold text-emerald-600">{p.net.toFixed(2)} ?</td>
								<td class="p-3">
									<span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
										<CheckCircle2 size={11} /> ??????????
									</span>
								</td>
								<td class="p-3 text-right text-stone-400">{p.date}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Modal DAC7 XML Viewer -->
	{#if xmlModalOpen}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
			<div class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
				<div class="flex items-center justify-between border-b border-stone-200 p-4">
					<div class="flex items-center gap-2">
						<FileCode2 size={18} class="text-stone-900" />
						<h3 class="text-sm font-bold text-stone-900">
							???????????? ???? DAC7 / DPI (OECD Schema v1.0)
						</h3>
					</div>
					<div class="flex items-center gap-2">
						{#if xmlValidated}
							<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
								????????? XSD ???????
							</span>
						{/if}
						<button
							type="button"
							onclick={() => (xmlModalOpen = false)}
							class="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
						>
							?
						</button>
					</div>
				</div>

				<div class="flex-1 overflow-auto p-4 bg-stone-900 text-stone-200 font-mono text-xs">
					<pre class="whitespace-pre-wrap leading-relaxed">{xmlReportContent}</pre>
				</div>

				<div class="flex items-center justify-between border-t border-stone-200 p-4 bg-stone-50">
					<span class="text-xs text-stone-500">
						???????? ?? ?????????????? ??? ??????? ?? ?????????? ???? ?? DAC7
					</span>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={downloadXml}
							class="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition"
						>
							<Download size={14} /> ??????????? .XML
						</button>
						<button
							type="button"
							onclick={() => (xmlModalOpen = false)}
							class="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
						>
							???????
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
