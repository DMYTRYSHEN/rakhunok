<script lang="ts">
	import { onMount } from 'svelte';
	import { checkoutBanks } from '../bank-options';
	import { reveal } from '../actions/reveal';
	import BankLogoCarousel from './BankLogoCarousel.svelte';

	let { onSignup }: { onSignup: () => void } = $props();
	let activeStep = $state(0);
	let selectedBank = $state(0);
	let interactionTimer: number | undefined;
	let successTimer: number | undefined;
	let autoplayTimer: number | undefined;
	let headlineTimer: number | undefined;
	let audienceTimer: number | undefined;
	let successfulPayments = $state(185);
	let averageCheck = $state(698);
	const initialHeadlinePrefix = 'Приймайте оплату. ';
	const initialHeadlineAccent = 'Без термінала.';
	const finalHeadlineStart = 'Оплата';
	const finalHeadlineMiddle = ', що відчувається ';
	const finalHeadlineEnd = 'природно.';
	let headline = $state(initialHeadlinePrefix + initialHeadlineAccent);
	let headlineTyping = $state(false);
	let audience = $state('для бізнесу');
	let audienceChanging = $state(false);
	const banks = checkoutBanks;
	const nextHeadline = finalHeadlineStart + finalHeadlineMiddle + finalHeadlineEnd;

	function headlineSlice(start: number, length: number) {
		return headline.slice(start, start + length);
	}

	function rotateAudience() {
		audienceChanging = true;
		window.setTimeout(() => {
			audience = audience === 'для бізнесу' ? 'для тебе' : 'для бізнесу';
			audienceChanging = false;
		}, 240);
	}

	function animateHeadline() {
		let current = headline.length;
		headlineTyping = true;

		const erase = () => {
			if (current > 0) {
				headline = headline.slice(0, --current);
				headlineTimer = window.setTimeout(erase, 24);
				return;
			}

			let next = 0;
			const type = () => {
				headline = nextHeadline.slice(0, ++next);
				if (next < nextHeadline.length) headlineTimer = window.setTimeout(type, 46);
				else headlineTyping = false;
			};
			headlineTimer = window.setTimeout(type, 180);
		};

		erase();
	}

	function stopAutoplay() {
		window.clearInterval(autoplayTimer);
	}

	function selectBank(index: number) {
		stopAutoplay();
		selectedBank = index;
		activeStep = 1;
	}

	function completePayment() {
		activeStep = 3;
		successfulPayments += 1;
		averageCheck = 698 + Math.floor(Math.random() * 11) - 5;
	}

	function continuePayment() {
		stopAutoplay();
		window.clearTimeout(interactionTimer);
		window.clearTimeout(successTimer);
		if (activeStep === 3) {
			activeStep = 1;
			return;
		}
		activeStep = 2;
		interactionTimer = window.setTimeout(() => {
			activeStep = 2;
			successTimer = window.setTimeout(completePayment, 2000);
		}, 1200);
	}

	function closeStatus() {
		window.clearTimeout(interactionTimer);
		window.clearTimeout(successTimer);
		activeStep = 1;
	}

	function moveStage(event: PointerEvent) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const stage = event.currentTarget as HTMLElement;
		const rect = stage.getBoundingClientRect();
		stage.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width - 0.5) * 10}px`);
		stage.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height - 0.5) * 8}px`);
	}

	function resetStage(event: PointerEvent) {
		const stage = event.currentTarget as HTMLElement;
		stage.style.setProperty('--pointer-x', '0px');
		stage.style.setProperty('--pointer-y', '0px');
	}

	onMount(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!reducedMotion) audienceTimer = window.setInterval(rotateAudience, 3600);
		headlineTimer = window.setTimeout(() => {
			if (reducedMotion) headline = nextHeadline;
			else animateHeadline();
		}, 5000);

		if (reducedMotion) {
			activeStep = 3;
		} else {
			autoplayTimer = window.setInterval(() => {
				const nextStep = (activeStep + 1) % 4;
				if (nextStep === 3) completePayment();
				else activeStep = nextStep;
				if (activeStep === 1) selectedBank = 0;
			}, 2400);
		}
		return () => {
			window.clearInterval(autoplayTimer);
			window.clearInterval(audienceTimer);
			window.clearTimeout(interactionTimer);
			window.clearTimeout(successTimer);
			window.clearTimeout(headlineTimer);
		};
	});
</script>

<section class="hero" aria-labelledby="hero-title">
	<div class="hero-grid container">
		<div class="hero-message">
			<p class="eyebrow"><span>Rahunok</span> <span class="eyebrow-audience" class:changing={audienceChanging}>{audience}</span></p>
			<h1 id="hero-title" class:typing={headlineTyping} aria-label={headline}>
				{#if headline.startsWith('Приймайте')}
					{headlineSlice(0, initialHeadlinePrefix.length)}<span class="headline-gradient-terminal">{headlineSlice(initialHeadlinePrefix.length, initialHeadlineAccent.length)}</span>
				{:else}
					<span class="headline-gradient-payment">{headlineSlice(0, finalHeadlineStart.length)}</span>{headlineSlice(finalHeadlineStart.length, finalHeadlineMiddle.length)}<span class="headline-gradient-natural">{headlineSlice(finalHeadlineStart.length + finalHeadlineMiddle.length, finalHeadlineEnd.length)}</span>
				{/if}<span class="typing-caret" aria-hidden="true"></span>
			</h1>
			<p class="hero-copy"><strong>Покажіть QR або надішліть посилання.</strong> Клієнт обирає свій банк, а гроші надходять просто на рахунок бізнесу.</p>
			<div class="hero-actions">
				<button class="button button-primary hero-cta" type="button" onclick={onSignup}>Підключити Rahunok <span aria-hidden="true">→</span></button>
				<a class="button button-muted" href="#demo">Спробувати демо</a>
			</div>
			<div class="hero-proof" aria-label="Ключові можливості">
				<div><b>QR</b><span>без обладнання</span></div><div><b>IBAN</b><span>гроші на ваш рахунок</span></div><div><b>SUCCESS</b><span>статус перевіряє сервер</span></div>
			</div>
		</div>

		<div class="product-stage" class:checkout-open={activeStep >= 1} class:bank-authorizing={activeStep === 2} class:confirmed={activeStep === 3} use:reveal role="group" aria-label="Rahunok у роботі" onpointermove={moveStage} onpointerleave={resetStage}>
			<div class="merchant-console">
				<aside class="console-sidebar"><span class="console-brand">R</span><i></i><i></i><i></i><i></i></aside>
				<div class="console-main">
					<header><span><small>Rahunok Coffee</small><b>Фінансовий огляд</b></span><i>25 серпня · Київ</i><button type="button" tabindex="-1">Створити рахунок</button></header>
					<div class="console-metrics">
						<div><small>Виручка сьогодні</small><strong class:metric-updated={activeStep === 3}>{activeStep === 3 ? '128 910' : '128 420'} ₴</strong><span>+12,4% за день</span></div>
						<div><small>Успішні оплати</small><strong class:metric-updated={activeStep === 3}>{successfulPayments}</strong><span>98,7% успішних</span></div>
						<div><small>Середній чек</small><strong class:metric-updated={activeStep === 3}>{averageCheck} ₴</strong><span>QR · Link · POS</span></div>
					</div>
					<div class="console-invoices">
						<h3>Останні рахунки <span>Усі рахунки →</span></h3>
						<p class:new-payment={activeStep === 3}><span><b>Стіл 12 · тераса</b><small>Щойно · QR</small></span><strong>490 ₴</strong><em>{activeStep === 3 ? 'Оплачено' : 'Очікує'}</em></p>
						<p><span><b>Замовлення #48</b><small>2 хв тому · QR</small></span><strong>850 ₴</strong><em>Оплачено</em></p>
						<p><span><b>Доставка · Поділ</b><small>8 хв тому · Link</small></span><strong>1 240 ₴</strong><em>Оплачено</em></p>
					</div>
				</div>
			</div>
			<div class="payment-device">
				<div class="device-head"><span>9:41</span><b>Rahunok</b><span>•••</span></div>
				<div class="checkout-order"><span>Кав’ярня «Крапка»</span><small>Замовлення №1046</small><strong>490,00 ₴</strong><i class:paid={activeStep === 3}>{activeStep === 3 ? 'Оплачено' : activeStep === 2 ? `Очікуємо ${banks[selectedBank].name}` : 'Очікує на оплату'}</i></div>
				<div class="bank-sheet">
					<div class="sheet-handle"></div>
					<header><span><b>Оберіть банк</b><small>Захищено Rahunok · NBU 003</small></span><button type="button" tabindex="-1">×</button></header>
					<div class="sheet-amount"><span>До сплати</span><strong>490,00 ₴</strong><i>Без комісії</i></div>
					<BankLogoCarousel banks={banks} bind:selected={selectedBank} autoplay={activeStep === 1} interval={320} onselect={selectBank} />
					<button class="bank-confirm" type="button" disabled={activeStep === 2} onclick={continuePayment}>{activeStep === 3 ? 'Провести ще одну оплату' : activeStep === 2 ? `Очікуємо підтвердження у ${banks[selectedBank].name}…` : `Продовжити з ${banks[selectedBank].name}`}</button>
				</div>
				<div class="checkout-status-screen" class:active={activeStep >= 2} class:success={activeStep === 3} aria-live="polite">
					<div class="checkout-status-icon"><i></i><span>✓</span></div>
					<h3>{activeStep === 3 ? 'Сплачено' : 'Очікуємо підтвердження банку…'}</h3>
					<strong>490,00 ₴</strong>
					<div class="checkout-status-details">
						<p><span>Банк</span><b>{banks[selectedBank].name}</b></p>
						<p><span>Отримувач</span><b>Кав’ярня «Крапка»</b></p>
						<p><span>Призначення</span><b>Замовлення №1046</b></p>
					</div>
					<button class="checkout-wallet" type="button">Додати в Apple Wallet</button>
					<button class="checkout-status-done" type="button" onclick={closeStatus}>Готово</button>
				</div>
			</div>
			<div class="success-ticket" class:visible={activeStep === 3}><i>✓</i><span><small>Підтверджено банком</small><b>Оплата 490 ₴ зарахована</b></span><time>09:41</time></div>
		</div>
	</div>
	<div class="hero-foot container"><p>Одна проста дія для клієнта. Повний контроль для бізнесу.</p><div><span>КЛІЄНТ</span><i>→</i><span>ЙОГО БАНК</span><i>→</i><span>ВАШ РАХУНОК</span></div></div>
</section>
