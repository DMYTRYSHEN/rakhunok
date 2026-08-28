<script lang="ts">
	import horecaImage from '../../../../../2.jpg';
	import retailImage from '../../../../../3.jpg';
	import servicesImage from '../../../../../4.jpg';
	import { reveal } from '../actions/reveal';
	import { comparisonRows, features, paymentSteps, solutions, trustItems } from '../data/content';
	import SectionHeading from './SectionHeading.svelte';
	let { onSignup }: { onSignup: () => void } = $props();
	const solutionImages = [
		{ src: horecaImage, alt: 'Оплата QR-рахунку за столиком' },
		{ src: retailImage, alt: 'Смартфон як каса у компактній торговій точці' },
		{ src: servicesImage, alt: 'Цифровий платіжний сценарій на смартфоні' }
	];
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
			eyebrow="Як це працює"
			title="Клієнт платить у банку."
			accent="Ви одразу бачите результат."
			copy="Без нових звичок для покупця і без ручної перевірки для вас. Від рахунку до підтвердження — один зрозумілий процес."
		/>
		<div class="payment-route">
			{#each paymentSteps as step (step.label)}<article use:reveal>
					<div class="route-marker"><b>{step.label}</b><i></i></div>
					<div class="route-copy">
						<small>{step.label === '05' ? 'ДОКАЗ' : step.label === '03' || step.label === '04' ? 'БАНК' : 'RAHUNOK'}</small>
						<h3>{step.title}</h3>
						<p>{step.description}</p>
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
			eyebrow="Для вашого бізнесу"
			title="Знайомий робочий день."
			accent="Простіша оплата."
			copy="Rahunok підлаштовується під те, як ви вже продаєте: за столиком, біля прилавка, у месенджері або онлайн."
		/>
		<div class="solution-index">
			{#each solutions as item, index (item.title)}<article use:reveal>
					<header><b>0{index + 1}</b><small>{item.label}</small></header>
					{#if solutionImages[index]}<figure>
						<img src={solutionImages[index].src} alt={solutionImages[index].alt} loading="lazy" />
					</figure>{:else}<figure class="api-visual" aria-label="Схема API-події">
						<span>POST /invoice</span><i></i><strong>200 · SUCCESS</strong>
					</figure>{/if}
					<div><h3>{item.title}</h3><p>{item.description}</p></div>
					{#if index === 3}<button class="solution-action" type="button" onclick={onSignup} aria-label="Запросити API-документацію">↗</button
						>{:else}<a class="solution-action" href="#final-cta" aria-label={`Підключити сценарій ${item.label}`}>↗</a>{/if}
				</article>{/each}
		</div>
	</div>
</section>

<section class="section paper" id="features">
	<div class="container">
		<SectionHeading
			dark
			eyebrow="Все необхідне"
			title="Менше ручної роботи."
			accent="Більше ясності в кожній оплаті."
		/>
		<div class="capability-matrix">
			{#each features as item, index (item.title)}<article>
					<span>{String(index + 1).padStart(2, '0')}</span>
					<small>{item.label}</small>
					<div><h3>{item.title}</h3><p>{item.description}</p></div>
				</article>{/each}
		</div>
	</div>
</section>
