<script lang="ts">
	import {
		ZapOff,
		Smartphone,
		QrCode,
		ShieldCheck,
		ReceiptText,
		Clock,
		Building2,
		Signal,
		Flame,
		ArrowRight,
		ShieldAlert,
		Sparkles,
		CheckCircle2
	} from '@lucide/svelte';
	import type { Translations } from '../data/translations';

	let {
		onSignup,
		t
	}: {
		onSignup: () => void;
		t: Translations;
	} = $props();

	let activeStepIndex = $state(0);

	function getStepIcon(iconName: string) {
		switch (iconName) {
			case 'ZapOff':
				return ZapOff;
			case 'Smartphone':
				return Smartphone;
			case 'QrCode':
				return QrCode;
			case 'ShieldCheck':
				return ShieldCheck;
			case 'ReceiptText':
				return ReceiptText;
			default:
				return ZapOff;
		}
	}

	function getCardIcon(iconName: string) {
		switch (iconName) {
			case 'Clock':
				return Clock;
			case 'Building2':
				return Building2;
			case 'Signal':
				return Signal;
			case 'Flame':
				return Flame;
			default:
				return ShieldCheck;
		}
	}
</script>

<section id="plan-b" class="plan-b-section">
	<div class="plan-b-container">
		<!-- Section Header -->
		<header class="plan-b-header">
			<div class="plan-b-badge-row">
				<span class="plan-b-eyebrow-pill">
					<ShieldAlert size={14} />
					{t.planB.eyebrow}
				</span>
				<span class="plan-b-live-badge">
					<span class="pulse-dot"></span>
					{t.planB.badge}
				</span>
			</div>

			<h2 class="plan-b-title">
				{t.planB.title}
			</h2>

			<p class="plan-b-subtitle">
				{t.planB.subtitle}
			</p>
		</header>

		<!-- 5-Step Emergency Resilience Flow -->
		<div class="plan-b-timeline-card">
			<div class="timeline-card-header">
				<div class="timeline-header-icon">
					<Sparkles size={18} />
				</div>
				<div>
					<h3 class="timeline-card-title">{t.planB.emergencyFlowTitle}</h3>
					<span class="timeline-card-note">{t.planB.timelineNote}</span>
				</div>
			</div>

			<div class="plan-b-proof-row" aria-label={t.planB.proofLabel}>
				{#each t.planB.proofPoints as point}
					<div class="plan-b-proof-point">
						<strong>{point.value}</strong>
						<span>{point.label}</span>
					</div>
				{/each}
			</div>

			<div class="plan-b-steps-track">
				{#each t.planB.steps as step, idx}
					{@const StepIcon = getStepIcon(step.icon)}
					<button
						type="button"
						class="plan-b-step-item"
						class:active={activeStepIndex === idx}
						onclick={() => (activeStepIndex = idx)}
					>
						<div class="step-item-top">
							<div class="step-num-pill">{step.stepNumber}</div>
							<div class="step-icon-bubble">
								<StepIcon size={18} />
							</div>
						</div>

						<span class="step-tag">{step.tag}</span>
						<h4 class="step-title">{step.title}</h4>
						<p class="step-desc">{step.desc}</p>
					</button>
				{/each}
			</div>

			<p class="plan-b-availability-note">
				<Signal size={16} />
				<span>{t.planB.availabilityNote}</span>
			</p>
		</div>

		<!-- 4 Resilience Bento Cards -->
		<div class="plan-b-bento-grid">
			{#each t.planB.resilienceCards as card}
				{@const CardIcon = getCardIcon(card.icon)}
				<div class="plan-b-bento-card">
					<div class="bento-card-header">
						<div class="bento-icon-container">
							<CardIcon size={22} />
						</div>
						<span class="bento-highlight-pill">{card.highlight}</span>
					</div>

					<h4 class="bento-card-title">{card.title}</h4>
					<p class="bento-card-desc">{card.desc}</p>
				</div>
			{/each}
		</div>

		<!-- Action Callout Card -->
		<div class="plan-b-cta-card">
			<div class="plan-b-cta-content">
				<div class="cta-shield-icon">
					<ShieldCheck size={28} />
				</div>
				<div>
					<h3 class="plan-b-cta-title">{t.planB.ctaTitle}</h3>
					<p class="plan-b-cta-desc">{t.planB.ctaSubtitle}</p>
					<div class="plan-b-guarantee-row">
						<CheckCircle2 size={15} />
						<span>{t.planB.guaranteeText}</span>
					</div>
				</div>
			</div>

			<button class="button button-primary plan-b-cta-btn" type="button" onclick={onSignup}>
				<span>{t.planB.ctaBtn}</span>
				<ArrowRight size={16} />
			</button>
		</div>
	</div>
</section>
