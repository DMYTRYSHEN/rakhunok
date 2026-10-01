const fs = require('fs');
let code = fs.readFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', 'utf8');

code = code.replace(
    /\{:else\}[\s\S]*?Самозайнятих не знайдено\.[\s\S]*?\{\/each\}/, 
    `{/each}
				{#if rows.length === 0}
					<div class="p-8 text-center bg-slate-50/80 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">
						Самозайнятих не знайдено.
					</div>
				{/if}`
);

fs.writeFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', code, 'utf8');
console.log('Fixed');
