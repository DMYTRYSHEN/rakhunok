import { personas, type Persona } from './gateway';
import { applyLedger, emptyLedger, type LedgerCommand, type LedgerState } from './ledger';
import { applyPayout, emptyPayouts, type PayoutCommand, type PayoutState } from './payouts';
import { applyReport, type Assessment, type Report, type ReportCommand } from './reports';
import { applyDocument, documentBlockers, type DocumentCommand, type EvidenceDocument } from './documents';
import { applyAccess, type AccessCommand, type AccessRequest } from './access';

export type PackageDetails = { registrationId: string; country: string; address: string; representativeName: string; capacity: string; mandateReference: string; platforms: { name: string; url: string; activities: string[] }[] };
export type PackageFields = { organization: string; platform: string; activity: string; representative: string; contact: string; documents: string; details?: PackageDetails };
export type Registration = { version: number; fields: PackageFields; documentVersions?: { id: string; version: number }[]; author: string; approvedBy?: string; status: 'draft' | 'approved' | 'review' | 'clarification' | 'rejected' | 'registered' | 'unavailable'; reason: string; receipt: string; at: string; source: 'DEMO'; manualEvidence: string };
export type SellerProfile = { courierId: string; kind: 'person' | 'fop'; residency: string; tin: string; account: string; documents: string; linked: boolean; evidence: Partial<Record<'diia' | 'bankid' | 'iban', { outcome: 'verified' | 'rejected' | 'expired'; at: string; expires: string; source: 'DEMO' }>>; clarification: string; response?: { documents: string; message: string; at: string } };
export type Member = { id: string; email: string; permission: Persona['permissions'][number]; status: 'invited' | 'active' | 'revoked' | 'inactive' };
export type Participant = { id: string; name: string; activity: 'delivery' | 'taxi' | 'services' | 'other'; operatorIds: string[] };
export type WorkflowState = { access: Record<string, AccessRequest[]>; assessments: Record<string, Assessment[]>; documents: Record<string, EvidenceDocument[]>; participants: Participant[]; registrations: Record<string, Registration[]>; sellers: Record<string, SellerProfile[]>; members: Record<string, Member[]>; ledger: LedgerState; payouts: PayoutState; reports: Record<string, Report[]>; operations: Record<string, { suspended: boolean; reason: string; at: string }> };
export type WorkflowCommand =
	| LedgerCommand
	| PayoutCommand
	| ReportCommand
	| DocumentCommand
	| AccessCommand
	| { type: 'seller.onboard'; id: string; name: string; activity: Participant['activity'] }
	| { type: 'operator.status'; suspended: boolean; reason: string }
	| { type: 'seller.respond'; courierId: string; documents: string; message: string }
	| { type: 'seller.review'; courierId: string }
	| { type: 'registration.save'; fields: PackageFields }
	| { type: 'registration.approve'; version: number }
	| { type: 'registration.submit'; version: number }
	| { type: 'registration.resolve'; version: number; outcome: 'review' | 'clarification' | 'rejected' | 'registered' | 'unavailable'; reason: string }
	| { type: 'registration.evidence'; version: number; evidence: string }
	| { type: 'seller.save'; profile: Pick<SellerProfile, 'courierId' | 'kind' | 'residency' | 'tin' | 'account' | 'documents'> }
	| { type: 'seller.verify'; courierId: string; provider: 'diia' | 'bankid' | 'iban'; outcome: 'verified' | 'rejected' | 'expired' }
	| { type: 'seller.clarify'; courierId: string; reason: string }
	| { type: 'seller.link'; courierId: string }
	| { type: 'member.invite'; id: string; email: string; permission: Persona['permissions'][number] }
	| { type: 'member.status'; id: string; status: Member['status'] };
export type WorkflowEvent = { actorId: string; operatorId: string; command: WorkflowCommand; at: string; evidencePolicy?: 2 };
export type WorkflowResult = { ok: true; state: WorkflowState } | { ok: false; error: string };
export const emptyWorkflow = (): WorkflowState => ({ access: {}, assessments: {}, documents: {}, participants: [], registrations: {}, sellers: {}, members: {}, ledger: emptyLedger(), payouts: emptyPayouts(), reports: {}, operations: {} });
export function workflowActor(state: WorkflowState, id: string): Persona | undefined {
	const base = personas.find(item => item.id === id);
	if (base?.operatorId) {
		const membership = state.members[base.operatorId]?.find(item => item.id === id);
		return membership ? { ...base, permissions: membership.status === 'active' ? [membership.permission] : [] } : base;
	}
	if (base) return base;
	const participant = state.participants.find(item => item.id === id);
	if (participant) return { id, label: participant.name, kind: 'courier', courierId: id, permissions: [] };
	for (const [operatorId, members] of Object.entries(state.members)) {
		const member = members.find(item => item.id === id);
		if (member) return { id, label: `${member.email} · ${member.status}`, kind: 'operator', operatorId, permissions: member.status === 'active' ? [member.permission] : [] };
	}
}
export const sellerIds = (operatorId: string, state?: WorkflowState) => [...(operatorId === 'varus' ? ['courier-1', 'courier-2', 'courier-3'] : operatorId === 'route' ? ['courier-1', 'courier-4'] : []), ...(state?.participants.filter(item => item.operatorIds.includes(operatorId)).map(item => item.id) ?? [])];
export function sellerBlockers(profile: SellerProfile | undefined, at: string, documents: EvidenceDocument[] = []) {
	if (!profile) return ['PROFILE_MISSING'];
	const blockers = documentBlockers(documents, profile.courierId, at);
	if (![profile.residency, profile.tin, profile.account, profile.documents].every(Boolean)) blockers.push('INCOMPLETE_PROFILE');
	if (!profile.linked) blockers.push('LINK_UNCONFIRMED');
	if (profile.clarification) blockers.push('CLARIFICATION_OPEN');
	for (const provider of ['diia', 'bankid', 'iban'] as const) {
		const evidence = profile.evidence[provider];
		if (!evidence || evidence.outcome !== 'verified' || evidence.expires <= at) blockers.push(`${provider.toUpperCase()}_EVIDENCE`);
	}
	return blockers;
}
const denied = (error: string): WorkflowResult => ({ ok: false, error });
export const syntheticEmail = (value: string) => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.example$/i.test(value) && value.length <= 120;
export function can(actor: Persona, operatorId: string, permission: Persona['permissions'][number]) {
	return actor.kind === 'operator' && actor.operatorId === operatorId && actor.permissions.includes(permission);
}
function packageDetailsValid(details: PackageDetails, complete: boolean) {
	if (!details || !['registrationId', 'country', 'address', 'representativeName', 'capacity', 'mandateReference'].every(key => {
		const value = details[key as keyof PackageDetails];
		return typeof value === 'string' && value.length <= 500 && (!complete || value.trim().length > 0);
	}) || !Array.isArray(details.platforms) || details.platforms.length < 1 || details.platforms.length > 10) return false;
	if (complete && (!/^DEMO-[a-z0-9-]+$/i.test(details.registrationId) || !/^[A-Z]{2}$/.test(details.country))) return false;
	return details.platforms.every(platform => {
		if (!platform || typeof platform.name !== 'string' || platform.name.length > 120 || typeof platform.url !== 'string' || platform.url.length > 500 || !Array.isArray(platform.activities) || platform.activities.length > 4 || platform.activities.some(activity => !['delivery', 'taxi', 'services', 'other'].includes(activity))) return false;
		if (!complete) return true;
		try { const url = new URL(platform.url); return !!platform.name.trim() && platform.activities.length > 0 && url.protocol === 'https:' && url.hostname.endsWith('.example') && !url.username && !url.password; } catch { return false; }
	});
}
export function applyWorkflow(state: WorkflowState, event: WorkflowEvent): WorkflowResult {
	const actor = workflowActor(state, event.actorId);
	if (!actor || !['varus', 'route'].includes(event.operatorId) || !Number.isFinite(Date.parse(event.at))) return denied('FORBIDDEN');
	const command = event.command;
	if (command.type.startsWith('access.')) return applyAccess(state, event, actor);
	if (command.type === 'operator.status') {
		if (actor.kind !== 'admin') return denied('FORBIDDEN');
		if (typeof command.suspended !== 'boolean' || !command.reason?.trim() || command.reason.length > 500) return denied('REASON_REQUIRED');
		const next = structuredClone(state);
		next.operations[event.operatorId] = { suspended: command.suspended, reason: command.reason, at: event.at };
		return { ok: true, state: next };
	}
	if (state.operations[event.operatorId]?.suspended) {
		const instruction = command.type === 'batch.result' ? state.payouts.batches[event.operatorId]?.find(batch => batch.id === command.id)?.instructions.find(item => item.id === command.instructionId) : undefined;
		const report = command.type === 'report.resolve' ? state.reports[event.operatorId]?.find(item => item.id === command.id) : undefined;
		const reconciling = command.type === 'payout.reconcile'
			|| command.type === 'batch.result' && !!instruction && instruction.attempts > 0 && (instruction.status !== 'pending' || !!instruction.awaitingResult)
			|| command.type === 'report.resolve' && !!report?.receipt;
		const revoking = command.type === 'key.revoke' || command.type === 'member.status' && ['revoked', 'inactive'].includes(command.status);
		if (!reconciling && !revoking) return denied('OPERATOR_SUSPENDED');
	}
	if (command.type.startsWith('report.')) return applyReport(state, event, actor);
	if (command.type.startsWith('document.')) return applyDocument(state, event, actor);
	if (command.type.startsWith('batch.') || command.type.startsWith('payout.')) return applyPayout(state, event, actor);
	if (command.type.startsWith('key.') || command.type === 'ledger.import') return applyLedger(state, event, actor);
	if (command.type.startsWith('seller.') || command.type.startsWith('member.')) return applyPeople(state, event, actor);
	const permission = command.type === 'registration.approve' ? 'approve' : 'profile';
	if (!can(actor, event.operatorId, permission)) return denied('FORBIDDEN');
	const next = structuredClone(state);
	const history = next.registrations[event.operatorId] ??= [];
	const latest = history.at(-1);
	const documentVersions = [...new Map((state.documents[event.operatorId] ?? []).filter(document => document.ownerId === 'operator').map(document => [document.id, { id: document.id, version: document.version }])).values()].sort((first, second) => first.id.localeCompare(second.id));
	if (command.type === 'registration.save') {
		const fields = command.fields;
		if (!fields || !['organization', 'platform', 'activity', 'representative', 'contact', 'documents'].every(key => { const value = fields[key as keyof PackageFields]; return typeof value === 'string' && value.length <= 500; })) return denied('INVALID_FIELDS');
		if (fields.details !== undefined && !packageDetailsValid(fields.details, false)) return denied('INVALID_FIELDS');
		if (latest && JSON.stringify(latest.fields) === JSON.stringify(fields) && (event.evidencePolicy !== 2 || JSON.stringify(latest.documentVersions) === JSON.stringify(documentVersions))) return { ok: true, state };
		history.push({ version: history.length + 1, fields: structuredClone(fields), ...(event.evidencePolicy === 2 ? { documentVersions } : {}), author: actor.id, status: 'draft', reason: '', receipt: '', at: event.at, source: 'DEMO', manualEvidence: '' });
	} else {
		if (!('version' in command) || !latest || latest.version !== command.version) return denied('VERSION_CONFLICT');
		if (command.type === 'registration.approve') {
			if (latest.author === actor.id) return denied('SECOND_APPROVER_REQUIRED');
			if (latest.status === 'approved' && latest.approvedBy === actor.id) return { ok: true, state };
			if (event.evidencePolicy === 2 && documentBlockers(state.documents[event.operatorId] ?? [], 'operator', event.at).length) return denied('DOCUMENTS_NOT_READY');
			if (latest.documentVersions && JSON.stringify(latest.documentVersions) !== JSON.stringify(documentVersions)) return denied('PACKAGE_DOCUMENTS_CHANGED');
			if (latest.status !== 'draft' || Object.values(latest.fields).some(value => typeof value === 'string' && !value.trim()) || !syntheticEmail(latest.fields.contact) || latest.fields.details && !packageDetailsValid(latest.fields.details, true)) return denied('INCOMPLETE_PACKAGE');
			latest.approvedBy = actor.id; latest.status = 'approved';
		} else if (command.type === 'registration.submit') {
			if (latest.status === 'review') return { ok: true, state };
			if (event.evidencePolicy === 2 && documentBlockers(state.documents[event.operatorId] ?? [], 'operator', event.at).length) return denied('DOCUMENTS_NOT_READY');
			if (latest.documentVersions && JSON.stringify(latest.documentVersions) !== JSON.stringify(documentVersions)) return denied('PACKAGE_DOCUMENTS_CHANGED');
			if (!latest.approvedBy || !['approved', 'unavailable'].includes(latest.status)) return denied('APPROVAL_REQUIRED');
			latest.status = 'review'; latest.receipt = `DEMO-${event.operatorId}-registration-${latest.version}`;
		} else if (command.type === 'registration.resolve') {
			if (latest.status === command.outcome && latest.reason === command.reason) return { ok: true, state };
			if (!['review', 'unavailable'].includes(latest.status) || !['review', 'clarification', 'rejected', 'registered', 'unavailable'].includes(command.outcome) || typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 500) return denied('INVALID_TRANSITION');
			latest.status = command.outcome; latest.reason = command.reason;
		} else if (command.type === 'registration.evidence') {
			if (typeof command.evidence !== 'string' || !command.evidence.trim() || command.evidence.length > 500) return denied('INVALID_EVIDENCE');
			latest.manualEvidence = command.evidence;
		} else return denied('UNKNOWN_COMMAND');
		latest.at = event.at;
	}
	return { ok: true, state: next };
}

export function replayWorkflow(events: WorkflowEvent[]): WorkflowState | null {
	let state = emptyWorkflow();
	try {
		if (!Array.isArray(events) || events.length > 2000) return null;
		for (const event of events) {
			const result = applyWorkflow(state, event);
			if (!result.ok) return null;
			state = result.state;
		}
		return state;
	} catch { return null; }
}

function applyPeople(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const next = structuredClone(state);
	const command = event.command;
	if (command.type === 'seller.onboard') {
		if (!can(actor, event.operatorId, 'compliance')) return denied('FORBIDDEN');
		if (!/^DEMO-seller-[a-z0-9-]{1,40}$/.test(command.id) || !command.name?.trim() || command.name.length > 120 || !['delivery', 'taxi', 'services', 'other'].includes(command.activity)) return denied('INVALID_PARTICIPANT');
		const participant = next.participants.find(item => item.id === command.id);
		if (participant) {
			if (participant.name !== command.name.trim() || participant.activity !== command.activity) return denied('PARTICIPANT_CONFLICT');
			if (participant.operatorIds.includes(event.operatorId)) return { ok: true, state };
			participant.operatorIds.push(event.operatorId);
		} else next.participants.push({ id: command.id, name: command.name.trim(), activity: command.activity, operatorIds: [event.operatorId] });
		return { ok: true, state: next };
	}
	if (command.type === 'member.invite' || command.type === 'member.status') {
		const members = next.members[event.operatorId] ??= [];
		if (command.type === 'member.invite') {
			if (!can(actor, event.operatorId, 'team')) return denied('FORBIDDEN');
			if (!/^demo-member-[a-z0-9-]{1,40}$/.test(command.id) || !syntheticEmail(command.email) || !['profile', 'finance', 'approve', 'compliance', 'integrations', 'team'].includes(command.permission)) return denied('INVALID_MEMBER');
			if (Object.values(next.members).flat().some(member => member.id === command.id)) return denied('DUPLICATE_MEMBER');
			members.push({ id: command.id, email: command.email, permission: command.permission, status: 'invited' });
		} else {
			let member = members.find(item => item.id === command.id);
			if (command.status === 'active') {
				if (!member || member.status !== 'invited' || actor.id !== member.id || actor.operatorId !== event.operatorId) return denied('INVITEE_REQUIRED');
			} else {
				if (!can(actor, event.operatorId, 'team') || actor.id === command.id || !['revoked', 'inactive'].includes(command.status)) return denied('FORBIDDEN');
				if (!member) {
					const base = personas.find(item => item.id === command.id && item.operatorId === event.operatorId);
					if (!base) return denied('UNKNOWN_MEMBER');
					member = { id: base.id, email: `${base.id}@demo.example`, permission: base.permissions[0], status: 'active' }; members.push(member);
				}
			}
			member.status = command.status;
		}
	} else if (command.type === 'seller.save' || command.type === 'seller.verify' || command.type === 'seller.clarify' || command.type === 'seller.link' || command.type === 'seller.respond' || command.type === 'seller.review') {
		const courierId = command.type === 'seller.save' ? command.profile.courierId : command.courierId;
		if (!sellerIds(event.operatorId, state).includes(courierId)) return denied('UNKNOWN_RELATIONSHIP');
		if (command.type === 'seller.link' || command.type === 'seller.respond' ? actor.kind !== 'courier' || actor.courierId !== courierId : !can(actor, event.operatorId, 'compliance')) return denied('FORBIDDEN');
		const profiles = next.sellers[event.operatorId] ??= [];
		const profile = profiles.find(item => item.courierId === courierId);
		if (command.type === 'seller.save') {
			const fields = command.profile;
			if (!['person', 'fop'].includes(fields.kind) || !['residency', 'tin', 'account', 'documents'].every(key => typeof fields[key as keyof typeof fields] === 'string' && fields[key as keyof typeof fields].length <= 500) || fields.tin && !fields.tin.startsWith('DEMO-') || fields.account && !fields.account.startsWith('DEMO-')) return denied('SYNTHETIC_DATA_REQUIRED');
			if (profile && JSON.stringify({ ...fields, linked: profile.linked, evidence: profile.evidence, clarification: profile.clarification }) === JSON.stringify(profile)) return { ok: true, state };
			const updated = { ...fields, linked: profile?.linked ?? ['courier-2', 'courier-3', 'courier-4'].includes(courierId), evidence: {}, clarification: '' };
			if (profile) profiles[profiles.indexOf(profile)] = updated; else profiles.push(updated);
		} else {
			if (!profile) return denied('PROFILE_MISSING');
			if (command.type === 'seller.link') profile.linked = true;
			if (command.type === 'seller.clarify') { if (!command.reason.trim() || command.reason.length > 500) return denied('REASON_REQUIRED'); profile.clarification = command.reason; delete profile.response; }
			if (command.type === 'seller.respond') {
				if (!profile.clarification || !command.documents?.startsWith('DEMO') || command.documents.length > 500 || !command.message?.trim() || command.message.length > 500) return denied('INVALID_RESPONSE');
				profile.response = { documents: command.documents, message: command.message, at: event.at };
			}
			if (command.type === 'seller.review') {
				if (!profile.clarification || !profile.response) return denied('RESPONSE_REQUIRED');
				profile.documents = profile.response.documents; profile.clarification = ''; profile.evidence = {};
			}
			if (command.type === 'seller.verify') {
				if (!['diia', 'bankid', 'iban'].includes(command.provider) || !['verified', 'rejected', 'expired'].includes(command.outcome)) return denied('INVALID_EVIDENCE');
				profile.evidence[command.provider] = { outcome: command.outcome, at: event.at, expires: new Date(Date.parse(event.at) + (command.outcome === 'expired' ? -1 : 365 * 86400000)).toISOString(), source: 'DEMO' };
			}
		}
	} else return denied('UNKNOWN_COMMAND');
	return { ok: true, state: next };
}