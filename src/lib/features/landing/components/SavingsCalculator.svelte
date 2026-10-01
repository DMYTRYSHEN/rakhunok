<script lang="ts">
	import { compareMonthlyCosts } from '../utils/cost-comparison';
	import { getBaselineCopy } from '../baseline/copy';
	import SectionHeading from './SectionHeading.svelte';
	import type { Locale, Translations } from '../data/translations';

	let { t, locale = 'uk' }: { t: Translations; locale?: Locale } = $props();

	let turnover = $state(500_000);
	let fee = $state(1.5);
	let terminals = $state(2);
	let rent = $state<number | undefined>(400);
	let subscription = $state<number | undefined>(490);
	let proposedRate = $state<number | undefined>(0.5);
	const copy = $derived(getBaselineCopy(locale));
	const costs = $derived(
		compareMonthlyCosts(
			turnover,
			fee,
			rent === undefined ? undefined : terminals * rent,
			subscription,
			proposedRate
		)
	);
	const formatMoney = (value: number) =>
		new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: 'UAH',
			maximumFractionDigits: 0
		}).format(value);
</script>

<section class="section" id="calculator">
	<div class="calculator-layout container">
		<SectionHeading
			eyebrow={t.calculator.eyebrow}
			title={copy.roiTitle}
			accent=""
			copy={copy.roiNote}
		/>

		<div class="calculator-card">
			<label>
				<span>
					{t.calculator.turnoverLabel}
					<b>{formatMoney(turnover)}</b>
				</span>
				<input bind:value={turnover} type="range" min="50000" max="5000000" step="50000" />
			</label>

			<label>
				<span>
					{t.calculator.currentAcquiring}
					<b>{fee.toFixed(1).replace('.', ',')}%</b>
				</span>
				<input bind:value={fee} type="range" min="0.5" max="3" step="0.1" />
			</label>

			<label>
				<span>
					POS
					<b>{terminals}</b>
				</span>
				<input bind:value={terminals} type="range" min="0" max="20" />
			</label>

			<label>
				<span>{copy.product.rentUnit}</span>
				<input type="number" min="0" step="1" bind:value={rent} />
			</label>
			<label>
				<span>{copy.shared.fee}</span>
				<input type="number" min="0" step="1" bind:value={subscription} />
			</label>
			<label>
				<span>{copy.shared.rate}</span>
				<input type="number" min="0" max="100" step="0.1" bind:value={proposedRate} />
			</label>

			{#if costs}
				<div class="result-grid" aria-live="polite" aria-atomic="true">
					<div>
						<span>{t.calculator.currentCost} / {copy.product.monthly}</span>
						<b>{formatMoney(costs.current)}</b>
					</div>
					<div>
						<span>{t.calculator.rahunokCost} / {copy.product.monthly}</span>
						<b>{formatMoney(costs.proposed)}</b>
					</div>
					<div class="accent">
						<span>{t.calculator.monthlyEconomy}</span>
						<b>{formatMoney(costs.difference)}</b>
					</div>
					<div>
						<span>{t.calculator.annualEconomy}</span>
						<b>{formatMoney(costs.difference * 12)}</b>
					</div>
				</div>
			{:else}
				<p role="status">{copy.invalidCost}</p>
			{/if}

			<p class="microcopy">
				{copy.product.sample}
			</p>
		</div>
	</div>
</section>

<style>
	input[type='number'] {
		width: 100%;
		min-height: 44px;
		border: 1px solid var(--border-glass);
		border-radius: 6px;
		padding: 10px 12px;
		background: var(--bg-input);
		color: var(--text-primary);
	}
	.result-grid b {
		overflow-wrap: anywhere;
	}
</style>
