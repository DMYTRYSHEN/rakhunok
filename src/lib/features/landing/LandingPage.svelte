<script lang="ts">
	import LandingHeader from './components/LandingHeader.svelte';
	import LandingFooter from './components/LandingFooter.svelte';
	import HeroSection from './components/HeroSection.svelte';
	import InteractiveDemo from './components/InteractiveDemo.svelte';
	import PlanBSection from './components/PlanBSection.svelte';
	import RoleScenarios from './components/RoleScenarios.svelte';
	import ProductSections from './components/ProductSections.svelte';
	import SavingsCalculator from './components/SavingsCalculator.svelte';
	import SignupModal from './components/SignupModal.svelte';
	import TrustAndPricingSections from './components/TrustAndPricingSections.svelte';
	import InteractiveMouseEffect from './components/InteractiveMouseEffect.svelte';
	import { translations, type Locale } from './data/translations';

	let {
		darkMode,
		onThemeToggle,
		locale = 'uk',
		onLocaleChange
	}: {
		darkMode: boolean;
		onThemeToggle: () => void;
		locale?: Locale;
		onLocaleChange?: (next: Locale) => void;
	} = $props();

	const t = $derived(translations[locale] ?? translations.uk);
	let signupOpen = $state(false);
</script>

<InteractiveMouseEffect />
<LandingHeader
	onSignup={() => (signupOpen = true)}
	{darkMode}
	{onThemeToggle}
	{locale}
	{onLocaleChange}
	{t}
/>
<main id="top">
	<HeroSection onSignup={() => (signupOpen = true)} {t} />
	<InteractiveDemo {t} />
	<PlanBSection onSignup={() => (signupOpen = true)} {t} />
	<RoleScenarios {t} />
	<ProductSections onSignup={() => (signupOpen = true)} {t} />
	<SavingsCalculator {t} />
	<TrustAndPricingSections onSignup={() => (signupOpen = true)} {t} />
</main>
<LandingFooter {t} />
<SignupModal bind:open={signupOpen} {t} />
