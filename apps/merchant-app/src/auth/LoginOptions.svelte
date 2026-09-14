<script lang="ts">
	import { telegramLocalMessage } from './login-availability';
	import AccountIdentityGuidance from './AccountIdentityGuidance.svelte';
	import type { Snippet } from 'svelte';
	let { children, enabled = false, busy = false, onTelegram }: {
		children: Snippet; enabled?: boolean; busy?: boolean; onTelegram?: () => void;
	} = $props();
	let showTelegramDetails = $state(false);
</script>

<div class="login-options">
	<AccountIdentityGuidance context="guest" />
	<button type="button" class="telegram-login" disabled={busy} aria-expanded={enabled ? undefined : showTelegramDetails}
		aria-controls={enabled ? undefined : 'telegram-login-details'} onclick={() => {
			if (enabled) onTelegram?.();
			else showTelegramDetails = !showTelegramDetails;
		}}>
		<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true">
			<path d="M21.4 3.6 18.2 20c-.2 1-1 1.2-1.8.7l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.3L5.8 13.5l-4.8-1.5c-1-.3-1-1 .2-1.5L20 3.2c.9-.3 1.7.2 1.4.4Z" />
		</svg>
		Увійти через Telegram
	</button>
	{#if !enabled}<small>Налаштування провайдера · вхід ще не активовано</small>{/if}
	{#if showTelegramDetails}
		<p id="telegram-login-details" role="status">{telegramLocalMessage}</p>
	{/if}
	<div class="separator"><span></span>або через Google<span></span></div>
	{@render children()}
</div>

<style>
	.login-options { display: flex; flex-direction: column; align-items: center; gap: 14px; width: min(100%, 340px); }
	.telegram-login { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 48px; border: 0; border-radius: 12px; background: #2388bd; color: white; font: inherit; font-weight: 600; cursor: pointer; }
	.telegram-login:hover { background: #1c729f; }
	.telegram-login:focus-visible { outline: 3px solid #8cd6ff; outline-offset: 3px; }
	small, p { color: #aab5c3; text-align: center; line-height: 1.6; }
	small { font-size: 12px; }
	p { margin: 0; font-size: 13px; }
	.separator { display: flex; align-items: center; gap: 12px; width: 100%; color: #aab5c3; font-size: 12px; }
	.separator span { flex: 1; height: 1px; background: #ffffff24; }
</style>