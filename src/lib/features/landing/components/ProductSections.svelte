<script lang="ts">
	import {
		ArrowUpRight,
		Check,
		ShieldCheck,
		Sparkles,
		Zap,
		Coffee,
		ShoppingBag,
		Send,
		QrCode,
		SmartphoneNfc,
		Link,
		Server,
		ReceiptText,
		LineChart,
		Bot,
		Webhook
	} from '@lucide/svelte';
	import horecaImage from '../../../../../2.jpg';
	import retailImage from '../../../../../3.jpg';
	import servicesImage from '../../../../../4.jpg';
	import apiImage from '../../../../../1.jpg';
	import { reveal } from '../actions/reveal';
	import { paymentSteps } from '../data/content';
	import SectionHeading from './SectionHeading.svelte';
	import SolutionDetailModal from './SolutionDetailModal.svelte';
	import type { Translations } from '../data/translations';

	let { onSignup, t }: { onSignup: () => void; t: Translations } = $props();

	let solutionModalOpen = $state(false);
	let selectedSolutionIndex = $state(0);

	function openSolutionModal(index: number) {
		selectedSolutionIndex = index;
		solutionModalOpen = true;
	}

	const solutionImages = [
		{ src: horecaImage, alt: 'Оплата QR-рахунку за столиком' },
		{ src: retailImage, alt: 'Смартфон як каса у компактній торговій точці' },
		{ src: servicesImage, alt: 'Цифровий платіжний сценарій на смартфоні' },
		{ src: apiImage, alt: 'Інтеграція платіжного API' }
	];
</script>

<!-- Trust Principles Strip -->
<section class="trust-strip" aria-label="Ключові принципи довіри">
	<div class="trust-grid container">
		{#each t.trustAndPricing.trustItems as item (item.title)}
			<article>
				<strong>{item.title}</strong>
				<p>{item.description}</p>
			</article>
		{/each}
	</div>
</section>

<!-- Payment Flow Section -->
<section class="section" id="payment-flow">
	<div class="container">
		<SectionHeading
			eyebrow={t.productSections.architectureEyebrow}
			title={t.productSections.architectureTitle}
			accent=""
			copy={t.productSections.architectureDesc}
		/>

		<div class="payment-route">
			{#each t.productSections.architectureSteps as step (step.label)}
				<article use:reveal>
					<div class="route-marker">
						<b>{step.label}</b>
					</div>
					<div class="route-copy">
						<small
							>{step.label === '05'
								? 'LEDGER'
								: step.label === '03' || step.label === '04'
									? 'BANK A2A'
									: 'RAHUNOK'}</small
						>
						<h3>{step.title}</h3>
						<p>{step.description}</p>
					</div>
				</article>
			{/each}
		</div>

		<p class="section-note">
			<strong>iOS, Android & Web:</strong> App Clip, Universal Links, Bank Payment Activity & adaptive
			web checkout.
		</p>
	</div>
</section>

<!-- Comparison Table: POS vs Rahunok -->
<section class="section" id="comparison">
	<div class="container">
		<SectionHeading
			eyebrow={t.productSections.comparisonEyebrow}
			title={t.productSections.comparisonTitle}
			accent=""
			copy={t.productSections.comparisonDesc}
		/>

		<div class="comparison">
			<div class="comparison-head">
				<b>{t.productSections.comparisonHeaders[0]}</b>
				<b>{t.productSections.comparisonHeaders[1]}</b>
				<b>{t.productSections.comparisonHeaders[2]}</b>
			</div>
			{#each t.productSections.comparisonRows as row (row[0])}
				<div>
					{#each row as cell, index (`${row[0]}-${index}`)}
						{#if index === 2}
							<strong>{cell}</strong>
						{:else}
							<span>{cell}</span>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Business Solutions Bento Grid -->
<section class="section" id="solutions">
	<div class="container">
		<SectionHeading
			eyebrow={t.productSections.solutionsEyebrow}
			title={t.productSections.solutionsTitle}
			accent=""
			copy={t.productSections.solutionsDesc}
		/>

		<div class="solution-index">
			{#each t.productSections.solutions as item, index (item.title)}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<article use:reveal onclick={() => openSolutionModal(index)}>
					<header>
						<b>0{index + 1}</b>
						<small>{item.label}</small>
					</header>

					<figure class="solution-visual" data-index={index}>
						{#if solutionImages[index]}
							<img
								src={solutionImages[index].src}
								alt={solutionImages[index].alt}
								class="solution-visual__img"
								loading="lazy"
							/>
						{/if}
						<div class="solution-visual__overlay">
							{#if index === 0}
								<div class="visual-icon-wrap"><Coffee size={40} /></div>
								<div class="visual-tag">Table 12 · 850 ₴</div>
							{:else if index === 1}
								<div class="visual-icon-wrap"><ShoppingBag size={40} /></div>
								<div class="visual-tag">POS · QR Scan</div>
							{:else if index === 2}
								<div class="visual-icon-wrap"><Send size={40} /></div>
								<div class="visual-tag">pay.rahunok.app/link</div>
							{:else}
								<div class="api-visual">
									<span>POST /v1/invoices/create</span>
									<i></i>
									<strong>200 OK — SETTLED ON IBAN</strong>
								</div>
							{/if}
						</div>
					</figure>

					<div>
						<h3>{item.title}</h3>
						<p>{item.description}</p>
					</div>

					<button
						class="solution-action"
						type="button"
						onclick={() => openSolutionModal(index)}
						aria-label={`Дізнатися більше про рішення ${item.label}`}
					>
						<ArrowUpRight size={18} />
					</button>
				</article>
			{/each}
		</div>
	</div>
</section>

<SolutionDetailModal
	bind:open={solutionModalOpen}
	bind:solutionIndex={selectedSolutionIndex}
	{onSignup}
	{t}
/>

<!-- Capability Matrix -->
<section class="section" id="features">
	<div class="container">
		<SectionHeading
			eyebrow={t.productSections.featuresEyebrow}
			title={t.productSections.featuresTitle}
			accent=""
			copy={t.productSections.featuresDesc}
		/>

		<div class="capability-matrix">
			{#each t.productSections.features as item, index (item.title)}
				{@const IconComp = [
					QrCode,
					SmartphoneNfc,
					Link,
					Server,
					ReceiptText,
					LineChart,
					Bot,
					Webhook
				][index]}
				<article class="feature-card" use:reveal>
					<div class="feature-icon">
						<IconComp size={24} />
					</div>
					<small>{item.label}</small>
					<div>
						<h3>{item.title}</h3>
						<p>{item.description}</p>
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>
