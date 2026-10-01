<script lang="ts">
	import { Check, Upload, KeyRound, RotateCcw, X, Download } from '@lucide/svelte';
	import type { DemoGateway, Persona } from './gateway';
	import type { WorkflowCommand } from './workflow';
	import { parseImport, validateRow, exportCsv, type ImportResult } from './ledger';
	let { persona, data, execute, importRecords, mode = 'integrations' }: { persona: Persona; data: ReturnType<DemoGateway['integration']>; execute: (command: WorkflowCommand) => boolean; importRecords: (command: Extract<WorkflowCommand, { type: 'ledger.import' }>) => ImportResult; mode?: 'integrations' | 'operations' } = $props();
	let keyId = $state('DEMO-key-one');
	let income = $state(true);
	let customer = $state(false);
	let selectedKey = $state('');
	let format = $state<'json' | 'csv'>('json');
	let idColumn = $state('id');
	const mappingFields = ['kind', 'courierId', 'amountMinor', 'currency', 'occurredAt', 'activity', 'adjustment', 'originalId', 'reason', 'targetCourierId'];
	let mapping = $state<Record<string, string>>({});
	let content = $state(JSON.stringify([{ id: 'DEMO-income-1', kind: 'income', courierId: 'courier-1', amountMinor: 1000, currency: 'UAH', occurredAt: '2026-09-01T00:00:00.000Z', activity: 'delivery' }], null, 2));
	let preview = $state(false);
	let fileError = $state('');
	let keyAction = $state<{ type: 'key.revoke' | 'key.rotate'; id: string } | null>(null);
	let response = $state<ImportResult | null>(null);
	const activeKeys = $derived(data.keys.filter(key => key.status === 'active'));
	const keyStatus = (status: string) => ({ active: 'Активний', revoked: 'Відкликаний', rotated: 'Замінений' })[status] ?? status;
	function invalidatePreview() { preview = false; response = null; }
	function submit() {
		response = importRecords({ type: 'ledger.import', rows: parsed.rows, ...(mode === 'integrations' ? { keyId: selectedKey } : {}) });
	}
	const parsed = $derived(parseImport(content, format, { ...mapping, id: idColumn }));
	const errors = $derived([...parsed.errors, ...parsed.rows.flatMap((row, index) => { const error = validateRow(row, persona.operatorId!, data.sellerIds); return error ? [`ROW_${index + 1}:${error}`] : []; })]);
	const ready = $derived(preview && errors.length === 0 && parsed.rows.length > 0 && !fileError && (mode !== 'integrations' || !!selectedKey));
	async function file(event: Event) {
		const selected = (event.currentTarget as HTMLInputElement).files?.[0];
		fileError = ''; invalidatePreview();
		if (!selected) return;
		if (selected.size > 100000) { fileError = 'FILE_LIMIT_100KB'; return; }
		try { content = await selected.text(); format = selected.name.endsWith('.csv') ? 'csv' : 'json'; } catch { fileError = 'FILE_READ_FAILED'; }
	}
	function download() {
		const url = URL.createObjectURL(new Blob([exportCsv(data.events)], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a'); link.href = url; link.download = 'DEMO-events.csv'; link.click(); URL.revokeObjectURL(url);
	}
</script>

<section class="module">
	{#if mode === 'integrations'}
		<div class="section-heading"><span class="step-number">01</span><h2>Тестові ключі <small>DEMO · test</small></h2><span class="section-state">Активних: {activeKeys.length}</span></div>
		<div class="key-form"><label for="key-id">Ідентифікатор ключа<input id="key-id" bind:value={keyId} maxlength="49" /></label><fieldset><legend>Доступ до подій</legend><div class="scopes"><label class="check"><input type="checkbox" bind:checked={income} />Винагороди</label><label class="check"><input type="checkbox" bind:checked={customer} />Оплати покупців</label></div></fieldset><button class="primary" onclick={() => execute({ type: 'key.create', id: keyId, scopes: [...(income ? ['income' as const] : []), ...(customer ? ['customer' as const] : [])], environment: 'test' })}><KeyRound size={16} />Створити тестовий ключ</button></div>
		{#each data.keys as key (key.id)}<div class="record"><div><strong>{key.id}</strong><p>{key.scopes.map(scope => scope === 'income' ? 'Винагороди' : 'Оплати покупців').join(' · ')}</p></div><span class="key-state" class:active={key.status === 'active'}>{keyStatus(key.status)}</span><button title="Ротація ключа" aria-label={`Ротація ${key.id}`} disabled={key.status !== 'active'} onclick={() => keyAction = { type: 'key.rotate', id: key.id }}><RotateCcw size={16} /></button><button title="Відкликати ключ" aria-label={`Відкликати ${key.id}`} disabled={key.status !== 'active'} onclick={() => keyAction = { type: 'key.revoke', id: key.id }}><X size={16} /> </button></div>{:else}<div class="key-empty"><KeyRound size={22} /><p>Тестових ключів немає.</p></div>{/each}
		{#if keyAction}<div role="group" aria-label="Підтвердження зміни ключа"><p>Ключ {keyAction.id} перестане приймати нові події.</p><div class="toolbar"><button onclick={() => { if (!keyAction) return; const command: WorkflowCommand = keyAction.type === 'key.rotate' ? { type: 'key.rotate', id: keyAction.id, replacementId: `DEMO-key-${crypto.randomUUID()}` } : { type: 'key.revoke', id: keyAction.id }; if (execute(command)) { keyAction = null; selectedKey = ''; } }}>Підтвердити зміну ключа</button><button onclick={() => keyAction = null}>Скасувати</button></div></div>{/if}
	{/if}
	<div class="section-heading import-heading"><span class="step-number">{mode === 'integrations' ? '02' : '01'}</span><h2>{mode === 'integrations' ? 'Локальна API-консоль' : 'Імпорт операцій'} <small>DEMO</small></h2></div>
	<div class="toolbar"><label for="import-format">Формат<select id="import-format" bind:value={format} onchange={invalidatePreview}><option value="json">JSON</option><option value="csv">CSV</option></select></label><label for="import-column">Колонка ID<input id="import-column" bind:value={idColumn} oninput={invalidatePreview} /></label>{#if mode === 'integrations'}<label for="import-key">Тестовий ключ<select id="import-key" bind:value={selectedKey} onchange={() => response = null}><option value="">Оберіть ключ</option>{#each activeKeys as key (key.id)}<option value={key.id}>{key.id}</option>{/each}</select></label>{/if}</div>
	<label for="import-file">Файл · до 100 KB<input id="import-file" type="file" accept=".json,.csv" onchange={file} /></label>
	<details><summary>Відповідність полів</summary><div class="toolbar">{#each mappingFields as field (field)}<label for={`mapping-${field}`}>{field}<input id={`mapping-${field}`} placeholder={field} bind:value={mapping[field]} oninput={invalidatePreview} /></label>{/each}</div></details>
	<label for="import-content">Події · суми в копійках<textarea id="import-content" rows="10" bind:value={content} oninput={invalidatePreview} spellcheck="false"></textarea></label>
	<div class="section-heading import-heading"><span class="step-number">{mode === 'integrations' ? '03' : '02'}</span><h2>Перевірка та запис</h2><span class="section-state" aria-live="polite">{preview ? errors.length ? `Помилок: ${errors.length}` : `Перевірено рядків: ${parsed.rows.length}` : 'Не перевірено'}</span></div>
	{#if fileError}<p role="alert">{fileError === 'FILE_LIMIT_100KB' ? 'Файл перевищує 100 KB.' : 'Не вдалося прочитати файл.'} <code>{fileError}</code></p>{/if}
	{#if preview}
		{#each errors as error, index (index)}<p role="alert">Помилка перевірки: <code>{error}</code></p>{/each}
		<div class="scroll"><table aria-label="Попередній перегляд імпорту"><thead><tr><th>ID</th><th>Тип</th><th>Самозайнятий</th><th>Копійки</th><th>Коригування</th></tr></thead><tbody>{#each parsed.rows as row, index (index)}<tr><td>{row.id}</td><td>{row.kind === 'income' ? 'Винагорода' : row.kind === 'customer' ? 'Оплата покупця' : row.kind}</td><td>{row.courierId}</td><td>{row.amountMinor}</td><td>{row.adjustment ?? '—'}</td></tr>{/each}</tbody></table></div>
	{/if}
	<div class="toolbar"><button class:primary={!ready} onclick={() => preview = true}><Check size={16} />Перевірити імпорт</button><button class:primary={ready} disabled={!ready} onclick={submit}><Upload size={16} />Записати демоподії</button>{#if persona.permissions.includes('finance')}<button onclick={download} disabled={!data.events.length}><Download size={16} />Експорт подій</button>{/if}</div>
	{#if mode === 'integrations' && !selectedKey}<p class="prerequisite">Для запису не вибрано активний тестовий ключ.</p>{/if}
	{#if response}<output aria-label="Результат імпорту"><p class="import-result" class:rejected={response.status === 'rejected'}>{response.status === 'rejected' ? 'Імпорт відхилено' : response.status === 'replayed' ? 'Повтор підтверджено. Нових записів немає.' : 'Демоподії записано'}</p><details><summary>Технічний результат</summary><pre>{JSON.stringify(response, null, 2)}</pre></details></output>{/if}
	{#if mode === 'operations'}
		<h2>Джерела операцій</h2>
		{#each data.events as source (`${source.kind}:${source.id}`)}<details><summary>{source.kind} · {source.id}</summary><dl><dt>Самозайнятий</dt><dd>{source.courierId}</dd><dt>Сума, копійки</dt><dd>{source.amountMinor} {source.currency}</dd><dt>Діяльність</dt><dd>{source.activity}</dd><dt>Час події / отримання</dt><dd>{source.occurredAt} / {source.receivedAt}</dd><dt>Автор</dt><dd>{source.actorId}</dd>{#if source.adjustment}<dt>Коригування / джерело</dt><dd>{source.adjustment} / {source.originalId}</dd><dt>Причина</dt><dd>{source.reason}</dd>{/if}</dl></details>{:else}<p>Імпортованих джерел немає. Початкові записи позначені як demo-*.</p>{/each}
	{/if}
</section>

<style>
	pre { white-space: pre-wrap; overflow-wrap: anywhere; }
	.section-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
	.section-heading h2 { flex: 1; margin: 0 !important; min-width: 160px; }
	.step-number { width: 32px; height: 32px; display: grid; place-items: center; background: #edf4ef; border-radius: 50%; color: #126450; font-size: 11px; font-weight: 750; flex-shrink: 0; }
	.section-state { font-size: 12px; color: #596460; }
	.import-heading { border-top: 1px solid #dee5e1; padding-top: 28px; margin-top: 28px; }
	.key-form { display: flex; align-items: end; gap: 24px; flex-wrap: wrap; margin: 20px 0; }
	.key-form > label { flex: 1; min-width: 200px; margin: 0; }
	.key-form > button { margin-bottom: 0; }
	fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
	legend { font-size: 12px; color: #596460; margin-bottom: 8px; }
	.scopes { display: flex; gap: 16px; min-height: 44px; align-items: center; flex-wrap: wrap; }
	.scopes label { margin: 0; }
	.key-empty { display: flex; gap: 12px; align-items: center; padding: 18px 0; color: #596460; }
	.key-state { font-size: 11px; font-weight: 650; color: #596460; background: #eef1ef; border-radius: 4px; padding: 5px 9px; }
	.key-state.active { color: #126450; background: #e1f2e9; }
	.prerequisite { font-size: 12px; }
	.import-result { padding: 16px; background: #edf7f1; border-left: 2px solid #126450; font-weight: 650; }
	.import-result.rejected { background: #fff3ef; border-color: #a33325; }
	@media (max-width: 700px) { .key-form { gap: 16px; } .key-form > label, .key-form > button, fieldset { width: 100%; } .section-state { flex-basis: 100%; padding-left: 44px; } }
</style>