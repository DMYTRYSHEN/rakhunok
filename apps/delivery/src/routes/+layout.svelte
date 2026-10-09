<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { asset } from '$app/paths';
	import type { LayoutProps } from './$types';
	import '../app.css';
	import '@fontsource-variable/manrope';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href={asset('manifest.webmanifest')} />
	<link rel="apple-touch-icon" href={asset('pwa/icon-192.png')} />
	<meta name="theme-color" content="#ddf988" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Rahunok Delivery" />
</svelte:head>

{@render children()}
