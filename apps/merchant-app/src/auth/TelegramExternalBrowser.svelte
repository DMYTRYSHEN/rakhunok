<script lang="ts">
	let copied = $state(false);
	let copyFailed = $state(false);
	const url = `${window.location.origin}/app/`;
	
	function openNative() {
		// @ts-ignore
		if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
			// @ts-ignore
			window.Telegram.WebApp.openLink(url);
		} else {
			copyLink();
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			copyFailed = false;
		} catch { copyFailed = true; }
	}
</script>

<div role="status">
	<p>Вхід і прив’язування Telegram у вбудованому браузері вимкнено.</p>
	<p>Щоб авторизуватись, відкрийте Касу в Safari або Chrome за допомогою кнопки нижче.</p>
	<button type="button" onclick={openNative} style="padding: 16px; font-size: 16px; font-weight: bold; background: #007aff; color: white; border-radius: 12px; border: none; width: 100%; margin-top: 10px; cursor: pointer;">
		Відкрити в Safari / Chrome
	</button>
	{#if copyFailed}<p>Не вдалося скопіювати посилання: <span>{url}</span></p>{/if}
</div>
