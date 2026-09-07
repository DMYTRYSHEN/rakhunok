<script lang="ts">
	import { QrCode, Nfc, Link, CircleCheck, Receipt, ChartColumn, Bot, Code } from '@lucide/svelte';
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
	const icons = [QrCode, Nfc, Link, CircleCheck, Receipt, ChartColumn, Bot, Code];
</script>

<section id="features" class="b-section b-features" data-section="feature6" aria-labelledby="b-features-heading">
	<div class="b-wrap">
		<p class="b-eyebrow">{c.nav[2]}</p>
		<h2 id="b-features-heading" class="b-heading">{c.featureTitle}</h2>
		<div class="b-grid b-feature-grid">
			{#each c.product.features as feature, index (feature[0])}
				{@const Icon = icons[index] ?? Code}
				<article class="b-panel b-feature-card">
					<div class="b-feature-top">
						<Icon class="b-feature-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
						<span class="b-eyebrow">{feature[0]}</span>
					</div>
					<h3 class="b-feature-title">{feature[1]}</h3>
					<p class="b-feature-description">{feature[2]}</p>
				</article>
			{/each}
		</div>
		<p class="b-note">{c.product.connection}</p>
	</div>
</section>