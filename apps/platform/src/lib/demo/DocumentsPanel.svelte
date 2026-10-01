<script lang="ts">
	import { FileCheck2, FileClock, FileUp, Download, Check, X } from '@lucide/svelte';
	import type { EvidenceDocument } from './documents';
	import type { Persona } from './gateway';
	import type { WorkflowCommand } from './workflow';
	import { documentDraftError, documentTemplate, parseDocumentFile, type DocumentDraft } from './document-import';
	let { ownerId, operatorId, documents, persona, execute }: { ownerId: string; operatorId: string; documents: EvidenceDocument[]; persona: Persona; execute: (command: WorkflowCommand, operatorId?: string) => boolean } = $props();
	let documentId = $state('DEMO-doc-new');
	let category = $state<EvidenceDocument['category']>('identity');
	let name = $state('DEMO-evidence.txt');
	let content = $state('DEMO synthetic evidence');
	let expires = $state('2027-12-31');
	let reason = $state('DEMO: перевірено');
	let error = $state('');
	let pending = $state<DocumentDraft | null>(null);
	let reading = $state(false);
	let fileRequest = 0;
	let importNotice = $state('');
	const draft = $derived({ id: documentId, category, name, content, expires });
	const categoryLabels = { identity: 'Ідентифікація', account: 'Рахунок', registration: 'Реєстрація', other: 'Інше' };
	const statusLabels = { submitted: 'На перевірці', accepted: 'Прийнято', rejected: 'Відхилено' };
	function today() { return new Date().toISOString().slice(0, 10); }
	function fill(value: DocumentDraft) { documentId = value.id; category = value.category; name = value.name; content = value.content; expires = value.expires; error = ''; }
	function submit(event: SubmitEvent) {
		event.preventDefault();
		error = documentDraftError(draft, today());
		if (!error && !pending && !reading && execute({ type: 'document.submit', ...draft, ownerId }, operatorId)) importNotice = 'Версію збережено та передано на незалежну перевірку. Це не офіційне подання.';
	}
	function template() {
		const url = URL.createObjectURL(new Blob([JSON.stringify(documentTemplate, null, 2)], { type: 'application/json' }));
		const link = window.document.createElement('a'); link.href = url; link.download = 'DEMO-document-template.json'; link.click(); URL.revokeObjectURL(url);
	}
	const canSubmit = $derived(persona.kind === 'courier' ? persona.courierId === ownerId : persona.permissions.includes(ownerId === 'operator' ? 'profile' : 'compliance'));
	const canReview = $derived(persona.kind === 'operator' && persona.permissions.includes(ownerId === 'operator' ? 'approve' : 'compliance'));
	async function upload(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		const request = ++fileRequest;
		pending = null; error = ''; importNotice = ''; reading = false;
		if (!file) return;
		const current = { ...draft };
		reading = true;
		try {
			if (file.size > (/\.json$/i.test(file.name) ? 150000 : 20000)) throw new Error('Файл завеликий: TXT до 20 КБ, JSON до 150 КБ.');
			const text = await file.text();
			if (request === fileRequest) pending = parseDocumentFile(file.name, text, current, today());
		} catch (cause) { if (request === fileRequest) error = cause instanceof Error ? cause.message : 'Не вдалося прочитати файл.'; }
		finally { if (request === fileRequest) reading = false; }
	}
	function download(document: EvidenceDocument) {
		const url = URL.createObjectURL(new Blob([document.content], { type: 'text/plain;charset=utf-8' }));
		const link = window.document.createElement('a'); link.href = url; link.download = document.name; link.click(); URL.revokeObjectURL(url);
	}
</script>

<section class="documents" aria-label="Документи">
	<h3><FileCheck2 size={18} />Документи</h3>
	{#if canSubmit}
		<ol class="document-steps" aria-label="Підготовка документа"><li>Введіть дані або оберіть файл</li><li>Перевірте реквізити та вміст</li><li>Подайте версію на перевірку</li></ol>
		<p>Лише синтетичні дані. Файл читається локально, без надсилання назовні. PDF, фото та скани поки не розпізнаються; їхні реквізити можна внести вручну як DEMO-приклад.</p>
		<details><summary>Які дані підготувати?</summary><p>Оберіть тип, задайте ID з префіксом DEMO-doc-, назву DEMO-*.txt та майбутню дату чинності. Вміст починається з DEMO. Для виправлення існуючого документа використайте «Нова версія»: ID і тип залишаються незмінними. Це демонстраційний перелік, не юридичні вимоги.</p></details>
		<label>Заповнити із файла · TXT або JSON<input type="file" accept=".txt,.json,text/plain,application/json" onchange={upload} /></label>
		<p>TXT (до 20 КБ) переносить назву та вміст; ID, тип і дату заповніть вручну перед вибором файла. JSON (до 150 КБ) переносить усі п’ять полів за шаблоном.</p>
		<button type="button" onclick={template}><Download size={16} />Завантажити шаблон JSON</button>
		{#if reading}<p role="status">Читання файла...</p>{/if}
		{#if pending}
			<section class="import-preview" aria-label="Попередній перегляд документа">
				<h4>Знайдено у файлі · ще не збережено</h4>
				<dl><dt>ID</dt><dd>{pending.id}</dd><dt>Тип</dt><dd>{categoryLabels[pending.category]}</dd><dt>Назва</dt><dd>{pending.name}</dd><dt>Чинний до</dt><dd>{pending.expires}</dd></dl><pre>{pending.content}</pre>
				<p>Застосування замінить поточні поля форми. Документ буде збережено лише після подання версії.</p>
				<div class="actions"><button type="button" onclick={() => { if (pending) fill(pending); pending = null; importNotice = 'Поля перенесено. Перевірте їх і подайте версію.'; }}><Check size={16} />Застосувати до форми</button><button type="button" onclick={() => pending = null}><X size={16} />Скасувати імпорт</button></div>
			</section>
		{/if}
		<form onsubmit={submit} oninput={() => { error = ''; importNotice = ''; }}>
			<h4>Реквізити документа · ручне заповнення</h4>
			<div class="fields">
				<label>ID документа<input bind:value={documentId} required pattern="DEMO-doc-[a-zA-Z0-9-]+" maxlength="49" /></label>
				<label>Тип<select bind:value={category}><option value="identity">Ідентифікація</option><option value="account">Рахунок</option><option value="registration">Реєстрація</option><option value="other">Інше</option></select></label>
				<label>Назва файла<input bind:value={name} required maxlength="110" /></label>
				<label>Чинний до<input type="date" bind:value={expires} required /></label>
			</div>
			<label>Синтетичний вміст<textarea bind:value={content} required maxlength="20000" rows="3"></textarea></label>
			<p>Після подання: «На перевірці». Прийняти або відхилити документ має інший уповноважений користувач. Зміни створюють нову версію, а не стирають історію.</p>
			<button type="submit" disabled={reading || pending !== null}><FileUp size={16} />Подати версію</button>
		</form>
		{#if error}<p role="alert">{error}</p>{/if}
		{#if importNotice}<p role="status">{importNotice}</p>{/if}
	{/if}
	{#if canReview}<label>Обґрунтування рішення<input bind:value={reason} maxlength="500" /></label>{/if}
	{#each documents as document (`${document.id}-${document.version}`)}
		<div class="document">
			<div><strong>{document.name}</strong><p>{document.id} · v{document.version} · {statusLabels[document.status]} · до {document.expires}</p><p>{document.at} · {document.author}</p>{#if document.reviewer}<p>{document.reviewer} · {document.reviewedAt} · {document.reason}</p>{/if}</div>
			<div class="actions">
				<button aria-label={`Завантажити ${document.name} v${document.version}`} title="Завантажити документ" onclick={() => download(document)}><Download size={17} /></button>
				{#if canSubmit}<button title="Підготувати наступну версію" aria-label={`Нова версія ${document.id}`} onclick={() => { ++fileRequest; reading = false; pending = null; fill(document); importNotice = 'Підготовлено наступну версію. Відредагуйте поля й подайте її на перевірку.'; }}><FileClock size={17} /></button>{/if}
				{#if canReview && document.author !== persona.id && document.status === 'submitted' && !documents.some(item => item.id === document.id && item.version > document.version)}
					<button title="Прийняти" aria-label={`Прийняти ${document.id}`} onclick={() => execute({ type: 'document.review', id: document.id, version: document.version, status: 'accepted', reason }, operatorId)}><Check size={17} /></button>
					<button title="Відхилити" aria-label={`Відхилити ${document.id}`} onclick={() => execute({ type: 'document.review', id: document.id, version: document.version, status: 'rejected', reason }, operatorId)}><X size={17} /></button>
				{/if}
			</div>
		</div>
	{:else}<p>Документи не подано.</p>{/each}
</section>

<style>
	.document-steps { display: flex; flex-wrap: wrap; gap: 12px 32px; padding-left: 20px; font-size: 13px; line-height: 1.7; } .import-preview { margin: 20px 0; padding: 16px 0; border-block: 1px solid #bbc7c5; } pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow-y: auto; font-size: 13px; } dd { margin: 4px 0 12px; overflow-wrap: anywhere; } summary { cursor: pointer; padding: 12px 0; } button:disabled { opacity: .6; cursor: default; }
	.documents { margin-top: 24px; border-top: 1px solid #d7dadd; padding-top: 16px; } h3, .actions { display: flex; align-items: center; gap: 8px; } h3 { font-size: 15px; } .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; } label { display: grid; gap: 6px; margin: 12px 0; font-size: 13px; } input, select, textarea { width: 100%; min-width: 0; padding: 10px; border: 1px solid #bbc7c5; border-radius: 6px; background: white; color: #23262b; font: inherit; } button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 8px 12px; border: 1px solid #bbc7c5; border-radius: 6px; background: white; color: #23262b; cursor: pointer; } .document { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 14px 0; border-bottom: 1px solid #d7dadd; } .document > div { min-width: 0; } p, strong { overflow-wrap: anywhere; } p { font-size: 12px; color: #60666f; } :focus-visible { outline: 3px solid #176c63; outline-offset: 2px; }
</style>