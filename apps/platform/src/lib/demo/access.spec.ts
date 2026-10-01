import { describe, expect, it } from 'vitest';
import { applyWorkflow, emptyWorkflow, type WorkflowCommand } from './workflow';

describe('exceptional support access', () => {
	it('requires independent scoped approval and enforces expiry and revocation', () => {
		let state = emptyWorkflow();
		const command = (actorId: string, operatorId: string, command: WorkflowCommand, at = '2026-09-01T10:00:00.000Z') => {
			const result = applyWorkflow(state, { actorId, operatorId, command, at });
			if (result.ok) state = result.state;
			return result;
		};
		const request = { type: 'access.request', id: 'DEMO-access-one', courierId: 'courier-1', scope: 'profile', reason: 'DEMO support case' } as const;
		expect(command('varus-owner', 'varus', request).ok).toBe(false);
		expect(command('rahunok-admin', 'varus', request).ok).toBe(true);
		expect(command('rahunok-admin', 'varus', { type: 'access.read', id: request.id }).ok).toBe(false);
		const approve = { type: 'access.decide', id: request.id, status: 'approved', reason: 'DEMO consent', minutes: 15 } as const;
		for (const actor of ['rahunok-admin', 'route-owner', 'varus-integrator', 'varus-accountant', 'varus-signer']) expect(command(actor, 'varus', approve).ok).toBe(false);
		expect(command('varus-owner', 'varus', { ...approve, minutes: 61 }).ok).toBe(false);
		expect(command('varus-owner', 'varus', approve).ok).toBe(true);
		expect(command('rahunok-admin', 'route', { type: 'access.read', id: request.id }).ok).toBe(false);
		expect(command('rahunok-admin', 'varus', { type: 'access.read', id: request.id }).ok).toBe(true);
		expect(state.access.varus[0].reads).toHaveLength(1);
		expect(command('rahunok-admin', 'varus', { type: 'access.read', id: request.id }, '2026-09-01T10:15:00.000Z').ok).toBe(false);
		expect(command('varus-owner', 'varus', { type: 'access.decide', id: request.id, status: 'revoked', reason: 'DEMO case closed' }).ok).toBe(true);
		expect(command('rahunok-admin', 'varus', { type: 'access.read', id: request.id }).ok).toBe(false);
		expect(state.access.varus[0].reads).toHaveLength(1);
	});
});
import { createDemoGateway, allowedSections } from './gateway';

const setup = () => {
	const data = new Map<string, string>();
	const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
	return { api: createDemoGateway(storage), storage };
};

describe('Role-scoped workflow', () => {
	it('blocks new batches and report snapshots until the latest submitted document is accepted', () => {
		const memory = new Map<string, string>();
		const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
		const api = createDemoGateway(storage);
		expect(api.command('varus-owner', 'varus', { type: 'seller.save', profile: { courierId: 'courier-1', kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO evidence' } }).ok).toBe(true);
		for (const provider of ['diia', 'bankid', 'iban'] as const) expect(api.command('varus-owner', 'varus', { type: 'seller.verify', courierId: 'courier-1', provider, outcome: 'verified' }).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(true);
		const document = { type: 'document.submit' as const, id: 'DEMO-doc-ready', ownerId: 'courier-1', category: 'identity' as const, name: 'DEMO-id.txt', content: 'DEMO identity', expires: '2099-12-31' };
		expect(api.command('courier-1', 'varus', document).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-doc-batch', period: '2026-09', courierIds: ['courier-1'] })).toEqual({ ok: false, error: 'INELIGIBLE:courier-1' });
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-doc-report', quarter: '2026-Q3', reason: '' }).ok).toBe(true);
		expect(api.reports('varus-owner')[0].blockers).toContain('courier-1:DOCUMENT_SUBMITTED:DEMO-doc-ready');
		expect(api.command('varus-compliance', 'varus', { type: 'document.review', id: document.id, version: 1, status: 'accepted', reason: 'DEMO reviewed' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-doc-batch', period: '2026-09', courierIds: ['courier-1'] }).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { ...document, content: 'DEMO replacement' }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-doc-batch' })).toEqual({ ok: false, error: 'BATCH_STALE' });
		expect(createDemoGateway(storage).reports('varus-owner')).toEqual(api.reports('varus-owner'));
	});
	it('returns only the approved scope and refuses disclosure when audit persistence fails', () => {
		const memory = new Map<string, string>();
		let failWrites = false;
		const api = createDemoGateway({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { if (failWrites) throw new Error('offline'); memory.set(key, value); } });
		const id = 'DEMO-access-finance';
		expect(api.command('rahunok-admin', 'varus', { type: 'access.request', id, courierId: 'courier-1', scope: 'finance', reason: 'DEMO investigate' }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'access.decide', id, status: 'approved', reason: 'DEMO consent', minutes: 10 }).ok).toBe(true);
		expect(api.accessRequests('route-owner')).toEqual([]);
		expect(api.accessRequests('varus-integrator')).toEqual([]);
		expect(api.accessRequests('courier-1')).toEqual([]);
		const result = api.readAccess('rahunok-admin', 'varus', id);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.entries?.every(entry => entry.operatorId === 'varus' && entry.courierId === 'courier-1')).toBe(true);
		expect(api.view('rahunok-admin').entries).toEqual([]);
		expect(api.journal('varus-owner').some(event => event.action === 'access.read')).toBe(true);
		failWrites = true;
		expect(api.readAccess('rahunok-admin', 'varus', id)).toEqual({ ok: false, error: 'STORAGE_UNAVAILABLE' });
	});
	it('versions documents, enforces independent review and rejects foreign ownership', () => {
		const memory = new Map<string, string>();
		const api = createDemoGateway({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } });
		const document = { type: 'document.submit' as const, id: 'DEMO-doc-identity', ownerId: 'courier-1', category: 'identity' as const, name: 'DEMO-identity.txt', content: 'DEMO identity evidence', expires: '2099-01-01' };
		expect(api.command('courier-1', 'varus', { ...document, ownerId: 'courier-2' }).ok).toBe(false);
		expect(api.command('courier-1', 'varus', document).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { type: 'document.review', id: document.id, version: 1, status: 'accepted', reason: 'DEMO reviewed' }).ok).toBe(false);
		expect(api.command('varus-compliance', 'varus', { type: 'document.review', id: document.id, version: 1, status: 'accepted', reason: 'DEMO reviewed' }).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { ...document, content: 'DEMO corrected identity' }).ok).toBe(true);
		expect(api.command('varus-compliance', 'varus', { type: 'document.review', id: document.id, version: 1, status: 'accepted', reason: 'DEMO reviewed' })).toMatchObject({ ok: false, error: 'DOCUMENT_VERSION_CONFLICT' });
	});
	it('restores delegated contact history after revocation without restoring privileges', () => {
		const { api, storage } = setup();
		expect(api.command('varus-owner', 'varus', { type: 'member.invite', id: 'demo-member-profile', email: 'profile@demo.example', permission: 'profile' }).ok).toBe(true);
		expect(api.membership('demo-member-profile')).toBe('invited');
		expect(api.command('demo-member-profile', 'varus', { type: 'member.status', id: 'demo-member-profile', status: 'active' }).ok).toBe(true);
		expect(api.updateContact('demo-member-profile', 'varus', 'delegate@demo.example').ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'member.status', id: 'demo-member-profile', status: 'revoked' }).ok).toBe(true);
		const restored = createDemoGateway(storage);
		expect(restored.warning).toBeNull();
		expect(restored.view('varus-owner').operators[0].contact).toBe('delegate@demo.example');
		expect(restored.view('demo-member-profile').audit).toEqual([]);
		expect(restored.updateContact('demo-member-profile', 'varus', 'revoked@demo.example').ok).toBe(false);
		expect(restored.workflow('demo-member-profile').events).toEqual([]);
		expect(restored.membership('demo-member-profile')).toBe('revoked');
		expect(restored.command('demo-member-profile', 'varus', { type: 'member.status', id: 'demo-member-profile', status: 'active' }).ok).toBe(false);
	});
	it('allows own clarification response but only compliance can accept and reverify it', () => {
		const { api } = setup();
		expect(api.command('varus-compliance', 'varus', { type: 'seller.save', profile: { courierId: 'courier-1', kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO original' } }).ok).toBe(true);
		expect(api.command('varus-compliance', 'varus', { type: 'seller.clarify', courierId: 'courier-1', reason: 'DEMO documents' }).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { type: 'seller.respond', courierId: 'courier-2', documents: 'DEMO new', message: 'Updated' }).ok).toBe(false);
		expect(api.command('courier-1', 'varus', { type: 'seller.respond', courierId: 'courier-1', documents: 'DEMO new', message: 'Updated' }).ok).toBe(true);
		expect(api.command('courier-1', 'varus', { type: 'seller.review', courierId: 'courier-1' }).ok).toBe(false);
		expect(api.workflow('courier-1').sellers[0].clarification).toBeTruthy();
		expect(api.command('varus-compliance', 'varus', { type: 'seller.review', courierId: 'courier-1' }).ok).toBe(true);
		expect(api.workflow('courier-1').sellers[0].documents).toBe('DEMO new');
		expect(api.workflow('courier-1').sellers[0].evidence).toEqual({});
	});
	it('keeps integrator, accountant, signer and administrator boundaries on reads and writes', () => {
		const { api } = setup();
		for (const actor of ['varus-integrator', 'varus-signer', 'rahunok-admin']) expect(api.view(actor).entries).toEqual([]);
		for (const actor of ['varus-integrator', 'varus-accountant', 'varus-signer', 'rahunok-admin']) expect(api.workflow(actor).sellers).toEqual([]);
		for (const actor of ['varus-accountant', 'varus-signer', 'courier-1', 'rahunok-admin']) expect(api.integration(actor).keys).toEqual([]);
		for (const actor of ['varus-integrator', 'courier-1', 'rahunok-admin']) expect(api.command(actor, 'varus', { type: 'report.create', id: 'DEMO-denied', quarter: '2026-Q3', reason: '' }).ok).toBe(false);
		expect(api.command('varus-accountant', 'route', { type: 'report.create', id: 'DEMO-foreign', quarter: '2026-Q3', reason: '' }).ok).toBe(false);
		expect(allowedSections(api.contexts().find(actor => actor.id === 'varus-accountant')!).map(section => section.id)).toContain('reports');
		expect(api.command('varus-accountant', 'varus', { type: 'payout.external', id: 'DEMO-private', courierId: 'courier-1', amountMinor: 100, period: '2026-09', occurredAt: '2026-09-01T00:00:00.000Z', status: 'unknown', evidence: 'DEMO internal evidence' }).ok).toBe(true);
		const personal = JSON.stringify(api.payouts('courier-1', '2026-09'));
		expect(personal).not.toContain('internal evidence'); expect(personal).not.toContain('request'); expect(personal).not.toContain('varus-accountant');
		expect(api.payouts('varus-integrator', '2026-09').external).toEqual([]);
	});
	it('blocks first batch execution while suspended but allows late outcomes and security revocation', () => {
		const { api, storage } = setup();
		for (const courierId of ['courier-1', 'courier-3']) {
			expect(api.command('varus-compliance', 'varus', { type: 'seller.save', profile: { courierId, kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO document' } }).ok).toBe(true);
			for (const provider of ['diia', 'bankid', 'iban'] as const) expect(api.command('varus-compliance', 'varus', { type: 'seller.verify', courierId, provider, outcome: 'verified' }).ok).toBe(true);
		}
		expect(api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-mixed', period: '2026-08', courierIds: ['courier-1', 'courier-3'] }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-mixed' }).ok).toBe(true);
		const result = { type: 'batch.result' as const, id: 'DEMO-mixed', instructionId: 'DEMO-mixed:courier-1', status: 'unknown' as const, evidence: 'DEMO timeout' };
		expect(api.command('varus-accountant', 'varus', result).ok).toBe(true);
		expect(api.command('varus-integrator', 'varus', { type: 'key.create', id: 'DEMO-key-revoke', scopes: ['income'], environment: 'test' }).ok).toBe(true);
		expect(api.command('rahunok-admin', 'varus', { type: 'operator.status', suspended: true, reason: 'DEMO review' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { ...result, instructionId: 'DEMO-mixed:courier-3', status: 'paid' })).toEqual({ ok: false, error: 'OPERATOR_SUSPENDED' });
		expect(api.command('varus-accountant', 'varus', { ...result, status: 'paid', evidence: 'DEMO late result' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { ...result, status: 'paid', evidence: 'DEMO late result' }).ok).toBe(true);
		expect(api.command('varus-integrator', 'varus', { type: 'key.revoke', id: 'DEMO-key-revoke' }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'member.status', id: 'varus-accountant', status: 'revoked' }).ok).toBe(true);
		expect(api.payouts('varus-accountant', '2026-08').batches).toEqual([]);
		expect(createDemoGateway(storage).warning).toBeNull();
	});
	it('suspends new work without preventing reconciliation of an unknown outcome', () => {
		const { api, storage } = setup();
		expect(api.command('varus-accountant', 'varus', { type: 'payout.external', id: 'DEMO-pending', courierId: 'courier-1', amountMinor: 100, period: '2026-09', occurredAt: '2026-09-01T00:00:00.000Z', status: 'unknown', evidence: 'DEMO' }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'operator.status', suspended: true, reason: 'DEMO' }).ok).toBe(false);
		expect(api.command('rahunok-admin', 'varus', { type: 'operator.status', suspended: true, reason: 'DEMO review' }).ok).toBe(true);
		expect(api.command('varus-integrator', 'varus', { type: 'key.create', id: 'DEMO-new', scopes: ['income'], environment: 'test' })).toEqual({ ok: false, error: 'OPERATOR_SUSPENDED' });
		expect(api.command('varus-accountant', 'varus', { type: 'payout.reconcile', id: 'DEMO-pending', status: 'paid', evidence: 'DEMO late' }).ok).toBe(true);
		expect(createDemoGateway(storage).operations('rahunok-admin')[0].suspended).toBe(true);
		expect(api.operations('courier-1')).toEqual([]);
		expect(api.command('rahunok-admin', 'varus', { type: 'operator.status', suspended: false, reason: 'DEMO resolved' }).ok).toBe(true);
		expect(api.technicalAudit('rahunok-admin').map(event => event.suspended)).toEqual([true, false]);
		expect(api.technicalAudit('varus-owner')).toHaveLength(2);
		expect(api.technicalAudit('route-owner')).toEqual([]);
		expect(api.technicalAudit('courier-1')).toEqual([]);
	});
	it('scopes monthly payouts and exposes only technical queue and journal metadata to administrators', () => {
		const { api, storage } = setup();
		for (const period of ['2026-08', '2026-09']) {
			expect(api.command('varus-accountant', 'varus', { type: 'payout.external', id: `DEMO-${period}`, courierId: 'courier-1', amountMinor: 100, period, occurredAt: `${period}-01T00:00:00.000Z`, status: 'unknown', evidence: 'DEMO private evidence' }).ok).toBe(true);
		}
		expect(api.payouts('courier-1', '2026-08').external.map(item => item.id)).toEqual(['DEMO-2026-08']);
		expect(api.payouts('route-owner', '2026-08').external).toEqual([]);
		expect(api.issues('rahunok-admin')).toHaveLength(2);
		expect(api.issues('varus-owner')).toEqual([]);
		expect(api.journal('route-owner')).toEqual([]);
		expect(api.journal('courier-1')).toEqual([]);
		expect(api.journal('varus-integrator')[0]).toMatchObject({ actorId: 'varus-accountant', operatorId: 'varus', action: 'payout.external', result: 'applied' });
		const admin = JSON.stringify({ queue: api.issues('rahunok-admin'), journal: api.journal('rahunok-admin') });
		for (const forbidden of ['courier-1', 'private evidence', 'amountMinor', 'account', 'documents']) expect(admin).not.toContain(`"${forbidden}"`);
		expect(api.command('varus-owner', 'varus', { type: 'member.status', id: 'varus-integrator', status: 'revoked' }).ok).toBe(true);
		expect(api.journal('varus-integrator')).toEqual([]);
		const restored = createDemoGateway(storage);
		expect(restored.issues('rahunok-admin')).toEqual(api.issues('rahunok-admin'));
		expect(restored.journal('rahunok-admin')).toEqual(api.journal('rahunok-admin'));
	});
});