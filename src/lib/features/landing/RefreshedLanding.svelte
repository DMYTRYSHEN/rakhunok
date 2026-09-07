<script lang="ts">
	import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Coffee, Link, Menu, Moon, Receipt, ShieldCheck, Store, Sun, X } from '@lucide/svelte';
	import type { Locale } from './data/translations';
	import { refreshCopy } from './data/refresh-copy';
	import { compareMonthlyCosts } from './utils/cost-comparison';
	import './refresh.css';

	let { darkMode, onThemeToggle, locale = 'uk', onLocaleChange }: {
		darkMode: boolean; onThemeToggle: () => void; locale?: Locale; onLocaleChange?: (next: Locale) => void;
	} = $props();
	const c = $derived(refreshCopy[locale]);
	const anchors = ['payment-flow', 'solutions', 'pricing', 'faq'];
	const banks = ['monobank', 'Приват24', 'ПУМБ'];
	let menuOpen = $state(false);
	let bank = $state('monobank');
	let paid = $state(false);
	let turnover = $state<number | undefined>(300000);
	let currentRate = $state<number | undefined>(1.5);
	let rent = $state<number | undefined>(400);
	let fee = $state<number | undefined>();
	let rate = $state<number | undefined>();
	const costs = $derived(compareMonthlyCosts(turnover, currentRate, rent, fee, rate));
	const formatter = $derived(new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : locale === 'pl' ? 'pl-PL' : 'en-GB', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }));
	function closeMenu() { menuOpen = false; }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') closeMenu(); }} />

<div class="refresh" class:night={darkMode}>
	<a class="skip-link" href="#main-content">{c.skip}</a>
	<header class="refresh-header">
		<div class="wrap header-row">
			<a class="wordmark" href="#top" aria-label="Rahunok"><span class="brand-mark" aria-hidden="true">R</span>Rahunok<span class="brand-period">.</span></a>
			<nav class="wide-nav" aria-label={c.menu}>
				{#each c.nav as label, i (anchors[i])}<a href={'#' + anchors[i]}>{label}</a>{/each}
			</nav>
			<div class="header-tools">
				<select aria-label={c.language} value={locale} onchange={(event) => onLocaleChange?.(event.currentTarget.value as Locale)}><option value="uk">UA</option><option value="en">EN</option><option value="pl">PL</option></select>
				<button class="icon-button" type="button" onclick={onThemeToggle} aria-label={c.theme} aria-pressed={darkMode}>{#if darkMode}<Sun size={18} />{:else}<Moon size={18} />{/if}</button>
				<a class="header-login" href="/dashboard/">{c.login}<ArrowUpRight size={15} /></a>
				<button class="icon-button mobile-toggle" type="button" aria-label={c.menu} aria-expanded={menuOpen} aria-controls="mobile-navigation" onclick={() => menuOpen = !menuOpen}>{#if menuOpen}<X size={20} />{:else}<Menu size={20} />{/if}</button>
			</div>
		</div>
		<nav id="mobile-navigation" class="mobile-nav" hidden={!menuOpen} aria-label={c.menu}>
			{#each c.nav as label, i (anchors[i])}<a href={'#' + anchors[i]} onclick={closeMenu}>{label}</a>{/each}
			<a href="/dashboard/">{c.login} ↗</a>
		</nav>
	</header>

	<main id="main-content">
		<section class="hero-refresh wrap" id="top" aria-labelledby="main-title">
			<div class="hero-text">
				<p class="kicker"><span class="status-dot"></span>{c.eyebrow}</p>
				<h1 id="main-title">{c.title}<br /><span>{c.accent}</span></h1>
				<p class="hero-intro">{c.intro}</p>
				<div class="actions"><a class="btn primary" href="/dashboard/">{c.start}<ArrowUpRight size={18} /></a><a class="btn secondary" href="#demo">{c.demo}<ArrowRight size={18} /></a></div>
				<p class="hero-reassurance">{c.reassurance}</p>
				<div class="hero-chips">{#each c.chips as chip (chip)}<span><Check size={14} />{chip}</span>{/each}</div>
			</div>
			<div class="demo-stage" id="demo">
				<div class="demo-heading"><span class="kicker">{c.demoLabel}</span><span class="demo-index" aria-hidden="true">{paid ? '02' : '01'} / 02</span></div>
				<div class="checkout-card">
					<div class="checkout-brand"><span class="coffee-icon"><Coffee size={24} /></span><div><strong>{c.merchant}</strong><span>Rahunok Pay</span></div><ShieldCheck size={20} /></div>
					<div class="amount-block"><p>{c.order}</p><strong>{c.amount}</strong><span>{c.demoNote}</span></div>
					{#if !paid}
						<fieldset class="bank-picker"><legend>{c.bankLabel}</legend><div class="bank-options">{#each banks as name, i (name)}<label class:selected={bank === name}><input type="radio" name="demo-bank" value={name} bind:group={bank} /><span class="bank-monogram" class:green={i === 1} class:red={i === 2} aria-hidden="true">{i === 0 ? 'm' : 'п'}</span><span>{name}</span></label>{/each}</div></fieldset>
						<button class="btn primary pay-button" type="button" onclick={() => paid = true}>{c.pay}<ArrowRight size={18} /></button>
					{:else}
						<div class="demo-success"><CheckCheck size={30} /><strong>{c.paid}</strong><p>{c.paidNote}</p><button class="reset-button" type="button" onclick={() => paid = false}>{c.reset}<ArrowRight size={15} /></button></div>
					{/if}
				</div>
				<div class="merchant-update"><span class="receipt-icon"><Receipt size={21} /></span><div><span>{c.activity}</span><strong>{c.order}</strong></div><span class="payment-status" class:confirmed={paid} role="status">{paid ? c.received : c.waiting}</span></div>
				<p class="demo-help">{c.demoHelp}</p>
			</div>
		</section>

		<section class="section wrap steps-section" id="payment-flow" aria-labelledby="steps-title">
			<p class="kicker">{c.stepsLabel}</p><h2 id="steps-title">{c.stepsTitle}</h2>
			<div class="three-grid steps-grid">{#each c.steps as step, i (step[0])}<article><span class="step-number">0{i + 1}</span><h3>{step[0]}</h3><p>{step[1]}</p></article>{/each}</div>
		</section>

		<section class="section tinted" id="solutions" aria-labelledby="solutions-title"><div class="wrap">
			<p class="kicker">{c.solutionsLabel}</p><h2 id="solutions-title">{c.solutionsTitle}</h2>
			<div class="three-grid solution-grid">{#each c.solutions as item, i (item[0])}<article class="solution-card"><span class="solution-icon">{#if i === 0}<Store size={26} />{:else if i === 1}<Link size={26} />{:else}<Coffee size={26} />{/if}</span><h3>{item[0]}</h3><p>{item[1]}</p><span class="solution-tag">{item[2]}<ArrowUpRight size={15} /></span></article>{/each}</div>
		</div></section>

		<section class="section wrap" id="pricing" aria-labelledby="pricing-title">
			<div class="section-heading"><div><p class="kicker">{c.pricingLabel}</p><h2 id="pricing-title">{c.pricingTitle}</h2></div><p>{c.pricingIntro}</p></div>
			<div class="three-grid pricing-grid">{#each c.plans as plan, i (plan[0])}<article class="price-card" class:featured={i === 1}><div class="plan-heading"><h3>{plan[0]}</h3>{#if i === 1}<span aria-hidden="true">↗</span>{/if}</div><p>{plan[2]}</p><strong class="plan-price">{plan[1]}</strong><p class="plan-features">{plan[3]}</p></article>{/each}</div>
			<p class="fine-print">{c.planNote}</p>
			<div class="calculator-card" id="calculator">
				<div class="calculator-intro"><h3>{c.calculator}</h3><p>{c.calcIntro}</p></div>
				<div class="calculator-fields"><label>{c.turnover}<input type="number" min="0" step="1000" bind:value={turnover} /></label><label>{c.currentRate}<input type="number" min="0" max="100" step="0.01" bind:value={currentRate} /></label><label>{c.rent}<input type="number" min="0" step="1" bind:value={rent} /></label><label>{c.fee}<input type="number" min="0" step="1" placeholder="—" bind:value={fee} /></label><label>{c.rate}<input type="number" min="0" max="100" step="0.01" placeholder="—" bind:value={rate} /></label></div>
				<div class="calculation-result" aria-live="polite">{#if costs}<div><span>{c.now}</span><strong>{formatter.format(costs.current)}</strong></div><div><span>{c.after}</span><strong>{formatter.format(costs.proposed)}</strong></div><div class="difference"><span>{c.difference}</span><strong>{formatter.format(costs.difference)}</strong></div>{:else}<p>{c.incomplete}</p>{/if}</div>
				<p class="fine-print">{c.calcNote}</p>
			</div>
		</section>

		<section class="section trust-section" id="money-flow" aria-labelledby="trust-title"><div class="wrap"><p class="kicker">{c.trustLabel}</p><h2 id="trust-title">{c.trustTitle}</h2><div class="three-grid">{#each c.trust as item (item[0])}<article><ShieldCheck size={25} /><h3>{item[0]}</h3><p>{item[1]}</p></article>{/each}</div></div></section>

		<section class="section wrap faq-section" id="faq" aria-labelledby="faq-title"><div><p class="kicker">FAQ</p><h2 id="faq-title">{c.faqTitle}</h2></div><div class="faq-list">{#each c.faq as item (item[0])}<details><summary>{item[0]}<ChevronDown size={19} /></summary><p>{item[1]}</p></details>{/each}</div></section>

		<section class="wrap final-section"><div class="final-card"><div><p class="kicker">RAHUNOK</p><h2>{c.finalTitle}</h2><p>{c.finalText}</p></div><div class="final-action"><a class="btn primary" href="/dashboard/">{c.start}<ArrowUpRight size={18} /></a><span>{c.finalNote}</span></div></div></section>
	</main>
	<footer class="wrap refresh-footer"><div><a class="wordmark" href="#top">Rahunok<span class="brand-period">.</span></a><p>{c.footer}</p></div><p>{c.footerNote}</p><a href="/dashboard/">{c.login}<ArrowUpRight size={16} /></a></footer>
</div>