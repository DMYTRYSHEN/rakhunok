<script lang="ts">
	import { pilotHref, type BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="pricing" class="b-section b-pricing" data-section="pricing11" aria-labelledby="b-pricing-heading">
	<div class="b-wrap">
		<p class="b-eyebrow">{c.shared.pricingLabel}</p>
		<h2 id="b-pricing-heading" class="b-heading">{c.pricingTitle}</h2>
		<p class="b-pricing-intro">{c.shared.pricingIntro}</p>
		<div class="b-grid b-pricing-grid">
			{#each c.shared.plans as plan (plan[0])}
				<article class="b-panel b-pricing-card">
					<h3 class="b-pricing-name">{plan[0]}</h3>
					<p class="b-pricing-price">{plan[1]}</p>
					<p class="b-pricing-description">{plan[2]}</p>
					<ul class="b-pricing-features">
						{#each plan[3].split(' · ') as feature (feature)}
							<li>{feature}</li>
						{/each}
					</ul>
					<a class="b-button b-pricing-cta" href={pilotHref} aria-label={`${c.pilot} · ${plan[0]}`}>{c.pilot}</a>
				</article>
			{/each}
		</div>
		<p class="b-note b-pricing-note">{c.shared.planNote}</p>
	</div>
</section>