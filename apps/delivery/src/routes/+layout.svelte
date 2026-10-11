<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { asset } from '$app/paths';
	import { onNavigate } from '$app/navigation';
	import type { LayoutProps } from './$types';
	import '../app.css';
	import '@fontsource-variable/manrope';

	let { children }: LayoutProps = $props();
	onNavigate((navigation) => {
		const publicRoutes = ['/(public)', '/(public)/[trackingNumber]'];
		if (!navigation.from?.route.id || !navigation.to?.route.id ||
			!publicRoutes.includes(navigation.from.route.id) || !publicRoutes.includes(navigation.to.route.id) ||
			!document.startViewTransition || document.documentElement.dataset.motionInput === 'keyboard' ||
			matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise<void>((ready) => {
			const transition = document.startViewTransition(async () => {
				ready();
				await navigation.complete;
			});
			void transition.finished.catch(() => ready());
		});
	});
</script>

<svelte:document
	onkeydown={(event) => { if (!event.metaKey && !event.ctrlKey && !event.altKey) event.currentTarget.documentElement.dataset.motionInput = 'keyboard'; }}
	onpointerdown={(event) => { event.currentTarget.documentElement.dataset.motionInput = 'pointer'; }}
/>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href={asset('manifest.webmanifest')} />
	<link rel="apple-touch-icon" href={asset('pwa/icon-192.png')} />
	<meta name="theme-color" content="#ddf988" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Rahunok Delivery" />
</svelte:head>

{@render children()}
