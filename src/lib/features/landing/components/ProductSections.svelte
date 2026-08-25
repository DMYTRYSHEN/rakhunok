<script lang="ts">
	import { reveal } from '../actions/reveal';
	import { comparisonRows, features, paymentSteps, solutions, trustItems } from '../data/content';
	import SectionHeading from './SectionHeading.svelte';
	let { onSignup }: { onSignup: () => void } = $props();
</script>

<section class="trust-strip" aria-label="Ключові принципи довіри">
	<div class="trust-grid container">
		{#each trustItems as item (item.title)}<article>
				<strong>{item.title}</strong>
				<p>{item.description}</p>
			</article>{/each}
	</div>
</section>

<section class="section paper" id="payment-flow">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="Payment experience"
			title="Від QR до підтвердженої оплати —"
			accent="один зрозумілий шлях."
			copy="Клієнт бачить суму, обирає свій банк, авторизує платіж і отримує результат. Rahunok окремо перевіряє статус на сервері."
		/>
		<div class="flow-grid">
			{#each paymentSteps as step (step.label)}<article use:reveal>
					<b>{step.label}</b>
					<h3>{step.title}</h3>
					<p>{step.description}</p>
					<div class="flow-visual">
						<span
							>{step.label === '05' ? '✓ SUCCESS' : step.label === '03' ? 'BANK' : 'RAHUNOK'}</span
						>
					</div>
				</article>{/each}
		</div>
		<p class="section-note">
			<strong>iOS та Android:</strong> архітектура може використовувати App Clip, App Link/Payment Activity
			або web checkout. Сценарій залежить від готовності клієнтського модуля та банківської інтеграції.
		</p>
	</div>
</section>

<section class="section paper" id="comparison">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="POS vs Rahunok"
			title="Приймайте оплату без окремого"
			accent="банківського термінала."
		/>
		<div class="comparison">
			<div class="comparison-head"><b>Можливість</b><b>Класичний POS</b><b>Rahunok</b></div>
			{#each comparisonRows as row (row[0])}<div>
					{#each row as cell, index (`${row[0]}-${index}`)}{#if index === 2}<strong>{cell}</strong
							>{:else}<span>{cell}</span>{/if}{/each}
				</div>{/each}
		</div>
	</div>
</section>

<section class="section" id="solutions">
	<div class="container">
		<SectionHeading
			eyebrow="Для різних моделей бізнесу"
			title="Один платіжний центр."
			accent="Різні сценарії продажу."
		/>
		<div class="card-grid two">
			{#each solutions as item, index (item.title)}<article class="content-card" use:reveal>
					<b class="number">0{index + 1}</b><small>{item.label}</small>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
					{#if index === 3}<button class="text-button" type="button" onclick={onSignup}
							>Запросити API-документацію →</button
						>{:else}<a href="#final-cta">Підключити сценарій →</a>{/if}
				</article>{/each}
		</div>
	</div>
</section>

<section class="section paper" id="features">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="Операційна платформа"
			title="Не просто QR."
			accent="Уся каса в одному місці."
		/>
		<div class="card-grid four">
			{#each features as item (item.title)}<article class="feature-card">
					<small>{item.label}</small>
					<h3>{item.title}</h3>
					<p>{item.description}</p>
				</article>{/each}
		</div>
	</div>
</section>
