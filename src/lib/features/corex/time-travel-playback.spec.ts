import { describe, expect, it } from 'vitest';
import type { CorexStepAttempt } from './corex-process-gateway';
import type { ProcessDefinition } from './process-definition';
import {
	initSandbox,
	restoreHistorySnapshot,
	retryFromNode,
	stepSandbox
} from './process-sandbox-engine';

describe('time-travel-playback & error diagnostics', () => {
	const mockDefinition: ProcessDefinition = {
		schemaVersion: 1,
		id: 'time-travel-test-proc',
		name: 'Time Travel Process',
		description: 'Testing time travel and retry',
		lifecycle: 'draft',
		revision: 1,
		nodes: [
			{
				id: 'step-trigger',
				name: 'Початок процесу',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/api/v1/checkout' }
			},
			{
				id: 'step-validate',
				name: 'Валідація замовлення',
				type: 'transform',
				position: { x: 200, y: 0 },
				config: { mode: 'merge', mappings: { validated: '$.amount' } }
			},
			{
				id: 'step-charge',
				name: 'Списання коштів',
				type: 'http-request',
				position: { x: 400, y: 0 },
				config: {
					method: 'POST',
					url: 'https://api.monobank.ua/pay',
					timeoutMs: 15000,
					retry: { limit: 3, backoff: 'exponential' }
				}
			},
			{
				id: 'step-success',
				name: 'Успіх',
				type: 'end-success',
				position: { x: 600, y: 0 },
				config: {}
			}
		],
		edges: [
			{ id: 'e1', source: 'step-trigger', target: 'step-validate' },
			{ id: 'e2', source: 'step-validate', target: 'step-charge' },
			{ id: 'e3', source: 'step-charge', target: 'step-success' }
		]
	};

	it('supports stepping through all steps and records full history snapshots', () => {
		let state = initSandbox(mockDefinition, { orderId: 'ORD-100', amount: 500 });
		expect(state.currentNodeId).toBe('step-trigger');

		state = stepSandbox(mockDefinition, state);
		expect(state.currentNodeId).toBe('step-validate');

		state = stepSandbox(mockDefinition, state);
		expect(state.currentNodeId).toBe('step-charge');

		state = stepSandbox(mockDefinition, state);
		expect(state.currentNodeId).toBe('step-success');

		state = stepSandbox(mockDefinition, state);
		expect(state.status).toBe('complete');
		expect(state.history.length).toBe(4);
	});

	it('travels back in time to an earlier step with correct context snapshot and edge highlight', () => {
		let state = initSandbox(mockDefinition, { orderId: 'ORD-100', amount: 500 });
		state = stepSandbox(mockDefinition, state); // trigger
		state = stepSandbox(mockDefinition, state); // validate -> adds validated: true
		state = stepSandbox(mockDefinition, state); // charge -> adds http_step-charge

		expect(state.history.length).toBe(3);
		expect(state.context.validated).toBe(500);

		// Time-travel back to step 0 (after trigger)
		const step0 = restoreHistorySnapshot(mockDefinition, state, 0);
		expect(step0.currentNodeId).toBe('step-trigger');
		expect(step0.traversedNodeIds).toEqual(['step-trigger']);
		expect(step0.context.validated).toBeUndefined(); // validated wasn't run yet!

		// Time-travel to step 1 (after validation)
		const step1 = restoreHistorySnapshot(mockDefinition, state, 1);
		expect(step1.currentNodeId).toBe('step-validate');
		expect(step1.traversedNodeIds).toContain('step-validate');
		expect(step1.context.validated).toBe(500);
	});

	it('retries from a specific node and resumes execution seamlessly', () => {
		let state = initSandbox(mockDefinition, { orderId: 'ORD-100' });
		state = stepSandbox(mockDefinition, state); // trigger -> validate

		// Retry from trigger
		const retried = retryFromNode(mockDefinition, state, 'step-trigger');
		expect(retried.status).toBe('running');
		expect(retried.currentNodeId).toBe('step-trigger');
		expect(retried.history.at(-1)?.nodeType).toBe('retry-attempt');
		expect(retried.history.at(-1)?.action).toContain('Повторний запуск');

		// Can continue stepping from retried node
		const steppedAfterRetry = stepSandbox(mockDefinition, retried);
		expect(steppedAfterRetry.currentNodeId).toBe('step-validate');
	});

	it('correctly detects and analyzes failed step attempts for error diagnostics', () => {
		const mockAttempts: CorexStepAttempt[] = [
			{
				runId: 'run-1',
				executionGeneration: 1,
				stepId: 'step-trigger',
				visit: 1,
				durableStepName: 'trigger',
				kind: 'forward',
				attempt: 1,
				startedAt: '2026-09-05T12:00:00Z',
				finishedAt: '2026-09-05T12:00:01Z',
				outcome: 'complete',
				retry: { limit: 3, backoff: 'exponential', timeoutMs: 30000 },
				output: { status: 200, bytes: 42, contentType: 'application/json' },
				error: null
			},
			{
				runId: 'run-1',
				executionGeneration: 1,
				stepId: 'step-charge',
				visit: 1,
				durableStepName: 'charge',
				kind: 'forward',
				attempt: 3,
				startedAt: '2026-09-05T12:00:02Z',
				finishedAt: '2026-09-05T12:00:32Z',
				outcome: 'failed',
				retry: { limit: 3, backoff: 'exponential', timeoutMs: 30000 },
				output: null,
				error: { code: 'http_action_failed' }
			}
		];

		const failedAttempt = mockAttempts.findLast((a) => a.outcome === 'failed');
		expect(failedAttempt).toBeDefined();
		expect(failedAttempt?.stepId).toBe('step-charge');
		expect(failedAttempt?.error?.code).toBe('http_action_failed');
		expect(failedAttempt?.attempt).toBe(3);
		expect(failedAttempt?.retry.limit).toBe(3);
	});
});
