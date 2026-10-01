import { describe, expect, it } from 'vitest';
import { createDemoGateway } from './gateway';
import { reportArtifact, unresolvedReports, type Assessment, type Report } from './reports';
const gateway = () => { const data = new Map<string, string>(); return createDemoGateway({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } }); };
const assessmentFor = (courierId: string): Omit<Assessment, 'version' | 'author' | 'at'> => ({ courierId, quarter: '2026-Q3', outcome: 'reportable', reason: 'DEMO quarterly review', ruleSource: 'DEMO policy v1', feesMinor: 0, withholdingMinor: 0, evidence: 'DEMO reconciled charges' });
describe('E6 reports', () => {
	it('requires assessments and preserves snapshots when decisions are revised', () => {
		const api = gateway();
		const assessment = assessmentFor('courier-1');
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-unassessed', quarter: assessment.quarter, reason: '' }).ok).toBe(true);
		const original = api.reports('varus-owner')[0];
		expect(original.blockers).toContain('courier-1:REPORTABILITY_REVIEW');
		expect(original.rows[0].feesMinor).toBeNull();
		for (const persona of ['varus-integrator', 'courier-1', 'rahunok-admin', 'route-owner']) expect(api.command(persona, 'varus', { type: 'report.assess', assessment }).ok).toBe(false);
		expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment: { ...assessment, courierId: 'courier-4' } }).ok).toBe(false);
		expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment: { ...assessment, feesMinor: -1 } }).ok).toBe(false);
		expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-assessed', quarter: assessment.quarter, reason: '' }).ok).toBe(true);
		const assessed = api.reports('varus-owner')[1];
		expect(assessed.rows[0]).toMatchObject({ reportability: 'reportable', feesMinor: 0, withholdingMinor: 0, assessment: { version: 1 } });
		expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment: { ...assessment, outcome: 'excluded', feesMinor: 1200, reason: 'DEMO revised policy', ruleSource: 'DEMO policy v2' } }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-reassessed', quarter: assessment.quarter, reason: '' }).ok).toBe(true);
		expect(api.reports('varus-owner')[2].rows[0]).toMatchObject({ reportability: 'excluded', feesMinor: 1200, assessment: { version: 2 } });
		const artifact = reportArtifact(api.reports('varus-owner')[2]);
		expect(artifact.excludedIds).toEqual(['courier-1']);
		expect(artifact.submission.rows).toEqual([]);
		expect(artifact.submission.sources).toEqual([]);
		expect(reportArtifact(assessed).submission.totals.incomeMinor).toBe(assessed.rows[0].incomeMinor);
		expect(api.reports('varus-owner')[0]).toEqual(original);
		expect(api.reports('varus-owner')[1]).toEqual(assessed);
	});
	it('removes superseded failures from the active queue without changing history', () => {
		const history = [{ id: 'DEMO-original', status: 'rejected' }, { id: 'DEMO-correction', corrects: 'DEMO-original', status: 'rejected' }, { id: 'DEMO-final', corrects: 'DEMO-correction', status: 'accepted' }] as Report[];
		expect(unresolvedReports(history)).toEqual([]);
		expect(history[0].status).toBe('rejected');
		expect(unresolvedReports(history.slice(0, 2))).toHaveLength(2);
	});
	it('blocks pending batches, immutable blockers and invalid correction transitions', () => {
		const api = gateway();
		for (const courierId of ['courier-1', 'courier-2', 'courier-3']) {
			expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment: assessmentFor(courierId) }).ok).toBe(true);
			expect(api.command('varus-owner', 'varus', { type: 'seller.save', profile: { courierId, kind: 'person', residency: 'UA', tin: 'DEMO-TIN', account: 'DEMO-IBAN', documents: 'DEMO document' } }).ok).toBe(true);
			for (const provider of ['diia', 'bankid', 'iban'] as const) expect(api.command('varus-owner', 'varus', { type: 'seller.verify', courierId, provider, outcome: 'verified' }).ok).toBe(true);
		}
		expect(api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'batch.create', id: 'DEMO-wait', period: '2026-09', courierIds: ['courier-1'] }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-pending', quarter: '2026-Q3', reason: '' }).ok).toBe(true);
		expect(api.reports('varus-owner')[0].blockers).toContain('BATCH_RECONCILIATION');
		expect(api.command('varus-accountant', 'varus', { type: 'batch.cancel', id: 'DEMO-wait' }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'report.approve', id: 'DEMO-pending' }).ok).toBe(false);
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-wrong-quarter', quarter: '2026-Q4', corrects: 'DEMO-pending', reason: 'DEMO' }).ok).toBe(false);
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-ready', quarter: '2026-Q3', corrects: 'DEMO-pending', reason: 'DEMO reconciled' }).ok).toBe(true);
		expect(api.reports('varus-owner')[1].blockers).toEqual([]);
		expect(api.command('varus-signer', 'varus', { type: 'report.approve', id: 'DEMO-ready' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.submit', id: 'DEMO-ready' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.resolve', id: 'DEMO-ready', status: 'unavailable', reason: 'DEMO timeout' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.submit', id: 'DEMO-ready' }).ok).toBe(true);
		for (const status of ['received', 'rejected'] as const) expect(api.command('varus-accountant', 'varus', { type: 'report.resolve', id: 'DEMO-ready', status, reason: 'DEMO decision' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.submit', id: 'DEMO-ready' }).ok).toBe(false);
		expect(api.reports('courier-1')).toEqual([]);
	});
	it('blocks incomplete snapshots and requires new versions after data changes', () => {
		const api = gateway();
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-report-one', quarter: '2026-Q3', reason: '' }).ok).toBe(true);
		expect(api.command('varus-signer', 'varus', { type: 'report.approve', id: 'DEMO-report-one' }).ok).toBe(false);
		const original = api.reports('varus-owner')[0];
		for (const courierId of ['courier-1', 'courier-2', 'courier-3']) {
			expect(api.command('varus-accountant', 'varus', { type: 'report.assess', assessment: assessmentFor(courierId) }).ok).toBe(true);
			api.command('varus-owner', 'varus', { type: 'seller.save', profile: { courierId, kind: 'person', residency: 'UA', tin: `DEMO-${courierId}`, account: `DEMO-${courierId}`, documents: 'DEMO evidence' } });
			for (const provider of ['diia', 'bankid', 'iban'] as const) api.command('varus-owner', 'varus', { type: 'seller.verify', courierId, provider, outcome: 'verified' });
		}
		api.command('courier-1', 'varus', { type: 'seller.link', courierId: 'courier-1' });
		expect(api.command('varus-accountant', 'varus', { type: 'report.create', id: 'DEMO-report-two', quarter: '2026-Q3', corrects: original.id, reason: 'DEMO complete profiles' }).ok).toBe(true);
		expect(api.reports('varus-owner')[0]).toEqual(original);
		expect(api.reports('varus-owner')[1].blockers).toEqual([]);
		expect(api.command('varus-signer', 'varus', { type: 'report.approve', id: 'DEMO-report-two' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.submit', id: 'DEMO-report-two' }).ok).toBe(true);
		expect(api.command('varus-accountant', 'varus', { type: 'report.resolve', id: 'DEMO-report-two', status: 'accepted', reason: 'DEMO' }).ok).toBe(false);
		for (const status of ['received', 'accepted'] as const) expect(api.command('varus-accountant', 'varus', { type: 'report.resolve', id: 'DEMO-report-two', status, reason: 'DEMO' }).ok).toBe(true);
		const snapshot = api.reports('varus-owner')[1];
		api.command('varus-owner', 'varus', { type: 'ledger.import', rows: [{ id: 'DEMO-late', kind: 'income', courierId: 'courier-1', amountMinor: 1000, currency: 'UAH', occurredAt: '2026-09-01T00:00:00.000Z', activity: 'delivery' }] });
		expect(api.reports('varus-owner')[1]).toEqual(snapshot);
		expect(api.reports('courier-1')[0].rows).toHaveLength(1);
		expect(api.reports('courier-1')[0].sources.every(source => source.courierId === 'courier-1')).toBe(true);
		expect(api.reports('route-owner')).toEqual([]);
		expect(api.reports('rahunok-admin')).toEqual([]);
	});
});