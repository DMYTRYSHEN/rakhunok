<script lang="ts">
	import { tick } from 'svelte';
	import FuelStationDemo from './FuelStationDemo.svelte';
	import { Fuel } from '@lucide/svelte';
	import { ScanBarcode, Utensils, Croissant, Truck, Dumbbell, GraduationCap, PawPrint, Sparkles, Camera, Ticket, Gift, Laptop, BriefcaseBusiness, BedDouble } from '@lucide/svelte';
	import { ArrowDown, ArrowRight, Coffee, ShoppingBag, Scissors, ExternalLink, Wrench, Flower2, HeartHandshake, X, Check, Landmark, RotateCcw, Grid2X2 } from '@lucide/svelte';

	let { onConnect }: { onConnect: () => void } = $props();
	let selected = $state(0);
	let modal: HTMLDialogElement;
	let modalOpen = $state(false);
	let view = $state<'businesses' | 'demo'>('demo');
	let step = $state(0);
	let bank = $state('');
	let qr = $state('');
	let qrFailed = $state(false);
	const scenarios = [
		{ name: 'Каси самообслуговування', icon: ScanBarcode, image: '/images/landing/editorial-kso.jpg', alt: 'Продуктовий магазин', line: 'Ваш кошик. Ваш темп.', detail: 'Скануйте товари на касі. Перевіряйте рахунок у своєму телефоні.', merchant: 'Маркет · Каса № 03', purpose: 'Кошик · 3 товари', amount: '286,00', demo: 'kso', story: 'Хліб до вечері, молоко й кава на ранок. Покупець сканує товари на касі самообслуговування, відкриває рахунок за QR та перевіряє кошик перед переходом у банк.', benefit: 'Каса, кошик і сума в одному рахунку. Інтеграція з КСО погоджується окремо.' },
		{ name: 'АЗК', icon: Fuel, image: '/images/landing/editorial-fuel.jpg', alt: 'Освітлена автозаправна станція біля дороги', line: 'Оберіть колонку. Оплатіть. У дорогу.', detail: 'Пальне чи зарядка. Введіть суму, літри або кВт·год.', merchant: 'АЗК · Колонка № 1', purpose: 'А-95 · 20 літрів', amount: '1 200,00', demo: 'local-fuel', story: 'Водій обирає колонку, тип пального або зарядку, задає суму чи обсяг і переходить до оплати. Усе замовлення перед очима, не відходячи від авто.', benefit: 'Колонка, пальне та обсяг в одному замовленні. Інтеграція зі станцією погоджується окремо.' },
		{ name: 'Кав’ярні', icon: Coffee, image: '/images/landing/editorial-cafe.jpg', alt: 'Інтер’єр львівської кав’ярні «Штука» зі столиками', line: 'Більше часу для гостей.', detail: 'Рахунок, склад замовлення та чайові в телефоні гостя.', merchant: 'Бістро «Смак»', purpose: 'Столик 12 · 2 позиції', amount: '386,00', demo: 'table_items', story: 'Розмова ще триває. Кава вже допита. Гість відкриває рахунок за столиком, а команда залишається поруч із гостями.', benefit: 'Столик, замовлення та сума залишаються разом.' },
		{ name: 'Магазини', icon: ShoppingBag, image: '/images/landing/editorial-retail.jpg', alt: 'Одяг у світлому магазині', line: 'Обрали. Написали. Замовили.', detail: 'Для продажів у магазині, соцмережах і звичному чаті.', merchant: 'Онлайн-замовлення', purpose: 'Замовлення № 1042', amount: '1 240,00', demo: '1', story: '«Забираю!» у повідомленні стає замовленням. Продавець надсилає рахунок у тому самому чаті, де клієнт знайшов свою річ.', benefit: 'Клієнт бачить призначення платежу до переходу в банк.' },
		{ name: 'Краса й догляд', icon: Scissors, image: '/images/landing/editorial-beauty.jpg', alt: 'Реальний інтер’єр салону краси', line: 'Ваша майстерність. Їхній момент.', detail: 'Послуга, майстер і вартість в одному рахунку.', merchant: 'Салон краси', purpose: 'Стрижка та фарбування · Олена', amount: '1 800,00', demo: 'vertical_beauty', story: 'Останній погляд у дзеркало. Новий запис у календарі. Майстер надсилає рахунок за візит, не перериваючи розмови.', benefit: 'Зрозуміло, за яку послугу та якому бізнесу платити.' },
		{ name: 'Автосервіс', icon: Wrench, image: '/images/landing/editorial-auto.jpg', alt: 'Автомобіль на обслуговуванні в приміщенні СТО', line: 'Знову в дорогу.', detail: 'Перелік робіт і рахунок до того, як клієнт забере авто.', merchant: 'Автомайстерня', purpose: 'Планове обслуговування', amount: '2 400,00', demo: 'vertical_auto', story: 'Авто готове до щоденних маршрутів. Майстер пояснює виконані роботи, клієнт переглядає їх у рахунку.', benefit: 'Вартість робіт не губиться в листуванні.' },
		{ name: 'Квіти', icon: Flower2, image: '/images/landing/editorial-flowers.jpg', alt: 'Квіткова крамниця з букетами та вазами квітів', line: 'Для тих, про кого думаєте.', detail: 'Букет на замовлення. Рахунок за посиланням.', merchant: 'Квіткова майстерня', purpose: 'Сезонний букет', amount: '950,00', demo: 'vertical_flowers', story: 'Обрати квіти можна навіть з іншого міста. Флорист погоджує букет у чаті й надсилає рахунок замовнику.', benefit: 'Одна зрозуміла сума за погоджене замовлення.' },
		{ name: 'Добрі справи', icon: HeartHandshake, image: '/images/landing/editorial-community.jpg', alt: 'Спільна робота волонтерів', line: 'Маленький внесок. Спільна справа.', detail: 'Мета збору та отримувач перед очима благодійника.', merchant: 'Благодійна ініціатива', purpose: 'Приклад благодійного внеску', amount: '200,00', demo: 'donation', story: 'Підтримати важливу справу починається з довіри. Людина бачить отримувача й призначення внеску до підтвердження у банку.', benefit: 'Демонстраційний приклад, не чинний збір.' }
	];
	const additionalBusinesses = [
		{ name: 'Ресторани', icon: Utensils, photo: 'restaurant', alt: 'Ресторанний зал із сервірованими столами та білими скатертинами', line: 'Вечеря у вашому темпі.', purpose: 'Вечеря на двох', amount: '1 460,00', story: 'Офіціант передає рахунок гостям. Замовлення та сума залишаються пов’язаними зі столиком.' },
		{ name: 'Пекарні', icon: Croissant, photo: 'bakery', alt: 'Свіжий хліб у пекарні', line: 'Теплий хліб. Добрий ранок.', purpose: 'Хліб та випічка', amount: '185,00', story: 'Гість обирає улюблену випічку. Продавець формує один рахунок за все замовлення.' },
		{ name: 'Доставка їжі', icon: Truck, photo: 'delivery', alt: 'Піца для замовлення', line: 'Вечеря прямує до вас.', purpose: 'Замовлення з доставкою', amount: '640,00', story: 'Меню та адресу погоджено. Клієнт отримує рахунок за замовлення. Інтеграція доставки погоджується окремо.' },
		{ name: 'Фітнес-студії', icon: Dumbbell, photo: 'fitness', alt: 'Обладнання тренувального залу', line: 'Час, присвячений собі.', purpose: 'Персональне тренування', amount: '700,00', story: 'Тренер і клієнт домовляються про заняття. Рахунок містить погоджену послугу й вартість.' },
		{ name: 'Курси й репетитори', icon: GraduationCap, photo: 'education', alt: 'Навчальні матеріали для заняття', line: 'Наступний крок до знань.', purpose: 'Індивідуальне заняття', amount: '500,00', story: 'Викладач погоджує час уроку та надсилає рахунок у звичний чат.' },
		{ name: 'Зоосервіси', icon: PawPrint, photo: 'pets', alt: 'Догляд за собакою', line: 'Турбота про найрідніших.', purpose: 'Грумінг', amount: '850,00', story: 'Послуги погоджено. Адміністратор надсилає власнику рахунок за догляд.' },
		{ name: 'Клінінг', icon: Sparkles, photo: 'cleaning', alt: 'Професійне прибирання приміщення', line: 'Чистий простір для життя.', purpose: 'Прибирання квартири', amount: '1 600,00', story: 'Команда завершує прибирання. Клієнт перевіряє погоджений обсяг робіт і суму.' },
		{ name: 'Фотографи', icon: Camera, photo: 'photography', alt: 'Фотокамера та об’єктиви', line: 'Моменти залишаються.', purpose: 'Портретна фотосесія', amount: '2 500,00', story: 'Зйомку погоджено в листуванні. Фотограф надсилає рахунок за обраний пакет послуг.' },
		{ name: 'Події й майстер-класи', icon: Ticket, photo: 'events', alt: 'Простір для святкової події', line: 'Зустрічі, які надихають.', purpose: 'Участь у майстер-класі', amount: '900,00', story: 'Організатор надсилає рахунок, перевіряє надходження й окремо підтверджує участь.' },
		{ name: 'Подарункові майстерні', icon: Gift, photo: 'gifts', alt: 'Упаковані подарунки', line: 'Особливе. Саме для них.', purpose: 'Подарунковий набір', amount: '1 150,00', story: 'Наповнення та персоналізацію узгоджено. Майстерня збирає деталі в один рахунок.' },
		{ name: 'Ремонт техніки', icon: Laptop, photo: 'repair', alt: 'Робота з електронним обладнанням', line: 'Знову працює. Знову поруч.', purpose: 'Діагностика та ремонт', amount: '1 200,00', story: 'Майстер узгоджує ремонт. Клієнт бачить погоджену вартість перед оплатою.' },
		{ name: 'Консультанти й фрилансери', icon: BriefcaseBusiness, photo: 'consulting', alt: 'Робоча зустріч із документами', line: 'Ваш досвід має цінність.', purpose: 'Консультація', amount: '1 500,00', story: 'Зустріч завершується конкретними рішеннями. Фахівець надсилає рахунок за послугу.' },
		{ name: 'Готелі й садиби', icon: BedDouble, photo: 'hotel', alt: 'Територія готелю', line: 'Місце для нових спогадів.', purpose: 'Проживання · одна доба', amount: '2 200,00', story: 'Гість погоджує дати та умови. Адміністратор надсилає рахунок; підтвердження бронювання залишається окремим процесом.' }
	].map((business, index) => ({ ...business, image: `/images/landing/editorial-${business.photo}.jpg`, merchant: business.name, demo: `local-${index}`, detail: business.purpose, benefit: 'Отримувач, послуга та погоджена сума перед очима клієнта.' }));
	const businesses = [...scenarios, ...additionalBusinesses];
	const current = $derived(businesses[selected]);
	$effect(() => {
		if (!modalOpen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => { document.body.style.overflow = previous; };
	});
	async function openDemo(index = selected) {
		selected = index;
		step = 0;
		bank = '';
		qr = '';
		qrFailed = false;
		view = 'demo';
		modal.showModal();
		modalOpen = true;
		await tick();
		modal.querySelector<HTMLButtonElement>('.modal-close')?.focus();
		modal.scrollTop = 0;
		const scenarioId = businesses[index].demo;
		if (scenarioId === 'kso' || scenarioId.startsWith('local-')) return;
		try {
			const { toDataURL } = await import('qrcode');
			const image = await toDataURL(`https://letsrealtalk.com/pay/?demo=${scenarioId}`, { width: 160, margin: 2, color: { dark: '#172b24', light: '#ffffff' } });
			if (businesses[selected].demo === scenarioId) qr = image;
		} catch { qrFailed = true; }
	}
	async function openBusinesses() {
		view = 'businesses';
		modal.showModal();
		modalOpen = true;
		await tick();
		modal.querySelector<HTMLButtonElement>('.modal-close')?.focus();
		modal.scrollTop = 0;
	}
</script>

<section class="experience" aria-labelledby="promo-title">
	<div class="experience-media">
		<img src={current.image} alt={current.alt} class="visible" fetchpriority="high" />
	</div>
	<div class="experience-content">
		<div class="experience-heading">
			<p class="eyebrow">ВАША СПРАВА. ВАШ RAHUNOK.</p>
			<h1 id="promo-title">Rahunok<span>.</span></h1>
			<div class="experience-message" aria-live="polite" aria-atomic="true">
				<p class="statement">{current.line}</p>
				<p class="description">{current.detail}</p>
			</div>
			<button class="connect" type="button" onclick={onConnect}>Обговорити підключення <ArrowRight size={18} /></button>
		</div>
		<div class="experience-bottom">
			<div class="scenario-options" role="group" aria-label="Сценарій для вашого бізнесу">
				{#each scenarios as scenario, index (scenario.demo)}
					<button type="button" aria-pressed={selected === index} aria-controls="hero-invoice" onclick={() => (selected = index)}>
						<scenario.icon size={19} /><span>{scenario.name}</span>
					</button>
				{/each}
			</div>
			<div id="hero-invoice" class="invoice-preview">
				<div class="invoice-details" aria-live="polite" aria-atomic="true">
					<span class="demo-label">ПРИКЛАД РАХУНКУ</span>
					<strong>{current.merchant}</strong>
					<span class="purpose">{current.purpose}</span>
				</div>
				<p class="invoice-amount">{current.amount}<span> ₴</span></p>
				<button class="open-scenario" type="button" onclick={() => openDemo()} aria-haspopup="dialog">Відкрити демо <ArrowRight size={17} /></button>
			</div>
			<div class="experience-footer">
				<a href="#demo">Від рахунку до перевірки <ArrowDown size={15} /></a>
				<button type="button" onclick={openBusinesses} aria-haspopup="dialog">Знайдіть свою справу <Grid2X2 size={15} /></button>
			</div>
		</div>
	</div>
</section>

<dialog bind:this={modal} class="scenario-modal" aria-labelledby="scenario-modal-title" onclose={() => (modalOpen = false)}>
	<button class="modal-close" type="button" onclick={() => modal.close()} aria-label="Закрити демо" title="Закрити"><X size={22} /></button>
	{#if view === 'businesses'}
		<div class="business-intro"><p class="eyebrow">ЩОДНЯ. ПОРУЧ. ДЛЯ СВОЇХ.</p><h2 id="scenario-modal-title">Україна робить своє.</h2><p>Ранкова кава. Перше замовлення. Добра справа.<br />Знайдіть історію, схожу на вашу.</p></div>
		<div class="business-grid">
			{#each businesses as scenario, index (scenario.demo)}
				<button class="business-tile" type="button" onclick={() => openDemo(index)}>
					<img src={scenario.image} alt={scenario.alt} loading="lazy" />
					<span class="tile-caption"><scenario.icon size={21} /><strong>{scenario.name}</strong><ArrowRight size={20} /></span>
				</button>
			{/each}
		</div>
	{:else}
		<p class="checkout-promise">Налаштуйте параметри checkout-сторінки <strong>за одну хвилину.</strong></p>
		<div class="story-cover"><img src={current.image} alt={current.alt} /><div><p class="eyebrow">RAHUNOK ДЛЯ ВАШОЇ СПРАВИ</p><h2 id="scenario-modal-title">{current.line}</h2><p>{current.story}</p></div></div>
		<div class="story-body">
			<div class="story-copy"><p class="eyebrow">ВІД ПЕРШОГО «ТАК» ДО РАХУНКУ</p><h3>{current.benefit}</h3>
				{#if current.demo !== 'local-fuel'}<div class="story-steps" role="group" aria-label="Етап демо">
					{#each ['Рахунок', 'Банк', 'Підтвердження'] as label, index (label)}<button type="button" aria-pressed={step === index} onclick={() => { step = index; bank = ''; }}><span>0{index + 1}</span>{label}</button>{/each}
				</div>
				<p class="story-note">{step === 0 ? 'Отримувач, призначення та сума в одному місці. Без пошуку реквізитів у повідомленнях.' : step === 1 ? 'Клієнт обирає банк. У реальному сценарії переказ підтверджується в банківському застосунку.' : 'Бізнес перевіряє фактичне надходження. Повернення з банку саме по собі не підтверджує оплату.'}</p>
				{:else}<p class="story-note">Колонка → пальне або зарядка → сума чи обсяг → банк → оплата. Для заряджання обсяг вимірюється у кВт·год.</p>{/if}
				<button class="other-business" type="button" onclick={openBusinesses}><Grid2X2 size={17} /> Інша справа</button>
				{#if current.demo !== 'kso' && !current.demo.startsWith('local-')}<div class="mobile-handoff">{#if qr}<img src={qr} width="112" height="112" alt="QR-код мобільного демо" />{/if}<div><strong>Продовжити на смартфоні</strong><p>{qrFailed ? 'Мобільне демо доступне за посиланням.' : 'QR відкриє окремий мобільний демосценарій. Дані цього прикладу не переносяться.'}</p><a href={`https://letsrealtalk.com/pay/?demo=${current.demo}`} target="_blank" rel="noreferrer">Мобільне демо <ExternalLink size={14} /></a></div></div>{/if}
			</div>
			{#if current.demo === 'local-fuel'}
				{#key modalOpen}<FuelStationDemo />{/key}
			{:else}<div class="demo-checkout"><div class="demo-top"><span>rahunok</span><span>ДЕМО</span></div><current.icon size={28} /><h3>{current.merchant}</h3><p class="demo-purpose">{current.purpose}</p><p class="demo-total">{current.amount} <span>₴</span></p>
				<div class="demo-state" aria-live="polite" aria-atomic="true">
					{#if current.demo === 'kso' && step === 0}<div class="demo-summary"><span>Хліб · 1 шт.</span><strong>46,00 ₴</strong></div><div class="demo-summary"><span>Молоко · 1 шт.</span><strong>60,00 ₴</strong></div><div class="demo-summary"><span>Кава · 1 шт.</span><strong>180,00 ₴</strong></div>{/if}
					{#if step === 0}<div class="demo-summary"><span>Рахунок</span><strong>№ 00490</strong></div><div class="demo-summary"><span>До сплати</span><strong>{current.amount} ₴</strong></div><button class="open-scenario" type="button" onclick={() => (step = 1)}>Обрати банк <ArrowRight size={17} /></button>
					{:else if step === 1}<p class="bank-caption">Банк покупця · приклад</p><div class="demo-banks">{#each ['monobank', 'ПриватБанк', 'А-Банк'] as name (name)}<button type="button" aria-pressed={bank === name} onclick={() => (bank = name)}><Landmark size={17} />{name}{#if bank === name}<Check size={16} />{/if}</button>{/each}</div><button class="open-scenario" type="button" disabled={!bank} onclick={() => (step = 2)}>Продовжити демо <ArrowRight size={17} /></button>
					{:else}<div class="demo-confirmation"><Check size={30} /><strong>Приклад підтвердження</strong><p>Після перевірки надходження рахунок отримує статус «Сплачено».</p></div><button class="restart-demo" type="button" onclick={() => { step = 0; bank = ''; }}><RotateCcw size={16} /> Ще раз</button>{/if}
				</div><p class="demo-disclaimer">Ілюстрація сценарію. Без реальних переказів.</p>
			</div>{/if}
		</div>
	{/if}
</dialog>

<style>
	.experience { position: relative; isolation: isolate; color: white; background: #252a27; }
	.experience-media { position: absolute; inset: 0; overflow: hidden; z-index: -2; }
	.experience-media img { width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover; object-position: center 48%; opacity: 0; transform: scale(1.025); transition: opacity 420ms ease, transform 900ms ease; }
	.experience-media img.visible { opacity: 1; transform: scale(1); }
	.experience::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgb(10 22 18 / 72%), rgb(10 22 18 / 18%) 65%), linear-gradient(0deg, rgb(10 22 18 / 62%), transparent 45%); }
	.experience-content { max-width: 1280px; margin: auto; min-height: 640px; padding: 42px 40px 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; box-sizing: border-box; }
	.eyebrow { margin: 0 0 8px; font-size: 11px; font-weight: 700; }
	.experience h1 { margin: 0; color: white; font-size: 96px; font-weight: 600; line-height: 1.08; }
	.experience h1 span { color: #fb7966; }
	.experience-message { min-height: 104px; max-width: 490px; margin-top: 14px; }
	.statement { margin: 0 0 12px; font-size: 29px; line-height: 1.2; font-weight: 600; text-wrap: balance; }
	.description { margin: 0; font-size: 15px; line-height: 1.55; max-width: 370px; }
	.connect, .open-scenario { display: inline-flex; align-items: center; justify-content: center; gap: 14px; min-height: 48px; padding: 0 20px; border: 0; border-radius: 4px; background: #c54132; color: white; font: inherit; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; }
	.connect { margin-top: 18px; }
	.connect:hover, .open-scenario:hover { background: #a93225; }
	.scenario-options { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
	.scenario-options button { display: flex; align-items: center; gap: 10px; padding: 12px 18px; min-height: 48px; color: white; background: rgb(15 25 22 / 70%); border: 1px solid rgb(255 255 255 / 38%); border-radius: 4px; font: inherit; font-size: 13px; cursor: pointer; }
	.scenario-options button[aria-pressed='true'] { background: #fff; color: #1b332a; border-color: white; }
	.invoice-preview { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 32px; padding: 20px 24px; background: #fff; color: #172b24; border-top: 3px solid #b8db9b; }
	.invoice-details { display: grid; gap: 4px; }
	.demo-label { font-size: 9px; color: #53695e; font-weight: 700; }
	.invoice-details strong { font-size: 18px; }
	.purpose { font-size: 12px; color: #5d6863; }
	.invoice-amount { margin: 0; white-space: nowrap; font-size: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
	.invoice-amount span { color: #6d7973; font-size: 21px; }
	.open-scenario { background: #203e32; }
	.open-scenario:hover { background: #315541; }
	.experience-footer { display: flex; justify-content: space-between; gap: 20px; padding-top: 18px; }
	.experience-footer a, .experience-footer button { display: inline-flex; align-items: center; gap: 10px; color: white; font: inherit; font-size: 11px; text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; }
	.experience-footer a:hover { text-decoration: underline; }
	button:focus-visible, a:focus-visible { outline: 3px solid #edaf5f; outline-offset: 4px; }
	.scenario-modal { inset: 0; margin: auto; width: min(1080px, calc(100% - 48px)); max-height: calc(100dvh - 48px); padding: 0; border: 0; border-radius: 8px; background: #fafbf9; color: #172b24; overscroll-behavior: contain; font-family: inherit; }
	.scenario-modal::backdrop { background: rgb(10 18 15 / 70%); backdrop-filter: blur(12px); }
	.scenario-modal[open] { animation: reveal 240ms ease-out; }
	.checkout-promise { margin: 0; padding: 24px 76px 24px 28px; background: #e5eedf; color: #203e32; font-size: 16px; line-height: 1.5; text-wrap: pretty; overflow-wrap: anywhere; }
	.checkout-promise strong { font-weight: 700; }
	.modal-close { position: sticky; top: 16px; margin: 16px 16px -56px auto; z-index: 2; display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: white; color: #172b24; cursor: pointer; box-shadow: 0 2px 12px #0002; }
	.story-cover { position: relative; min-height: 380px; display: flex; align-items: end; isolation: isolate; padding: 44px; box-sizing: border-box; color: white; }
	.story-cover > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
	.story-cover::before { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, #102319e8, #10231900); z-index: -1; }
	.story-cover h2 { font-size: 40px; line-height: 1.15; max-width: 650px; margin: 12px 0; text-wrap: balance; }
	.story-cover p:last-child { max-width: 570px; font-size: 15px; line-height: 1.65; margin: 0; }
	.story-body { padding: 44px; display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 56px; }
	.story-copy h3 { font-size: 27px; line-height: 1.3; margin: 12px 0 28px; }
	.story-steps { display: flex; border-bottom: 1px solid #dce1dc; }
	.story-steps button { flex: 1; min-width: 0; display: grid; gap: 6px; padding: 12px 4px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 12px; cursor: pointer; color: #56635b; }
	.story-steps button[aria-pressed='true'] { border-color: #c54132; color: #172b24; }
	.story-steps span { font-size: 10px; }
	.story-note { font-size: 14px; line-height: 1.7; min-height: 96px; }
	.other-business, .restart-demo { display: inline-flex; gap: 8px; align-items: center; justify-content: center; min-height: 44px; border: 0; background: none; color: #234c3d; font: inherit; font-size: 13px; cursor: pointer; }
	.mobile-handoff { border-top: 1px solid #dce1dc; padding-top: 22px; margin-top: 24px; display: flex; align-items: center; gap: 16px; }
	.mobile-handoff img { flex-shrink: 0; }
	.mobile-handoff strong { font-size: 13px; }
	.mobile-handoff p { font-size: 11px; line-height: 1.6; color: #56635b; }
	.mobile-handoff a { display: inline-flex; gap: 8px; color: #234c3d; font-size: 12px; align-items: center; }
	.demo-checkout { background: white; border: 1px solid #dce1dc; border-radius: 8px; padding: 24px; text-align: center; align-self: start; box-shadow: 0 12px 32px #1934260a; }
	.demo-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; font-weight: 700; }
	.demo-top span:last-child { font-size: 9px; color: #65716a; }
	.demo-checkout h3 { font-size: 19px; margin: 12px 0 8px; }
	.demo-purpose { font-size: 12px; min-height: 34px; color: #65716a; }
	.demo-total { font-size: 36px; margin: 16px 0 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
	.demo-total span { font-size: 23px; color: #65716a; }
	.demo-state { min-height: 230px; }
	.demo-summary { display: flex; justify-content: space-between; font-size: 12px; padding: 14px 0; border-top: 1px solid #e9ece8; }
	.demo-state .open-scenario { width: 100%; margin-top: 16px; padding: 0 12px; }
	.open-scenario:disabled { opacity: .45; cursor: not-allowed; }
	.bank-caption { font-size: 12px; margin: 0 0 12px; }
	.demo-banks { display: grid; gap: 6px; }
	.demo-banks button { display: flex; gap: 8px; align-items: center; text-align: left; padding: 10px 12px; min-height: 44px; border: 1px solid #dce1dc; background: white; color: #172b24; border-radius: 4px; font: inherit; font-size: 12px; cursor: pointer; }
	.demo-banks button[aria-pressed='true'] { background: #eef5e8; border-color: #719164; }
	.demo-confirmation { display: grid; justify-items: center; gap: 12px; padding: 20px 0; color: #26725a; }
	.demo-confirmation p { margin: 0; font-size: 12px; line-height: 1.6; color: #56635b; }
	.demo-disclaimer { font-size: 10px; color: #65716a; border-top: 1px solid #e9ece8; padding-top: 18px; margin: 18px 0 0; }
	.business-intro { padding: 56px 40px 24px; }
	.business-intro h2 { font-size: 40px; margin: 12px 0; line-height: 1.15; }
	.business-intro > p:last-child { font-size: 15px; line-height: 1.7; color: #56635b; }
	.business-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 0 40px 40px; }
	.business-tile { position: relative; border: 0; padding: 0; overflow: hidden; border-radius: 4px; background: #172b24; color: white; aspect-ratio: 4 / 5; font: inherit; text-align: left; cursor: pointer; }
	.business-tile img { width: 100%; height: 100%; object-fit: cover; transition: transform 300ms; }
	.business-tile:hover img { transform: scale(1.04); }
	.tile-caption { position: absolute; inset: auto 0 0; display: flex; align-items: center; gap: 10px; padding: 40px 16px 20px; background: linear-gradient(transparent, #102319e8); }
	.tile-caption strong { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 14px; }
	@keyframes reveal { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
	@media (min-width: 1600px) { .experience-content { min-height: 710px; } }
	@media (max-width: 760px) {
		.experience-content { padding: 30px 20px 20px; min-height: 680px; gap: 30px; }
		.experience h1 { font-size: 62px; }
		.experience-media img { object-position: 62% center; }
		.experience::before { background: linear-gradient(90deg, rgb(10 22 18 / 78%), rgb(10 22 18 / 25%)), linear-gradient(0deg, rgb(10 22 18 / 55%), transparent); }
		.experience-message { min-height: 114px; max-width: 340px; }
		.statement { font-size: 25px; }
		.description { font-size: 13px; max-width: 290px; }
		.connect { margin-top: 8px; }
		.scenario-options { gap: 5px; }
		.scenario-options button { flex: 1 1 30%; flex-direction: column; justify-content: center; gap: 6px; padding: 10px 4px; font-size: 11px; }
		.invoice-preview { grid-template-columns: 1fr auto; gap: 16px 8px; padding: 15px; }
		.invoice-details { min-width: 0; }
		.invoice-details strong { font-size: 14px; }
		.purpose { font-size: 10px; min-height: 28px; }
		.invoice-amount { font-size: 23px; }
		.invoice-amount span { font-size: 15px; }
		.open-scenario { grid-column: 1 / -1; }
		.experience-footer { gap: 10px; }
		.experience-footer a, .experience-footer button { font-size: 10px; gap: 4px; max-width: 48%; }
		.experience-footer :global(svg) { flex-shrink: 0; }
		.scenario-modal { width: calc(100% - 16px); max-height: calc(100dvh - 16px); }
		.story-cover { min-height: 360px; padding: 60px 24px 28px; }
		.story-cover h2, .business-intro h2 { font-size: 30px; }
		.story-cover p:last-child { font-size: 13px; }
		.story-body { grid-template-columns: minmax(0, 1fr); padding: 28px 20px; gap: 28px; }
		.story-copy h3 { font-size: 23px; }
		.demo-checkout { width: 100%; max-width: 350px; box-sizing: border-box; justify-self: center; }
		.business-intro { padding: 64px 20px 16px; }
		.business-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0 20px 24px; gap: 10px; }
		.tile-caption { padding: 32px 10px 14px; gap: 6px; flex-wrap: wrap; }
		.tile-caption strong { font-size: 12px; }
		.tile-caption > :global(svg:last-child) { display: none; }
	}
	@media (max-width: 430px) {
		.business-grid { grid-template-columns: minmax(0, 1fr); }
		.business-tile { aspect-ratio: 3 / 2; }
		.tile-caption strong { font-size: 15px; }
	}
	@media (prefers-reduced-motion: reduce) { .experience-media img, .business-tile img { transition: none; transform: none; } .scenario-modal[open] { animation: none; } }
</style>