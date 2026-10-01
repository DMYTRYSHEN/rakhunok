<script lang="ts">
	import { onMount } from 'svelte';
	import { ShieldCheck, Eye, X, Check, Ban, Send } from '@lucide/svelte';
	import type { DemoGateway, Persona } from './gateway';
	import type { WorkflowCommand } from './workflow';
	let { persona, requests, operators, execute, read }: { persona: Persona; requests: ReturnType<DemoGateway['accessRequests']>; operators: { id: string; name: string }[]; execute: (command: WorkflowCommand, operatorId?: string) => boolean; read: (operatorId: string, id: string) => ReturnType<DemoGateway['readAccess']> } = $props();
	let operatorId = $state('');
	let sellerId = $state('');
	let scope = $state<'profile' | 'finance'>('finance');
	let reason = $state('');
	let decision = $state('');
	let minutes = $state(15);
	let opened = $state('');
	let payload = $state('');
	let error = $state('');
	let now = $state(Date.now());
	const active = $derived(requests.some(request => request.id === opened && request.status === 'approved' && Date.parse(request.expires ?? '') > now));
	const statuses = { pending: 'Очікує рішення', approved: 'Погоджено', rejected: 'Відхилено', revoked: 'Відкликано' };
	onMount(() => { const timer = setInterval(() => { now = Date.now(); }, 1000); return () => clearInterval(timer); });
	$effect(() => { if (!active) { opened = ''; payload = ''; } });
	function open(operator: string, id: string) {
		const result = read(operator, id);
		error = result.ok ? '' : result.error;
		opened = result.ok ? id : '';
		payload = result.ok ? JSON.stringify(result.data, null, 2) : '';
	}
</script>

<section class="module" aria-label="Винятковий доступ підтримки">
	<h2><ShieldCheck size={20} /> Винятковий доступ підтримки</h2>
	{#if persona.kind === 'admin'}
		<form onsubmit={event => { event.preventDefault(); execute({ type: 'access.request', id: `DEMO-access-${crypto.randomUUID()}`, courierId: sellerId, scope, reason }, operatorId); }}>
			<label for="access-operator">Оператор<select id="access-operator" bind:value={operatorId} required><option value="" disabled>Оберіть оператора</option>{#each operators as operator (operator.id)}<option value={operator.id}>{operator.name}</option>{/each}</select></label>
			<label for="access-seller">ID самозайнятого<input id="access-seller" bind:value={sellerId} required /></label>
			<label for="access-scope">Обсяг<select id="access-scope" bind:value={scope}><option value="finance">Фінансова звірка</option><option value="profile">Профіль</option></select></label>
			<label for="access-reason">Причина запиту<input id="access-reason" bind:value={reason} maxlength="500" required /></label>
			<button type="submit"><Send size={16} />Запросити доступ</button>
		</form>
	{:else if requests.length}
		<label for="access-decision">Обґрунтування рішення<input id="access-decision" bind:value={decision} maxlength="500" /></label>
		<label for="access-minutes">Строк, хвилин<input id="access-minutes" type="number" min="1" max="60" step="1" bind:value={minutes} /></label>
	{/if}
	{#each requests as request (`${request.operatorId}-${request.id}`)}
		<article>
			<h3>{request.operatorId} · {request.courierId} · {request.scope === 'finance' ? 'Фінансова звірка' : 'Профіль'}</h3>
			<p>{request.id} · {request.requester} · {statuses[request.status]}{request.expires && Date.parse(request.expires) <= now ? ' · Строк завершено' : ''}</p>
			<p>{request.reason}</p>
			{#if request.expires}<p>До {request.expires} · {request.approver}</p>{/if}
			{#if request.decision}<p>{request.decision}</p>{/if}
			<div class="toolbar">
				{#if persona.kind === 'admin' && request.status === 'approved'}<button disabled={Date.parse(request.expires ?? '') <= now} onclick={() => open(request.operatorId, request.id)}><Eye size={16} />Переглянути дані</button>{/if}
				{#if persona.kind === 'operator' && request.status === 'pending'}
					<button disabled={!decision.trim() || !minutes} onclick={() => execute({ type: 'access.decide', id: request.id, status: 'approved', reason: decision, minutes }, request.operatorId)}><Check size={16} />Погодити доступ</button>
					<button disabled={!decision.trim()} onclick={() => execute({ type: 'access.decide', id: request.id, status: 'rejected', reason: decision }, request.operatorId)}><X size={16} />Відхилити запит</button>
				{/if}
				{#if persona.kind === 'operator' && request.status === 'approved'}<button disabled={!decision.trim()} onclick={() => execute({ type: 'access.decide', id: request.id, status: 'revoked', reason: decision }, request.operatorId)}><Ban size={16} />Відкликати доступ</button>{/if}
			</div>
			<details><summary>Перегляди · {request.reads.length}</summary>{#each request.reads as at, index (index)}<p>{at} · {request.requester}</p>{/each}</details>
		</article>
	{:else}<p>Запитів доступу немає.</p>{/each}
	{#if error}<p role="alert">{error}</p>{/if}
	{#if active && payload}<div class="disclosure"><button onclick={() => { opened = ''; payload = ''; }}><X size={16} />Закрити дані</button><pre>{payload}</pre></div>{/if}
</section>

<style>
	h2 { display: flex; align-items: center; gap: 8px; }
	article { border-top: 1px solid var(--line); padding: 16px 0; overflow-wrap: anywhere; }
	pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
</style>