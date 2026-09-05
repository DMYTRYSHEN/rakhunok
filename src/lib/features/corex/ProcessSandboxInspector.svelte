<script lang="ts">
	import {
		Check,
		CirclePause,
		Clock,
		FastForward,
		History,
		Play,
		RefreshCcw,
		RotateCcw,
		Sparkles,
		Terminal,
		Webhook,
		XCircle
	} from '@lucide/svelte';
	import type { ProcessDefinition } from './process-definition';
	import type { CorexLocale } from './i18n';
	import {
		initSandbox,
		injectSandboxEvent,
		restoreHistorySnapshot,
		retryFromNode,
		SANDBOX_PRESETS,
		stepSandbox,
		type SandboxState
	} from './process-sandbox-engine';
	import JsonTreeViewer from './JsonTreeViewer.svelte';

	let {
		definition,
		locale = 'uk',
		onStepChange
	}: {
		definition: ProcessDefinition;
		locale?: CorexLocale;
		onStepChange?: (activeNodeId: string | null, traversedEdgeIds: string[]) => void;
	} = $props();

	let selectedPresetId = $state(SANDBOX_PRESETS[0].id);
	let inputJsonText = $state(JSON.stringify(SANDBOX_PRESETS[0].payload, null, 2));
	let callbackPayloadText = $state(
		JSON.stringify({ status: 'success', bankRef: 'MB-109284', timestamp: new Date().toISOString() }, null, 2)
	);
	let sandboxState = $state.raw<SandboxState>({
		status: 'idle',
		currentNodeId: null,
		context: {},
		history: [],
		traversedNodeIds: [],
		traversedEdgeIds: []
	});
	let isRunningAuto = $state(false);

	$effect.pre(() => {
		if (sandboxState.status === 'idle' && !sandboxState.currentNodeId) {
			sandboxState = initSandbox(definition, SANDBOX_PRESETS[0].payload);
		}
	});

	$effect(() => {
		onStepChange?.(sandboxState.currentNodeId, sandboxState.traversedEdgeIds);
	});

	function handlePresetChange(presetId: string) {
		selectedPresetId = presetId;
		const preset = SANDBOX_PRESETS.find((p) => p.id === presetId);
		if (preset) {
			inputJsonText = JSON.stringify(preset.payload, null, 2);
			resetSimulator();
		}
	}

	function resetSimulator() {
		isRunningAuto = false;
		try {
			const parsed = JSON.parse(inputJsonText) as Record<string, unknown>;
			sandboxState = initSandbox(definition, parsed);
		} catch {
			sandboxState = initSandbox(definition, {});
		}
	}

	function stepNext() {
		if (sandboxState.status === 'running') {
			sandboxState = stepSandbox(definition, sandboxState);
		}
	}

	async function runAll() {
		if (sandboxState.status !== 'running') {
			resetSimulator();
		}
		isRunningAuto = true;
		while (sandboxState.status === 'running' && isRunningAuto) {
			sandboxState = stepSandbox(definition, sandboxState);
			await new Promise((r) => setTimeout(r, 450));
		}
		isRunningAuto = false;
	}

	function injectCallback() {
		try {
			const payload = JSON.parse(callbackPayloadText) as Record<string, unknown>;
			sandboxState = injectSandboxEvent(definition, sandboxState, payload);
		} catch {
			sandboxState = injectSandboxEvent(definition, sandboxState, { status: 'success' });
		}
	}

	let activeSnapshotIndex = $state<number | null>(null);

	function timeTravelToStep(index: number) {
		activeSnapshotIndex = index;
		sandboxState = restoreHistorySnapshot(definition, sandboxState, index);
	}

	function retryFromStep(nodeId: string) {
		activeSnapshotIndex = null;
		sandboxState = retryFromNode(definition, sandboxState, nodeId);
	}
</script>

<div class="sandbox-inspector">
	<header class="sandbox-header">
		<div class="header-title">
			<Sparkles size={14} class="accent-icon" />
			<strong>{locale === 'uk' ? 'Симулятор процесу (Sandbox)' : 'Process Simulator'}</strong>
		</div>
		<span class="status-pill status-{sandboxState.status}">
			{#if sandboxState.status === 'running'}
				<Play size={10} />
				{locale === 'uk' ? 'Виконується' : 'Running'}
			{:else if sandboxState.status === 'waiting_event'}
				<CirclePause size={10} />
				{locale === 'uk' ? 'Очікує подію' : 'Waiting event'}
			{:else if sandboxState.status === 'complete'}
				<Check size={10} />
				{locale === 'uk' ? 'Завершено' : 'Completed'}
			{:else if sandboxState.status === 'failed'}
				<XCircle size={10} />
				{locale === 'uk' ? 'Збій' : 'Failed'}
			{:else}
				<Clock size={10} />
				{locale === 'uk' ? 'Готовий' : 'Ready'}
			{/if}
		</span>
	</header>

	<div class="sandbox-controls">
		<div class="preset-row">
			<label for="preset-select">
				<span>{locale === 'uk' ? 'Шаблон заявки:' : 'Preset task:'}</span>
			</label>
			<select
				id="preset-select"
				value={selectedPresetId}
				onchange={(e) => handlePresetChange(e.currentTarget.value)}
			>
				{#each SANDBOX_PRESETS as preset (preset.id)}
					<option value={preset.id}>{preset.label}</option>
				{/each}
			</select>
		</div>

		<div class="btn-group">
			<button
				type="button"
				class="ctrl-btn btn-step"
				disabled={sandboxState.status !== 'running' || isRunningAuto}
				onclick={stepNext}
				title={locale === 'uk' ? 'Виконати 1 крок' : 'Execute 1 step'}
			>
				<Play size={13} fill="currentColor" />
				<span>{locale === 'uk' ? 'Крок' : 'Step'}</span>
			</button>
			<button
				type="button"
				class="ctrl-btn btn-run"
				disabled={isRunningAuto || sandboxState.status === 'complete'}
				onclick={runAll}
				title={locale === 'uk' ? 'Запустити авто-виконання' : 'Run all steps'}
			>
				<FastForward size={13} />
				<span>{isRunningAuto ? (locale === 'uk' ? 'Виконується...' : 'Running...') : (locale === 'uk' ? 'Все' : 'Run All')}</span>
			</button>
			<button
				type="button"
				class="ctrl-btn btn-reset"
				onclick={resetSimulator}
				title={locale === 'uk' ? 'Скинути симулятор' : 'Reset simulation'}
			>
				<RefreshCcw size={13} />
				<span>{locale === 'uk' ? 'Скинути' : 'Reset'}</span>
			</button>
		</div>
	</div>

	{#if sandboxState.status === 'waiting_event' && sandboxState.waitingEvent}
		<div class="event-injection-card">
			<div class="card-head">
				<Webhook size={13} />
				<strong>{locale === 'uk' ? 'Очікування зовнішньої події / Callback' : 'Waiting for external event'}</strong>
			</div>
			<p class="event-tip">
				{locale === 'uk' ? 'Процес зупинився. Назва події:' : 'Paused at event:'}
				<code>{sandboxState.waitingEvent.eventType}</code>
			</p>
			<label class="payload-label">
				<span>Callback Payload JSON:</span>
				<textarea bind:value={callbackPayloadText} rows={3} spellcheck="false"></textarea>
			</label>
			<button type="button" class="btn-inject" onclick={injectCallback}>
				<Sparkles size={13} />
				{locale === 'uk' ? 'Зімітувати прихід вебхуку' : 'Simulate Callback Event'}
			</button>
		</div>
	{/if}

	{#if sandboxState.error}
		<div class="sandbox-error-card">
			<div class="error-head">
				<XCircle size={15} />
				<strong>{locale === 'uk' ? 'Діагностика збою' : 'Failure Diagnostics'}</strong>
			</div>
			<p class="error-msg">{sandboxState.error}</p>
			{#if sandboxState.currentNodeId}
				<button
					type="button"
					class="btn-retry-failed"
					onclick={() => sandboxState.currentNodeId && retryFromStep(sandboxState.currentNodeId)}
				>
					<RotateCcw size={12} />
					<span>{locale === 'uk' ? 'Повторити з вузла збою' : 'Retry from failed node'}</span>
				</button>
			{/if}
		</div>
	{/if}

	<section class="section-block">
		<h4 class="section-title">
			<Terminal size={12} />
			<span>{locale === 'uk' ? 'Поточний контекст даних (JSON)' : 'Current Context State'}</span>
		</h4>
		<JsonTreeViewer data={sandboxState.context} label="Context Payload" />
	</section>

	<section class="section-block">
		<h4 class="section-title">
			<span>{locale === 'uk' ? 'Журнал кроків симуляції' : 'Simulation Step Log'}</span>
			<small>({sandboxState.history.length})</small>
		</h4>
		<div class="step-history-list">
			{#if sandboxState.history.length === 0}
				<p class="history-empty">{locale === 'uk' ? 'Натисніть "Крок" або "Все" для початку' : 'Click "Step" or "Run All" to start'}</p>
			{:else}
				{#each sandboxState.history as item, index (index)}
					<div
						class="step-log-item"
						class:active-snapshot={activeSnapshotIndex === index}
						class:is-retry={item.nodeType === 'retry-attempt'}
					>
						<span class="step-idx">{index + 1}</span>
						<div class="step-content">
							<div class="step-name-row">
								<strong>{item.nodeName}</strong>
								<span class="step-type-badge">{item.nodeType}</span>
							</div>
							<p class="step-action">{item.action}</p>
							<div class="step-actions-row">
								<button
									type="button"
									class="btn-step-tt"
									title={locale === 'uk' ? 'Повернутися до цього кроку' : 'Time-travel to this snapshot'}
									onclick={() => timeTravelToStep(index)}
								>
									<History size={11} />
									<span>{locale === 'uk' ? 'Зліпок' : 'Snapshot'}</span>
								</button>
								<button
									type="button"
									class="btn-step-retry"
									title={locale === 'uk' ? 'Повторити виконання з цього вузла' : 'Retry from this node'}
									onclick={() => retryFromStep(item.nodeId)}
								>
									<RotateCcw size={11} />
									<span>{locale === 'uk' ? 'Повторити' : 'Retry'}</span>
								</button>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>

<style>
	.sandbox-inspector {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 2px;
		font-family: 'Manrope', sans-serif;
	}
	.sandbox-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid #e2e8f0;
	}
	.header-title {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: #0f172a;
	}
	:global(.accent-icon) {
		color: #1a73e8;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 9px;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.status-running {
		background: #ecfdf5;
		color: #059669;
		border: 1px solid #a7f3d0;
	}
	.status-waiting_event {
		background: #eff6ff;
		color: #1d4ed8;
		border: 1px solid #bfdbfe;
	}
	.status-complete {
		background: #f0fdf4;
		color: #15803d;
		border: 1px solid #bbf7d0;
	}
	.status-failed {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}
	.status-idle {
		background: #f8fafc;
		color: #64748b;
		border: 1px solid #e2e8f0;
	}
	.sandbox-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
	}
	.preset-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.preset-row span {
		font-size: 11px;
		font-weight: 600;
		color: #475569;
	}
	.preset-row select {
		width: 100%;
		padding: 6px 9px;
		border-radius: 8px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		font: 600 12px/1.3 'Manrope', sans-serif;
		color: #1e293b;
	}
	.btn-group {
		display: flex;
		gap: 6px;
	}
	.ctrl-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 7px 10px;
		border-radius: 8px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		font: 700 11.5px/1 'Manrope', sans-serif;
		color: #334155;
		cursor: pointer;
		transition: all 140ms ease;
	}
	.ctrl-btn:hover:not(:disabled) {
		background: #f1f5f9;
		border-color: #94a3b8;
		transform: translateY(-1px);
	}
	.ctrl-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-step {
		background: #1a73e8;
		color: #ffffff;
		border-color: #1a73e8;
	}
	.btn-step:hover:not(:disabled) {
		background: #1557b0;
		border-color: #1557b0;
	}
	.btn-run {
		background: #059669;
		color: #ffffff;
		border-color: #059669;
	}
	.btn-run:hover:not(:disabled) {
		background: #047857;
		border-color: #047857;
	}
	.event-injection-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 10px;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 750;
		color: #1e40af;
	}
	.event-tip {
		margin: 0;
		font-size: 11px;
		color: #1e3a8a;
	}
	.event-tip code {
		padding: 2px 5px;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 4px;
		font-weight: 700;
	}
	.payload-label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 10.5px;
		font-weight: 600;
		color: #1e40af;
	}
	.payload-label textarea {
		width: 100%;
		border-radius: 6px;
		border: 1px solid #93c5fd;
		padding: 6px;
		font-family: monospace;
		font-size: 10.5px;
		background: #ffffff;
		box-sizing: border-box;
	}
	.btn-inject {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px 12px;
		background: #2563eb;
		color: #ffffff;
		border: 0;
		border-radius: 7px;
		font: 700 11.5px/1 'Manrope', sans-serif;
		cursor: pointer;
	}
	.btn-inject:hover {
		background: #1d4ed8;
	}
	.sandbox-error {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 10px;
		border-radius: 8px;
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		font-size: 11px;
	}
	.section-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.section-title {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		font-weight: 750;
		color: #334155;
	}
	.section-title small {
		color: #64748b;
	}
	.step-history-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 220px;
		overflow-y: auto;
		border: 1px solid #e2e8f0;
		border-radius: 9px;
		padding: 6px;
		background: #ffffff;
	}
	.history-empty {
		margin: 0;
		padding: 12px;
		text-align: center;
		font-size: 11px;
		color: #94a3b8;
	}
	.sandbox-error-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 8px;
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}
	.error-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
	}
	.error-msg {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: #991b1b;
	}
	.btn-retry-failed {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid #f87171;
		background: #ffffff;
		color: #b91c1c;
		font-size: 10.5px;
		font-weight: 700;
		cursor: pointer;
		align-self: flex-start;
		transition: all 140ms ease;
	}
	.btn-retry-failed:hover {
		background: #fee2e2;
	}
	.step-actions-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
	}
	.btn-step-tt,
	.btn-step-retry {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 7px;
		border-radius: 4px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		font-size: 9.5px;
		font-weight: 700;
		color: #475569;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.btn-step-tt:hover {
		background: #f1f5f9;
		color: #1a73e8;
		border-color: #93c5fd;
	}
	.btn-step-retry:hover {
		background: #fef2f2;
		color: #dc2626;
		border-color: #fca5a5;
	}
	.step-log-item.active-snapshot {
		background: #eff6ff;
		border-left-color: #2563eb;
		box-shadow: 0 0 0 1px #bfdbfe inset;
	}
	.step-log-item.is-retry {
		border-left-color: #f59e0b;
	}
</style>
