import type { ProcessDefinition, ProcessNode, ProcessEdge } from './process-definition';

export type SandboxStepLog = {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	timestamp: number;
	action: string;
	contextSnapshot: Record<string, unknown>;
	branchTaken?: string;
};

export type SandboxState = {
	status: 'idle' | 'running' | 'waiting_event' | 'complete' | 'failed';
	currentNodeId: string | null;
	context: Record<string, unknown>;
	history: SandboxStepLog[];
	traversedNodeIds: string[];
	traversedEdgeIds: string[];
	waitingEvent?: {
		eventType: string;
		resultKey: string;
		nodeId: string;
	};
	error?: string;
};

export const SANDBOX_PRESETS: Array<{ id: string; label: string; payload: Record<string, unknown> }> = [
	{
		id: 'checkout-monobank',
		label: 'Оплата замовлення (Monobank / LiqPay)',
		payload: {
			orderId: 'ORD-8921',
			amount: 45000,
			currency: 'UAH',
			customer: {
				name: 'Олександр М.',
				email: 'alex@example.com',
				phone: '+380671234567'
			},
			paymentMethod: 'mono_pay',
			status: 'pending'
		}
	},
	{
		id: 'pos-receipt',
		label: 'Фіскалізація чека POS (Checkbox / Вчасно)',
		payload: {
			receiptId: 'RCP-3041',
			shiftId: 'SFT-09',
			cashier: 'Марія К.',
			totalAmount: 1250,
			itemsCount: 2,
			fiscalStatus: 'created'
		}
	},
	{
		id: 'merchant-onboarding',
		label: 'Онбординг та верифікація мерчанта',
		payload: {
			merchantId: 'MCH-551',
			legalName: 'ТОВ "Смак"',
			edrpou: '38192031',
			iban: 'UA213052990000026001234567890',
			riskScore: 12,
			verificationStatus: 'unverified'
		}
	}
];

function resolvePath(obj: unknown, path: string): unknown {
	if (!path || path === '$') return obj;
	const clean = path.replace(/^\$\.?/, '');
	if (!clean) return obj;
	const parts = clean.split('.');
	let current: unknown = obj;
	for (const part of parts) {
		if (typeof current !== 'object' || current === null) return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function initSandbox(definition: ProcessDefinition, initialInput: Record<string, unknown>): SandboxState {
	const triggerNode = definition.nodes.find(
		(n) => n.type === 'trigger-http' || n.type === 'trigger-schedule' || n.type === 'trigger-event'
	);
	const startNodeId = triggerNode?.id ?? definition.nodes[0]?.id ?? null;

	return {
		status: startNodeId ? 'running' : 'idle',
		currentNodeId: startNodeId,
		context: structuredClone(initialInput),
		history: [],
		traversedNodeIds: startNodeId ? [startNodeId] : [],
		traversedEdgeIds: []
	};
}

export function stepSandbox(definition: ProcessDefinition, state: SandboxState): SandboxState {
	if (state.status !== 'running' || !state.currentNodeId) {
		return state;
	}

	const node = definition.nodes.find((n) => n.id === state.currentNodeId);
	if (!node) {
		return {
			...state,
			status: 'failed',
			error: `Вузол з id ${state.currentNodeId} не знайдено.`
		};
	}

	const nextContext = structuredClone(state.context);
	let branchTaken: string | undefined;
	let logAction = `Виконано ${node.name}`;

	// Step logic evaluation
	if (node.type === 'trigger-http' || node.type === 'trigger-schedule' || node.type === 'trigger-event') {
		logAction = `Тригер активовано із вхідними даними`;
	} else if (node.type === 'http-request') {
		nextContext[`http_${node.id}`] = { status: 200, ok: true, data: { success: true } };
		logAction = `HTTP виклик ${node.config.method} ${node.config.url} (200 OK)`;
	} else if (node.type === 'transform') {
		if (node.config.mode === 'merge') {
			for (const [key, expr] of Object.entries(node.config.mappings)) {
				const resolved = resolvePath(state.context, expr);
				nextContext[key] = resolved !== undefined ? resolved : expr;
			}
		} else {
			const replaced: Record<string, unknown> = {};
			for (const [key, expr] of Object.entries(node.config.mappings)) {
				const resolved = resolvePath(state.context, expr);
				replaced[key] = resolved !== undefined ? resolved : expr;
			}
			Object.assign(nextContext, replaced);
		}
		logAction = `Трансформація контексту даних`;
	} else if (node.type === 'condition') {
		const targetVal = resolvePath(state.context, node.config.path);
		let conditionResult = false;
		switch (node.config.operator) {
			case 'equals':
				conditionResult = String(targetVal) === String(node.config.value);
				break;
			case 'not-equals':
				conditionResult = String(targetVal) !== String(node.config.value);
				break;
			case 'greater-than':
				conditionResult = Number(targetVal) > Number(node.config.value);
				break;
			case 'less-than':
				conditionResult = Number(targetVal) < Number(node.config.value);
				break;
			case 'exists':
				conditionResult = targetVal !== undefined && targetVal !== null;
				break;
		}
		branchTaken = conditionResult ? 'true' : 'false';
		logAction = `Перевірка умови (${node.config.path} ${node.config.operator} ${node.config.value ?? ''}) → ${branchTaken}`;
	} else if (node.type === 'wait-event') {
		// Event pause
		return {
			...state,
			status: 'waiting_event',
			waitingEvent: {
				eventType: node.config.eventType,
				resultKey: node.config.resultKey,
				nodeId: node.id
			},
			history: [
				...state.history,
				{
					nodeId: node.id,
					nodeName: node.name,
					nodeType: node.type,
					timestamp: Date.now(),
					action: `Очікування події '${node.config.eventType}' (timeout: ${node.config.timeoutMs}ms)`,
					contextSnapshot: structuredClone(state.context)
				}
			]
		};
	} else if (node.type === 'approval') {
		return {
			...state,
			status: 'waiting_event',
			waitingEvent: {
				eventType: 'approval_decision',
				resultKey: node.config.resultKey,
				nodeId: node.id
			},
			history: [
				...state.history,
				{
					nodeId: node.id,
					nodeName: node.name,
					nodeType: node.type,
					timestamp: Date.now(),
					action: `Очікування погодження оператора (${node.config.assigneeUserId})`,
					contextSnapshot: structuredClone(state.context)
				}
			]
		};
	} else if (node.type === 'end-success') {
		return {
			...state,
			status: 'complete',
			history: [
				...state.history,
				{
					nodeId: node.id,
					nodeName: node.name,
					nodeType: node.type,
					timestamp: Date.now(),
					action: `Процес успішно завершено`,
					contextSnapshot: nextContext
				}
			]
		};
	} else if (node.type === 'end-failure') {
		return {
			...state,
			status: 'failed',
			error: node.config.message || 'Процес завершився з контрольованою помилкою',
			history: [
				...state.history,
				{
					nodeId: node.id,
					nodeName: node.name,
					nodeType: node.type,
					timestamp: Date.now(),
					action: `Збій процесу: ${node.config.code}`,
					contextSnapshot: nextContext
				}
			]
		};
	}

	// Find next edge and next node
	const outgoingEdges = definition.edges.filter((e) => e.source === node.id);
	let nextEdge: ProcessEdge | undefined;

	if (branchTaken !== undefined) {
		const isTrue = branchTaken === 'true';
		nextEdge = outgoingEdges.find((e) => e.when === isTrue) ?? outgoingEdges[0];
	} else {
		nextEdge = outgoingEdges[0];
	}

	const nextNodeId = nextEdge ? nextEdge.target : null;

	const newLog: SandboxStepLog = {
		nodeId: node.id,
		nodeName: node.name,
		nodeType: node.type,
		timestamp: Date.now(),
		action: logAction,
		contextSnapshot: nextContext,
		branchTaken
	};

	if (!nextNodeId) {
		return {
			...state,
			status: 'complete',
			currentNodeId: null,
			context: nextContext,
			history: [...state.history, newLog],
			traversedNodeIds: [...state.traversedNodeIds],
			traversedEdgeIds: nextEdge ? [...state.traversedEdgeIds, nextEdge.id] : state.traversedEdgeIds
		};
	}

	return {
		...state,
		status: 'running',
		currentNodeId: nextNodeId,
		context: nextContext,
		history: [...state.history, newLog],
		traversedNodeIds: [...state.traversedNodeIds, nextNodeId],
		traversedEdgeIds: nextEdge ? [...state.traversedEdgeIds, nextEdge.id] : state.traversedEdgeIds
	};
}

export function injectSandboxEvent(
	definition: ProcessDefinition,
	state: SandboxState,
	eventPayload: Record<string, unknown>
): SandboxState {
	if (state.status !== 'waiting_event' || !state.waitingEvent || !state.currentNodeId) {
		return state;
	}

	const { resultKey, nodeId } = state.waitingEvent;
	const nextContext = structuredClone(state.context);
	nextContext[resultKey] = eventPayload;

	const outgoingEdges = definition.edges.filter((e) => e.source === nodeId);
	const nextEdge = outgoingEdges[0];
	const nextNodeId = nextEdge ? nextEdge.target : null;

	const resumeLog: SandboxStepLog = {
		nodeId,
		nodeName: 'Callback Resolver',
		nodeType: 'event-resume',
		timestamp: Date.now(),
		action: `Отримано подію '${state.waitingEvent.eventType}'`,
		contextSnapshot: nextContext
	};

	return {
		...state,
		status: nextNodeId ? 'running' : 'complete',
		currentNodeId: nextNodeId,
		context: nextContext,
		waitingEvent: undefined,
		history: [...state.history, resumeLog],
		traversedNodeIds: nextNodeId ? [...state.traversedNodeIds, nextNodeId] : state.traversedNodeIds,
		traversedEdgeIds: nextEdge ? [...state.traversedEdgeIds, nextEdge.id] : state.traversedEdgeIds
	};
}

export function restoreHistorySnapshot(
	definition: ProcessDefinition,
	state: SandboxState,
	stepIndex: number
): SandboxState {
	if (stepIndex < 0 || stepIndex >= state.history.length) {
		return state;
	}

	const targetLog = state.history[stepIndex];
	const historySlice = state.history.slice(0, stepIndex + 1);
	const traversedNodeIds: string[] = [];
	const traversedEdgeIds: string[] = [];

	for (let i = 0; i < historySlice.length; i++) {
		const entry = historySlice[i];
		if (!traversedNodeIds.includes(entry.nodeId)) {
			traversedNodeIds.push(entry.nodeId);
		}
		if (i > 0) {
			const prevNodeId = historySlice[i - 1].nodeId;
			const edge = definition.edges.find((e) => e.source === prevNodeId && e.target === entry.nodeId);
			if (edge && !traversedEdgeIds.includes(edge.id)) {
				traversedEdgeIds.push(edge.id);
			}
		}
	}

	return {
		...state,
		status: stepIndex === state.history.length - 1 ? state.status : 'running',
		currentNodeId: targetLog.nodeId,
		context: structuredClone(targetLog.contextSnapshot),
		traversedNodeIds,
		traversedEdgeIds
	};
}

export function retryFromNode(
	definition: ProcessDefinition,
	state: SandboxState,
	nodeId: string
): SandboxState {
	const node = definition.nodes.find((n) => n.id === nodeId);
	const nodeName = node?.name ?? nodeId;

	const retryLog: SandboxStepLog = {
		nodeId,
		nodeName,
		nodeType: 'retry-attempt',
		timestamp: Date.now(),
		action: `Повторний запуск з вузла "${nodeName}"`,
		contextSnapshot: structuredClone(state.context)
	};

	return {
		...state,
		status: 'running',
		currentNodeId: nodeId,
		error: undefined,
		history: [...state.history, retryLog],
		traversedNodeIds: state.traversedNodeIds.includes(nodeId)
			? state.traversedNodeIds
			: [...state.traversedNodeIds, nodeId]
	};
}
