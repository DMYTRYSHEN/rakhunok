<script lang="ts">
	import { resolve } from '$app/paths';
	import { Moon, Sun } from '@lucide/svelte';
	import logoUrl from '../../../../../logo.svg?url';
	import { primaryNav } from '../data/content';

	let {
		onSignup,
		darkMode,
		onThemeToggle
	}: {
		onSignup: () => void;
		darkMode: boolean;
		onThemeToggle: () => void;
	} = $props();
	let menuOpen = $state(false);
	// Dashboard remains a legacy deployment route until that feature is migrated.
	const dashboardPath = '/dashboard/' as '/';
	const merchantAppPath = '/app/' as '/';

	function closeMenu() {
		menuOpen = false;
	}
</script>

<header class="site-header">
	<nav class="nav container" aria-label="Основна навігація">
		<a class="brand" href={resolve('/#top')} aria-label="Rahunok — на початок"
			><img src={logoUrl} alt="" aria-hidden="true" /><span>Rahunok</span></a
		>
		<div class="desktop-nav">
			{#each primaryNav as link (link.href)}<a href={resolve(`/${link.href}`)}>{link.label}</a
				>{/each}
			<a href={resolve(merchantAppPath)}>Каса</a>
			<a class="account-link" href={resolve(dashboardPath)}>Особистий кабінет</a>
		</div>
		<div class="nav-actions">
			<button
				class="theme-toggle"
				type="button"
				aria-label={darkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
				title={darkMode ? 'Світла тема' : 'Темна тема'}
				aria-pressed={darkMode}
				onclick={onThemeToggle}
			>
				{#if darkMode}<Sun size={18} aria-hidden="true" />{:else}<Moon size={18} aria-hidden="true" />{/if}
			</button>
			<a class="button button-muted desktop-cta" href={resolve('/#demo')}>Платіж наживо</a>
			<button class="button button-primary desktop-cta" type="button" onclick={onSignup}
				>Запустити пілот <span aria-hidden="true">↗</span></button
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
			<a href={resolve(merchantAppPath)} onclick={closeMenu}>Каса</a>
			<a href={resolve(dashboardPath)} onclick={closeMenu}>Особистий кабінет</a>
			<a href={resolve('/#demo')} onclick={closeMenu}>Платіж наживо</a>
			<button class="mobile-theme-toggle" type="button" aria-pressed={darkMode} onclick={onThemeToggle}>
				{#if darkMode}<Sun size={18} aria-hidden="true" /> Світла тема{:else}<Moon size={18} aria-hidden="true" /> Темна тема{/if}
			</button>
			<button
				type="button"
				onclick={() => {
					closeMenu();
					onSignup();
				}}>Запустити пілот</button
			>
		</nav>
	{/if}
</header>
