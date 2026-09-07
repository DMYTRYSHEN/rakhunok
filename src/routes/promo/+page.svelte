<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import LandingPage from '$lib/features/landing/BaselineLanding.svelte';
	import { getAuthRedirectUrl } from '$lib/features/landing/utils/auth-redirect';
	import type { Locale } from '$lib/features/landing/data/translations';
	import { getStudioFaq } from '$lib/features/landing/data/studio-copy';
	import socialPreview from '../../../1.jpg';

	let darkMode = $state(page.url.searchParams.get('money-vision') !== 'light');
	const urlLang = page.url.searchParams.get('lang');
	let locale = $state<Locale>(urlLang === 'en' || urlLang === 'pl' ? urlLang : 'uk');
	const faq = $derived(getStudioFaq(locale));
	const siteUrl = 'https://letsrealtalk.com';
	const promoUrl = `${siteUrl}/promo`;
	const pageTitle = $derived(
		locale === 'en'
			? 'Rahunok — QR and payment links for business'
			: locale === 'pl'
				? 'Rahunok — płatności QR i linki dla firm'
				: 'Rahunok — оплата за QR-кодом і посиланням для бізнесу'
	);
	const pageDescription = $derived(
		locale === 'en'
			? 'Create an invoice, share a QR code or payment link, and check its status in your dashboard. Review fees and payment methods before getting started.'
			: locale === 'pl'
				? 'Utwórz rachunek, udostępnij kod QR lub link do płatności i sprawdź status w panelu. Przed rozpoczęciem sprawdź opłaty i dostępne metody.'
				: 'Створіть рахунок, передайте клієнту QR-код або посилання та перевірте статус у кабінеті. Дізнайтеся про тарифи й доступні способи оплати перед початком роботи.'
	);
	const faqSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item[0],
			acceptedAnswer: { '@type': 'Answer', text: item[1] }
		}))
	});
	const organizationSchema = $derived({
		'@context': 'https://schema.org', '@type': 'Organization',
		name: 'Rahunok', url: siteUrl, description: pageDescription
	});
	const applicationSchema = {
		'@context': 'https://schema.org', '@type': 'SoftwareApplication',
		name: 'Rahunok', applicationCategory: 'FinanceApplication', operatingSystem: 'Web'
	};
	const jsonLd = (value: unknown) => '<script type="application/ld+json">' + JSON.stringify(value).replace(/</g, '\\u003c') + '</scr' + 'ipt>';

	function toggleTheme() {
		const url = new URL(page.url);
		darkMode = !darkMode;
		url.searchParams.set('money-vision', darkMode ? 'dark' : 'light');
		replaceState(url, page.state);
	}
	function changeLocale(next: Locale) {
		locale = next;
		const url = new URL(page.url);
		if (next === 'uk') url.searchParams.delete('lang');
		else url.searchParams.set('lang', next);
		replaceState(url, page.state);
		try { localStorage.setItem('rahunok_lang', next); } catch {}
	}
	onMount(() => {
		try {
			const savedLang = localStorage.getItem('rahunok_lang') as Locale | null;
			if (!page.url.searchParams.has('lang') && (savedLang === 'en' || savedLang === 'pl' || savedLang === 'uk')) locale = savedLang;
		} catch {}
		const redirectUrl = getAuthRedirectUrl(window.location.origin, window.location.hash, localStorage.getItem('auth_redirect'));
		if (redirectUrl) window.location.assign(redirectUrl);
	});
	$effect(() => { document.documentElement.lang = locale; });
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta name="keywords" content="миттєві платежі, A2A, PayByBank, Pay by Bank, QR оплата, без термінала, IBAN, Рахунок, Rahunok, account-to-account" />
	<meta name="theme-color" content={darkMode ? '#060709' : '#f8f9fa'} />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href={promoUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content={locale === 'en' ? 'en_US' : locale === 'pl' ? 'pl_PL' : 'uk_UA'} />
	<meta property="og:site_name" content="Rahunok" />
	<meta property="og:url" content={promoUrl} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:image" content={`${siteUrl}${socialPreview}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
	{@html jsonLd(organizationSchema)}
	{@html jsonLd(applicationSchema)}
	{@html jsonLd(faqSchema)}
</svelte:head>

<div class="landing-vision" data-money-vision={darkMode ? 'apple-dark' : 'light'}>
	<LandingPage {darkMode} onThemeToggle={toggleTheme} {locale} onLocaleChange={changeLocale} />
</div>