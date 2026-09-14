<script lang="ts">
	let copied = $state(false);
	let copyFailed = $state(false);
	const url = 'https://letsrealtalk.com/app/';
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			copyFailed = false;
		} catch { copyFailed = true; }
	}
</script>

<div role="status">
	<p>Вхід і прив’язування Telegram у вбудованому браузері вимкнено. У меню Telegram ⋯ виберіть «Відкрити в Safari» або «Відкрити в браузері».</p>
	<p>Або скопіюйте адресу й відкрийте її в Safari чи системному браузері. Для прив’язування спочатку увійдіть там через Google у той самий акаунт.</p>
	<button type="button" onclick={copyLink}>{copied ? 'Адресу скопійовано' : 'Скопіювати адресу для браузера'}</button>
	{#if copyFailed}<p>Скопіюйте адресу вручну: <span>{url}</span></p>{/if}
</div>