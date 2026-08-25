<script lang="ts">
	import { reveal } from '../actions/reveal';
	let { onSignup }: { onSignup: () => void } = $props();
</script>

<section class="hero">
	<div class="hero-grid container">
		<div use:reveal>
			<p class="eyebrow"><i></i> Оплата з банківського рахунку</p>
			<h1>Оплата одразу <span>на ваш рахунок.</span></h1>
			<p class="hero-copy">
				Створіть рахунок у дашборді, застосунку або Telegram. Клієнт відкриває оплату через QR, NFC
				чи посилання, обирає банк і підтверджує переказ. Каса закривається лише після підтвердження
				платежу сервером.
			</p>
			<div class="hero-actions">
				<button class="button button-primary" type="button" onclick={onSignup}
					>Створити першу касу →</button
				>
				<a class="button button-muted" href="#demo">Пройти payment flow</a>
			</div>
			<div class="tags" aria-label="Ключові переваги">
				<span>Без окремого POS</span><span>QR, NFC і посилання</span><span
					>Підтверджений статус</span
				>
			</div>
			<p class="microcopy">
				Запуск залежить від підключеного банку, способу оплати, тарифу та налаштованої
				ПРРО-інтеграції.
			</p>
		</div>

		<div class="dashboard-preview" use:reveal aria-label="Демонстрація дашборду Rahunok">
			<div class="preview-top"><span>● ● ●</span><b><i></i> Dashboard online</b></div>
			<div class="preview-body">
				<aside>
					<strong>Rahunok.</strong><span>Огляд</span><span>Каса</span><span>Рахунки</span><span
						>Платежі</span
					><span>ПРРО</span>
				</aside>
				<div class="preview-main">
					<p>Операційний центр</p>
					<small>Рахунки, статуси та звіряння</small>
					<div class="preview-stats">
						<div><small>Підтверджено сьогодні</small><b>₴24 850</b></div>
						<div><small>Очікують</small><b>3</b></div>
					</div>
					{#each [['#1048', '₴850'], ['#1047', '₴1 240'], ['#1046', '₴490']] as row, index (row[0])}
						<div class="transaction">
							<i>{index === 2 ? '↻' : '✓'}</i><span
								><b>Рахунок {row[0]}</b><small
									>{index === 2 ? 'Очікуємо відповідь банку' : 'Підтверджено сервером'}</small
								></span
							><strong>{row[1]}</strong>
						</div>
					{/each}
				</div>
			</div>
			<div class="confirmed">
				<i>✓</i><span
					><b>Оплату підтверджено</b><small
						>Статус отримано сервером, а не лише після повернення з банку.</small
					></span
				>
			</div>
		</div>
	</div>
</section>
