<script lang="ts">
	import { faqItems, pricingPlans, proofItems } from '../data/content';
	import SectionHeading from './SectionHeading.svelte';
	let { onSignup }: { onSignup: () => void } = $props();
</script>

<section class="section paper" id="money-flow">
	<div class="money-layout container">
		<div>
			<p class="eyebrow dark-text">Куди йдуть гроші</p>
			<h2 class="section-title dark-text">Ваші кошти <span>не зберігаються в Rahunok.</span></h2>
			<p class="section-copy dark-text">
				У сценарії прямої оплати переказ спрямовується на банківський рахунок вашого ФОП або ТОВ.
				Rahunok керує рахунком, QR, статусом, звіркою та пов’язаним фіскальним сценарієм.
			</p>
			<ul class="check-list">
				<li><b>Реквізити відомі до оплати.</b> Клієнт бачить суму, продавця та призначення.</li>
				<li><b>Авторизація виконується банком.</b> Rahunok не просить PIN або пароль.</li>
				<li><b>Повернення у checkout не є доказом.</b> SUCCESS встановлює сервер.</li>
			</ul>
		</div>
		<div class="money-diagram">
			<article>
				<b>01</b><span
					><strong>Клієнт</strong><small>Підтверджує операцію у своєму банку</small></span
				>
			</article>
			<i>↓ Авторизований переказ</i>
			<article>
				<b>02</b><span
					><strong>Банківський платіжний контур</strong><small
						>Обробляє платіж за умовами інтеграції</small
					></span
				>
			</article>
			<i>↓ Зарахування за реквізитами</i>
			<article class="success">
				<b>03</b><span><strong>IBAN вашого бізнесу</strong><small>Рахунок ФОП або ТОВ</small></span>
			</article>
			<p><b>Інформаційний контур:</b> банк/API → backend Rahunok → статус → ПРРО.</p>
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
			eyebrow="Довіра без вигаданих логотипів"
			title="Перевірте все"
			accent="до запуску."
			copy="Ми не підміняємо реальні докази маркетинговими цифрами. До підключення ви отримуєте список доступних інтеграцій, тарифів і відповідальних сторін."
		/>
		<div class="card-grid four">
			{#each proofItems as item (item.title)}<article class="content-card">
					<small>{item.label}</small>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
				</article>{/each}
		</div>
	</div>
</section>

<section class="section paper" id="pricing">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="Тарифи"
			title="Почніть безкоштовно."
			accent="Масштабуйтеся за потреби."
			copy="Остаточна комісія залежить від банку, методу, інтеграції та комерційних умов."
		/>
		<div class="pricing-grid">
			{#each pricingPlans as plan (plan.name)}<article
					class:popular={plan.popular}
					class="price-card"
				>
					{#if plan.popular}<mark>Популярний</mark>{/if}<small>{plan.name}</small>
					<h3>{plan.price}</h3>
					<p>{plan.description}</p>
					<ul>
						{#each plan.features as feature (feature)}<li>{feature}</li>{/each}
					</ul>
					<button
						class="button {plan.popular ? 'button-primary' : 'button-dark'}"
						type="button"
						onclick={onSignup}>{plan.cta}</button
					><small>{plan.note}</small>
				</article>{/each}
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
			<p class="eyebrow dark-text">Почніть із першої каси</p>
			<h2>Готові приймати оплату <span>без окремого POS?</span></h2>
			<p>Підключіть Rahunok, налаштуйте реквізити та протестуйте перший платіжний сценарій.</p>
			<div>
				<button class="button button-dark" type="button" onclick={onSignup}
					>Створити першу касу →</button
				><a class="button button-outline" href="#demo">Ще раз пройти демо</a>
			</div>
			<footer>
				<span>Безкоштовний Start</span><span>Без окремого термінала</span><span
					>Працює зі смартфона</span
				>
			</footer>
		</div>
	</div>
</section>
