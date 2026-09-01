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
	:global(html:has(.corex-root)), :global(body:has(.corex-root)) {
		margin: 0;
		background: #f8fafd;
		color: #1f2937;
		font-family: 'Manrope', sans-serif;
	}
	.corex-root {
		min-height: 100vh;
		background: radial-gradient(circle at 50% 0%, #ffffff 0%, #f8fafd 70%, #f0f4f9 100%);
		color: #1f2937;
		font-family: 'Manrope', sans-serif;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		height: 66px;
		padding: 0 clamp(10px, 2vw, 24px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #edf1f7;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(20px);
	}
	.brand, .topbar-actions, .commands, .back-link, .target-card, .locked {
		display: flex;
		align-items: center;
	}
	.brand {
		gap: 12px;
		color: #1e293b;
		text-decoration: none;
		font-size: 15px;
		font-weight: 700;
	}
	.brand b {
		font-weight: 800;
		background: linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%);
		color: #ffffff;
		font-weight: 900;
		box-shadow: 0 3px 10px rgba(26, 115, 232, 0.35);
	}
	.topbar-actions { gap: 10px; }
	.mode {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 9999px;
		border: 1px solid #e2e8f0;
		background: #ffffff;
		color: #5f6368;
		font-size: 11px;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.mode span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #f59e0b;
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
	}
	.language-select { position: relative; }
	.language-select select {
		height: 36px;
		appearance: none;
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		padding: 0 26px 0 12px;
		color: #1e293b;
		background: #ffffff;
		font: 750 11.5px/1 'Manrope', sans-serif;
		cursor: pointer;
		transition: all 160ms ease;
	}
	.language-select select:hover { border-color: #1a73e8; }
	.language-select::after {
		content: '⌄';
		position: absolute;
		top: 6px;
		right: 10px;
		pointer-events: none;
		color: #5f6368;
		font-size: 12px;
	}
	.icon-button {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		border: 1px solid #e2e8f0;
		border-radius: 50%;
		background: #ffffff;
		color: #5f6368;
		cursor: pointer;
		transition: all 160ms ease;
	}
	.icon-button:hover {
		color: #1a73e8;
		border-color: #1a73e8;
		background: #f8fafd;
		transform: scale(1.05);
	}
	main {
		max-width: 100%;
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 20px 5px 36px;
	}
	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 330px;
		align-items: end;
		gap: 36px;
		margin-bottom: 26px;
		padding: 0 4px;
	}
	.back-link {
		gap: 6px;
		width: fit-content;
		margin-bottom: 14px;
		color: #5f6368;
		text-decoration: none;
		font-size: 12px;
		font-weight: 700;
		transition: color 160ms ease;
	}
	.back-link:hover { color: #1a73e8; }
	.kicker {
		margin: 0 0 8px;
		background: linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-size: 11.5px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		max-width: 780px;
		margin: 0;
		font-family: 'Manrope', sans-serif;
		font-size: 38px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.025em;
		background: linear-gradient(135deg, #0f172a 30%, #1a73e8 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.lede {
		max-width: 700px;
		margin: 10px 0 0;
		color: #5f6368;
		font-size: 14px;
		line-height: 1.6;
		font-family: 'Manrope', sans-serif;
	}
	.target-card {
		min-height: 84px;
		gap: 14px;
		padding: 16px 18px;
		border: 1px solid #e8ecf2;
		border-radius: 14px;
		background: #ffffff;
		box-shadow: 0 4px 20px -2px rgba(26, 115, 232, 0.08);
	}
	.target-icon {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 10px;
		background: #e8f0fe;
		color: #1a73e8;
		border: 1px solid #d2e3fc;
		box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
	}
	.target-card div:nth-child(2) { display: grid; gap: 3px; }
	.target-card span { color: #5f6368; font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; }
	.target-card strong { font-size: 14px; color: #1e293b; }
	.target-check { margin-left: auto; color: #1e8e3e; }

	.command-bar {
		margin-top: 26px;
		padding: 12px 18px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		border: 1px solid #e8ecf2;
		border-bottom: 0;
		border-radius: 14px 14px 0 0;
		background: #ffffff;
		color: #1e293b;
	}
	.command-bar > div:first-child { display: grid; gap: 2px; }
	.command-label { color: #5f6368; font-size: 9.5px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.06em; }
	.command-bar strong { font-size: 13px; color: #1e293b; }
	.commands { gap: 6px; }
	.commands button {
		min-height: 32px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 13px;
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		background: #f8fafd;
		color: #475569;
		font-family: 'Manrope', sans-serif;
		font-size: 11px;
		font-weight: 750;
		transition: all 160ms ease;
	}
	.commands button:not(:disabled):hover {
		border-color: #1a73e8;
		color: #1a73e8;
		background: #ffffff;
		box-shadow: 0 2px 8px rgba(26, 115, 232, 0.1);
	}
	.commands button:disabled { cursor: not-allowed; opacity: 0.5; }

	.safety-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid #e8ecf2;
		border-top: 0;
		border-radius: 0 0 14px 14px;
		overflow: hidden;
		background: #ffffff;
	}
	.safety-grid > div {
		min-width: 0;
		padding: 15px 18px;
		display: grid;
		gap: 4px;
		border-right: 1px solid #f1f4f8;
		background: #ffffff;
	}
	.safety-grid > div:last-child { border-right: 0; }
	.safety-grid span { color: #5f6368; font: 750 9.5px/1 'Manrope', sans-serif; text-transform: uppercase; letter-spacing: 0.05em; }
	.safety-grid strong { overflow: hidden; text-overflow: ellipsis; font-size: 12px; color: #1e293b; white-space: nowrap; }
	.locked { gap: 6px; color: #b06000; }

	@media (max-width: 900px) {
		.intro { grid-template-columns: 1fr; }
		.target-card { max-width: 420px; }
		.safety-grid { grid-template-columns: repeat(2, 1fr); }
		.safety-grid > div:nth-child(2) { border-right: 0; }
		.safety-grid > div:nth-child(-n + 2) { border-bottom: 1px solid #f1f4f8; }
	}
	@media (max-width: 600px) {
		.topbar { padding: 0 10px; }
		.brand > span:last-child { display: none; }
		main { padding: 16px 5px 24px; }
		h1 { font-size: 28px; }
		.command-bar { align-items: flex-start; flex-direction: column; }
		.commands { width: 100%; }
		.commands button { flex: 1; justify-content: center; }
		.safety-grid { grid-template-columns: 1fr; }
		.safety-grid > div { border-right: 0; border-bottom: 1px solid #f1f4f8; }
		.safety-grid > div:last-child { border-bottom: 0; }
	}
</style>