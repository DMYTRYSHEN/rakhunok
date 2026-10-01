<script lang="ts">
	import { ArrowDown, ArrowRight, ArrowUpRight } from '@lucide/svelte';
	import heroImage from '../../../../../1.jpg';
	import type { Locale } from '../data/translations';
	import { ecosystemCopy } from '../data/ecosystem-copy';
	let { onSignup, locale }: { onSignup: () => void; locale: Locale } = $props();
	const copy = $derived(ecosystemCopy[locale]);
</script>

<section class="editorial-hero" aria-labelledby="hero-title">
	<img class="editorial-photo" src={heroImage} alt="" fetchpriority="high" />
	<div class="editorial-scrim" aria-hidden="true"></div>
	<div class="editorial-content container">
		<p class="editorial-label">{copy.eyebrow}</p>
		<h1 id="hero-title">Rahunok<span>.</span></h1>
		<p class="editorial-statement">{copy.headline}</p>
		<p class="editorial-description">{copy.intro}</p>
		<div class="editorial-actions">
			<button type="button" onclick={onSignup}
				>{copy.primary}<ArrowUpRight size={20} aria-hidden="true" /></button
			>
			<a href="#banks">{copy.secondary}<ArrowDown size={18} aria-hidden="true" /></a>
		</div>
	</div>
	<div class="editorial-bottom container">
		<ol aria-label={copy.flowTitle}>
			{#each copy.heroJourney as step, index (step)}
				<li><span class="step-number">0{index + 1}</span><span>{step}</span>{#if index < 2}<ArrowRight size={16} aria-hidden="true" />{/if}</li>
			{/each}
		</ol>
		<a href="#ecosystem" aria-label={copy.rolesTitle} title={copy.rolesTitle}><ArrowDown size={22} aria-hidden="true" /></a>
	</div>
</section>

<style>
	.editorial-hero {
		position: relative;
		isolation: isolate;
		min-height: 570px;
		height: min(740px, calc(100svh - 145px));
		color: #192421;
		background: #f3f5f4;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
	}
	.editorial-photo,
	.editorial-scrim {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
	}
	.editorial-photo {
		object-fit: cover;
		object-position: center 56%;
	}
	.editorial-scrim {
		background: linear-gradient(
			90deg,
			rgb(248 250 249 / 98%),
			rgb(248 250 249 / 95%) 31%,
			rgb(248 250 249 / 10%) 75%
		);
	}
	.editorial-content {
		padding-block: 48px 128px;
		animation: hero-arrive 700ms ease-out both;
	}
	.editorial-label {
		font-size: 11px;
		font-weight: 700;
		margin: 0 0 26px;
		letter-spacing: 0;
	}
	h1 {
		font-size: 112px;
		line-height: 1;
		letter-spacing: 0;
		font-weight: 700;
		margin: 0 0 28px;
		color: #192421;
	}
	h1 span {
		color: #247259;
	}
	.editorial-statement {
		max-width: 520px;
		font-size: 32px;
		line-height: 1.2;
		font-weight: 500;
		margin: 0 0 18px;
		text-wrap: balance;
	}
	.editorial-description {
		max-width: 380px;
		font-size: 15px;
		line-height: 1.65;
		color: #475750;
		margin: 0;
	}
	.editorial-actions {
		display: flex;
		align-items: center;
		gap: 26px;
		margin-top: 32px;
		flex-wrap: wrap;
	}
	.editorial-actions button,
	.editorial-actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 14px;
		min-height: 52px;
		font-size: 14px;
		font-weight: 700;
	}
	.editorial-actions button {
		background: #203e33;
		color: #fff;
		padding: 14px 22px;
		border-radius: 6px;
		transition: background 0.2s;
	}
	.editorial-actions button:hover {
		background: #2e5949;
	}
	.editorial-actions a {
		color: #192421;
		border-bottom: 1px solid #50655c80;
	}
	.editorial-actions :global(svg) {
		flex-shrink: 0;
	}
	button:focus-visible,
	a:focus-visible {
		outline: 3px solid #277e64;
		outline-offset: 5px;
	}
	.editorial-bottom {
		position: absolute;
		inset-inline: 0;
		bottom: 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		border-top: 1px solid #61736a40;
		padding-top: 20px;
		font-size: 12px;
	}
	.editorial-bottom ol {
		display: flex;
		align-items: center;
		gap: 28px;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.editorial-bottom li {
		display: flex;
		align-items: center;
		gap: 12px;
		font-weight: 600;
	}
	.step-number {
		color: #52665b;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}
	.editorial-bottom a {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		border: 1px solid #61736a70;
		border-radius: 50%;
		flex-shrink: 0;
	}
	@keyframes hero-arrive {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.editorial-content { animation: none; }
	}
	@media (max-width: 760px) {
		.editorial-hero {
			min-height: 570px;
			height: min(700px, calc(100svh - 125px));
		}
		h1 {
			font-size: 72px;
			margin-bottom: 18px;
		}
		.editorial-statement {
			font-size: 26px;
			max-width: 360px;
		}
		.editorial-description {
			font-size: 14px;
			max-width: 310px;
		}
		.editorial-content {
			padding-block: 30px 175px;
		}
		.editorial-photo {
			object-position: 65% bottom;
		}
		.editorial-scrim {
			background: linear-gradient(180deg, #f8faf9 0%, rgb(248 250 249 / 96%) 42%, rgb(248 250 249 / 25%) 78%, #f8faf9 100%);
		}
		.editorial-bottom {
			bottom: 20px;
			gap: 12px;
		}
		.editorial-bottom ol {
			gap: 16px;
			align-items: flex-start;
		}
		.editorial-bottom li {
			flex: 1;
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
			font-size: 10px;
		}
		.editorial-bottom li :global(svg) { display: none; }
		.editorial-bottom a { display: none; }
		.editorial-label {
			font-size: 10px;
			margin-bottom: 18px;
		}
		.editorial-actions {
			gap: 12px 18px;
			margin-top: 24px;
		}
		.editorial-actions button,
		.editorial-actions a { font-size: 12px; min-height: 46px; gap: 8px; }
		.editorial-actions button { padding: 12px 16px; }
	}
	@media (max-width: 360px) {
		h1 {
			font-size: 60px;
		}
		.editorial-statement {
			font-size: 22px;
		}
	}
</style>
