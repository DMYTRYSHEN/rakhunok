<script lang="ts">
	import LandingHeader from './components/LandingHeader.svelte';
	import LandingFooter from './components/LandingFooter.svelte';
	import HeroSection from './components/HeroSection.svelte';
	import EcosystemSections from './components/EcosystemSections.svelte';
	import SavingsCalculator from './components/SavingsCalculator.svelte';
	import SignupModal from './components/SignupModal.svelte';
	import { translations, type Locale } from './data/translations';
	import type { BankDirectory } from './data/bank-directory';

	let {
		darkMode,
		onThemeToggle,
		locale = 'uk',
		onLocaleChange,
		directory
	}: {
		darkMode: boolean;
		onThemeToggle: () => void;
		locale?: Locale;
		onLocaleChange?: (next: Locale) => void;
		directory: BankDirectory;
	} = $props();

	const t = $derived(translations[locale] ?? translations.uk);
	let signupOpen = $state(false);
</script>

<LandingHeader
	onSignup={() => (signupOpen = true)}
	{darkMode}
	{onThemeToggle}
	{locale}
	{onLocaleChange}
	{t}
/>
<main id="top">
	<HeroSection onSignup={() => (signupOpen = true)} {locale} />
	<EcosystemSections {locale} {directory} onSignup={() => (signupOpen = true)}>
		<SavingsCalculator {t} {locale} />
	</EcosystemSections>
</main>
<LandingFooter {t} />
<SignupModal bind:open={signupOpen} {t} />
