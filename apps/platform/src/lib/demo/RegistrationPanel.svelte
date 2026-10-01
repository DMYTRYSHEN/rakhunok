<script lang="ts">
	import { Save, Check, Send, ArrowLeft, ArrowRight, Download } from '@lucide/svelte';
	import type { Persona } from './gateway';
	import type { PackageDetails, PackageFields, Registration, WorkflowCommand } from './workflow';
	let { history, persona, execute }: { history: Registration[]; persona: Persona; execute: (command: WorkflowCommand) => boolean } = $props();
	const latest = $derived(history.at(-1));
	let fields: PackageFields = $derived(structuredClone(latest?.fields ?? { organization: '', platform: '', activity: '', representative: '', contact: '', documents: '', details: { registrationId: '', country: 'UA', address: '', representativeName: '', capacity: '', mandateReference: '', platforms: [{ name: '', url: '', activities: [] }] } }));
	let step = $state(0);
	let reason = $state('DEMO: рішення симулятора');
	let evidence = $state('');
	let outcome = $state<'review' | 'clarification' | 'rejected' | 'registered' | 'unavailable'>('registered');
	const editable = $derived(persona.permissions.includes('profile'));
	const groups: { title: string; keys: (Exclude<keyof PackageFields, 'details'>)[] }[] = [
		{ title: 'Організація', keys: ['organization', 'platform', 'activity'] },
		{ title: 'Представник', keys: ['representative', 'contact'] },
		{ title: 'Документи', keys: ['documents'] }
	];
	const labels = { organization: 'Назва організації', platform: 'Цифрові платформи', activity: 'Види діяльності', representative: 'Представник / повноваження', contact: 'Контакт пакета (.example)', documents: 'Перелік синтетичних документів' };
	const detailLabels = { registrationId: 'Реєстраційний ID · DEMO-', country: 'Країна · ISO', address: 'Адреса · DEMO', representativeName: 'Ім’я представника · DEMO', capacity: 'Посада представника', mandateReference: 'Підстава повноважень · DEMO' };
	const activityLabels = { delivery: 'Доставка', taxi: 'Таксі', services: 'Послуги', other: 'Інше' };
	function detail(key: keyof typeof detailLabels, value: string) { if (fields.details) fields = { ...fields, details: { ...fields.details, [key]: value } }; }
	function platform(index: number, patch: Partial<PackageDetails['platforms'][number]>) { if (fields.details) fields = { ...fields, details: { ...fields.details, platforms: fields.details.platforms.map((item, position) => position === index ? { ...item, ...patch } : item) } }; }
	function save() { return execute({ type: 'registration.save', fields: $state.snapshot(fields) }); }
	function move(direction: number) { if (!editable || save()) step += direction; }
	function download() {
		const url = URL.createObjectURL(new Blob([JSON.stringify({ warning: 'DEMO - NOT FOR SUBMISSION', package: latest }, null, 2)], { type: 'application/json' }));
		const link = document.createElement('a'); link.href = url; link.download = 'DEMO-registration.json'; link.click(); URL.revokeObjectURL(url);
	}
</script>

<section class="module">
	<h2>Пакет оператора <small>DEMO</small></h2>
	<p>Демонстраційний склад пакета. Офіційні вимоги та державний канал не підтверджені.</p>
	<div class="flex gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl"  aria-label="Етап анкети">{#each groups as group, index (group.title)}<div class="flex-1 text-center py-2.5 rounded-xl text-sm font-bold transition-all duration-300 {step === index ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-400'}"><span class="opacity-50 mr-1">{index + 1}.</span> {group.title}</div>{/each}</div>
	<div class="bg-white/40 p-6 rounded-3xl border border-white/60 mb-6 shadow-sm"><h3 class="text-lg font-bold text-slate-800 mb-6">{groups[step].title}</h3><div class="space-y-4">
	{#each groups[step].keys as key (key)}
		<label for={`package-${key}`}>{labels[key]}</label>
		<input id={`package-${key}`} maxlength="500" value={fields[key]} oninput={event => fields = { ...fields, [key]: event.currentTarget.value }} disabled={!editable} />
	{/each}
	{#if fields.details}
		{#each (step === 0 ? ['registrationId', 'country', 'address'] : step === 1 ? ['representativeName', 'capacity', 'mandateReference'] : []) as name (name)}
			{@const key = name as keyof typeof detailLabels}
			<label for={`package-detail-${key}`}>{detailLabels[key]}</label><input id={`package-detail-${key}`} value={fields.details[key]} oninput={event => detail(key, event.currentTarget.value)} maxlength="500" disabled={!editable} />
		{/each}
		{#if step === 0}
			{#each fields.details.platforms as item, index (index)}
				<fieldset><legend>Цифрова платформа {index + 1}</legend>
				<label for={`platform-name-${index}`}>Назва</label><input id={`platform-name-${index}`} value={item.name} oninput={event => platform(index, { name: event.currentTarget.value })} maxlength="120" disabled={!editable} />
				<label for={`platform-url-${index}`}>URL · https://*.example</label><input id={`platform-url-${index}`} value={item.url} oninput={event => platform(index, { url: event.currentTarget.value })} maxlength="500" disabled={!editable} />
				{#each Object.entries(activityLabels) as [value, label] (value)}<label class="activity"><input type="checkbox" checked={item.activities.includes(value)} disabled={!editable} onchange={event => platform(index, { activities: event.currentTarget.checked ? [...item.activities, value] : item.activities.filter(activity => activity !== value) })} />{label}</label>{/each}
				{#if editable && fields.details.platforms.length > 1}<button onclick={() => { if (fields.details) fields = { ...fields, details: { ...fields.details, platforms: fields.details.platforms.filter((_, position) => position !== index) } }; }}>Видалити платформу {index + 1}</button>{/if}
				</fieldset>
			{/each}
			{#if editable}<button disabled={fields.details.platforms.length >= 10} onclick={() => { if (fields.details) fields = { ...fields, details: { ...fields.details, platforms: [...fields.details.platforms, { name: '', url: '', activities: [] }] } }; }}>Додати платформу</button>{/if}
		{/if}
	{/if}
	</div></div><div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-200/50">
		<button onclick={() => move(-1)} disabled={step === 0}><ArrowLeft size={16} />Назад</button>
		{#if editable}<button onclick={save}><Save size={16} />Зберегти чернетку</button>{/if}
		<button onclick={() => move(1)} disabled={step === 2}>Далі<ArrowRight size={16} /></button>
	</div>
	{#if latest}<details class="mt-12 bg-white/50 rounded-2xl border border-slate-200 overflow-hidden group"><summary class="px-6 py-4 cursor-pointer font-bold text-slate-700 flex items-center justify-between hover:bg-white/80 transition-colors"><span>Історія версій та рішення</span></summary><div class="p-6 border-t border-slate-200 text-sm space-y-6"><h3>Версія {latest.version} · {latest.status} · DEMO</h3>
		<dl>{#each Object.entries(latest.fields).filter(([key]) => key !== 'details') as [key, value] (key)}<dt>{labels[key as keyof typeof labels]}</dt><dd>{String(value) || 'Не заповнено'}</dd>{/each}</dl>
		{#if latest.fields.details}<details><summary>Структуровані реквізити пакета</summary><pre>{JSON.stringify(latest.fields.details, null, 2)}</pre></details>{/if}
		<p>Документи пакета: {latest.documentVersions?.map(document => `${document.id} · v${document.version}`).join(', ') || 'Без файлових додатків'}</p>
		<p>Автор: {latest.author}. Погодження: {latest.approvedBy ?? 'відсутнє'}. {latest.receipt}</p>
		<div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-200/50">
			{#if persona.permissions.includes('approve')}<button onclick={() => execute({ type: 'registration.approve', version: latest.version })}><Check size={16} />Погодити пакет</button>{/if}
			{#if editable}<button onclick={() => execute({ type: 'registration.submit', version: latest.version })}><Send size={16} />Передати в деморозгляд</button>{/if}
			<button onclick={download}><Download size={16} />Експорт DEMO</button>
		</div>
		{#if editable}
			<h3>Симулятор рішення · DEMO</h3>
			<label for="registration-outcome">Результат</label><select id="registration-outcome" bind:value={outcome}><option value="review">На розгляді</option><option value="clarification">Уточнення</option><option value="rejected">Відмова</option><option value="registered">Зареєстровано · DEMO</option><option value="unavailable">Канал недоступний</option></select>
			<label for="registration-reason">Причина</label><input id="registration-reason" bind:value={reason} maxlength="500" />
			<button onclick={() => execute({ type: 'registration.resolve', version: latest.version, outcome, reason })}>Застосувати деморішення</button>
			<label for="registration-evidence">Посилання / опис ручного доказу (не перевірено)</label><input id="registration-evidence" bind:value={evidence} maxlength="500" /><button onclick={() => execute({ type: 'registration.evidence', version: latest.version, evidence })}>Додати доказ</button>
		{/if}
		<h3>Історія пакета</h3>
		{#each [...history].reverse() as item (item.version)}<details><summary>v{item.version} · {item.status} · {item.at}</summary><p>{item.reason} {item.receipt}</p><p>Ручний доказ (не перевірено): {item.manualEvidence || 'відсутній'}</p><pre>{JSON.stringify(item.fields, null, 2)}</pre></details>{/each}</div></details>{/if}</section>

