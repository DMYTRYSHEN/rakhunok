import { financialEntries } from './payouts';
import { totals, type Entry, type Persona } from './gateway';
import { can, sellerBlockers, sellerIds, type SellerProfile, type WorkflowEvent, type WorkflowResult, type WorkflowState } from './workflow';

export type Assessment = { courierId: string; quarter: string; version: number; outcome: 'reportable' | 'excluded' | 'review'; reason: string; ruleSource: string; feesMinor: number; withholdingMinor: number; evidence: string; author: string; at: string };
export type ReportRow = { courierId: string; incomeMinor: number; paidMinor: number; customerMinor: number; activityCount: number; adjustmentsMinor: number; feesMinor: number | null; withholdingMinor: number | null; assessment?: Assessment; reportability: 'reportable' | 'excluded' | 'review'; ruleSource: string; explanation: string; profile?: SellerProfile };
export type Report = { id: string; quarter: string; version: number; ruleset: 'DEMO-UA-v1' | 'DEMO-UA-v2'; author: string; approvedBy?: string; at: string; source: 'DEMO-NOT-FOR-SUBMISSION'; sources: Entry[]; rows: ReportRow[]; blockers: string[]; corrects?: string; reason: string; status: 'draft' | 'approved' | 'submitted' | 'received' | 'accepted' | 'rejected' | 'unavailable'; receipt: string; decision: string };
export type ReportCommand =
	| { type: 'report.assess'; assessment: Omit<Assessment, 'version' | 'author' | 'at'> }
	| { type: 'report.create'; id: string; quarter: string; corrects?: string; reason: string; ruleset?: 'DEMO-UA-v2' }
	| { type: 'report.approve' | 'report.submit'; id: string }
	| { type: 'report.resolve'; id: string; status: 'received' | 'accepted' | 'rejected' | 'unavailable'; reason: string };
const failure = (error: string): WorkflowResult => ({ ok: false, error });
export function reportArtifact(report: Report) {
	const rows = report.rows.filter(row => report.ruleset === 'DEMO-UA-v1' || row.reportability === 'reportable');
	const identities = new Set(rows.map(row => row.courierId));
	return { ...report, submission: { source: report.source, rows, sources: report.sources.filter(source => identities.has(source.courierId)), totals: { incomeMinor: rows.reduce((sum, row) => sum + row.incomeMinor, 0), paidMinor: rows.reduce((sum, row) => sum + row.paidMinor, 0), activityCount: rows.reduce((sum, row) => sum + row.activityCount, 0), feesMinor: rows.some(row => row.feesMinor === null) ? null : rows.reduce((sum, row) => sum + row.feesMinor!, 0), withholdingMinor: rows.some(row => row.withholdingMinor === null) ? null : rows.reduce((sum, row) => sum + row.withholdingMinor!, 0) } }, excludedIds: report.rows.filter(row => row.reportability === 'excluded').map(row => row.courierId), reviewIds: report.rows.filter(row => row.reportability === 'review').map(row => row.courierId) };
}
export function unresolvedReports(reports: Report[]) {
	const resolved = new Set<string>();
	for (const report of reports.filter(item => item.status === 'accepted')) {
		let previous = report.corrects;
		while (previous && !resolved.has(previous)) {
			resolved.add(previous);
			previous = reports.find(item => item.id === previous)?.corrects;
		}
	}
	return reports.filter(report => ['rejected', 'unavailable'].includes(report.status) && !resolved.has(report.id));
}
export function reportPreview(state: WorkflowState, operatorId: string, quarter: string) {
	const [year, quarterNumber] = quarter.split('-Q');
	const sources = financialEntries(state).filter(entry => entry.operatorId === operatorId && entry.period.startsWith(`${year}-`) && Math.ceil(Number(entry.period.slice(5)) / 3) === Number(quarterNumber));
	const rows: ReportRow[] = [...new Set(sources.map(entry => entry.courierId))].map(courierId => {
		const own = sources.filter(entry => entry.courierId === courierId);
		const sums = totals(own);
		const ledger = (state.ledger.events[operatorId] ?? []).filter(event => event.courierId === courierId && event.kind === 'income' && sources.some(source => source.id === `income:${event.id}`));
		const assessment = state.assessments[operatorId]?.filter(item => item.courierId === courierId && item.quarter === quarter).at(-1);
		const adjustmentsMinor = (state.ledger.events[operatorId] ?? []).filter(event => event.kind === 'income' && event.adjustment && sources.some(source => source.id === `income:${event.id}`)).reduce((sum, event) => sum + (event.courierId === courierId ? event.amountMinor : 0) - (event.adjustment === 'reassign' && event.targetCourierId === courierId ? event.amountMinor : 0), 0);
		return { courierId, incomeMinor: sums.incomeMinor, paidMinor: sums.paidMinor, customerMinor: sums.customerMinor, activityCount: own.filter(entry => entry.incomeMinor > 0 && !entry.id.endsWith(':target') && !ledger.some(event => `income:${event.id}` === entry.id && event.adjustment)).length, adjustmentsMinor, feesMinor: assessment?.feesMinor ?? null, withholdingMinor: assessment?.withholdingMinor ?? null, assessment, reportability: assessment?.outcome ?? 'review', ruleSource: assessment?.ruleSource ?? 'DEMO-UA-v1: assessment required', explanation: assessment?.reason ?? 'No documented assessment for this participant and quarter.', profile: state.sellers[operatorId]?.find(profile => profile.courierId === courierId) };
	});
	return { sources, rows };
}
export function applyReport(state: WorkflowState, event: WorkflowEvent, actor: Persona): WorkflowResult {
	const command = event.command as ReportCommand;
	if (!can(actor, event.operatorId, command.type === 'report.approve' ? 'approve' : 'finance')) return failure('FORBIDDEN');
	const next = structuredClone(state);
	const reports = next.reports[event.operatorId] ??= [];
	if (command.type === 'report.assess') {
		const assessment = command.assessment;
		if (!assessment || !sellerIds(event.operatorId, state).includes(assessment.courierId) || !/^20\d{2}-Q[1-4]$/.test(assessment.quarter) || !['reportable', 'excluded', 'review'].includes(assessment.outcome) || ![assessment.reason, assessment.ruleSource, assessment.evidence].every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500) || !assessment.ruleSource.startsWith('DEMO') || !assessment.evidence.startsWith('DEMO') || ![assessment.feesMinor, assessment.withholdingMinor].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000)) return failure('INVALID_ASSESSMENT');
		const history = next.assessments[event.operatorId] ??= [];
		const previous = history.filter(item => item.courierId === assessment.courierId && item.quarter === assessment.quarter).at(-1);
		if (previous && Object.entries(assessment).every(([key, value]) => previous[key as keyof Assessment] === value)) return { ok: true, state };
		history.push({ courierId: assessment.courierId, quarter: assessment.quarter, outcome: assessment.outcome, reason: assessment.reason, ruleSource: assessment.ruleSource, feesMinor: assessment.feesMinor, withholdingMinor: assessment.withholdingMinor, evidence: assessment.evidence, version: (previous?.version ?? 0) + 1, author: actor.id, at: event.at });
	} else if (command.type === 'report.create') {
		if (!/^DEMO-[a-z0-9_-]{1,64}$/i.test(command.id) || !/^20\d{2}-Q[1-4]$/.test(command.quarter) || typeof command.reason !== 'string' || command.reason.length > 500 || reports.some(report => report.id === command.id)) return failure('INVALID_REPORT');
		const original = command.corrects ? reports.find(report => report.id === command.corrects) : undefined;
		if (command.corrects && (!original || !['rejected', 'accepted', 'draft'].includes(original.status) || original.quarter !== command.quarter || !command.reason.trim())) return failure('INVALID_CORRECTION');
		const { sources, rows } = reportPreview(state, event.operatorId, command.quarter);
		const blockers = rows.flatMap(row => sellerBlockers(row.profile, event.at, event.evidencePolicy === 2 ? state.documents[event.operatorId] ?? [] : []).map(blocker => `${row.courierId}:${blocker}`));
		for (const row of command.ruleset === 'DEMO-UA-v2' ? rows : []) {
			if (row.reportability === 'review') blockers.push(`${row.courierId}:REPORTABILITY_REVIEW`);
			if (!row.assessment) blockers.push(`${row.courierId}:CHARGES_UNCONFIRMED`);
			if ((row.feesMinor ?? 0) + (row.withholdingMinor ?? 0) > row.incomeMinor) blockers.push(`${row.courierId}:CHARGES_EXCEED_INCOME`);
		}
		if (!rows.length) blockers.push('EMPTY_REPORT');
		const inQuarter = (period: string) => `${period.slice(0, 4)}-Q${Math.ceil(Number(period.slice(5)) / 3)}` === command.quarter;
		if ((state.payouts.external[event.operatorId] ?? []).some(item => ['unknown', 'pending'].includes(item.status) && inQuarter(item.period))) blockers.push('EXTERNAL_RECONCILIATION');
		if ((state.payouts.batches[event.operatorId] ?? []).some(batch => !batch.cancelled && batch.instructions.some(item => ['pending', 'unknown'].includes(item.status)) && inQuarter(batch.period))) blockers.push('BATCH_RECONCILIATION');
		if (rows.some(row => row.incomeMinor < row.paidMinor)) blockers.push('NEGATIVE_BALANCE_REVIEW');
		reports.push({ id: command.id, quarter: command.quarter, version: reports.filter(report => report.quarter === command.quarter).length + 1, ruleset: command.ruleset ?? 'DEMO-UA-v1', author: actor.id, at: event.at, source: 'DEMO-NOT-FOR-SUBMISSION', sources, rows, blockers, ...(command.corrects ? { corrects: command.corrects } : {}), reason: command.reason, status: 'draft', receipt: '', decision: '' });
	} else {
		const report = reports.find(item => item.id === command.id);
		if (!report) return failure('UNKNOWN_REPORT');
		if (command.type === 'report.approve') {
			if (report.author === actor.id) return failure('SECOND_APPROVER_REQUIRED');
			if (report.status === 'approved' && report.approvedBy === actor.id) return { ok: true, state };
			if (report.status !== 'draft' || report.blockers.length) return failure('REPORT_BLOCKED');
			report.approvedBy = actor.id; report.status = 'approved';
		} else if (command.type === 'report.submit') {
			if (['submitted', 'received'].includes(report.status)) return { ok: true, state };
			if (!report.approvedBy || !['approved', 'unavailable'].includes(report.status)) return failure('APPROVAL_REQUIRED');
			report.status = 'submitted'; report.receipt = `DEMO-receipt-${report.id}`;
		} else if (command.type === 'report.resolve') {
			if (!['received', 'accepted', 'rejected', 'unavailable'].includes(command.status) || !command.reason?.trim() || command.reason.length > 500) return failure('INVALID_DECISION');
			if (report.status === command.status && report.decision === command.reason) return { ok: true, state };
			if (!['submitted', 'received', 'unavailable'].includes(report.status)) return failure('INVALID_TRANSITION');
			if (['accepted', 'rejected'].includes(command.status) && report.status !== 'received') return failure('RECEIPT_REQUIRED');
			report.status = command.status; report.decision = command.reason;
		} else return failure('UNKNOWN_COMMAND');
	}
	return { ok: true, state: next };
}