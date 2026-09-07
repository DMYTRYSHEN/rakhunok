<script lang="ts">
	import {
		ArrowRight,
		ArrowUpRight,
		AudioLines,
		Bot,
		Check,
		ChevronDown,
		Code2,
		Coffee,
		Command,
		Layers3,
		Link2,
		Menu,
		Moon,
		Pause,
		Play,
		QrCode,
		ReceiptText,
		ShieldCheck,
		SmartphoneNfc,
		Sun,
		Wifi,
		X,
		ChartNoAxesCombined,
		Radio
	} from '@lucide/svelte';
	import type { Locale } from './data/translations';
	import { refreshCopy } from './data/refresh-copy';
	import { studioCopy, getStudioFaq } from './data/studio-copy';
	import AmbientField from './studio/AmbientField.svelte';
	import ProductExperience from './studio/ProductExperience.svelte';
	import FinancialStudio from './studio/FinancialStudio.svelte';
	import horeca from '../../../../2.jpg';
	import retail from '../../../../3.jpg';
	import services from '../../../../4.jpg';
	import online from '../../../../1.jpg';
	import './studio.css';
	let {
		darkMode,
		onThemeToggle,
		locale = 'uk',
		onLocaleChange
	}: {
		darkMode: boolean;
		onThemeToggle: () => void;
		locale?: Locale;
		onLocaleChange?: (locale: Locale) => void;
	} = $props();
	const c = $derived(studioCopy[locale]);
	const r = $derived(refreshCopy[locale]);
	const faq = $derived(getStudioFaq(locale));
	let menu = $state(false);
	function closeMenu(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !menu) return;
		const toggle = document.querySelector<HTMLButtonElement>(
			'[aria-controls="studio-mobile-menu"]'
		);
		menu = false;
		toggle?.focus();
	}
	let paused = $state(false);
	let capability = $state(0);
	let scenario = $state(0);
	const activeFeature = $derived(c.features[capability]);
	const activeCase = $derived(c.cases[scenario]);
	const icons = [QrCode, SmartphoneNfc, Link2, Radio, ReceiptText, ChartNoAxesCombined, Bot, Code2];
	const photos = [horeca, retail, services, online];
	const anchors = ['product', 'features', 'solutions', 'calculator'];
</script>

<svelte:window onkeydown={closeMenu} />

<div class="studio" class:studio-dark={darkMode} class:motion-paused={paused}>
	<AmbientField {paused} />
	<a class="studio-skip" href="#studio-main">{r.skip}</a>
	<header class="studio-header">
		<div class="studio-nav studio-wrap">
			<a href="#top" class="studio-brand" aria-label="Rahunok"
				><svg width="29" height="31" viewBox="0 0 208 221" fill="currentColor" aria-hidden="true"
					><path
						d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903Z"
					/></svg
				><span>Rahunok</span></a
			>
			<nav class="studio-desktop-nav" aria-label={r.menu}>
				{#each c.nav as label, i (anchors[i])}<a href={'#' + anchors[i]}>{label}</a>{/each}
			</nav>
			<div class="studio-tools">
				<select
					aria-label={r.language}
					value={locale}
					onchange={(event) => onLocaleChange?.(event.currentTarget.value as Locale)}
					><option value="uk">UA</option><option value="en">EN</option><option value="pl">PL</option
					></select
				><button
					type="button"
					class="studio-icon"
					aria-label={r.theme}
					aria-pressed={darkMode}
					onclick={onThemeToggle}
					>{#if darkMode}<Sun size={17} />{:else}<Moon size={17} />{/if}</button
				><a class="nav-dashboard" href="/dashboard/">{r.login}<ArrowUpRight size={15} /></a><button
					type="button"
					class="studio-icon studio-menu"
					aria-label={r.menu}
					aria-expanded={menu}
					aria-controls="studio-mobile-menu"
					onclick={() => (menu = !menu)}
					>{#if menu}<X size={21} />{:else}<Menu size={21} />{/if}</button
				>
			</div>
		</div>
		<nav id="studio-mobile-menu" class="studio-mobile-nav" hidden={!menu} aria-label={r.menu}>
			{#each c.nav as label, i (anchors[i])}<a
					href={'#' + anchors[i]}
					onclick={() => (menu = false)}>{label}</a
				>{/each}<a href="/dashboard/">{r.login} ↗</a>
		</nav>
	</header>
	<main id="studio-main">
		<section class="studio-hero studio-wrap" id="top">
			<div class="hero-orbit-label"><span></span>{c.eyebrow}<ArrowUpRight size={12} /></div>
			<h1>{c.title}<br /><span>{c.accent}</span></h1>
			<p class="studio-hero-description">{c.intro}</p>
			<div class="studio-actions">
				<a class="studio-button button-dark" href="/dashboard/"
					>{r.start}<ArrowUpRight size={17} /></a
				><a class="studio-button button-glass" href="#demo"><Play size={14} />{r.demo}</a>
			</div>
			<div class="hero-foundations">
				<span><QrCode size={14} />QR & NFC</span><span><Link2 size={14} />Payment links</span><span
					><Layers3 size={14} />Business workspace</span
				>
			</div>
			<div class="hero-product"><ProductExperience {locale} /></div>
			<button
				type="button"
				class="motion-control"
				aria-pressed={!paused}
				onclick={() => (paused = !paused)}
				>{#if paused}<Play size={12} />{:else}<Pause size={12} />{/if}{c.motion}</button
			>
		</section>
		<div class="studio-wrap">
			<section class="product-principles" id="product" aria-labelledby="product-title">
				<div>
					<p class="studio-eyebrow">01 / DESIGNED AROUND THE PAYMENT</p>
					<h2 id="product-title">{c.product}</h2>
					<p>{c.productText}</p>
				</div>
				<div class="principle-steps">
					{#each r.steps as step, i (step[0])}<article>
							<span>0{i + 1}</span>
							<div>
								<h3>{step[0]}</h3>
								<p>{step[1]}</p>
							</div>
							<ArrowRight size={16} />
						</article>{/each}
				</div>
			</section>
			<section class="studio-section" id="features" aria-labelledby="ecosystem-title">
				<div class="section-intro">
					<p class="studio-eyebrow">02 / ONE CONNECTED SYSTEM</p>
					<h2 id="ecosystem-title">{c.ecosystem}<br /><span>{c.ecosystemAccent}</span></h2>
					<p>{c.ecosystemText}</p>
				</div>
				<div class="ecosystem-workspace glass-panel">
					<div class="ecosystem-map">
						<div class="ecosystem-orbits" aria-hidden="true"><i></i><i></i></div>
						<div class="ecosystem-core" aria-hidden="true">
							<Layers3 size={33} /><strong>Rahunok</strong><span>PAYMENT OS</span>
						</div>
						<div class="ecosystem-nodes" aria-label={c.ecosystem}>
							{#each c.features as feature, i (feature[0])}{@const Icon = icons[i]}<button
									type="button"
									class:active={capability === i}
									aria-pressed={capability === i}
									aria-controls="capability-detail"
									onclick={() => (capability = i)}
									style={`--node:${i}`}><Icon size={23} /><span>{feature[0]}</span></button
								>{/each}
						</div>
					</div>
					<div class="ecosystem-detail" id="capability-detail" aria-live="polite">
						<span class="feature-number">0{capability + 1} / 08</span>
						<p class="studio-eyebrow">{activeFeature[0]}</p>
						<h3>{activeFeature[1]}</h3>
						<p>{activeFeature[2]}</p>
						<div class="feature-flow">
							<span>{c.selected}</span><strong>{activeFeature[3]}</strong>
						</div>
						<p class="studio-note">{c.connection}</p>
					</div>
				</div>
			</section>
			<section class="studio-section" id="solutions" aria-labelledby="solutions-title">
				<div class="section-intro">
					<p class="studio-eyebrow">03 / BUILT FOR YOUR EVERYDAY</p>
					<h2 id="solutions-title">{c.solutions}</h2>
					<p>{c.solutionsText}</p>
				</div>
				<div class="solution-selector" aria-label={c.solutions}>
					{#each c.cases as item, i (item[0])}<button
							type="button"
							aria-pressed={scenario === i}
							aria-controls="scenario-detail"
							class:active={scenario === i}
							onclick={() => (scenario = i)}
							><span>0{i + 1}</span>{item[0]}<ArrowUpRight size={16} /></button
						>{/each}
				</div>
				<div class="scenario-workspace glass-panel" id="scenario-detail">
					<div class="scenario-photo">
						<img src={photos[scenario]} alt={activeCase[0]} loading="lazy" />
						<div class="photo-shade"></div>
						<span class="scenario-category">RAHUNOK FOR {activeCase[0].toUpperCase()}</span>
						<div class="scenario-overlay">
							<span class="scenario-overlay-icon"
								>{#if scenario === 3}<Code2 size={23} />{:else if scenario === 2}<Link2
										size={23}
									/>{:else}<QrCode size={23} />{/if}</span
							>
							<div>
								<strong
									>{scenario === 0
										? 'Table 12'
										: scenario === 1
											? 'Checkout 01'
											: scenario === 2
												? 'Payment link'
												: 'API / Webhooks'}</strong
								><span>{c.demoData}</span>
							</div>
							<Check size={18} />
						</div>
					</div>
					<div class="scenario-copy" aria-live="polite">
						<span class="studio-eyebrow">{activeCase[0]}</span>
						<h3>{activeCase[1]}</h3>
						<p>{activeCase[2]}</p>
						<ol>
							{#each activeCase.slice(3) as step, i (step)}<li>
									<span>0{i + 1}</span>{step}
								</li>{/each}
						</ol>
						<a href="/dashboard/" class="studio-text-link">{r.start}<ArrowUpRight size={17} /></a>
					</div>
				</div>
				<div class="plan-b-strip">
					<span class="plan-b-icon"><Wifi size={24} /></span>
					<div>
						<h3>{c.planB}</h3>
						<p>{c.planBText}</p>
					</div>
					<a href="#demo" aria-label={r.demo}><ArrowUpRight size={22} /></a>
				</div>
			</section>
			<FinancialStudio {locale} />
			<section class="studio-section" id="pricing" aria-labelledby="pricing-title">
				<div class="section-intro">
					<p class="studio-eyebrow">05 / ROOM TO GROW</p>
					<h2 id="pricing-title">{r.pricingTitle}</h2>
					<p>{r.pricingIntro}</p>
				</div>
				<div class="studio-pricing">
					{#each r.plans as plan, i (plan[0])}<article class:pricing-featured={i === 1}>
							<div class="plan-label">
								<span>{plan[0]}</span>{#if i === 1}<Layers3 size={19} />{:else}<ArrowUpRight
										size={19}
									/>{/if}
							</div>
							<p>{plan[2]}</p>
							<h3>{plan[1]}</h3>
							<div class="plan-feature-list">
								{#each plan[3].split(' · ') as feature (feature)}<span
										><Check size={15} />{feature}</span
									>{/each}
							</div>
							<a
								href="/dashboard/"
								class="studio-button"
								class:button-dark={i === 1}
								class:button-glass={i !== 1}>{r.start}<ArrowRight size={15} /></a
							>
						</article>{/each}
				</div>
				<p class="studio-note pricing-note">{r.planNote}</p>
			</section>
			<section class="studio-trust" id="money-flow">
				<div class="trust-heading">
					<ShieldCheck size={29} />
					<h2>{r.trustTitle}</h2>
				</div>
				<div>
					{#each r.trust as item (item[0])}<article>
							<h3>{item[0]}</h3>
							<p>{item[1]}</p>
						</article>{/each}
				</div>
			</section>
			<section class="studio-section studio-faq" id="faq" aria-labelledby="faq-title">
				<div>
					<p class="studio-eyebrow">06 / THE DETAILS MATTER</p>
					<h2 id="faq-title">{c.faq}</h2>
					<p>{c.faqText}</p>
					<span class="faq-count">12 / FAQ</span>
				</div>
				<div class="studio-faq-list">
					{#each faq as item, i (item[0])}<details>
							<summary
								><span>{String(i + 1).padStart(2, '0')}</span>{item[0]}<ChevronDown
									size={18}
								/></summary
							>
							<p>{item[1]}</p>
						</details>{/each}
				</div>
			</section>
			<section class="studio-finale">
				<div class="finale-orb" aria-hidden="true"><Layers3 size={40} /></div>
				<p class="studio-eyebrow">MADE FOR WHAT'S NEXT</p>
				<h2>{c.final}</h2>
				<p>{c.finalText}</p>
				<a href="/dashboard/" class="studio-button button-dark"
					>{r.start}<ArrowUpRight size={18} /></a
				><span class="studio-note">{r.finalNote}</span>
			</section>
			<footer class="studio-footer">
				<a href="#top" class="studio-brand">Rahunok<span>®</span></a>
				<p>{r.footer}<br /><span>{r.footerNote}</span></p>
				<div>
					<a href="#pricing">{r.nav[2]}</a><a href="#faq">FAQ</a><a href="/dashboard/"
						>{r.login}<ArrowUpRight size={13} /></a
					>
				</div>
				<span class="footer-year">© {new Date().getFullYear()} Rahunok</span>
			</footer>
		</div>
	</main>
</div>
