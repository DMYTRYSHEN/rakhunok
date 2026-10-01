<script lang="ts">
	import { Plus, Check, Download, RotateCcw, X } from '@lucide/svelte';
	import type { DemoGateway, Persona } from './gateway';
	import type { WorkflowCommand } from './workflow';
	import type { Batch, PayoutStatus } from './payouts';
	import { exportCsv } from './ledger';
	let { persona, data, execute, period, onPeriod }: { persona: Persona; data: ReturnType<DemoGateway['payouts']>; execute: (command: WorkflowCommand) => boolean; period: string; onPeriod: (value: string) => void } = $props();
	let batchId = $state('DEMO-batch-one');
	let selected = $state<string[]>([]);
	let reference = $state('DEMO-bank-one');
	let courierId = $state('courier-1');
	let amount = $state(1000);
	let occurredOn = $state('2026-09-01');
	let status = $state<PayoutStatus>('unknown');
	let evidence = $state('DEMO: банківська виписка');
	const finance = $derived(persona.kind === 'operator' && persona.permissions.includes('finance'));
	const selectedTotal = $derived(data.balances.filter(row => selected.includes(row.courierId)).reduce((sum, row) => sum + row.available, 0));
		let operatorFilter = $state('all');
		const operators = $derived([...new Set(data.balances.map(row => row.operatorId))]);
		const visible = $derived({ balances: data.balances.filter(row => operatorFilter === 'all' || row.operatorId === operatorFilter), external: data.external.filter(row => operatorFilter === 'all' || row.operatorId === operatorFilter), batches: data.batches.filter(row => operatorFilter === 'all' || row.operatorId === operatorFilter) });
	const money = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100);
	function download(batch: Batch) {
		const url = URL.createObjectURL(new Blob([exportCsv(batch.instructions.map(item => ({ ...item, source: 'DEMO-NOT-FOR-BANK', batchId: batch.id })))], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a'); link.href = url; link.download = `DEMO-${batch.id}.csv`; link.click(); URL.revokeObjectURL(url);
	}
</script>
<section class="module">
	<h2>Звірка винагород <small>DEMO</small></h2>
	<label for="payout-period">Місяць винагороди<input id="payout-period" type="month" value={period} onchange={event => { onPeriod(event.currentTarget.value); selected = []; }} /></label>
		{#if persona.kind === 'courier'}<label for="payout-operator">Платформа<select id="payout-operator" bind:value={operatorFilter}><option value="all">Усі мої платформи</option>{#each operators as operator (operator)}<option value={operator}>{operator}</option>{/each}</select></label>{/if}
		<div class="scroll"><table><thead><tr><th>Самозайнятий / платформа</th><th>Нараховано</th><th>Коригування</th><th>Винагорода</th><th>Виплачено</th><th>Залишок</th><th>Резерв</th><th>Доступно</th></tr></thead><tbody>{#each visible.balances as row (`${row.operatorId}-${row.courierId}`)}<tr><td>{#if finance}<label class="check"><input type="checkbox" bind:group={selected} value={row.courierId} disabled={row.available <= 0} />{row.courierId}</label>{:else}{row.courierId}{/if}<small>{row.operatorId}</small></td><td>{money(row.accruedMinor)}</td><td>{money(row.adjustmentsMinor)}</td><td>{money(row.incomeMinor)}</td><td>{money(row.paidMinor)}</td><td>{money(row.balanceMinor)}</td><td>{money(row.reserved)}</td><td>{money(row.available)}</td></tr>{/each}</tbody></table></div>
	{#if finance}
		<p aria-label="Підсумок батча">Вибрано: {selected.length} · сума: {money(selectedTotal)}</p>
		<div class="toolbar"><label for="batch-id">ID батча<input id="batch-id" bind:value={batchId} maxlength="69" /></label><button class="primary" disabled={!selected.length} onclick={() => execute({ type: 'batch.create', id: batchId, period, courierIds: selected })}><Plus size={16} />Створити чернетку батча</button></div>
		<h2>Зовнішня виплата</h2>
		<label for="external-date">Дата зовнішньої виплати<input id="external-date" type="date" bind:value={occurredOn} required /></label>
		<div class="toolbar"><label for="external-id">Provider reference<input id="external-id" bind:value={reference} /></label><label for="external-courier">Самозайнятий<select id="external-courier" bind:value={courierId}>{#each data.balances as row (row.courierId)}<option value={row.courierId}>{row.courierId}</option>{/each}</select></label><label for="external-amount">Сума, копійки<input id="external-amount" type="number" min="1" step="1" bind:value={amount} /></label></div>
		<label for="payout-status">Деморезультат<select id="payout-status" bind:value={status}><option value="pending">Очікування</option><option value="unknown">Невідомий результат</option><option value="paid">Підтверджено · DEMO</option><option value="rejected">Відмовлено</option></select></label>
		<label for="payout-evidence">Синтетичний доказ / результат звірки<input id="payout-evidence" bind:value={evidence} maxlength="500" /></label>
		<button disabled={!/^20\d{2}-\d{2}-\d{2}$/.test(occurredOn)} onclick={() => execute({ type: 'payout.external', id: reference, courierId, amountMinor: amount, period, occurredAt: `${occurredOn}T00:00:00.000Z`, status, evidence })}><Plus size={16} />Облікувати зовнішню виплату</button>
	{/if}
	{#each visible.external as item (`${item.operatorId}-${item.id}`)}<div class="record"><div><strong>{item.id} · {item.status} · DEMO</strong><p>{item.operatorId} · {item.courierId} · {money(item.amountMinor)} · {item.occurredAt}</p><p>{item.evidence}</p></div>{#if finance && ['pending', 'unknown'].includes(item.status)}<button onclick={() => execute({ type: 'payout.reconcile', id: item.id, status: 'paid', evidence })}><Check size={16} />Підтвердити звіркою</button><button onclick={() => execute({ type: 'payout.reconcile', id: item.id, status: 'rejected', evidence })}><X size={16} />Підтвердити відмову</button>{/if}</div>{:else}<p>Зовнішніх виплат за вибраними умовами немає.</p>{/each}
	<h2>Батчі</h2>
	{#each visible.batches as batch (`${batch.operatorId}-${batch.id}`)}
		<div class="record"><div><h3>{batch.id} · {batch.cancelled ? 'Скасовано' : persona.kind === 'courier' ? 'Моя виплата' : batch.approvedBy ? 'Погоджено' : 'Чернетка'}</h3><p>{batch.period}</p>{#if persona.kind !== 'courier'}<p>Автор {batch.author} · погодив {batch.approvedBy ?? '—'}</p>{/if}</div>{#if persona.permissions.includes('approve') && !batch.cancelled && !batch.approvedBy}<button onclick={() => execute({ type: 'batch.approve', id: batch.id })}><Check size={16} />Погодити батч</button>{/if}{#if finance && !batch.cancelled}<button disabled={!batch.approvedBy} onclick={() => download(batch)}><Download size={16} />Експорт інструкцій</button><button disabled={batch.instructions.some(item => item.attempts > 0 || item.status !== 'pending')} onclick={() => { if (confirm('Скасувати демобатч і звільнити резерв?')) execute({ type: 'batch.cancel', id: batch.id }); }}><X size={16} />Скасувати батч</button>{/if}</div>
		{#each batch.instructions as item (item.id)}<div class="record"><div><strong>{item.courierId} · {money(item.amountMinor)} · {item.status}</strong><p>{item.id} · {item.account}</p>{#if persona.kind !== 'courier'}<p>{item.evidence || 'Підтвердження відсутнє'} · результатів: {item.attempts}</p>{/if}</div>{#if finance && !batch.cancelled && batch.approvedBy}{#if item.status === 'rejected'}<button onclick={() => { if (confirm('Повторно зарезервувати кошти для відхиленої інструкції?')) execute({ type: 'batch.retry', id: batch.id, instructionId: item.id }); }}><RotateCcw size={16} />Повторити інструкцію</button>{:else if item.status !== 'paid'}<button onclick={() => execute({ type: 'batch.result', id: batch.id, instructionId: item.id, status, evidence })}><Check size={16} />Застосувати результат · {item.courierId}</button>{/if}{/if}</div>{/each}
	{:else}<p>Батчів немає.</p>{/each}
</section>