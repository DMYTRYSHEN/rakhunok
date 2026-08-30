<script lang="ts">
	import { ArrowRight, Calculator, Sparkles, TrendingUp } from '@lucide/svelte';
	import { calculateAcquiringCosts, formatMoney } from '../utils/calculator';
	import SectionHeading from './SectionHeading.svelte';
	import type { Translations } from '../data/translations';

	let { t }: { t: Translations } = $props();

	let turnover = $state(500_000);
	let fee = $state(1.5);
	let terminals = $state(2);
	let costs = $derived(calculateAcquiringCosts(turnover, fee, terminals));
</script>

<section class="section" id="calculator">
	<div class="calculator-layout container">
		<SectionHeading
			eyebrow={t.calculator.eyebrow}
			title={t.calculator.title}
			accent=""
			copy={t.calculator.subtitle}
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
					<b>{terminals} шт.</b>
				</span>
				<input bind:value={terminals} type="range" min="0" max="20" />
			</label>

			<div class="result-grid">
				<div>
					<span>{t.calculator.currentCost}</span>
					<b>{formatMoney(costs.annualCommission)}</b>
				</div>
				<div>
					<span>POS Rent</span>
					<b>{formatMoney(costs.annualRent)}</b>
				</div>
				<div class="accent">
					<span>{t.calculator.monthlyEconomy}</span>
					<b>{formatMoney(Math.round(costs.annualCost / 12))}</b>
				</div>
				<div>
					<span>{t.calculator.annualEconomy}</span>
					<b>до {formatMoney(costs.annualCost)}</b>
				</div>
			</div>

			<p class="microcopy">
				{t.calculator.calculateNote}
			</p>
		</div>
	</div>
</section>
