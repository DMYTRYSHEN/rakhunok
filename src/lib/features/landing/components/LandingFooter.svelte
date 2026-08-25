<script lang="ts">
	import { resolve } from '$app/paths';
	let { onSignup }: { onSignup: () => void } = $props();
	// Dashboard remains a legacy deployment route until that feature is migrated.
	const dashboardPath = '/dashboard/' as '/';
</script>

<footer class="site-footer">
	<div class="footer-grid container">
		<div>
			<a class="brand" href={resolve('/#top')}><b>R</b>Rahunok<span>.</span></a>
			<p>Платіжні рахунки, QR, NFC, підтверджені статуси, ПРРО та API для українського бізнесу.</p>
		</div>
		<nav aria-label="Продукт">
			<strong>Продукт</strong><a href={resolve('/#payment-flow')}>Як працює</a><a
				href={resolve('/#demo')}>Демо</a
			><a href={resolve('/#solutions')}>Для бізнесу</a><a href={resolve('/#pricing')}>Тарифи</a>
		</nav>
		<nav aria-label="Довіра">
			<strong>Довіра</strong><a href={resolve('/#money-flow')}>Рух коштів</a><a
				href={resolve('/#proof')}>Перевірка</a
			><a href={resolve('/#faq')}>Питання</a><a href={resolve(dashboardPath)}>Особистий кабінет</a>
		</nav>
		<nav aria-label="Контакти">
			<strong>Контакти</strong><button type="button" onclick={onSignup}>Залишити заявку</button><a
				href="mailto:hello@rahunok.app">hello@rahunok.app</a
			>
		</nav>
	</div>
	<div class="footer-bottom container">
		<span>© {new Date().getFullYear()} Rahunok</span><span
			>Інформація не є публічною офертою. Функції залежать від тарифу та інтеграцій.</span
		>
	</div>
</footer>
