<script lang="ts">
	import { faqItems, pricingPlans, proofItems } from '../data/content';
	import SectionHeading from './SectionHeading.svelte';
	let { onSignup }: { onSignup: () => void } = $props();
</script>

<section class="section paper" id="money-flow">
	<div class="money-layout container">
		<div class="money-copy">
			<SectionHeading
				dark
				eyebrow="Куди йдуть гроші"
				title="Ваші кошти"
				accent="не зберігаються в Rahunok."
				copy="У сценарії прямої оплати переказ спрямовується на банківський рахунок вашого ФОП або ТОВ. Rahunok керує рахунком, QR, статусом, звіркою та пов’язаним фіскальним сценарієм."
			/>
			<div class="money-assurances" aria-label="Принципи безпеки платежу">
				<p><span>01</span><b>Реквізити видно до оплати</b></p>
				<p><span>02</span><b>Авторизація тільки у банку</b></p>
				<p><span>03</span><b>Статус підтверджує сервер</b></p>
			</div>
		</div>
		<div class="money-route" aria-label="Маршрут банківського переказу">
			<header>
				<span>Прямий переказ</span>
				<b>Rahunok не є отримувачем коштів</b>
			</header>
			<div class="money-route__path">
				<article>
					<span class="money-route__index">01</span>
					<small>Відправник</small>
					<strong>Клієнт</strong>
					<p>Підтверджує платіж у застосунку свого банку</p>
				</article>
				<div class="money-route__connector" aria-hidden="true"><span>переказ</span></div>
				<article>
					<span class="money-route__index">02</span>
					<small>Авторизація</small>
					<strong>Банк клієнта</strong>
					<p>Перевіряє та виконує операцію</p>
				</article>
				<div class="money-route__connector" aria-hidden="true"><span>зарахування</span></div>
				<article class="money-route__destination">
					<span class="money-route__index">03</span>
					<small>Отримувач</small>
					<strong>Ваш IBAN</strong>
					<p>Рахунок ФОП або ТОВ</p>
				</article>
			</div>
			<div class="money-route__signal">
				<div><span class="money-route__pulse" aria-hidden="true"></span><b>Rahunok бачить статус, не гроші</b></div>
				<p>банк / API <span>→</span> backend Rahunok <span>→</span> статус <span>→</span> ПРРО</p>
			</div>
		</div>
	</div>
	<p class="legal-note container">
		<b>Важливо:</b> рух коштів, строки, перелік банків і комісії залежать від платіжної моделі, партнера
		та договору.
	</p>
</section>

<section class="section" id="proof">
	<div class="container">
		<SectionHeading
			eyebrow="Спокій у кожній операції"
			title="Ви завжди знаєте,"
			accent="що відбулося з оплатою."
			copy="До запуску перевіряємо весь шлях: рахунок, оплату, підтвердження, звірку та фіскальний сценарій."
		/>
		<div class="proof-ledger">
			<header><span>CHECK</span><span>Що перевіряємо</span><span>Що отримує бізнес</span></header>
			{#each proofItems as item (item.title)}<article>
					<small>{item.label}</small>
					<h3>{item.title}</h3>
					<p>{item.description}</p><b aria-hidden="true">✓</b>
				</article>{/each}
		</div>
	</div>
</section>

<section class="section paper" id="pricing">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="Прозорі умови"
			title="Почніть з однієї каси."
			accent="Додайте більше, коли будете готові."
			copy="Остаточна комісія залежить від банку, методу, інтеграції та комерційних умов."
		/>
		<div class="pricing-board">
			<div class="pricing-axis" aria-hidden="true"><span>ПЛАН</span><span>МОЖЛИВОСТІ</span><span>ДІЯ</span></div>
			<div class="pricing-grid">
			{#each pricingPlans as plan (plan.name)}<article
					class:popular={plan.popular}
					class="price-card"
				>
					<div class="price-head">{#if plan.popular}<mark>Основний</mark>{/if}<small>{plan.name}</small>
					<h3>{plan.price}</h3>
					<p>{plan.description}</p></div>
					<ul>
						{#each plan.features as feature (feature)}<li>{feature}</li>{/each}
					</ul>
					<div class="price-action"><button
						class="button {plan.popular ? 'button-primary' : 'button-dark'}"
						type="button"
						onclick={onSignup}>{plan.cta}</button
					><small>{plan.note}</small></div>
				</article>{/each}
			</div>
		</div>
	</div>
</section>

<section class="section" id="faq">
	<div class="faq-container container">
		<SectionHeading
			eyebrow="Питання перед підключенням"
			title="Відповідаємо"
			accent="без дрібного шрифту."
		/>
		<div class="faq-list">
			{#each faqItems as item (item.question)}<details>
					<summary>{item.question}</summary>
					<p>{item.answer}</p>
				</details>{/each}
		</div>
	</div>
</section>

<section class="section final-section" id="final-cta">
	<div class="container">
		<div class="final-card">
			<header><p class="eyebrow dark-text">Наступний платіжний канал · ваш</p><span>R/ SCALE</span></header>
			<h2>Зробіть кожен рахунок<br /><span>точкою приймання оплат.</span></h2>
			<div class="final-actions">
				<p>Запустіть пілот для власного бізнесу, партнерської мережі або клієнтів банку. Одна інтеграція — багато сценаріїв і точок входу.</p>
				<div>
				<button class="button button-dark" type="button" onclick={onSignup}
					>Обговорити запуск →</button
				><a class="button button-outline" href="#demo">Ще раз пройти демо</a>
				</div>
			</div>
			<footer>
				<span>Безкоштовний Start</span><span>Без окремого термінала</span><span
					>Працює зі смартфона</span
				>
			</footer>
		</div>
	</div>
</section>
