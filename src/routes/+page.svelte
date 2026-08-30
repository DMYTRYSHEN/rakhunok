<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import LandingPage from '$lib/features/landing/LandingPage.svelte';
	import { getAuthRedirectUrl } from '$lib/features/landing/utils/auth-redirect';
	import { translations, type Locale } from '$lib/features/landing/data/translations';
	import socialPreview from '../../1.jpg';
	import '$lib/features/landing/landing.css';

	let darkMode = $state(page.url.searchParams.get('money-vision') !== 'light');

	const urlLang = page.url.searchParams.get('lang');
	let locale = $state<Locale>(urlLang === 'en' || urlLang === 'pl' ? urlLang : 'uk');

	const t = $derived(translations[locale] ?? translations.uk);
	const siteUrl = 'https://letsrealtalk.com';
	const pageDescription = $derived(
		locale === 'en'
			? 'Direct account-to-account payments for business. Accept Pay by Bank via QR, App Clip, and payment links with zero hardware terminals.'
			: locale === 'pl'
				? 'Bezpośrednie płatności A2A dla biznesu. Przyjmuj płatności Pay by Bank przez QR, linki i aplikację bez terminala POS.'
				: 'Rahunok — миттєві платежі та A2A оплата для бізнесу. Приймайте PayByBank через QR або посилання без термінала просто на свій IBAN.'
	);

	const faqSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: t.trustAndPricing.faqItems.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer
			}
		}))
	});

	function toggleTheme() {
		const url = new URL(page.url);
		darkMode = !darkMode;
		if (darkMode) url.searchParams.delete('money-vision');
		else url.searchParams.set('money-vision', 'light');
		replaceState(url, page.state);
	}

	function changeLocale(next: Locale) {
		locale = next;
		const url = new URL(page.url);
		if (next === 'uk') url.searchParams.delete('lang');
		else url.searchParams.set('lang', next);
		replaceState(url, page.state);
		try {
			localStorage.setItem('rahunok_lang', next);
		} catch {}
	}

	onMount(() => {
		try {
			const savedLang = localStorage.getItem('rahunok_lang') as Locale | null;
			if (
				!page.url.searchParams.has('lang') &&
				(savedLang === 'en' || savedLang === 'pl' || savedLang === 'uk')
			) {
				locale = savedLang;
			}
		} catch {}

		const redirectUrl = getAuthRedirectUrl(
			window.location.origin,
			window.location.hash,
			localStorage.getItem('auth_redirect')
		);

		if (redirectUrl) window.location.assign(redirectUrl);
	});

	$effect(() => {
		document.documentElement.lang = locale;
	});
</script>

<svelte:head>
	<title
		>{locale === 'en'
			? 'Rahunok — Instant A2A Payments for Business · Pay by Bank'
			: locale === 'pl'
				? 'Rahunok — Błyskawiczne płatności A2A dla firm · Pay by Bank'
				: 'Rahunok — миттєві A2A платежі для бізнесу · PayByBank без термінала'}</title
	>
	<meta name="description" content={pageDescription} />
	<meta
		name="keywords"
		content="миттєві платежі, A2A, PayByBank, Pay by Bank, QR оплата, без термінала, IBAN, Рахунок, Rahunok, account-to-account"
	/>
	<meta name="theme-color" content={darkMode ? '#050506' : '#f2f1ec'} />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href={siteUrl} />

	<meta property="og:type" content="website" />
	<meta
		property="og:locale"
		content={locale === 'en' ? 'en_US' : locale === 'pl' ? 'pl_PL' : 'uk_UA'}
	/>
	<meta property="og:site_name" content="Rahunok" />
	<meta property="og:url" content={siteUrl} />
	<meta
		property="og:title"
		content={locale === 'en'
			? 'Rahunok — Instant A2A Payments for Business'
			: locale === 'pl'
				? 'Rahunok — Błyskawiczne płatności A2A dla firm'
				: 'Rahunok — миттєві A2A платежі для бізнесу'}
	/>
	<meta
		property="og:description"
		content={locale === 'en'
			? 'Direct account-to-account payments for business. Accept Pay by Bank without hardware POS terminals.'
			: locale === 'pl'
				? 'Bezpośrednie płatności A2A dla firm bez terminali POS.'
				: 'Rahunok — миттєві платежі та A2A оплата для бізнесу без термінала просто на свій IBAN.'}
	/>
	<meta property="og:image" content={`${siteUrl}${socialPreview}`} />

	<meta name="twitter:card" content="summary_large_image" />

	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>

	{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Organization",
			"name": "Rahunok",
			"url": "${siteUrl}",
			"description": ${JSON.stringify(pageDescription)}
		}
	</script>`}
	{@html `<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "SoftwareApplication",
			"name": "Rahunok",
			"applicationCategory": "FinanceApplication",
			"operatingSystem": "Web"
		}
	</script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`}
</svelte:head>

<div class="landing-vision" data-money-vision={darkMode ? 'apple-dark' : 'light'}>
	<LandingPage {darkMode} onThemeToggle={toggleTheme} {locale} onLocaleChange={changeLocale} />
</div>
