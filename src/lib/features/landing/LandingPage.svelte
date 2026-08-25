<script lang="ts">
	import LandingHeader from './components/LandingHeader.svelte';
	import LandingFooter from './components/LandingFooter.svelte';
	import HeroSection from './components/HeroSection.svelte';
	import InteractiveDemo from './components/InteractiveDemo.svelte';
	import ProductSections from './components/ProductSections.svelte';
	import SavingsCalculator from './components/SavingsCalculator.svelte';
	import SignupModal from './components/SignupModal.svelte';
	import TrustAndPricingSections from './components/TrustAndPricingSections.svelte';

	let signupOpen = $state(false);
</script>

<LandingHeader onSignup={() => (signupOpen = true)} />
<main id="top">
	<HeroSection onSignup={() => (signupOpen = true)} />
	<InteractiveDemo />
	<ProductSections onSignup={() => (signupOpen = true)} />
	<SavingsCalculator />
	<TrustAndPricingSections onSignup={() => (signupOpen = true)} />
</main>
<LandingFooter onSignup={() => (signupOpen = true)} />
<SignupModal bind:open={signupOpen} />
