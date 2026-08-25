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
	<p class="eyebrow">{eyebrow}</p>
	<h2>{title} <span>{accent}</span></h2>
	{#if copy}<p class="section-copy">{copy}</p>{/if}
</header>
