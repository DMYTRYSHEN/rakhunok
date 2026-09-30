<script lang="ts">
	import { resolve, asset } from '$app/paths';
	import {
		ArrowRight,
		Menu,
		X,
		QrCode,
		Link2,
		Code2,
		Check,
		ExternalLink,
		Landmark,
		Plus,
		ShieldCheck,
		Search
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import { getAuthRedirectUrl } from '$lib/features/landing/utils/auth-redirect';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import HeroExperience from './HeroExperience.svelte';
	import InvoiceJourney from './InvoiceJourney.svelte';
	import BrandIcon from './BrandIcon.svelte';
	import ProjectWizard from './ProjectWizard.svelte';
	import UkraineTransfers from './UkraineTransfers.svelte';
	import './promo.css';
	const cafeScene = '/images/landing/editorial-cafe.jpg';
	const retailScene = '/images/landing/editorial-retail.jpg';
	const serviceScene = '/images/landing/editorial-beauty.jpg';

	let { data }: { data: PageData } = $props();
	let bankQuery = $state('');
	let allBanks = $state(false);
	let mapOpen = $state(false);
	let failedLogos = $state<string[]>([]);
	let bankSearch: HTMLInputElement;
	const matchingBanks = $derived(
		data.directory.banks.filter((bank) =>
			`${bank.name} ${bank.id}`.toLocaleLowerCase().includes(bankQuery.trim().toLocaleLowerCase())
		)
	);
	let menuOpen = $state(false);
	let wizardOpen = $state(false);
	
	let scrollY = $state(0);
	let lastScrollY = 0;
	let scrollDirection = $state('up');
	$effect(() => {
		if (scrollY > lastScrollY) scrollDirection = 'down';
		else if (scrollY < lastScrollY) scrollDirection = 'up';
		lastScrollY = scrollY;
	});
	let headerHidden = $derived(scrollY > 80 && scrollDirection === 'down');
	const plans = [
		{
			name: 'Перший рахунок',
			label: 'ПІЛОТ',
			text: 'Для бізнесу, який хоче перевірити свій сценарій.',
			features: [
				'Один погоджений сценарій',
				'Перевірка доступних банків',
				'Узгодження способу звірки'
			],
			action: 'Обговорити пілот'
		},
		{
			name: 'Щоденна робота',
			label: 'БІЗНЕС',
			text: 'Для команди та кількох робочих точок.',
			features: [
				'Вимоги до кас і команди',
				'Історія та статуси рахунків',
				'Окреме погодження інтеграцій'
			],
			action: 'Обговорити бізнес'
		},
		{
			name: 'Власний процес',
			label: 'ПЛАТФОРМА',
			text: 'Для сервісів, яким потрібна інтеграція через API.',
			features: [
				'Перевірка API-контрактів',
				'Погодження доступу й подій',
				'Тестування перед запуском'
			],
			action: 'Обговорити інтеграцію'
		}
	];
	const faqs = [
		[
			'Rahunok — це банк чи електронний гаманець?',
			'Ні. Rahunok організовує рахунок і шлях до оплати. У прямому банківському сценарії покупець підтверджує переказ у своєму банку на реквізити бізнесу.'
		],
		[
			'Чи потрібно покупцю встановлювати Rahunok?',
			'Рахунок відкривається у мобільному браузері. Для переходу до банку можуть знадобитися його встановлений застосунок та доступна інтеграція.'
		],
		[
			'З якими банками можна працювати?',
			'Доступність конкретного сценарію перевіряємо під час підключення. Наявність банку в каталозі не означає партнерства та не гарантує доступності всіх переказів.'
		],
		[
			'Як дізнатися, що рахунок оплачений?',
			'Відкриття банку, повернення на сторінку чи скриншот не підтверджують оплату. Перевірте фактичне надходження за погодженим для вашого бізнесу процесом.'
		],
		[
			'Чи замінює рахунок фіскальний чек?',
			'Ні. Фіскальний документ створюється через окремо підключений і налаштований ПРРО. Платіжне підтвердження його не замінює.'
		],
		[
			'Що робити без інтернету або при поверненні?',
			'Для роботи потрібен інтернет. Після відновлення зв’язку звірте надходження перед повторною оплатою. Повернення виконується за погодженим із банком чи провайдером процесом; скасування рахунку не повертає кошти.'
		]
	];
	const cases = [
		{
			title: 'За ранкову каву.',
			label: 'ЗА СТОЛИКОМ',
			text: 'Гість відкриває рахунок за QR. Команда бачить, який столик очікує на оплату.',
			image: cafeScene,
			alt: 'Робочий сценарій оплати в закладі'
		},
		{
			title: 'За те, що обрали.',
			label: 'БІЛЯ КАСИ',
			text: 'Продавець створює рахунок зі смартфона чи браузера. Покупець переходить до свого банку.',
			image: retailScene,
			alt: 'Робочий сценарій оплати в магазині'
		},
		{
			title: 'За вашу експертизу.',
			label: 'ПІСЛЯ ПОСЛУГИ',
			text: 'Надішліть посилання на рахунок у тому самому чаті, де спілкуєтеся з клієнтом.',
			image: serviceScene,
			alt: 'Робочий сценарій оплати послуги'
		}
	];

	onMount(() => {
		document.documentElement.lang = 'uk';
		const redirectUrl = getAuthRedirectUrl(
			window.location.origin,
			window.location.hash,
			localStorage.getItem('auth_redirect')
		);
		if (redirectUrl) window.location.assign(redirectUrl);
	});

	function handleStoryMove(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		card.style.setProperty('--mouse-x', `${x}px`);
		card.style.setProperty('--mouse-y', `${y}px`);
		card.style.setProperty('--rot-x', `${((y / rect.height) - 0.5) * -12}deg`);
		card.style.setProperty('--rot-y', `${((x / rect.width) - 0.5) * 12}deg`);
	}
	function handleStoryLeave(event: MouseEvent) {
		const card = event.currentTarget as HTMLElement;
		card.style.setProperty('--rot-x', `0deg`);
		card.style.setProperty('--rot-y', `0deg`);
	}
</script>

<svelte:head>
	<title>Rahunok для бізнесу | Рахунок для кожної справи</title>
	<meta
		name="description"
		content="Rahunok (RHNK): рахунки та оплата за IBAN через банк покупця (Pay by Bank). Передавайте QR чи посилання та перевіряйте надходження перед видачею замовлення."
	/>
	<meta name="robots" content={page.url.hostname === 'rakhunok.com' && page.url.pathname === '/' ? 'index, follow' : 'noindex, nofollow'} />
	<meta name="theme-color" content="#f3f4f5" />
	<link rel="canonical" href="https://rakhunok.com/" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Rahunok" />
	<meta property="og:title" content="Rahunok. Ваша справа. Знайомий банк." />
	<meta property="og:description" content="Один рахунок. Від вашої справи до банку клієнта. QR, посилання та перевірка надходження." />
	<meta property="og:url" content="https://rakhunok.com/" />
	<meta property="og:image" content={`https://rakhunok.com${cafeScene}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="promo-site">
	{#snippet terminalLink()}
		<a class="promo-terminal" href="/app" data-sveltekit-reload onclick={() => (menuOpen = false)}>
			<span class="promo-terminal-icon" aria-hidden="true">
				<img class="promo-terminal-plane" src={asset('/images/telegram-logo.svg')} alt="" width="32" height="32" />
				<span class="promo-terminal-coin">₴</span>
			</span>
			<span class="promo-terminal-copy"><strong>Термінал</strong><small>by Rahunok</small></span>
			<ArrowRight size={16} aria-hidden="true" />
		</a>
	{/snippet}
	<a class="promo-skip" href="#content">До вмісту</a>
	<svelte:window bind:scrollY /><header class="promo-header" class:promo-header-hidden={headerHidden} class:promo-header-scrolled={scrollY > 10}>
		<div class="promo-container promo-header-inner">
			<a class="promo-brand" href={resolve('/')} aria-label="Rahunok, на головну"
				><span class="promo-brand-mark"><BrandIcon /></span><span>Rahunok</span></a
			>
			<nav class="promo-nav" aria-label="Основна навігація">
				<a href="#ecosystem">Екосистема</a><a href="#banks">Банки</a><a href="#demo">Покупцю</a><a href="#stories">Бізнесу</a
				><a href="#faq">Підтримка</a>
			</nav>
			<div class="promo-header-actions">
				<div class="promo-terminal-desktop">{@render terminalLink()}</div>
				<a class="promo-login" href={resolve('/dashboard')} data-sveltekit-reload>Увійти</a><button
					class="promo-button promo-header-cta"
					type="button"
					onclick={() => (wizardOpen = true)}>Обговорити підключення <ArrowRight size={17} /></button
				><button
					class="promo-menu-button"
					type="button"
					aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'}
					aria-expanded={menuOpen}
					aria-controls="promo-mobile-nav"
					onclick={() => (menuOpen = !menuOpen)}
					>{#if menuOpen}<X size={22} />{:else}<Menu size={22} />{/if}</button
				>
			</div>
		</div>
		{#if menuOpen}<nav
				id="promo-mobile-nav"
				class="promo-mobile-nav"
				aria-label="Мобільна навігація"
			>
				<a href="#ecosystem" onclick={() => (menuOpen = false)}>Екосистема</a><a
					href="#banks"
					onclick={() => (menuOpen = false)}>Банки</a
				><a
					href="#demo"
					onclick={() => (menuOpen = false)}>Покупцю</a
				><a href="#stories" onclick={() => (menuOpen = false)}>Бізнесу</a><a
					href="#faq"
					onclick={() => (menuOpen = false)}>Підтримка</a
				>{@render terminalLink()}<a href={resolve('/dashboard')} data-sveltekit-reload>Увійти</a>
			</nav>{/if}
	</header>

	<main id="content">
		<HeroExperience onConnect={() => (wizardOpen = true)} />

		<div id="ecosystem"><InvoiceJourney /></div>

		<section id="banks" class="promo-section promo-banks" aria-labelledby="banks-title">
			<div class="promo-container">
				<div class="promo-banks-heading">
					<div><p class="promo-kicker">БАНКІВСЬКІ ЗАСТОСУНКИ</p><h2 id="banks-title">Ваш банк уже знайомий.<br /><span>Знайдіть його тут.</span></h2></div>
					<p>Активні застосунки з каталогу Rahunok для переходу до оплати. Шукайте за назвою або перегляньте повний список.</p>
				</div>
				<div class="promo-bank-tools"><label class="promo-bank-search"><Search size={20} aria-hidden="true" /><span class="promo-sr-only">Пошук банку</span><input bind:this={bankSearch} type="search" bind:value={bankQuery} placeholder="Знайти банк" />{#if bankQuery}<button type="button" aria-label="Очистити пошук" title="Очистити пошук" onclick={() => { bankQuery = ''; bankSearch.focus(); }}><X size={18} /></button>{/if}</label><span role="status">{matchingBanks.length} / {data.directory.banks.length}</span></div>
			{#if data.directory.unavailable}<p class="promo-bank-empty" role="status">Каталог зараз недоступний. Спробуйте пізніше.</p>
			{:else if matchingBanks.length === 0}<p class="promo-bank-empty" role="status">За цією назвою банків не знайдено.</p>
			{:else}<ul id="bank-results" class="promo-bank-grid">{#each bankQuery.trim() || allBanks ? matchingBanks : matchingBanks.slice(0, 8) as bank (bank.id)}<li><div class="promo-bank-logo">{#if bank.logo && !failedLogos.includes(bank.id)}<img src={bank.logo} alt="" width="48" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, bank.id])} />{:else}<Landmark size={26} strokeWidth={1.5} aria-hidden="true" />{/if}</div><span>{bank.name}</span></li>{/each}</ul>{/if}
			{#if !bankQuery.trim() && matchingBanks.length > 8}<button class="promo-text-link promo-bank-expand" type="button" aria-expanded={allBanks} aria-controls="bank-results" onclick={() => (allBanks = !allBanks)}>{allBanks ? 'Згорнути каталог' : `Усі банки (${matchingBanks.length})`}<Plus size={18} /></button>{/if}
			<div class="promo-bank-foot"><p>Наявність у каталозі не означає партнерства з банком і не гарантує доступності кожного переказу. Умови та комісії залежать від банку.</p><a href="https://bank.gov.ua/ua/supervision/institutions" target="_blank" rel="noreferrer">Довідник банків НБУ <ExternalLink size={16} /></a></div>
			<details class="promo-map-disclosure" ontoggle={(event) => (mapOpen = event.currentTarget.open)}><summary>Україна. Від міста до міста.<Plus size={20} /></summary>{#if mapOpen}<UkraineTransfers banks={data.directory.banks} />{/if}</details>
			</div>
		</section>

		<section id="stories" class="promo-section promo-stories" aria-labelledby="stories-title">
			<div class="promo-container">
				<div class="promo-section-head">
					<p class="promo-kicker">ТАМ, ДЕ ВІДБУВАЄТЬСЯ ВАШЕ ЖИТТЯ</p>
					<h2 id="stories-title">Один підхід до рахунків.<br /><span>Різні щоденні сценарії.</span></h2>
					<p>Від столика до власної платформи. Сценарій змінюється, принцип залишається зрозумілим.</p>
				</div>
				<div class="promo-stories-grid">
					{#each cases as story, index (story.label)}<article class="promo-story" onmousemove={handleStoryMove} onmouseleave={handleStoryLeave}>
							<div class="promo-story-image">
								<img src={story.image} alt={story.alt} loading="lazy" />
								<span>0{index + 1}</span>
							</div>
							<div class="promo-story-content">
								<span class="promo-kicker">{story.label}</span>
								<h3>{story.title}</h3>
								<p>{story.text}</p>
							</div>
						</article>{/each}
				</div>
			</div>
		</section>

		<section id="ways" class="promo-section promo-ways" aria-labelledby="ways-title">
			<div class="promo-container">
				<div class="promo-section-head">
					<p class="promo-kicker">ОДИН ПРИНЦИП. РІЗНІ ШЛЯХИ.</p>
					<h2 id="ways-title">Поруч. У чаті.<br /><span>У вашому продукті.</span></h2>
				</div>
				<div class="promo-way-list">
					<div class="promo-way">
						<QrCode size={31} strokeWidth={1.5} /><span>01 / QR</span>
						<h3>Покажіть рахунок.</h3>
						<p>Коли клієнт поруч: за столиком або біля каси.</p>
					</div>
					<div class="promo-way">
						<Link2 size={31} strokeWidth={1.5} /><span>02 / ПОСИЛАННЯ</span>
						<h3>Надішліть рахунок.</h3>
						<p>Коли домовленість уже відбулася в чаті чи онлайн.</p>
					</div>
					<div class="promo-way">
						<Code2 size={31} strokeWidth={1.5} /><span>03 / API</span>
						<h3>Вбудуйте рахунок.</h3>
						<p>
							Коли оплата має бути частиною вашого сервісу. <a href={asset('/docs/')}
								>Документація <ExternalLink size={14} /></a
							>
						</p>
					</div>
				</div>
			</div>
		</section>

		<section id="trust" class="promo-section promo-trust" aria-labelledby="trust-title">
			<div class="promo-container promo-trust-inner">
				<div>
					<ShieldCheck size={32} strokeWidth={1.3} />
					<p class="promo-kicker">ВАЖЛИВА ЯСНІСТЬ</p>
					<h2 id="trust-title">Рахунок у Rahunok.<br /><span>Переказ у банку.</span></h2>
				</div>
				<div class="promo-trust-content">
					<p>
						Rahunok організовує рахунок і шлях до оплати. Покупець підтверджує переказ у своєму
						банку. Бізнес перевіряє надходження перед видачею замовлення.
					</p>
					<p>
						Це сценарій Pay by Bank: покупець бачить отримувача та реквізити IBAN бізнесу
						перед підтвердженням платежу. Open Banking може забезпечити перехід до банку й
						автоматичну звірку лише за наявності відповідної інтеграції. RHNK — скорочення
						назви Rahunok, а не окремий спосіб оплати.
					</p>
					<div class="promo-trust-note">
						<Check size={20} /><span
							>Відкриття банківського застосунку саме по собі не підтверджує оплату. Доступність
							переказу й можливі комісії залежать від банку та умов підключення.</span
						>
					</div>
					<a class="promo-text-link" href="#faq">Відповіді перед стартом <ArrowRight size={17} /></a
					>
				</div>
			</div>
		</section>

		<section id="pricing" class="promo-section promo-pricing" aria-labelledby="pricing-title">
			<div class="promo-container">
				<div class="promo-section-head">
					<p class="promo-kicker">МАСШТАБ ВАШОЇ СПРАВИ</p>
					<h2 id="pricing-title">Від першого рахунку.<br /><span>До власного процесу.</span></h2>
					<p>
						Три формати розмови про підключення. Це не тарифна оферта: вартість сервісу, збори банку
						та інтеграції узгоджуються до запуску.
					</p>
				</div>
				<div class="promo-pricing-grid">
					{#each plans as plan, index (plan.label)}<article class="promo-plan" class:featured={index === 1}>
							<p class="promo-kicker">{plan.label}</p>
							<h3>{plan.name}</h3>
							<p>{plan.text}</p>
							<div class="promo-plan-price">
								За погодженням<span>Умови для вашого сценарію</span>
							</div>
							<ul>
								{#each plan.features as feature (feature)}<li>
										<Check size={17} /><span>{feature}</span>
									</li>{/each}
							</ul>
							<button class="promo-button" type="button" onclick={() => (wizardOpen = true)}>{plan.action}<ArrowRight size={16} /></button>
						</article>{/each}
				</div>
			</div>
		</section>

		<section id="faq" class="promo-section promo-faq" aria-labelledby="faq-title">
			<div class="promo-container promo-faq-layout">
				<div>
					<p class="promo-kicker">БЕЗ ДРІБНОГО ШРИФТУ</p>
					<h2 id="faq-title">Важливе.<br /><span>До початку.</span></h2>
					<button class="promo-text-link" type="button" onclick={() => (wizardOpen = true)}>Запитати команду <ArrowRight size={17} /></button>
				</div>
				<div class="promo-faq-list">
					{#each faqs as [question, answer] (question)}<details>
							<summary>{question}<Plus size={20} /></summary>
							<p>{answer}</p>
						</details>{/each}
				</div>
			</div>
		</section>

		<section class="promo-section promo-setup" aria-labelledby="setup-title">
			<div class="promo-container">
				<div class="promo-section-head">
					<p class="promo-kicker">ВАШ НАСТУПНИЙ КРОК</p>
					<h2 id="setup-title">Просто почати.<br /><span>Уважно налаштувати.</span></h2>
				</div>
				<ol class="promo-setup-grid">
					<li>
						<span>01</span>
						<h3>Познайомимось.</h3>
						<p>Розкажіть про бізнес і те, як клієнти платять вам сьогодні.</p>
					</li>
					<li>
						<span>02</span>
						<h3>Узгодимо.</h3>
						<p>Перевіримо банки, спосіб звірки, інтеграції та вартість.</p>
					</li>
					<li>
						<span>03</span>
						<h3>Спробуємо.</h3>
						<p>Перевіримо погоджений сценарій до запуску реальних оплат.</p>
					</li>
				</ol>
			</div>
		</section>

		<section id="start" class="promo-section promo-start" aria-labelledby="start-title">
			<div class="promo-container promo-start-inner">
				<div>
					<p class="promo-kicker">ПІЛОТ ДЛЯ ВАШОЇ СПРАВИ</p>
					<h2 id="start-title">Почнімо з одного рахунку.</h2>
					<p>
						Розкажіть, як працює ваш бізнес. Разом визначимо сценарій, доступні банки, спосіб
						перевірки надходжень та умови до запуску реальних оплат.
					</p>
					<div class="promo-start-actions">
						<button class="promo-button promo-button-accent" type="button" onclick={() => (wizardOpen = true)}
							>Обговорити проєкт <ArrowRight size={19} /></button
						><a class="promo-text-link" href={resolve('/')}>На головну <ArrowRight size={18} /></a>
					</div>
				</div>
				<figure class="promo-founder-quote">
					<span class="promo-founder-mark" aria-hidden="true"><BrandIcon /></span>
					<blockquote>«Наша мета — пришвидшити рух коштів, мінімізувавши витрати для бізнесу».</blockquote>
					<figcaption>Засновник Rahunok</figcaption>
				</figure>
			</div>
		</section>
	</main>
	<footer class="promo-footer">
		<div class="promo-container">
			<div class="promo-footer-grid">
				<div>
					<a class="promo-brand" href={resolve('/')} aria-label="Rahunok, на головну"
						><span class="promo-brand-mark"><BrandIcon /></span><span>Rahunok</span></a
					>
					<p>Для кожної справи,<br />яка рухається далі.</p>
				</div>
				<nav aria-label="Продукт">
					<h3>Продукт</h3>
					<a href="#ecosystem">Екосистема</a><a href="#banks">Банки</a><a href="#demo">Для покупця</a><a href="#stories"
						>Для бізнесу</a
					><a href={resolve('/dashboard')} data-sveltekit-reload>Кабінет</a>
				</nav>
				<nav aria-label="Ресурси">
					<h3>Ресурси</h3>
					<a href={asset('/docs/')}>API-документація</a><a href="#pricing">Умови підключення</a><a
						href="#faq">Питання та відповіді</a
					>
				</nav>
				<nav aria-label="Команда">
					<h3>На зв’язку</h3>
					<button type="button" onclick={() => (wizardOpen = true)}>Обговорити проєкт</button><a href="mailto:rahunok@rahunok.com"
						>rahunok@rahunok.com</a
					><a href={resolve('/')}>Головна</a>
				</nav>
			</div>
			<div class="promo-footer-bottom">
				<span>© {new Date().getFullYear()} Rahunok</span><span
					>Доступність сервісів та умови погоджуються перед підключенням.</span
				>
			</div>
		</div>
	</footer>
	{#if wizardOpen}<ProjectWizard onclose={() => (wizardOpen = false)} />{/if}
</div>
