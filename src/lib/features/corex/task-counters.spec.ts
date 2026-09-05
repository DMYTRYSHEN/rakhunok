import { describe, expect, it } from 'vitest';
import type { FlowNode, FlowNodeTaskCounters } from './types';

describe('task counters and node state machine binding', () => {
	it('supports taskCounters on FlowNode data model', () => {
		const counters: FlowNodeTaskCounters = {
			queue: 3,
			passed: 42,
			error: 1
		};

		const node: FlowNode = {
			id: 'step-payment-callback',
			eyebrow: 'Worker',
			title: 'Очікування оплати',
			detail: 'Callback від LiqPay / Mono',
			status: 'waiting',
			meta: 'step.waitForEvent()',
			kind: 'action',
			position: { x: 200, y: 150 },
			taskCounters: counters,
			isCurrentTaskNode: true
		};

		expect(node.taskCounters?.queue).toBe(3);
		expect(node.taskCounters?.passed).toBe(42);
		expect(node.taskCounters?.error).toBe(1);
		expect(node.isCurrentTaskNode).toBe(true);
	});

	it('aggregates queue and passed metrics across tasks correctly', () => {
		const attempts = [
			{ stepId: 'step-1', outcome: 'complete' as const },
			{ stepId: 'step-1', outcome: 'complete' as const },
			{ stepId: 'step-2', outcome: 'complete' as const },
			{ stepId: 'step-3', outcome: 'failed' as const }
		];

		const activeStep = 'step-2';
		const activeRuns = [{ id: 'run-1', status: 'running' as const }];

		const counters: Record<string, FlowNodeTaskCounters> = {};

		for (const attempt of attempts) {
			counters[attempt.stepId] = counters[attempt.stepId] || { queue: 0, passed: 0, error: 0 };
			if (attempt.outcome === 'complete') {
				counters[attempt.stepId].passed = (counters[attempt.stepId].passed ?? 0) + 1;
			} else if (attempt.outcome === 'failed') {
				counters[attempt.stepId].error = (counters[attempt.stepId].error ?? 0) + 1;
			}
		}

		if (activeRuns.length > 0 && activeStep) {
			counters[activeStep] = counters[activeStep] || { queue: 0, passed: 0, error: 0 };
			counters[activeStep].queue = (counters[activeStep].queue ?? 0) + activeRuns.length;
		}

		expect(counters['step-1'].passed).toBe(2);
		expect(counters['step-1'].error).toBe(0);
		expect(counters['step-2'].passed).toBe(1);
		expect(counters['step-2'].queue).toBe(1);
		expect(counters['step-3'].error).toBe(1);
	});
});
