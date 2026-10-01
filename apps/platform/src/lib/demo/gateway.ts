import { applyWorkflow, emptyWorkflow, replayWorkflow, sellerIds, workflowActor, type WorkflowCommand, type WorkflowEvent, type WorkflowState } from './workflow';
import { balance, financialEntries } from './payouts';
import { unresolvedReports, type Report } from './reports';
import { accessActive } from './access';

export const DEMO_STORAGE_KEY = 'rahunok.platform.demo.v1';

export type Permission = 'profile' | 'finance' | 'approve' | 'compliance' | 'integrations' | 'team';
export type Persona = {
	id: string;
	label: string;
	kind: 'operator' | 'courier' | 'admin';
	operatorId?: string;
	courierId?: string;
	permissions: Permission[];
};

export const personas: Persona[] = [
	{ id: 'varus-owner', label: 'VARUS · оператор', kind: 'operator', operatorId: 'varus', permissions: ['profile', 'finance', 'approve', 'compliance', 'integrations', 'team'] },
	{ id: 'route-owner', label: 'Маршрут · оператор', kind: 'operator', operatorId: 'route', permissions: ['profile', 'finance', 'approve', 'compliance', 'integrations', 'team'] },
	{ id: 'varus-accountant', label: 'VARUS · бухгалтер', kind: 'operator', operatorId: 'varus', permissions: ['finance'] },
	{ id: 'varus-signer', label: 'VARUS · підписант', kind: 'operator', operatorId: 'varus', permissions: ['approve'] },
	{ id: 'varus-compliance', label: 'VARUS · перевірка даних', kind: 'operator', operatorId: 'varus', permissions: ['profile', 'compliance'] },
	{ id: 'varus-integrator', label: 'VARUS · інтегратор', kind: 'operator', operatorId: 'varus', permissions: ['integrations'] },
	{ id: 'courier-1', label: 'Самозайнятий 01 · дві платформи', kind: 'courier', courierId: 'courier-1', permissions: [] },
	{ id: 'rahunok-admin', label: 'Rahunok · адміністратор', kind: 'admin', permissions: [] }
];

export type Section = 'overview' | 'registration' | 'couriers' | 'operations' | 'payouts' | 'reports' | 'integrations' | 'team' | 'audit' | 'platforms';
export const sections: { id: Section; label: string; permission?: Permission }[] = [
	{ id: 'overview', label: 'Огляд' },
	{ id: 'registration', label: 'Реєстрація', permission: 'profile' },
	{ id: 'couriers', label: 'Самозайняті', permission: 'compliance' },
	{ id: 'operations', label: 'Операції', permission: 'finance' },
	{ id: 'payouts', label: 'Виплати', permission: 'finance' },
	{ id: 'reports', label: 'Звіти', permission: 'approve' },
	{ id: 'integrations', label: 'Інтеграції', permission: 'integrations' },
	{ id: 'team', label: 'Команда', permission: 'team' },
	{ id: 'audit', label: 'Журнал' },
	{ id: 'platforms', label: 'Платформи' }
];

export function allowedSections(persona: Persona) {
	if (persona.kind === 'admin') return sections.filter(section => ['overview', 'platforms', 'audit'].includes(section.id));
	if (persona.kind === 'courier') return sections.filter(section => ['overview', 'couriers', 'operations', 'payouts', 'reports', 'platforms'].includes(section.id));
	return sections.filter(section => section.id !== 'platforms' && (!section.permission || persona.permissions.includes(section.permission) || ['registration', 'payouts'].includes(section.id) && persona.permissions.includes('approve') || section.id === 'reports' && persona.permissions.includes('finance')));
}

export function readContext(search: string, role?: string | null, contexts = personas) {
	const params = new URLSearchParams(search);
	const defaultPersona = role === 'platform' ? 'varus-owner' : 'courier-1';
	const persona = contexts.find(item => item.id === params.get('persona')) ?? contexts.find(item => item.id === defaultPersona)!;
	const section = allowedSections(persona).find(item => item.id === params.get('section'))?.id ?? 'overview';
	return { persona, section };
}

type Operator = { id: string; name: string; contact: string };
type Courier = { id: string; name: string };
type Relationship = { operatorId: string; courierId: string };
export type Entry = { id: string; operatorId: string; courierId: string; period: string; customerMinor: number; incomeMinor: number; paidMinor: number };
type AuditEntry = { id: number; actorId: string; operatorId: string; action: string; at: string; workflowEventCount?: number };
type DemoState = { version: 1; revision: number; operators: Operator[]; couriers: Courier[]; relationships: Relationship[]; entries: Entry[]; audit: AuditEntry[]; events?: WorkflowEvent[] };
export type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type DemoError = 'FORBIDDEN' | 'INVALID_CONTACT' | 'STORAGE_UNAVAILABLE' | 'CONFLICT';
export type Result = { ok: true } | { ok: false; error: DemoError };

export function seedState(): DemoState {
	return {
		version: 1, revision: 0,
		operators: [{ id: 'varus', name: 'VARUS Delivery', contact: 'operations@varus.example' }, { id: 'route', name: 'Маршрут Delivery', contact: 'operations@route.example' }],
		couriers: [1, 2, 3, 4].map(number => ({ id: `courier-${number}`, name: `Кур’єр 0${number}` })),
		relationships: [
			{ operatorId: 'varus', courierId: 'courier-1' }, { operatorId: 'varus', courierId: 'courier-2' }, { operatorId: 'varus', courierId: 'courier-3' },
			{ operatorId: 'route', courierId: 'courier-1' }, { operatorId: 'route', courierId: 'courier-4' }
		],
		entries: [
			{ id: 'demo-v-001', operatorId: 'varus', courierId: 'courier-1', period: '2026-08', customerMinor: 120000, incomeMinor: 18000, paidMinor: 12000 },
			{ id: 'demo-v-002', operatorId: 'varus', courierId: 'courier-1', period: '2026-09', customerMinor: 90000, incomeMinor: 15000, paidMinor: 0 },
			{ id: 'demo-v-003', operatorId: 'varus', courierId: 'courier-2', period: '2026-09', customerMinor: 200000, incomeMinor: 30000, paidMinor: 30000 },
			{ id: 'demo-v-004', operatorId: 'varus', courierId: 'courier-3', period: '2026-08', customerMinor: 150000, incomeMinor: 22000, paidMinor: 10000 },
			{ id: 'demo-r-001', operatorId: 'route', courierId: 'courier-1', period: '2026-09', customerMinor: 100000, incomeMinor: 20000, paidMinor: 5000 },
			{ id: 'demo-r-002', operatorId: 'route', courierId: 'courier-4', period: '2026-08', customerMinor: 70000, incomeMinor: 14000, paidMinor: 14000 }
		],
		audit: []
	};
}

export function totals(entries: Entry[], sellers?: { operatorId: string; courierId: string; kind: string }[]) {
	return entries.reduce((sum, entry) => {
		const balance = entry.incomeMinor - entry.paidMinor;
		let tax = 0;
		if (sellers && balance > 0) {
			const profile = sellers.find(p => p.operatorId === entry.operatorId && p.courierId === entry.courierId);
			if (profile?.kind !== 'fop') tax = Math.floor(balance * 0.1);
		}
		return {
			customerMinor: sum.customerMinor + entry.customerMinor,
			incomeMinor: sum.incomeMinor + entry.incomeMinor,
			paidMinor: sum.paidMinor + entry.paidMinor,
			balanceMinor: sum.balanceMinor + balance,
			taxMinor: sum.taxMinor + tax
		};
	}, { customerMinor: 0, incomeMinor: 0, paidMinor: 0, balanceMinor: 0, taxMinor: 0 });
}

function parseState(raw: string): DemoState | null {
	try {
		const candidate = JSON.parse(raw) as DemoState;
		const seed = seedState();
		if (candidate.version !== 1 || !Number.isSafeInteger(candidate.revision) || candidate.revision < 0) return null;
		if (!Array.isArray(candidate.operators) || candidate.operators.length !== seed.operators.length) return null;
		if (!candidate.operators.every((operator, index) => operator.id === seed.operators[index].id && operator.name === seed.operators[index].name && validContact(operator.contact))) return null;
		if (JSON.stringify(candidate.couriers) !== JSON.stringify(seed.couriers) || JSON.stringify(candidate.relationships) !== JSON.stringify(seed.relationships) || JSON.stringify(candidate.entries) !== JSON.stringify(seed.entries)) return null;
		if (!Array.isArray(candidate.audit) || candidate.audit.length > 500 || candidate.audit.length !== candidate.revision) return null;
		if (!candidate.audit.every((entry, index) => {
			const count = entry.workflowEventCount ?? 0;
			if (!Number.isSafeInteger(count) || count < 0 || count > (candidate.events?.length ?? 0)) return false;
			const history = replayWorkflow((candidate.events ?? []).slice(0, count));
			const actor = history && workflowActor(history, entry.actorId);
			return entry.id === index + 1 && actor?.operatorId === entry.operatorId && actor.permissions.includes('profile') && entry.action === 'contact.updated' && Number.isFinite(Date.parse(entry.at));
		})) return null;
		if (candidate.events !== undefined && !replayWorkflow(candidate.events)) return null;
		return candidate;
	} catch { return null; }
}

function validContact(contact: unknown): contact is string {
	return typeof contact === 'string' && contact.length <= 120 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.example$/i.test(contact);
}

export function createDemoGateway(storage: DemoStorage | null) {
	let state = seedState();
	let baseline: string | null = null;
	let warning: 'CORRUPT_STORAGE' | 'STORAGE_UNAVAILABLE' | null = null;
	try {
		if (!storage) warning = 'STORAGE_UNAVAILABLE';
		else {
			baseline = storage.getItem(DEMO_STORAGE_KEY);
			if (baseline !== null) {
				const restored = parseState(baseline);
				if (restored) state = restored;
				else warning = 'CORRUPT_STORAGE';
			}
		}
	} catch { warning = 'STORAGE_UNAVAILABLE'; }
	function relationships(workflow: WorkflowState) {
		return [...state.relationships, ...workflow.participants.flatMap(participant => participant.operatorIds.map(operatorId => ({ operatorId, courierId: participant.id })))];
	}
	function ownsFinance(workflow: WorkflowState, actor: Persona, operatorId: string, courierId: string) {
		return actor.courierId === courierId && (!courierId.startsWith('DEMO-seller-') || workflow.sellers[operatorId]?.some(profile => profile.courierId === courierId && profile.linked));
	}

	function commit(next: DemoState): Result {
		try {
			if (!storage) return { ok: false, error: 'STORAGE_UNAVAILABLE' };
			if (storage.getItem(DEMO_STORAGE_KEY) !== baseline) return { ok: false, error: 'CONFLICT' };
			const serialized = JSON.stringify(next);
			storage.setItem(DEMO_STORAGE_KEY, serialized);
			baseline = serialized;
			state = next;
			warning = null;
			return { ok: true };
		} catch { return { ok: false, error: 'STORAGE_UNAVAILABLE' }; }
	}

	return {
		get warning() { return warning; },
		accessRequests(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			return structuredClone(Object.entries(workflow.access).flatMap(([operatorId, requests]) => requests.filter(request => actor?.kind === 'admin' ? request.requester === actor.id : actor?.operatorId === operatorId && actor.permissions.includes('approve') && actor.permissions.includes(request.scope === 'profile' ? 'compliance' : 'finance')).map(request => ({ ...request, operatorId }))));
		},
		readAccess(actorId: string, operatorId: string, id: string) {
			const result = this.command(actorId, operatorId, { type: 'access.read', id });
			if (!result.ok) return { ok: false as const, error: result.error };
			const workflow = replayWorkflow(state.events ?? [])!;
			const request = workflow.access[operatorId]?.find(item => item.id === id);
			if (!request || !accessActive(request, actorId, new Date().toISOString())) return { ok: false as const, error: 'ACCESS_NOT_ACTIVE' };
			return { ok: true as const, data: structuredClone(request.scope === 'profile' ? { profile: workflow.sellers[operatorId]?.find(profile => profile.courierId === request.courierId) ?? null } : { entries: financialEntries(workflow).filter(entry => entry.operatorId === operatorId && entry.courierId === request.courierId) }) };
		},
		membership(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			return actor?.operatorId ? workflow.members[actor.operatorId]?.find(member => member.id === actor.id)?.status ?? 'active' : null;
		},
		technicalAudit(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			return (state.events ?? []).flatMap(event => event.command.type === 'operator.status' && (actor?.kind === 'admin' || actor?.operatorId === event.operatorId && actor.permissions.length > 0) ? [{ operatorId: event.operatorId, actorId: event.actorId, at: event.at, suspended: event.command.suspended, reason: event.command.reason }] : []);
		},
		operations(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			return state.operators.filter(operator => actor?.kind === 'admin' || actor?.kind === 'operator' && actor.permissions.length > 0 && actor.operatorId === operator.id).map(operator => ({ id: operator.id, name: operator.name, suspended: workflow.operations[operator.id]?.suspended ?? false, registration: workflow.registrations[operator.id]?.at(-1)?.status ?? 'not_started', activeKeys: (workflow.ledger.keys[operator.id] ?? []).filter(key => key.status === 'active').length, eventCount: (workflow.ledger.events[operator.id] ?? []).length, unresolvedPayouts: (workflow.payouts.external[operator.id] ?? []).filter(item => ['pending', 'unknown'].includes(item.status)).length + (workflow.payouts.batches[operator.id] ?? []).flatMap(batch => batch.cancelled ? [] : batch.instructions).filter(item => ['pending', 'unknown'].includes(item.status)).length, reportIssues: unresolvedReports(workflow.reports[operator.id] ?? []).length }));
		},
		issues(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			if (workflowActor(workflow, personaId)?.kind !== 'admin') return [];
			return state.operators.flatMap(({ id: operatorId }) => {
				const registration = workflow.registrations[operatorId]?.at(-1);
				return [
					...(registration && ['clarification', 'rejected', 'unavailable'].includes(registration.status) ? [{ operatorId, resource: 'registration', reference: 'latest', status: registration.status }] : []),
					...(workflow.payouts.external[operatorId] ?? []).filter(item => ['pending', 'unknown'].includes(item.status)).map(item => ({ operatorId, resource: 'external-payout', reference: item.id, status: item.status })),
					...(workflow.payouts.batches[operatorId] ?? []).filter(batch => !batch.cancelled).flatMap(batch => [...new Set(batch.instructions.filter(item => ['pending', 'unknown', 'rejected'].includes(item.status)).map(item => item.status))].map(status => ({ operatorId, resource: 'batch', reference: batch.id, status }))),
					...unresolvedReports(workflow.reports[operatorId] ?? []).map(report => ({ operatorId, resource: 'report', reference: report.id, status: report.status }))
				];
			});
		},
		journal(personaId: string) {
			const actor = workflowActor(replayWorkflow(state.events ?? []) ?? emptyWorkflow(), personaId);
			const allowed = (operatorId: string) => actor?.kind === 'admin' || actor?.kind === 'operator' && actor.operatorId === operatorId && actor.permissions.length > 0;
			return [
				...(state.events ?? []).filter(event => allowed(event.operatorId)).map(event => ({ actorId: event.actorId, operatorId: event.operatorId, at: event.at, action: event.command.type, result: 'applied' as const })),
				...state.audit.filter(event => allowed(event.operatorId)).map(event => ({ actorId: event.actorId, operatorId: event.operatorId, at: event.at, action: event.action, result: 'applied' as const }))
			].sort((left, right) => right.at.localeCompare(left.at));
		},
		reporting(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			if (actor?.kind !== 'operator' || !actor.operatorId || !actor.permissions.some(permission => ['finance', 'approve'].includes(permission))) return { sellerIds: [], assessments: [] };
			return structuredClone({ sellerIds: sellerIds(actor.operatorId, workflow), assessments: workflow.assessments[actor.operatorId] ?? [] });
		},
		reports(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			return structuredClone(Object.entries(workflow.reports).flatMap<Report & { operatorId: string }>(([operatorId, reports]) => {
				if (actor?.kind === 'operator' && actor.operatorId === operatorId && (actor.permissions.includes('finance') || actor.permissions.includes('approve'))) return reports.map(report => ({ ...report, operatorId, rows: report.rows.map(row => ({ ...row, profile: actor.permissions.includes('compliance') ? row.profile : undefined })) }));
				if (actor?.kind !== 'courier' || !ownsFinance(workflow, actor, operatorId, actor.courierId!)) return [];
				return reports.filter(report => report.status === 'accepted' && report.rows.some(row => row.courierId === actor.courierId)).map(report => ({ ...report, operatorId, rows: report.rows.filter(row => row.courierId === actor.courierId).map(row => ({ ...row, assessment: undefined })), sources: report.sources.filter(source => source.courierId === actor.courierId), blockers: [], reason: '', decision: '', author: '', approvedBy: undefined }));
			}));
		},
		payouts(personaId: string, period: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			const allowed = (operatorId: string, courierId: string) => actor?.kind === 'courier' ? ownsFinance(workflow, actor, operatorId, courierId) : actor?.operatorId === operatorId && (actor.permissions.includes('finance') || actor.permissions.includes('approve'));
			return structuredClone({
				batches: Object.entries(workflow.payouts.batches).flatMap(([operatorId, batches]) => batches.filter(batch => batch.period === period).map(batch => ({ ...batch, author: actor?.kind === 'courier' ? '' : batch.author, approvedBy: actor?.kind === 'courier' ? undefined : batch.approvedBy, operatorId, instructions: batch.instructions.filter(item => allowed(operatorId, item.courierId)).map(item => ({ ...item, evidence: actor?.kind === 'courier' ? '' : item.evidence })) })).filter(batch => batch.instructions.length)),
				external: Object.entries(workflow.payouts.external).flatMap(([operatorId, records]) => records.filter(item => item.period === period && allowed(operatorId, item.courierId)).map(({ request, ...item }) => ({ ...item, actorId: actor?.kind === 'courier' ? '' : item.actorId, evidence: actor?.kind === 'courier' ? '' : item.evidence, operatorId }))),
				balances: relationships(workflow).filter(item => allowed(item.operatorId, item.courierId)).map(item => ({ ...item, ...balance(workflow, item.operatorId, item.courierId, period) }))
			});
		},
		integration(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			const operatorId = actor?.kind === 'operator' ? actor.operatorId : undefined;
			return structuredClone({
				sellerIds: operatorId && actor?.permissions.some(permission => ['integrations', 'finance'].includes(permission)) ? sellerIds(operatorId, workflow) : [],
				keys: operatorId && actor?.permissions.includes('integrations') ? workflow.ledger.keys[operatorId] ?? [] : [],
				events: operatorId && actor?.permissions.includes('finance') ? workflow.ledger.events[operatorId] ?? [] : []
			});
		},
		workflow(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const actor = workflowActor(workflow, personaId);
			const participants = relationships(workflow).filter(item => actor?.kind === 'courier' ? item.courierId === actor.courierId : actor?.operatorId === item.operatorId && actor.permissions.includes('compliance')).map(item => {
				const participant = workflow.participants.find(person => person.id === item.courierId);
				return { id: item.courierId, operatorId: item.operatorId, name: participant?.name ?? state.couriers.find(person => person.id === item.courierId)!.name.replace('Кур’єр', 'Самозайнятий'), activity: participant?.activity ?? 'delivery' };
			});
			const documents = Object.entries(workflow.documents).flatMap(([operatorId, records]) => records.filter(document => actor?.kind === 'courier' ? document.ownerId === actor.courierId : actor?.operatorId === operatorId && (document.ownerId === 'operator' ? actor.permissions.includes('profile') || actor.permissions.includes('approve') : actor.permissions.includes('compliance'))).map(document => ({ ...document, operatorId })));
			return structuredClone({ participants, documents, registrations: actor?.operatorId && (actor.permissions.includes('profile') || actor.permissions.includes('approve')) ? workflow.registrations[actor.operatorId] ?? [] : [], events: actor?.operatorId && actor.permissions.length ? (state.events ?? []).filter(event => event.operatorId === actor.operatorId).map(({ actorId, at, command }) => ({ actorId, at, type: command.type })) : [], sellers: Object.entries(workflow.sellers).flatMap(([operatorId, profiles]) => profiles.filter(profile => actor?.kind === 'courier' ? profile.courierId === actor.courierId : actor?.operatorId === operatorId && actor.permissions.includes('compliance')).map(profile => ({ ...profile, operatorId }))), members: actor?.operatorId && actor.permissions.includes('team') ? workflow.members[actor.operatorId] ?? [] : [] });
		},
		contexts() {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			return [...personas.map(persona => workflowActor(workflow, persona.id)!), ...workflow.participants.map(participant => workflowActor(workflow, participant.id)!), ...Object.values(workflow.members).flat().filter(member => !personas.some(persona => persona.id === member.id)).map(member => workflowActor(workflow, member.id)!)];
		},
		importRecords(actorId: string, operatorId: string, command: Extract<WorkflowCommand, { type: 'ledger.import' }>): import('./ledger').ImportResult {
			const before = replayWorkflow(state.events ?? []);
			const result = this.command(actorId, operatorId, command);
			if (!result.ok) return { status: 'rejected', error: result.error, rows: [] };
			const after = replayWorkflow(state.events ?? [])!;
			const rows = command.rows.map(row => {
				const original = after.ledger.events[operatorId].find(item => item.id === row.id && item.kind === row.kind)!;
				const replayed = before?.ledger.events[operatorId]?.some(item => item.id === row.id && item.kind === row.kind);
				return { id: row.id, kind: row.kind, status: replayed ? 'replayed' as const : 'processed' as const, receipt: `DEMO:${operatorId}:${row.kind}:${row.id}`, receivedAt: original.receivedAt };
			});
			return { status: rows.every(row => row.status === 'replayed') ? 'replayed' : 'processed', rows };
		},
		command(actorId: string, operatorId: string, command: WorkflowCommand): { ok: true } | { ok: false; error: string } {
			const events = state.events ?? [];
			if (events.length >= 2000) return { ok: false, error: 'CONFLICT' };
			const workflow = replayWorkflow(events);
			if (!workflow) return { ok: false, error: 'CORRUPT_STORAGE' };
			const event = { actorId, operatorId, command: command.type === 'report.create' ? { ...command, ruleset: 'DEMO-UA-v2' as const } : command, at: new Date().toISOString(), evidencePolicy: 2 as const };
			const result = applyWorkflow(workflow, event);
			if (!result.ok) return result;
			if (result.state === workflow) return { ok: true };
			return commit({ ...state, events: [...events, event] });
		},
		view(personaId: string) {
			const workflow = replayWorkflow(state.events ?? []) ?? emptyWorkflow();
			const persona = workflowActor(workflow, personaId);
			if (!persona) throw new Error('FORBIDDEN');
			const ownRelationships = relationships(workflow).filter(item => persona.kind === 'operator' ? item.operatorId === persona.operatorId : persona.kind === 'courier' && item.courierId === persona.courierId);
			const operators = state.operators.filter(item => persona.kind === 'admin' || (persona.kind === 'operator' ? item.id === persona.operatorId : ownRelationships.some(relation => relation.operatorId === item.id)));
			const canReadFinance = persona.kind === 'courier' || persona.kind === 'operator' && persona.permissions.includes('finance');
			const entries = canReadFinance ? financialEntries(workflow).filter(item => persona.kind === 'operator' ? item.operatorId === persona.operatorId : ownsFinance(workflow, persona, item.operatorId, item.courierId)) : [];
			const couriers = [...state.couriers, ...workflow.participants].filter(item => (persona.kind === 'courier' || persona.permissions.includes('compliance')) && ownRelationships.some(relation => relation.courierId === item.id)).map(item => ({ ...item, name: item.name.replace('Кур’єр', 'Самозайнятий') }));
			const audit = persona.kind === 'operator' && persona.permissions.length > 0 ? state.audit.filter(item => item.operatorId === persona.operatorId) : [];
			return structuredClone({ operators: operators.map(operator => ({ ...operator, contact: persona.kind === 'operator' && persona.permissions.includes('profile') ? operator.contact : '' })), couriers, entries, audit, canReadFinance });
		},
		updateContact(personaId: string, operatorId: string, contact: string): Result {
			const persona = workflowActor(replayWorkflow(state.events ?? []) ?? emptyWorkflow(), personaId);
			if (!persona || persona.kind !== 'operator' || persona.operatorId !== operatorId || !persona.permissions.includes('profile')) return { ok: false, error: 'FORBIDDEN' };
			if (replayWorkflow(state.events ?? [])?.operations[operatorId]?.suspended) return { ok: false, error: 'FORBIDDEN' };
			if (!validContact(contact)) return { ok: false, error: 'INVALID_CONTACT' };
			if (state.audit.length >= 500) return { ok: false, error: 'CONFLICT' };
			const next = structuredClone(state);
			next.operators.find(item => item.id === operatorId)!.contact = contact;
			next.revision += 1;
			next.audit.push({ id: next.revision, actorId: personaId, operatorId, action: 'contact.updated', at: new Date().toISOString(), workflowEventCount: state.events?.length ?? 0 });
			return commit(next);
		},
		reset(): Result { return commit(seedState()); }
	};
}

export type DemoGateway = ReturnType<typeof createDemoGateway>;