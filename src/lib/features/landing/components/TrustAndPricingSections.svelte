<script lang="ts">
	import { ArrowRight, ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles } from '@lucide/svelte';
	import SectionHeading from './SectionHeading.svelte';
	import type { Translations } from '../data/translations';

	let { onSignup, t }: { onSignup: () => void; t: Translations } = $props();
</script>

<!-- Direct IBAN Money Flow Section -->
<section class="section" id="money-flow">
	<div class="money-layout container">
		<div class="money-copy">
			<SectionHeading
				eyebrow={t.trustAndPricing.securityEyebrow}
				title={t.trustAndPricing.securityTitle}
				accent=""
				copy={t.trustAndPricing.securityDesc}
			/>

			<div class="money-assurances" aria-label="Принципи безпеки платежу">
				{#each t.trustAndPricing.securityAssurances as assurance, i}
					<p>
						<span>0{i + 1}</span>
						<b>{assurance}</b>
					</p>
				{/each}
			</div>
		</div>

		<div class="money-route" aria-label="Маршрут банківського переказу">
			<header>
				<span>{t.trustAndPricing.securityPipelineHeader.label}</span>
				<b>{t.trustAndPricing.securityPipelineHeader.title}</b>
			</header>

			<div class="money-route__path">
				<article>
					<span class="money-route__index">01</span>
					<small>{t.trustAndPricing.securityPipeline[0].label}</small>
					<strong>{t.trustAndPricing.securityPipeline[0].title}</strong>
					<p>{t.trustAndPricing.securityPipeline[0].desc}</p>
				</article>

				<div class="money-route__connector" aria-hidden="true">
					<span>→ A2A →</span>
				</div>

				<article>
					<span class="money-route__index">02</span>
					<small>{t.trustAndPricing.securityPipeline[1].label}</small>
					<strong>{t.trustAndPricing.securityPipeline[1].title}</strong>
					<p>{t.trustAndPricing.securityPipeline[1].desc}</p>
				</article>

				<div class="money-route__connector" aria-hidden="true">
					<span>→ IBAN →</span>
				</div>

				<article>
					<span class="money-route__index">03</span>
					<small>{t.trustAndPricing.securityPipeline[2].label}</small>
					<strong>{t.trustAndPricing.securityPipeline[2].title}</strong>
					<p>{t.trustAndPricing.securityPipeline[2].desc}</p>
				</article>
			</div>

			<div class="money-route__signal">
				<div>
					<span class="money-route__pulse" aria-hidden="true"></span>
					<b>Rahunok підтверджує факт, а не тримає кошти</b>
				</div>
				<p>Bank A2A <span>→</span> Server Rahunok <span>→</span> PRRO Receipt</p>
			</div>
		</div>
	</div>

	<p class="legal-note container">
		<b>NBU 003:</b> Open Banking A2A Payment Architecture.
	</p>
</section>

<!-- Proof Ledger Section -->
<section class="section" id="proof">
	<div class="container">
		<SectionHeading
			eyebrow={t.trustAndPricing.proofEyebrow}
			title={t.trustAndPricing.proofTitle}
			accent=""
			copy={t.trustAndPricing.proofDesc}
		/>

		<div class="proof-ledger">
			<header>
				<span>CHECK</span>
				<span>Параметр контролю</span>
				<span>Гарантія для бізнесу</span>
				<span></span>
			</header>

			{#each t.trustAndPricing.proofItems as item (item.title)}
				<article>
					<small>{item.label}</small>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
					<b aria-hidden="true">✓</b>
				</article>
			{/each}
		</div>
	</div>
</section>

<!-- Pricing Plans Section -->
<section class="section" id="pricing">
	<div class="container">
		<SectionHeading
			eyebrow={t.trustAndPricing.pricingEyebrow}
			title={t.trustAndPricing.pricingTitle}
			accent=""
			copy={t.trustAndPricing.pricingDesc}
		/>

		<div class="pricing-grid">
			{#each t.trustAndPricing.pricingPlans as plan (plan.name)}
				<article class="price-card" class:popular={plan.popular}>
					<div class="price-head">
						{#if plan.popular}
							<mark>Recommended</mark>
						{/if}
						<small>{plan.name}</small>
						<h3>{plan.price}</h3>
						<p>{plan.description}</p>
					</div>

					<ul>
						{#each plan.features as feature (feature)}
							<li>{feature}</li>
						{/each}
					</ul>

					<div class="price-action">
						<button
							class="button {plan.popular ? 'button-primary' : 'button-secondary'}"
							type="button"
							onclick={onSignup}
						>
							{plan.cta}
						</button>
						<small>{plan.note}</small>
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>

<!-- FAQ Accordion -->
<section class="section" id="faq">
	<div class="faq-container container">
		<SectionHeading
			eyebrow={t.trustAndPricing.faqEyebrow}
			title={t.trustAndPricing.faqTitle}
			accent=""
			copy={t.trustAndPricing.faqDesc}
		/>

		<div class="faq-list">
			{#each t.trustAndPricing.faqItems as item (item.question)}
				<details>
					<summary>{item.question}</summary>
					<p>{item.answer}</p>
				</details>
			{/each}
		</div>
	</div>
</section>

<!-- Grand Finale Monolith CTA -->
<section class="section final-section" id="final-cta">
	<div class="container">
		<div class="final-card">
			<header>
				<p
					class="eyebrow"
					style="background: rgba(167, 139, 250, 0.15); color: #c084fc; border: 1px solid rgba(167, 139, 250, 0.3);"
				>
					<span>{t.trustAndPricing.ctaEyebrow}</span>
				</p>
			</header>

			<h2>
				{t.trustAndPricing.ctaTitle}
			</h2>

			<div class="final-actions">
				<p>
					{t.trustAndPricing.ctaDesc}
				</p>

				<div>
					<button class="button button-primary" type="button" onclick={onSignup}>
						{t.trustAndPricing.ctaBtn}
						<ArrowRight size={16} aria-hidden="true" />
					</button>
					<a class="button button-secondary" href="#demo"> Live Sandbox </a>
				</div>
			</div>

			<footer>
				<span>0 ₴ POS</span>
				<span>Direct IBAN</span>
				<span>PRRO Ready</span>
				<span>A2A Pay by Bank</span>
			</footer>
		</div>
	</div>
</section>
