import { describe, expect, it } from 'vitest';
import type { CorexRunEvent } from './corex-process-gateway';
import { formatRunDetail, summarizeRunEvents } from './run-inspector';

function runEvent(
	sequence: number,
	eventType: string,
	stepName: string | null = null
): CorexRunEvent {
	return {
		id: sequence,
		runId: 'run-1',
		executionGeneration: 1,
		sequence,
		eventType,
		stepName,
		attempt: null,
		payload: {},
		createdAt: '2026-08-31T12:00:00.000Z'
	};
}

describe('run inspector', () => {
	it('summarizes completed steps and the currently active step', () => {
		const events = [
			runEvent(0, 'run_started'),
			runEvent(1, 'step_started', 'Fetch order'),
			runEvent(2, 'step_completed', 'Fetch order'),
			runEvent(3, 'step_started', 'Approve order')
		];

		expect(summarizeRunEvents(events)).toEqual({ completedSteps: 1, activeStep: 'Approve order' });
	});

	it('formats useful JSON details and suppresses empty values', () => {
		expect(formatRunDetail({ decision: 'approved' })).toBe('{\n  "decision": "approved"\n}');
		expect(formatRunDetail({})).toBeNull();
		expect(formatRunDetail(null)).toBeNull();
	});
});
