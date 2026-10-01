import { describe, expect, it } from 'vitest';
import { allowedSections, createDemoGateway, DEMO_STORAGE_KEY, personas, readContext, seedState, totals } from './gateway';
import { sellerBlockers, type PackageFields } from './workflow';

function storageFixture() {
	const values = new Map<string, string>();
	return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('Platform E1 shared demo module', () => {
	it('isolates operators and exposes only own records across a shared courier relationship', () => {
		const gateway = createDemoGateway(storageFixture());
		expect(totals(gateway.view('varus-owner').entries)).toEqual({ customerMinor: 560000, incomeMinor: 85000, paidMinor: 52000, balanceMinor: 33000 });
		expect(totals(gateway.view('route-owner').entries)).toEqual({ customerMinor: 170000, incomeMinor: 34000, paidMinor: 19000, balanceMinor: 15000 });
		const courier = gateway.view('courier-1');
		expect(courier.operators).toHaveLength(2);
		expect(courier.entries.every(entry => entry.courierId === 'courier-1')).toBe(true);
		expect(totals(courier.entries).incomeMinor).toBe(53000);
		expect(gateway.view('varus-owner').couriers).toHaveLength(3);
		expect(seedState().couriers).toHaveLength(4);
		expect(new Set(seedState().entries.map(entry => entry.period)).size).toBe(2);
	});

	it('does not give finance or private contacts to integrators or SaaS administrators', () => {
		const gateway = createDemoGateway(storageFixture());
		for (const persona of ['rahunok-admin', 'varus-integrator']) {
			expect(gateway.view(persona).entries).toEqual([]);
			expect(gateway.view(persona).couriers).toEqual([]);
			expect(gateway.view(persona).operators.every(operator => operator.contact === '')).toBe(true);
		}
		expect(() => gateway.view('admin')).toThrow('FORBIDDEN');
		expect(readContext('?persona=__proto__&section=team').persona.id).toBe('courier-1');
		expect(readContext('?persona=varus-integrator&section=payouts').section).toBe('overview');
		expect(readContext('', 'admin').persona.kind).not.toBe('admin');
		for (const persona of personas) expect(allowedSections(persona).length).toBeGreaterThan(0);
	});

	it('persists a validated contact and audit without changing other applications or auth', () => {
		const storage = storageFixture();
		storage.setItem('sb-auth-token', 'untouched');
		const gateway = createDemoGateway(storage);
		expect(gateway.updateContact('varus-owner', 'route', 'demo@route.example')).toEqual({ ok: false, error: 'FORBIDDEN' });
		expect(gateway.updateContact('varus-accountant', 'varus', 'demo@varus.example')).toEqual({ ok: false, error: 'FORBIDDEN' });
		expect(gateway.updateContact('varus-owner', 'varus', 'real@example.com')).toEqual({ ok: false, error: 'INVALID_CONTACT' });
		expect(gateway.updateContact('varus-owner', 'varus', 'finance@varus.example')).toEqual({ ok: true });
		const restored = createDemoGateway(storage);
		expect(restored.view('varus-owner').operators[0].contact).toBe('finance@varus.example');
		expect(restored.view('varus-owner').audit).toHaveLength(1);
		expect(restored.view('route-owner').audit).toHaveLength(0);
		expect(restored.reset()).toEqual({ ok: true });
		expect(restored.view('varus-owner').audit).toHaveLength(0);
		expect(totals(restored.view('varus-owner').entries).incomeMinor).toBe(85000);
		expect(storage.getItem('sb-auth-token')).toBe('untouched');
	});

	it('recovers corrupted and incompatible storage explicitly', () => {
		for (const raw of ['{', 'null', '{"version":2}', JSON.stringify({ ...seedState(), entries: [] })]) {
			const storage = storageFixture();
			storage.setItem(DEMO_STORAGE_KEY, raw);
			const gateway = createDemoGateway(storage);
			expect(gateway.warning).toBe('CORRUPT_STORAGE');
			expect(gateway.view('varus-owner').entries).toHaveLength(4);
			expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(raw);
			expect(gateway.reset().ok).toBe(true);
			expect(createDemoGateway(storage).warning).toBeNull();
		}
	});

	it('does not report persistence success or change state on storage failure or stale-tab conflict', () => {
		const unavailable = createDemoGateway({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
		expect(unavailable.updateContact('varus-owner', 'varus', 'new@varus.example')).toEqual({ ok: false, error: 'STORAGE_UNAVAILABLE' });
		expect(unavailable.view('varus-owner').operators[0].contact).toBe('operations@varus.example');
		expect(createDemoGateway(null).warning).toBe('STORAGE_UNAVAILABLE');
		const storage = storageFixture();
		const first = createDemoGateway(storage);
		const second = createDemoGateway(storage);
		expect(first.updateContact('varus-owner', 'varus', 'new@varus.example').ok).toBe(true);
		expect(second.reset()).toEqual({ ok: false, error: 'CONFLICT' });
	});

	it('returns detached views without mutating the shared state', () => {
		const gateway = createDemoGateway(storageFixture());
		const view = gateway.view('varus-owner');
		view.entries[0].incomeMinor = 1;
		view.operators[0].name = 'Changed';
		expect(gateway.view('varus-owner').entries[0].incomeMinor).toBe(18000);
		expect(gateway.view('varus-owner').operators[0].name).toBe('VARUS Delivery');
	});
});

describe('E2 registration lifecycle', () => {
	const fields: PackageFields = { organization: 'DEMO company', platform: 'DEMO delivery', activity: 'delivery', representative: 'DEMO representative', contact: 'operator@varus.example', documents: 'DEMO mandate' };
	it('validates structured details and requires a new approval after document replacement', () => {
		const storage = storageFixture();
		const gateway = createDemoGateway(storage);
		const send = (actor: string, command: Parameters<typeof gateway.command>[2]) => gateway.command(actor, 'varus', command);
		const details = { registrationId: 'DEMO-company', country: 'UA', address: 'DEMO address', representativeName: 'DEMO name', capacity: 'Director', mandateReference: 'DEMO mandate', platforms: [{ name: 'DEMO Taxi', url: 'https://taxi.demo.example', activities: ['taxi'] }] };
		expect(send('varus-owner', { type: 'registration.save', fields: { ...fields, details: { ...details, country: '' } } }).ok).toBe(true);
		expect(send('varus-signer', { type: 'registration.approve', version: 1 })).toEqual({ ok: false, error: 'INCOMPLETE_PACKAGE' });
		const document = { type: 'document.submit' as const, id: 'DEMO-doc-mandate', ownerId: 'operator', category: 'registration' as const, name: 'DEMO-mandate.txt', content: 'DEMO mandate v1', expires: '2099-12-31' };
		expect(send('varus-owner', document).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.save', fields: { ...fields, details } }).ok).toBe(true);
		expect(send('varus-signer', { type: 'registration.approve', version: 2 })).toEqual({ ok: false, error: 'DOCUMENTS_NOT_READY' });
		expect(send('varus-signer', { type: 'document.review', id: document.id, version: 1, status: 'accepted', reason: 'DEMO checked' }).ok).toBe(true);
		expect(send('varus-signer', { type: 'registration.approve', version: 2 }).ok).toBe(true);
		expect(send('varus-owner', { ...document, content: 'DEMO mandate v2' }).ok).toBe(true);
		expect(send('varus-signer', { type: 'document.review', id: document.id, version: 2, status: 'accepted', reason: 'DEMO checked' }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 2 })).toEqual({ ok: false, error: 'PACKAGE_DOCUMENTS_CHANGED' });
		expect(send('varus-owner', { type: 'registration.save', fields: { ...fields, details } }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 3 })).toEqual({ ok: false, error: 'APPROVAL_REQUIRED' });
		expect(send('varus-signer', { type: 'registration.approve', version: 3 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 3 }).ok).toBe(true);
		const history = createDemoGateway(storage).workflow('varus-owner').registrations;
		expect(history[1].documentVersions).toEqual([{ id: document.id, version: 1 }]);
		expect(history[2].documentVersions).toEqual([{ id: document.id, version: 2 }]);
	});
	it('requires completeness and a different approver, versions edits, persists decisions and evidence', () => {
		const storage = storageFixture();
		let gateway = createDemoGateway(storage);
		const send = (actor: string, command: Parameters<typeof gateway.command>[2]) => gateway.command(actor, 'varus', command);
		expect(send('varus-owner', { type: 'registration.save', fields: { ...fields, documents: '' } }).ok).toBe(true);
		expect(send('varus-signer', { type: 'registration.approve', version: 1 }).ok).toBe(false);
		expect(send('varus-owner', { type: 'registration.save', fields }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.approve', version: 2 })).toEqual({ ok: false, error: 'SECOND_APPROVER_REQUIRED' });
		expect(send('varus-signer', { type: 'registration.approve', version: 2 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 2 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 2 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.resolve', version: 2, outcome: 'clarification', reason: 'DEMO missing detail' }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.save', fields: { ...fields, documents: 'DEMO updated mandate' } }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 3 }).ok).toBe(false);
		expect(send('varus-signer', { type: 'registration.approve', version: 3 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.submit', version: 3 }).ok).toBe(true);
		expect(send('varus-owner', { type: 'registration.evidence', version: 3, evidence: 'unverified manual upload' }).ok).toBe(true);
		expect(gateway.workflow('varus-owner').registrations.at(-1)?.status).toBe('review');
		expect(send('varus-owner', { type: 'registration.resolve', version: 3, outcome: 'registered', reason: 'DEMO decision' }).ok).toBe(true);
		gateway = createDemoGateway(storage);
		expect(gateway.workflow('varus-owner').registrations).toHaveLength(3);
		expect(gateway.workflow('varus-owner').registrations.at(-1)?.receipt).toBe('DEMO-varus-registration-3');
		expect(gateway.workflow('route-owner').registrations).toEqual([]);
		expect(gateway.workflow('rahunok-admin').registrations).toEqual([]);
		expect(send('varus-accountant', { type: 'registration.save', fields }).ok).toBe(false);
	});
});

describe('E3 seller evidence and memberships', () => {
	it('returns stable import receipts across replay and reload without exposing unrelated events', () => {
		const storage = storageFixture();
		const api = createDemoGateway(storage);
		const command = { type: 'ledger.import' as const, rows: [{ id: 'DEMO-receipt', kind: 'income' as const, courierId: 'courier-1', amountMinor: 1000, currency: 'UAH' as const, occurredAt: '2026-09-01T00:00:00.000Z', activity: 'taxi' }] };
		const initial = api.importRecords('varus-accountant', 'varus', command);
		expect(initial.status).toBe('processed');
		const snapshot = storage.getItem(DEMO_STORAGE_KEY);
		const restored = createDemoGateway(storage);
		const replay = restored.importRecords('varus-accountant', 'varus', command);
		expect(replay.status).toBe('replayed');
		expect(replay.rows[0]).toEqual({ ...initial.rows[0], status: 'replayed' });
		expect(storage.getItem(DEMO_STORAGE_KEY)).toBe(snapshot);
		expect(restored.importRecords('route-owner', 'varus', command)).toEqual({ status: 'rejected', error: 'FORBIDDEN', rows: [] });
		expect(restored.importRecords('varus-accountant', 'varus', { ...command, rows: [{ ...command.rows[0], amountMinor: 1 }] })).toEqual({ status: 'rejected', error: 'IDEMPOTENCY_CONFLICT', rows: [] });
	});
	it('onboards a taxi participant without granting a confirmed operator link', () => {
		const storage = storageFixture();
		const api = createDemoGateway(storage);
		expect(api.command('varus-integrator', 'varus', { type: 'seller.onboard', id: 'DEMO-seller-taxi', name: 'DEMO Taxi', activity: 'taxi' })).toMatchObject({ ok: false, error: 'FORBIDDEN' });
		expect(api.command('varus-owner', 'varus', { type: 'seller.onboard', id: 'DEMO-seller-taxi', name: 'DEMO Taxi', activity: 'taxi' }).ok).toBe(true);
		expect(api.workflow('varus-owner').participants).toContainEqual({ id: 'DEMO-seller-taxi', name: 'DEMO Taxi', activity: 'taxi', operatorId: 'varus' });
		expect(api.workflow('route-owner').participants.some(person => person.id === 'DEMO-seller-taxi')).toBe(false);
		expect(api.integration('varus-integrator').sellerIds).toContain('DEMO-seller-taxi');
		expect(api.workflow('varus-integrator').participants).toEqual([]);
		expect(api.contexts().some(person => person.id === 'DEMO-seller-taxi')).toBe(true);
		const profile = { courierId: 'DEMO-seller-taxi', kind: 'person' as const, residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO identity' };
		expect(api.command('varus-owner', 'varus', { type: 'seller.save', profile }).ok).toBe(true);
		expect(api.workflow('DEMO-seller-taxi').sellers[0].linked).toBe(false);
		expect(api.payouts('DEMO-seller-taxi', '2026-09').balances).toEqual([]);
		expect(api.command('route-owner', 'route', { type: 'seller.onboard', id: profile.courierId, name: 'DEMO Taxi', activity: 'taxi' }).ok).toBe(true);
		expect(api.command('route-owner', 'route', { type: 'seller.save', profile }).ok).toBe(true);
		expect(api.command('DEMO-seller-taxi', 'varus', { type: 'seller.link', courierId: profile.courierId }).ok).toBe(true);
		const restored = createDemoGateway(storage);
		expect(restored.warning).toBeNull();
		expect(restored.view(profile.courierId).operators).toHaveLength(2);
		expect(restored.payouts(profile.courierId, '2026-09').balances.map(item => item.operatorId)).toEqual(['varus']);
		expect(restored.workflow('route-owner').sellers[0].linked).toBe(false);
	});
	it('keeps profiles operator-scoped and requires courier confirmation and separate evidence', () => {
		const gateway = createDemoGateway(storageFixture());
		const profile = { courierId: 'courier-1', kind: 'fop' as const, residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO identity' };
		expect(gateway.command('varus-accountant', 'varus', { type: 'seller.save', profile }).ok).toBe(false);
		expect(gateway.command('varus-owner', 'varus', { type: 'seller.save', profile }).ok).toBe(true);
		expect(gateway.workflow('route-owner').sellers).toEqual([]);
		expect(gateway.command('varus-owner', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(false);
		expect(gateway.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(true);
		for (const provider of ['diia', 'bankid', 'iban'] as const) expect(gateway.command('varus-owner', 'varus', { type: 'seller.verify', courierId: 'courier-1', provider, outcome: 'verified' }).ok).toBe(true);
		expect(sellerBlockers(gateway.workflow('varus-owner').sellers[0], new Date().toISOString())).toEqual([]);
		expect(gateway.command('varus-owner', 'varus', { type: 'seller.verify', courierId: 'courier-1', provider: 'iban', outcome: 'expired' }).ok).toBe(true);
		expect(sellerBlockers(gateway.workflow('varus-owner').sellers[0], new Date().toISOString())).toContain('IBAN_EVIDENCE');
	});
	it('does not grant invitation permissions until acceptance and enforces revocation', () => {
		const storage = storageFixture(); const gateway = createDemoGateway(storage);
		expect(gateway.command('varus-owner', 'varus', { type: 'member.invite', id: 'demo-member-finance', email: 'finance@demo.example', permission: 'finance' }).ok).toBe(true);
		expect(gateway.view('demo-member-finance').entries).toEqual([]);
		expect(gateway.command('varus-owner', 'varus', { type: 'member.status', id: 'demo-member-finance', status: 'active' }).ok).toBe(false);
		expect(gateway.command('demo-member-finance', 'varus', { type: 'member.status', id: 'demo-member-finance', status: 'active' }).ok).toBe(true);
		expect(gateway.view('demo-member-finance').entries).toHaveLength(4);
		expect(gateway.command('varus-owner', 'varus', { type: 'member.status', id: 'demo-member-finance', status: 'revoked' }).ok).toBe(true);
		expect(createDemoGateway(storage).view('demo-member-finance').entries).toEqual([]);
		expect(gateway.command('varus-owner', 'varus', { type: 'member.status', id: 'varus-compliance', status: 'inactive' }).ok).toBe(true);
		expect(gateway.command('varus-compliance', 'varus', { type: 'registration.save', fields: {} as PackageFields }).ok).toBe(false);
	});
});