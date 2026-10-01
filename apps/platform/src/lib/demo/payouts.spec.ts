import { describe, expect, it } from 'vitest';
import { createDemoGateway, totals } from './gateway';
const gateway = () => { const data = new Map<string, string>(); return createDemoGateway({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } }); };
describe('E5 payouts', () => {
	it('separates accruals from refunds and both sides of a reassignment', () => {
		const api = gateway();
		const original = { id: 'DEMO-accrual', kind: 'income' as const, courierId: 'courier-1', amountMinor: 2000, currency: 'UAH' as const, occurredAt: '2026-09-01T00:00:00.000Z', activity: 'taxi' };
		expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [original, { ...original, id: 'DEMO-refund', amountMinor: -500, adjustment: 'refund', originalId: original.id, reason: 'DEMO refund' }, { ...original, id: 'DEMO-transfer', amountMinor: -1500, adjustment: 'reassign', originalId: original.id, targetCourierId: 'courier-2', reason: 'DEMO transfer' }] }).ok).toBe(true);
		const balances = api.payouts('varus-owner', '2026-09').balances;
		expect(balances[0]).toMatchObject({ accruedMinor: 17000, adjustmentsMinor: -2000, incomeMinor: 15000, available: 15000 });
		expect(balances[1]).toMatchObject({ accruedMinor: 30000, adjustmentsMinor: 1500, incomeMinor: 31500, available: 1500 });
	});
	it('reconciles sent pending instructions during suspension but blocks queued retries', () => {
		const api = gateway();
		for (const courierId of ['courier-1', 'courier-3']) {
			expect(api.command('varus-owner', 'varus', { type: 'seller.save', profile: { courierId, kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO document' } }).ok).toBe(true);
			for (const provider of ['diia', 'bankid', 'iban'] as const) expect(api.command('varus-owner', 'varus', { type: 'seller.verify', courierId, provider, outcome: 'verified' }).ok).toBe(true);
		}
		expect(api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-partial', period: '2026-08', courierIds: ['courier-1', 'courier-3'] }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-partial' }).ok).toBe(true);
		const first = { type: 'batch.result' as const, id: 'DEMO-partial', instructionId: 'DEMO-partial:courier-1', status: 'pending' as const, evidence: 'DEMO sent' };
		const second = { ...first, instructionId: 'DEMO-partial:courier-3', status: 'rejected' as const };
		expect(api.command('varus-accountant', 'varus', first).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', second).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.retry', id: second.id, instructionId: second.instructionId }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'seller.clarify', courierId: 'courier-1', reason: 'DEMO changed profile' }).ok).toBe(true);
		expect(api.command('rahunok-admin', 'varus', { type: 'operator.status', suspended: true, reason: 'DEMO incident' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { ...first, status: 'paid', evidence: 'DEMO late proof' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { ...first, status: 'paid', evidence: 'DEMO late proof' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { ...second, status: 'paid' })).toMatchObject({ ok: false, error: 'OPERATOR_SUSPENDED' });
		expect(totals(api.view('varus-owner').entries).paidMinor).toBe(58000);
	});
	it('reserves batches, requires independent approval and reconciles unknown exactly once', () => {
		const api = gateway();
		api.command('varus-owner', 'varus', { type: 'seller.save', profile: { courierId: 'courier-1', kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO document' } });
		api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' });
		for (const provider of ['diia', 'bankid', 'iban'] as const) api.command('varus-owner', 'varus', { type: 'seller.verify', courierId: 'courier-1', provider, outcome: 'verified' });
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-batch', period: '2026-09', courierIds: ['courier-1'] }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'batch.create', id: 'DEMO-duplicate', period: '2026-09', courierIds: ['courier-1'] }).ok).toBe(false);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-batch' }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-batch' }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'batch.approve', id: 'DEMO-batch' })).toEqual({ ok: false, error: 'ALREADY_APPROVED' });
		const result = { type: 'batch.result' as const, id: 'DEMO-batch', instructionId: 'DEMO-batch:courier-1', status: 'unknown' as const, evidence: 'DEMO timeout' };
		expect(api.command('varus-accountant', 'varus', result).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.retry', id: result.id, instructionId: result.instructionId }).ok).toBe(false);
		expect(totals(api.view('varus-owner').entries).paidMinor).toBe(52000);
		for (let repeat = 0; repeat < 2; repeat++) expect(api.command('varus-accountant', 'varus', { ...result, status: 'paid', evidence: 'DEMO bank proof' }).ok).toBe(true);
		expect(totals(api.view('varus-owner').entries).paidMinor).toBe(67000);
		expect(api.command('varus-signer', 'varus', { type: 'batch.approve', id: 'DEMO-batch' }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'batch.approve', id: 'DEMO-batch' })).toEqual({ ok: false, error: 'ALREADY_APPROVED' });
		expect(api.payouts('varus-owner', '2026-09').batches[0].approvedBy).toBe('varus-signer');
		expect(api.payouts('route-owner', '2026-09').batches).toEqual([]);
		expect(api.payouts('rahunok-admin', '2026-09').batches).toEqual([]);
	});
	it('accounts external evidence without duplicating paid values', () => {
		const api = gateway();
		const command = { type: 'payout.external' as const, id: 'DEMO-bank-ref', courierId: 'courier-1', amountMinor: 1000, period: '2026-09', occurredAt: '2026-10-17T00:00:00.000Z', status: 'unknown' as const, evidence: 'DEMO reference' };
		for (const occurredAt of ['2026-02-30T00:00:00.000Z', 'not-a-date', '2026-09-01']) expect(api.command('varus-accountant', 'varus', { ...command, occurredAt })).toEqual({ ok: false, error: 'INVALID_EXTERNAL_PAYOUT' });
		expect(api.command('varus-accountant', 'varus', command).ok).toBe(true);
		expect(api.payouts('varus-owner', '2026-09').external[0].occurredAt).toBe(command.occurredAt);
		expect(api.command('varus-accountant', 'varus', command).ok).toBe(true);
		expect(api.payouts('varus-owner', '2026-09').balances[0].reserved).toBe(1000);
		expect(api.command('varus-accountant', 'varus', { type: 'payout.reconcile', id: command.id, status: 'paid', evidence: 'DEMO statement' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', command).ok).toBe(true);
		expect(totals(api.view('courier-1').entries).paidMinor).toBe(18000);
	});
});