<script lang="ts">
	import { Plus, Check, Send, Download, ClipboardCheck } from '@lucide/svelte';
	import type { DemoGateway, Persona } from './gateway';
	import type { WorkflowCommand } from './workflow';
	import { reportArtifact, type Assessment, type Report } from './reports';
	let { persona, data, reporting, execute }: { persona: Persona; data: ReturnType<DemoGateway['reports']>; reporting: ReturnType<DemoGateway['reporting']>; execute: (command: WorkflowCommand) => boolean } = $props();
	let quarter = $state('2026-Q3');
	let sellerId = $state('');
	let outcome = $state<Assessment['outcome']>('review');
	let assessmentReason = $state('');
	let ruleSource = $state('DEMO-UA-policy-v1');
	let evidence = $state('');
	let fees = $state<number>();
	let withholding = $state<number>();
	const outcomes = { reportable: 'Підзвітний', excluded: 'Виключений', review: 'Потребує перевірки' };
	const history = $derived(reporting.assessments.filter(item => item.quarter === quarter && (!sellerId || item.courierId === sellerId)));
	let reason = $state('');
	let corrects = $state('');
	let decision = $state('DEMO: результат перевірки');
	let operatorFilter = $state('all');
	let quarterFilter = $state('all');
	const visible = $derived(data.filter(report => (operatorFilter === 'all' || report.operatorId === operatorFilter) && (quarterFilter === 'all' || report.quarter === quarterFilter)));
	const finance = $derived(persona.kind === 'operator' && persona.permissions.includes('finance'));
	const statuses: Record<Report['status'], string> = { draft: 'Чернетка', approved: 'Погоджено', submitted: 'Передано', received: 'Технічно отримано', accepted: 'Прийнято', rejected: 'Відхилено', unavailable: 'Канал недоступний' };
	const money = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100);
	function create() {
		if (execute({ type: 'report.create', id: `DEMO-${crypto.randomUUID()}`, quarter, reason, ...(corrects ? { corrects } : {}) })) { corrects = ''; reason = ''; }
	}
	function assess() {
		if (fees === undefined || withholding === undefined) return;
		execute({ type: 'report.assess', assessment: { courierId: sellerId, quarter, outcome, reason: assessmentReason, ruleSource, evidence, feesMinor: Math.round(fees * 100), withholdingMinor: Math.round(withholding * 100) } });
	}
	function download(report: (typeof data)[number]) {
		const url = URL.createObjectURL(new Blob([JSON.stringify(reportArtifact(report), null, 2)], { type: 'application/json' }));
		const link = document.createElement('a'); link.href = url; link.download = `${report.id}-${persona.kind === 'courier' ? 'statement' : 'report'}.DEMO.json`; link.click(); URL.revokeObjectURL(url);
	}
</script>
<section class="module" aria-label="Звітність">
	<h2>{persona.kind === 'courier' ? 'Мої витяги' : 'Квартальна звітність'} <small>DEMO-UA-v2</small></h2>
	<p>Демонстраційні артефакти непридатні для офіційного подання. Оцінки та суми синтетичні; законодавчі ставки не застосовуються.</p>
	{#if finance}
		<form onsubmit={event => { event.preventDefault(); assess(); }} aria-label="Оцінка підзвітності">
			<h3>Оцінка самозайнятого</h3>
			<div class="toolbar"><label for="assessment-seller">Самозайнятий<select id="assessment-seller" bind:value={sellerId} required><option value="" disabled>Оберіть</option>{#each reporting.sellerIds as identity (identity)}<option value={identity}>{identity}</option>{/each}</select></label><label for="assessment-quarter">Квартал оцінки<input id="assessment-quarter" bind:value={quarter} pattern={'20[0-9][0-9]-Q[1-4]'} required /></label><label for="assessment-outcome">Рішення<select id="assessment-outcome" bind:value={outcome}>{#each Object.entries(outcomes) as [value, label] (value)}<option {value}>{label}</option>{/each}</select></label></div>
			<label for="assessment-rule">Джерело та версія правила<input id="assessment-rule" bind:value={ruleSource} pattern="DEMO.*" maxlength="500" required /></label>
			<label for="assessment-reason">Підстава рішення<input id="assessment-reason" bind:value={assessmentReason} maxlength="500" required /></label>
			<div class="toolbar"><label for="assessment-fees">Комісії, UAH<input id="assessment-fees" type="number" min="0" max="10000000" step="0.01" bind:value={fees} required /></label><label for="assessment-withholding">Утримання, UAH<input id="assessment-withholding" type="number" min="0" max="10000000" step="0.01" bind:value={withholding} required /></label></div>
			<label for="assessment-evidence">Джерело сум<input id="assessment-evidence" bind:value={evidence} pattern="DEMO.*" maxlength="500" required /></label>
			<button type="submit"><ClipboardCheck size={16} />Зберегти оцінку</button>
		</form>
	{/if}
	{#if persona.kind === 'operator'}
		<details><summary>Історія оцінок · {history.length}</summary>{#each [...history].reverse() as item (`${item.courierId}-${item.quarter}-${item.version}`)}<p><strong>{item.courierId} · {item.quarter} · v{item.version} · {outcomes[item.outcome]}</strong><br />{item.reason} · {item.ruleSource}<br />Комісії: {money(item.feesMinor)} · утримання: {money(item.withholdingMinor)}<br />{item.evidence} · {item.author} · {item.at}</p>{:else}<p>Оцінок ще немає.</p>{/each}</details>
	{/if}
	{#if finance}
		<form onsubmit={event => { event.preventDefault(); create(); }}>
			<div class="toolbar"><label for="report-quarter">Квартал<input id="report-quarter" bind:value={quarter} pattern={'20[0-9]{2}-Q[1-4]'} required /></label><label for="report-corrects">Виправлення<select id="report-corrects" bind:value={corrects}><option value="">Новий звіт</option>{#each data.filter(report => report.quarter === quarter && ['draft', 'rejected', 'accepted'].includes(report.status)) as report (report.id)}<option value={report.id}>Версія {report.version} · {statuses[report.status]}</option>{/each}</select></label></div>
			<label for="report-reason">Причина / примітка<input id="report-reason" bind:value={reason} maxlength="500" required={!!corrects} /></label>
			<button class="primary" type="submit"><Plus size={16} />Створити знімок звіту</button>
		</form>
	{/if}
	<div class="toolbar"><label for="report-operator-filter">Платформа<select id="report-operator-filter" bind:value={operatorFilter}><option value="all">Усі доступні</option>{#each [...new Set(data.map(report => report.operatorId))] as operator (operator)}<option value={operator}>{operator}</option>{/each}</select></label><label for="report-quarter-filter">Період звіту<select id="report-quarter-filter" bind:value={quarterFilter}><option value="all">Усі квартали</option>{#each [...new Set(data.map(report => report.quarter))].sort() as value (value)}<option value={value}>{value}</option>{/each}</select></label></div>
	{#each [...visible].reverse() as report (`${report.operatorId}-${report.id}`)}
		<article class="report">
			<h3>{report.operatorId} · {report.quarter} · версія {report.version}</h3>
			<p><strong>{statuses[report.status]} · DEMO</strong> · {report.at}</p>
			<p>{report.ruleset} · До демоподання: {reportArtifact(report).submission.rows.length} · Виключено: {reportArtifact(report).excludedIds.length} · На перевірці: {reportArtifact(report).reviewIds.length}</p>
			{#if persona.kind === 'operator'}<p>Автор: {report.author} · погодив: {report.approvedBy ?? 'Немає'}</p>{/if}
			{#if report.corrects}<p>Виправляє: {report.corrects}</p>{/if}
			{#if report.reason}<p>{report.reason}</p>{/if}
			{#if report.blockers.length}<div role="status"><strong>Потребує виправлення</strong><ul>{#each report.blockers as blocker, index (`${blocker}-${index}`)}<li>{blocker}</li>{/each}</ul></div>{/if}
			<div class="scroll"><table><thead><tr><th>Самозайнятий</th><th>Рішення</th><th>Винагорода</th><th>Виплачено</th><th>Діяльностей</th><th>Коригування</th><th>Комісії</th><th>Утримання</th></tr></thead><tbody>{#each report.rows as row (row.courierId)}<tr><td>{row.courierId}</td><td>{outcomes[row.reportability]}<br />{row.ruleSource}<br />{row.explanation}</td><td>{money(row.incomeMinor)}</td><td>{money(row.paidMinor)}</td><td>{row.activityCount}</td><td>{money(row.adjustmentsMinor)}</td><td>{row.feesMinor === null ? 'Не підтверджено' : money(row.feesMinor)}</td><td>{row.withholdingMinor === null ? 'Не підтверджено' : money(row.withholdingMinor)}</td></tr>{/each}</tbody></table></div>
			<details><summary>Джерела знімка · {report.sources.length}</summary><div class="scroll"><table><thead><tr><th>Подія</th><th>Самозайнятий</th><th>Період</th><th>Винагорода</th><th>Виплачено</th></tr></thead><tbody>{#each report.sources as entry (entry.id)}<tr><td>{entry.id}</td><td>{entry.courierId}</td><td>{entry.period}</td><td>{money(entry.incomeMinor)}</td><td>{money(entry.paidMinor)}</td></tr>{/each}</tbody></table></div></details>
			<div class="toolbar">
				<button onclick={() => download(report)}><Download size={16} />{persona.kind === 'courier' ? 'Завантажити мій витяг' : 'Демоартефакт JSON'}</button>
				{#if persona.permissions.includes('approve') && report.status === 'draft'}<button disabled={report.author === persona.id || report.blockers.length > 0} onclick={() => execute({ type: 'report.approve', id: report.id })}><Check size={16} />Погодити звіт</button>{/if}
				{#if finance && ['approved', 'unavailable'].includes(report.status)}<button onclick={() => execute({ type: 'report.submit', id: report.id })}><Send size={16} />Передати · DEMO</button>{/if}
			</div>
			{#if report.receipt}<p>Технічний ідентифікатор: {report.receipt}</p>{/if}
			{#if report.decision}<p>{report.decision}</p>{/if}
			{#if finance && ['submitted', 'received', 'unavailable'].includes(report.status)}
				<label for={`decision-${report.id}`}>Причина деморішення<input id={`decision-${report.id}`} bind:value={decision} maxlength="500" /></label>
				<div class="toolbar">{#each ['received', 'accepted', 'rejected', 'unavailable'] as outcome (outcome)}<button disabled={['accepted', 'rejected'].includes(outcome) && report.status !== 'received'} onclick={() => execute({ type: 'report.resolve', id: report.id, status: outcome as 'received' | 'accepted' | 'rejected' | 'unavailable', reason: decision })}>{statuses[outcome as Report['status']]} · DEMO</button>{/each}</div>
			{/if}
		</article>
	{:else}<p>{persona.kind === 'courier' ? 'Прийнятих звітів із вашими записами ще немає.' : 'Знімків звітів ще немає.'}</p>{/each}
</section>
<style>
	.report { border-top: 1px solid var(--line); padding: 22px 0; overflow-wrap: anywhere; }
	summary { cursor: pointer; padding: 14px 0; }
	article p { font-size: 13px; }
</style>