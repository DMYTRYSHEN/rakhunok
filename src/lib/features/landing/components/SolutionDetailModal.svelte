<script lang="ts">
	import { tick } from 'svelte';
	import {
		X,
		Check,
		ArrowRight,
		QrCode,
		Split,
		ReceiptText,
		Server,
		SmartphoneNfc,
		ShieldCheck,
		Layers,
		Link as LinkIcon,
		Bot,
		Send,
		Webhook,
		Smartphone,
		Building2,
		Sparkles,
		Zap,
		Coffee,
		ShoppingBag
	} from '@lucide/svelte';
	import horecaWorkflowImg from '$lib/assets/horeca_workflow.jpg';
	import retailWorkflowImg from '$lib/assets/retail_workflow.jpg';
	import servicesWorkflowImg from '$lib/assets/services_workflow.jpg';
	import apiWorkflowImg from '$lib/assets/api_workflow.jpg';
	import type { Translations, SolutionModalData } from '../data/translations';

	let {
		open = $bindable(false),
		solutionIndex = $bindable(0),
		onSignup,
		t
	}: {
		open: boolean;
		solutionIndex: number;
		onSignup: () => void;
		t: Translations;
	} = $props();

	let modalCard = $state<HTMLDivElement>();
	let previousFocus: HTMLElement | null = null;

	const workflowImages = [
		{
			src: horecaWorkflowImg,
			alt: 'Сценарій оплати за столиком HoReCa',
			badge: 'Live HoReCa Flow',
			chips: [
				{ icon: Coffee, text: 'Стіл 12 · 850 ₴', type: 'primary' },
				{ icon: Split, text: 'Split Bill (2/4 оплачено)', type: 'accent' },
				{ icon: ReceiptText, text: 'Чайові 10% → IBAN офіціанта', type: 'success' },
				{ icon: Server, text: 'Poster POS: Стіл закрито ✓', type: 'success' }
			]
		},
		{
			src: retailWorkflowImg,
			alt: 'Сценарій безтермінальної каси Retail',
			badge: 'Live Retail POS Flow',
			chips: [
				{ icon: ShoppingBag, text: 'Каса #1 · 850 ₴', type: 'primary' },
				{ icon: QrCode, text: 'Динамічний QR на касі', type: 'accent' },
				{ icon: ShieldCheck, text: 'SUCCESS · СЕП 24/7', type: 'success' },
				{ icon: SmartphoneNfc, text: 'ПРРО: Фіскальний чек видано ✓', type: 'success' }
			]
		},
		{
			src: servicesWorkflowImg,
			alt: 'Сценарій платіжних посилань Digital Services',
			badge: 'Live PayLink Flow',
			chips: [
				{ icon: LinkIcon, text: 'pay.rahunok.app/link', type: 'primary' },
				{ icon: Smartphone, text: '1-Click FaceID у банку', type: 'accent' },
				{ icon: Bot, text: 'KeyCRM: Оплачено', type: 'success' },
				{ icon: Send, text: 'Нова Пошта: ТТН створено ✓', type: 'success' }
			]
		},
		{
			src: apiWorkflowImg,
			alt: 'Сценарій Open Banking API Gateway',
			badge: 'Live Enterprise Gateway Flow',
			chips: [
				{ icon: Building2, text: 'Open Banking Direct Gateway', type: 'primary' },
				{ icon: Zap, text: '50 000 TPS · Latency: 118ms', type: 'accent' },
				{ icon: Split, text: 'Marketplace Multi-IBAN Split', type: 'success' },
				{ icon: Webhook, text: 'Webhook: 200 OK Settled ✓', type: 'success' }
			]
		}
	];

	const activeModalData = $derived<SolutionModalData | undefined>(
		t.productSections.solutionModals?.[solutionIndex] ?? t.productSections.solutionModals?.[0]
	);

	const solutionTabs = $derived(
		t.productSections.solutionModals?.map((item, idx) => ({
			index: idx,
			id: item.id,
			label: item.indexLabel,
			tag: item.tag
		})) ?? []
	);

	function getIconComponent(iconName: string) {
		switch (iconName) {
			case 'QrCode':
				return QrCode;
			case 'Split':
				return Split;
			case 'ReceiptText':
				return ReceiptText;
			case 'Server':
				return Server;
			case 'SmartphoneNfc':
				return SmartphoneNfc;
			case 'ShieldCheck':
				return ShieldCheck;
			case 'Layers':
				return Layers;
			case 'Link':
				return LinkIcon;
			case 'Bot':
				return Bot;
			case 'Send':
				return Send;
			case 'Webhook':
				return Webhook;
			case 'Smartphone':
				return Smartphone;
			case 'Building2':
				return Building2;
			case 'Coffee':
				return Coffee;
			case 'ShoppingBag':
				return ShoppingBag;
			default:
				return Zap;
		}
	}

	async function close() {
		open = false;
		document.body.classList.remove('modal-open');
		await tick();
		previousFocus?.focus();
	}

	function switchTab(index: number) {
		solutionIndex = index;
		if (modalCard) {
			modalCard.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function handleCta() {
		close();
		onSignup();
	}

	$effect(() => {
		if (!open) return;
		previousFocus = document.activeElement as HTMLElement | null;
		document.body.classList.add('modal-open');
		if (modalCard) {
			modalCard.scrollTo({ top: 0 });
		}
		return () => document.body.classList.remove('modal-open');
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (!open) return;
		if (event.key === 'Escape') close();
		if (event.key === 'ArrowRight' && solutionIndex < 3) switchTab(solutionIndex + 1);
		if (event.key === 'ArrowLeft' && solutionIndex > 0) switchTab(solutionIndex - 1);
	}}
/>

{#if open && activeModalData}
	<div
		class="apple-modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="solution-modal-title"
	>
		<button class="apple-modal-backdrop" type="button" aria-label="Закрити вікно" onclick={close}
		></button>

		<div class="apple-modal-window" bind:this={modalCard}>
			<!-- Sticky Apple-grade Header Bar -->
			<header class="apple-modal-header">
				<div class="apple-modal-nav">
					{#each solutionTabs as tab}
						<button
							class="apple-nav-pill"
							class:active={solutionIndex === tab.index}
							type="button"
							onclick={() => switchTab(tab.index)}
						>
							<span class="pill-num">{tab.label}</span>
							<span class="pill-title">{tab.tag}</span>
						</button>
					{/each}
				</div>

				<button class="apple-close-circle" type="button" aria-label="Закрити" onclick={close}>
					<X size={18} />
				</button>
			</header>

			<!-- Modal Body (Apple Style Mini-Landing) -->
			<div class="apple-modal-content">
				<!-- Hero Section -->
				<section class="solution-hero-block">
					<div class="solution-badge-row">
						<span class="solution-category-tag">{activeModalData.tag}</span>
						<span class="solution-badge-pill">{activeModalData.badge}</span>
					</div>

					<h2 id="solution-modal-title" class="solution-hero-title">
						{activeModalData.heroTitle}
					</h2>

					<p class="solution-hero-subtitle">
						{activeModalData.heroSubtitle}
					</p>

					<div class="solution-highlight-banner">
						<div class="highlight-icon-glow">
							<Sparkles size={16} />
						</div>
						<span>{activeModalData.heroHighlight}</span>
					</div>
				</section>

				<!-- Visual Workflow Hero Banner with Glass Overlays -->
				{#if workflowImages[solutionIndex]}
					{@const currentImg = workflowImages[solutionIndex]}
					<div class="solution-workflow-visual-card">
						<div class="visual-img-container">
							<img
								src={currentImg.src}
								alt={currentImg.alt}
								class="workflow-showcase-img"
								loading="eager"
							/>
							<div class="visual-gradient-vignette"></div>
						</div>

						<div class="visual-glass-overlay">
							<div class="visual-top-badge">
								<span class="pulse-dot"></span>
								<span>{currentImg.badge}</span>
							</div>

							<div class="visual-chips-container">
								{#each currentImg.chips as chip}
									{@const ChipIcon = chip.icon}
									<div class="visual-status-chip {chip.type}">
										<ChipIcon size={14} />
										<span>{chip.text}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Metrics Strip -->
				<section class="solution-metrics-grid">
					{#each activeModalData.metrics as metric}
						<div class="solution-metric-card">
							<b class="metric-val">{metric.value}</b>
							<strong class="metric-lbl">{metric.label}</strong>
							{#if metric.sub}
								<small class="metric-sub">{metric.sub}</small>
							{/if}
						</div>
					{/each}
				</section>

				<!-- 4 Key Capabilities (Bento Showcase) -->
				<section class="solution-features-section">
					<div class="section-title-wrap">
						<small class="section-eyebrow">Можливості та сценарії</small>
						<h3 class="section-heading">Як Rahunok трансформує прийом платежів</h3>
					</div>

					<div class="solution-bento-grid">
						{#each activeModalData.highlights as feat}
							{@const IconComp = getIconComponent(feat.icon)}
							<div class="solution-bento-card">
								<div class="bento-card-top">
									<div class="bento-icon-box">
										<IconComp size={22} />
									</div>
									{#if feat.tag}
										<span class="bento-tag">{feat.tag}</span>
									{/if}
								</div>
								<h4>{feat.title}</h4>
								<p>{feat.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<!-- Direct Comparison Table vs Monobank -->
				<section class="solution-comparison-section">
					<div class="section-title-wrap">
						<small class="section-eyebrow">Пряме порівняння</small>
						<h3 class="section-heading">{activeModalData.comparison.title}</h3>
						<p class="section-desc">{activeModalData.comparison.desc}</p>
					</div>

					<div class="solution-table-wrapper">
						<table class="solution-compare-table">
							<thead>
								<tr>
									<th>{activeModalData.comparison.headers[0]}</th>
									<th>{activeModalData.comparison.headers[1]}</th>
									<th class="col-rahunok">{activeModalData.comparison.headers[2]}</th>
								</tr>
							</thead>
							<tbody>
								{#each activeModalData.comparison.rows as row}
									<tr>
										<td class="cell-feature">
											<strong>{row.feature}</strong>
										</td>
										<td class="cell-competitor">
											<span class="competitor-text">{row.competitor}</span>
										</td>
										<td class="cell-rahunok">
											<div class="rahunok-value-wrap">
												<div class="rahunok-check-icon">
													<Check size={14} />
												</div>
												<span>{row.rahunok}</span>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>

				<!-- Interactive 3-Step Workflow -->
				<section class="solution-workflow-section">
					<div class="section-title-wrap">
						<small class="section-eyebrow">Процес взаємодії</small>
						<h3 class="section-heading">{activeModalData.workflow.title}</h3>
					</div>

					<div class="solution-steps-grid">
						{#each activeModalData.workflow.steps as step}
							<div class="solution-step-item">
								<div class="step-badge">{step.step}</div>
								<h5>{step.title}</h5>
								<p>{step.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<!-- Bottom CTA Banner -->
				<section class="solution-cta-card">
					<div class="cta-inner-text">
						<h3>{activeModalData.cta.title}</h3>
						<p>{activeModalData.cta.desc}</p>
					</div>
					<button class="button button-primary apple-cta-btn" type="button" onclick={handleCta}>
						<span>{activeModalData.cta.btn}</span>
						<ArrowRight size={16} />
					</button>
				</section>
			</div>
		</div>
	</div>
{/if}
