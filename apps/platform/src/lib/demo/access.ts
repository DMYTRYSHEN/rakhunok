import { can, sellerIds, type WorkflowEvent, type WorkflowResult, type WorkflowState } from './workflow';
import type { Persona } from './gateway';

export type AccessRequest = { id: string; requester: string; courierId: string; scope: 'profile' | 'finance'; reason: string; requestedAt: string; status: 'pending' | 'approved' | 'rejected' | 'revoked'; expires?: string; approver?: string; decision?: string; reads: string[] };
export type AccessCommand =
	| { type: 'access.request'; id: string; courierId: string; scope: AccessRequest['scope']; reason: string }
	| { type: 'access.decide'; id: string; status: 'approved' | 'rejected' | 'revoked'; reason: string; minutes?: number }
	| { type: 'access.read'; id: string };

export function accessActive(request: AccessRequest, actorId: string, at: string) {
	return request.requester === actorId && request.status === 'approved' && !!request.expires && request.expires > at;
}

export function applyAccess(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const command = event.command as AccessCommand;
	const next = structuredClone(state);
	const requests = next.access[event.operatorId] ??= [];
	const fail = (error: string): WorkflowResult => ({ ok: false, error });
	if (command.type === 'access.request') {
		if (actor.kind !== 'admin') return fail('FORBIDDEN');
		if (!/^DEMO-access-[a-z0-9-]{1,40}$/i.test(command.id) || !sellerIds(event.operatorId, state).includes(command.courierId) || !['profile', 'finance'].includes(command.scope) || typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500 || requests.some(request => request.id === command.id)) return fail('INVALID_ACCESS_REQUEST');
		requests.push({ id: command.id, requester: actor.id, courierId: command.courierId, scope: command.scope, reason: command.reason, requestedAt: event.at, status: 'pending', reads: [] });
	} else {
		const request = requests.find(item => item.id === command.id);
		if (!request) return fail('UNKNOWN_ACCESS_REQUEST');
		if (command.type === 'access.read') {
			if (actor.kind !== 'admin' || !accessActive(request, actor.id, event.at)) return fail('ACCESS_NOT_ACTIVE');
			request.reads.push(event.at);
		} else if (command.type === 'access.decide') {
			if (!can(actor, event.operatorId, 'approve') || !can(actor, event.operatorId, request.scope === 'profile' ? 'compliance' : 'finance') || actor.id === request.requester) return fail('FORBIDDEN');
			if (!['approved', 'rejected', 'revoked'].includes(command.status) || typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500) return fail('INVALID_ACCESS_DECISION');
			if (command.status === 'revoked' ? request.status !== 'approved' : request.status !== 'pending') return fail('INVALID_TRANSITION');
			if (command.status === 'approved') {
				if (!Number.isInteger(command.minutes) || command.minutes! < 1 || command.minutes! > 60) return fail('INVALID_ACCESS_DURATION');
				request.expires = new Date(Date.parse(event.at) + command.minutes! * 60000).toISOString();
			}
			request.status = command.status; request.approver = actor.id; request.decision = command.reason;
		} else return fail('UNKNOWN_COMMAND');
	}
	return { ok: true, state: next };
}