<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ArrowLeft, ArrowRight, BatteryFull, Check, ChevronRight, Coffee, ExternalLink, Landmark, Link2, LockKeyhole, QrCode, ScanLine, Signal, Store, UserRound, Wifi } from '@lucide/svelte';
	import cafeScene from '../../../2.jpg';
	let active = $state(0);
	let selectedBank = $state('');
	let demoPaid = $state(false);
	let verificationTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(verificationTimer));
	const demoBanks = ['monobank', 'ПриватБанк', 'А-Банк'];
	function selectStage(index: number) {
		clearTimeout(verificationTimer);
		demoPaid = false;
		active = index;
		selectedBank = '';
		if (index === 3) {
			verificationTimer = setTimeout(() => { demoPaid = true; }, 3000);
		}
	}
	const stages = [
		{ label: 'Рахунок', icon: Store, title: 'Ваша робота має цінність.', text: 'Бізнес вказує суму, отримувача та призначення. Далі достатньо QR або посилання.', status: 'Готовий до передачі' },
		{ label: 'Покупець', icon: UserRound, title: 'Усе важливе перед очима.', text: 'Покупець відкриває рахунок у браузері. Бачить, кому, скільки й за що платить.', status: 'Відкритий покупцем' },
		{ label: 'Банк', icon: Landmark, title: 'Знайомий банк. Власне рішення.', text: 'Покупець обирає доступний банк і підтверджує переказ у його застосунку. Умови та комісії визначає банк.', status: 'Перехід до банку' },
		{ label: 'Перевірка', icon: ScanLine, title: 'Впевненість замість припущень.', text: 'Бізнес перевіряє фактичне надходження за погодженим процесом. Повернення з банку саме по собі не означає оплату.', status: 'Очікує перевірки' }
	];
</script>

<section id="demo" class="journey" aria-labelledby="journey-title">
	<div class="promo-container">
		<div class="journey-heading">
			<div><p class="promo-kicker">ВАША СПРАВА. ЙОГО ТЕЛЕФОН.</p><h2 id="journey-title">По обидва боки.<br /><span>Один Rahunok.</span></h2></div>
			<p>Від вашої справи до банку клієнта.<br />Отримувач, сума та призначення завжди разом.</p>
		</div>
		<div class="journey-steps" role="group" aria-label="Етапи демонстрації рахунку">
			{#each stages as stage, index (stage.label)}
				<button type="button" class:current={active === index} aria-pressed={active === index} aria-controls="journey-detail" onclick={() => selectStage(index)}><span class="journey-number">0{index + 1}</span><stage.icon size={19} /><span>{stage.label}</span></button>
			{/each}
		</div>
		<div class="journey-stage" id="journey-detail">
			<div class="journey-copy" aria-live="polite">
				<p class="journey-index">0{active + 1}<span> / 04</span></p>
				<h3>{stages[active].title}</h3>
				<p>{stages[active].text}</p>
				<div class="journey-navigation"><button type="button" disabled={active === 0} aria-label="Попередній етап" title="Попередній етап" onclick={() => selectStage(active - 1)}><ArrowLeft size={20} /></button><button type="button" class="journey-next" onclick={() => selectStage((active + 1) % stages.length)}>{active === 3 ? 'Почати спочатку' : 'Наступний крок'}<ArrowRight size={20} /></button></div>
			</div>
			<div class="journey-product" data-stage={active}>
				<article class="merchant" aria-label="Демонстраційне робоче місце бізнесу">
					<header><Store size={17} /><strong>Ранок</strong><span>БІЗНЕС / ДЕМО</span></header>
					<div class="merchant-scene"><img src={cafeScene} alt="Кава та сніданок у закладі" loading="lazy" /><span>Столик 04</span></div>
					<div class="merchant-content"><p class="merchant-eyebrow">ПОТОЧНИЙ РАХУНОК</p><div class="merchant-total"><span>№ 00490</span><strong>490,00 ₴</strong></div><p class="merchant-purpose">Кава та сніданок</p><div class="merchant-status" class:paid={demoPaid} aria-live="polite" aria-atomic="true">{#if demoPaid}<Check size={14} />{:else}<span class="journey-status-dot"></span>{/if}{demoPaid ? 'Сплачено' : stages[active].status}</div><div class="merchant-handoff"><QrCode size={38} aria-hidden="true" /><span>QR або посилання<small>Ілюстрація, не платіжний код</small></span><Link2 size={18} /></div></div>
					<footer><span class:reached={active >= 1}></span><span class:reached={active >= 2}></span><span class:reached={active >= 3}></span><small>Рахунок → банк → перевірка</small></footer>
				</article>
				<div class="phone-area">
					<div class="phone" aria-label="Демонстраційний checkout покупця">
						<div class="phone-screen">
							<div class="phone-status" aria-hidden="true"><span>9:41</span><span class="phone-island"></span><span><Signal size={12} /><Wifi size={12} /><BatteryFull size={17} /></span></div>
							<div class="phone-address"><LockKeyhole size={10} /> rakhunok.com <span>ДЕМО</span></div>
							<header class="checkout-header"><strong>rahunok<span>.</span></strong><span>№ 00490</span></header>
							<div class="checkout-body">
								<div class="checkout-merchant"><span><Coffee size={21} strokeWidth={1.5} /></span><div><strong>Кав'ярня «Ранок»</strong><small>Столик 04</small></div></div>
								<p class="checkout-amount">490<span>,00 ₴</span></p><p class="checkout-purpose">Кава та сніданок</p>
								<dl><div><dt>Отримувач</dt><dd>Кав'ярня «Ранок»</dd></div><div><dt>Рахунок</dt><dd>№ 00490</dd></div></dl>
								<div class="checkout-state">
									{#if active === 0}<div class="checkout-message"><Link2 size={24} /><strong>Ваш рахунок готовий</strong><p>Сума та отримувач уже в посиланні.</p></div><button class="checkout-action" type="button" onclick={() => selectStage(1)}>Відкрити рахунок <ArrowRight size={16} /></button>
									{:else if active === 1}<div class="checkout-message"><UserRound size={24} /><strong>Перевірте реквізити</strong><p>Підтвердження переказу відбудеться у вашому банку.</p></div><button class="checkout-action" type="button" onclick={() => selectStage(2)}>Обрати банк <ArrowRight size={16} /></button>
									{:else if active === 2}<p class="bank-label">Ваш банк</p><div class="checkout-banks" role="group" aria-label="Банк у демонстрації">{#each demoBanks as bank, index (bank)}<button type="button" aria-pressed={selectedBank === bank} onclick={() => (selectedBank = bank)}><span class="bank-mark" class:bank-mint={index === 1} class:bank-lime={index === 2}><Landmark size={16} /></span><span>{bank}</span>{#if selectedBank === bank}<Check size={16} />{:else}<ChevronRight size={16} />{/if}</button>{/each}</div><button class="checkout-action" type="button" disabled={!selectedBank} onclick={() => selectStage(3)}>Продовжити демо <ExternalLink size={14} /></button>
									{:else}<div class="checkout-message checkout-waiting" class:paid={demoPaid} role="status" aria-atomic="true">{#if demoPaid}<Check size={28} /><strong>Сплачено</strong><p>Демонстрація підтвердженого надходження. Реального переказу не було.</p>{:else}<ScanLine size={28} /><strong>Очікує перевірки</strong><p>Повернення з банку не підтверджує надходження коштів.</p>{/if}</div><button class="checkout-action checkout-reset" type="button" onclick={() => selectStage(0)}>До рахунку <ArrowRight size={16} /></button>{/if}
								</div>
							</div>
							<footer class="checkout-footer"><LockKeyhole size={11} /> Без реальних переказів</footer>
							<div class="phone-home" aria-hidden="true"></div>
						</div>
					</div>
					<p class="journey-caption">ПОКУПЕЦЬ / ДЕМОНСТРАЦІЯ</p>
				</div>
			</div>
		</div>
		<div class="journey-invariants"><span><Check size={15} /> Той самий отримувач</span><span><Check size={15} /> Та сама сума</span><span><Check size={15} /> Те саме призначення</span></div>
	</div>
</section>

<style>
	.journey { padding: 84px 0 64px; background: #e9edef; color: #23262b; scroll-margin-top: 24px; }
	.journey-heading { display: flex; align-items: end; justify-content: space-between; gap: 40px; margin-bottom: 36px; }
	.journey-heading h2 { font-size: 48px; line-height: 1.12; margin-top: 16px; }
	.journey-heading h2 span { color: #5b656c; }
	.journey-heading > p { max-width: 340px; font-size: 15px; line-height: 1.7; color: #535d63; }
	.journey-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #aab5bd; border-bottom: 1px solid #aab5bd; }
	.journey-steps button { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 66px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: #4b565d; font-weight: 700; }
	.journey-steps button.current { color: #202529; border-bottom-color: #e65443; background: #ffffff85; }
	.journey-number { font-size: 11px; font-variant-numeric: tabular-nums; color: #626d74; }
	.journey-stage { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); gap: 36px; align-items: center; padding: 48px 0; }
	.journey-index { font-size: 46px; font-weight: 500; font-variant-numeric: tabular-nums; color: #ca4535; }
	.journey-index span { font-size: 14px; color: #626d74; }
	.journey-copy h3 { font-size: 36px; line-height: 1.2; max-width: 410px; margin: 22px 0 18px; }
	.journey-copy > p:last-of-type { font-size: 16px; line-height: 1.8; min-height: 116px; max-width: 420px; color: #505b63; }
	.journey-navigation { display: flex; gap: 10px; margin-top: 24px; }
	.journey-navigation button { display: inline-flex; align-items: center; justify-content: center; gap: 18px; padding: 12px; min-height: 48px; min-width: 48px; border: 1px solid #aab5bd; border-radius: 4px; background: transparent; color: #23262b; }
	.journey-navigation button:disabled { opacity: .35; cursor: default; }
	.journey-navigation .journey-next { background: #252b30; color: white; border-color: #252b30; padding-inline: 20px; font-size: 13px; }
	.journey-product { display: grid; grid-template-columns: minmax(0, 1fr) 286px; gap: 22px; align-items: center; position: relative; min-width: 0; }
	.merchant { background: #fff; border: 1px solid #bcc5ca; border-radius: 8px; box-shadow: 0 18px 40px #202a3210; overflow: hidden; transform: translateY(24px); transition: transform .5s ease; min-width: 0; }
	.journey-product[data-stage="3"] .merchant { transform: translateY(0); }
	.merchant header { display: flex; align-items: center; gap: 8px; padding: 16px; }
	.merchant header strong { font-size: 14px; }
	.merchant header > span { margin-left: auto; font-size: 8px; color: #657078; }
	.merchant-scene { height: 126px; position: relative; }
	.merchant-scene img { width: 100%; height: 100%; object-fit: cover; }
	.merchant-scene > span { position: absolute; bottom: 10px; left: 12px; background: #fff; padding: 5px 8px; border-radius: 3px; font-size: 10px; }
	.merchant-content { padding: 20px 16px 12px; }
	.merchant-eyebrow { font-size: 9px; color: #626d74; }
	.merchant-total { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; }
	.merchant-total > span { font-size: 12px; }
	.merchant-total strong { font-size: 22px; white-space: nowrap; font-variant-numeric: tabular-nums; }
	.merchant-purpose { font-size: 11px; margin-top: 8px; color: #5b656c; }
	.merchant-status { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 16px 0; margin-top: 8px; border-bottom: 1px solid #e2e6e8; }
	.merchant-handoff { display: flex; gap: 10px; align-items: center; padding-top: 16px; font-size: 10px; }
	.merchant-handoff small { display: block; font-size: 8px; margin-top: 5px; color: #687279; }
	.merchant-handoff :global(svg) { flex-shrink: 0; }
	.merchant footer { display: flex; gap: 4px; flex-wrap: wrap; padding: 12px 16px 18px; }
	.merchant footer > span { flex: 1; height: 3px; background: #dce3e5; transition: background .3s; }
	.merchant footer > span.reached { background: #398375; }
	.merchant footer small { flex-basis: 100%; font-size: 9px; color: #637078; margin-top: 6px; }
	.phone-area { width: 286px; max-width: 100%; }
	.phone { position: relative; padding: 7px; background: linear-gradient(110deg, #cbd0d2, #555d62 18%, #c4cacc 45%, #343a3e 90%, #acb4b7); border: 1px solid #777e82; border-radius: 40px; box-shadow: 0 26px 42px -16px #20282e50, inset 0 0 0 2px #e3e7e8; }
	.phone::before { content: ''; position: absolute; left: -3px; top: 112px; height: 48px; width: 2px; border-radius: 2px; background: #687076; }
	.phone::after { content: ''; position: absolute; right: -3px; top: 132px; height: 62px; width: 2px; border-radius: 2px; background: #687076; }
	.phone-screen { background: #fff; border: 3px solid #1c2023; border-radius: 32px; overflow: hidden; height: 626px; display: flex; flex-direction: column; }
	.phone-status { display: flex; justify-content: space-between; align-items: center; position: relative; padding: 12px 16px 9px; font-size: 10px; font-weight: 700; height: 39px; flex-shrink: 0; }
	.phone-status > span:last-child { display: flex; gap: 3px; align-items: center; }
	.phone-island { width: 76px; height: 21px; border-radius: 20px; background: #15191b; position: absolute; left: 50%; top: 7px; transform: translateX(-50%); }
	.phone-address { display: flex; justify-content: center; align-items: center; gap: 5px; font-size: 9px; padding: 8px; background: #f1f3f4; }
	.phone-address > span { font-size: 7px; color: #687078; margin-left: 8px; }
	.checkout-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #e8ecee; }
	.checkout-header strong { font-size: 18px; }
	.checkout-header strong span { color: #cc493b; }
	.checkout-header > span { color: #6a747b; font-size: 10px; }
	.checkout-body { padding: 18px 18px 0; }
	.checkout-merchant { display: flex; align-items: center; gap: 10px; }
	.checkout-merchant > span { display: grid; place-items: center; width: 35px; height: 35px; border-radius: 50%; background: #e8f2ec; color: #306957; }
	.checkout-merchant strong { font-size: 12px; font-weight: 600; }
	.checkout-merchant small { display: block; font-size: 9px; color: #6a747b; margin-top: 3px; }
	.checkout-amount { font-size: 46px; font-weight: 600; line-height: 1.2; margin-top: 18px; font-variant-numeric: tabular-nums; }
	.checkout-amount span { font-size: 25px; }
	.checkout-purpose { font-size: 11px; color: #69747b; margin-top: 5px; }
	dl { margin: 16px 0 0; border-block: 1px solid #e3e8ea; padding: 10px 0; }
	dl div { display: flex; justify-content: space-between; gap: 8px; font-size: 9px; line-height: 1.9; }
	dt { color: #596870; } dd { margin: 0; text-align: right; }
	.checkout-state { height: 199px; display: flex; flex-direction: column; justify-content: space-between; padding: 14px 0 0; }
	.checkout-message { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
	.checkout-message > :global(svg) { color: #3d7665; }
	.checkout-message strong { font-size: 12px; }
	.checkout-message p { font-size: 10px; line-height: 1.6; color: #5c676e; max-width: 210px; }
	.checkout-waiting > :global(svg) { color: #bd6041; }
	.merchant-status.paid, .checkout-waiting.paid > strong, .checkout-waiting.paid > :global(svg) { color: #26725a; }
	.checkout-action { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 40px; border: 0; border-radius: 5px; padding: 10px 12px; background: #cf493a; color: white; font-size: 11px; font-weight: 600; }
	.checkout-action:disabled { background: #e9edef; color: #6a747b; cursor: default; }
	.checkout-reset { background: #263b33; }
	.bank-label { font-size: 10px; font-weight: 600; }
	.checkout-banks { display: grid; }
	.checkout-banks button { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 3px 0; border: 0; border-bottom: 1px solid #edf0f1; background: transparent; text-align: left; font-size: 11px; }
	.checkout-banks button > :global(svg) { margin-left: auto; }
	.checkout-banks button[aria-pressed="true"] { color: #26725a; font-weight: 700; }
	.bank-mark { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 5px; background: #242b30; color: white; }
	.bank-mark.bank-mint { background: #d8f1df; color: #2c673e; }
	.bank-mark.bank-lime { background: #d7ebbc; color: #335f1a; }
	.checkout-footer { margin-top: auto; display: flex; justify-content: center; align-items: center; gap: 5px; padding: 13px 0 10px; font-size: 8px; color: #677078; }
	.phone-home { width: 86px; height: 4px; border-radius: 4px; background: #24292c; margin: 0 auto 7px; flex-shrink: 0; }
	button:focus-visible { outline: 2px solid #20705a; outline-offset: 3px; }
	.journey-status-dot { width: 6px; height: 6px; background: #ca4535; border-radius: 50%; }
	.journey-caption { font-size: 10px; text-align: center; color: #5b656c; margin-top: 16px; }
	.journey-invariants { display: flex; gap: 32px; justify-content: center; flex-wrap: wrap; border-top: 1px solid #b8c3c9; padding-top: 22px; }
	.journey-invariants span { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #43544d; }
	@media (max-width: 1100px) {
		.journey-stage { grid-template-columns: 1fr; }
		.journey-copy { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 30px; }
		.journey-index { grid-row: span 2; display: none; }
		.journey-copy h3 { margin: 0; }
		.journey-copy > p:last-of-type { min-height: 0; }
		.journey-navigation { margin-top: 0; }
		.journey-product { width: min(100%, 660px); justify-self: center; }
	}
	@media (max-width: 760px) {
		.journey { padding: 48px 0 36px; }
		.journey-heading { display: block; }
		.journey-heading h2 { font-size: 32px; }
		.journey-heading > p { margin-top: 20px; font-size: 14px; }
		.journey-steps button { flex-direction: column; gap: 8px; min-height: 80px; font-size: 10px; padding: 8px 2px; }
		.journey-number { display: none; }
		.journey-stage { grid-template-columns: 1fr; gap: 30px; padding: 26px 0; }
		.journey-copy { display: block; }
		.journey-index { font-size: 28px; }
		.journey-copy h3 { font-size: 27px; min-height: 66px; margin-top: 12px; }
		.journey-copy > p:last-of-type { font-size: 14px; min-height: 101px; }
		.journey-product { grid-template-columns: 1fr; gap: 24px; }
		.phone-area { justify-self: center; grid-row: 1; }
		.phone-screen { height: 650px; }
		.merchant { transform: none; width: min(100%, 380px); justify-self: center; }
		.merchant-scene { display: none; }
		.merchant-content { padding-top: 4px; }
		.merchant-handoff { display: none; }
		.journey-copy > p:last-of-type { min-height: 0; }
		.journey-navigation { margin-top: 18px; }
		.checkout-banks button { min-height: 44px; }
		.checkout-state { height: 224px; }
		.journey-invariants { justify-content: flex-start; gap: 12px; }
	}
	@media (prefers-reduced-motion: reduce) { .merchant, .merchant footer > span { transition: none; } }
</style>