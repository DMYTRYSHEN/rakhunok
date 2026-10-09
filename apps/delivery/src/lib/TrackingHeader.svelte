<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Package2, Search } from '@lucide/svelte';
	let { detail = false }: { detail?: boolean } = $props();
</script>

<header class="tracking-header">
	<a href={resolve('/(public)')} class="wordmark" aria-label="Rahunok Delivery: головна">
		<span class="brand-mark"><Package2 size={21} strokeWidth={1.8} /></span>
		<span>Що на Rahunok<span class="wordmark-suffix"> / delivery</span></span>
	</a>
	<nav aria-label="Головна навігація">
		<a href={`${resolve('/(public)')}#tracking-number`} class="header-search" aria-current={detail ? undefined : 'page'}><Search size={16} /> <span>{detail ? 'Новий пошук' : 'Відстеження'}</span></a>
		<a href={resolve('/(business)/business')} class="business-link">Кабінет <ArrowUpRight size={16} /></a>
	</nav>
</header>