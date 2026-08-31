<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Cloud,
		LockKeyhole,
		LogOut,
		Pause,
		Play,
		RotateCcw,
		ShieldCheck
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import DashboardLogin from '$lib/features/dashboard/auth/DashboardLogin.svelte';
	import MerchantOnboarding from '$lib/features/dashboard/auth/MerchantOnboarding.svelte';
	import DashboardStateScreen from '$lib/features/dashboard/auth/DashboardStateScreen.svelte';
	import { getDashboardGateway } from '$lib/features/dashboard/api/supabase-browser';
	import type { DashboardSessionState, MerchantOnboardingInput } from '$lib/features/dashboard/types';
	import ReleaseFlowCanvas from './ReleaseFlowCanvas.svelte';
	import { shellText, type CorexLocale } from './i18n';

	let sessionState = $state<DashboardSessionState>({ status: 'loading' });
	let gateway = $state<ReturnType<typeof getDashboardGateway>>(null);
	let destroyed = false;
	let signingOut = $state(false);
	let locale = $state<CorexLocale>('uk');
	let text = $derived(shellText[locale]);

	function setLocale(nextLocale: CorexLocale) {
		locale = nextLocale;
		localStorage.setItem('corex_locale', nextLocale);
		document.documentElement.lang = nextLocale;
	}

	async function restore() {
		sessionState = { status: 'loading' };
		gateway = getDashboardGateway();
		if (!gateway) {
			sessionState = { status: 'configuration-required' };
			return;
		}
		const restoredState = await gateway.restore();
		if (!destroyed) sessionState = restoredState;
	}

	async function loginWithGoogle(credential: string, nonce: string) {
		if (!gateway) return;
		await gateway.signInWithGoogleIdToken(credential, nonce);
		await restore();
	}

	async function completeOnboarding(input: MerchantOnboardingInput) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.onboardMerchant(input);
		await restore();
	}

	async function signOut() {
		if (!gateway || signingOut) return;
		signingOut = true;
		try {
			await gateway.signOut();
			sessionState = { status: 'guest' };
		} finally {
			signingOut = false;
		}
	}

	onMount(() => {
		const savedLocale = localStorage.getItem('corex_locale');
		if (savedLocale === 'en' || savedLocale === 'uk') setLocale(savedLocale);
		else document.documentElement.lang = 'uk';
		void restore();
		return () => {
			destroyed = true;
		};
	});
</script>

{#if sessionState.status === 'loading'}
	<DashboardStateScreen loading />
{:else if sessionState.status === 'configuration-required'}
	<DashboardLogin configurationRequired homeHref="https://letsrealtalk.com/" />
{:else if sessionState.status === 'guest'}
	<DashboardLogin homeHref="https://letsrealtalk.com/" onGoogleLogin={loginWithGoogle} />
{:else if sessionState.status === 'onboarding'}
	<MerchantOnboarding user={sessionState.user} onComplete={completeOnboarding} />
{:else if sessionState.status === 'error'}
	<DashboardStateScreen message={sessionState.message} onRetry={restore} />
{:else}
	<div class="corex-root">
		<header class="topbar">
			<a class="brand" href={resolve('/dashboard')} aria-label={text.backLabel}>
				<span class="brand-mark">R</span>
				<span>Rahunok <b>/ Corex</b></span>
			</a>
			<div class="topbar-actions">
				<span class="mode"><span></span> {text.mockMode}</span>
				<label class="language-select" aria-label={text.language}>
					<select value={locale} onchange={(event) => setLocale(event.currentTarget.value as CorexLocale)}>
						<option value="uk">UA</option><option value="en">EN</option>
					</select>
				</label>
				<button class="icon-button" type="button" onclick={signOut} disabled={signingOut} aria-label={text.signOut} title={text.signOut}>
					<LogOut size={17} aria-hidden="true" />
				</button>
			</div>
		</header>

		<main>
			<section class="intro">
				<div>
					<a class="back-link" href={resolve('/dashboard')}><ArrowLeft size={15} /> {text.back}</a>
					<p class="kicker">{text.kicker}</p>
					<h1>{text.title}</h1>
					<p class="lede">{text.lede}</p>
				</div>
				<div class="target-card">
					<div class="target-icon"><Cloud size={20} /></div>
					<div><span>{text.boundary}</span><strong>{text.backend}</strong></div>
					<span class="target-check"><ShieldCheck size={22} /></span>
				</div>
			</section>

			<section class="command-bar" aria-label="Deployment controls">
				<div>
					<span class="command-label">{text.trace}</span>
					<strong>{text.contracts}</strong>
				</div>
				<div class="commands">
					<button type="button" disabled title={text.notConnected}><Play size={15} /> {text.deploy}</button>
					<button type="button" disabled title={text.notConnected}><Pause size={15} /> {text.pause}</button>
					<button type="button" disabled title={text.notConnected}><RotateCcw size={15} /> {text.rollback}</button>
				</div>
			</section>

			<ReleaseFlowCanvas {locale} ownerUserId={sessionState.user.id} />

			<section class="safety-grid">
				<div><span>{text.environment}</span><strong>{text.preview}</strong></div>
				<div><span>{text.mutation}</span><strong class="locked"><LockKeyhole size={14} /> {text.locked}</strong></div>
				<div><span>{text.protectedDomain}</span><strong>{text.excluded}</strong></div>
				<div><span>{text.session}</span><strong>{sessionState.user.email ?? sessionState.user.fullName ?? text.user}</strong></div>
			</section>
		</main>
	</div>
{/if}

<style>
	:global(html:has(.corex-root)), :global(body:has(.corex-root)) { margin: 0; background: #f6f7f8; font-family: 'Manrope', sans-serif; }
	.corex-root { min-height: 100vh; background: #f6f7f8; color: #18181b; font-family: 'Manrope', sans-serif; }
	.topbar { position: sticky; top: 0; z-index: 30; height: 72px; padding: 0 clamp(20px, 4vw, 64px); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e4e4e7; background: rgb(255 255 255 / 95%); backdrop-filter: blur(12px); }
	.brand, .topbar-actions, .commands, .back-link, .target-card, .locked { display: flex; align-items: center; }
	.brand { gap: 10px; color: inherit; text-decoration: none; font-size: 14px; }
	.brand b { font-weight: 800; }
	.brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 6px; background: #18181b; color: white; font-weight: 900; }
	.topbar-actions { gap: 10px; }
	.mode { display: flex; align-items: center; gap: 7px; padding: 7px 10px; color: #71717a; font-size: 11px; font-weight: 700; text-transform: uppercase; }
	.mode span { width: 7px; height: 7px; border-radius: 50%; background: #e49b2f; box-shadow: 0 0 0 3px #e49b2f22; }
	.language-select { position: relative; }
	.language-select select { height: 40px; appearance: none; border: 1px solid #e4e4e7; border-radius: 6px; padding: 0 27px 0 11px; color: #3f3f46; background: #fafafa; font: 800 11px/1 'Manrope', sans-serif; cursor: pointer; }
	.language-select::after { content: '⌄'; position: absolute; top: 7px; right: 8px; pointer-events: none; color: #777970; font-size: 12px; }
	.icon-button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid #e4e4e7; border-radius: 6px; background: #fafafa; color: #52525b; }
	main { width: min(1472px, calc(100% - 40px)); margin: 0 auto; padding: 34px 0 32px; }
	.intro { display: grid; grid-template-columns: minmax(0, 1fr) 330px; align-items: end; gap: 48px; }
	.back-link { gap: 6px; width: fit-content; margin-bottom: 20px; color: #66685f; text-decoration: none; font-size: 12px; font-weight: 700; }
	.kicker { margin: 0 0 12px; color: #71717a; font-size: 11px; font-weight: 800; text-transform: uppercase; }
	h1 { max-width: 760px; margin: 0; font-family: 'Manrope', sans-serif; font-size: 40px; font-weight: 750; line-height: 1.08; letter-spacing: 0; }
	.lede { max-width: 680px; margin: 12px 0 0; color: #71717a; font-size: 14px; line-height: 1.55; }
	.target-card { min-height: 88px; gap: 14px; padding: 18px; border: 1px solid #e4e4e7; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }
	.target-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 6px; background: #18181b; color: white; }
	.target-card div:nth-child(2) { display: grid; gap: 5px; }
	.target-card span { color: #707268; font-size: 11px; text-transform: uppercase; font-weight: 800; }
	.target-card strong { font-size: 14px; }
	.target-check { margin-left: auto; color: #39775a; }
	.command-bar { margin-top: 26px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 20px; border: 1px solid #27272a; border-radius: 8px 8px 0 0; background: #18181b; color: white; }
	.command-bar > div:first-child { display: grid; gap: 4px; }
	.command-label { color: #a1a1aa; font-size: 10px; font-weight: 700; text-transform: uppercase; }
	.command-bar strong { font-size: 13px; }
	.commands { gap: 8px; }
	.commands button { min-height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 13px; border: 1px solid #3f3f46; border-radius: 5px; background: #27272a; color: #a1a1aa; font-family: inherit; font-weight: 750; }
	.commands button:disabled { cursor: not-allowed; }
	.safety-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #e4e4e7; border-top: 0; }
	.safety-grid > div { min-width: 0; padding: 18px; display: grid; gap: 7px; border-right: 1px solid #e4e4e7; background: #fff; }
	.safety-grid > div:last-child { border: 0; }
	.safety-grid span { color: #74766d; font: 750 10px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.safety-grid strong { overflow: hidden; text-overflow: ellipsis; font-size: 12px; white-space: nowrap; }
	.locked { gap: 6px; color: #8a4b3a; }
	@media (max-width: 900px) {
		.intro { grid-template-columns: 1fr; }
		.target-card { max-width: 420px; }
		.safety-grid { grid-template-columns: repeat(2, 1fr); }
		.safety-grid > div:nth-child(2) { border-right: 0; }
		.safety-grid > div:nth-child(-n + 2) { border-bottom: 1px solid #d2d1c9; }
	}
	@media (max-width: 600px) {
		.topbar { padding: 0 16px; }
		.brand > span:last-child { display: none; }
		main { width: min(100% - 24px, 1440px); padding-top: 36px; }
		.back-link { margin-bottom: 28px; }
		h1 { font-size: 43px; }
		.command-bar { align-items: flex-start; flex-direction: column; }
		.commands { width: 100%; }
		.commands button { flex: 1; justify-content: center; padding: 0 8px; font-size: 12px; }
		.safety-grid { grid-template-columns: 1fr; }
		.safety-grid > div { border-right: 0; border-bottom: 1px solid #d2d1c9; }
		.safety-grid > div:nth-child(3) { border-bottom: 1px solid #d2d1c9; }
	}
</style>