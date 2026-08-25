<script lang="ts">
	import { resolve } from '$app/paths';
	import { primaryNav } from '../data/content';

	let { onSignup }: { onSignup: () => void } = $props();
	let menuOpen = $state(false);
	// Dashboard remains a legacy deployment route until that feature is migrated.
	const dashboardPath = '/dashboard/' as '/';

	function closeMenu() {
		menuOpen = false;
	}
</script>

<header class="site-header">
	<nav class="nav container" aria-label="Основна навігація">
		<a class="brand" href={resolve('/#top')} aria-label="Rahunok — на початок"
			><b>R</b>Rahunok<span>.</span></a
		>
		<div class="desktop-nav">
			{#each primaryNav as link (link.href)}<a href={resolve(`/${link.href}`)}>{link.label}</a
				>{/each}
			<a class="account-link" href={resolve(dashboardPath)}>Особистий кабінет</a>
		</div>
		<div class="nav-actions">
			<a class="button button-muted desktop-cta" href={resolve('/#demo')}>Спробувати демо</a>
			<button class="button button-primary desktop-cta" type="button" onclick={onSignup}
				>Створити касу</button
			>
			<button
				class="menu-button"
				type="button"
				aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}>{menuOpen ? '×' : '☰'}</button
			>
		</div>
	</nav>
	{#if menuOpen}
		<nav class="mobile-nav container" aria-label="Мобільна навігація">
			{#each primaryNav as link (link.href)}<a href={resolve(`/${link.href}`)} onclick={closeMenu}
					>{link.label}</a
				>{/each}
			<a href={resolve(dashboardPath)} onclick={closeMenu}>Особистий кабінет</a>
			<a href={resolve('/#demo')} onclick={closeMenu}>Спробувати демо</a>
			<button
				type="button"
				onclick={() => {
					closeMenu();
					onSignup();
				}}>Створити касу</button
			>
		</nav>
	{/if}
</header>
