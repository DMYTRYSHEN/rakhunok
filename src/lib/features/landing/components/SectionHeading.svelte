<script lang="ts">
	let {
		eyebrow,
		title,
		accent,
		copy = '',
		dark = false
	}: { eyebrow: string; title: string; accent: string; copy?: string; dark?: boolean } = $props();
</script>

<header class:dark class="section-heading">
	<div class="section-heading-label"><p class="eyebrow">{eyebrow}</p></div>
	<h2>{title} <span>{accent}</span></h2>
	{#if copy}<p class="section-copy">{copy}</p>{/if}
</header>
