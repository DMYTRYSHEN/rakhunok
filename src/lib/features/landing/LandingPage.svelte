<script lang="ts">
	import LandingHeader from './components/LandingHeader.svelte';
	import LandingFooter from './components/LandingFooter.svelte';
	import HeroSection from './components/HeroSection.svelte';
	import InteractiveDemo from './components/InteractiveDemo.svelte';
	import RoleScenarios from './components/RoleScenarios.svelte';
	import ProductSections from './components/ProductSections.svelte';
	import SavingsCalculator from './components/SavingsCalculator.svelte';
	import SignupModal from './components/SignupModal.svelte';
	import TrustAndPricingSections from './components/TrustAndPricingSections.svelte';

	let {
		darkMode,
		onThemeToggle
	}: {
		darkMode: boolean;
		onThemeToggle: () => void;
	} = $props();
	let signupOpen = $state(false);
</script>

<LandingHeader onSignup={() => (signupOpen = true)} {darkMode} {onThemeToggle} />
<main id="top">
	<HeroSection onSignup={() => (signupOpen = true)} />
	<InteractiveDemo />
	<RoleScenarios />
	<ProductSections onSignup={() => (signupOpen = true)} />
	<SavingsCalculator />
	<TrustAndPricingSections onSignup={() => (signupOpen = true)} />
</main>
<LandingFooter onSignup={() => (signupOpen = true)} />
<SignupModal bind:open={signupOpen} />
