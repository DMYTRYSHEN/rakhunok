<script lang="ts">
	import { onMount } from 'svelte';
	import { Bot, Boxes, Braces, CalendarClock, Check, ChevronDown, ChevronRight, CirclePause, ClipboardPaste, Clock3, Code2, Copy, Database, FileInput, FileOutput, FileUp, FolderTree, GitBranch, Globe2, History, KeyRound, LoaderCircle, LockKeyhole, MailCheck, PanelRightClose, Play, Redo2, RefreshCcw, Search, ShieldCheck, Shuffle, Sparkles, SquareFunction, Timer, Trash2, Undo2, Upload, Webhook, Workflow, XCircle } from '@lucide/svelte';
	import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, SvelteFlow, type Edge, type Node, type NodeTypes, type Viewport } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { flowScenarios } from './flow-scenarios';
	import { canvasText, localizedCategory, localizedScenario, type CorexLocale } from './i18n';
	import { statusText } from './i18n';
	import {
		createStarterProcessDefinition,
		type ProcessDefinition,
		type ProcessNode,
		type ProcessValidationResult,
		validateProcessDefinition
	} from './process-definition';
	import { processDefinitionToFlowScenario } from './process-definition-adapter';
	import { canPublishProcess, canRunProcess, parseRunInput, type CorexCommandState } from './process-command-state';
	import { CorexCommandError, type CorexStartedRun } from './corex-command-gateway';
	import { getCorexCommandGateway, getCorexProcessGateway } from './corex-process-browser';
	import { CorexDraftConflictError, type CorexApprovalTask, type CorexProcess, type CorexProcessVersion, type CorexRun, type CorexRunEvent } from './corex-process-gateway';
	import { restoreVersionAsDraft } from './process-version-history';
	import { formatRunDetail, summarizeRunEvents } from './run-inspector';
	import ReleaseFlowNode from './ReleaseFlowNode.svelte';
	import type { FlowEdge, FlowNode, FlowScenario } from './types';

	const nodeTypes: NodeTypes = { release: ReleaseFlowNode };
	const initialDraftDefinition = createStarterProcessDefinition();
	const initialExecutableScenario = processDefinitionToFlowScenario(initialDraftDefinition);
	let { locale = 'uk', ownerUserId }: { locale?: CorexLocale; ownerUserId: string } = $props();
	let processGateway = getCorexProcessGateway();
	let commandGateway = getCorexCommandGateway();
	let persistedProcesses = $state<CorexProcess[]>([]);
	let activeProcess = $state<CorexProcess | null>(null);
	let persistenceState = $state<'loading' | 'idle' | 'saving'>('loading');
	let persistenceError = $state('');
	let draftDefinition = $state<ProcessDefinition>(initialDraftDefinition);
	let undoStack = $state.raw<ProcessDefinition[]>([]);
	let redoStack = $state.raw<ProcessDefinition[]>([]);
	let savedDraftFingerprint = $state('');
	let executableScenario = $derived(processDefinitionToFlowScenario(draftDefinition));
	let scenarios = $derived([executableScenario, ...flowScenarios]);
	let activeScenarioId = $state(initialDraftDefinition.id);
	let activeScenario = $derived(scenarios.find((scenario) => scenario.id === activeScenarioId) ?? executableScenario);
	let isExecutableDraft = $derived(activeScenarioId === draftDefinition.id);
	let nodes = $state.raw<Node[]>(createNodes(initialExecutableScenario, 'uk'));
	let edges = $state.raw<Edge[]>(createEdges(initialExecutableScenario));
	let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
	let selectedId = $state(initialExecutableScenario.nodes[0].id);
	let selectedNodeIds = $state.raw<string[]>([initialExecutableScenario.nodes[0].id]);
	let copiedNode = $state.raw<ProcessNode | null>(null);
	let paletteQuery = $state('');
	let inspectorTab = $state<'details' | 'runs'>('details');
	let aiPrompt = $state('');
	let draftNotice = $state('');
	let draftDirty = $state(true);
	let validationResult = $state<ProcessValidationResult | null>(null);
	let commandState = $state<CorexCommandState>('idle');
	let commandNotice = $state('');
	let runInput = $state('{}');
	let runEventType = $state('process-event');
	let runEventPayload = $state('{}');
	let approvalComment = $state('');
	let eventSending = $state(false);
	let lastRun = $state<CorexStartedRun | null>(null);
	let runs = $state<CorexRun[]>([]);
	let selectedRunId = $state('');
	let runEvents = $state<CorexRunEvent[]>([]);
	let approvalTasks = $state<CorexApprovalTask[]>([]);
	let approvalTaskComments = $state<Record<string, string>>({});
	let approvalTaskSendingId = $state('');
	let versionHistoryOpen = $state(false);
	let versions = $state<CorexProcessVersion[]>([]);
	let versionHistoryState = $state<'idle' | 'loading'>('idle');
	let versionHistoryError = $state('');
	let versionHistoryRequest = 0;
	let runHistoryState = $state<'idle' | 'loading'>('idle');
	let runHistoryError = $state('');
	let runHistoryRequest = 0;
	let selectedRun = $derived(runs.find((run) => run.id === selectedRunId) ?? null);
	let runSummary = $derived(summarizeRunEvents(runEvents));
	let selectedRunOutput = $derived(formatRunDetail(selectedRun?.output));
	let selectedRunError = $derived(formatRunDetail(selectedRun?.error));
	let activeApproval = $derived.by(() => {
		if (selectedRun?.status !== 'waiting') return null;
		const latest = runEvents.at(-1);
		if (latest?.eventType !== 'step_started' || typeof latest.payload !== 'object' || latest.payload === null) return null;
		const payload = latest.payload as Record<string, unknown>;
		return payload.stepType === 'approval' && payload.assigneeUserId === ownerUserId ? latest : null;
	});
	let publishEnabled = $derived(canPublishProcess({
		hasGateway: Boolean(commandGateway),
		hasProcess: Boolean(activeProcess),
		draftDirty,
		validationValid: validationResult?.valid === true,
		commandState
	}));
	let runEnabled = $derived(canRunProcess({
		hasGateway: Boolean(commandGateway),
		hasPublishedVersion: Boolean(activeProcess?.publishedVersion),
		draftDirty,
		commandState
	}));
	let selectedNode = $derived(activeScenario.nodes.find((node) => node.id === selectedId) ?? activeScenario.nodes[0]);
	let selectedDefinitionNode = $derived(isExecutableDraft ? draftDefinition.nodes.find((node) => node.id === selectedId) : undefined);
	let selectedDefinitionNodes = $derived(isExecutableDraft
		? draftDefinition.nodes.filter((node) => selectedNodeIds.includes(node.id))
		: []);
	let selectionHasProtectedNodes = $derived(selectedDefinitionNodes.some((node) => ['trigger-http', 'end-success'].includes(node.type)));
	let text = $derived(canvasText[locale]);
	let activeCopy = $derived(localizedScenario(activeScenario, locale));
	const paletteGroups = [
		{ label: 'Тригери', items: [
			{ label: 'Webhook / API', api: 'fetch → workflow.create()', icon: Webhook },
			{ label: 'Розклад', api: 'workflow schedules / cron', icon: CalendarClock },
			{ label: 'Подія', api: 'queue / binding → create()', icon: Sparkles }
		] },
		{ label: 'Маршрутизація', items: [
			{ label: 'Умова', api: 'if / else', icon: GitBranch, nodeType: 'condition' as const },
			{ label: 'Switch', api: 'switch', icon: Workflow },
			{ label: 'Цикл', api: 'for / while', icon: RefreshCcw },
			{ label: 'Паралельно', api: 'Promise.all()', icon: Boxes },
			{ label: 'A/B Router', api: 'step.do() → deterministic branch', icon: Shuffle }
		] },
		{ label: 'Durable очікування', items: [
			{ label: 'Затримка', api: 'step.sleep()', icon: Timer, nodeType: 'wait' as const },
			{ label: 'До дати', api: 'step.sleepUntil()', icon: Clock3 },
			{ label: 'Очікувати подію', api: 'step.waitForEvent()', icon: Webhook, nodeType: 'wait-event' as const },
			{ label: 'Ручне погодження', api: 'waitForEvent() + dashboard', icon: MailCheck, nodeType: 'approval' as const }
		] },
		{ label: 'Дані', items: [
			{ label: 'DB Read', api: 'step.do() → SELECT', icon: Database },
			{ label: 'DB Write', api: 'step.do() → INSERT / UPDATE', icon: Database },
			{ label: 'KV Get', api: 'step.do() → KV.get()', icon: KeyRound },
			{ label: 'KV Set', api: 'step.do() → KV.put()', icon: KeyRound },
			{ label: 'Перетворення даних', api: 'step.do() → serializable output', icon: Braces, nodeType: 'transform' as const }
		] },
		{ label: 'Інтеграції', items: [
			{ label: 'HTTP Request', api: 'step.do() → fetch()', icon: Globe2 },
			{ label: 'Виклик підпроцесу', api: 'step.do() → WORKFLOW.create()', icon: SquareFunction }
		] },
		{ label: 'Стійкість', items: [
			{ label: 'Try / Catch', api: 'try / catch', icon: ShieldCheck }
		] },
		{ label: 'Завершення', items: [
			{ label: 'Успішне завершення', api: 'return serializable output', icon: FileOutput },
			{ label: 'Abort / Fail', api: 'throw NonRetryableError', icon: XCircle }
		] },
		{ label: 'Структура', items: [
			{ label: 'Функція', api: 'FunctionDef / Call', icon: Braces },
			{ label: 'Група кроків', api: 'BlockNode', icon: FolderTree },
			{ label: 'Вийти з циклу', api: 'break', icon: PanelRightClose }
		] }
	];
	let filteredPalette = $derived(paletteGroups.map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.api}`.toLowerCase().includes(paletteQuery.trim().toLowerCase())) })).filter((group) => group.items.length));

	function createNodes(scenario: FlowScenario, nodeLocale: CorexLocale): Node[] {
		return scenario.nodes.map((item) => ({ id: item.id, type: 'release', position: item.position, data: { ...item, locale: nodeLocale } }));
	}

	function createEdges(scenario: FlowScenario): Edge[] {
		return scenario.edges.map((edge: FlowEdge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		label: edge.label,
		type: 'smoothstep',
		animated: scenario.nodes.find((node) => node.id === edge.source)?.status === 'running',
		markerEnd: { type: MarkerType.ArrowClosed, color: edge.tone === 'danger' ? '#bf5748' : edge.tone === 'success' ? '#3f8a61' : '#77818a' },
		style: `stroke: ${edge.tone === 'danger' ? '#bf5748' : edge.tone === 'success' ? '#3f8a61' : '#77818a'}; stroke-width: 1.6px;`
	}));
	}

	function selectNode(event: { node: Node }) {
		selectedId = event.node.id;
	}

	function updateSelection(event: { nodes: Node[]; edges: Edge[] }) {
		selectedNodeIds = event.nodes.map((node) => node.id);
		if (event.nodes.at(-1)) selectedId = event.nodes.at(-1)!.id;
	}

	function selectScenario(scenario: FlowScenario) {
		runHistoryRequest += 1;
		versionHistoryRequest += 1;
		versionHistoryOpen = false;
		versions = [];
		activeScenarioId = scenario.id;
		nodes = createNodes(scenario, locale);
		edges = createEdges(scenario);
		selectedId = scenario.nodes[0].id;
		selectedNodeIds = selectedId ? [selectedId] : [];
		copiedNode = null;
		validationResult = null;
		runs = [];
		selectedRunId = '';
		runEvents = [];
		runHistoryError = '';
	}

	function processOptionId(process: CorexProcess): string {
		return `process:${process.id}`;
	}

	function selectProcess(process: CorexProcess) {
		versionHistoryRequest += 1;
		versionHistoryOpen = false;
		versions = [];
		versionHistoryError = '';
		activeProcess = process;
		draftDefinition = { ...process.draftDefinition, revision: process.revision };
		undoStack = [];
		redoStack = [];
		savedDraftFingerprint = JSON.stringify(draftDefinition);
		activeScenarioId = draftDefinition.id;
		nodes = createNodes(processDefinitionToFlowScenario(draftDefinition), locale);
		edges = createEdges(processDefinitionToFlowScenario(draftDefinition));
		selectedId = draftDefinition.nodes[0]?.id ?? '';
		selectedNodeIds = selectedId ? [selectedId] : [];
		copiedNode = null;
		draftDirty = false;
		validationResult = null;
		persistenceError = '';
		void loadRunHistory(process.id);
	}

	async function loadVersionHistory(process: CorexProcess) {
		if (!processGateway) return;
		const request = ++versionHistoryRequest;
		versionHistoryState = 'loading';
		versionHistoryError = '';
		try {
			const loadedVersions = await processGateway.listVersions(process.id, process.ownerUserId);
			if (request !== versionHistoryRequest || activeProcess?.id !== process.id) return;
			versions = loadedVersions;
		} catch {
			if (request !== versionHistoryRequest) return;
			versionHistoryError = locale === 'uk' ? 'Не вдалося завантажити версії.' : 'Could not load versions.';
		} finally {
			if (request === versionHistoryRequest) versionHistoryState = 'idle';
		}
	}

	function toggleVersionHistory() {
		if (!activeProcess || !isExecutableDraft) return;
		versionHistoryOpen = !versionHistoryOpen;
		if (versionHistoryOpen) void loadVersionHistory(activeProcess);
	}

	function restorePublishedVersion(version: CorexProcessVersion) {
		if (!activeProcess || !isExecutableDraft || version.processId !== activeProcess.id) return;
		const restored = restoreVersionAsDraft(draftDefinition, version.definition);
		commitDraft(restored);
		activeScenarioId = restored.id;
		selectedId = restored.nodes[0]?.id ?? '';
		selectedNodeIds = selectedId ? [selectedId] : [];
		copiedNode = null;
		versionHistoryOpen = false;
		commandNotice = locale === 'uk'
			? `Версію ${version.version} відновлено як незбережену чернетку.`
			: `Version ${version.version} restored as an unsaved draft.`;
	}

	async function loadRunHistory(processId: string, preferredRunId?: string) {
		if (!processGateway) return;
		const request = ++runHistoryRequest;
		runHistoryState = 'loading';
		runHistoryError = '';
		try {
			const loadedRuns = await processGateway.listRuns(processId);
			if (request !== runHistoryRequest || activeProcess?.id !== processId) return;
			runs = loadedRuns;
			const nextRunId = preferredRunId && loadedRuns.some((run) => run.id === preferredRunId)
				? preferredRunId
				: loadedRuns[0]?.id ?? '';
			selectedRunId = nextRunId;
			runEvents = nextRunId ? await processGateway.listRunEvents(nextRunId) : [];
			if (request !== runHistoryRequest || activeProcess?.id !== processId) return;
		} catch {
			if (request !== runHistoryRequest) return;
			runHistoryError = locale === 'uk' ? 'Не вдалося завантажити історію запусків.' : 'Could not load run history.';
		} finally {
			if (request === runHistoryRequest) runHistoryState = 'idle';
		}
	}

	async function loadApprovalTasks() {
		if (!processGateway) return;
		try {
			approvalTasks = await processGateway.listApprovalTasks(ownerUserId);
		} catch {
			persistenceError = locale === 'uk' ? 'Не вдалося завантажити погодження.' : 'Could not load approvals.';
		}
	}

	async function selectRun(runId: string) {
		if (!processGateway || !activeProcess || runId === selectedRunId && runEvents.length > 0) return;
		const request = ++runHistoryRequest;
		selectedRunId = runId;
		runHistoryState = 'loading';
		runHistoryError = '';
		try {
			const loadedEvents = await processGateway.listRunEvents(runId);
			if (request === runHistoryRequest && selectedRunId === runId) runEvents = loadedEvents;
		} catch {
			if (request === runHistoryRequest) runHistoryError = locale === 'uk' ? 'Не вдалося завантажити події запуску.' : 'Could not load run events.';
		} finally {
			if (request === runHistoryRequest) runHistoryState = 'idle';
		}
	}

	function selectJourney(value: string) {
		if (value.startsWith('process:')) {
			const process = persistedProcesses.find((item) => processOptionId(item) === value);
			if (process) selectProcess(process);
			return;
		}
		selectScenario(scenarios.find((scenario) => scenario.id === value) ?? executableScenario);
	}

	function draftSlug(): string {
		return draftDefinition.id
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'untitled-process';
	}

	async function saveDraft() {
		if (!processGateway || !isExecutableDraft || persistenceState === 'saving') return;
		persistenceState = 'saving';
		persistenceError = '';
		try {
			const definitionToSave = activeProcess
				? { ...draftDefinition, revision: activeProcess.revision + 1 }
				: draftDefinition;
			const saved = activeProcess
				? await processGateway.saveDraft(activeProcess, definitionToSave)
				: await processGateway.createProcess(ownerUserId, draftSlug(), definitionToSave);
			activeProcess = saved;
			draftDefinition = { ...saved.draftDefinition, revision: saved.revision };
			undoStack = [];
			redoStack = [];
			savedDraftFingerprint = JSON.stringify(draftDefinition);
			persistedProcesses = [saved, ...persistedProcesses.filter((item) => item.id !== saved.id)];
			draftDirty = false;
		} catch (error) {
			persistenceError = error instanceof CorexDraftConflictError
				? (locale === 'uk' ? 'Чернетку змінено в іншій сесії. Оновіть сторінку.' : 'The draft changed in another session. Reload the page.')
				: (locale === 'uk' ? 'Не вдалося зберегти чернетку.' : 'Could not save the draft.');
		} finally {
			persistenceState = 'idle';
		}
	}

	function validateDraft() {
		if (!isExecutableDraft) return;
		validationResult = validateProcessDefinition(draftDefinition);
	}

	function commandErrorMessage(error: unknown): string {
		if (!(error instanceof CorexCommandError)) return locale === 'uk' ? 'Команда не виконана.' : 'The command failed.';
		const messages = locale === 'uk'
			? {
				authentication_required: 'Сесію завершено. Увійдіть знову.',
				revision_conflict: 'Чернетку змінено. Оновіть її перед публікацією.',
				published_process_not_found: 'Опубліковану версію не знайдено.',
				process_not_executable: 'Опублікований процес не можна виконати.',
				run_not_found: 'Запуск не знайдено.',
				run_not_accepting_event: 'Запуск більше не приймає події.',
				runtime_unavailable: 'Середовище виконання зараз недоступне.',
				command_failed: 'Команда не виконана.'
			}
			: {
				authentication_required: 'The session ended. Sign in again.',
				revision_conflict: 'The draft changed. Refresh it before publishing.',
				published_process_not_found: 'The published version was not found.',
				process_not_executable: 'The published process is not executable.',
				run_not_found: 'The run was not found.',
				run_not_accepting_event: 'The run no longer accepts events.',
				runtime_unavailable: 'The runtime is currently unavailable.',
				command_failed: 'The command failed.'
			};
		return messages[error.code];
	}

	async function publishProcess() {
		if (!commandGateway || !activeProcess || !publishEnabled) return;
		commandState = 'publishing';
		commandNotice = '';
		try {
			const published = await commandGateway.publish(activeProcess.id, activeProcess.revision);
			const updatedProcess: CorexProcess = { ...activeProcess, lifecycle: 'published', publishedVersion: published.version };
			activeProcess = updatedProcess;
			persistedProcesses = persistedProcesses.map((process) => process.id === updatedProcess.id ? updatedProcess : process);
			commandNotice = locale === 'uk' ? `Опубліковано версію ${published.version}.` : `Published version ${published.version}.`;
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			commandState = 'idle';
		}
	}

	async function runProcess() {
		if (!commandGateway || !activeProcess || !runEnabled) return;
		const parsedInput = parseRunInput(runInput);
		if (!parsedInput.ok) {
			commandNotice = locale === 'uk' ? 'Input має бути коректним JSON.' : 'Input must be valid JSON.';
			return;
		}
		commandState = 'running';
		commandNotice = '';
		try {
			lastRun = await commandGateway.start(activeProcess.id, parsedInput.value);
			inspectorTab = 'runs';
			commandNotice = locale === 'uk' ? `Запуск ${lastRun.id} створено.` : `Run ${lastRun.id} created.`;
			await loadRunHistory(activeProcess.id, lastRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			commandState = 'idle';
		}
	}

	async function sendRunEvent() {
		if (!commandGateway || !activeProcess || !selectedRun || eventSending || !runEventType.trim()) return;
		const parsedPayload = parseRunInput(runEventPayload);
		if (!parsedPayload.ok) {
			commandNotice = locale === 'uk' ? 'Payload події має бути коректним JSON.' : 'Event payload must be valid JSON.';
			return;
		}
		eventSending = true;
		commandNotice = '';
		try {
			await commandGateway.signal(selectedRun.id, runEventType.trim(), parsedPayload.value);
			commandNotice = locale === 'uk' ? `Подію ${runEventType.trim()} надіслано.` : `Event ${runEventType.trim()} sent.`;
			await loadRunHistory(activeProcess.id, selectedRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			eventSending = false;
		}
	}

	async function decideApproval(decision: 'approved' | 'rejected') {
		if (!commandGateway || !activeProcess || !selectedRun || !activeApproval || eventSending) return;
		eventSending = true;
		commandNotice = '';
		try {
			await commandGateway.signal(selectedRun.id, 'corex-approval', {
				decision,
				...(approvalComment.trim() ? { comment: approvalComment.trim() } : {})
			});
			commandNotice = decision === 'approved'
				? (locale === 'uk' ? 'Рішення погоджено.' : 'Decision approved.')
				: (locale === 'uk' ? 'Рішення відхилено.' : 'Decision rejected.');
			approvalComment = '';
			await loadRunHistory(activeProcess.id, selectedRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			eventSending = false;
		}
	}

	async function decideApprovalTask(task: CorexApprovalTask, decision: 'approved' | 'rejected') {
		if (!commandGateway || task.status !== 'pending' || approvalTaskSendingId) return;
		approvalTaskSendingId = task.id;
		commandNotice = '';
		try {
			const comment = approvalTaskComments[task.id]?.trim();
			await commandGateway.signal(task.runId, 'corex-approval', {
				decision,
				...(comment ? { comment } : {})
			});
			commandNotice = decision === 'approved'
				? (locale === 'uk' ? 'Рішення погоджено.' : 'Decision approved.')
				: (locale === 'uk' ? 'Рішення відхилено.' : 'Decision rejected.');
			await loadApprovalTasks();
			if (activeProcess?.id === task.processId) await loadRunHistory(task.processId, task.runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			approvalTaskSendingId = '';
		}
	}

	function updateDraftPosition(event: { targetNode: Node | null; nodes: Node[] }) {
		if (!isExecutableDraft || !event.targetNode) return;
		const movedNodes = event.nodes.length > 0 ? event.nodes : [event.targetNode];
		const positions = new Map(movedNodes.map((node) => [node.id, node.position]));
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.map((node) =>
				positions.has(node.id) ? { ...node, position: { ...positions.get(node.id)! } } : node
			)
		});
	}

	function updateSelectedDefinitionNode(update: (node: ProcessNode) => ProcessNode) {
		if (!isExecutableDraft || !selectedDefinitionNode) return;
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.map((node) => node.id === selectedDefinitionNode?.id ? update(node) : node)
		});
	}

	function applyDraftHistory(next: ProcessDefinition) {
		draftDefinition = next;
		draftDirty = !savedDraftFingerprint || JSON.stringify(next) !== savedDraftFingerprint;
		validationResult = null;
	}

	function commitDraft(next: ProcessDefinition) {
		undoStack = [...undoStack.slice(-49), draftDefinition];
		redoStack = [];
		applyDraftHistory(next);
	}

	function undoDraft() {
		const previous = undoStack.at(-1);
		if (!isExecutableDraft || !previous) return;
		undoStack = undoStack.slice(0, -1);
		redoStack = [...redoStack.slice(-49), draftDefinition];
		applyDraftHistory(previous);
	}

	function redoDraft() {
		const next = redoStack.at(-1);
		if (!isExecutableDraft || !next) return;
		redoStack = redoStack.slice(0, -1);
		undoStack = [...undoStack.slice(-49), draftDefinition];
		applyDraftHistory(next);
	}

	function parseScalar(value: string): string | number | boolean | null {
		if (value === 'true') return true;
		if (value === 'false') return false;
		if (value === 'null') return null;
		const number = Number(value);
		return value.trim() !== '' && Number.isFinite(number) ? number : value;
	}

	function updateTransformMappings(value: string) {
		try {
			const mappings = JSON.parse(value) as unknown;
			if (typeof mappings !== 'object' || mappings === null || Array.isArray(mappings) || Object.values(mappings).some((path) => typeof path !== 'string')) return;
			updateSelectedDefinitionNode((node) => node.type === 'transform' ? { ...node, config: { ...node.config, mappings: mappings as Record<string, string> } } : node);
		} catch {
			// Keep malformed JSON local to the input until it becomes a valid mapping object.
		}
	}

	type SupportedNodeType = 'condition' | 'wait' | 'wait-event' | 'approval' | 'transform';

	function addSupportedNode(type: SupportedNodeType, droppedPosition?: { x: number; y: number }) {
		if (!isExecutableDraft) return;
		const terminal = selectedDefinitionNode?.type === 'end-success'
			? selectedDefinitionNode
			: draftDefinition.nodes.find((node) => node.type === 'end-success');
		if (!terminal) return;
		const suffix = crypto.randomUUID().slice(0, 8);
		const id = `${type}-${suffix}`;
		const position = droppedPosition ?? { x: terminal.position.x - 280, y: terminal.position.y };
		const node: ProcessNode = type === 'condition'
			? { id, name: `condition-${suffix}`, type, position, config: { path: '$.value', operator: 'exists' } }
			: type === 'wait'
				? { id, name: `wait-${suffix}`, type, position, config: { durationMs: 1_000 } }
				: type === 'wait-event'
					? { id, name: `wait-event-${suffix}`, type, position, config: { eventType: 'process-event', timeoutMs: 86_400_000, resultKey: 'event' } }
					: type === 'approval'
						? { id, name: `approval-${suffix}`, type, position, config: { assigneeUserId: ownerUserId, timeoutMs: 86_400_000, resultKey: 'approval' } }
					: { id, name: `transform-${suffix}`, type, position, config: { mode: 'merge', mappings: { value: '$.value' } } };
		const incoming = draftDefinition.edges.filter((edge) => edge.target === terminal.id);
		const retainedEdges = draftDefinition.edges.filter((edge) => edge.target !== terminal.id);
		const insertedEdges = incoming.map((edge) => ({ ...edge, target: id }));
		if (type === 'condition') {
			const falseTerminalId = `end-false-${suffix}`;
			commitDraft({
				...draftDefinition,
				nodes: [...draftDefinition.nodes, node, {
					id: falseTerminalId,
					name: `return-false-${suffix}`,
					type: 'end-success',
					position: { x: terminal.position.x, y: terminal.position.y + 180 },
					config: {}
				}],
				edges: [
					...retainedEdges,
					...insertedEdges,
					{ id: `${id}-true`, source: id, target: terminal.id, when: true },
					{ id: `${id}-false`, source: id, target: falseTerminalId, when: false }
				]
			});
		} else {
			commitDraft({
				...draftDefinition,
				nodes: [...draftDefinition.nodes, node],
				edges: [...retainedEdges, ...insertedEdges, { id: `${id}-next`, source: id, target: terminal.id }]
			});
		}
		selectedId = id;
	}

	function startPaletteDrag(event: DragEvent, type: SupportedNodeType) {
		if (!event.dataTransfer || !isExecutableDraft) return;
		event.dataTransfer.setData('application/corex-node-type', type);
		event.dataTransfer.effectAllowed = 'copy';
	}

	function allowCanvasDrop(event: DragEvent) {
		if (!isExecutableDraft || !event.dataTransfer?.types.includes('application/corex-node-type')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function dropPaletteNode(event: DragEvent) {
		if (!isExecutableDraft || !event.dataTransfer) return;
		const type = event.dataTransfer.getData('application/corex-node-type') as SupportedNodeType;
		if (!['condition', 'wait', 'wait-event', 'approval', 'transform'].includes(type)) return;
		event.preventDefault();
		const bounds = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null;
		if (!bounds) return;
		addSupportedNode(type, {
			x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
			y: (event.clientY - bounds.top - viewport.y) / viewport.zoom
		});
	}

	function connectDraft(connection: { source: string | null; target: string | null; sourceHandle: string | null }) {
		if (!isExecutableDraft || !connection.source || !connection.target || connection.source === connection.target) return;
		const sourceNode = draftDefinition.nodes.find((node) => node.id === connection.source);
		const targetNode = draftDefinition.nodes.find((node) => node.id === connection.target);
		if (!sourceNode || !targetNode || sourceNode.type === 'end-success' || targetNode.type === 'trigger-http') return;
		const branch = sourceNode.type === 'condition'
			? connection.sourceHandle === 'true' ? true : connection.sourceHandle === 'false' ? false : null
			: undefined;
		if (branch === null) return;
		const retainedEdges = draftDefinition.edges.filter((edge) => (
			edge.source !== sourceNode.id || (sourceNode.type === 'condition' && edge.when !== branch)
		));
		commitDraft({
			...draftDefinition,
			edges: [...retainedEdges, {
				id: `${sourceNode.id}-${branch === undefined ? 'next' : branch ? 'true' : 'false'}-${targetNode.id}`,
				source: sourceNode.id,
				target: targetNode.id,
				...(branch === undefined ? {} : { when: branch })
			}]
		});
	}

	async function allowDraftDeletion({ nodes: deletedNodes }: { nodes: Node[]; edges: Edge[] }) {
		return isExecutableDraft && deletedNodes.every((node) => {
			const definitionNode = draftDefinition.nodes.find((candidate) => candidate.id === node.id);
			return definitionNode && !['trigger-http', 'end-success'].includes(definitionNode.type);
		});
	}

	function deleteDraftSelection({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[]; edges: Edge[] }) {
		if (!isExecutableDraft || deletedNodes.length === 0 && deletedEdges.length === 0) return;
		const deletedNodeIds = new Set(deletedNodes.map((node) => node.id));
		const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.filter((node) => !deletedNodeIds.has(node.id)),
			edges: draftDefinition.edges.filter((edge) =>
				!deletedIds.has(edge.id) && !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)
			)
		});
		selectedNodeIds = [];
		selectedId = draftDefinition.nodes[0]?.id ?? '';
	}

	function deleteSelectedNodes() {
		if (selectedDefinitionNodes.length === 0 || selectionHasProtectedNodes) return;
		const deletedNodeIds = new Set(selectedDefinitionNodes.map((node) => node.id));
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.filter((node) => !deletedNodeIds.has(node.id)),
			edges: draftDefinition.edges.filter((edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target))
		});
		selectedNodeIds = [];
		selectedId = draftDefinition.nodes[0]?.id ?? '';
	}

	function deleteSelectedNode() {
		if (!isExecutableDraft || !selectedDefinitionNode || ['trigger-http', 'condition', 'end-success'].includes(selectedDefinitionNode.type)) return;
		const nodeId = selectedDefinitionNode.id;
		const incoming = draftDefinition.edges.filter((edge) => edge.target === nodeId);
		const outgoing = draftDefinition.edges.filter((edge) => edge.source === nodeId);
		const retainedEdges = draftDefinition.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
		const reconnect = incoming.length === 1 && outgoing.length === 1
			? [{ ...incoming[0], target: outgoing[0].target }]
			: [];
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.filter((node) => node.id !== nodeId),
			edges: [...retainedEdges, ...reconnect]
		});
		selectedId = draftDefinition.nodes[0]?.id ?? '';
	}

	function canCopyNode(node: ProcessNode | undefined): node is ProcessNode {
		return Boolean(node && !['trigger-http', 'end-success'].includes(node.type));
	}

	function copySelectedNode() {
		if (!isExecutableDraft || !canCopyNode(selectedDefinitionNode)) return;
		copiedNode = structuredClone(selectedDefinitionNode);
	}

	function pasteCopiedNode() {
		if (!isExecutableDraft || !copiedNode) return;
		const suffix = crypto.randomUUID().slice(0, 8);
		const pasted = {
			...structuredClone(copiedNode),
			id: `${copiedNode.type}-${suffix}`,
			name: `${copiedNode.name}-copy-${suffix}`,
			position: { x: copiedNode.position.x + 48, y: copiedNode.position.y + 48 }
		} as ProcessNode;
		commitDraft({ ...draftDefinition, nodes: [...draftDefinition.nodes, pasted] });
		copiedNode = structuredClone(pasted);
		selectedId = pasted.id;
	}

	function duplicateSelectedNode() {
		if (!canCopyNode(selectedDefinitionNode)) return;
		copiedNode = structuredClone(selectedDefinitionNode);
		pasteCopiedNode();
	}

	function duplicateSelectedNodes() {
		if (!isExecutableDraft || selectedDefinitionNodes.length < 2 || selectionHasProtectedNodes) return;
		const selectedIds = new Set(selectedDefinitionNodes.map((node) => node.id));
		const idMap = new Map(selectedDefinitionNodes.map((node) => [node.id, `${node.type}-${crypto.randomUUID().slice(0, 8)}`]));
		const duplicatedNodes = selectedDefinitionNodes.map((node) => ({
			...structuredClone(node),
			id: idMap.get(node.id)!,
			name: `${node.name}-copy`,
			position: { x: node.position.x + 48, y: node.position.y + 48 }
		}) as ProcessNode);
		const duplicatedEdges = draftDefinition.edges
			.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
			.map((edge) => ({
				...edge,
				id: `${idMap.get(edge.source)}-${edge.when === undefined ? 'next' : edge.when ? 'true' : 'false'}-${idMap.get(edge.target)}`,
				source: idMap.get(edge.source)!,
				target: idMap.get(edge.target)!
			}));
		commitDraft({
			...draftDefinition,
			nodes: [...draftDefinition.nodes, ...duplicatedNodes],
			edges: [...draftDefinition.edges, ...duplicatedEdges]
		});
		selectedNodeIds = duplicatedNodes.map((node) => node.id);
		selectedId = duplicatedNodes.at(-1)?.id ?? selectedId;
	}

	function handleEditorShortcut(event: KeyboardEvent) {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && event.shiftKey || key === 'y') {
			event.preventDefault();
			redoDraft();
		} else if (key === 'z') {
			event.preventDefault();
			undoDraft();
		} else if (key === 'c') {
			event.preventDefault();
			copySelectedNode();
		} else if (key === 'v') {
			event.preventDefault();
			pasteCopiedNode();
		} else if (key === 'd') {
			event.preventDefault();
			if (selectedDefinitionNodes.length > 1) duplicateSelectedNodes();
			else duplicateSelectedNode();
		}
	}

	function prepareAiDraft() {
		if (!aiPrompt.trim()) return;
		draftNotice = locale === 'uk' ? 'Збережено як чернетку. AI та deploy не підключені.' : 'Saved as a draft. AI and deploy are not connected.';
	}

	$effect(() => {
		nodes = createNodes(activeScenario, locale);
		edges = createEdges(activeScenario);
	});

	onMount(async () => {
		if (!processGateway) {
			persistenceState = 'idle';
			return;
		}
		try {
			[persistedProcesses, approvalTasks] = await Promise.all([
				processGateway.listProcesses(ownerUserId),
				processGateway.listApprovalTasks(ownerUserId)
			]);
			if (persistedProcesses[0]) selectProcess(persistedProcesses[0]);
		} catch {
			persistenceError = locale === 'uk' ? 'Не вдалося завантажити чернетки.' : 'Could not load drafts.';
		} finally {
			persistenceState = 'idle';
		}
	});
</script>

<svelte:window onkeydown={handleEditorShortcut} />

<div class="engine-shell">
	<div class="canvas-toolbar">
		<div class="workflow-identity">
			<span class="workflow-logo"><Workflow size={17} /></span>
				<div><span>{text.journeys}</span><label><select value={activeProcess && isExecutableDraft ? processOptionId(activeProcess) : activeScenario.id} onchange={(event) => selectJourney(event.currentTarget.value)}>{#each persistedProcesses as process}<option value={processOptionId(process)}>{process.name}</option>{/each}{#if !activeProcess}<option value={executableScenario.id}>{localizedScenario(executableScenario, locale).label}</option>{/if}{#each flowScenarios as scenario}<option value={scenario.id}>{localizedScenario(scenario, locale).label}</option>{/each}</select><ChevronDown size={12} /></label></div>
		</div>
		<div class="editor-actions">
			<button type="button" disabled={!isExecutableDraft || undoStack.length === 0} onclick={undoDraft} aria-label={locale === 'uk' ? 'Скасувати' : 'Undo'} title="Ctrl+Z"><Undo2 size={14} /></button>
			<button type="button" disabled={!isExecutableDraft || redoStack.length === 0} onclick={redoDraft} aria-label={locale === 'uk' ? 'Повторити' : 'Redo'} title="Ctrl+Shift+Z"><Redo2 size={14} /></button>
				<span class="draft-state" class:readonly={!isExecutableDraft}><i></i>{isExecutableDraft ? (draftDirty ? (locale === 'uk' ? 'Незбережені зміни' : 'Unsaved changes') : (locale === 'uk' ? 'Чернетка' : 'Draft')) : (locale === 'uk' ? 'Лише перегляд' : 'Read only')}</span>
			<button type="button" disabled={!isExecutableDraft || persistenceState !== 'idle' || !draftDirty} onclick={saveDraft}><FileUp size={14} />{persistenceState === 'saving' ? (locale === 'uk' ? 'Збереження' : 'Saving') : (locale === 'uk' ? 'Зберегти' : 'Save')}</button>
				<button type="button" disabled={!isExecutableDraft} onclick={validateDraft}><Check size={14} />{locale === 'uk' ? 'Перевірити' : 'Validate'}</button>
			<button class="publish" type="button" disabled={!publishEnabled} onclick={publishProcess}><Upload size={14} />{commandState === 'publishing' ? (locale === 'uk' ? 'Публікація' : 'Publishing') : (locale === 'uk' ? 'Опублікувати' : 'Publish')}</button>
			<button type="button" disabled={!runEnabled} onclick={runProcess}><Play size={14} />{commandState === 'running' ? (locale === 'uk' ? 'Запуск' : 'Starting') : 'Run'}</button>
		</div>
	</div>
		{#if validationResult}
			<div class:valid={validationResult.valid} class="validation-banner" role="status">
				{#if validationResult.valid}<Check size={14} />{:else}<XCircle size={14} />{/if}
				<strong>{validationResult.valid ? (locale === 'uk' ? 'Чернетка готова до публікації' : 'Draft is ready to publish') : (locale === 'uk' ? `Знайдено проблем: ${validationResult.issues.length}` : `Issues found: ${validationResult.issues.length}`)}</strong>
				{#if !validationResult.valid}<span>{validationResult.issues.map((issue) => issue.message).join(' ')}</span>{/if}
			</div>
		{/if}
		{#if persistenceError}<div class="persistence-error" role="alert"><XCircle size={14} />{persistenceError}</div>{/if}
		{#if commandNotice}<div class="command-notice" role="status">{commandNotice}</div>{/if}
	<div class="workflow-summary scenario-heading"><div><div class="breadcrumbs"><span>{localizedCategory(activeScenario.category, locale)}</span><b>/</b><strong>{activeCopy.title}</strong><span class="revision">{text.trace}</span></div><p>{activeCopy.description}</p></div><div class="legend"><span><i class="complete"></i>{text.passed}</span><span><i class="running"></i>{text.active}</span><span><i></i>{text.pending}</span></div></div>

	<div class="engine-body">
		<aside class="node-palette process-catalog">
			<header><Boxes size={15} /><strong>{locale === 'uk' ? 'Палітра вузлів' : 'Node palette'}</strong></header>
			<label class="process-search">
				<Search size={14} />
				<input bind:value={paletteQuery} type="search" placeholder={locale === 'uk' ? 'Знайти вузол' : 'Find node'} />
			</label>
			<nav aria-label={locale === 'uk' ? 'Вузли Cloudflare Workflows' : 'Cloudflare Workflows nodes'}>
				{#each filteredPalette as group}
					<section><h3>{group.label}<ChevronDown size={11} /></h3>
						{#each group.items as item}
							{@const Icon = item.icon}
							<button type="button" draggable={Boolean(item.nodeType && isExecutableDraft)} disabled={!item.nodeType || !isExecutableDraft} ondragstart={(event) => item.nodeType && startPaletteDrag(event, item.nodeType)} onclick={() => item.nodeType && addSupportedNode(item.nodeType)}><span class="palette-icon"><Icon size={14} /></span><span><b>{item.label}</b><small>{item.api}</small></span><ChevronRight size={11} /></button>
						{/each}
					</section>
				{/each}
				{#if filteredPalette.length === 0}<p class="empty-catalog">{text.empty}</p>{/if}
			</nav>
			<section class="approval-inbox" aria-label={locale === 'uk' ? 'Мої погодження' : 'My approvals'}>
				<h3>{locale === 'uk' ? 'Мої погодження' : 'My approvals'}<span>{approvalTasks.filter((task) => task.status === 'pending').length}</span></h3>
				{#each approvalTasks.slice(0, 5) as task}
					<article class:resolved={task.status !== 'pending'}>
						<div><strong>{task.stepName}</strong><small>{task.status} · {new Date(task.deadlineAt).toLocaleString(locale)}</small></div>
						{#if task.status === 'pending'}
							<input value={approvalTaskComments[task.id] ?? ''} oninput={(event) => approvalTaskComments = { ...approvalTaskComments, [task.id]: event.currentTarget.value }} placeholder={locale === 'uk' ? 'Коментар' : 'Comment'} />
							<div class="approval-task-actions">
								<button type="button" disabled={Boolean(approvalTaskSendingId)} onclick={() => decideApprovalTask(task, 'rejected')}><XCircle size={12} />{locale === 'uk' ? 'Відхилити' : 'Reject'}</button>
								<button type="button" disabled={Boolean(approvalTaskSendingId)} onclick={() => decideApprovalTask(task, 'approved')}><Check size={12} />{locale === 'uk' ? 'Погодити' : 'Approve'}</button>
							</div>
						{/if}
					</article>
				{:else}<p>{locale === 'uk' ? 'Немає призначених задач' : 'No assigned tasks'}</p>{/each}
			</section>
			<div class="palette-foot"><Code2 size={13} /><span>{locale === 'uk' ? 'Експорт у TypeScript Workflow' : 'TypeScript Workflow output'}</span></div>
		</aside>
		<div class="canvas" role="application" aria-label={text.canvas} ondragover={allowCanvasDrop} ondrop={dropPaletteNode}>
			<div class="canvas-badge"><span><i></i>PREVIEW</span><button type="button" disabled={!activeProcess || !isExecutableDraft} aria-expanded={versionHistoryOpen} aria-controls="version-history-panel" aria-label={locale === 'uk' ? 'Історія версій' : 'Version history'} onclick={toggleVersionHistory}><History size={14} /></button></div>
			{#if versionHistoryOpen}
				<section id="version-history-panel" class="version-history" aria-label={locale === 'uk' ? 'Історія версій' : 'Version history'}>
					<header>
						<div><History size={14} /><strong>{locale === 'uk' ? 'Історія версій' : 'Version history'}</strong></div>
						<button type="button" onclick={() => versionHistoryOpen = false} aria-label={locale === 'uk' ? 'Закрити історію' : 'Close history'}><XCircle size={15} /></button>
					</header>
					<div class="version-list">
						{#if versionHistoryState === 'loading'}
							<p class="version-message"><LoaderCircle size={14} />{locale === 'uk' ? 'Завантаження...' : 'Loading...'}</p>
						{:else if versionHistoryError}
							<div class="version-message error"><span>{versionHistoryError}</span><button type="button" onclick={() => activeProcess && loadVersionHistory(activeProcess)}><RefreshCcw size={12} />{locale === 'uk' ? 'Повторити' : 'Retry'}</button></div>
						{:else if versions.length === 0}
							<p class="version-message">{locale === 'uk' ? 'Опублікованих версій ще немає.' : 'No published versions yet.'}</p>
						{:else}
							{#each versions as version}
								<article>
									<div class="version-heading"><strong>v{version.version}</strong>{#if version.version === activeProcess?.publishedVersion}<span>{locale === 'uk' ? 'Поточна' : 'Current'}</span>{/if}</div>
									<time datetime={version.publishedAt}>{new Date(version.publishedAt).toLocaleString(locale)}</time>
									<code title={version.definitionSha256}>{version.definitionSha256.slice(0, 12)}</code>
									<button type="button" onclick={() => restorePublishedVersion(version)}>{locale === 'uk' ? 'Відновити як чернетку' : 'Restore as draft'}</button>
								</article>
							{/each}
						{/if}
					</div>
				</section>
			{/if}
			{#if isExecutableDraft && selectedDefinitionNodes.length > 1}
				<div class="selection-actions" aria-label={locale === 'uk' ? 'Дії з вибраними вузлами' : 'Selected node actions'}>
					<strong>{selectedDefinitionNodes.length} {locale === 'uk' ? 'вибрано' : 'selected'}</strong>
					<button type="button" disabled={selectionHasProtectedNodes} onclick={duplicateSelectedNodes} aria-label={locale === 'uk' ? 'Дублювати вибрані вузли' : 'Duplicate selected nodes'} title={locale === 'uk' ? 'Дублювати вибрані' : 'Duplicate selected'}><Copy size={14} /></button>
					<button class="delete-selection" type="button" disabled={selectionHasProtectedNodes} onclick={deleteSelectedNodes} aria-label={locale === 'uk' ? 'Видалити вибрані вузли' : 'Delete selected nodes'} title={selectionHasProtectedNodes ? (locale === 'uk' ? 'Trigger і завершення захищені' : 'Trigger and terminal nodes are protected') : (locale === 'uk' ? 'Видалити вибрані' : 'Delete selected')}><Trash2 size={14} /></button>
				</div>
			{/if}
			<SvelteFlow
				bind:nodes
				bind:edges
				bind:viewport
				{nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.12, minZoom: 0.35, maxZoom: 0.72 }}
				minZoom={0.25}
				maxZoom={1.35}
				selectionOnDrag={isExecutableDraft}
				nodesConnectable={isExecutableDraft}
				nodesDraggable={isExecutableDraft}
				elementsSelectable
				deleteKey={['Backspace', 'Delete']}
				onconnect={connectDraft}
				onselectionchange={updateSelection}
				onbeforedelete={allowDraftDeletion}
				ondelete={deleteDraftSelection}
				onnodeclick={selectNode}
				onnodedragstop={updateDraftPosition}
			>
				<Background variant={BackgroundVariant.Dots} gap={18} size={1.25} />
				<Controls position="bottom-left" showLock={false} />
				<MiniMap position="bottom-right" pannable zoomable nodeColor="#65758a" maskColor="rgb(15 21 32 / 78%)" />
			</SvelteFlow>
			<form class="ai-dock" onsubmit={(event) => { event.preventDefault(); prepareAiDraft(); }}>
				<span><Sparkles size={15} /></span><input bind:value={aiPrompt} placeholder={locale === 'uk' ? 'Опишіть процес або додайте документацію для AI...' : 'Describe a process or add documentation for AI...'} /><button type="submit" aria-label={locale === 'uk' ? 'Створити чернетку' : 'Create draft'}><Bot size={15} /></button>
				{#if draftNotice}<small>{draftNotice}</small>{/if}
			</form>
		</div>

		<aside class="inspector" aria-live="polite">
			<header><div><span>{text.inspector}</span><strong>{selectedNode.title} <small>({selectedNode.id})</small></strong></div><PanelRightClose size={17} /></header>
			<div class="inspector-tabs"><button class:active={inspectorTab === 'details'} onclick={() => inspectorTab = 'details'} type="button">{locale === 'uk' ? 'Налаштування' : 'Settings'}</button><button class:active={inspectorTab === 'runs'} onclick={() => inspectorTab = 'runs'} type="button">{locale === 'uk' ? 'Виконання' : 'Runs'}</button></div>
			<div class="inspector-body">
				{#if inspectorTab === 'runs'}
					<label class="run-input"><span>Input JSON</span><textarea bind:value={runInput} spellcheck="false"></textarea></label>
					<div class="run-history-head"><span>{locale === 'uk' ? 'Історія запусків' : 'Run history'}</span><button type="button" disabled={!activeProcess || runHistoryState === 'loading'} onclick={() => activeProcess && loadRunHistory(activeProcess.id, selectedRunId)} aria-label={locale === 'uk' ? 'Оновити запуски' : 'Refresh runs'} title={locale === 'uk' ? 'Оновити запуски' : 'Refresh runs'}><RefreshCcw size={13} /></button></div>
					{#if runs.length > 0}<label class="run-picker"><span>{locale === 'uk' ? 'Запуск' : 'Run'}</span><select value={selectedRunId} onchange={(event) => selectRun(event.currentTarget.value)}>{#each runs as run}<option value={run.id}>{run.status} · {run.id}</option>{/each}</select></label>{/if}
					{#if runHistoryState === 'loading'}<div class="run-empty"><LoaderCircle size={14} />{locale === 'uk' ? 'Завантаження...' : 'Loading...'}</div>
					{:else if runHistoryError}<div class="run-empty error">{runHistoryError}</div>
					{:else if selectedRun}
						<div class="execution-timeline">
							<span>{selectedRun.status}</span>
							<strong>{locale === 'uk' ? `Завершено кроків: ${runSummary.completedSteps}` : `Completed steps: ${runSummary.completedSteps}`}{runSummary.activeStep ? ` · ${locale === 'uk' ? 'Активний' : 'Active'}: ${runSummary.activeStep}` : ''}</strong>
							<small>{selectedRun.id} · {selectedRun.workflowInstanceId}</small>
						</div>
						{#if selectedRunError}<details class="run-detail error" open><summary>{locale === 'uk' ? 'Помилка запуску' : 'Run error'}</summary><pre>{selectedRunError}</pre></details>{/if}
						{#if selectedRunOutput}<details class="run-detail"><summary>{locale === 'uk' ? 'Результат запуску' : 'Run output'}</summary><pre>{selectedRunOutput}</pre></details>{/if}
						{#if activeApproval}
							<div class="node-config">
								<strong>{locale === 'uk' ? `Потрібне рішення: ${activeApproval.stepName}` : `Decision required: ${activeApproval.stepName}`}</strong>
								<label><span>{locale === 'uk' ? 'Коментар' : 'Comment'}</span><textarea bind:value={approvalComment} spellcheck="true"></textarea></label>
								<div class="approval-actions">
									<button type="button" disabled={eventSending} onclick={() => decideApproval('approved')}><Check size={13} />{locale === 'uk' ? 'Погодити' : 'Approve'}</button>
									<button type="button" disabled={eventSending} onclick={() => decideApproval('rejected')}><XCircle size={13} />{locale === 'uk' ? 'Відхилити' : 'Reject'}</button>
								</div>
							</div>
						{:else}<div class="node-config">
							<label><span>{locale === 'uk' ? 'Тип події' : 'Event type'}</span><input bind:value={runEventType} /></label>
							<label><span>Payload JSON</span><textarea bind:value={runEventPayload} spellcheck="false"></textarea></label>
							<button type="button" disabled={eventSending || !runEventType.trim() || ['complete', 'errored', 'terminated'].includes(selectedRun.status)} onclick={sendRunEvent}><Webhook size={13} />{eventSending ? (locale === 'uk' ? 'Надсилання' : 'Sending') : (locale === 'uk' ? 'Надіслати подію' : 'Send event')}</button>
						</div>{/if}
						<div class="run-events">{#each runEvents as event}<div><b>#{event.sequence} {event.eventType}</b><span>{event.stepName ?? 'process'}{event.attempt ? ` · attempt ${event.attempt}` : ''}</span><time datetime={event.createdAt}>{new Date(event.createdAt).toLocaleString(locale)}</time>{#if formatRunDetail(event.payload)}<details class="run-detail"><summary>Payload</summary><pre>{formatRunDetail(event.payload)}</pre></details>{/if}</div>{/each}</div>
						{#if runEvents.length === 0}<div class="run-empty">{locale === 'uk' ? 'Подій ще немає.' : 'No events yet.'}</div>{/if}
					{:else}<div class="run-empty">{locale === 'uk' ? 'Запусків ще немає.' : 'No runs yet.'}</div>{/if}
				{/if}
				<span class="node-type">{selectedNode.layer ?? 'process'} · {selectedNode.eyebrow}</span>
				<h3>{selectedNode.title}</h3>
				<p>{selectedNode.detail}</p>
				{#if inspectorTab === 'details' && selectedDefinitionNode?.type === 'condition'}
					<div class="node-config">
						<label><span>JSON path</span><input value={selectedDefinitionNode.config.path} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'condition' ? { ...node, config: { ...node.config, path: event.currentTarget.value } } : node)} /></label>
						<label><span>Operator</span><select value={selectedDefinitionNode.config.operator} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'condition' ? { ...node, config: { ...node.config, operator: event.currentTarget.value as typeof node.config.operator } } : node)}><option value="equals">equals</option><option value="not-equals">not equals</option><option value="greater-than">greater than</option><option value="less-than">less than</option><option value="exists">exists</option></select></label>
						{#if selectedDefinitionNode.config.operator !== 'exists'}<label><span>Value</span><input value={String(selectedDefinitionNode.config.value ?? '')} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'condition' ? { ...node, config: { ...node.config, value: parseScalar(event.currentTarget.value) } } : node)} /></label>{/if}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'wait'}
					<div class="node-config"><label><span>Duration (ms)</span><input type="number" min="1" max="31536000000" step="1" value={selectedDefinitionNode.config.durationMs} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'wait' ? { ...node, config: { durationMs: Number(event.currentTarget.value) } } : node)} /></label></div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'wait-event'}
					<div class="node-config">
						<label><span>Event type</span><input value={selectedDefinitionNode.config.eventType} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'wait-event' ? { ...node, config: { ...node.config, eventType: event.currentTarget.value } } : node)} /></label>
						<label><span>Timeout (ms)</span><input type="number" min="1" max="31536000000" step="1" value={selectedDefinitionNode.config.timeoutMs} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'wait-event' ? { ...node, config: { ...node.config, timeoutMs: Number(event.currentTarget.value) } } : node)} /></label>
						<label><span>Result key</span><input value={selectedDefinitionNode.config.resultKey} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'wait-event' ? { ...node, config: { ...node.config, resultKey: event.currentTarget.value } } : node)} /></label>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'approval'}
					<div class="node-config">
						<label><span>{locale === 'uk' ? 'User ID погоджувача' : 'Assignee user ID'}</span><input value={selectedDefinitionNode.config.assigneeUserId} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'approval' ? { ...node, config: { ...node.config, assigneeUserId: event.currentTarget.value } } : node)} /></label>
						<label><span>Timeout (ms)</span><input type="number" min="1" max="31536000000" step="1" value={selectedDefinitionNode.config.timeoutMs} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'approval' ? { ...node, config: { ...node.config, timeoutMs: Number(event.currentTarget.value) } } : node)} /></label>
						<label><span>Result key</span><input value={selectedDefinitionNode.config.resultKey} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'approval' ? { ...node, config: { ...node.config, resultKey: event.currentTarget.value } } : node)} /></label>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'transform'}
					<div class="node-config">
						<label><span>Mode</span><select value={selectedDefinitionNode.config.mode} onchange={(event) => updateSelectedDefinitionNode((node) => node.type === 'transform' ? { ...node, config: { ...node.config, mode: event.currentTarget.value as 'merge' | 'replace' } } : node)}><option value="merge">merge</option><option value="replace">replace</option></select></label>
						<label><span>Mappings (JSON)</span><textarea spellcheck="false" oninput={(event) => updateTransformMappings(event.currentTarget.value)}>{JSON.stringify(selectedDefinitionNode.config.mappings, null, 2)}</textarea></label>
					</div>
				{/if}
				{#if inspectorTab === 'details' && selectedDefinitionNode && !['trigger-http', 'condition', 'end-success'].includes(selectedDefinitionNode.type)}
					<div class="node-actions">
						<button type="button" onclick={duplicateSelectedNode} title={locale === 'uk' ? 'Дублювати вузол' : 'Duplicate node'}><Copy size={13} />{locale === 'uk' ? 'Дублювати' : 'Duplicate'}</button>
						<button class="delete-node" type="button" onclick={deleteSelectedNode}><Trash2 size={13} />{locale === 'uk' ? 'Видалити' : 'Delete'}</button>
					</div>
				{:else if inspectorTab === 'details' && canCopyNode(selectedDefinitionNode)}
					<div class="node-actions"><button type="button" onclick={copySelectedNode}><Copy size={13} />{locale === 'uk' ? 'Копіювати' : 'Copy'}</button><button type="button" disabled={!copiedNode} onclick={pasteCopiedNode}><ClipboardPaste size={13} />{locale === 'uk' ? 'Вставити' : 'Paste'}</button></div>
				{/if}
				<div class="entrypoint"><span>{text.entry}</span><code>{activeScenario.entrypoint}</code></div>

				<div class="property-list">
					<div><span>{text.status}</span><strong data-status={selectedNode.status}>
						{#if selectedNode.status === 'complete'}<Check size={13} />{:else if selectedNode.status === 'running'}<LoaderCircle size={13} />{:else if selectedNode.status === 'waiting'}<CirclePause size={13} />{:else}<LockKeyhole size={13} />{/if}
						{statusText[locale][selectedNode.status]}
					</strong></div>
					<div><span>{text.execution}</span><strong>{text.simulation}</strong></div>
					<div><span>{text.result}</span><strong>{selectedNode.meta}</strong></div>
					<div><span>Retry</span><strong>3 · exponential</strong></div>
					<div><span>Timeout</span><strong>30 seconds</strong></div>
				</div>

				<div class="trace">
					<div><Code2 size={14} /><span>{text.communication}</span></div>
					{#if selectedNode.request}<code>{selectedNode.request}</code>{/if}
					{#if selectedNode.operation}<code><Database size={12} /> {selectedNode.operation}</code>{/if}
					{#if selectedNode.input}<p><b>IN</b> {selectedNode.input}</p>{/if}
					{#if selectedNode.output}<p><b>OUT</b> {selectedNode.output}</p>{/if}
				</div>

				<div class="protected">
					<ShieldCheck size={17} />
					<div><strong>{text.noMutation}</strong><span>{text.noMutationDetail}</span></div>
				</div>
			</div>
		</aside>
	</div>
</div>

<style>
	.engine-shell { overflow: hidden; border: 1px solid #bbc1c5; border-radius: 0 0 7px 7px; background: #e8ebec; font-family: 'Manrope', sans-serif; }
	.canvas-toolbar { min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 14px; border-bottom: 1px solid #c5cacf; color: #5d6469; background: #f7f8f8; font-size: 11px; }
	.scenario-heading { min-width: 0; padding-block: 9px; }
	.scenario-heading p { max-width: 780px; margin: 5px 0 0; overflow: hidden; color: #7b8286; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.breadcrumbs, .legend, .legend span { display: flex; align-items: center; }
	.breadcrumbs { gap: 8px; }
	.breadcrumbs b { color: #b1b6ba; }
	.breadcrumbs strong { color: #25292c; }
	.revision { padding: 4px 6px; border-radius: 3px; color: #667078; background: #e7eaec; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.legend { gap: 13px; color: #747b80; font: 650 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.legend span { gap: 5px; }
	.legend i { width: 7px; height: 7px; border-radius: 50%; background: #8b9297; }
	.legend i.complete { background: #3f8a61; }
	.legend i.running { background: #d6952e; box-shadow: 0 0 0 3px rgb(214 149 46 / 16%); }
	.engine-body { height: min(700px, calc(100vh - 154px)); min-height: 540px; display: grid; grid-template-columns: 216px minmax(0, 1fr) 258px; }
	.process-catalog { min-width: 0; overflow: hidden; border-right: 1px solid #3e4549; color: #d4d9dc; background: #252a2d; }
	.process-catalog > header { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 13px; border-bottom: 1px solid #3a4044; }
	.process-catalog > header strong { font: 750 11px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.process-search { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border-bottom: 1px solid #3a4044; color: #899399; }
	.process-search input { min-width: 0; width: 100%; height: 29px; border: 1px solid #454d52; border-radius: 4px; outline: 0; padding: 0 8px; color: #eef1f2; background: #30363a; font: 650 10px/1 'Manrope', sans-serif; }
	.process-search input:focus { border-color: #7b94b8; box-shadow: 0 0 0 2px rgb(100 133 180 / 15%); }
	.process-search input::placeholder { color: #7f898e; }
	.process-catalog nav { height: calc(100% - 96px); overflow-y: auto; padding: 8px 7px 18px; scrollbar-width: thin; }
	.process-catalog section { margin-bottom: 10px; }
	.process-catalog h3 { height: 27px; display: flex; align-items: center; margin: 0; padding: 0 8px; color: #7f898e; font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.process-catalog button { width: 100%; min-height: 31px; display: flex; align-items: center; gap: 6px; border: 0; border-radius: 3px; padding: 0 7px 0 10px; color: #b9c0c4; background: transparent; font: 650 10px/1.25 'Manrope', sans-serif; text-align: left; }
	.process-catalog button span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.process-catalog button :global(svg) { flex: 0 0 auto; opacity: 0; }
	.process-catalog button:hover { color: #fff; background: #343a3e; }
	.empty-catalog { margin: 20px 8px; color: #8d969b; font: 650 10px/1.4 'Manrope', sans-serif; }
	.canvas { min-width: 0; height: 100%; background: #edf0f1; }
	.selection-actions { position: absolute; z-index: 5; top: 12px; left: 50%; min-height: 34px; display: flex; align-items: center; gap: 5px; padding: 4px 5px 4px 10px; border: 1px solid #46546a; border-radius: 6px; color: #d9e1ec; background: #182230; box-shadow: 0 8px 24px rgb(7 12 20 / 24%); transform: translateX(-50%); }
	.selection-actions strong { margin-right: 4px; font-size: 10px; }
	.selection-actions button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; border-radius: 4px; color: #c7d1df; background: #273448; }
	.selection-actions button:not(:disabled):hover { color: #fff; background: #34445d; }
	.selection-actions button.delete-selection:not(:disabled):hover { color: #ffd5ce; background: #6f302b; }
	.inspector { border-left: 1px solid #c5cacf; color: #282d30; background: #f8f9f9; }
	.inspector > header { min-height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #d8dcdf; }
	.inspector > header div { display: grid; gap: 3px; }
	.inspector > header span { color: #858b8f; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.inspector > header strong { font: 700 11px/1 monospace; }
	.inspector-body { padding: 22px 17px; }
	.node-type { color: #5272a8; font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.inspector h3 { margin: 10px 0 9px; font-size: 19px; letter-spacing: 0; }
	.inspector p { margin: 0; color: #6d7478; font-size: 12px; line-height: 1.55; }
	.entrypoint { margin-top: 16px; display: grid; gap: 5px; }
	.entrypoint span { color: #83898d; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.entrypoint code { overflow-wrap: anywhere; color: #3d5868; font: 700 9px/1.4 monospace; }
	.node-config { display: grid; gap: 9px; margin-top: 16px; }
	.node-config label { display: grid; gap: 5px; color: #83898d; font-size: 9px; font-weight: 700; text-transform: uppercase; }
	.node-config input, .node-config select, .node-config textarea { width: 100%; border: 1px solid #3b4658; border-radius: 4px; outline: 0; padding: 7px 8px; color: #e8edf4; background: #202938; font: 650 10px/1.35 monospace; }
	.node-config textarea { min-height: 92px; resize: vertical; }
	.node-config input:focus, .node-config select:focus, .node-config textarea:focus { border-color: #829fda; }
	.property-list { margin-top: 24px; border-top: 1px solid #dde0e2; }
	.property-list > div { min-height: 43px; display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 8px; border-bottom: 1px solid #dde0e2; }
	.property-list span { color: #83898d; font-size: 10px; }
	.property-list strong { min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; color: #3e4448; font: 700 10px/1.2 'Manrope', sans-serif; text-overflow: ellipsis; text-transform: capitalize; }
	.property-list strong[data-status='complete'] { color: #28754e; }
	.property-list strong[data-status='running'] { color: #9a6413; }
	.trace { margin-top: 18px; display: grid; gap: 7px; padding: 11px; border: 1px solid #d7dcdf; border-radius: 5px; background: #eef1f2; }
	.trace > div { display: flex; align-items: center; gap: 6px; color: #68747b; }
	.trace > div span { font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.trace code { min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; color: #2f4858; font: 700 9px/1.4 monospace; text-overflow: ellipsis; white-space: nowrap; }
	.trace p { margin: 0; color: #687278; font: 650 9px/1.4 monospace; }
	.trace b { color: #405d6d; }
	.protected { margin-top: 24px; display: flex; gap: 10px; padding: 12px; border: 1px solid #d8caa5; border-radius: 5px; color: #785f21; background: #fff9e9; }
	.protected div { display: grid; gap: 4px; }
	.protected strong { font-size: 11px; }
	.protected span { color: #8b7950; font-size: 9px; line-height: 1.4; }
	:global(.svelte-flow__edge-text) { fill: #545d62; font: 800 10px/1 'Manrope', sans-serif; text-transform: uppercase; }
	:global(.svelte-flow__edge-textbg) { fill: #f6f7f7; }
	:global(.svelte-flow__controls) { overflow: hidden; border: 1px solid #b8bec2; border-radius: 5px; box-shadow: 0 5px 16px rgb(38 43 47 / 10%); }
	:global(.svelte-flow__controls-button) { border-bottom-color: #d4d8da; background: #fff; }
	:global(.svelte-flow__minimap) { overflow: hidden; border: 1px solid #b8bec2; border-radius: 4px; background: #f6f7f7; }
	@media (max-width: 760px) {
		.canvas-toolbar { align-items: flex-start; flex-direction: column; padding-block: 10px; }
		.scenario-heading p { white-space: normal; }
		.legend { display: none; }
		.engine-body { height: 780px; min-height: 0; grid-template-columns: 1fr; grid-template-rows: 104px 440px 236px; }
		.process-catalog { border-right: 0; border-bottom: 1px solid #3e4549; }
		.process-catalog > header { display: none; }
		.process-search { height: 42px; }
		.process-catalog nav { height: 62px; display: flex; gap: 4px; overflow-x: auto; overflow-y: hidden; padding: 5px 7px; }
		.process-catalog section { display: flex; gap: 3px; flex: 0 0 auto; margin: 0; }
		.process-catalog h3 { display: none; }
		.process-catalog button { width: auto; min-height: 32px; flex: 0 0 auto; padding-inline: 10px; border: 1px solid #3b4347; }
		.process-catalog button span { overflow: visible; }
		.process-catalog button :global(svg) { display: none; }
		.inspector { border-top: 1px solid #c5cacf; border-left: 0; overflow-y: auto; }
		.inspector > header { min-height: 44px; }
		.inspector-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; padding: 14px 16px; }
		.inspector-body > p { grid-column: 1 / -1; }
		.property-list, .protected { margin-top: 14px; }
	}

	/* Corex workbench: dashboard shell outside, dense orchestration surface inside. */
	.engine-shell { border-color: #252d3a; background: #101621; }
	.canvas-toolbar { min-height: 58px; padding: 0 12px; border-color: #2b3443; color: #c9d1dc; background: #151d29; }
	.workflow-identity, .workflow-identity > div, .workflow-identity label, .editor-actions { display: flex; align-items: center; }
	.workflow-identity { gap: 10px; }
	.workflow-logo { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 5px; color: #a9c2f5; background: #293753; }
	.workflow-identity > div { align-items: flex-start; flex-direction: column; gap: 3px; }
	.workflow-identity > div > span { color: #7c8899; font-size: 8px; font-weight: 800; text-transform: uppercase; }
	.workflow-identity label { position: relative; }
	.workflow-identity select { width: min(320px, 32vw); appearance: none; border: 0; padding: 0 19px 0 0; outline: 0; color: #eef3fa; background: transparent; font: 750 12px/1.2 'Manrope', sans-serif; }
	.workflow-identity label :global(svg) { position: absolute; right: 0; pointer-events: none; }
	.editor-actions { gap: 7px; }
	.editor-actions button { height: 32px; display: flex; align-items: center; gap: 6px; border: 1px solid #3a4557; border-radius: 5px; padding: 0 10px; color: #cbd3de; background: #232c3a; font: 700 10px/1 'Manrope', sans-serif; }
	.editor-actions button:not(:disabled):hover { border-color: #5a7198; background: #293548; }
	.editor-actions .publish { color: #727d8d; background: #29313d; }
	.draft-state { display: flex; align-items: center; gap: 6px; margin-right: 3px; color: #9ea8b5; font-size: 10px; }
	.draft-state i { width: 7px; height: 7px; border-radius: 50%; background: #dfa731; }
	.draft-state.readonly i { background: #8e8e93; }
	.persistence-error { min-height: 36px; display: flex; align-items: center; gap: 7px; padding: 8px 14px; border-bottom: 1px solid #d9b9b2; color: #873f32; background: #fff4f1; font-size: 11px; font-weight: 700; }
	.command-notice { min-height: 36px; display: flex; align-items: center; padding: 8px 14px; border-bottom: 1px solid #b8d2ee; color: #245d8e; background: #eef7ff; font-size: 11px; font-weight: 700; }
	.validation-banner { min-height: 38px; display: flex; align-items: center; gap: 7px; padding: 7px 14px; border-bottom: 1px solid #d7a53d; color: #7a5310; background: #fff5d9; font-size: 10px; }
	.validation-banner.valid { border-color: #79b68f; color: #19673b; background: #eaf8ee; }
	.validation-banner span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.workflow-summary.scenario-heading { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 7px 14px; border-bottom: 1px solid #2b3443; color: #8d99aa; background: #121925; }
	.workflow-summary.scenario-heading p { max-width: 650px; margin-top: 4px; color: #748194; }
	.breadcrumbs strong { color: #e2e8f0; }
	.breadcrumbs b { color: #4d5868; }
	.revision { color: #9ba8b9; background: #252e3d; }
	.legend { color: #7d8999; }
	.engine-body { height: min(720px, calc(100vh - 154px)); min-height: 560px; grid-template-columns: 228px minmax(0, 1fr) 286px; }
	.node-palette.process-catalog { border-color: #30394a; color: #d5dbe4; background: #171f2b; }
	.node-palette.process-catalog > header { height: 44px; border-color: #30394a; }
	.node-palette.process-catalog > header strong { font-size: 10px; }
	.process-search { height: 43px; padding: 0 10px; border-color: #30394a; color: #778496; }
	.process-search input { height: 28px; border-color: #3b4658; color: #eef2f7; background: #202938; }
	.node-palette.process-catalog nav { height: calc(100% - 119px); padding: 7px; }
	.node-palette.process-catalog section { margin-bottom: 8px; }
	.node-palette.process-catalog h3 { height: 27px; justify-content: space-between; color: #818c9c; font-size: 8px; }
	.node-palette.process-catalog button { min-height: 42px; gap: 8px; border: 1px solid #333d4d; border-radius: 5px; margin-bottom: 5px; padding: 5px 7px; color: #c8d0dc; background: #222b39; }
	.node-palette.process-catalog button > span:nth-child(2) { min-width: 0; flex: 1; display: grid; gap: 3px; }
	.node-palette.process-catalog button b { font-size: 10px; }
	.node-palette.process-catalog button small { overflow: hidden; color: #788597; font: 650 8px/1 monospace; text-overflow: ellipsis; white-space: nowrap; }
	.node-palette.process-catalog button :global(svg) { opacity: 1; }
	.node-palette.process-catalog button:hover { border-color: #536b96; color: #fff; background: #293548; }
	.palette-icon { width: 24px; height: 24px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 4px; color: #a3bbed; background: #31405a; }
	.palette-foot { height: 32px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border-top: 1px solid #30394a; color: #748092; font-size: 8px; }
	.approval-inbox { max-height: 245px; overflow-y: auto; border-top: 1px solid #30394a; padding: 8px; background: #151c28; }
	.approval-inbox h3 { margin: 0 0 7px; display: flex; align-items: center; justify-content: space-between; color: #d8dee8; font-size: 10px; }
	.approval-inbox h3 span { min-width: 18px; height: 18px; display: grid; place-items: center; border-radius: 9px; color: #fff; background: #315ea8; font-size: 9px; }
	.approval-inbox article { display: grid; gap: 6px; margin-bottom: 6px; padding: 8px; border: 1px solid #354154; border-radius: 5px; background: #1d2634; }
	.approval-inbox article.resolved { opacity: .58; }
	.approval-inbox article > div:first-child { min-width: 0; display: grid; gap: 3px; }
	.approval-inbox strong { overflow: hidden; color: #e6ebf2; font-size: 10px; text-overflow: ellipsis; }
	.approval-inbox small, .approval-inbox > p { margin: 0; color: #8490a1; font-size: 8px; }
	.approval-inbox input { min-width: 0; height: 28px; border: 1px solid #3b4759; border-radius: 4px; padding: 0 7px; color: #dce3ed; background: #111823; font-size: 9px; }
	.approval-task-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
	.approval-task-actions button { min-height: 27px; justify-content: center; border-color: #465268; color: #cbd4e1; }
	.approval-task-actions button:last-child { border-color: #315f52; color: #b9e2d2; background: #1d3932; }
	.node-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px; }
	.node-actions button { height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid #3a4557; border-radius: 5px; color: #cbd3de; background: #232c3a; font: 700 10px/1 'Manrope', sans-serif; }
	.delete-node { border-color: #6b3e46 !important; color: #f1b4bd !important; background: #38232a !important; }
	.delete-node:hover { border-color: #a65562; background: #492a32; }
	.canvas { position: relative; background: #0f1520; }
	.canvas-badge { position: absolute; z-index: 5; top: 10px; right: 10px; display: flex; gap: 5px; }
	.canvas-badge span, .canvas-badge button { height: 27px; display: flex; align-items: center; gap: 5px; border: 1px solid #344053; border-radius: 4px; padding: 0 8px; color: #9daaba; background: #182130dd; font-size: 8px; font-weight: 800; }
	.canvas-badge span i { width: 6px; height: 6px; border-radius: 50%; background: #e1a72f; }
	.canvas-badge button { width: 28px; justify-content: center; padding: 0; }
	.version-history { position: absolute; z-index: 7; top: 45px; right: 10px; width: min(310px, calc(100% - 20px)); max-height: calc(100% - 65px); overflow: hidden; border: 1px solid #3b4658; border-radius: 8px; color: #dce3ed; background: #182130f5; box-shadow: 0 16px 36px #0008; backdrop-filter: blur(16px); }
	.version-history > header, .version-history > header div { display: flex; align-items: center; }
	.version-history > header { height: 42px; justify-content: space-between; padding: 0 8px 0 12px; border-bottom: 1px solid #344053; }
	.version-history > header div { gap: 7px; }
	.version-history > header strong { font-size: 10px; }
	.version-history > header button { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 5px; color: #9daaba; background: transparent; }
	.version-list { max-height: 430px; overflow-y: auto; padding: 7px; }
	.version-list article { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; padding: 10px; border-bottom: 1px solid #303b4d; }
	.version-list article:last-child { border-bottom: 0; }
	.version-heading { display: flex; align-items: center; gap: 6px; }
	.version-heading strong { color: #f1f4f8; font-size: 11px; }
	.version-heading span { padding: 3px 5px; border-radius: 8px; color: #a8c7ff; background: #274268; font-size: 7px; font-weight: 800; text-transform: uppercase; }
	.version-list time { color: #8693a5; font-size: 8px; text-align: right; }
	.version-list code { align-self: center; color: #8190a4; font-size: 8px; }
	.version-list article > button, .version-message button { min-height: 28px; display: flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid #496b9f; border-radius: 5px; padding: 0 8px; color: #cfe0ff; background: #294267; font: 700 8px/1 'Manrope', sans-serif; }
	.version-message { min-height: 70px; display: flex; align-items: center; justify-content: center; gap: 7px; margin: 0; padding: 14px; color: #8996a8; font-size: 9px; text-align: center; }
	.version-message.error { flex-direction: column; color: #e09a8d; }
	.ai-dock { position: absolute; z-index: 5; left: 50%; bottom: 16px; width: min(520px, calc(100% - 150px)); min-height: 42px; display: grid; grid-template-columns: 34px minmax(0, 1fr) 32px; align-items: center; border: 1px solid #3e4a60; border-radius: 7px; padding: 3px 5px; color: #a9bdf2; background: #192331f2; box-shadow: 0 16px 36px #0007; transform: translateX(-50%); }
	.ai-dock > span { display: grid; place-items: center; }
	.ai-dock input { min-width: 0; border: 0; outline: 0; color: #eef3fa; background: transparent; font: 600 10px/1.3 'Manrope', sans-serif; }
	.ai-dock input::placeholder { color: #748194; }
	.ai-dock button { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 4px; color: #0d1520; background: #9fbaf3; }
	.ai-dock small { grid-column: 2 / 4; padding: 2px 0 4px; color: #d3aa53; font-size: 8px; }
	.inspector { border-color: #30394a; color: #d8dee7; background: #171f2b; }
	.inspector > header { padding: 0 13px; border-color: #30394a; }
	.inspector > header strong { max-width: 230px; overflow: hidden; color: #e8edf4; font: 700 10px/1.25 'Manrope', sans-serif; text-overflow: ellipsis; white-space: nowrap; }
	.inspector > header strong small { color: #718093; font-family: monospace; }
	.inspector-tabs { height: 36px; display: flex; border-bottom: 1px solid #30394a; }
	.inspector-tabs button { flex: 1; border: 0; border-bottom: 2px solid transparent; color: #788597; background: transparent; font: 700 9px/1 'Manrope', sans-serif; }
	.inspector-tabs button.active { border-bottom-color: #829fda; color: #dce5f2; }
	.inspector-body { padding: 17px 14px; }
	.run-input { display: grid; gap: 7px; margin-bottom: 16px; color: #8894a5; font-size: 9px; font-weight: 750; text-transform: uppercase; }
	.run-input textarea { width: 100%; min-height: 92px; resize: vertical; border: 1px solid #3b4658; border-radius: 5px; padding: 9px; outline: 0; color: #dce5f2; background: #111824; font: 650 10px/1.5 monospace; text-transform: none; }
	.run-input textarea:focus { border-color: #829fda; }
	.run-history-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: #8894a5; font-size: 9px; font-weight: 750; text-transform: uppercase; }
	.run-history-head button { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #3b4658; border-radius: 5px; color: #a7b2c1; background: #202938; }
	.run-picker { display: grid; gap: 6px; margin-bottom: 12px; color: #8894a5; font-size: 9px; font-weight: 750; text-transform: uppercase; }
	.run-picker select { width: 100%; min-width: 0; border: 1px solid #3b4658; border-radius: 5px; padding: 7px 8px; color: #dce5f2; background: #111824; font: 650 9px/1.3 monospace; text-transform: none; }
	.execution-timeline { display: grid; gap: 8px; margin-bottom: 17px; padding-bottom: 14px; border-bottom: 1px solid #30394a; }
	.execution-timeline > span { color: #8894a5; font-size: 9px; font-weight: 750; text-transform: uppercase; }
	.execution-timeline strong { color: #c8d1dc; font-size: 10px; line-height: 1.45; }
	.execution-timeline small { overflow-wrap: anywhere; color: #798698; font: 650 8px/1.45 monospace; }
	.run-detail { min-width: 0; margin: 4px 0 10px; border: 1px solid #30394a; border-radius: 5px; background: #111824; }
	.run-detail summary { cursor: pointer; padding: 7px 8px; color: #98a6b9; font-size: 9px; font-weight: 750; }
	.run-detail pre { max-height: 180px; overflow: auto; margin: 0; border-top: 1px solid #30394a; padding: 8px; color: #c8d1dc; font: 650 9px/1.45 monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
	.run-detail.error { border-color: #74483f; }
	.run-detail.error summary { color: #e2a397; }
	.run-events { display: grid; gap: 7px; }
	.run-events > div { display: grid; gap: 3px; border-left: 2px solid #4f658b; padding: 6px 0 6px 9px; }
	.run-events b { overflow-wrap: anywhere; color: #d8dee7; font: 700 9px/1.35 monospace; }
	.run-events span, .run-events time, .run-empty { color: #798698; font-size: 9px; }
	.run-events time { font-family: monospace; }
	.run-empty { display: flex; align-items: center; gap: 6px; padding: 8px 0; }
	.run-empty.error { color: #d68b7e; }
	.inspector h3 { color: #f0f3f7; font-size: 17px; }
	.inspector p { color: #929dac; font-size: 11px; }
	.entrypoint code { color: #98b9ca; }
	.property-list { margin-top: 20px; border-color: #30394a; }
	.property-list > div { min-height: 39px; grid-template-columns: 68px minmax(0, 1fr); border-color: #30394a; }
	.property-list strong { color: #c8d1dc; font-size: 9px; }
	.trace { margin-top: 16px; padding: 10px; border-color: #313b4b; background: #111824; }
	.trace code { color: #9ebdce; }
	.protected { margin-top: 18px; border-color: #5a5033; color: #e5c979; background: #292517; }
	.protected span { color: #b7a770; }
	:global(.svelte-flow__edge-text) { fill: #bcc7d5; }
	:global(.svelte-flow__edge-textbg) { fill: #182130; }
	:global(.svelte-flow__background-pattern) { fill: #2b3547; }
	:global(.svelte-flow__controls) { border-color: #3c4758; box-shadow: 0 5px 16px #0005; }
	:global(.svelte-flow__controls-button) { border-bottom-color: #3b4555; color: #bdc7d4; background: #202938; }
	:global(.svelte-flow__minimap) { border-color: #3c4758; background: #151d29; }

	@media (max-width: 760px) {
		.editor-actions { width: 100%; overflow-x: auto; }
		.draft-state { margin-right: auto; }
		.workflow-summary.scenario-heading { min-height: 62px; }
		.workflow-summary.scenario-heading p, .workflow-summary .legend { display: none; }
		.workflow-identity select { width: min(270px, 68vw); }
		.node-palette.process-catalog { border-right: 0; border-bottom-color: #30394a; }
		.node-palette.process-catalog > header, .palette-foot { display: none; }
		.approval-inbox { display: none; }
		.node-palette.process-catalog nav { height: 62px; }
		.node-palette.process-catalog button { width: auto; min-height: 36px; margin: 0; }
		.node-palette.process-catalog button small, .node-palette.process-catalog button > :global(svg) { display: none; }
		.ai-dock { width: calc(100% - 90px); }
		.inspector { border-top-color: #30394a; }
	}

	/* Light iOS-inspired editing surface with Corezoid-style operational hierarchy. */
	.engine-shell { border-color: rgb(60 60 67 / 16%); background: #f2f2f7; box-shadow: 0 16px 42px rgb(0 0 0 / 7%); }
	.canvas-toolbar { border-color: rgb(60 60 67 / 12%); color: #3a3a3c; background: rgb(255 255 255 / 92%); backdrop-filter: saturate(180%) blur(20px); }
	.workflow-logo { border-radius: 9px; color: #fff; background: #007aff; box-shadow: 0 4px 12px rgb(0 122 255 / 24%); }
	.workflow-identity > div > span { color: #8e8e93; }
	.workflow-identity select { color: #1d1d1f; }
	.editor-actions button { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #3a3a3c; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }
	.editor-actions button:not(:disabled):hover { border-color: rgb(0 122 255 / 35%); color: #007aff; background: #f7fbff; }
	.editor-actions .publish { color: #aeaeb2; background: #f2f2f7; }
	.draft-state { color: #6e6e73; }
	.draft-state i { background: #ff9f0a; }
	.workflow-summary.scenario-heading { border-color: rgb(60 60 67 / 10%); color: #6e6e73; background: #fafafa; }
	.workflow-summary.scenario-heading p { color: #8e8e93; }
	.breadcrumbs strong { color: #1d1d1f; }
	.breadcrumbs b { color: #c7c7cc; }
	.revision { color: #636366; background: #e9e9ed; }
	.legend { color: #8e8e93; }
	.node-palette.process-catalog { border-color: rgb(60 60 67 / 12%); color: #1d1d1f; background: #f7f7f9; }
	.node-palette.process-catalog > header { border-color: rgb(60 60 67 / 10%); background: rgb(255 255 255 / 72%); }
	.process-search { border-color: rgb(60 60 67 / 10%); color: #8e8e93; }
	.process-search input { border-color: transparent; border-radius: 9px; color: #1d1d1f; background: #e9e9ed; }
	.process-search input:focus { border-color: rgb(0 122 255 / 42%); background: #fff; box-shadow: 0 0 0 3px rgb(0 122 255 / 12%); }
	.process-search input::placeholder { color: #8e8e93; }
	.node-palette.process-catalog h3 { color: #8e8e93; }
	.node-palette.process-catalog button { border-color: rgb(60 60 67 / 11%); border-radius: 9px; color: #3a3a3c; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 3%); }
	.node-palette.process-catalog button small { color: #8e8e93; }
	.node-palette.process-catalog button:hover { border-color: rgb(0 122 255 / 34%); color: #1d1d1f; background: #f5f9ff; box-shadow: 0 3px 10px rgb(0 122 255 / 8%); }
	.palette-icon { border-radius: 7px; color: #007aff; background: #e6f2ff; }
	.palette-foot { border-color: rgb(60 60 67 / 10%); color: #8e8e93; background: rgb(255 255 255 / 65%); }
	.canvas { background: #f5f5f7; }
	.canvas-badge span, .canvas-badge button { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #636366; background: rgb(255 255 255 / 88%); box-shadow: 0 3px 12px rgb(0 0 0 / 7%); backdrop-filter: blur(16px); }
	.canvas-badge span i { background: #ff9f0a; }
	.version-history { border-color: rgb(60 60 67 / 16%); color: #1d1d1f; background: rgb(255 255 255 / 94%); box-shadow: 0 16px 38px rgb(0 0 0 / 16%); }
	.version-history > header { border-color: rgb(60 60 67 / 10%); }
	.version-history > header button { color: #6e6e73; }
	.version-list article { border-color: rgb(60 60 67 / 10%); }
	.version-heading strong { color: #1d1d1f; }
	.version-heading span { color: #0064d2; background: #e6f2ff; }
	.version-list time, .version-list code, .version-message { color: #8e8e93; }
	.version-list article > button, .version-message button { border-color: rgb(0 122 255 / 24%); color: #006fe8; background: #edf6ff; }
	.version-message.error { color: #b54838; }
	.ai-dock { border-color: rgb(60 60 67 / 18%); border-radius: 13px; color: #007aff; background: rgb(255 255 255 / 92%); box-shadow: 0 12px 34px rgb(0 0 0 / 13%); backdrop-filter: saturate(180%) blur(20px); }
	.ai-dock input { color: #1d1d1f; }
	.ai-dock input::placeholder { color: #8e8e93; }
	.ai-dock button { border-radius: 9px; color: #fff; background: #007aff; }
	.ai-dock small { color: #9a5b00; }
	.inspector { border-color: rgb(60 60 67 / 12%); color: #1d1d1f; background: #f7f7f9; }
	.inspector > header { border-color: rgb(60 60 67 / 10%); background: rgb(255 255 255 / 72%); }
	.inspector > header strong { color: #1d1d1f; }
	.inspector > header strong small { color: #8e8e93; }
	.inspector-tabs { border-color: rgb(60 60 67 / 10%); padding: 4px; background: #e9e9ed; }
	.inspector-tabs button { border: 0; border-radius: 7px; color: #6e6e73; }
	.inspector-tabs button.active { border: 0; color: #1d1d1f; background: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 12%); }
	.run-input { color: #8e8e93; }
	.run-input textarea { border-color: rgb(60 60 67 / 14%); border-radius: 9px; color: #1d1d1f; background: #fff; }
	.run-input textarea:focus { border-color: rgb(0 122 255 / 42%); box-shadow: 0 0 0 3px rgb(0 122 255 / 12%); }
	.run-history-head { color: #8e8e93; }
	.run-history-head button { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #007aff; background: #fff; }
	.run-picker { color: #8e8e93; }
	.run-picker select { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #1d1d1f; background: #fff; }
	.execution-timeline { border-color: rgb(60 60 67 / 10%); }
	.execution-timeline > span, .execution-timeline small { color: #8e8e93; }
	.run-events > div { border-color: #007aff; }
	.run-events b { color: #3a3a3c; }
	.run-events span, .run-events time, .run-empty { color: #8e8e93; }
	.run-empty.error { color: #b54838; }
	.inspector h3 { color: #1d1d1f; }
	.inspector p { color: #6e6e73; }
	.entrypoint code { color: #00718a; }
	.property-list, .property-list > div { border-color: rgb(60 60 67 / 10%); }
	.property-list strong { color: #3a3a3c; }
	.trace { border-color: rgb(60 60 67 / 11%); border-radius: 10px; background: #fff; }
	.trace code { color: #146079; }
	.protected { border-color: #f1d18d; border-radius: 10px; color: #7a5600; background: #fff8e8; }
	.protected span { color: #8a7445; }
	:global(.svelte-flow__edge-text) { fill: #636366; }
	:global(.svelte-flow__edge-textbg) { fill: #fff; }
	:global(.svelte-flow__background-pattern) { fill: #c7c7cc; }
	:global(.svelte-flow__controls) { border-color: rgb(60 60 67 / 16%); border-radius: 10px; box-shadow: 0 6px 18px rgb(0 0 0 / 10%); }
	:global(.svelte-flow__controls-button) { border-bottom-color: rgb(60 60 67 / 10%); color: #3a3a3c; background: rgb(255 255 255 / 94%); }
	:global(.svelte-flow__minimap) { border-color: rgb(60 60 67 / 16%); border-radius: 10px; background: rgb(255 255 255 / 92%); box-shadow: 0 6px 18px rgb(0 0 0 / 8%); }

	@media (max-width: 760px) {
		.node-palette.process-catalog { border-bottom-color: rgb(60 60 67 / 12%); }
		.inspector { border-top-color: rgb(60 60 67 / 12%); }
		.version-history { top: 43px; max-height: 375px; }
	}
</style>