import { can, sellerIds, type WorkflowEvent, type WorkflowResult, type WorkflowState } from './workflow';
import type { Persona } from './gateway';

export type EvidenceDocument = { id: string; ownerId: string; category: 'identity' | 'account' | 'registration' | 'other'; version: number; name: string; content: string; expires: string; author: string; at: string; status: 'submitted' | 'accepted' | 'rejected'; reviewer?: string; reviewedAt?: string; reason: string };
export type DocumentCommand =
	| { type: 'document.submit'; id: string; ownerId: string; category: EvidenceDocument['category']; name: string; content: string; expires: string }
	| { type: 'document.review'; id: string; version: number; status: 'accepted' | 'rejected'; reason: string };

export function applyDocument(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const command = event.command as DocumentCommand;
	const next = structuredClone(state);
	const documents = next.documents[event.operatorId] ??= [];
	const fail = (error: string): WorkflowResult => ({ ok: false, error });
	if (command.type === 'document.submit') {
		const registration = command.ownerId === 'operator';
		if (registration ? !can(actor, event.operatorId, 'profile') : !sellerIds(event.operatorId, state).includes(command.ownerId) || !(can(actor, event.operatorId, 'compliance') || actor.kind === 'courier' && actor.courierId === command.ownerId)) return fail('FORBIDDEN');
		if (!/^DEMO-doc-[a-z0-9-]{1,40}$/i.test(command.id) || !['identity', 'account', 'registration', 'other'].includes(command.category) || !/^DEMO-[^/\\]{1,100}\.txt$/.test(command.name) || !command.content.startsWith('DEMO') || new TextEncoder().encode(command.content).length > 20000 || !/^20\d{2}-\d{2}-\d{2}$/.test(command.expires) || !Number.isFinite(Date.parse(command.expires)) || new Date(command.expires).toISOString().slice(0, 10) !== command.expires || command.expires <= event.at.slice(0, 10)) return fail('INVALID_DOCUMENT');
		if (documents.length >= 100) return fail('DOCUMENT_LIMIT');
		const previous = documents.filter(document => document.id === command.id).at(-1);
		if (previous && (previous.ownerId !== command.ownerId || previous.category !== command.category)) return fail('DOCUMENT_OWNER_CONFLICT');
		if (previous && previous.content === command.content && previous.name === command.name && previous.expires === command.expires) return { ok: true, state };
		documents.push({ id: command.id, ownerId: command.ownerId, category: command.category, version: (previous?.version ?? 0) + 1, name: command.name, content: command.content, expires: command.expires, author: actor.id, at: event.at, status: 'submitted', reason: '' });
	} else {
		const document = documents.filter(item => item.id === command.id).at(-1);
		if (!document || document.version !== command.version) return fail('DOCUMENT_VERSION_CONFLICT');
		if (!can(actor, event.operatorId, document.ownerId === 'operator' ? 'approve' : 'compliance') || actor.id === document.author) return fail('SECOND_REVIEWER_REQUIRED');
		if (!['accepted', 'rejected'].includes(command.status) || !command.reason?.trim() || command.reason.length > 500) return fail('REASON_REQUIRED');
		if (document.status === command.status && document.reason === command.reason) return { ok: true, state };
		if (document.status !== 'submitted' || document.expires <= event.at.slice(0, 10)) return fail('DOCUMENT_NOT_REVIEWABLE');
		document.status = command.status; document.reason = command.reason; document.reviewer = actor.id; document.reviewedAt = event.at;
	}
	return { ok: true, state: next };
}

export function documentBlockers(documents: EvidenceDocument[], ownerId: string, at: string) {
	const latest = new Map<string, EvidenceDocument>();
	for (const document of documents.filter(item => item.ownerId === ownerId)) latest.set(document.id, document);
	return [...latest.values()].flatMap(document => document.status !== 'accepted' ? [`DOCUMENT_${document.status.toUpperCase()}:${document.id}`] : document.expires <= at.slice(0, 10) ? [`DOCUMENT_EXPIRED:${document.id}`] : []);
}