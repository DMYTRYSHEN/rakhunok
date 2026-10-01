const fs = require('fs');
let code = fs.readFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', 'utf8');

code = code.replace(
    /onclick=\{\(\) => page\+\+\}>[^<]*<\/button>\n\t<\/div>\n\t\t\{#if selected\}/g,
    `onclick={() => page++}>Далі</button>
	</div>
			</div>
			
			<!-- Права панель (Деталі) -->
			<div class="w-full xl:w-2/3">
				{#if selected}`
);

fs.writeFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', code, 'utf8');
