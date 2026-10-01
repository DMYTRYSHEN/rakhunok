const fs = require('fs');

let code = fs.readFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', 'utf8');

// 1. We need to find the `{:else}` block for the couriers.
// The file has:
// {:else}
// 		<details><summary class="font-bold text-slate-700 cursor-pointer">...
// We will replace `{:else}\n\t\t<details>` with our new flex container layout.

code = code.replace(
    /\{:else\}\s*<details>/,
    `{:else}
		<div class="flex flex-col xl:flex-row gap-8 items-start w-full">
			<!-- Ліва панель (Список та Пошук) -->
			<div class="w-full xl:w-1/3 flex flex-col gap-6 xl:sticky xl:top-6">
				<details>`
);

// 2. Wrap the pagination end and insert the right pane wrapper
// We look for: <button class="px-4 py-2 ...">Далі</button>\n\t</div>
// And right after it, BEFORE `{#if selected}`, we close the left pane and open the right pane.

code = code.replace(
    /<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:hover:text-slate-600 disabled:cursor-not-allowed shadow-sm" disabled=\{page \* 2 >= rows\.length\} onclick=\{\(\) => page\+\+\}>Далі<\/button>\n\t<\/div>\n\t\t\{#if selected\}/g,
    `<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:hover:text-slate-600 disabled:cursor-not-allowed shadow-sm" disabled={page * 2 >= rows.length} onclick={() => page++}>Далі</button>
	</div>
			</div>
			
			<!-- Права панель (Деталі) -->
			<div class="w-full xl:w-2/3">
				{#if selected}`
);

// 3. Make the selected card look even more beautiful (Apple modal style)
code = code.replace(
    /\{#if selected\}<div class="mt-8 p-6 bg-white\/40 border border-white\/60 rounded-3xl shadow-sm">/g,
    `{#if selected}<div class="p-8 bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] shadow-xl shadow-slate-900/5">`
);

// 4. Add the empty state for `{:else}` on the `{#if selected}`
code = code.replace(
    /Р—Р°РїСЂРѕСЃРёС‚Рё СѓС‚РѕС‡РЅРµРЅРЅСЏ<\/button>\n\t\t\t<\/div>\n\t\t\{\/if\}\n\t<\/div>\{\/if\}\n\{\/if\}\n<\/section>/g,
    `Запросити уточнення</button>
			</div>
		{/if}
	</div>
				{:else}
					<div class="h-full min-h-[500px] flex items-center justify-center bg-slate-50/50 border border-dashed border-slate-300 rounded-[2rem]">
						<div class="text-slate-400 text-center">
							<div class="flex justify-center mb-4 opacity-50">
								<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
							</div>
							<p class="font-medium text-lg">Оберіть самозайнятого зі списку ліворуч</p>
							<p class="text-sm mt-2">Або додайте нового через форму вище</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
{/if}
</section>`
);

fs.writeFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', code, 'utf8');
console.log('Master-Detail Layout Applied');
