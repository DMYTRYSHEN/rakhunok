<script lang="ts">
	import { ArrowUpRight, SlidersHorizontal, TrendingUp } from '@lucide/svelte';
	import type { Locale } from '../data/translations';
	import { studioCopy } from '../data/studio-copy';
	import { refreshCopy } from '../data/refresh-copy';
	import { compareMonthlyCosts } from '../utils/cost-comparison';
	let { locale }: { locale: Locale } = $props();
	const c = $derived(studioCopy[locale]);
	const r = $derived(refreshCopy[locale]);
	let turnover = $state<number | undefined>(500000);
	let commission = $state<number | undefined>(1.5);
	let terminals = $state<number | undefined>(2);
	let rent = $state<number | undefined>(400);
	let subscription = $state<number | undefined>(490);
	let proposedRate = $state<number | undefined>(0.5);
	let annual = $state(true);
	const validRental = $derived(
		terminals !== undefined &&
			Number.isInteger(terminals) &&
			terminals >= 0 &&
			terminals <= 50 &&
			rent !== undefined &&
			Number.isFinite(rent) &&
			rent >= 0
	);
	const costs = $derived(
		compareMonthlyCosts(
			turnover,
			commission,
			validRental ? terminals! * rent! : undefined,
			subscription,
			proposedRate
		)
	);
	const factor = $derived(annual ? 12 : 1);
	const maxCost = $derived(Math.max(costs?.current ?? 0, costs?.proposed ?? 0, 1));
	const money = (value: number) =>
		new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
	function preset(index: number) {
		turnover = [150000, 500000, 2000000][index];
		terminals = [1, 2, 8][index];
	}
</script>

<section class="studio-section" id="calculator" aria-labelledby="analytics-title">
	<div class="section-intro">
		<p class="studio-eyebrow">04 / FINANCIAL INTELLIGENCE</p>
		<h2 id="analytics-title">{c.analytics}<br /><span>{c.analyticsAccent}</span></h2>
		<p>{c.analyticsText}</p>
	</div>
	<div class="finance-workspace glass-panel">
		<div class="finance-controls">
			<div class="panel-heading">
				<SlidersHorizontal size={18} /><strong>{c.assumptions}</strong>
			</div>
			<div class="preset-buttons">
				{#each c.presets as name, i (name)}<button type="button" onclick={() => preset(i)}
						>{name}<ArrowUpRight size={12} /></button
					>{/each}
			</div>
			<div class="slider-control">
				<div>
					<label for="turnover-slider">{r.turnover}</label><input
						aria-label={r.turnover}
						type="number"
						min="0"
						max="5000000"
						step="10000"
						bind:value={turnover}
					/>
				</div>
				<input
					id="turnover-slider"
					type="range"
					min="0"
					max="5000000"
					step="10000"
					bind:value={turnover}
				/>
			</div>
			<div class="slider-control">
				<div>
					<label for="commission-slider">{r.currentRate}</label><input
						aria-label={r.currentRate}
						type="number"
						min="0"
						max="100"
						step="0.1"
						bind:value={commission}
					/>
				</div>
				<input
					id="commission-slider"
					type="range"
					min="0"
					max="100"
					step="0.1"
					bind:value={commission}
				/>
			</div>
			<div class="slider-control">
				<div>
					<label for="terminal-slider">{c.terminals}</label><input
						aria-label={c.terminals}
						type="number"
						min="0"
						max="50"
						step="1"
						bind:value={terminals}
					/>
				</div>
				<input id="terminal-slider" type="range" min="0" max="50" step="1" bind:value={terminals} />
			</div>
			<details class="finance-assumptions" open>
				<summary>{c.assumptions}<span>↗</span></summary>
				<div>
					<label>{c.rentUnit}<input type="number" min="0" step="1" bind:value={rent} /></label
					><label>{r.fee}<input type="number" min="0" step="1" bind:value={subscription} /></label
					><label
						>{r.rate}<input
							type="number"
							min="0"
							max="100"
							step="0.1"
							bind:value={proposedRate}
						/></label
					>
				</div>
			</details>
			<p class="studio-note">{c.sample}</p>
		</div>
		<div class="finance-results">
			<div class="finance-results-top">
				<span class="studio-eyebrow">COST INTELLIGENCE</span>
				<div class="segmented">
					<button
						type="button"
						class:active={!annual}
						aria-pressed={!annual}
						onclick={() => (annual = false)}>{c.monthly}</button
					><button
						type="button"
						class:active={annual}
						aria-pressed={annual}
						onclick={() => (annual = true)}>{c.annual}</button
					>
				</div>
			</div>
			<div class="finance-live" aria-live="polite" aria-atomic="true">
				{#if costs}<p>
						{costs.difference < 0
							? c.negative
							: r.difference
									.replace(' / місяць', '')
									.replace(' / month', '')
									.replace(' / miesiąc', '')}
					</p>
					<strong class="finance-total" class:negative={costs.difference < 0}
						>{money(costs.difference * factor)}<span> ₴</span></strong
					><span class="finance-period">{annual ? c.annual : c.monthly} · {c.sample}</span>{:else}<p
						class="invalid-costs"
					>
						{r.incomplete} · ≥ 0 · 0–100%
					</p>{/if}
			</div>
			{#if costs}<div class="comparison-bars">
					<div>
						<span>{r.now}<strong>{money(costs.current * factor)} ₴</strong></span><i
							style:width={`${Math.max((costs.current / maxCost) * 100, 1)}%`}
						></i>
					</div>
					<div class="proposed-bar">
						<span>{r.after}<strong>{money(costs.proposed * factor)} ₴</strong></span><i
							style:width={`${Math.max((costs.proposed / maxCost) * 100, 1)}%`}
						></i>
					</div>
				</div>
				<div class="projection-chart">
					<div><TrendingUp size={15} /><span>{c.projection}</span></div>
					<svg
						viewBox="0 0 480 100"
						role="img"
						aria-label={`${c.projection}: ${money(costs.difference * 12)} UAH`}
						><path d="M0 20H480M0 55H480M0 90H480" class="projection-grid" /><path
							d={costs.difference > 0
								? 'M0 90L480 10L480 100L0 100Z'
								: costs.difference < 0
									? 'M0 10L480 90L480 100L0 100Z'
									: 'M0 50L480 50L480 100L0 100Z'}
							class="projection-fill"
						/><path
							d={costs.difference > 0
								? 'M0 90L480 10'
								: costs.difference < 0
									? 'M0 10L480 90'
									: 'M0 50L480 50'}
							class="projection-line"
							class:negative={costs.difference < 0}
						/></svg
					>
					<div class="projection-axis"><span>01</span><span>06</span><span>12</span></div>
				</div>{/if}
			<p class="studio-note">{r.calcNote}</p>
		</div>
	</div>
</section>
