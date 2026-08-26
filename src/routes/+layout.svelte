<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		document.documentElement.dataset.theme = localStorage.getItem('rahunok_theme') === 'dark' ? 'dark' : 'light';
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
