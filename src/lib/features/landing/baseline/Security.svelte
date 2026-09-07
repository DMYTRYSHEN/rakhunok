<script lang="ts">
	import { ArrowRight, Landmark, Building2, Activity } from '@lucide/svelte';
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="security" class="b-section b-security" data-section="security10" aria-labelledby="b-security-heading">
	<div class="b-wrap">
		<p class="b-eyebrow">{c.nav[4]}</p>
		<h2 id="b-security-heading" class="b-heading">{c.securityTitle}</h2>
		<p class="b-security-intro">{c.securityIntro}</p>
		<div class="b-panel b-security-architecture">
			<div class="b-security-funds">
				<h3 class="b-eyebrow">{c.funds}</h3>
				<div class="b-security-funds-path">
					<div class="b-security-node">
						<Landmark size={28} aria-hidden="true" />
						<span>{c.bank}</span>
					</div>
					<ArrowRight class="b-security-arrow" size={32} aria-hidden="true" />
					<div class="b-security-node">
						<Building2 size={28} aria-hidden="true" />
						<span>{c.business}</span>
					</div>
				</div>
			</div>
			<div class="b-security-status">
				<Activity size={24} aria-hidden="true" />
				<div>
					<h3 class="b-security-status-brand">Rahunok</h3>
					<p class="b-security-status-path">{c.statusPath}</p>
				</div>
			</div>
		</div>
		<div class="b-grid b-security-grid">
			{#each c.securityCards as [title, description] (title)}
				<article class="b-panel b-security-card">
					<h3>{title}</h3>
					<p>{description}</p>
				</article>
			{/each}
		</div>
	</div>
</section>