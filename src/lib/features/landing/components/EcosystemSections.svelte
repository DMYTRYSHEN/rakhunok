<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		ArrowDown,
		ArrowUpRight,
		Check,
		ChevronDown,
		Code2,
		Landmark,
		Search,
		Smartphone,
		Store,
		X
	} from '@lucide/svelte';
	import type { Locale } from '../data/translations';
	import type { BankDirectory } from '../data/bank-directory';
	import { ecosystemCopy } from '../data/ecosystem-copy';
	import { getBaselineCopy } from '../baseline/copy';
	import horecaImage from '../../../../../2.jpg';
	import retailImage from '../../../../../3.jpg';
	import servicesImage from '../../../../../4.jpg';
	import apiImage from '../../../../../1.jpg';

	let {
		locale,
		directory,
		onSignup,
		children
	}: { locale: Locale; directory: BankDirectory; onSignup: () => void; children: Snippet } =
		$props();
	let query = $state('');
	let failedLogos = $state<string[]>([]);
	let searchInput: HTMLInputElement;
	const copy = $derived(ecosystemCopy[locale]);
	const baseline = $derived(getBaselineCopy(locale));
	const filtered = $derived(
		directory.banks.filter((bank) =>
			`${bank.name} ${bank.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
		)
	);
	const icons = [Store, Smartphone, Code2];
	const images = [horecaImage, retailImage, servicesImage, apiImage];
</script>

<div class="ecosystem-content">
	<div class="bank-preview">
		<div class="eco-wrap bank-preview-inner">
			<a href="#banks"
				><Landmark size={20} aria-hidden="true" /><span
					>{copy.banksEyebrow}<strong>{directory.banks.length || '—'} {copy.count}</strong></span
				><ArrowDown size={18} aria-hidden="true" /></a
			>
			<div class="preview-names" aria-hidden="true">
				{#each directory.banks.slice(0, 5) as bank (bank.id)}<span>{bank.name.split(' (')[0]}</span
					>{/each}
			</div>
		</div>
	</div>

	<section id="ecosystem" class="eco-section">
		<div class="eco-wrap">
			<header class="section-intro">
				<h2>{copy.rolesTitle}</h2>
				<p>{copy.rolesIntro}</p>
			</header>
			<div class="role-grid">
				{#each copy.roles as role, index (role.product)}
					{@const Icon = icons[index]}
					<article class="role-column">
						<div class="role-top">
							<Icon size={26} strokeWidth={1.5} aria-hidden="true" /><span>{role.name}</span>
						</div>
						<h3>{role.title}</h3>
						<p>{role.text}</p>
						<a href={role.href.startsWith('#') ? resolve(`/${role.href}` as '/#top') : resolve('/docs/' as '/')}>{role.action}<ArrowUpRight size={18} aria-hidden="true" /></a>
						<span class="product-label">RAHUNOK {role.product}</span>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section id="banks" class="eco-section banks-section">
		<div class="eco-wrap">
			<header class="section-intro">
				<div>
					<p class="eyebrow">{copy.banksEyebrow}</p>
					<h2>{copy.banksTitle}</h2>
				</div>
				<p>{copy.banksIntro}</p>
			</header>
			<div class="bank-toolbar">
				<label class="bank-search"
					><Search size={20} aria-hidden="true" /><span class="sr-only">{copy.search}</span><input
						bind:this={searchInput}
						type="search"
						bind:value={query}
						placeholder={copy.search}
					/>
					{#if query}<button
							type="button"
							aria-label={copy.clear}
							title={copy.clear}
							onclick={() => {
								query = '';
								searchInput.focus();
							}}><X size={18} aria-hidden="true" /></button
						>{/if}
				</label>
				<p class="bank-count" role="status">{filtered.length} / {directory.banks.length}</p>
			</div>
			{#if directory.unavailable}<p role="status" class="empty-state">{copy.unavailable}</p>
			{:else if filtered.length === 0}<p role="status" class="empty-state">{copy.empty}</p>
			{:else}
				<ul class="bank-grid">
					{#each filtered as bank (bank.id)}
						<li>
							<div class="bank-logo">
								{#if bank.logo && !failedLogos.includes(bank.id)}<img
										src={bank.logo}
										alt=""
										width="48"
										height="48"
										loading="lazy"
										decoding="async"
										referrerpolicy="no-referrer"
										onerror={() => {
											failedLogos = [...failedLogos, bank.id];
										}}
									/>
								{:else}<Landmark size={26} strokeWidth={1.5} aria-hidden="true" />{/if}
							</div>
							<span>{bank.name}</span>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="bank-note">
				<p>{copy.banksNote}</p>
				<a href="https://bank-api.dmitrishen.workers.dev/v1/banks" target="_blank" rel="noreferrer"
					>{copy.source}<ArrowUpRight size={16} aria-hidden="true" /></a
				>
			</div>
		</div>
	</section>

	<section id="how-it-works" class="eco-section flow-section">
		<div class="eco-wrap">
			<header class="section-intro">
				<h2 id="money-flow">{copy.flowTitle}</h2>
				<p>{baseline.securityIntro}</p>
			</header>
			<ol class="flow-steps" id="payment-flow">
				{#each copy.flowSteps as step, index (step)}<li>
						<span>0{index + 1}</span>
						<h3>{step}</h3>
					</li>{/each}
			</ol>
			<p class="flow-note"><Check size={20} aria-hidden="true" />{copy.flowNote}</p>
		</div>
	</section>

	<section id="solutions" class="eco-section">
		<div class="eco-wrap">
			<header class="section-intro">
				<h2>{copy.casesTitle}</h2>
				<p>{copy.casesIntro}</p>
			</header>
			<div class="case-grid">
				{#each copy.cases as title, index (title)}<article>
						<img
							src={images[index]}
							alt={copy.caseAlt[index]}
							width="1024"
							height="1024"
							loading="lazy"
						/>
						<div>
							<span class="case-number">0{index + 1}</span>
							<h3>{title}</h3>
							<p>{copy.caseText[index]}</p>
						</div>
					</article>{/each}
			</div>
		</div>
	</section>

	{@render children()}

	<section id="faq" class="eco-section faq-section">
		<div class="eco-wrap faq-layout">
			<h2>{copy.faq}</h2>
			<div>
				{#each baseline.faq as item (item[0])}<details>
						<summary>{item[0]}<ChevronDown size={20} aria-hidden="true" /></summary>
						<p>{item[1]}</p>
					</details>{/each}
			</div>
		</div>
	</section>

	<section id="pricing" class="eco-section pilot-section">
		<div class="eco-wrap pilot-layout">
			<div>
				<p class="eyebrow">{copy.pilotLabel}</p>
				<h2>{copy.pilotTitle}</h2>
				<p>{copy.pilotText}</p>
			</div>
			<div>
				<span>{copy.pricing}</span><button type="button" onclick={onSignup}
					>{copy.primary}<ArrowUpRight size={20} aria-hidden="true" /></button
				>
			</div>
		</div>
	</section>
</div>

<style>
	.ecosystem-content {
		--eco-ink: var(--text-primary, #17251d);
		--eco-muted: var(--text-secondary, #4e5c55);
		color: var(--eco-ink);
		font-family: 'Manrope', sans-serif;
	}
	.ecosystem-content * {
		letter-spacing: 0;
		box-sizing: border-box;
	}
	.eco-wrap {
		width: min(1200px, calc(100% - 64px));
		margin-inline: auto;
	}
	.eco-section {
		padding-block: 88px;
		scroll-margin-top: 88px;
	}
	h2 {
		font-size: 44px;
		line-height: 1.15;
		font-weight: 700;
		text-wrap: balance;
		margin: 0;
		max-width: 680px;
	}
	h3 {
		font-size: 25px;
		line-height: 1.3;
		margin: 0;
		font-weight: 700;
	}
	p {
		font-size: 16px;
		line-height: 1.7;
		color: var(--eco-muted);
		margin: 0;
	}
	a,
	button {
		cursor: pointer;
	}
	a:focus-visible,
	button:focus-visible,
	input:focus-visible,
	summary:focus-visible {
		outline: 3px solid #357de1;
		outline-offset: 5px;
	}
	.section-intro {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 64px;
		align-items: end;
		margin-bottom: 48px;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 800;
		margin-bottom: 18px;
	}
	.bank-preview {
		border-bottom: 1px solid #81918440;
	}
	.bank-preview-inner {
		display: flex;
		align-items: center;
		gap: 48px;
		padding-block: 24px;
	}
	.bank-preview a {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
		font-size: 10px;
	}
	.bank-preview strong {
		display: block;
		margin-top: 4px;
		font-size: 13px;
	}
	.preview-names {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 28px;
		flex: 1;
		font-size: 16px;
		font-weight: 800;
	}
	.role-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 32px;
	}
	.role-column {
		border-top: 2px solid #17251d;
		padding-block: 24px 0;
		display: flex;
		flex-direction: column;
	}
	.role-column:nth-child(2) {
		border-color: #e54e66;
	}
	.role-column:nth-child(3) {
		border-color: #4e75bb;
	}
	.role-top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 32px;
		font-size: 14px;
		font-weight: 700;
	}
	.role-column p {
		margin: 20px 0 28px;
		font-size: 15px;
	}
	.role-column a {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		font-weight: 700;
		margin-top: auto;
		padding-block: 10px;
	}
	.product-label {
		margin-top: 32px;
		color: var(--eco-muted);
		font-size: 10px;
		font-weight: 700;
	}
	.banks-section {
		background: #eaf0ed;
		color: #17251d;
		--eco-muted: #4e5c55;
	}
	.bank-toolbar {
		display: flex;
		align-items: center;
		gap: 24px;
		justify-content: space-between;
		border-bottom: 1px solid #c6d3cb;
		padding-bottom: 24px;
		margin-bottom: 24px;
	}
	.bank-search {
		display: flex;
		align-items: center;
		gap: 12px;
		width: min(440px, 100%);
		background: white;
		border: 1px solid #a8b9ad;
		border-radius: 6px;
		padding: 6px 14px;
	}
	.bank-search input {
		min-width: 0;
		width: 100%;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: #17251d;
		font: inherit;
		min-height: 38px;
	}
	.bank-search button {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		background: transparent;
		color: #17251d;
		flex-shrink: 0;
	}
	.bank-count {
		flex-shrink: 0;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}
	.bank-grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 12px;
	}
	.bank-grid li {
		min-height: 128px;
		padding: 16px 10px;
		background: #fff;
		border: 1px solid #d7e0da;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}
	.bank-logo {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		color: #526b5d;
	}
	.bank-logo img {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		object-fit: contain;
	}
	.bank-grid li span {
		font-size: 12px;
		line-height: 1.4;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.bank-note {
		margin-top: 28px;
		display: flex;
		align-items: flex-start;
		gap: 48px;
	}
	.bank-note p {
		flex: 1;
		font-size: 12px;
	}
	.bank-note a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		text-decoration: underline;
		flex-shrink: 0;
	}
	.empty-state {
		padding: 40px 0;
	}
	.flow-section {
		background: #1c322c;
		color: #fff;
		--eco-muted: #d1ddd6;
	}
	.flow-steps {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 40px;
		list-style: none;
		padding: 0;
		margin: 56px 0 36px;
	}
	.flow-steps li {
		border-top: 1px solid #81998c;
		padding-top: 24px;
	}
	.flow-steps span {
		display: block;
		color: #d6fa69;
		font-size: 14px;
		margin-bottom: 24px;
	}
	.flow-note {
		display: flex;
		gap: 12px;
		font-size: 13px;
		max-width: 800px;
	}
	.flow-note :global(svg) {
		flex-shrink: 0;
		margin-top: 3px;
		color: #d6fa69;
	}
	.case-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 24px;
	}
	.case-grid img {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 6px;
	}
	.case-grid article > div {
		padding-top: 24px;
	}
	.case-number {
		font-size: 11px;
		color: var(--eco-muted);
		display: block;
		margin-bottom: 12px;
	}
	.case-grid h3 {
		font-size: 22px;
	}
	.case-grid p {
		font-size: 14px;
		margin-top: 12px;
	}
	.faq-section {
		border-top: 1px solid #81918440;
	}
	.faq-layout {
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		gap: 80px;
	}
	details {
		border-bottom: 1px solid #81918460;
	}
	summary {
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		cursor: pointer;
		padding: 24px 0;
		font-size: 16px;
		line-height: 1.5;
		font-weight: 700;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary :global(svg) {
		flex-shrink: 0;
		transition: transform 0.2s;
	}
	details[open] summary :global(svg) {
		transform: rotate(180deg);
	}
	details p {
		font-size: 14px;
		padding-bottom: 24px;
	}
	.pilot-section {
		background: #d6fa69;
		color: #17251d;
		--eco-muted: #344333;
	}
	.pilot-layout {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: 64px;
		align-items: center;
	}
	.pilot-layout p:not(.eyebrow) {
		margin-top: 24px;
		max-width: 650px;
	}
	.pilot-layout > div:last-child {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 20px;
	}
	.pilot-layout span {
		font-size: 13px;
	}
	.pilot-layout button {
		background: #17251d;
		color: white;
		min-height: 56px;
		padding: 16px 24px;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		font-size: 15px;
		font-weight: 700;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@media (max-width: 1100px) {
		.preview-names span:nth-child(n + 4) {
			display: none;
		}
		.bank-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.case-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 40px 24px;
		}
	}
	@media (max-width: 760px) {
		.eco-wrap {
			width: calc(100% - 40px);
		}
		.eco-section {
			padding-block: 56px;
		}
		h2 {
			font-size: 32px;
		}
		h3 {
			font-size: 24px;
		}
		.section-intro,
		.faq-layout,
		.pilot-layout {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.section-intro {
			margin-bottom: 32px;
		}
		.bank-preview-inner {
			gap: 20px;
			padding-block: 20px;
		}
		.preview-names {
			justify-content: flex-end;
			font-size: 13px;
		}
		.preview-names span:nth-child(n + 2) {
			display: none;
		}
		.role-grid {
			grid-template-columns: 1fr;
			gap: 36px;
		}
		.role-top {
			margin-bottom: 20px;
		}
		.role-column p {
			margin-block: 16px;
		}
		.product-label {
			margin-top: 18px;
		}
		.bank-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
		}
		.bank-grid li {
			padding: 14px 8px;
			min-height: 132px;
		}
		.bank-grid li span {
			font-size: 11px;
		}
		.bank-note {
			flex-direction: column;
			gap: 16px;
		}
		.bank-toolbar {
			gap: 12px;
		}
		.bank-count {
			font-size: 11px;
		}
		.flow-steps {
			grid-template-columns: 1fr;
			gap: 24px;
			margin-top: 32px;
		}
		.flow-steps li {
			display: flex;
			align-items: baseline;
			gap: 20px;
		}
		.flow-steps h3 {
			font-size: 22px;
		}
		.flow-steps span {
			margin: 0;
		}
		.case-grid {
			gap: 32px 16px;
		}
		.case-grid h3 {
			font-size: 19px;
		}
		.case-grid p {
			font-size: 13px;
		}
		.case-grid article > div {
			padding-top: 16px;
		}
	}
	@media (max-width: 360px) {
		.bank-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.preview-names {
			display: none;
		}
	}
</style>
