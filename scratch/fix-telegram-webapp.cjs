const fs = require('fs');
let html = fs.readFileSync('apps/merchant-app/index.html', 'utf8');
if (!html.includes('telegram-web-app.js')) {
    html = html.replace('</head>', '    <script src="https://telegram.org/js/telegram-web-app.js"></script>\n  </head>');
    fs.writeFileSync('apps/merchant-app/index.html', html);
    console.log("Added script to index.html");
}

let svelte = fs.readFileSync('apps/merchant-app/src/auth/TelegramExternalBrowser.svelte', 'utf8');
const newSvelte = `<script lang="ts">
	let copied = $state(false);
	let copyFailed = $state(false);
	const url = \`\${window.location.origin}/app/\`;
	
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
`;
fs.writeFileSync('apps/merchant-app/src/auth/TelegramExternalBrowser.svelte', newSvelte);
console.log("Updated TelegramExternalBrowser.svelte");
