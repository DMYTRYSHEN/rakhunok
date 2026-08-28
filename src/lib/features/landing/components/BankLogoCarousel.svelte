<script lang="ts">
	import { onMount } from 'svelte';

	export type BankOption = {
		id: string;
		name: string;
		shortName: string;
		code: string;
		logo: string;
		color: string;
	};

	let {
		banks,
		selected = $bindable(0),
		autoplay = false,
		interval = 650,
		onselect
	}: {
		banks: readonly BankOption[];
		selected?: number;
		autoplay?: boolean;
		interval?: number;
		onselect?: (index: number) => void;
	} = $props();

	let track: HTMLDivElement;
	let reducedMotion = $state(true);
	let animationFrame = 0;

	function updateCards(updateSelection = false) {
		if (!track) return;
		const trackRect = track.getBoundingClientRect();
		const trackCenter = trackRect.left + trackRect.width / 2;
		let closestIndex = selected;
		let closestDistance = Number.POSITIVE_INFINITY;

		Array.from(track.children).forEach((element, index) => {
			const wrapper = element as HTMLElement;
			const rect = wrapper.getBoundingClientRect();
			const distance = Math.abs(rect.left + rect.width / 2 - trackCenter);
			const normalized = Math.min(distance / 160, 1);
			const direction = rect.left + rect.width / 2 > trackCenter ? 1 : -1;
			wrapper.style.transform = `scale(${1 - normalized * 0.13}) perspective(900px) rotateY(${normalized * direction * -12}deg)`;
			wrapper.style.opacity = `${1 - normalized * 0.45}`;
			if (distance < closestDistance) {
				closestDistance = distance;
				closestIndex = index;
			}
		});

		if (updateSelection && closestIndex !== selected) selected = closestIndex;
	}

	function handleScroll() {
		window.cancelAnimationFrame(animationFrame);
		animationFrame = window.requestAnimationFrame(() => updateCards(true));
	}

	function choose(index: number, notify = true) {
		selected = index;
		if (notify) onselect?.(index);
		const card = track?.children[index] as HTMLElement | undefined;
		if (card) {
			track.scrollTo({
				left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
				behavior: reducedMotion ? 'auto' : 'smooth'
			});
		}
	}

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => (reducedMotion = media.matches);
		const handleResize = () => updateCards();
		updateMotion();
		updateCards();
		media.addEventListener('change', updateMotion);
		window.addEventListener('resize', handleResize);
		return () => {
			window.cancelAnimationFrame(animationFrame);
			media.removeEventListener('change', updateMotion);
			window.removeEventListener('resize', handleResize);
		};
	});

	$effect(() => {
		if (!autoplay || reducedMotion || selected >= banks.length - 1) return;
		const timer = window.setTimeout(() => choose(selected + 1, false), interval);
		return () => window.clearTimeout(timer);
	});
</script>

<div class="bank-logo-carousel" bind:this={track} aria-label="Вибір банку" onscroll={handleScroll}>
	{#each banks as bank, index (bank.id)}
		<button type="button" class="bank-card-wrapper" class:selected={selected === index} aria-pressed={selected === index} aria-label={`Обрати ${bank.name}`} onclick={() => choose(index)}>
			<span class="checkout-bank-card" style={`--bank-color: ${bank.color}`}>
				<span class="checkout-bank-card__top">
					<span class="checkout-bank-card__identity">
						<span class="checkout-bank-card__logo"><b aria-hidden="true">{bank.code}</b><img src={bank.logo} alt="" loading="lazy" onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)} /></span>
						<strong>{bank.shortName}</strong>
					</span>
					<em>{bank.code}</em>
				</span>
				<span class="checkout-bank-card__bottom"><small>A2A · NBU 003</small><i></i></span>
				<img class="checkout-bank-card__watermark" src={bank.logo} alt="" loading="lazy" onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)} />
			</span>
		</button>
	{/each}
</div>
