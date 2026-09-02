<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Archive,
		Bot,
		Boxes,
		Braces,
		CalendarClock,
		Check,
		ChevronDown,
		ChevronRight,
		CirclePause,
		ClipboardPaste,
		Clock3,
		Code2,
		Copy,
		Database,
		FileInput,
		FileOutput,
		FileUp,
		FolderTree,
		GitBranch,
		Globe2,
		History,
		KeyRound,
		LoaderCircle,
		LockKeyhole,
		MailCheck,
		PanelRightClose,
		Play,
		Redo2,
		RefreshCcw,
		Search,
		ShieldCheck,
		Shuffle,
		Sparkles,
		SquareFunction,
		Timer,
		Trash2,
		Undo2,
		Upload,
		Webhook,
		Workflow,
		XCircle
	} from '@lucide/svelte';
	import {
		Background,
		BackgroundVariant,
		Controls,
		MarkerType,
		MiniMap,
		SvelteFlow,
		type Edge,
		type Node,
		type NodeTypes,
		type Viewport
	} from '@xyflow/svelte';
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
	import {
		canPublishProcess,
		canRunProcess,
		parseRunInput,
		type CorexCommandState
	} from './process-command-state';
	import { CorexCommandError, type CorexStartedRun } from './corex-command-gateway';
	import { getCorexCommandGateway, getCorexProcessGateway } from './corex-process-browser';
	import {
		CorexDraftConflictError,
		type CorexApprovalTask,
		type CorexProcess,
		type CorexProcessVersion,
		type CorexRun,
		type CorexRunEvent,
		type CorexStepAttempt
	} from './corex-process-gateway';
	import { restoreVersionAsDraft } from './process-version-history';
	import { formatRunDetail, summarizeRunEvents } from './run-inspector';
	import ReleaseFlowNode from './ReleaseFlowNode.svelte';
	import StickyNoteNode from './StickyNoteNode.svelte';
	import JsonTreeViewer from './JsonTreeViewer.svelte';
	import CanvasControlsOverlay from './CanvasControlsOverlay.svelte';
	import type { FlowEdge, FlowNode, FlowScenario } from './types';

	const nodeTypes: NodeTypes = { release: ReleaseFlowNode, stickyNote: StickyNoteNode };
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
	let activeScenario = $derived(
		scenarios.find((scenario) => scenario.id === activeScenarioId) ?? executableScenario
	);
	let isExecutableDraft = $derived(activeScenarioId === draftDefinition.id);
	type StickyNoteItem = {
		id: string;
		title: string;
		text: string;
		color: 'yellow' | 'blue' | 'green' | 'purple';
		position: { x: number; y: number };
		author: string;
	};
	let stickyNotes = $state<StickyNoteItem[]>([]);

	function addStickyNote(color: 'yellow' | 'blue' | 'green' | 'purple' = 'yellow') {
		const id = `note-${Date.now()}`;
		const note: StickyNoteItem = {
			id,
			title: locale === 'uk' ? 'Нотатка' : 'Note',
			text: locale === 'uk' ? 'Коментар архітектора...' : 'Architect note...',
			color,
			position: { x: 100 + Math.random() * 80, y: 120 + Math.random() * 80 },
			author: 'Architect'
		};
		stickyNotes = [...stickyNotes, note];
		nodes = createNodes(activeScenario, locale);
	}

	function deleteStickyNote(id: string) {
		stickyNotes = stickyNotes.filter((n) => n.id !== id);
		nodes = createNodes(activeScenario, locale);
	}

	function updateStickyNote(id: string, text: string) {
		stickyNotes = stickyNotes.map((n) => (n.id === id ? { ...n, text } : n));
	}

	function createNodes(scenario: FlowScenario, nodeLocale: CorexLocale): Node[] {
		const flowNodes = scenario.nodes.map((item) => ({
			id: item.id,
			type: 'release',
			position: item.position,
			data: { ...item, locale: nodeLocale }
		}));
		const noteNodes = stickyNotes.map((note) => ({
			id: note.id,
			type: 'stickyNote',
			position: note.position,
			data: {
				...note,
				onDelete: deleteStickyNote,
				onUpdate: updateStickyNote
			}
		}));
		return [...flowNodes, ...noteNodes];
	}

	function createEdges(scenario: FlowScenario): Edge[] {
		return scenario.edges.map((edge: FlowEdge) => {
			const isSourceRunning =
				scenario.nodes.find((node) => node.id === edge.source)?.status === 'running';
			const strokeColor =
				edge.tone === 'danger'
					? '#f87171'
					: edge.tone === 'success'
						? '#4ade80'
						: isSourceRunning
							? '#38bdf8'
							: '#64748b';
			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				label: edge.label,
				type: 'smoothstep',
				animated: isSourceRunning,
				markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
				style: `stroke: ${strokeColor}; stroke-width: ${isSourceRunning ? '2.2px' : '1.8px'}; ${isSourceRunning ? 'filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));' : ''}`
			};
		});
	}

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
	let runCancelling = $state(false);
	let runRestarting = $state(false);
	let runRollingBack = $state(false);
	let runArchiving = $state(false);
	let runLifecycleAction = $state<'' | 'pause' | 'resume'>('');
	let lastRun = $state<CorexStartedRun | null>(null);
	let runs = $state<CorexRun[]>([]);
	let selectedRunId = $state('');
	let runEvents = $state<CorexRunEvent[]>([]);
	let stepAttempts = $state<CorexStepAttempt[]>([]);
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
	let selectedRunRollbackError = $derived(formatRunDetail(selectedRun?.rollbackError));
	let activeApproval = $derived.by(() => {
		if (selectedRun?.status !== 'waiting') return null;
		const latest = runEvents.at(-1);
		if (
			latest?.eventType !== 'step_started' ||
			typeof latest.payload !== 'object' ||
			latest.payload === null
		)
			return null;
		const payload = latest.payload as Record<string, unknown>;
		return payload.stepType === 'approval' && payload.assigneeUserId === ownerUserId
			? latest
			: null;
	});
	let activeApprovalTask = $derived.by(() => {
		if (!selectedRun || !activeApproval) return null;
		return approvalTasks.find(
			(task) =>
				task.runId === selectedRun.id &&
				task.executionGeneration === selectedRun.executionGeneration &&
				task.stepName === activeApproval.stepName &&
				task.status === 'pending'
		) ?? null;
	});
	let publishEnabled = $derived(
		canPublishProcess({
			hasGateway: Boolean(commandGateway),
			hasProcess: Boolean(activeProcess),
			draftDirty,
			validationValid: validationResult?.valid === true,
			commandState
		})
	);
	let runEnabled = $derived(
		canRunProcess({
			hasGateway: Boolean(commandGateway),
			hasPublishedVersion: Boolean(activeProcess?.publishedVersion),
			draftDirty,
			commandState
		})
	);
	let selectedNode = $derived(
		activeScenario.nodes.find((node) => node.id === selectedId) ?? activeScenario.nodes[0]
	);
	let selectedDefinitionNode = $derived(
		isExecutableDraft ? draftDefinition.nodes.find((node) => node.id === selectedId) : undefined
	);
	let selectedDefinitionNodes = $derived(
		isExecutableDraft
			? draftDefinition.nodes.filter((node) => selectedNodeIds.includes(node.id))
			: []
	);
	let selectionHasProtectedNodes = $derived(
		selectedDefinitionNodes.some((node) =>
			['trigger-http', 'loop', 'parallel', 'parallel-join', 'end-success'].includes(node.type)
		)
	);
	let selectionHasNonCopyableNodes = $derived(
		selectedDefinitionNodes.some((node) =>
			['trigger-http', 'loop', 'break', 'parallel', 'parallel-join', 'end-success', 'end-failure'].includes(
				node.type
			)
		)
	);
	let text = $derived(canvasText[locale]);
	let activeCopy = $derived(localizedScenario(activeScenario, locale));
	const paletteGroups = [
		{
			label: 'Тригери',
			items: [
				{ label: 'Webhook / API', api: 'fetch → workflow.create()', icon: Webhook },
				{ label: 'Розклад', api: 'workflow schedules / cron', icon: CalendarClock },
				{ label: 'Подія', api: 'queue / binding → create()', icon: Sparkles }
			]
		},
		{
			label: 'Маршрутизація',
			items: [
				{ label: 'Умова', api: 'if / else', icon: GitBranch, nodeType: 'condition' as const },
				{ label: 'Switch', api: 'switch', icon: Workflow, nodeType: 'switch' as const },
				{ label: 'Цикл', api: 'bounded for / while', icon: RefreshCcw, nodeType: 'loop' as const },
				{ label: 'Паралельно', api: 'Promise.all()', icon: Boxes, nodeType: 'parallel' as const },
				{ label: 'A/B Router', api: 'step.do() → deterministic branch', icon: Shuffle }
			]
		},
		{
			label: 'Durable очікування',
			items: [
				{ label: 'Затримка', api: 'step.sleep()', icon: Timer, nodeType: 'wait' as const },
				{
					label: 'До дати',
					api: 'step.sleepUntil()',
					icon: Clock3,
					nodeType: 'wait-until' as const
				},
				{
					label: 'Очікувати подію',
					api: 'step.waitForEvent()',
					icon: Webhook,
					nodeType: 'wait-event' as const
				},
				{
					label: 'Ручне погодження',
					api: 'waitForEvent() + dashboard',
					icon: MailCheck,
					nodeType: 'approval' as const
				}
			]
		},
		{
			label: 'Дані',
			items: [
				{ label: 'DB Read', api: 'step.do() → SELECT', icon: Database },
				{ label: 'DB Write', api: 'step.do() → INSERT / UPDATE', icon: Database },
				{ label: 'KV Get', api: 'step.do() → KV.get()', icon: KeyRound },
				{ label: 'KV Set', api: 'step.do() → KV.put()', icon: KeyRound },
				{
					label: 'Перетворення даних',
					api: 'step.do() → serializable output',
					icon: Braces,
					nodeType: 'transform' as const
				}
			]
		},
		{
			label: 'Інтеграції',
			items: [
				{
					label: 'HTTP Request',
					api: 'step.do() → fetch()',
					icon: Globe2,
					nodeType: 'http-request' as const
				},
				{
					label: 'Виклик підпроцесу',
					api: 'create() → waitForEvent()',
					icon: SquareFunction,
					nodeType: 'invoke-process' as const
				}
			]
		},
		{
			label: 'Стійкість',
			items: [{ label: 'Try / Catch', api: 'try / catch', icon: ShieldCheck }]
		},
		{
			label: 'Завершення',
			items: [
				{ label: 'Успішне завершення', api: 'return serializable output', icon: FileOutput },
				{
					label: 'Abort / Fail',
					api: 'sanitized run_failed',
					icon: XCircle,
					nodeType: 'end-failure' as const
				}
			]
		},
		{
			label: 'Структура',
			items: [
				{ label: 'Функція', api: 'FunctionDef / Call', icon: Braces },
				{ label: 'Група кроків', api: 'BlockNode', icon: FolderTree },
				{ label: 'Вийти з циклу', api: 'break', icon: PanelRightClose, nodeType: 'break' as const }
			]
		}
	];
	let filteredPalette = $derived(
		paletteGroups
			.map((group) => ({
				...group,
				items: group.items.filter((item) =>
					`${item.label} ${item.api}`.toLowerCase().includes(paletteQuery.trim().toLowerCase())
				)
			}))
			.filter((group) => group.items.length)
	);

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
		stepAttempts = [];
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
			versionHistoryError =
				locale === 'uk' ? 'Не вдалося завантажити версії.' : 'Could not load versions.';
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
		commandNotice =
			locale === 'uk'
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
			const nextRunId =
				preferredRunId && loadedRuns.some((run) => run.id === preferredRunId)
					? preferredRunId
					: (loadedRuns[0]?.id ?? '');
			selectedRunId = nextRunId;
			const [loadedEvents, loadedAttempts] = nextRunId
				? await Promise.all([
						processGateway.listRunEvents(nextRunId),
						processGateway.listStepAttempts(nextRunId)
					])
				: [[], []];
			if (request !== runHistoryRequest || activeProcess?.id !== processId) return;
			runEvents = loadedEvents;
			stepAttempts = loadedAttempts;
		} catch {
			if (request !== runHistoryRequest) return;
			runHistoryError =
				locale === 'uk'
					? 'Не вдалося завантажити історію запусків.'
					: 'Could not load run history.';
		} finally {
			if (request === runHistoryRequest) runHistoryState = 'idle';
		}
	}

	async function loadApprovalTasks() {
		if (!processGateway) return;
		try {
			approvalTasks = await processGateway.listApprovalTasks(ownerUserId);
		} catch {
			persistenceError =
				locale === 'uk' ? 'Не вдалося завантажити погодження.' : 'Could not load approvals.';
		}
	}

	async function selectRun(runId: string) {
		if (!processGateway || !activeProcess || (runId === selectedRunId && runEvents.length > 0))
			return;
		const request = ++runHistoryRequest;
		selectedRunId = runId;
		runHistoryState = 'loading';
		runHistoryError = '';
		try {
			const [loadedEvents, loadedAttempts] = await Promise.all([
				processGateway.listRunEvents(runId),
				processGateway.listStepAttempts(runId)
			]);
			if (request === runHistoryRequest && selectedRunId === runId) {
				runEvents = loadedEvents;
				stepAttempts = loadedAttempts;
			}
		} catch {
			if (request === runHistoryRequest)
				runHistoryError =
					locale === 'uk' ? 'Не вдалося завантажити події запуску.' : 'Could not load run events.';
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
		return (
			draftDefinition.id
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'untitled-process'
		);
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
			persistenceError =
				error instanceof CorexDraftConflictError
					? locale === 'uk'
						? 'Чернетку змінено в іншій сесії. Оновіть сторінку.'
						: 'The draft changed in another session. Reload the page.'
					: locale === 'uk'
						? 'Не вдалося зберегти чернетку.'
						: 'Could not save the draft.';
		} finally {
			persistenceState = 'idle';
		}
	}

	function validateDraft() {
		if (!isExecutableDraft) return;
		validationResult = validateProcessDefinition(draftDefinition);
	}

	function commandErrorMessage(error: unknown): string {
		if (!(error instanceof CorexCommandError))
			return locale === 'uk' ? 'Команда не виконана.' : 'The command failed.';
		const messages =
			locale === 'uk'
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
			const updatedProcess: CorexProcess = {
				...activeProcess,
				lifecycle: 'published',
				publishedVersion: published.version
			};
			activeProcess = updatedProcess;
			persistedProcesses = persistedProcesses.map((process) =>
				process.id === updatedProcess.id ? updatedProcess : process
			);
			commandNotice =
				locale === 'uk'
					? `Опубліковано версію ${published.version}.`
					: `Published version ${published.version}.`;
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
			commandNotice =
				locale === 'uk' ? 'Input має бути коректним JSON.' : 'Input must be valid JSON.';
			return;
		}
		commandState = 'running';
		commandNotice = '';
		try {
			lastRun = await commandGateway.start(activeProcess.id, parsedInput.value);
			inspectorTab = 'runs';
			commandNotice =
				locale === 'uk' ? `Запуск ${lastRun.id} створено.` : `Run ${lastRun.id} created.`;
			await loadRunHistory(activeProcess.id, lastRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			commandState = 'idle';
		}
	}

	async function sendRunEvent() {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runLifecycleAction ||
			!runEventType.trim()
		)
			return;
		const parsedPayload = parseRunInput(runEventPayload);
		if (!parsedPayload.ok) {
			commandNotice =
				locale === 'uk'
					? 'Payload події має бути коректним JSON.'
					: 'Event payload must be valid JSON.';
			return;
		}
		eventSending = true;
		commandNotice = '';
		try {
			await commandGateway.signalExternal(selectedRun.id, runEventType.trim(), parsedPayload.value);
			commandNotice =
				locale === 'uk'
					? `Подію ${runEventType.trim()} надіслано.`
					: `Event ${runEventType.trim()} sent.`;
			await loadRunHistory(activeProcess.id, selectedRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			eventSending = false;
		}
	}

	async function decideApproval(decision: 'approved' | 'rejected') {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			!activeApproval ||
			!activeApprovalTask ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runLifecycleAction
		)
			return;
		eventSending = true;
		commandNotice = '';
		try {
			await commandGateway.decideApproval(selectedRun.id, {
				taskId: activeApprovalTask.id,
				decision,
				...(approvalComment.trim() ? { comment: approvalComment.trim() } : {})
			});
			commandNotice =
				decision === 'approved'
					? locale === 'uk'
						? 'Рішення погоджено.'
						: 'Decision approved.'
					: locale === 'uk'
						? 'Рішення відхилено.'
						: 'Decision rejected.';
			approvalComment = '';
			await loadRunHistory(activeProcess.id, selectedRun.id);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			eventSending = false;
		}
	}

	async function cancelRun() {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runLifecycleAction
		)
			return;
		const processId = activeProcess.id;
		const runId = selectedRun.id;
		runCancelling = true;
		commandNotice = '';
		try {
			await commandGateway.cancel(runId, crypto.randomUUID());
			commandNotice =
				locale === 'uk'
					? `Скасування запуску ${runId} прийнято.`
					: `Cancellation accepted for run ${runId}.`;
			await loadRunHistory(processId, runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			runCancelling = false;
		}
	}

	async function changeRunLifecycle(action: 'pause' | 'resume') {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runLifecycleAction
		)
			return;
		const processId = activeProcess.id;
		const runId = selectedRun.id;
		runLifecycleAction = action;
		commandNotice = '';
		try {
			await commandGateway[action](runId, crypto.randomUUID());
			commandNotice =
				action === 'pause'
					? locale === 'uk'
						? `Призупинення запуску ${runId} прийнято.`
						: `Pause accepted for run ${runId}.`
					: locale === 'uk'
						? `Відновлення запуску ${runId} прийнято.`
						: `Resume accepted for run ${runId}.`;
			await loadRunHistory(processId, runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			runLifecycleAction = '';
		}
	}

	async function restartRun() {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runArchiving ||
			runLifecycleAction ||
			!['complete', 'errored', 'terminated'].includes(selectedRun.status)
		)
			return;
		const processId = activeProcess.id;
		const runId = selectedRun.id;
		runRestarting = true;
		commandNotice = '';
		try {
			await commandGateway.restart(runId, crypto.randomUUID());
			commandNotice =
				locale === 'uk' ? `Перезапуск ${runId} прийнято.` : `Restart accepted for run ${runId}.`;
			await loadRunHistory(processId, runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			runRestarting = false;
		}
	}

	async function rollbackRun() {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runLifecycleAction ||
			!['queued', 'running', 'waiting', 'waiting_for_pause', 'paused'].includes(selectedRun.status)
		)
			return;
		const processId = activeProcess.id;
		const runId = selectedRun.id;
		runRollingBack = true;
		commandNotice = '';
		try {
			await commandGateway.rollback(runId, crypto.randomUUID());
			commandNotice =
				locale === 'uk'
					? `Відкат запуску ${runId} прийнято.`
					: `Rollback accepted for run ${runId}.`;
			await loadRunHistory(processId, runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			runRollingBack = false;
		}
	}

	async function archiveRun() {
		if (
			!commandGateway ||
			!activeProcess ||
			!selectedRun ||
			selectedRun.archivedAt ||
			eventSending ||
			runCancelling ||
			runRestarting ||
			runRollingBack ||
			runArchiving ||
			runLifecycleAction ||
			!['complete', 'errored', 'terminated'].includes(selectedRun.status)
		)
			return;
		const processId = activeProcess.id;
		const runId = selectedRun.id;
		runArchiving = true;
		commandNotice = '';
		try {
			await commandGateway.archive(runId, crypto.randomUUID());
			commandNotice = locale === 'uk' ? `Запуск ${runId} архівовано.` : `Run ${runId} archived.`;
			await loadRunHistory(processId, runId);
		} catch (error) {
			commandNotice = commandErrorMessage(error);
		} finally {
			runArchiving = false;
		}
	}

	async function decideApprovalTask(task: CorexApprovalTask, decision: 'approved' | 'rejected') {
		if (!commandGateway || task.status !== 'pending' || approvalTaskSendingId) return;
		approvalTaskSendingId = task.id;
		commandNotice = '';
		try {
			const comment = approvalTaskComments[task.id]?.trim();
			await commandGateway.decideApproval(task.runId, {
				taskId: task.id,
				decision,
				...(comment ? { comment } : {})
			});
			commandNotice =
				decision === 'approved'
					? locale === 'uk'
						? 'Рішення погоджено.'
						: 'Decision approved.'
					: locale === 'uk'
						? 'Рішення відхилено.'
						: 'Decision rejected.';
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
			nodes: draftDefinition.nodes.map((node) =>
				node.id === selectedDefinitionNode?.id ? update(node) : node
			)
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

	function formatLocalDateTime(timestamp: string): string {
		const date = new Date(timestamp);
		if (!Number.isFinite(date.getTime())) return '';
		const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return offsetDate.toISOString().slice(0, 16);
	}

	function updateTransformMappings(value: string) {
		try {
			const mappings = JSON.parse(value) as unknown;
			if (
				typeof mappings !== 'object' ||
				mappings === null ||
				Array.isArray(mappings) ||
				Object.values(mappings).some((path) => typeof path !== 'string')
			)
				return;
			updateSelectedDefinitionNode((node) =>
				node.type === 'transform'
					? { ...node, config: { ...node.config, mappings: mappings as Record<string, string> } }
					: node
			);
		} catch {
			// Keep malformed JSON local to the input until it becomes a valid mapping object.
		}
	}

	function updateSelectedOutputMode(mode: 'metadata' | 'inline') {
		updateSelectedDefinitionNode((node) => {
			if (node.type === 'http-request') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy:
							mode === 'inline'
								? { mode, maxBytes: node.config.outputPolicy?.maxBytes ?? 16_384 }
								: undefined
					}
				};
			}
			if (node.type === 'transform') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy:
							mode === 'inline'
								? { mode, maxBytes: node.config.outputPolicy?.maxBytes ?? 16_384 }
								: undefined
					}
				};
			}
			return node;
		});
	}

	function updateSelectedOutputLimit(maxBytes: number) {
		updateSelectedDefinitionNode((node) => {
			if (node.type === 'http-request' && node.config.outputPolicy?.mode === 'inline') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy: { ...node.config.outputPolicy, maxBytes }
					}
				};
			}
			if (node.type === 'transform' && node.config.outputPolicy?.mode === 'inline') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy: { ...node.config.outputPolicy, maxBytes }
					}
				};
			}
			return node;
		});
	}

	function updateSelectedOutputRedactPaths(value: string) {
		const redactPaths = value
			.split(/\r?\n/)
			.map((path) => path.trim())
			.filter(Boolean);
		updateSelectedDefinitionNode((node) => {
			if (node.type === 'http-request' && node.config.outputPolicy?.mode === 'inline') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy: {
							...node.config.outputPolicy,
							redactPaths: redactPaths.length ? redactPaths : undefined
						}
					}
				};
			}
			if (node.type === 'transform' && node.config.outputPolicy?.mode === 'inline') {
				return {
					...node,
					config: {
						...node.config,
						outputPolicy: {
							...node.config.outputPolicy,
							redactPaths: redactPaths.length ? redactPaths : undefined
						}
					}
				};
			}
			return node;
		});
	}

	function updateParallelBranch(index: number, branchId: string) {
		if (!isExecutableDraft || selectedDefinitionNode?.type !== 'parallel') return;
		const previousId = selectedDefinitionNode.config.branches[index]?.id;
		if (!previousId) return;
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.map((node) =>
				node.id === selectedDefinitionNode?.id && node.type === 'parallel'
					? {
							...node,
							config: {
								...node.config,
								branches: node.config.branches.map((branch, branchIndex) =>
									branchIndex === index ? { id: branchId } : branch
								)
							}
						}
					: node
			),
			edges: draftDefinition.edges.map((edge) =>
				edge.source === selectedDefinitionNode?.id && edge.parallel === previousId
					? { ...edge, parallel: branchId }
					: edge
			)
		});
	}

	type SupportedNodeType =
		| 'http-request'
		| 'condition'
		| 'switch'
		| 'loop'
		| 'break'
		| 'parallel'
		| 'wait'
		| 'wait-until'
		| 'wait-event'
		| 'approval'
		| 'transform'
		| 'invoke-process'
		| 'end-failure';

	function addSupportedNode(type: SupportedNodeType, droppedPosition?: { x: number; y: number }) {
		if (!isExecutableDraft) return;
		const terminal =
			selectedDefinitionNode?.type === 'end-success'
				? selectedDefinitionNode
				: draftDefinition.nodes.find((node) => node.type === 'end-success');
		if (!terminal) return;
		const suffix = crypto.randomUUID().slice(0, 8);
		const id = `${type}-${suffix}`;
		const position = droppedPosition ?? { x: terminal.position.x - 280, y: terminal.position.y };
		if (type === 'end-failure') {
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					{
						id,
						name: `fail-${suffix}`,
						type,
						position,
						config: { code: 'process_failed', message: 'The process ended with a controlled failure.' }
					}
				]
			});
			selectedId = id;
			return;
		}
		if (type === 'break') {
			const loop =
				selectedDefinitionNode?.type === 'loop'
					? selectedDefinitionNode
					: draftDefinition.nodes.find((candidate) => candidate.type === 'loop');
			if (!loop) return;
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					{
						id,
						name: `break-${suffix}`,
						type,
						position,
						config: { loopId: loop.id }
					}
				]
			});
			selectedId = id;
			return;
		}
		if (type === 'parallel') {
			const joinId = `parallel-join-${suffix}`;
			const riskId = `parallel-risk-${suffix}`;
			const receiptId = `parallel-receipt-${suffix}`;
			const incoming = draftDefinition.edges.filter((edge) => edge.target === terminal.id);
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					{
						id,
						name: `parallel-${suffix}`,
						type,
						position,
						config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'parallelResults' }
					},
					{
						id: riskId,
						name: `risk-${suffix}`,
						type: 'transform',
						position: { x: position.x + 280, y: position.y - 140 },
						config: { mode: 'merge', mappings: { value: '$.value' } }
					},
					{
						id: receiptId,
						name: `receipt-${suffix}`,
						type: 'transform',
						position: { x: position.x + 280, y: position.y + 140 },
						config: { mode: 'merge', mappings: { value: '$.value' } }
					},
					{
						id: joinId,
						name: `parallel-join-${suffix}`,
						type: 'parallel-join',
						position: { x: position.x + 560, y: position.y },
						config: { parallelId: id }
					}
				],
				edges: [
					...draftDefinition.edges.filter((edge) => edge.target !== terminal.id),
					...incoming.map((edge) => ({ ...edge, target: id })),
					{ id: `${id}-risk`, source: id, target: riskId, parallel: 'risk' },
					{ id: `${id}-receipt`, source: id, target: receiptId, parallel: 'receipt' },
					{ id: `${riskId}-${joinId}`, source: riskId, target: joinId },
					{ id: `${receiptId}-${joinId}`, source: receiptId, target: joinId },
					{ id: `${joinId}-next`, source: joinId, target: terminal.id }
				]
			});
			selectedId = id;
			return;
		}
		const node: ProcessNode =
			type === 'http-request'
				? {
						id,
						name: `http-request-${suffix}`,
						type,
						position,
						config: {
							method: 'POST',
							url: 'https://api.example.com/action',
							timeoutMs: 30_000,
							retry: { limit: 3, backoff: 'exponential' },
							idempotencyKey: '$.id'
						}
					}
				: type === 'condition'
					? {
							id,
							name: `condition-${suffix}`,
							type,
							position,
							config: { path: '$.value', operator: 'exists' }
						}
					: type === 'switch'
						? {
								id,
								name: `switch-${suffix}`,
								type,
								position,
								config: {
									path: '$.value',
									cases: [
										{ id: 'case-a', value: 'A' },
										{ id: 'case-b', value: 'B' }
									]
								}
							}
					: type === 'loop'
						? {
								id,
								name: `loop-${suffix}`,
								type,
								position,
								config: { maxIterations: 10 }
							}
					: type === 'wait'
						? { id, name: `wait-${suffix}`, type, position, config: { durationMs: 1_000 } }
						: type === 'wait-until'
							? {
									id,
									name: `wait-until-${suffix}`,
									type,
									position,
									config: { timestamp: new Date(Date.now() + 3_600_000).toISOString() }
								}
							: type === 'wait-event'
								? {
										id,
										name: `wait-event-${suffix}`,
										type,
										position,
										config: {
											eventType: 'process-event',
											timeoutMs: 86_400_000,
											resultKey: 'event'
										}
									}
								: type === 'approval'
									? {
											id,
											name: `approval-${suffix}`,
											type,
											position,
											config: {
												assigneeUserId: ownerUserId,
												timeoutMs: 86_400_000,
												resultKey: 'approval'
											}
										}
									: type === 'invoke-process'
										? {
												id,
												name: `invoke-process-${suffix}`,
												type,
												position,
												config: {
													processId:
														persistedProcesses.find((process) => process.publishedVersion !== null)
															?.id ?? '',
													inputPath: '$',
													resultKey: 'subprocess',
													timeoutMs: 86_400_000
												}
											}
										: {
												id,
												name: `transform-${suffix}`,
												type,
												position,
												config: { mode: 'merge', mappings: { value: '$.value' } }
											};
		const incoming = draftDefinition.edges.filter((edge) => edge.target === terminal.id);
		const retainedEdges = draftDefinition.edges.filter((edge) => edge.target !== terminal.id);
		const insertedEdges = incoming.map((edge) => ({ ...edge, target: id }));
		if (type === 'loop') {
			const bodyId = `loop-body-${suffix}`;
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					node,
					{
						id: bodyId,
						name: `loop-body-${suffix}`,
						type: 'transform',
						position: { x: position.x + 280, y: position.y - 160 },
						config: { mode: 'merge', mappings: { value: '$.value' } }
					}
				],
				edges: [
					...retainedEdges,
					...insertedEdges,
					{ id: `${id}-body`, source: id, target: bodyId, loop: 'body' },
					{ id: `${bodyId}-${id}`, source: bodyId, target: id, loopBack: id },
					{ id: `${id}-exit`, source: id, target: terminal.id, loop: 'exit' }
				]
			});
		} else if (type === 'switch') {
			const caseATerminalId = `end-case-a-${suffix}`;
			const caseBTerminalId = `end-case-b-${suffix}`;
			const defaultTerminalId = `end-default-${suffix}`;
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					node,
					{
						id: caseATerminalId,
						name: `return-case-a-${suffix}`,
						type: 'end-success',
						position: { x: terminal.position.x, y: terminal.position.y - 180 },
						config: {}
					},
					{
						id: caseBTerminalId,
						name: `return-case-b-${suffix}`,
						type: 'end-success',
						position: { x: terminal.position.x, y: terminal.position.y },
						config: {}
					},
					{
						id: defaultTerminalId,
						name: `return-default-${suffix}`,
						type: 'end-success',
						position: { x: terminal.position.x, y: terminal.position.y + 180 },
						config: {}
					}
				],
				edges: [
					...retainedEdges,
					...insertedEdges,
					{ id: `${id}-case-a`, source: id, target: caseATerminalId, case: 'case-a' },
					{ id: `${id}-case-b`, source: id, target: caseBTerminalId, case: 'case-b' },
					{ id: `${id}-default`, source: id, target: defaultTerminalId, case: 'default' }
				]
			});
		} else if (type === 'condition' || type === 'approval') {
			const alternateTerminalId =
				type === 'condition' ? `end-false-${suffix}` : `end-rejected-${suffix}`;
			commitDraft({
				...draftDefinition,
				nodes: [
					...draftDefinition.nodes,
					node,
					{
						id: alternateTerminalId,
						name: type === 'condition' ? `return-false-${suffix}` : `return-rejected-${suffix}`,
						type: 'end-success',
						position: { x: terminal.position.x, y: terminal.position.y + 180 },
						config: {}
					}
				],
				edges: [
					...retainedEdges,
					...insertedEdges,
					{ id: `${id}-true`, source: id, target: terminal.id, when: true },
					{ id: `${id}-false`, source: id, target: alternateTerminalId, when: false }
				]
			});
		} else {
			commitDraft({
				...draftDefinition,
				nodes: [...draftDefinition.nodes, node],
				edges: [
					...retainedEdges,
					...insertedEdges,
					{ id: `${id}-next`, source: id, target: terminal.id }
				]
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
		if (!isExecutableDraft || !event.dataTransfer?.types.includes('application/corex-node-type'))
			return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function dropPaletteNode(event: DragEvent) {
		if (!isExecutableDraft || !event.dataTransfer) return;
		const type = event.dataTransfer.getData('application/corex-node-type') as SupportedNodeType;
		if (
			![
				'http-request',
				'condition',
				'switch',
				'loop',
				'break',
				'parallel',
				'wait',
				'wait-until',
				'wait-event',
				'approval',
				'transform',
				'invoke-process',
				'end-failure'
			].includes(type)
		)
			return;
		event.preventDefault();
		const bounds =
			event.currentTarget instanceof HTMLElement
				? event.currentTarget.getBoundingClientRect()
				: null;
		if (!bounds) return;
		addSupportedNode(type, {
			x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
			y: (event.clientY - bounds.top - viewport.y) / viewport.zoom
		});
	}

	function connectDraft(connection: {
		source: string | null;
		target: string | null;
		sourceHandle: string | null;
	}) {
		if (
			!isExecutableDraft ||
			!connection.source ||
			!connection.target ||
			connection.source === connection.target
		)
			return;
		const sourceNode = draftDefinition.nodes.find((node) => node.id === connection.source);
		const targetNode = draftDefinition.nodes.find((node) => node.id === connection.target);
		if (
			!sourceNode ||
			!targetNode ||
			(sourceNode.type === 'end-success' || sourceNode.type === 'end-failure') ||
			targetNode.type === 'trigger-http'
		)
			return;
		const isBooleanBranch = sourceNode.type === 'condition' || sourceNode.type === 'approval';
		const isSwitchBranch = sourceNode.type === 'switch';
		const isLoopBranch = sourceNode.type === 'loop';
		const isParallelBranch = sourceNode.type === 'parallel';
		const isBranchingNode = isBooleanBranch || isSwitchBranch || isLoopBranch || isParallelBranch;
		const branch = isBranchingNode
			? isLoopBranch
				? ['body', 'exit'].includes(connection.sourceHandle ?? '')
					? connection.sourceHandle
					: null
				: isSwitchBranch
				? [...sourceNode.config.cases.map((item) => item.id), 'default'].includes(
						connection.sourceHandle ?? ''
					)
					? connection.sourceHandle
					: null
				: isParallelBranch
					? sourceNode.config.branches.some((item) => item.id === connection.sourceHandle)
						? connection.sourceHandle
						: null
				: connection.sourceHandle === 'true'
				? true
				: connection.sourceHandle === 'false'
					? false
					: null
			: undefined;
		if (branch === null) return;
		let isLoopBack = false;
		if (targetNode.type === 'loop' && sourceNode.type !== 'trigger-http') {
			const bodyTarget = draftDefinition.edges.find(
				(edge) => edge.source === targetNode.id && edge.loop === 'body'
			)?.target;
			const reachable: string[] = [];
			const queue = bodyTarget ? [bodyTarget] : [];
			while (queue.length > 0) {
				const nodeId = queue.shift();
				if (!nodeId || nodeId === targetNode.id || reachable.includes(nodeId)) continue;
				reachable.push(nodeId);
				queue.push(
					...draftDefinition.edges
						.filter((edge) => edge.source === nodeId && edge.loopBack === undefined)
						.map((edge) => edge.target)
				);
			}
			isLoopBack = reachable.includes(sourceNode.id);
		}
		const retainedEdges = draftDefinition.edges.filter(
			(edge) =>
				edge.source !== sourceNode.id ||
				(isBooleanBranch && edge.when !== branch) ||
				(isSwitchBranch && edge.case !== branch) ||
				(isLoopBranch && edge.loop !== branch) ||
				(isParallelBranch && edge.parallel !== branch)
		);
		commitDraft({
			...draftDefinition,
			edges: [
				...retainedEdges,
				{
					id: `${sourceNode.id}-${branch === undefined ? 'next' : String(branch)}-${targetNode.id}`,
					source: sourceNode.id,
					target: targetNode.id,
					...(branch === undefined
						? isLoopBack
							? { loopBack: targetNode.id }
							: {}
						: isLoopBranch
							? { loop: branch as 'body' | 'exit' }
						: isSwitchBranch
							? { case: branch as string }
						: isParallelBranch
							? { parallel: branch as string }
							: { when: branch as boolean })
				}
			]
		});
	}

	async function allowDraftDeletion({ nodes: deletedNodes }: { nodes: Node[]; edges: Edge[] }) {
		return (
			isExecutableDraft &&
			deletedNodes.every((node) => {
				const definitionNode = draftDefinition.nodes.find((candidate) => candidate.id === node.id);
				return definitionNode &&
					!['trigger-http', 'loop', 'parallel', 'parallel-join', 'end-success'].includes(definitionNode.type);
			})
		);
	}

	function deleteDraftSelection({
		nodes: deletedNodes,
		edges: deletedEdges
	}: {
		nodes: Node[];
		edges: Edge[];
	}) {
		if (!isExecutableDraft || (deletedNodes.length === 0 && deletedEdges.length === 0)) return;
		const deletedNodeIds = new Set(deletedNodes.map((node) => node.id));
		const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
		commitDraft({
			...draftDefinition,
			nodes: draftDefinition.nodes.filter((node) => !deletedNodeIds.has(node.id)),
			edges: draftDefinition.edges.filter(
				(edge) =>
					!deletedIds.has(edge.id) &&
					!deletedNodeIds.has(edge.source) &&
					!deletedNodeIds.has(edge.target)
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
			edges: draftDefinition.edges.filter(
				(edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)
			)
		});
		selectedNodeIds = [];
		selectedId = draftDefinition.nodes[0]?.id ?? '';
	}

	function deleteSelectedNode() {
		if (
			!isExecutableDraft ||
			!selectedDefinitionNode ||
			['trigger-http', 'condition', 'switch', 'loop', 'parallel', 'parallel-join', 'approval', 'end-success'].includes(
				selectedDefinitionNode.type
			)
		)
			return;
		const nodeId = selectedDefinitionNode.id;
		const incoming = draftDefinition.edges.filter((edge) => edge.target === nodeId);
		const outgoing = draftDefinition.edges.filter((edge) => edge.source === nodeId);
		const retainedEdges = draftDefinition.edges.filter(
			(edge) => edge.source !== nodeId && edge.target !== nodeId
		);
		const reconnect =
			incoming.length === 1 && outgoing.length === 1
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
		return Boolean(
			node &&
				!['trigger-http', 'loop', 'break', 'parallel', 'parallel-join', 'end-success', 'end-failure'].includes(
					node.type
				)
		);
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
		if (!isExecutableDraft || selectedDefinitionNodes.length < 2 || selectionHasNonCopyableNodes)
			return;
		const selectedIds = new Set(selectedDefinitionNodes.map((node) => node.id));
		const idMap = new Map(
			selectedDefinitionNodes.map((node) => [
				node.id,
				`${node.type}-${crypto.randomUUID().slice(0, 8)}`
			])
		);
		const duplicatedNodes = selectedDefinitionNodes.map(
			(node) =>
				({
					...structuredClone(node),
					id: idMap.get(node.id)!,
					name: `${node.name}-copy`,
					position: { x: node.position.x + 48, y: node.position.y + 48 }
				}) as ProcessNode
		);
		const duplicatedEdges = draftDefinition.edges
			.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
			.map((edge) => ({
				...edge,
				id: `${idMap.get(edge.source)}-${edge.case ?? (edge.when === undefined ? 'next' : edge.when ? 'true' : 'false')}-${idMap.get(edge.target)}`,
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
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement
		)
			return;

		// Delete / Backspace for selected nodes
		if ((event.key === 'Delete' || event.key === 'Backspace') && !event.ctrlKey && !event.metaKey) {
			if (isExecutableDraft && selectedDefinitionNodes.length > 0 && !selectionHasProtectedNodes) {
				event.preventDefault();
				if (selectedDefinitionNodes.length > 1) deleteSelectedNodes();
				else deleteSelectedNode();
				return;
			}
		}

		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		const key = event.key.toLowerCase();
		if ((key === 'z' && event.shiftKey) || key === 'y') {
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
		draftNotice =
			locale === 'uk'
				? 'Збережено як чернетку. AI та deploy не підключені.'
				: 'Saved as a draft. AI and deploy are not connected.';
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
			persistenceError =
				locale === 'uk' ? 'Не вдалося завантажити чернетки.' : 'Could not load drafts.';
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
			<div>
				<span>{text.journeys}</span><label
					><select
						value={activeProcess && isExecutableDraft
							? processOptionId(activeProcess)
							: activeScenario.id}
						onchange={(event) => selectJourney(event.currentTarget.value)}
						>{#each persistedProcesses as process}<option value={processOptionId(process)}
								>{process.name}</option
							>{/each}{#if !activeProcess}<option value={executableScenario.id}
								>{localizedScenario(executableScenario, locale).label}</option
							>{/if}{#each flowScenarios as scenario}<option value={scenario.id}
								>{localizedScenario(scenario, locale).label}</option
							>{/each}</select
					><ChevronDown size={12} /></label
				>
			</div>
		</div>
		<div class="editor-actions">
			<button
				type="button"
				disabled={!isExecutableDraft || undoStack.length === 0}
				onclick={undoDraft}
				aria-label={locale === 'uk' ? 'Скасувати' : 'Undo'}
				title="Ctrl+Z"><Undo2 size={14} /></button
			>
			<button
				type="button"
				disabled={!isExecutableDraft || redoStack.length === 0}
				onclick={redoDraft}
				aria-label={locale === 'uk' ? 'Повторити' : 'Redo'}
				title="Ctrl+Shift+Z"><Redo2 size={14} /></button
			>
			<span class="draft-state" class:readonly={!isExecutableDraft}
				><i></i>{isExecutableDraft
					? draftDirty
						? locale === 'uk'
							? 'Незбережені зміни'
							: 'Unsaved changes'
						: locale === 'uk'
							? 'Чернетка'
							: 'Draft'
					: locale === 'uk'
						? 'Лише перегляд'
						: 'Read only'}</span
			>
			<button
				type="button"
				disabled={!isExecutableDraft || persistenceState !== 'idle' || !draftDirty}
				onclick={saveDraft}
				><FileUp size={14} />{persistenceState === 'saving'
					? locale === 'uk'
						? 'Збереження'
						: 'Saving'
					: locale === 'uk'
						? 'Зберегти'
						: 'Save'}</button
			>
			<button type="button" disabled={!isExecutableDraft} onclick={validateDraft}
				><Check size={14} />{locale === 'uk' ? 'Перевірити' : 'Validate'}</button
			>
			<button class="publish" type="button" disabled={!publishEnabled} onclick={publishProcess}
				><Upload size={14} />{commandState === 'publishing'
					? locale === 'uk'
						? 'Публікація'
						: 'Publishing'
					: locale === 'uk'
						? 'Опублікувати'
						: 'Publish'}</button
			>
			<button type="button" disabled={!runEnabled} onclick={runProcess}
				><Play size={14} />{commandState === 'running'
					? locale === 'uk'
						? 'Запуск'
						: 'Starting'
					: 'Run'}</button
			>
		</div>
	</div>
	{#if validationResult}
		<div class:valid={validationResult.valid} class="validation-banner" role="status">
			{#if validationResult.valid}<Check size={14} />{:else}<XCircle size={14} />{/if}
			<strong
				>{validationResult.valid
					? locale === 'uk'
						? 'Чернетка готова до публікації'
						: 'Draft is ready to publish'
					: locale === 'uk'
						? `Знайдено проблем: ${validationResult.issues.length}`
						: `Issues found: ${validationResult.issues.length}`}</strong
			>
			{#if !validationResult.valid}<span
					>{validationResult.issues.map((issue) => issue.message).join(' ')}</span
				>{/if}
		</div>
	{/if}
	{#if persistenceError}<div class="persistence-error" role="alert">
			<XCircle size={14} />{persistenceError}
		</div>{/if}
	{#if commandNotice}<div class="command-notice" role="status">{commandNotice}</div>{/if}
	<div class="workflow-summary scenario-heading">
		<div>
			<div class="breadcrumbs">
				<span>{localizedCategory(activeScenario.category, locale)}</span><b>/</b><strong
					>{activeCopy.title}</strong
				><span class="revision">{text.trace}</span>
			</div>
			<p>{activeCopy.description}</p>
		</div>
		<div class="legend">
			<span><i class="complete"></i>{text.passed}</span><span
				><i class="running"></i>{text.active}</span
			><span><i></i>{text.pending}</span>
		</div>
	</div>

	<div class="engine-body">
		<aside class="node-palette process-catalog">
			<header>
				<Boxes size={15} /><strong>{locale === 'uk' ? 'Палітра вузлів' : 'Node palette'}</strong>
			</header>
			<label class="process-search">
				<Search size={14} />
				<input
					bind:value={paletteQuery}
					type="search"
					placeholder={locale === 'uk' ? 'Знайти вузол' : 'Find node'}
				/>
			</label>
			<nav
				aria-label={locale === 'uk' ? 'Вузли Cloudflare Workflows' : 'Cloudflare Workflows nodes'}
			>
				{#each filteredPalette as group}
					<section>
						<h3>{group.label}<ChevronDown size={11} /></h3>
						{#each group.items as item}
							{@const Icon = item.icon}
							<button
								type="button"
								draggable={Boolean(item.nodeType && isExecutableDraft)}
								disabled={!item.nodeType || !isExecutableDraft}
								ondragstart={(event) => item.nodeType && startPaletteDrag(event, item.nodeType)}
								onclick={() => item.nodeType && addSupportedNode(item.nodeType)}
								><span class="palette-icon"><Icon size={14} /></span><span
									><b>{item.label}</b><small>{item.api}</small></span
								><ChevronRight size={11} /></button
							>
						{/each}
					</section>
				{/each}
				{#if filteredPalette.length === 0}<p class="empty-catalog">{text.empty}</p>{/if}
			</nav>
			<section
				class="approval-inbox"
				aria-label={locale === 'uk' ? 'Мої погодження' : 'My approvals'}
			>
				<h3>
					{locale === 'uk' ? 'Мої погодження' : 'My approvals'}<span
						>{approvalTasks.filter((task) => task.status === 'pending').length}</span
					>
				</h3>
				{#each approvalTasks.slice(0, 5) as task}
					<article class:resolved={task.status !== 'pending'}>
						<div>
							<strong>{task.stepName}</strong><small
								>{task.status} · {new Date(task.deadlineAt).toLocaleString(locale)}</small
							>
						</div>
						{#if task.status === 'pending'}
							<input
								value={approvalTaskComments[task.id] ?? ''}
								oninput={(event) =>
									(approvalTaskComments = {
										...approvalTaskComments,
										[task.id]: event.currentTarget.value
									})}
								placeholder={locale === 'uk' ? 'Коментар' : 'Comment'}
							/>
							<div class="approval-task-actions">
								<button
									type="button"
									disabled={Boolean(approvalTaskSendingId)}
									onclick={() => decideApprovalTask(task, 'rejected')}
									><XCircle size={12} />{locale === 'uk' ? 'Відхилити' : 'Reject'}</button
								>
								<button
									type="button"
									disabled={Boolean(approvalTaskSendingId)}
									onclick={() => decideApprovalTask(task, 'approved')}
									><Check size={12} />{locale === 'uk' ? 'Погодити' : 'Approve'}</button
								>
							</div>
						{/if}
					</article>
				{:else}<p>{locale === 'uk' ? 'Немає призначених задач' : 'No assigned tasks'}</p>{/each}
			</section>
			<div class="palette-foot">
				<Code2 size={13} /><span
					>{locale === 'uk' ? 'Експорт у TypeScript Workflow' : 'TypeScript Workflow output'}</span
				>
			</div>
		</aside>
		<div
			class="canvas"
			role="application"
			aria-label={text.canvas}
			ondragover={allowCanvasDrop}
			ondrop={dropPaletteNode}
		>
			<div class="canvas-badge">
				<span><i></i>PREVIEW</span><button
					type="button"
					disabled={!activeProcess || !isExecutableDraft}
					aria-expanded={versionHistoryOpen}
					aria-controls="version-history-panel"
					aria-label={locale === 'uk' ? 'Історія версій' : 'Version history'}
					onclick={toggleVersionHistory}><History size={14} /></button
				>
			</div>
			{#if versionHistoryOpen}
				<section
					id="version-history-panel"
					class="version-history"
					aria-label={locale === 'uk' ? 'Історія версій' : 'Version history'}
				>
					<header>
						<div>
							<History size={14} /><strong
								>{locale === 'uk' ? 'Історія версій' : 'Version history'}</strong
							>
						</div>
						<button
							type="button"
							onclick={() => (versionHistoryOpen = false)}
							aria-label={locale === 'uk' ? 'Закрити історію' : 'Close history'}
							><XCircle size={15} /></button
						>
					</header>
					<div class="version-list">
						{#if versionHistoryState === 'loading'}
							<p class="version-message">
								<LoaderCircle size={14} />{locale === 'uk' ? 'Завантаження...' : 'Loading...'}
							</p>
						{:else if versionHistoryError}
							<div class="version-message error">
								<span>{versionHistoryError}</span><button
									type="button"
									onclick={() => activeProcess && loadVersionHistory(activeProcess)}
									><RefreshCcw size={12} />{locale === 'uk' ? 'Повторити' : 'Retry'}</button
								>
							</div>
						{:else if versions.length === 0}
							<p class="version-message">
								{locale === 'uk' ? 'Опублікованих версій ще немає.' : 'No published versions yet.'}
							</p>
						{:else}
							{#each versions as version}
								<article>
									<div class="version-heading">
										<strong>v{version.version}</strong
										>{#if version.version === activeProcess?.publishedVersion}<span
												>{locale === 'uk' ? 'Поточна' : 'Current'}</span
											>{/if}
									</div>
									<time datetime={version.publishedAt}
										>{new Date(version.publishedAt).toLocaleString(locale)}</time
									>
									<code title={version.definitionSha256}
										>{version.definitionSha256.slice(0, 12)}</code
									>
									<button type="button" onclick={() => restorePublishedVersion(version)}
										>{locale === 'uk' ? 'Відновити як чернетку' : 'Restore as draft'}</button
									>
								</article>
							{/each}
						{/if}
					</div>
				</section>
			{/if}
			{#if isExecutableDraft && selectedDefinitionNodes.length > 1}
				<div
					class="selection-actions"
					aria-label={locale === 'uk' ? 'Дії з вибраними вузлами' : 'Selected node actions'}
				>
					<strong
						>{selectedDefinitionNodes.length} {locale === 'uk' ? 'вибрано' : 'selected'}</strong
					>
					<button
						type="button"
						disabled={selectionHasNonCopyableNodes}
						onclick={duplicateSelectedNodes}
						aria-label={locale === 'uk' ? 'Дублювати вибрані вузли' : 'Duplicate selected nodes'}
						title={locale === 'uk' ? 'Дублювати вибрані' : 'Duplicate selected'}
						><Copy size={14} /></button
					>
					<button
						class="delete-selection"
						type="button"
						disabled={selectionHasProtectedNodes}
						onclick={deleteSelectedNodes}
						aria-label={locale === 'uk' ? 'Видалити вибрані вузли' : 'Delete selected nodes'}
						title={selectionHasProtectedNodes
							? locale === 'uk'
								? 'Trigger і завершення захищені'
								: 'Trigger and terminal nodes are protected'
							: locale === 'uk'
								? 'Видалити вибрані'
								: 'Delete selected'}><Trash2 size={14} /></button
					>
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
				<CanvasControlsOverlay {locale} onAddNote={() => addStickyNote('yellow')} />
				<MiniMap
					position="bottom-right"
					pannable
					zoomable
					nodeColor={(node) => {
						const status = (node.data as any)?.status;
						if (status === 'failed') return '#ef4444';
						if (status === 'running') return '#f59e0b';
						if (status === 'complete') return '#16a34a';
						if (status === 'waiting') return '#0284c7';
						if (node.type === 'stickyNote') return '#eab308';
						return '#94a3b8';
					}}
					maskColor="rgba(240, 244, 249, 0.78)"
				/>
			</SvelteFlow>
			<form
				class="ai-dock"
				onsubmit={(event) => {
					event.preventDefault();
					prepareAiDraft();
				}}
			>
				<span><Sparkles size={15} /></span><input
					bind:value={aiPrompt}
					placeholder={locale === 'uk'
						? 'Опишіть процес або додайте документацію для AI...'
						: 'Describe a process or add documentation for AI...'}
				/><button type="submit" aria-label={locale === 'uk' ? 'Створити чернетку' : 'Create draft'}
					><Bot size={15} /></button
				>
				{#if draftNotice}<small>{draftNotice}</small>{/if}
			</form>
		</div>

		<aside class="inspector" aria-live="polite">
			<header>
				<div>
					<span>{text.inspector}</span><strong
						>{selectedNode.title} <small>({selectedNode.id})</small></strong
					>
				</div>
				<PanelRightClose size={17} />
			</header>
			<div class="inspector-tabs">
				<button
					class:active={inspectorTab === 'details'}
					onclick={() => (inspectorTab = 'details')}
					type="button">{locale === 'uk' ? 'Налаштування' : 'Settings'}</button
				><button
					class:active={inspectorTab === 'runs'}
					onclick={() => (inspectorTab = 'runs')}
					type="button">{locale === 'uk' ? 'Виконання' : 'Runs'}</button
				>
			</div>
			<div class="inspector-body">
				{#if inspectorTab === 'runs'}
					<label class="run-input"
						><span>Input JSON</span><textarea bind:value={runInput} spellcheck="false"
						></textarea></label
					>
					<div class="run-history-head">
						<span>{locale === 'uk' ? 'Історія запусків' : 'Run history'}</span><button
							type="button"
							disabled={!activeProcess || runHistoryState === 'loading'}
							onclick={() => activeProcess && loadRunHistory(activeProcess.id, selectedRunId)}
							aria-label={locale === 'uk' ? 'Оновити запуски' : 'Refresh runs'}
							title={locale === 'uk' ? 'Оновити запуски' : 'Refresh runs'}
							><RefreshCcw size={13} /></button
						>
					</div>
					{#if runs.length > 0}<label class="run-picker"
							><span>{locale === 'uk' ? 'Запуск' : 'Run'}</span><select
								value={selectedRunId}
								onchange={(event) => selectRun(event.currentTarget.value)}
								>{#each runs as run}<option value={run.id}>{run.status} · {run.id}</option
									>{/each}</select
							></label
						>{/if}
					{#if runHistoryState === 'loading'}<div class="run-empty">
							<LoaderCircle size={14} />{locale === 'uk' ? 'Завантаження...' : 'Loading...'}
						</div>
					{:else if runHistoryError}<div class="run-empty error">{runHistoryError}</div>
					{:else if selectedRun}
						<div class="execution-timeline">
							<div class="run-status-row">
								<span>{selectedRun.status}</span>
								{#if ['running', 'waiting'].includes(selectedRun.status)}<button
										type="button"
										disabled={runCancelling ||
											runRestarting ||
											runRollingBack ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={() => changeRunLifecycle('pause')}
										><CirclePause size={13} />{runLifecycleAction === 'pause'
											? locale === 'uk'
												? 'Призупинення'
												: 'Pausing'
											: locale === 'uk'
												? 'Призупинити'
												: 'Pause'}</button
									>{:else if selectedRun.status === 'paused'}<button
										type="button"
										disabled={runCancelling ||
											runRestarting ||
											runRollingBack ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={() => changeRunLifecycle('resume')}
										><Play size={13} />{runLifecycleAction === 'resume'
											? locale === 'uk'
												? 'Відновлення'
												: 'Resuming'
											: locale === 'uk'
												? 'Відновити'
												: 'Resume'}</button
									>{/if}
								{#if ['queued', 'running', 'waiting', 'waiting_for_pause', 'paused'].includes(selectedRun.status)}<button
										type="button"
										class="cancel-run"
										disabled={runCancelling ||
											runRestarting ||
											runRollingBack ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={cancelRun}
										><CirclePause size={13} />{runCancelling
											? locale === 'uk'
												? 'Скасування'
												: 'Cancelling'
											: locale === 'uk'
												? 'Скасувати'
												: 'Cancel'}</button
									>{/if}
								{#if ['queued', 'running', 'waiting', 'waiting_for_pause', 'paused'].includes(selectedRun.status)}<button
										type="button"
										disabled={runRollingBack ||
											runCancelling ||
											runRestarting ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={rollbackRun}
										><History size={13} />{runRollingBack
											? locale === 'uk'
												? 'Відкат'
												: 'Rolling back'
											: locale === 'uk'
												? 'Відкотити'
												: 'Roll back'}</button
									>{/if}
								{#if ['complete', 'errored', 'terminated'].includes(selectedRun.status) && !selectedRun.archivedAt}<button
										type="button"
										disabled={runRestarting ||
											runCancelling ||
											runRollingBack ||
											runArchiving ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={restartRun}
										><RefreshCcw size={13} />{runRestarting
											? locale === 'uk'
												? 'Перезапуск'
												: 'Restarting'
											: locale === 'uk'
												? 'Перезапустити'
												: 'Restart'}</button
									>{/if}
								{#if ['complete', 'errored', 'terminated'].includes(selectedRun.status) && !selectedRun.archivedAt}<button
										type="button"
										disabled={runArchiving ||
											runRestarting ||
											runCancelling ||
											runRollingBack ||
											eventSending ||
											Boolean(runLifecycleAction)}
										onclick={archiveRun}
										><Archive size={13} />{runArchiving
											? locale === 'uk'
												? 'Архівування'
												: 'Archiving'
											: locale === 'uk'
												? 'Архівувати'
												: 'Archive'}</button
									>{/if}
							</div>
							<strong
								>{locale === 'uk'
									? `Завершено кроків: ${runSummary.completedSteps}`
									: `Completed steps: ${runSummary.completedSteps}`}{runSummary.activeStep
									? ` · ${locale === 'uk' ? 'Активний' : 'Active'}: ${runSummary.activeStep}`
									: ''}</strong
							>
							<small
								>{selectedRun.id} · {selectedRun.workflowInstanceId} · {locale === 'uk'
									? 'покоління'
									: 'generation'}
								{selectedRun.executionGeneration}</small
							>
							{#if selectedRun.parentRunId}<small
									>{locale === 'uk' ? 'Підпроцес' : 'Subprocess'} · {locale === 'uk'
										? 'рівень'
										: 'depth'}
									{selectedRun.depth} · {selectedRun.parentStepId} · {selectedRun.parentRunId}</small
								>{/if}
							{#if selectedRun.archivedAt}<small
									>{locale === 'uk' ? 'Архівовано' : 'Archived'} · {new Date(
										selectedRun.archivedAt
									).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-US')}</small
								>{/if}
						</div>
						{#if selectedRunError}<details class="run-detail error" open>
								<summary>{locale === 'uk' ? 'Помилка запуску' : 'Run error'}</summary>
								<pre>{selectedRunError}</pre>
							</details>{/if}
						{#if selectedRun.rollbackOutcome}<details
								class:error={selectedRun.rollbackOutcome === 'failed'}
								class="run-detail"
								open={selectedRun.rollbackOutcome === 'failed'}
							>
								<summary
									>{locale === 'uk' ? 'Результат відкату' : 'Rollback outcome'}: {selectedRun.rollbackOutcome}</summary
								>
								{#if selectedRunRollbackError}<pre>{selectedRunRollbackError}</pre>{/if}
							</details>{/if}
						{#if selectedRunOutput}<details class="run-detail">
								<summary>{locale === 'uk' ? 'Результат запуску' : 'Run output'}</summary>
								<pre>{selectedRunOutput}</pre>
							</details>{/if}
						{#if activeApproval}
							<div class="node-config">
								<strong
									>{locale === 'uk'
										? `Потрібне рішення: ${activeApproval.stepName}`
										: `Decision required: ${activeApproval.stepName}`}</strong
								>
								<label
									><span>{locale === 'uk' ? 'Коментар' : 'Comment'}</span><textarea
										bind:value={approvalComment}
										spellcheck="true"></textarea></label
								>
								<div class="approval-actions">
									<button
										type="button"
										disabled={eventSending ||
											runCancelling ||
											runRestarting ||
											runRollingBack ||
											Boolean(runLifecycleAction)}
										onclick={() => decideApproval('approved')}
										><Check size={13} />{locale === 'uk' ? 'Погодити' : 'Approve'}</button
									>
									<button
										type="button"
										disabled={eventSending ||
											runCancelling ||
											runRestarting ||
											runRollingBack ||
											Boolean(runLifecycleAction)}
										onclick={() => decideApproval('rejected')}
										><XCircle size={13} />{locale === 'uk' ? 'Відхилити' : 'Reject'}</button
									>
								</div>
							</div>
						{:else}<div class="node-config">
								<label
									><span>{locale === 'uk' ? 'Тип події' : 'Event type'}</span><input
										bind:value={runEventType}
									/></label
								>
								<label
									><span>Payload JSON</span><textarea
										bind:value={runEventPayload}
										spellcheck="false"></textarea></label
								>
								<button
									type="button"
									disabled={eventSending ||
										runCancelling ||
										runRestarting ||
										runRollingBack ||
										Boolean(runLifecycleAction) ||
										!runEventType.trim() ||
										['complete', 'errored', 'terminated'].includes(selectedRun.status)}
									onclick={sendRunEvent}
									><Webhook size={13} />{eventSending
										? locale === 'uk'
											? 'Надсилання'
											: 'Sending'
										: locale === 'uk'
											? 'Надіслати подію'
											: 'Send event'}</button
								>
							</div>{/if}
						<div class="run-events">
							{#each runEvents as event}<div>
									<b>#{event.sequence} {event.eventType}</b><span
										>{event.stepName ?? 'process'}{event.attempt
											? ` · attempt ${event.attempt}`
											: ''}</span
									><time datetime={event.createdAt}
										>{new Date(event.createdAt).toLocaleString(locale)}</time
									>{#if formatRunDetail(event.payload)}<details class="run-detail">
											<summary>Payload</summary>
											<pre>{formatRunDetail(event.payload)}</pre>
										</details>{/if}
								</div>{/each}
						</div>
						{#if runEvents.length === 0}<div class="run-empty">
								{locale === 'uk' ? 'Подій ще немає.' : 'No events yet.'}
							</div>{/if}
						<div class="attempts-head">
							<span>{locale === 'uk' ? 'Спроби дій' : 'Action attempts'}</span>
							<strong>{stepAttempts.length}</strong>
						</div>
						<div class="step-attempts">
							{#each stepAttempts as attempt (`${attempt.executionGeneration}:${attempt.stepId}:${attempt.visit}:${attempt.kind}:${attempt.attempt}`)}
								<div class:failed={attempt.outcome === 'failed'}>
									<header>
										<b>{attempt.stepId} · visit {attempt.visit}</b>
										<span>{attempt.kind === 'compensation'
												? locale === 'uk'
													? 'компенсація'
													: 'compensation'
												: attempt.outcome}</span>
									</header>
									<small>generation {attempt.executionGeneration} · attempt {attempt.attempt} · {Math.max(
										0,
										new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()
									)} ms</small>
									<small>{attempt.retry.limit} retries · {attempt.retry.backoff} · {attempt.retry.timeoutMs} ms timeout</small>
									{#if attempt.output && 'status' in attempt.output}
										<small
											>HTTP {attempt.output.status} · {attempt.output.contentType ?? 'unknown'} · {attempt.output.bytes} bytes{attempt.output.truncated
												? locale === 'uk'
													? ' · завеликий для inline перегляду'
													: ' · too large for inline viewing'
												: ''}</small
										>
										{#if 'value' in attempt.output}
											<JsonTreeViewer
												data={attempt.output.value}
												label={locale === 'uk' ? 'HTTP-відповідь' : 'HTTP response'}
												defaultExpanded={false}
											/>
										{/if}
									{:else if attempt.output && 'bytes' in attempt.output}
										<small
											>{attempt.output.type} · {attempt.output.bytes} bytes{attempt.output.truncated
												? locale === 'uk'
													? ' · завеликий для inline перегляду'
													: ' · too large for inline viewing'
												: ''}</small
										>
										{#if 'value' in attempt.output}
											<JsonTreeViewer
												data={attempt.output.value}
												label={locale === 'uk' ? 'Результат кроку' : 'Step output'}
												defaultExpanded={false}
											/>
										{/if}
									{:else if attempt.output?.type === 'redacted'}
										<small>{locale === 'uk' ? 'output приховано' : 'output redacted'}</small>
									{/if}
									{#if attempt.error}<small>{attempt.error.code}</small>{/if}
								</div>
							{/each}
						</div>
						{#if stepAttempts.length === 0}<div class="run-empty">
								{locale === 'uk' ? 'Спроб дій ще немає.' : 'No action attempts yet.'}
							</div>{/if}
					{:else}<div class="run-empty">
							{locale === 'uk' ? 'Запусків ще немає.' : 'No runs yet.'}
						</div>{/if}
				{/if}
				<span class="node-type">{selectedNode.layer ?? 'process'} · {selectedNode.eyebrow}</span>
				<h3>{selectedNode.title}</h3>
				<p>{selectedNode.detail}</p>
				{#if inspectorTab === 'details' && selectedDefinitionNode?.type === 'http-request'}
					<div class="node-config">
						<label
							><span>Method</span><select
								value={selectedDefinitionNode.config.method}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? {
													...node,
													config: {
														...node.config,
														method: event.currentTarget.value as typeof node.config.method
													}
												}
											: node
									)}
								><option value="GET">GET</option><option value="POST">POST</option><option
									value="PUT">PUT</option
								><option value="PATCH">PATCH</option><option value="DELETE">DELETE</option></select
							></label
						>
						<label
							><span>HTTPS URL</span><input
								type="url"
								value={selectedDefinitionNode.config.url}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? { ...node, config: { ...node.config, url: event.currentTarget.value } }
											: node
									)}
							/></label
						>
						<label
							><span>Timeout (ms)</span><input
								type="number"
								min="1"
								max="1800000"
								step="1"
								value={selectedDefinitionNode.config.timeoutMs}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? {
													...node,
													config: { ...node.config, timeoutMs: Number(event.currentTarget.value) }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Retry limit</span><input
								type="number"
								min="0"
								max="10"
								step="1"
								value={selectedDefinitionNode.config.retry.limit}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? {
													...node,
													config: {
														...node.config,
														retry: {
															...node.config.retry,
															limit: Number(event.currentTarget.value)
														}
													}
												}
											: node
									)}
							/></label
						>
						<label
							><span>Backoff</span><select
								value={selectedDefinitionNode.config.retry.backoff}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? {
													...node,
													config: {
														...node.config,
														retry: {
															...node.config.retry,
															backoff: event.currentTarget.value as typeof node.config.retry.backoff
														}
													}
												}
											: node
									)}
								><option value="constant">constant</option><option value="linear">linear</option
								><option value="exponential">exponential</option></select
							></label
						>
						<label
							><span>Idempotency key</span><input
								value={selectedDefinitionNode.config.idempotencyKey ?? ''}
								placeholder="$.id"
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'http-request'
											? {
													...node,
													config: {
														...node.config,
														idempotencyKey: event.currentTarget.value || undefined
													}
												}
											: node
									)}
							/></label
						>
						<label
							><span>{locale === 'uk' ? 'Збереження відповіді' : 'Response storage'}</span><select
								value={selectedDefinitionNode.config.outputPolicy?.mode ?? 'metadata'}
								onchange={(event) =>
									updateSelectedOutputMode(event.currentTarget.value as 'metadata' | 'inline')}
								><option value="metadata">metadata</option><option value="inline">inline JSON</option></select
							></label
						>
						{#if selectedDefinitionNode.config.outputPolicy?.mode === 'inline'}
							<label
								><span>{locale === 'uk' ? 'Ліміт відповіді (байти)' : 'Response limit (bytes)'}</span><input
									type="number"
									min="1"
									max="16384"
									step="1"
									value={selectedDefinitionNode.config.outputPolicy.maxBytes}
									onchange={(event) => updateSelectedOutputLimit(Number(event.currentTarget.value))}
								/></label
							>
							<label
								><span>{locale === 'uk' ? 'Приховати JSON paths' : 'Redact JSON paths'}</span><textarea
									spellcheck="false"
									placeholder="$.customer.email"
									onchange={(event) => updateSelectedOutputRedactPaths(event.currentTarget.value)}
									>{selectedDefinitionNode.config.outputPolicy.redactPaths?.join('\n') ?? ''}</textarea
								></label
							>
						{/if}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'condition'}
					<div class="node-config">
						<label
							><span>JSON path</span><input
								value={selectedDefinitionNode.config.path}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'condition'
											? { ...node, config: { ...node.config, path: event.currentTarget.value } }
											: node
									)}
							/></label
						>
						<label
							><span>Operator</span><select
								value={selectedDefinitionNode.config.operator}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'condition'
											? {
													...node,
													config: {
														...node.config,
														operator: event.currentTarget.value as typeof node.config.operator
													}
												}
											: node
									)}
								><option value="equals">equals</option><option value="not-equals">not equals</option
								><option value="greater-than">greater than</option><option value="less-than"
									>less than</option
								><option value="exists">exists</option></select
							></label
						>
						{#if selectedDefinitionNode.config.operator !== 'exists'}<label
								><span>Value</span><input
									value={String(selectedDefinitionNode.config.value ?? '')}
									onchange={(event) =>
										updateSelectedDefinitionNode((node) =>
											node.type === 'condition'
												? {
														...node,
														config: {
															...node.config,
															value: parseScalar(event.currentTarget.value)
														}
													}
												: node
										)}
								/></label
							>{/if}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'switch'}
					<div class="node-config">
						<label
							><span>JSON path</span><input
								value={selectedDefinitionNode.config.path}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'switch'
											? { ...node, config: { ...node.config, path: event.currentTarget.value } }
											: node
									)}
							/></label
						>
						{#each selectedDefinitionNode.config.cases as switchCase (switchCase.id)}
							<label
								><span>{switchCase.id}</span><input
									value={String(switchCase.value ?? 'null')}
									onchange={(event) =>
										updateSelectedDefinitionNode((node) =>
											node.type === 'switch'
												? {
														...node,
														config: {
															...node.config,
															cases: node.config.cases.map((item) =>
																item.id === switchCase.id
																	? { ...item, value: parseScalar(event.currentTarget.value) }
																	: item
															)
														}
													}
												: node
										)}
								/></label
							>
						{/each}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'loop'}
					<div class="node-config">
						<label
							><span>Max iterations</span><input
								type="number"
								min="1"
								max="1000"
								step="1"
								value={selectedDefinitionNode.config.maxIterations}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'loop'
											? {
													...node,
													config: { maxIterations: Number(event.currentTarget.value) }
												}
											: node
									)}
							/></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'break'}
					<div class="node-config">
						<label
							><span>Loop</span><select
								value={selectedDefinitionNode.config.loopId}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'break'
											? { ...node, config: { loopId: event.currentTarget.value } }
											: node
									)}
								>{#each draftDefinition.nodes.filter((node) => node.type === 'loop') as loop (loop.id)}<option
										value={loop.id}>{loop.name}</option
									>{/each}</select
							></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'parallel'}
					<div class="node-config">
						<label
							><span>Result key</span><input
								value={selectedDefinitionNode.config.resultKey}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'parallel'
											? { ...node, config: { ...node.config, resultKey: event.currentTarget.value } }
											: node
									)}
							/></label
						>
						{#each selectedDefinitionNode.config.branches as branch, index (index)}
							<label
								><span>Branch {index + 1}</span><input
									value={branch.id}
									onchange={(event) => updateParallelBranch(index, event.currentTarget.value)}
								/></label
							>
						{/each}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'wait'}
					<div class="node-config">
						<label
							><span>Duration (ms)</span><input
								type="number"
								min="1"
								max="31536000000"
								step="1"
								value={selectedDefinitionNode.config.durationMs}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'wait'
											? { ...node, config: { durationMs: Number(event.currentTarget.value) } }
											: node
									)}
							/></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'wait-until'}
					<div class="node-config">
						<label
							><span>Resume at</span><input
								type="datetime-local"
								value={formatLocalDateTime(selectedDefinitionNode.config.timestamp)}
								onchange={(event) => {
									const timestamp = new Date(event.currentTarget.value);
									if (!Number.isFinite(timestamp.getTime())) return;
									updateSelectedDefinitionNode((node) =>
										node.type === 'wait-until'
											? { ...node, config: { timestamp: timestamp.toISOString() } }
											: node
									);
								}}
							/></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'wait-event'}
					<div class="node-config">
						<label
							><span>Event type</span><input
								value={selectedDefinitionNode.config.eventType}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'wait-event'
											? {
													...node,
													config: { ...node.config, eventType: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Timeout (ms)</span><input
								type="number"
								min="1"
								max="31536000000"
								step="1"
								value={selectedDefinitionNode.config.timeoutMs}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'wait-event'
											? {
													...node,
													config: { ...node.config, timeoutMs: Number(event.currentTarget.value) }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Result key</span><input
								value={selectedDefinitionNode.config.resultKey}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'wait-event'
											? {
													...node,
													config: { ...node.config, resultKey: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'approval'}
					<div class="node-config">
						<label
							><span>{locale === 'uk' ? 'User ID погоджувача' : 'Assignee user ID'}</span><input
								value={selectedDefinitionNode.config.assigneeUserId}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'approval'
											? {
													...node,
													config: { ...node.config, assigneeUserId: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Timeout (ms)</span><input
								type="number"
								min="1"
								max="31536000000"
								step="1"
								value={selectedDefinitionNode.config.timeoutMs}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'approval'
											? {
													...node,
													config: { ...node.config, timeoutMs: Number(event.currentTarget.value) }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Result key</span><input
								value={selectedDefinitionNode.config.resultKey}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'approval'
											? {
													...node,
													config: { ...node.config, resultKey: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'transform'}
					<div class="node-config">
						<label
							><span>Mode</span><select
								value={selectedDefinitionNode.config.mode}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'transform'
											? {
													...node,
													config: {
														...node.config,
														mode: event.currentTarget.value as 'merge' | 'replace'
													}
												}
											: node
									)}
								><option value="merge">merge</option><option value="replace">replace</option
								></select
							></label
						>
						<label
							><span>Mappings (JSON)</span><textarea
								spellcheck="false"
								oninput={(event) => updateTransformMappings(event.currentTarget.value)}
								>{JSON.stringify(selectedDefinitionNode.config.mappings, null, 2)}</textarea
							></label
						>
						<label
							><span>{locale === 'uk' ? 'Збереження результату' : 'Result storage'}</span><select
								value={selectedDefinitionNode.config.outputPolicy?.mode ?? 'metadata'}
								onchange={(event) =>
									updateSelectedOutputMode(event.currentTarget.value as 'metadata' | 'inline')}
								><option value="metadata">metadata</option><option value="inline">inline JSON</option></select
							></label
						>
						{#if selectedDefinitionNode.config.outputPolicy?.mode === 'inline'}
							<label
								><span>{locale === 'uk' ? 'Ліміт результату (байти)' : 'Result limit (bytes)'}</span><input
									type="number"
									min="1"
									max="16384"
									step="1"
									value={selectedDefinitionNode.config.outputPolicy.maxBytes}
									onchange={(event) => updateSelectedOutputLimit(Number(event.currentTarget.value))}
								/></label
							>
							<label
								><span>{locale === 'uk' ? 'Приховати JSON paths' : 'Redact JSON paths'}</span><textarea
									spellcheck="false"
									placeholder="$.customer.email"
									onchange={(event) => updateSelectedOutputRedactPaths(event.currentTarget.value)}
									>{selectedDefinitionNode.config.outputPolicy.redactPaths?.join('\n') ?? ''}</textarea
								></label
							>
						{/if}
					</div>
				{:else if inspectorTab === 'details' && selectedDefinitionNode?.type === 'invoke-process'}
					<div class="node-config">
						<label
							><span>{locale === 'uk' ? 'Опублікований процес' : 'Published process'}</span><select
								value={selectedDefinitionNode.config.processId}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'invoke-process'
											? {
													...node,
													config: { ...node.config, processId: event.currentTarget.value }
												}
											: node
									)}
								><option value="" disabled
									>{locale === 'uk' ? 'Оберіть процес' : 'Select a process'}</option
								>{#each persistedProcesses.filter((process) => process.publishedVersion !== null) as process (process.id)}<option
										value={process.id}>{process.name} · v{process.publishedVersion}</option
									>{/each}</select
							></label
						>
						<label
							><span>Input JSON path</span><input
								value={selectedDefinitionNode.config.inputPath}
								placeholder="$"
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'invoke-process'
											? {
													...node,
													config: { ...node.config, inputPath: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Result key</span><input
								value={selectedDefinitionNode.config.resultKey}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'invoke-process'
											? {
													...node,
													config: { ...node.config, resultKey: event.currentTarget.value }
												}
											: node
									)}
							/></label
						>
						<label
							><span>Timeout (ms)</span><input
								type="number"
								min="1"
								max="31536000000"
								step="1"
								value={selectedDefinitionNode.config.timeoutMs}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'invoke-process'
											? {
													...node,
													config: { ...node.config, timeoutMs: Number(event.currentTarget.value) }
												}
											: node
									)}
							/></label
						>
					</div>
				{/if}
				{#if inspectorTab === 'details' && selectedDefinitionNode?.type === 'end-failure'}
					<div class="node-config">
						<label
							><span>Error code</span><input
								pattern="[A-Za-z_][A-Za-z0-9_.-]*"
								value={selectedDefinitionNode.config.code}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'end-failure'
											? { ...node, config: { ...node.config, code: event.currentTarget.value } }
											: node
									)}
							/></label
						>
						<label
							><span>Public message</span><textarea
								maxlength="200"
								rows="4"
								value={selectedDefinitionNode.config.message}
								onchange={(event) =>
									updateSelectedDefinitionNode((node) =>
										node.type === 'end-failure'
											? { ...node, config: { ...node.config, message: event.currentTarget.value } }
											: node
									)}
							></textarea></label
						>
					</div>
				{/if}
				{#if inspectorTab === 'details' && selectedDefinitionNode && !['trigger-http', 'condition', 'end-success'].includes(selectedDefinitionNode.type)}
					<div class="node-actions">
						<button
							type="button"
							onclick={duplicateSelectedNode}
							title={locale === 'uk' ? 'Дублювати вузол' : 'Duplicate node'}
							><Copy size={13} />{locale === 'uk' ? 'Дублювати' : 'Duplicate'}</button
						>
						<button class="delete-node" type="button" onclick={deleteSelectedNode}
							><Trash2 size={13} />{locale === 'uk' ? 'Видалити' : 'Delete'}</button
						>
					</div>
				{:else if inspectorTab === 'details' && canCopyNode(selectedDefinitionNode)}
					<div class="node-actions">
						<button type="button" onclick={copySelectedNode}
							><Copy size={13} />{locale === 'uk' ? 'Копіювати' : 'Copy'}</button
						><button type="button" disabled={!copiedNode} onclick={pasteCopiedNode}
							><ClipboardPaste size={13} />{locale === 'uk' ? 'Вставити' : 'Paste'}</button
						>
					</div>
				{/if}
				<div class="entrypoint">
					<span>{text.entry}</span><code>{activeScenario.entrypoint}</code>
				</div>

				<div class="property-list">
					<div>
						<span>{text.status}</span><strong data-status={selectedNode.status}>
							{#if selectedNode.status === 'complete'}<Check
									size={13}
								/>{:else if selectedNode.status === 'running'}<LoaderCircle
									size={13}
								/>{:else if selectedNode.status === 'waiting'}<CirclePause
									size={13}
								/>{:else}<LockKeyhole size={13} />{/if}
							{statusText[locale][selectedNode.status]}
						</strong>
					</div>
					<div><span>{text.execution}</span><strong>{text.simulation}</strong></div>
					<div><span>{text.result}</span><strong>{selectedNode.meta}</strong></div>
					<div><span>Retry</span><strong>3 · exponential</strong></div>
					<div><span>Timeout</span><strong>30 seconds</strong></div>
				</div>

				<div class="trace">
					<div><Code2 size={14} /><span>{text.communication}</span></div>
					{#if selectedNode.request}<code>{selectedNode.request}</code>{/if}
					{#if selectedNode.operation}<code><Database size={12} /> {selectedNode.operation}</code
						>{/if}
					{#if selectedNode.input}
						<JsonTreeViewer data={selectedNode.input} label={text.inputPayload} />
					{/if}
					{#if selectedNode.output}
						<JsonTreeViewer data={selectedNode.output} label={text.outputPayload} />
					{/if}
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
	/* =========================================================
	   Corex Google Gemini & Antigravity Light Studio Theme
	   ========================================================= */

	.engine-shell {
		overflow: hidden;
		border: 1px solid #e8ecf2;
		border-radius: 16px;
		background: #ffffff;
		box-shadow:
			0 4px 24px -2px rgba(26, 115, 232, 0.08),
			0 16px 40px -4px rgba(15, 23, 42, 0.05);
		font-family: 'Manrope', sans-serif;
	}

	.canvas-toolbar {
		min-height: 58px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 18px;
		border-bottom: 1px solid #edf1f7;
		color: #1f2937;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		font-size: 11.5px;
	}

	.scenario-heading {
		min-width: 0;
		padding-block: 8px;
		padding-left: 5px;
	}
	.scenario-heading p {
		max-width: 780px;
		margin: 3px 0 0;
		overflow: hidden;
		color: #5f6368;
		font-size: 11px;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: 'Manrope', sans-serif;
	}

	.workflow-identity,
	.workflow-identity > div,
	.workflow-identity label,
	.editor-actions {
		display: flex;
		align-items: center;
	}
	.workflow-identity {
		gap: 11px;
	}
	.workflow-logo {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		color: #ffffff;
		background: linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%);
		box-shadow: 0 3px 10px rgba(26, 115, 232, 0.35);
	}
	.workflow-identity > div {
		align-items: flex-start;
		flex-direction: column;
		gap: 1px;
	}
	.workflow-identity > div > span {
		color: #1a73e8;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.workflow-identity label {
		position: relative;
	}
	.workflow-identity select {
		width: min(320px, 32vw);
		appearance: none;
		border: 0;
		padding: 0 20px 0 0;
		outline: 0;
		color: #1e293b;
		background: transparent;
		font:
			750 13px/1.2 'Manrope',
			sans-serif;
		cursor: pointer;
	}
	.workflow-identity label :global(svg) {
		position: absolute;
		right: 0;
		pointer-events: none;
		color: #5f6368;
	}

	.breadcrumbs,
	.legend,
	.legend span {
		display: flex;
		align-items: center;
	}
	.breadcrumbs {
		gap: 8px;
		font-family: 'Manrope', sans-serif;
	}
	.breadcrumbs b {
		color: #cbd5e1;
	}
	.breadcrumbs strong {
		color: #1e293b;
		font-weight: 700;
	}
	.revision {
		padding: 3px 8px;
		border-radius: 9999px;
		color: #1a73e8;
		background: #e8f0fe;
		font:
			700 9px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.legend {
		gap: 16px;
		color: #5f6368;
		font:
			700 9.5px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.legend span {
		gap: 6px;
	}
	.legend i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #9aa0a6;
	}
	.legend i.complete {
		background: #1e8e3e;
	}
	.legend i.running {
		background: #f9ab00;
		box-shadow: 0 0 0 3px rgba(249, 171, 0, 0.25);
	}

	.editor-actions {
		gap: 8px;
	}
	.editor-actions button {
		height: 34px;
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		padding: 0 13px;
		color: #334155;
		background: #ffffff;
		font:
			700 11px/1 'Manrope',
			sans-serif;
		transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
		cursor: pointer;
	}
	.editor-actions button:not(:disabled):hover {
		border-color: rgba(26, 115, 232, 0.5);
		background: #f8fafd;
		color: #1a73e8;
		box-shadow: 0 2px 10px rgba(26, 115, 232, 0.12);
		transform: translateY(-1px);
	}
	.editor-actions .publish {
		color: #5f6368;
		background: #f1f4f8;
	}
	.editor-actions button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.draft-state {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-right: 4px;
		color: #5f6368;
		font-size: 10.5px;
		font-weight: 600;
	}
	.draft-state i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #f59e0b;
	}
	.draft-state.readonly i {
		background: #9aa0a6;
	}

	.persistence-error {
		min-height: 36px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 18px;
		border-bottom: 1px solid #fad2cf;
		color: #c5221f;
		background: #fce8e6;
		font-size: 11.5px;
		font-weight: 700;
	}
	.command-notice {
		min-height: 36px;
		display: flex;
		align-items: center;
		padding: 8px 18px;
		border-bottom: 1px solid #d2e3fc;
		color: #1967d2;
		background: #e8f0fe;
		font-size: 11.5px;
		font-weight: 700;
	}

	.engine-body {
		height: min(740px, calc(100vh - 145px));
		min-height: 560px;
		display: grid;
		grid-template-columns: 236px minmax(0, 1fr) 296px;
		background: #f8fafd;
	}

	/* Process Catalog & Node Palette */
	.process-catalog {
		min-width: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border-right: 1px solid #edf1f7;
		color: #1f2937;
		background: #ffffff;
	}
	.process-catalog > header {
		height: 48px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		border-bottom: 1px solid #f1f4f8;
		color: #5f6368;
	}
	.process-catalog > header strong {
		font:
			750 11px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.process-search {
		height: 48px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px;
		border-bottom: 1px solid #f1f4f8;
		color: #5f6368;
	}
	.process-search input {
		min-width: 0;
		width: 100%;
		height: 30px;
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		outline: 0;
		padding: 0 12px;
		color: #1e293b;
		background: #f8fafd;
		font:
			650 11px/1 'Manrope',
			sans-serif;
		transition: all 160ms ease;
	}
	.process-search input:focus {
		border-color: #1a73e8;
		background: #ffffff;
		box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.15);
	}
	.process-search input::placeholder {
		color: #9aa0a6;
	}

	.process-catalog nav {
		flex: 1;
		overflow-y: auto;
		padding: 10px 10px 16px;
		scrollbar-width: thin;
	}
	.process-catalog section {
		margin-bottom: 12px;
	}
	.process-catalog h3 {
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0;
		padding: 0 8px;
		color: #5f6368;
		font:
			800 9.5px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.process-catalog button {
		width: 100%;
		min-height: 38px;
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 4px;
		border: 1px solid #f1f4f8;
		border-radius: 10px;
		padding: 5px 9px;
		color: #334155;
		background: #ffffff;
		font:
			650 11px/1.3 'Manrope',
			sans-serif;
		text-align: left;
		cursor: grab;
		transition: all 160ms ease;
	}
	.process-catalog button:hover:not(:disabled) {
		border-color: #d2e3fc;
		color: #1a73e8;
		background: #f8fafd;
		box-shadow: 0 2px 8px rgba(26, 115, 232, 0.08);
		transform: translateX(2px);
	}
	.process-catalog button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.palette-icon {
		width: 24px;
		height: 24px;
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 7px;
		color: #1a73e8;
		background: #e8f0fe;
	}
	.process-catalog button > span:nth-child(2) {
		min-width: 0;
		flex: 1;
		display: grid;
		gap: 2px;
	}
	.process-catalog button b {
		font-size: 11px;
		font-weight: 700;
		color: #1e293b;
	}
	.process-catalog button small {
		overflow: hidden;
		color: #64748b;
		font: 650 8.5px/1 monospace;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.process-catalog button :global(svg:last-child) {
		color: #cbd5e1;
	}
	.empty-catalog {
		margin: 20px 8px;
		color: #9aa0a6;
		font:
			650 10.5px/1.4 'Manrope',
			sans-serif;
	}

	/* Approval Inbox */
	.approval-inbox {
		max-height: 220px;
		overflow-y: auto;
		border-top: 1px solid #edf1f7;
		padding: 12px;
		background: #fcfdfe;
	}
	.approval-inbox h3 {
		margin: 0 0 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #1e293b;
		font-size: 11px;
		font-weight: 750;
	}
	.approval-inbox h3 span {
		min-width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 9999px;
		color: #fff;
		background: linear-gradient(135deg, #f59e0b, #d97706);
		font-size: 9.5px;
		font-weight: 800;
	}
	.approval-inbox article {
		display: grid;
		gap: 6px;
		margin-bottom: 6px;
		padding: 9px;
		border: 1px solid #e8ecf2;
		border-radius: 8px;
		background: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
	}
	.approval-inbox article.resolved {
		opacity: 0.5;
	}
	.approval-inbox article > div:first-child {
		min-width: 0;
		display: grid;
		gap: 2px;
	}
	.approval-inbox strong {
		overflow: hidden;
		color: #1e293b;
		font-size: 11px;
		text-overflow: ellipsis;
	}
	.approval-inbox small,
	.approval-inbox > p {
		margin: 0;
		color: #64748b;
		font-size: 9px;
	}
	.approval-inbox input {
		min-width: 0;
		height: 28px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 0 8px;
		color: #1e293b;
		background: #f8fafd;
		font-size: 10px;
	}
	.approval-task-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.approval-task-actions button {
		min-height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		color: #475569;
		background: #f1f4f8;
		font:
			700 10px/1 'Manrope',
			sans-serif;
		cursor: pointer;
	}
	.approval-task-actions button:last-child {
		border-color: #ceead6;
		color: #137333;
		background: #e6f4ea;
	}
	.palette-foot {
		height: 34px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 12px;
		border-top: 1px solid #edf1f7;
		color: #5f6368;
		background: #f8fafd;
		font-size: 9px;
	}

	/* Canvas Surface */
	.canvas {
		min-width: 0;
		height: 100%;
		position: relative;
		background: radial-gradient(circle, #f8fafd 0%, #f0f4f9 100%);
	}
	.canvas-badge {
		position: absolute;
		z-index: 5;
		top: 14px;
		right: 14px;
		display: flex;
		gap: 6px;
	}
	.canvas-badge span,
	.canvas-badge button {
		height: 30px;
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		padding: 0 10px;
		color: #475569;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(16px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		font-size: 9.5px;
		font-weight: 800;
	}
	.canvas-badge span i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #1a73e8;
	}
	.canvas-badge button {
		width: 30px;
		justify-content: center;
		padding: 0;
		cursor: pointer;
		color: #475569;
	}
	.canvas-badge button:hover:not(:disabled) {
		color: #1a73e8;
		border-color: #1a73e8;
	}

	.version-history {
		position: absolute;
		z-index: 7;
		top: 50px;
		right: 14px;
		width: min(330px, calc(100% - 28px));
		max-height: calc(100% - 75px);
		overflow: hidden;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		color: #1e293b;
		background: rgba(255, 255, 255, 0.98);
		box-shadow: 0 20px 48px rgba(26, 115, 232, 0.15);
		backdrop-filter: blur(24px);
	}
	.version-history > header {
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 14px;
		border-bottom: 1px solid #f1f4f8;
	}
	.version-history > header div {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		font-weight: 750;
	}
	.version-history > header button {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 6px;
		color: #5f6368;
		background: transparent;
		cursor: pointer;
	}
	.version-history > header button:hover {
		color: #1e293b;
		background: #f1f4f8;
	}
	.version-list {
		max-height: 400px;
		overflow-y: auto;
		padding: 8px;
	}
	.version-list article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 6px 10px;
		padding: 10px;
		border-bottom: 1px solid #f1f4f8;
	}
	.version-list article:last-child {
		border-bottom: 0;
	}
	.version-heading {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.version-heading strong {
		color: #1e293b;
		font-size: 12px;
	}
	.version-heading span {
		padding: 2px 7px;
		border-radius: 9999px;
		color: #1a73e8;
		background: #e8f0fe;
		font-size: 8px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.version-list time {
		color: #64748b;
		font-size: 9px;
		text-align: right;
	}
	.version-list code {
		align-self: center;
		color: #64748b;
		font-size: 9px;
		font-family: monospace;
	}
	.version-list article > button,
	.version-message button {
		min-height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border: 1px solid #d2e3fc;
		border-radius: 6px;
		padding: 0 10px;
		color: #1967d2;
		background: #e8f0fe;
		font:
			700 9px/1 'Manrope',
			sans-serif;
		cursor: pointer;
	}
	.version-message {
		min-height: 70px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		margin: 0;
		padding: 16px;
		color: #5f6368;
		font-size: 10.5px;
		text-align: center;
	}
	.version-message.error {
		flex-direction: column;
		color: #c5221f;
	}

	.selection-actions {
		position: absolute;
		z-index: 5;
		top: 14px;
		left: 50%;
		min-height: 36px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px 4px 14px;
		border: 1px solid rgba(26, 115, 232, 0.3);
		border-radius: 9999px;
		color: #1e293b;
		background: rgba(255, 255, 255, 0.98);
		box-shadow: 0 8px 28px rgba(26, 115, 232, 0.16);
		backdrop-filter: blur(16px);
		transform: translateX(-50%);
	}
	.selection-actions strong {
		margin-right: 4px;
		font-size: 11px;
	}
	.selection-actions button {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: 1px solid #e2e8f0;
		border-radius: 50%;
		color: #475569;
		background: #f8fafd;
		cursor: pointer;
	}
	.selection-actions button:hover:not(:disabled) {
		color: #1a73e8;
		background: #e8f0fe;
	}
	.selection-actions button.delete-selection:hover:not(:disabled) {
		color: #c5221f;
		background: #fce8e6;
		border-color: #fad2cf;
	}

	/* Gemini Shimmer AI Prompt Dock */
	.ai-dock {
		position: absolute;
		z-index: 5;
		left: 50%;
		bottom: 18px;
		width: min(560px, calc(100% - 130px));
		min-height: 46px;
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 36px;
		align-items: center;
		border: 1.5px solid transparent;
		border-radius: 9999px;
		padding: 4px 8px;
		background-clip: padding-box, border-box;
		background-origin: padding-box, border-box;
		background-image:
			linear-gradient(#ffffff, #ffffff), linear-gradient(135deg, #1a73e8, #7c3aed, #ea4335, #34a853);
		box-shadow:
			0 12px 36px rgba(26, 115, 232, 0.16),
			0 2px 10px rgba(0, 0, 0, 0.04);
		transform: translateX(-50%);
		transition: box-shadow 200ms ease;
	}
	.ai-dock:focus-within {
		box-shadow:
			0 16px 44px rgba(124, 58, 237, 0.25),
			0 0 0 2px rgba(26, 115, 232, 0.2);
	}
	.ai-dock > span {
		display: grid;
		place-items: center;
		color: #7c3aed;
	}
	.ai-dock input {
		min-width: 0;
		border: 0;
		outline: 0;
		color: #1e293b;
		background: transparent;
		font:
			600 11.5px/1.3 'Manrope',
			sans-serif;
	}
	.ai-dock input::placeholder {
		color: #9aa0a6;
	}
	.ai-dock button {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		color: #ffffff;
		background: linear-gradient(135deg, #1a73e8, #7c3aed);
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
		transition: transform 140ms ease;
	}
	.ai-dock button:hover {
		transform: scale(1.08);
	}
	.ai-dock small {
		grid-column: 2 / 4;
		padding: 2px 0 4px;
		color: #d97706;
		font-size: 9px;
	}

	/* Right Inspector & Execution Panel */
	.inspector {
		border-left: 1px solid #edf1f7;
		color: #1e293b;
		background: #ffffff;
		overflow-y: auto;
	}
	.inspector > header {
		min-height: 50px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		border-bottom: 1px solid #f1f4f8;
		color: #5f6368;
	}
	.inspector > header div {
		display: grid;
		gap: 2px;
	}
	.inspector > header span {
		color: #1a73e8;
		font:
			750 9.5px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.inspector > header strong {
		max-width: 210px;
		overflow: hidden;
		color: #1e293b;
		font:
			700 11.5px/1.2 'Manrope',
			sans-serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.inspector > header strong small {
		color: #64748b;
		font-family: monospace;
	}

	.inspector-tabs {
		height: 38px;
		display: flex;
		border-bottom: 1px solid #edf1f7;
		padding: 4px 8px;
		background: #f8fafd;
	}
	.inspector-tabs button {
		flex: 1;
		border: 0;
		border-radius: 9999px;
		color: #5f6368;
		background: transparent;
		font:
			700 10px/1 'Manrope',
			sans-serif;
		cursor: pointer;
		transition: all 160ms ease;
	}
	.inspector-tabs button.active {
		color: #1a73e8;
		background: #ffffff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	}

	.inspector-body {
		padding: 18px 16px;
	}
	.node-type {
		display: inline-block;
		margin-bottom: 6px;
		padding: 3px 8px;
		border-radius: 9999px;
		color: #1967d2;
		background: #e8f0fe;
		font:
			800 9px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.inspector h3 {
		margin: 4px 0 8px;
		color: #1e293b;
		font-size: 16.5px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.inspector p {
		margin: 0;
		color: #5f6368;
		font-size: 11.5px;
		line-height: 1.55;
		font-family: 'Manrope', sans-serif;
	}

	.node-config {
		display: grid;
		gap: 11px;
		margin-top: 16px;
	}
	.node-config label {
		display: grid;
		gap: 4px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: 'Manrope', sans-serif;
	}
	.node-config input,
	.node-config select,
	.node-config textarea {
		width: 100%;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		outline: 0;
		padding: 8px 10px;
		color: #1e293b;
		background: #f8fafd;
		font: 650 11px/1.4 monospace;
		transition: all 160ms ease;
	}
	.node-config textarea {
		min-height: 84px;
		resize: vertical;
	}
	.node-config input:focus,
	.node-config select:focus,
	.node-config textarea:focus {
		border-color: #1a73e8;
		background: #ffffff;
		box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.15);
	}

	.node-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-top: 14px;
	}
	.node-actions button {
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		color: #334155;
		background: #f8fafd;
		font:
			700 10.5px/1 'Manrope',
			sans-serif;
		cursor: pointer;
		transition: all 140ms ease;
	}
	.node-actions button:hover {
		background: #ffffff;
		border-color: #1a73e8;
		color: #1a73e8;
	}
	.node-actions .delete-node {
		border-color: #fad2cf !important;
		color: #c5221f !important;
		background: #fce8e6 !important;
	}
	.node-actions .delete-node:hover {
		background: #fad2cf !important;
	}

	.entrypoint {
		margin-top: 16px;
		display: grid;
		gap: 4px;
	}
	.entrypoint span {
		color: #5f6368;
		font:
			750 9.5px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
	}
	.entrypoint code {
		overflow-wrap: anywhere;
		color: #1967d2;
		font: 700 10px/1.4 monospace;
	}

	.property-list {
		margin-top: 20px;
		border-top: 1px solid #f1f4f8;
	}
	.property-list > div {
		min-height: 38px;
		display: grid;
		grid-template-columns: 78px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid #f1f4f8;
	}
	.property-list span {
		color: #5f6368;
		font-size: 10px;
		font-family: 'Manrope', sans-serif;
	}
	.property-list strong {
		color: #1e293b;
		font:
			700 10.5px/1.2 'Manrope',
			sans-serif;
	}
	.property-list strong[data-status='complete'] {
		color: #137333;
	}
	.property-list strong[data-status='running'] {
		color: #b06000;
	}

	.trace {
		margin-top: 16px;
		display: grid;
		gap: 6px;
		padding: 11px 13px;
		border: 1px solid #e8ecf2;
		border-radius: 10px;
		background: #f8fafd;
	}
	.trace > div {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #5f6368;
		font:
			800 9.5px/1 'Manrope',
			sans-serif;
		text-transform: uppercase;
	}
	.trace code {
		color: #1967d2;
		font: 700 10px/1.4 monospace;
		overflow-wrap: anywhere;
	}
	.trace p {
		margin: 0;
		color: #475569;
		font: 650 10px/1.4 monospace;
	}
	.trace b {
		color: #5f6368;
	}

	.protected {
		margin-top: 18px;
		display: flex;
		gap: 10px;
		padding: 11px 13px;
		border: 1px solid #feefc3;
		border-radius: 10px;
		color: #b06000;
		background: #fef7e0;
	}
	.protected div {
		display: grid;
		gap: 3px;
	}
	.protected strong {
		font-size: 11px;
		color: #b06000;
		font-family: 'Manrope', sans-serif;
	}
	.protected span {
		color: #804b00;
		font-size: 9.5px;
		line-height: 1.35;
	}

	/* Runs Tab & Timeline */
	.run-input {
		display: grid;
		gap: 5px;
		margin-bottom: 14px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 750;
		text-transform: uppercase;
		font-family: 'Manrope', sans-serif;
	}
	.run-input textarea {
		width: 100%;
		min-height: 85px;
		resize: vertical;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 8px;
		outline: 0;
		color: #1e293b;
		background: #f8fafd;
		font: 650 10.5px/1.4 monospace;
	}
	.run-history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 750;
		text-transform: uppercase;
		font-family: 'Manrope', sans-serif;
	}
	.run-history-head button {
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		border: 1px solid #e2e8f0;
		border-radius: 50%;
		color: #475569;
		background: #ffffff;
		cursor: pointer;
	}
	.run-picker {
		display: grid;
		gap: 5px;
		margin-bottom: 12px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 750;
		text-transform: uppercase;
		font-family: 'Manrope', sans-serif;
	}
	.run-picker select {
		width: 100%;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 7px 9px;
		color: #1e293b;
		background: #f8fafd;
		font: 650 10px/1.3 monospace;
	}
	.attempts-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 14px 0 7px;
		color: #475569;
		font: 750 9.5px/1.3 'Manrope', sans-serif;
		text-transform: uppercase;
	}
	.attempts-head strong {
		color: #1a73e8;
		font: 750 10px/1 monospace;
	}
	.step-attempts {
		display: grid;
		gap: 6px;
	}
	.step-attempts > div {
		display: grid;
		gap: 3px;
		border-left: 3px solid #34a853;
		padding: 7px 8px;
		background: #f8fafc;
	}
	.step-attempts > div.failed {
		border-left-color: #d93025;
		background: #fff8f7;
	}
	.step-attempts header {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		color: #1e293b;
		font: 700 9.5px/1.3 'Manrope', sans-serif;
	}
	.step-attempts header span {
		color: #64748b;
		text-transform: uppercase;
	}
	.step-attempts small {
		overflow-wrap: anywhere;
		color: #64748b;
		font: 600 9px/1.4 monospace;
	}
	.execution-timeline {
		display: grid;
		gap: 6px;
		margin-bottom: 14px;
		padding-bottom: 12px;
		border-bottom: 1px solid #f1f4f8;
	}
	.run-status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.run-status-row > span {
		color: #1a73e8;
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		font-family: 'Manrope', sans-serif;
	}
	.cancel-run {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border: 1px solid #fad2cf;
		border-radius: 6px;
		padding: 5px 7px;
		color: #c5221f;
		background: #fff8f7;
		font:
			750 9.5px/1 'Manrope',
			sans-serif;
		cursor: pointer;
	}
	.cancel-run:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.execution-timeline strong {
		color: #1e293b;
		font-size: 11px;
		line-height: 1.4;
		font-family: 'Manrope', sans-serif;
	}
	.execution-timeline small {
		overflow-wrap: anywhere;
		color: #64748b;
		font: 650 9px/1.4 monospace;
	}

	.run-detail {
		margin: 4px 0 8px;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		background: #f8fafd;
	}
	.run-detail summary {
		cursor: pointer;
		padding: 7px 9px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 750;
		font-family: 'Manrope', sans-serif;
	}
	.run-detail pre {
		max-height: 160px;
		overflow: auto;
		margin: 0;
		border-top: 1px solid #e2e8f0;
		padding: 9px;
		color: #1e293b;
		font: 650 10px/1.45 monospace;
		white-space: pre-wrap;
	}
	.run-detail.error {
		border-color: #fad2cf;
	}
	.run-detail.error summary {
		color: #c5221f;
	}

	.run-events {
		display: grid;
		gap: 6px;
	}
	.run-events > div {
		display: grid;
		gap: 2px;
		border-left: 2.5px solid #1a73e8;
		padding: 5px 0 5px 9px;
	}
	.run-events b {
		overflow-wrap: anywhere;
		color: #1e293b;
		font: 700 10px/1.35 monospace;
	}
	.run-events span,
	.run-events time,
	.run-empty {
		color: #64748b;
		font-size: 9.5px;
	}
	.run-events time {
		font-family: monospace;
	}
	.run-empty {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 0;
	}
	.run-empty.error {
		color: #c5221f;
	}

	/* SvelteFlow Global Overrides */
	:global(.svelte-flow__edge-text) {
		fill: #475569;
		font:
			700 10px/1 'Manrope',
			sans-serif;
	}
	:global(.svelte-flow__edge-textbg) {
		fill: #ffffff;
		rx: 4px;
	}
	:global(.svelte-flow__background-pattern) {
		fill: #cbd5e1;
	}
	:global(.svelte-flow__controls) {
		overflow: hidden;
		border: 1px solid #e8ecf2 !important;
		border-radius: 12px !important;
		background: #ffffff !important;
		box-shadow: 0 4px 16px rgba(26, 115, 232, 0.1) !important;
	}
	:global(.svelte-flow__controls-button) {
		border-bottom: 1px solid #f1f4f8 !important;
		color: #5f6368 !important;
		background: #ffffff !important;
	}
	:global(.svelte-flow__controls-button:hover) {
		background: #f8fafd !important;
		color: #1a73e8 !important;
	}
	:global(.svelte-flow__minimap) {
		overflow: hidden;
		border: 1px solid #e8ecf2 !important;
		border-radius: 12px !important;
		background: rgba(255, 255, 255, 0.94) !important;
		box-shadow: 0 4px 16px rgba(26, 115, 232, 0.08) !important;
	}

	@media (max-width: 800px) {
		.canvas-toolbar {
			align-items: flex-start;
			flex-direction: column;
			padding: 12px 14px;
		}
		.scenario-heading p {
			display: none;
		}
		.legend {
			display: none;
		}
		.engine-body {
			height: auto;
			min-height: 0;
			grid-template-columns: 1fr;
			grid-template-rows: auto 450px auto;
		}
		.process-catalog {
			border-right: 0;
			border-bottom: 1px solid #e8ecf2;
		}
		.process-catalog > header {
			display: none;
		}
		.process-catalog nav {
			max-height: 120px;
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			padding: 6px;
		}
		.process-catalog section {
			margin: 0;
		}
		.process-catalog h3 {
			display: none;
		}
		.process-catalog button {
			width: auto;
			min-height: 32px;
			padding: 4px 8px;
		}
		.ai-dock {
			width: calc(100% - 30px);
		}
		.inspector {
			border-left: 0;
			border-top: 1px solid #e8ecf2;
		}
	}
</style>
