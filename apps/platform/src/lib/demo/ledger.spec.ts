import { describe, expect, it } from 'vitest';
import { createDemoGateway, totals } from './gateway';
import { exportCsv, parseImport, type LedgerInput } from './ledger';
const gateway = () => { const data = new Map<string, string>(); return createDemoGateway({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } }); };
const row: LedgerInput = { id: 'DEMO-income-1', kind: 'income', courierId: 'courier-1', amountMinor: 1000, currency: 'UAH', occurredAt: '2026-09-01T00:00:00.000Z', activity: 'delivery' };
describe('E4 ledger', () => {
	it('rejects invalid money and key scope, and keeps cancellation append-only', () => {
		const api = gateway();
		api.command('varus-integrator', 'varus', { type: 'key.create', id: 'DEMO-key-income', scopes: ['income'], environment: 'test' });
		for (const invalid of [{ ...row, currency: 'USD' as 'UAH' }, { ...row, amountMinor: 1.5 }, { ...row, occurredAt: '2026-02-30T00:00:00.000Z' }]) {
			expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [invalid] }).ok).toBe(false);
		}
		expect(api.command('varus-integrator', 'varus', { type: 'ledger.import', rows: [{ ...row, kind: 'customer' }], keyId: 'DEMO-key-income' })).toEqual({ ok: false, error: 'KEY_SCOPE' });
		expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [row] }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-correct', adjustment: 'correction', originalId: row.id, amountMinor: 200, reason: 'DEMO correction' }] }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-cancel', adjustment: 'cancel', originalId: row.id, amountMinor: -1200, reason: 'DEMO cancellation' }] }).ok).toBe(true);
		expect(totals(api.view('varus-owner').entries).incomeMinor).toBe(85000);
		expect(api.integration('varus-owner').events[0].amountMinor).toBe(1000);
		expect(api.command('varus-accountant', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-over-refund', adjustment: 'refund', originalId: row.id, amountMinor: -1, reason: 'DEMO over-refund' }] }).ok).toBe(false);
		api.command('varus-integrator', 'varus', { type: 'key.revoke', id: 'DEMO-key-income' });
		expect(api.command('varus-integrator', 'varus', { type: 'ledger.import', rows: [row], keyId: 'DEMO-key-income' }).ok).toBe(false);
	});
	it('enforces scoped keys, atomic import and canonical idempotency', () => {
		const api = gateway();
		expect(api.command('varus-integrator', 'varus', { type: 'key.create', id: 'DEMO-key-one', scopes: ['income'], environment: 'live' }).ok).toBe(false);
		expect(api.command('varus-integrator', 'varus', { type: 'key.create', id: 'DEMO-key-one', scopes: ['income'], environment: 'test' }).ok).toBe(true);
		const command = { type: 'ledger.import' as const, rows: [row], keyId: 'DEMO-key-one' };
		expect(api.command('varus-integrator', 'varus', command).ok).toBe(true);
		expect(api.command('varus-integrator', 'varus', command).ok).toBe(true);
		expect(totals(api.view('varus-owner').entries).incomeMinor).toBe(86000);
		expect(api.command('varus-owner', 'varus', { ...command, rows: [{ ...row, amountMinor: 2 }] }).ok).toBe(false);
		expect(api.command('varus-owner', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-new' }, { ...row, id: 'DEMO-invalid', courierId: 'courier-4' }] }).ok).toBe(false);
		expect(api.integration('varus-owner').events).toHaveLength(1);
		expect(api.command('varus-owner', 'varus', { type: 'key.rotate', id: 'DEMO-key-one', replacementId: 'DEMO-key-two' }).ok).toBe(true);
		expect(api.command('varus-integrator', 'varus', command).ok).toBe(false);
		expect(api.integration('route-owner').events).toEqual([]);
	});
	it('appends corrections and reassignment without altering sources', () => {
		const api = gateway();
		api.command('varus-owner', 'varus', { type: 'ledger.import', rows: [row] });
		expect(api.command('varus-owner', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-refund', amountMinor: -200, adjustment: 'refund', originalId: row.id, reason: 'DEMO refund' }] }).ok).toBe(true);
		expect(api.command('varus-owner', 'varus', { type: 'ledger.import', rows: [{ ...row, id: 'DEMO-transfer', amountMinor: -800, adjustment: 'reassign', originalId: row.id, reason: 'DEMO correction', targetCourierId: 'courier-2' }] }).ok).toBe(true);
		expect(api.integration('varus-owner').events[0].amountMinor).toBe(1000);
		expect(totals(api.view('varus-owner').entries).incomeMinor).toBe(85800);
		expect(totals(api.view('courier-1').entries).incomeMinor).toBe(53000);
	});
	it('parses quoted CSV and mapping, rejects malformed/oversized files and protects spreadsheet exports', () => {
		const csv = 'external,kind,courierId,amountMinor,currency,occurredAt,activity\nDEMO-one,income,courier-1,100,UAH,2026-09-01T00:00:00.000Z,"delivery, food"';
		const result = parseImport(csv, 'csv', { id: 'external' });
		expect(result.errors).toEqual([]); expect(result.rows[0].activity).toBe('delivery, food'); expect(result.rows[0].amountMinor).toBe(100);
		expect(parseImport('{', 'json').errors.length).toBe(1);
		expect(parseImport('a'.repeat(100001), 'csv').errors).toContain('FILE_LIMIT_100KB');
		expect(exportCsv([{ value: '=HYPERLINK("bad")' }])).toContain("'=HYPERLINK");
	});
});