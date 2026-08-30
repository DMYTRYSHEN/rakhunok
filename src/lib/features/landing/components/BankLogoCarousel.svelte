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
	let animationFrame = 0;
	let isManualScrolling = false;
	let scrollEndTimer = 0;
	let tweenRaf = 0;

	function updateCards() {
		if (!track) return;
		const trackWidth = track.clientWidth;
		const trackCenter = trackWidth / 2;
		const scrollLeft = track.scrollLeft;

		const children = track.children;
		const len = children.length;
		for (let i = 0; i < len; i++) {
			const wrapper = children[i] as HTMLElement;
			const cardCenter = wrapper.offsetLeft + wrapper.offsetWidth / 2 - scrollLeft;
			const distance = Math.abs(cardCenter - trackCenter);
			const normalized = Math.min(distance / 160, 1);
			const direction = cardCenter > trackCenter ? 1 : -1;

			wrapper.style.transform = `scale(${1 - normalized * 0.12}) perspective(900px) rotateY(${normalized * direction * -10}deg)`;
			wrapper.style.opacity = `${1 - normalized * 0.42}`;
		}
	}

	function handleScroll() {
		isManualScrolling = true;
		window.cancelAnimationFrame(animationFrame);
		animationFrame = window.requestAnimationFrame(() => {
			updateCards();
			window.clearTimeout(scrollEndTimer);
			scrollEndTimer = window.setTimeout(() => {
				isManualScrolling = false;
				if (track) {
					const trackCenter = track.scrollLeft + track.clientWidth / 2;
					let closestIdx = selected;
					let minDistance = Number.POSITIVE_INFINITY;
					const children = track.children;
					for (let i = 0; i < children.length; i++) {
						const el = children[i] as HTMLElement;
						const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - trackCenter);
						if (dist < minDistance) {
							minDistance = dist;
							closestIdx = i;
						}
					}
					if (closestIdx !== selected) {
						selected = closestIdx;
						onselect?.(closestIdx);
					}
				}
			}, 120);
		});
	}

	function scrollToCard(index: number, customDuration?: number) {
		if (!track || index < 0 || index >= banks.length) return;
		const card = track.children[index] as HTMLElement | undefined;
		if (!card) return;

		const start = track.scrollLeft;
		const target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
		const distance = target - start;

		if (Math.abs(distance) < 2) {
			track.scrollLeft = target;
			updateCards();
			return;
		}

		// Calibrated duration: ~340ms per bank distance (<= 3 banks per second)
		const cardDist = Math.max(1, Math.abs(index - selected));
		const animDuration = customDuration ?? Math.max(360, Math.min(cardDist * 340, 2400));

		window.cancelAnimationFrame(tweenRaf);
		const startTime = performance.now();

		function step(currentTime: number) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / animDuration, 1);
			// Smooth ease-out cubic
			const eased = 1 - Math.pow(1 - progress, 3);

			if (track) {
				track.scrollLeft = start + distance * eased;
				updateCards();
			}

			if (progress < 1) {
				tweenRaf = window.requestAnimationFrame(step);
			}
		}

		tweenRaf = window.requestAnimationFrame(step);
	}

	function choose(index: number, notify = true) {
		if (index < 0 || index >= banks.length) return;
		const prev = selected;
		selected = index;
		if (notify) onselect?.(index);
		const cardDist = Math.max(1, Math.abs(index - prev));
		scrollToCard(index, Math.max(360, Math.min(cardDist * 340, 1800)));
	}

	onMount(() => {
		const handleResize = () => updateCards();
		updateCards();
		window.addEventListener('resize', handleResize);
		return () => {
			window.cancelAnimationFrame(animationFrame);
			window.cancelAnimationFrame(tweenRaf);
			window.clearTimeout(scrollEndTimer);
			window.removeEventListener('resize', handleResize);
		};
	});

	$effect(() => {
		const current = selected;
		if (track && !isManualScrolling) {
			scrollToCard(current);
		}
	});
</script>

<div class="bank-logo-carousel" bind:this={track} aria-label="Вибір банку" onscroll={handleScroll}>
	{#each banks as bank, index (bank.id)}
		<button
			type="button"
			class="bank-card-wrapper"
			class:selected={selected === index}
			aria-pressed={selected === index}
			aria-label={`Обрати ${bank.name}`}
			onclick={() => choose(index)}
		>
			<span class="checkout-bank-card" style={`--bank-color: ${bank.color}`}>
				<span class="checkout-bank-card__top">
					<span class="checkout-bank-card__identity">
						<span class="checkout-bank-card__logo"
							><img
								src={bank.logo}
								alt=""
								loading="lazy"
								onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
							/></span
						>
						<strong>{bank.shortName}</strong>
					</span>
					<em>{bank.code}</em>
				</span>
				<span class="checkout-bank-card__bottom"
					><small>A2A · NBU 003</small><i class="card-chip-icon"></i></span
				>
				<img
					class="checkout-bank-card__watermark"
					src={bank.logo}
					alt=""
					loading="lazy"
					onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
				/>
			</span>
		</button>
	{/each}
</div>
