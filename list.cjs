const fs = require('fs');
let code = fs.readFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', 'utf8');

// Replace the ugly .row list with a nice Tailwind styled list
code = code.replace(
    /\{#each rows\.slice[\s\S]*?\{\/each\}/,
    `{#each rows.slice((page - 1) * 2, page * 2) as person (person.id)}
		<div class="mt-4">
			<button class="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:ring-2 hover:ring-indigo-100 rounded-2xl transition-all text-left group" onclick={() => select(person.id)}>
				<div>
					<div class="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{person.name}</div>
					<div class="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">{person.id} · {activityLabels[person.activity]}</div>
				</div>
				<div class="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium border border-amber-100 shadow-sm">{blockers(data.sellers.find(profile => profile.courierId === person.id)) || 'Готово до виплат'}</div>
			</button>
		</div>
	{:else}
		<div class="p-8 mt-4 text-center bg-slate-50/80 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">
			Самозайнятих не знайдено.
		</div>
	{/each}`
);

// Style the actions (pagination)
code = code.replace(
    /<div class="actions">[\s\S]*?<\/div>/,
    `<div class="flex items-center justify-between mt-6 bg-slate-100/50 p-2 rounded-xl border border-slate-200/60">
		<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:hover:text-slate-600 disabled:cursor-not-allowed shadow-sm" disabled={page === 1} onclick={() => page--}>Назад</button>
		<span class="text-xs font-bold uppercase tracking-widest text-slate-400">Сторінка {page} з {Math.max(1, Math.ceil(rows.length / 2))}</span>
		<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:hover:text-slate-600 disabled:cursor-not-allowed shadow-sm" disabled={page * 2 >= rows.length} onclick={() => page++}>Далі</button>
	</div>`
);

fs.writeFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', code, 'utf8');
console.log('Fixed List');
