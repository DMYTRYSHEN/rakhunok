<script lang="ts">
	import { onMount } from 'svelte';
	import LandingPage from '$lib/features/landing/LandingPage.svelte';
	import { getAuthRedirectUrl } from '$lib/features/landing/utils/auth-redirect';

	onMount(() => {
		const redirectUrl = getAuthRedirectUrl(
			window.location.origin,
			window.location.hash,
			localStorage.getItem('auth_redirect')
		);

		if (redirectUrl) window.location.assign(redirectUrl);
	});
</script>

<svelte:head>
	<title>Rahunok — оплата напряму на рахунок бізнесу</title>
	<meta
		name="description"
		content="Створюйте рахунки, приймайте оплату через QR, NFC або посилання, отримуйте підтверджений банком статус і керуйте касою зі смартфона."
	/>
	<meta name="theme-color" content="#0b0d0c" />
	<meta name="robots" content="index, follow" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="uk_UA" />
	<meta property="og:title" content="Rahunok — оплата одразу на рахунок вашого бізнесу" />
	<meta
		property="og:description"
		content="QR, NFC, платіжні посилання, підтверджені статуси, ПРРО та API в одному сервісі."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Manrope:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<LandingPage />
