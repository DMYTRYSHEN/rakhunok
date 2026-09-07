<script lang="ts">
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section class="b-section b-stats" data-section="stats3">
	<div class="b-wrap">
		<dl class="b-grid b-stats-grid">
			{#each c.stats as [value, label] (label)}
				<div class="b-stat">
					<dt class="b-stat-label">{label}</dt>
					<dd class="b-stat-value">{value}</dd>
				</div>
			{/each}
		</dl>
		<p class="b-note b-stats-note">
			{c.statsNote}
			<a href="https://bank.gov.ua/ua/payments/sep">{c.source}</a>
		</p>
	</div>
</section>