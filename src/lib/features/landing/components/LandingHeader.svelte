<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Moon, Sun } from '@lucide/svelte';
	import type { Locale, Translations } from '../data/translations';

	let {
		onSignup,
		darkMode,
		onThemeToggle,
		locale = 'uk',
		onLocaleChange,
		t
	}: {
		onSignup: () => void;
		darkMode: boolean;
		onThemeToggle: () => void;
		locale?: Locale;
		onLocaleChange?: (next: Locale) => void;
		t: Translations;
	} = $props();

	let menuOpen = $state(false);
	const dashboardPath = '/dashboard/' as '/';
	const merchantAppPath = '/app/' as '/';

	function closeMenu() {
		menuOpen = false;
	}

	const navItems = $derived([
		{ label: t.nav.howItWorks, href: '#payment-flow' },
		{ label: t.nav.forBusiness, href: '#solutions' },
		{ label: t.nav.moneyFlow, href: '#money-flow' },
		{ label: t.nav.pricing, href: '#pricing' },
		{ label: t.nav.faq, href: '#faq' }
	]);
</script>

<header class="site-header">
	<nav class="nav container" aria-label="Основна навігація">
		<a class="brand" href={resolve('/#top')} aria-label={`${t.brand.name} — на початок`}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 208 221"
				fill="none"
				class="brand-icon"
				style="margin-right: -4px;"
			>
				<g>
					<path
						d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903ZM101.528 102.93C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542C126.268 74.7384 124.365 70.0268 120.559 66.3194C116.753 62.612 111.202 60.7583 103.907 60.7583H72.7443C109.721 58.9323 126.648 60.1615 126.268 80.4542C124.948 105.313 105.753 104.095 72.7443 102.93H101.528Z"
						fill="currentColor"
					/>
					<path
						d="M72.7443 102.93C53.3001 102.93 37.5375 118.27 37.5375 137.192V157.183C37.5375 176.106 53.3001 191.445 72.7443 191.445V154.351C72.7443 142.588 82.5427 133.053 94.6296 133.053L108.337 156.747C120.737 178.182 144.049 191.445 169.325 191.445L128.409 123.321C139.193 119.15 147.361 112.894 152.911 104.552C158.62 96.0563 161.475 86.8647 161.475 76.9783C161.475 68.6366 159.413 60.8356 155.29 53.5752C151.167 46.3148 145.14 40.4448 137.211 35.9649C129.281 31.4851 119.845 29.2451 108.903 29.2451H37.5375C37.5375 46.6494 52.0355 60.7583 69.9196 60.7583H72.7443M72.7443 102.93H101.528C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542M72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542M72.7443 60.7583H103.907C111.202 60.7583 116.753 62.612 120.559 66.3194C124.365 70.0268 126.268 74.7384 126.268 80.4542M72.7443 60.7583C109.721 58.9323 126.648 60.1615 126.268 80.4542"
						stroke="currentColor"
						stroke-width="0.05"
					/>
				</g>
			</svg>
			<span
				>Rahunok
				<!--  	<span class="brand-dot" aria-hidden="true"></span> -->
			</span>
		</a>

		<div class="desktop-nav">
			{#each navItems as link (link.href)}
				<a href={link.href}>{link.label}</a>
			{/each}
			<a href={resolve(merchantAppPath)}>{t.nav.pos}</a>
			<a class="account-link" href={resolve(dashboardPath)}>{t.nav.account}</a>
		</div>

		<div class="nav-actions">
			<!-- Language Switcher -->
			<div class="lang-switcher" role="group" aria-label="Мова сайту">
				<button type="button" class:active={locale === 'uk'} onclick={() => onLocaleChange?.('uk')}
					>UA</button
				>
				<button type="button" class:active={locale === 'en'} onclick={() => onLocaleChange?.('en')}
					>EN</button
				>
				<button type="button" class:active={locale === 'pl'} onclick={() => onLocaleChange?.('pl')}
					>PL</button
				>
			</div>

			<button
				class="theme-toggle"
				type="button"
				aria-label={darkMode ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
				title={darkMode ? 'Світла тема' : 'Темна тема'}
				aria-pressed={darkMode}
				onclick={onThemeToggle}
			>
				{#if darkMode}
					<Sun size={18} aria-hidden="true" />
				{:else}
					<Moon size={18} aria-hidden="true" />
				{/if}
			</button>

			<button class="button button-primary desktop-cta" type="button" onclick={onSignup}>
				{t.nav.tryPilot}
				<ArrowUpRight size={16} aria-hidden="true" />
			</button>

			<button
				class="menu-button"
				type="button"
				aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{menuOpen ? '✕' : '☰'}
			</button>
		</div>
	</nav>

	{#if menuOpen}
		<nav class="mobile-nav" aria-label="Мобільна навігація">
			{#each navItems as link (link.href)}
				<a href={link.href} onclick={closeMenu}>{link.label}</a>
			{/each}
			<a href={resolve(merchantAppPath)} onclick={closeMenu}>{t.nav.pos}</a>
			<a href={resolve(dashboardPath)} onclick={closeMenu}>{t.nav.account}</a>

			<div class="mobile-lang-row">
				<span>Мова / Language:</span>
				<div class="lang-switcher">
					<button
						type="button"
						class:active={locale === 'uk'}
						onclick={() => {
							onLocaleChange?.('uk');
							closeMenu();
						}}>UA</button
					>
					<button
						type="button"
						class:active={locale === 'en'}
						onclick={() => {
							onLocaleChange?.('en');
							closeMenu();
						}}>EN</button
					>
					<button
						type="button"
						class:active={locale === 'pl'}
						onclick={() => {
							onLocaleChange?.('pl');
							closeMenu();
						}}>PL</button
					>
				</div>
			</div>

			<button
				class="mobile-theme-toggle"
				type="button"
				aria-pressed={darkMode}
				onclick={onThemeToggle}
			>
				{#if darkMode}
					<Sun size={18} aria-hidden="true" /> Світла тема
				{:else}
					<Moon size={18} aria-hidden="true" /> Темна тема
				{/if}
			</button>
			<button
				class="button button-primary"
				type="button"
				onclick={() => {
					closeMenu();
					onSignup();
				}}
			>
				{t.nav.tryPilot}
			</button>
		</nav>
	{/if}
</header>
