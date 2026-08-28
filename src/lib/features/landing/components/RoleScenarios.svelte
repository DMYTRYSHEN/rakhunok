<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, Landmark, Link2, QrCode, ReceiptText, Smartphone } from '@lucide/svelte';
	import { checkoutBanks } from '../bank-options';
	import BankLogoCarousel from './BankLogoCarousel.svelte';

	type Role = 'merchant' | 'payer';

	const scenarios = {
		merchant: {
			eyebrow: 'Для отримувача коштів',
			title: 'Від суми до зарахування.',
			intro: 'Каса створює платіж, ділиться ним і сама отримує підтвердження банку.',
			steps: [
				{ title: 'Вкажіть суму', text: 'Введіть суму або сформуйте її голосом у застосунку Rahunok.' },
				{ title: 'Створіть рахунок', text: 'Каса збере платіж із призначенням і вашим IBAN.' },
				{ title: 'Покажіть QR', text: 'Клієнт сканує QR або відкриває захищене посилання.' },
				{ title: 'Отримайте SUCCESS', text: 'Dashboard оновиться після server-side підтвердження.' }
			]
		},
		payer: {
			eyebrow: 'Для платника',
			title: 'Від QR до готового чека.',
			intro: 'Без введення картки: обрати банк, підтвердити платіж і повернутися в checkout.',
			steps: [
				{ title: 'Відкрийте оплату', text: 'Скануйте QR або перейдіть за посиланням від бізнесу.' },
				{ title: 'Оберіть банк', text: 'Checkout покаже доступні банки та точну суму платежу.' },
				{ title: 'Підтвердьте в банку', text: 'Банк авторизує переказ у власному захищеному застосунку.' },
				{ title: 'Поверніться до чека', text: 'Rahunok покаже успіх лише після перевіреного callback.' }
			]
		}
	} as const;

	let role = $state<Role>('merchant');
	let activeStep = $state(0);
	let paused = $state(false);
	let reducedMotion = $state(true);
	let cycleRevision = $state(0);
	let selectedBank = $state(0);
	const scenario = $derived(scenarios[role]);

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => (reducedMotion = media.matches);
		updateMotion();
		media.addEventListener('change', updateMotion);
		return () => media.removeEventListener('change', updateMotion);
	});

	$effect(() => {
		if (paused || reducedMotion) return;
		role;
		activeStep;
		cycleRevision;
		const timer = window.setTimeout(advanceStory, 3200);
		return () => window.clearTimeout(timer);
	});

	function advanceStory() {
		if (activeStep < scenario.steps.length - 1) {
			activeStep += 1;
			return;
		}
		role = role === 'merchant' ? 'payer' : 'merchant';
		activeStep = 0;
	}

	function restartCycle() {
		cycleRevision += 1;
	}

	function chooseRole(nextRole: Role) {
		role = nextRole;
		activeStep = 0;
		selectedBank = 0;
		restartCycle();
	}

	function nextStep() {
		activeStep = (activeStep + 1) % scenario.steps.length;
		restartCycle();
	}

	function chooseStep(index: number) {
		activeStep = index;
		restartCycle();
	}
</script>

<section class="role-scenarios section" id="how-it-works">
	<div class="container">
		<header class="role-scenarios__heading">
			<div>
				<p class="eyebrow"><i></i> Як це працює</p>
				<h2>Один платіж.<br />Два боки.</h2>
			</div>
			<div class="role-switch" role="tablist" aria-label="Оберіть сторону платежу">
				<span>Я</span>
				<button type="button" role="tab" aria-selected={role === 'merchant'} class:active={role === 'merchant'} onclick={() => chooseRole('merchant')}>отримую</button>
				<i>/</i>
				<button type="button" role="tab" aria-selected={role === 'payer'} class:active={role === 'payer'} onclick={() => chooseRole('payer')}>оплачую</button>
			</div>
		</header>

		<div class="role-story" data-role={role} role="group" aria-label="Покроковий сценарій платежу" onpointerenter={() => (paused = true)} onpointerleave={() => { paused = false; restartCycle(); }} onfocusin={() => (paused = true)} onfocusout={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { paused = false; restartCycle(); } }}>
			<div class="role-story__copy">
				<p class="role-story__eyebrow">{scenario.eyebrow}</p>
				<h3>{scenario.title}</h3>
				<p class="role-story__intro">{scenario.intro}</p>

				<div class="role-steps">
					{#each scenario.steps as step, index (step.title)}
						<button type="button" class:active={activeStep === index} onclick={() => chooseStep(index)}>
							<span>{String(index + 1).padStart(2, '0')}</span>
							<div><strong>{step.title}</strong><p>{step.text}</p></div>
							<ArrowRight size={17} aria-hidden="true" />
						</button>
					{/each}
				</div>
			</div>

			<div class="role-demo" aria-live="polite">
				<div class="demo-hint demo-hint--scribble" data-position={activeStep < 2 ? 'top' : 'bottom'}>
					<span>{role === 'merchant'
						? ['Почніть із суми', 'Реквізити вже підставлені', 'QR можна показати або надіслати', 'Каса знає про оплату автоматично'][activeStep]
						: ['Жодних даних картки', 'Обираєте свій банк', 'Підтвердження відбувається в банку', 'Повертаєтесь у готовий чек'][activeStep]}</span>
					<svg class="demo-hint__scribble-svg" viewBox="0 0 142 82" fill="none" aria-hidden="true">
						<defs><marker id="rahunok-scribble-arrow" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L12 6L0 12L4 6Z" /></marker></defs>
						<path class="demo-hint__scribble-path" d="M136 7C103 7 75 14 54 29C36 42 25 57 18 72" marker-end="url(#rahunok-scribble-arrow)" />
					</svg>
				</div>

				<div class="role-phone">
					<div class="role-phone__bar"><span>9:41</span><i></i><b>R/</b></div>
					{#if role === 'merchant'}
						<div class="merchant-flow" data-step={activeStep}>
							<header><div><small>Rahunok Каса</small><strong>Кав'ярня «Крапка»</strong></div><span>КК</span></header>
							{#if activeStep === 0}
								<div class="merchant-amount"><small>Сума платежу</small><strong>490<span>₴</span></strong></div>
								<div class="merchant-keypad">{#each ['1','2','3','4','5','6','7','8','9','0'] as key}<i>{key}</i>{/each}</div>
								<button type="button" onclick={nextStep}>Продовжити <ArrowRight size={16} /></button>
							{:else if activeStep === 1}
								<div class="merchant-sheet">
									<ReceiptText size={25} /><small>НОВИЙ РАХУНОК</small><strong>490,00 ₴</strong>
									<dl><div><dt>Отримувач</dt><dd>Кав'ярня «Крапка»</dd></div><div><dt>Призначення</dt><dd>Замовлення №1046</dd></div></dl>
									<button type="button" onclick={nextStep}>Створити рахунок</button>
								</div>
							{:else if activeStep === 2}
								<div class="merchant-share"><small>РАХУНОК ГОТОВИЙ</small><strong>490,00 ₴</strong><div class="scenario-qr"><QrCode size={86} /></div><p>Наведіть камеру на QR</p><button type="button" onclick={nextStep}><Link2 size={16} /> Поділитися посиланням</button></div>
							{:else}
								<div class="merchant-success"><span><Check size={31} /></span><small>ОПЛАТУ ПІДТВЕРДЖЕНО</small><strong>+ 490,00 ₴</strong><p>Замовлення №1046</p><dl><div><dt>Статус</dt><dd>Зараховано</dd></div><div><dt>Час</dt><dd>щойно</dd></div></dl><button type="button" onclick={nextStep}>Готово</button></div>
							{/if}
						</div>
					{:else}
						<div class="payer-flow" data-step={activeStep}>
							{#if activeStep === 0}
								<div class="payer-entry"><QrCode size={72} /><small>RAHUNOK PAY</small><strong>Оплата без картки</strong><p>Безпечно відкрийте checkout від Кав'ярні «Крапка».</p><button type="button" onclick={nextStep}>Відкрити оплату</button></div>
							{:else if activeStep === 1}
								<div class="payer-banks"><small>ДО СПЛАТИ</small><strong>490,00 ₴</strong><p>Оберіть свій банк</p><BankLogoCarousel banks={checkoutBanks} bind:selected={selectedBank} autoplay interval={480} /><button class="payer-bank-continue" type="button" onclick={nextStep}>Продовжити з {checkoutBanks[selectedBank].shortName}</button></div>
							{:else if activeStep === 2}
								<div class="bank-approval"><div class="bank-mark"><Landmark size={23} /></div><small>BANK LVIV ONLINE</small><strong>Підтвердити 490,00 ₴</strong><dl><div><dt>Кому</dt><dd>Кав'ярня «Крапка»</dd></div><div><dt>З рахунку</dt><dd>•• 4821</dd></div></dl><button type="button" onclick={nextStep}><Smartphone size={16} /> Підтвердити в банку</button></div>
							{:else}
								<div class="payer-success"><span><Check size={31} /></span><small>ПЛАТІЖ УСПІШНИЙ</small><strong>Сплачено</strong><b>490,00 ₴</b><p>Кав'ярня «Крапка» вже отримала підтвердження.</p><button type="button" onclick={nextStep}>Готово</button></div>
							{/if}
						</div>
					{/if}
				</div>

				<div class="role-demo__progress">
					<span>Крок {activeStep + 1} із 4</span>
					<div>{#each scenario.steps as _, index}<button type="button" aria-label={`Крок ${index + 1}`} class:active={activeStep === index} onclick={() => chooseStep(index)}></button>{/each}</div>
				</div>
			</div>
		</div>
	</div>
</section>