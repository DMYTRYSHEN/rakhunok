import { describe, expect, it } from 'vitest';
import {
	PROCESS_DEFINITION_SCHEMA_VERSION,
	createStarterProcessDefinition,
	type ProcessDefinition,
	validateProcessDefinition
} from './process-definition';
import { processDefinitionToFlowScenario } from './process-definition-adapter';
import { compileProcessDefinition } from './process-compiler';

function validDefinition(): ProcessDefinition {
	return {
		schemaVersion: PROCESS_DEFINITION_SCHEMA_VERSION,
		id: 'payment-callback',
		name: 'Payment callback',
		description: 'Accept and forward a verified payment callback.',
		revision: 1,
		lifecycle: 'draft',
		nodes: [
			{
				id: 'trigger',
				name: 'accept-callback',
				type: 'trigger-http',
				position: { x: 0, y: 0 },
				config: { method: 'POST', path: '/callbacks/payment' }
			},
			{
				id: 'forward',
				name: 'forward-callback',
				type: 'http-request',
				position: { x: 280, y: 0 },
				config: {
					method: 'POST',
					url: 'https://api.example.com/payments',
					timeoutMs: 30_000,
					retry: { limit: 3, backoff: 'exponential' },
					idempotencyKey: '$.paymentId',
					outputPolicy: {
						mode: 'inline',
						maxBytes: 16_384,
						redactPaths: ['$.customer.email']
					}
				}
			},
			{
				id: 'success',
				name: 'return-success',
				type: 'end-success',
				position: { x: 560, y: 0 },
				config: { outputExpression: '$.forward.response' }
			}
		],
		edges: [
			{ id: 'trigger-forward', source: 'trigger', target: 'forward' },
			{ id: 'forward-success', source: 'forward', target: 'success' }
		]
	};
}

function parallelDefinition(): ProcessDefinition {
	const definition = validDefinition();
	definition.nodes.splice(
		1,
		1,
		{
			id: 'parallel',
			name: 'prepare-payment',
			type: 'parallel',
			position: { x: 220, y: 0 },
			config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'preparation' }
		},
		{
			id: 'risk',
			name: 'calculate-risk',
			type: 'transform',
			position: { x: 440, y: -120 },
			config: { mode: 'replace', mappings: { score: '$.riskScore' } }
		},
		{
			id: 'receipt',
			name: 'prepare-receipt',
			type: 'transform',
			position: { x: 440, y: 120 },
			config: { mode: 'replace', mappings: { id: '$.paymentId' } }
		},
		{
			id: 'join',
			name: 'payment-prepared',
			type: 'parallel-join',
			position: { x: 660, y: 0 },
			config: { parallelId: 'parallel' }
		}
	);
	definition.edges = [
		{ id: 'trigger-parallel', source: 'trigger', target: 'parallel' },
		{ id: 'parallel-risk', source: 'parallel', target: 'risk', parallel: 'risk' },
		{ id: 'parallel-receipt', source: 'parallel', target: 'receipt', parallel: 'receipt' },
		{ id: 'risk-join', source: 'risk', target: 'join' },
		{ id: 'receipt-join', source: 'receipt', target: 'join' },
		{ id: 'join-success', source: 'join', target: 'success' }
	];
	return definition;
}

describe('validateProcessDefinition', () => {
	it('accepts the initial executable HTTP workflow subset', () => {
		expect(validateProcessDefinition(validDefinition())).toEqual({ valid: true, issues: [] });
	});

	it.each([
		{
			type: 'trigger-schedule' as const,
			config: { cron: '0 */6 * * *', timezone: 'UTC' },
			trigger: { kind: 'schedule', cron: '0 */6 * * *', timezone: 'UTC' },
			entrypoint: '0 */6 * * * · UTC'
		},
		{
			type: 'trigger-event' as const,
			config: { source: 'queue' as const, eventType: 'invoice.created', binding: 'INVOICE_EVENTS' },
			trigger: {
				kind: 'event',
				source: 'queue',
				eventType: 'invoice.created',
				binding: 'INVOICE_EVENTS'
			},
			entrypoint: 'queue · invoice.created'
		}
	])(
		'validates, compiles, and projects a $type process trigger',
		({ type, config, trigger, entrypoint }) => {
			const definition = validDefinition();
			definition.nodes[0] =
				type === 'trigger-schedule'
					? {
							id: 'trigger',
							name: 'start-process',
							type,
							position: { x: 0, y: 0 },
							config: { cron: config.cron!, timezone: config.timezone! }
						}
					: {
							id: 'trigger',
							name: 'start-process',
							type,
							position: { x: 0, y: 0 },
							config: {
								source: config.source!,
								eventType: config.eventType!,
								binding: config.binding
							}
						};

			expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
			const compiled = compileProcessDefinition(definition);
			expect(compiled.ok).toBe(true);
			if (!compiled.ok) return;
			expect(compiled.plan.trigger).toEqual(trigger);
			expect(compiled.plan.entryNodeId).toBe('forward');
			expect(processDefinitionToFlowScenario(definition).entrypoint).toBe(entrypoint);
		}
	);

	it.each([
		{
			type: 'trigger-schedule' as const,
			config: { cron: '', timezone: 'UTC' }
		},
		{
			type: 'trigger-event' as const,
			config: { source: 'queue' as const, eventType: 'invoice.created' }
		}
	])('rejects incomplete $type configuration', ({ type, config }) => {
		const definition = validDefinition();
		definition.nodes[0] =
			type === 'trigger-schedule'
				? {
						id: 'trigger',
						name: 'start-process',
						type,
						position: { x: 0, y: 0 },
						config
					}
				: {
						id: 'trigger',
						name: 'start-process',
						type,
						position: { x: 0, y: 0 },
						config
					};

		expect(validateProcessDefinition(definition)).toMatchObject({
			valid: false,
			issues: expect.arrayContaining([expect.objectContaining({ code: 'invalid-trigger' })])
		});
	});

	it('applies single-entry graph invariants across mixed trigger kinds', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'schedule',
			name: 'scheduled-start',
			type: 'trigger-schedule',
			position: { x: 0, y: 100 },
			config: { cron: '0 * * * *', timezone: 'UTC' }
		});
		definition.edges.push({ id: 'success-schedule', source: 'success', target: 'schedule' });

		expect(validateProcessDefinition(definition)).toMatchObject({
			valid: false,
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'multiple-triggers' }),
				expect.objectContaining({ code: 'trigger-has-input', nodeId: 'schedule' })
			])
		});
	});

	it('validates and compiles an HTTP compensation handler outside normal traversal', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'refund',
			name: 'refund-payment',
			type: 'http-request',
			position: { x: 280, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/refunds',
				timeoutMs: 10_000,
				retry: { limit: 5, backoff: 'linear' },
				idempotencyKey: '$.paymentId'
			}
		});
		definition.edges.push({
			id: 'forward-refund',
			source: 'forward',
			target: 'refund',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(expect.objectContaining({ id: 'refund' }));
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			next: 'success',
			compensation: {
				id: 'refund',
				name: 'refund-payment',
				config: {
					url: 'https://api.example.com/refunds',
					timeoutMs: 10_000,
					retry: { limit: 5, backoff: 'linear' }
				}
			}
		});
	});

	it('validates and compiles a transform compensation handler outside normal traversal', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'restore-context',
			name: 'restore-payment-context',
			type: 'transform',
			position: { x: 280, y: 180 },
			config: {
				mode: 'merge',
				mappings: { rollbackStatus: '$.error.name' }
			}
		});
		definition.edges.push({
			id: 'forward-restore-context',
			source: 'forward',
			target: 'restore-context',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				config: {
					mode: 'merge',
					mappings: { rollbackStatus: '$.error.name' }
				}
			}
		});
	});

	it('validates and compiles compensation for a completed event wait', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'event',
				name: 'wait-for-payment',
				type: 'wait-event',
				position: { x: 280, y: 0 },
				config: {
					eventType: 'payment-completed',
					timeoutMs: 60_000,
					resultKey: 'payment',
					outputPolicy: { mode: 'metadata', maxBytes: 16_384 }
				}
			},
			{
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				position: { x: 280, y: 180 },
				config: {
					mode: 'merge',
					mappings: { rollbackStatus: '$.error.name' }
				}
			}
		);
		definition.edges = [
			{ id: 'trigger-event', source: 'trigger', target: 'event' },
			{ id: 'event-success', source: 'event', target: 'success' },
			{
				id: 'event-restore-context',
				source: 'event',
				target: 'restore-context',
				compensation: true
			}
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'event')).toMatchObject({
			next: 'success',
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform'
			}
		});
	});

	it('validates and compiles transform compensation for a transform action', () => {
		const definition = validDefinition();
		const forwardIndex = definition.nodes.findIndex((node) => node.id === 'forward');
		definition.nodes.splice(forwardIndex, 1, {
			id: 'forward',
			name: 'shape-payment',
			type: 'transform',
			position: { x: 280, y: 0 },
			config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } }
		});
		definition.nodes.push({
			id: 'restore-context',
			name: 'restore-payment-context',
			type: 'transform',
			position: { x: 280, y: 180 },
			config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
		});
		definition.edges.push({
			id: 'forward-restore-context',
			source: 'forward',
			target: 'restore-context',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			type: 'transform',
			compensation: {
				id: 'restore-context',
				name: 'restore-payment-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
			}
		});
	});

	it('validates and compiles HTTP compensation for a transform action', () => {
		const definition = validDefinition();
		const forwardIndex = definition.nodes.findIndex((node) => node.id === 'forward');
		definition.nodes.splice(forwardIndex, 1, {
			id: 'forward',
			name: 'shape-payment',
			type: 'transform',
			position: { x: 280, y: 0 },
			config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } }
		});
		definition.nodes.push({
			id: 'reverse-payment',
			name: 'reverse-payment',
			type: 'http-request',
			position: { x: 280, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.test/payments/reverse',
				timeoutMs: 5_000,
				retry: { limit: 2, backoff: 'exponential' }
			}
		});
		definition.edges.push({
			id: 'forward-reverse-payment',
			source: 'forward',
			target: 'reverse-payment',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'reverse-payment' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			type: 'transform',
			compensation: {
				id: 'reverse-payment',
				name: 'reverse-payment',
				type: 'http-request',
				config: {
					method: 'POST',
					url: 'https://api.example.test/payments/reverse',
					timeoutMs: 5_000,
					retry: { limit: 2, backoff: 'exponential' }
				}
			}
		});
	});

	it('validates and compiles transform compensation for a subprocess action', () => {
		const definition = validDefinition();
		const forwardIndex = definition.nodes.findIndex((node) => node.id === 'forward');
		definition.nodes.splice(forwardIndex, 1, {
			id: 'forward',
			name: 'create-invoice',
			type: 'invoke-process',
			position: { x: 280, y: 0 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'invoice',
				timeoutMs: 60_000
			}
		});
		definition.nodes.push({
			id: 'restore-context',
			name: 'restore-invoice-context',
			type: 'transform',
			position: { x: 280, y: 180 },
			config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
		});
		definition.edges.push({
			id: 'forward-restore-context',
			source: 'forward',
			target: 'restore-context',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			type: 'invoke-process',
			compensation: {
				id: 'restore-context',
				name: 'restore-invoice-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
			}
		});
	});

	it('validates and compiles HTTP compensation for a subprocess action', () => {
		const definition = validDefinition();
		const forwardIndex = definition.nodes.findIndex((node) => node.id === 'forward');
		definition.nodes.splice(forwardIndex, 1, {
			id: 'forward',
			name: 'create-invoice',
			type: 'invoke-process',
			position: { x: 280, y: 0 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'invoice',
				timeoutMs: 60_000
			}
		});
		definition.nodes.push({
			id: 'cancel-invoice',
			name: 'cancel-invoice',
			type: 'http-request',
			position: { x: 280, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/invoices/cancel',
				timeoutMs: 8_000,
				retry: { limit: 3, backoff: 'exponential' },
				idempotencyKey: '$.output.childRunId'
			}
		});
		definition.edges.push({
			id: 'forward-cancel-invoice',
			source: 'forward',
			target: 'cancel-invoice',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(expect.objectContaining({ id: 'cancel-invoice' }));
		expect(result.plan.nodes.find((node) => node.id === 'forward')).toMatchObject({
			type: 'invoke-process',
			compensation: {
				id: 'cancel-invoice',
				name: 'cancel-invoice',
				type: 'http-request',
				config: {
					url: 'https://api.example.com/invoices/cancel',
					timeoutMs: 8_000,
					retry: { limit: 3, backoff: 'exponential' }
				}
			}
		});
	});

	it('rejects a compensation handler that is also part of normal traversal', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'refund',
			name: 'refund-payment',
			type: 'http-request',
			position: { x: 420, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/refunds',
				timeoutMs: 10_000,
				retry: { limit: 1, backoff: 'constant' }
			}
		});
		definition.edges.push(
			{ id: 'forward-refund', source: 'forward', target: 'refund', compensation: true },
			{ id: 'refund-success', source: 'refund', target: 'success' }
		);

		expect(validateProcessDefinition(definition).issues).toContainEqual({
			code: 'invalid-compensation',
			message: 'HTTP step "refund-payment" has an invalid compensation route.',
			nodeId: 'refund'
		});
	});

	it('rejects unsafe success output expressions', () => {
		const definition = validDefinition();
		const terminal = definition.nodes[2];
		if (terminal.type !== 'end-success') throw new Error('Expected success terminal fixture.');
		terminal.config.outputExpression = 'forward.response';

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual({
			code: 'invalid-output-expression',
			message: 'Success output requires a safe JSON path.',
			nodeId: 'success'
		});
	});

	it('validates and compiles an explicit failure terminal', () => {
		const definition = validDefinition();
		definition.nodes[2] = {
			id: 'failure',
			name: 'reject-payment',
			type: 'end-failure',
			position: { x: 560, y: 0 },
			config: { code: 'payment_rejected', message: 'Payment policy rejected the request.' }
		};
		definition.edges[1] = { id: 'forward-failure', source: 'forward', target: 'failure' };

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result).toMatchObject({
			ok: true,
			plan: {
				nodes: expect.arrayContaining([
					{
						id: 'failure',
						name: 'reject-payment',
						type: 'end-failure',
						config: {
							code: 'payment_rejected',
							message: 'Payment policy rejected the request.'
						}
					}
				])
			}
		});
	});

	it('rejects cycles and nodes that are unreachable from the trigger', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'orphan',
			name: 'orphan-action',
			type: 'http-request',
			position: { x: 280, y: 180 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/orphan',
				timeoutMs: 10_000,
				retry: { limit: 0, backoff: 'constant' }
			}
		});
		definition.edges.push({ id: 'success-forward', source: 'success', target: 'forward' });

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['cycle', 'terminal-has-output', 'unreachable-node'])
		);
	});

	it('rejects unsafe connector and retry configuration', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.url = 'http://internal.example.com';
		action.config.timeoutMs = 1_800_001;
		action.config.retry.limit = 11;

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['invalid-http-url', 'invalid-timeout', 'invalid-retry-limit'])
		);
	});

	it('rejects clearly non-public HTTP targets', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.url = 'https://127.0.0.1/admin';

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toContain('invalid-http-host');
	});

	it('validates condition branches, durable waits, and safe transforms', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'transform',
				name: 'shape-payment',
				type: 'transform',
				position: { x: 220, y: 0 },
				config: {
					mode: 'merge',
					mappings: { paymentId: '$.paymentId' },
					outputPolicy: {
						mode: 'external',
						maxBytes: 1_048_576,
						redactPaths: ['$.customer.email']
					}
				}
			},
			{
				id: 'condition',
				name: 'is-large-payment',
				type: 'condition',
				position: { x: 440, y: 0 },
				config: { path: '$.amount', operator: 'greater-than', value: 100 }
			},
			{
				id: 'wait',
				name: 'brief-delay',
				type: 'wait',
				position: { x: 660, y: -100 },
				config: { durationMs: 5_000 }
			}
		);
		definition.edges = [
			{ id: 'trigger-transform', source: 'trigger', target: 'transform' },
			{ id: 'transform-condition', source: 'transform', target: 'condition' },
			{ id: 'condition-wait', source: 'condition', target: 'wait', when: true },
			{ id: 'condition-success', source: 'condition', target: 'success', when: false },
			{ id: 'wait-success', source: 'wait', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const scenario = processDefinitionToFlowScenario(definition);
		expect(scenario.nodes.map((node) => node.workflow?.type)).toEqual([
			'trigger-http',
			'data-transform',
			'if',
			'step-sleep',
			'end-success'
		]);
		expect(scenario.edges.find((edge) => edge.id === 'condition-wait')).toMatchObject({
			label: 'true',
			tone: 'success'
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'transform',
			config: {
				outputPolicy: {
					mode: 'external',
					maxBytes: 1_048_576,
					redactPaths: ['$.customer.email']
				}
			}
		});
	});

	it('validates and compiles compensation for a completed durable wait', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'wait',
				name: 'brief-delay',
				type: 'wait',
				position: { x: 280, y: 0 },
				config: { durationMs: 5_000 }
			},
			{
				id: 'restore-wait',
				name: 'restore-wait',
				type: 'transform',
				position: { x: 280, y: 180 },
				config: { mode: 'merge', mappings: { amount: '$.input.amount' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-wait', source: 'trigger', target: 'wait' },
			{ id: 'wait-success', source: 'wait', target: 'success' },
			{ id: 'wait-restore', source: 'wait', target: 'restore-wait', compensation: true }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes).toHaveLength(2);
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'wait',
			compensation: { id: 'restore-wait', type: 'transform' }
		});

		definition.nodes[1] = {
			id: 'wait',
			name: 'settlement-window',
			type: 'wait-until',
			position: { x: 280, y: 0 },
			config: { timestamp: '2030-01-01T00:00:00.000Z' }
		};
		const absoluteCompiled = compileProcessDefinition(definition);
		expect(absoluteCompiled.ok).toBe(true);
		if (!absoluteCompiled.ok) return;
		expect(absoluteCompiled.plan.nodes[0]).toMatchObject({
			type: 'wait-until',
			compensation: { id: 'restore-wait', type: 'transform' }
		});
	});

	it('rejects transform inline output limits above 16 KiB', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'transform',
			name: 'oversized-inline-output',
			type: 'transform',
			position: { x: 280, y: 0 },
			config: {
				mode: 'merge',
				mappings: { paymentId: '$.paymentId' },
				outputPolicy: { mode: 'inline', maxBytes: 16_385 }
			}
		});
		definition.edges = [
			{ id: 'trigger-transform', source: 'trigger', target: 'transform' },
			{ id: 'transform-success', source: 'transform', target: 'success' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual({
			code: 'invalid-transform',
			message:
				'Transforms require safe mappings, an inline limit up to 16384 bytes or external limit up to 10485760 bytes, and up to 20 unique child JSON paths for redaction.',
			nodeId: 'transform'
		});
	});

	it('rejects duplicate and root transform output redaction paths', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'transform',
			name: 'unsafe-redaction-profile',
			type: 'transform',
			position: { x: 280, y: 0 },
			config: {
				mode: 'merge',
				mappings: { paymentId: '$.paymentId' },
				outputPolicy: { mode: 'inline', maxBytes: 1024, redactPaths: ['$', '$'] }
			}
		});
		definition.edges = [
			{ id: 'trigger-transform', source: 'trigger', target: 'transform' },
			{ id: 'transform-success', source: 'transform', target: 'success' }
		];

		expect(validateProcessDefinition(definition).issues.map((issue) => issue.code)).toContain(
			'invalid-transform'
		);
	});

	it('rejects subprocess inline output limits above 16 KiB', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'subprocess',
			name: 'oversized-child-output',
			type: 'invoke-process',
			position: { x: 280, y: 0 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'child',
				timeoutMs: 60_000,
				outputPolicy: { mode: 'inline', maxBytes: 16_385 }
			}
		});
		definition.edges = [
			{ id: 'trigger-subprocess', source: 'trigger', target: 'subprocess' },
			{ id: 'subprocess-success', source: 'subprocess', target: 'success' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual({
			code: 'invalid-subprocess',
			message:
				'Subprocesses require a process ID, safe input/result names, a timeout between 1 ms and 365 days, an inline limit up to 16384 bytes or external limit up to 10485760 bytes, and up to 20 unique child JSON paths for redaction.',
			nodeId: 'subprocess'
		});
	});

	it('accepts bounded external subprocess output and rejects limits above 10 MiB', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'subprocess',
			name: 'external-child-output',
			type: 'invoke-process',
			position: { x: 280, y: 0 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'child',
				timeoutMs: 60_000,
				outputPolicy: { mode: 'external', maxBytes: 10_485_760 }
			}
		});
		definition.edges = [
			{ id: 'trigger-subprocess', source: 'trigger', target: 'subprocess' },
			{ id: 'subprocess-success', source: 'subprocess', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const subprocess = definition.nodes[1];
		if (subprocess.type !== 'invoke-process') throw new Error('Expected subprocess fixture.');
		subprocess.config.outputPolicy = { mode: 'external', maxBytes: 10_485_761 };
		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-subprocess', nodeId: 'subprocess' })
		);
	});

	it('accepts bounded external event output and rejects limits above 10 MiB', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'payment-event',
			name: 'wait-for-payment',
			type: 'wait-event',
			position: { x: 280, y: 0 },
			config: {
				eventType: 'payment-approved',
				resultKey: 'payment',
				timeoutMs: 60_000,
				outputPolicy: { mode: 'external', maxBytes: 10_485_760 }
			}
		});
		definition.edges = [
			{ id: 'trigger-event', source: 'trigger', target: 'payment-event' },
			{ id: 'event-success', source: 'payment-event', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const event = definition.nodes[1];
		if (event.type !== 'wait-event') throw new Error('Expected event fixture.');
		event.config.outputPolicy = { mode: 'external', maxBytes: 10_485_761 };
		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-wait', nodeId: 'payment-event' })
		);
	});

	it('validates, renders, and compiles an absolute durable wait', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'deadline',
			name: 'wait-for-settlement-window',
			type: 'wait-until',
			position: { x: 280, y: 0 },
			config: { timestamp: '2026-09-02T08:30:00.000Z' }
		});
		definition.edges = [
			{ id: 'trigger-deadline', source: 'trigger', target: 'deadline' },
			{ id: 'deadline-success', source: 'deadline', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[1]).toMatchObject({
			meta: '2026-09-02T08:30:00.000Z',
			workflow: { type: 'step-sleep-until', timestamp: '2026-09-02T08:30:00.000Z' }
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toEqual({
			id: 'deadline',
			name: 'wait-for-settlement-window',
			type: 'wait-until',
			config: { timestamp: '2026-09-02T08:30:00.000Z' },
			next: 'success'
		});
	});

	it('rejects malformed or non-canonical absolute wait timestamps', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'deadline',
			name: 'invalid-deadline',
			type: 'wait-until',
			position: { x: 280, y: 0 },
			config: { timestamp: '2026-09-02 08:30' }
		});
		definition.edges = [
			{ id: 'trigger-deadline', source: 'trigger', target: 'deadline' },
			{ id: 'deadline-success', source: 'deadline', target: 'success' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual({
			code: 'invalid-wait',
			message: 'Absolute waits require a canonical UTC ISO timestamp.',
			nodeId: 'deadline'
		});
	});

	it('rejects malformed conditions, waits, and transforms', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'condition',
				name: 'invalid-condition',
				type: 'condition',
				position: { x: 220, y: 0 },
				config: { path: 'input.amount', operator: 'equals' }
			},
			{
				id: 'wait',
				name: 'invalid-wait',
				type: 'wait',
				position: { x: 440, y: 0 },
				config: { durationMs: 0 }
			},
			{
				id: 'transform',
				name: 'invalid-transform',
				type: 'transform',
				position: { x: 660, y: 0 },
				config: { mode: 'merge', mappings: { 'bad key': 'input.value' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-condition', source: 'trigger', target: 'condition' },
			{ id: 'condition-wait', source: 'condition', target: 'wait', when: true },
			{ id: 'wait-transform', source: 'wait', target: 'transform' },
			{ id: 'transform-success', source: 'transform', target: 'success' }
		];

		const result = validateProcessDefinition(definition);
		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining(['invalid-condition', 'invalid-wait', 'invalid-transform'])
		);
	});

	it('validates, renders, and compiles durable event waits', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval',
			name: 'wait-for-approval',
			type: 'wait-event',
			position: { x: 280, y: 0 },
			config: {
				eventType: 'payment-approved',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.approvedBy'] }
			}
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[1]).toMatchObject({
			meta: 'payment-approved · 86400000 ms',
			workflow: { type: 'step-wait-for-event', eventType: 'payment-approved' }
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'wait-event',
			config: {
				eventType: 'payment-approved',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.approvedBy'] }
			},
			next: 'success'
		});

		const wait = definition.nodes[1];
		if (wait.type !== 'wait-event') throw new Error('Expected event wait fixture.');
		wait.config.eventType = 'unsafe event type';
		wait.config.timeoutMs = 0;
		wait.config.outputPolicy = { mode: 'inline', maxBytes: 16_385 };
		expect(validateProcessDefinition(definition).issues.map((issue) => issue.code)).toContain(
			'invalid-wait'
		);
	});

	it('validates, renders, and compiles human approvals', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			position: { x: 280, y: 0 },
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.actorUserId'] }
			}
		});
		definition.nodes.push({
			id: 'rejected',
			name: 'return-rejected',
			type: 'end-success',
			position: { x: 560, y: 180 },
			config: {}
		});
		definition.nodes.push({
			id: 'restore-approval',
			name: 'restore-approval',
			type: 'transform',
			position: { x: 280, y: 180 },
			config: { mode: 'merge', mappings: { decision: '$.output.decision' } }
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success', when: true },
			{ id: 'approval-rejected', source: 'approval', target: 'rejected', when: false },
			{
				id: 'approval-restore',
				source: 'approval',
				target: 'restore-approval',
				compensation: true
			}
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[1]).toMatchObject({
			eyebrow: 'Human approval',
			workflow: { type: 'human-approval', eventType: 'corex-approval' }
		});
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toMatchObject({
			type: 'approval',
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'inline', maxBytes: 1_024, redactPaths: ['$.actorUserId'] }
			},
			compensation: { id: 'restore-approval', type: 'transform' },
			whenApproved: 'success',
			whenRejected: 'rejected'
		});
		expect(compiled.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-approval' })
		);

		const approval = definition.nodes[1];
		if (approval.type !== 'approval') throw new Error('Expected approval fixture.');
		approval.config.outputPolicy = { mode: 'inline', maxBytes: 16_385 };
		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-wait', nodeId: 'approval' })
		);
	});

	it('accepts bounded external approval output and rejects limits above 10 MiB', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			position: { x: 280, y: 0 },
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'approval',
				outputPolicy: { mode: 'external', maxBytes: 10_485_760 }
			}
		});
		definition.nodes.push({
			id: 'rejected',
			name: 'return-rejected',
			type: 'end-success',
			position: { x: 560, y: 180 },
			config: {}
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success', when: true },
			{ id: 'approval-rejected', source: 'approval', target: 'rejected', when: false }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const approval = definition.nodes[1];
		if (approval.type !== 'approval') throw new Error('Expected approval fixture.');
		approval.config.outputPolicy = { mode: 'external', maxBytes: 10_485_761 };
		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-wait', nodeId: 'approval' })
		);
	});

	it('rejects approvals without explicit approved and rejected branches', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'approval',
			name: 'review-payment',
			type: 'approval',
			position: { x: 280, y: 0 },
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'approval'
			}
		});
		definition.edges = [
			{ id: 'trigger-approval', source: 'trigger', target: 'approval' },
			{ id: 'approval-success', source: 'approval', target: 'success' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-approval', nodeId: 'approval' })
		);
	});

	it('validates and compiles subprocess invocation references', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'subprocess',
			name: 'create-invoice',
			type: 'invoke-process',
			position: { x: 280, y: 0 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$.payment',
				resultKey: 'invoice',
				timeoutMs: 2_592_000_000
			}
		});
		definition.edges = [
			{ id: 'trigger-subprocess', source: 'trigger', target: 'subprocess' },
			{ id: 'subprocess-success', source: 'subprocess', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes[0]).toEqual({
			id: 'subprocess',
			name: 'create-invoice',
			type: 'invoke-process',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$.payment',
				resultKey: 'invoice',
				timeoutMs: 2_592_000_000
			},
			next: 'success'
		});

		const subprocess = definition.nodes[1];
		if (subprocess.type !== 'invoke-process') throw new Error('Expected subprocess fixture.');
		subprocess.config.processId = 'not-a-process-id';
		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-subprocess', nodeId: 'subprocess' })
		);
	});

	it('compiles repeated serial calls to one reusable local function body', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'first-call',
				name: 'prepare-first-payment',
				type: 'local-call',
				position: { x: 280, y: 0 },
				config: { functionId: 'prepare-payment', inputPath: '$.first', resultKey: 'first' }
			},
			{
				id: 'second-call',
				name: 'prepare-second-payment',
				type: 'local-call',
				position: { x: 520, y: 0 },
				config: { functionId: 'prepare-payment', inputPath: '$.second', resultKey: 'second' }
			}
		);
		definition.nodes.push(
			{
				id: 'prepare-payment',
				name: 'prepare-payment',
				type: 'local-function',
				position: { x: 280, y: 240 },
				config: {}
			},
			{
				id: 'prepare-body',
				name: 'normalize-payment',
				type: 'transform',
				position: { x: 520, y: 240 },
				config: { mode: 'replace', mappings: { paymentId: '$.id' } }
			},
			{
				id: 'prepare-return',
				name: 'return-payment',
				type: 'local-return',
				position: { x: 760, y: 240 },
				config: { functionId: 'prepare-payment' }
			}
		);
		definition.edges = [
			{ id: 'trigger-first', source: 'trigger', target: 'first-call' },
			{ id: 'first-second', source: 'first-call', target: 'second-call' },
			{ id: 'second-success', source: 'second-call', target: 'success' },
			{
				id: 'function-body',
				source: 'prepare-payment',
				target: 'prepare-body',
				function: 'body'
			},
			{ id: 'body-return', source: 'prepare-body', target: 'prepare-return' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes.filter((node) => node.type === 'local-call')).toEqual([
			{
				id: 'first-call',
				name: 'prepare-first-payment',
				type: 'local-call',
				config: { inputPath: '$.first', resultKey: 'first' },
				bodyTarget: 'prepare-body',
				returnTarget: 'prepare-return',
				next: 'second-call'
			},
			{
				id: 'second-call',
				name: 'prepare-second-payment',
				type: 'local-call',
				config: { inputPath: '$.second', resultKey: 'second' },
				bodyTarget: 'prepare-body',
				returnTarget: 'prepare-return',
				next: 'success'
			}
		]);
		expect(compiled.plan.nodes.some((node) => node.id === 'prepare-return')).toBe(false);
	});

	it('compiles an isolated serial executable block', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'block',
				name: 'prepare-payment',
				type: 'block',
				position: { x: 240, y: 0 },
				config: {}
			},
			{
				id: 'block-body',
				name: 'normalize-payment',
				type: 'transform',
				position: { x: 480, y: 160 },
				config: { mode: 'merge', mappings: { paymentId: '$.payment.id' } }
			},
			{
				id: 'after-block',
				name: 'prepare-result',
				type: 'transform',
				position: { x: 720, y: 0 },
				config: { mode: 'merge', mappings: { result: '$.paymentId' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-block', source: 'trigger', target: 'block' },
			{ id: 'block-body', source: 'block', target: 'block-body', block: 'body' },
			{
				id: 'block-continuation',
				source: 'block',
				target: 'after-block',
				block: 'continuation'
			},
			{ id: 'body-continuation', source: 'block-body', target: 'after-block' },
			{ id: 'continuation-success', source: 'after-block', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes.find((node) => node.id === 'block')).toEqual({
			id: 'block',
			name: 'prepare-payment',
			type: 'block',
			config: {},
			bodyTarget: 'block-body',
			continuationTarget: 'after-block'
		});
	});

	it('validates and compiles nested serial executable blocks', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'outer-block',
				name: 'prepare-payment',
				type: 'block',
				position: { x: 240, y: 0 },
				config: {}
			},
			{
				id: 'inner-block',
				name: 'normalize-payment',
				type: 'block',
				position: { x: 480, y: 160 },
				config: {}
			},
			{
				id: 'inner-body',
				name: 'copy-payment-id',
				type: 'transform',
				position: { x: 720, y: 280 },
				config: { mode: 'merge', mappings: { paymentId: '$.payment.id' } }
			},
			{
				id: 'inner-continuation',
				name: 'mark-normalized',
				type: 'transform',
				position: { x: 720, y: 160 },
				config: { mode: 'merge', mappings: { normalizedId: '$.paymentId' } }
			},
			{
				id: 'outer-continuation',
				name: 'prepare-result',
				type: 'transform',
				position: { x: 960, y: 0 },
				config: { mode: 'merge', mappings: { result: '$.normalizedId' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-outer', source: 'trigger', target: 'outer-block' },
			{ id: 'outer-body', source: 'outer-block', target: 'inner-block', block: 'body' },
			{
				id: 'outer-continuation',
				source: 'outer-block',
				target: 'outer-continuation',
				block: 'continuation'
			},
			{ id: 'inner-body', source: 'inner-block', target: 'inner-body', block: 'body' },
			{
				id: 'inner-continuation',
				source: 'inner-block',
				target: 'inner-continuation',
				block: 'continuation'
			},
			{ id: 'inner-body-continuation', source: 'inner-body', target: 'inner-continuation' },
			{
				id: 'inner-outer-continuation',
				source: 'inner-continuation',
				target: 'outer-continuation'
			},
			{ id: 'outer-success', source: 'outer-continuation', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const compiled = compileProcessDefinition(definition);
		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.plan.nodes.find((node) => node.id === 'outer-block')).toMatchObject({
			bodyTarget: 'inner-block',
			continuationTarget: 'outer-continuation'
		});
		expect(compiled.plan.nodes.find((node) => node.id === 'inner-block')).toMatchObject({
			bodyTarget: 'inner-body',
			continuationTarget: 'inner-continuation'
		});
	});

	it('rejects external entry into a parallel block body', () => {
		const definition = parallelDefinition();
		definition.nodes.push({
			id: 'block',
			name: 'prepare-payment-block',
			type: 'block',
			position: { x: 40, y: 0 },
			config: {}
		});
		definition.edges = definition.edges
			.filter((edge) => edge.id !== 'trigger-parallel')
			.concat(
				{ id: 'trigger-block', source: 'trigger', target: 'block' },
				{ id: 'block-body', source: 'block', target: 'parallel', block: 'body' },
				{ id: 'block-continuation', source: 'block', target: 'success', block: 'continuation' },
				{ id: 'external-entry', source: 'trigger', target: 'risk' }
			);

		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-block', nodeId: 'block' })
		);
	});

	it('validates and compiles recursive local functions', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'entry-call',
			name: 'start-recursion',
			type: 'local-call',
			position: { x: 280, y: 0 },
			config: { functionId: 'recursive-function', inputPath: '$', resultKey: 'result' }
		});
		definition.nodes.push(
			{
				id: 'recursive-function',
				name: 'recursive-function',
				type: 'local-function',
				position: { x: 280, y: 240 },
				config: {}
			},
			{
				id: 'recursive-call',
				name: 'recursive-call',
				type: 'local-call',
				position: { x: 520, y: 240 },
				config: { functionId: 'recursive-function', inputPath: '$', resultKey: 'recursive' }
			},
			{
				id: 'recursive-return',
				name: 'recursive-return',
				type: 'local-return',
				position: { x: 760, y: 240 },
				config: { functionId: 'recursive-function' }
			}
		);
		definition.edges = [
			{ id: 'trigger-entry', source: 'trigger', target: 'entry-call' },
			{ id: 'entry-success', source: 'entry-call', target: 'success' },
			{
				id: 'recursive-body',
				source: 'recursive-function',
				target: 'recursive-call',
				function: 'body'
			},
			{ id: 'recursive-return-edge', source: 'recursive-call', target: 'recursive-return' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'recursive-call')).toMatchObject({
			bodyTarget: 'recursive-call',
			returnTarget: 'recursive-return'
		});
	});

	it('compiles local function calls inside parallel branches', () => {
		const definition = parallelDefinition();
		const riskNodeIndex = definition.nodes.findIndex((node) => node.id === 'risk');
		definition.nodes.splice(riskNodeIndex, 1, {
			id: 'risk',
			name: 'calculate-risk',
			type: 'local-call',
			position: { x: 440, y: -120 },
			config: { functionId: 'risk-function', inputPath: '$', resultKey: 'risk' }
		});
		definition.nodes.push(
			{
				id: 'risk-function',
				name: 'risk-function',
				type: 'local-function',
				position: { x: 440, y: 300 },
				config: {}
			},
			{
				id: 'risk-body',
				name: 'risk-body',
				type: 'transform',
				position: { x: 660, y: 300 },
				config: { mode: 'replace', mappings: { score: '$.riskScore' } }
			},
			{
				id: 'risk-return',
				name: 'risk-return',
				type: 'local-return',
				position: { x: 880, y: 300 },
				config: { functionId: 'risk-function' }
			}
		);
		definition.edges.push(
			{
				id: 'risk-function-body',
				source: 'risk-function',
				target: 'risk-body',
				function: 'body'
			},
			{ id: 'risk-body-return', source: 'risk-body', target: 'risk-return' }
		);

		const result = compileProcessDefinition(definition);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).toContainEqual(
			expect.objectContaining({
				id: 'risk',
				type: 'local-call',
				bodyTarget: 'risk-body',
				returnTarget: 'risk-return',
				next: 'join'
			})
		);
	});

	it('compiles a validated linear definition into a deterministic execution plan', () => {
		const result = compileProcessDefinition(validDefinition());

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.entryNodeId).toBe('forward');
		expect(result.plan.nodes.map((node) => node.name)).toEqual([
			'forward-callback',
			'return-success'
		]);
		expect(result.plan.nodes[0]).toMatchObject({
			type: 'http-request',
			next: 'success',
			config: { outputPolicy: { mode: 'inline', maxBytes: 16_384 } }
		});
	});

	it('rejects HTTP inline output limits above 16 KiB', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.outputPolicy = { mode: 'inline', maxBytes: 16_385 };

		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-http-output', nodeId: 'forward' })
		);
	});

	it('accepts bounded external output policy for HTTP actions', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.outputPolicy = { mode: 'external', maxBytes: 1_048_576 };

		expect(validateProcessDefinition(definition).issues).not.toContainEqual(
			expect.objectContaining({ code: 'invalid-http-output', nodeId: 'forward' })
		);
	});

	it('rejects HTTP external output limits above 10 MiB', () => {
		const definition = validDefinition();
		const action = definition.nodes[1];
		if (action.type !== 'http-request') throw new Error('Expected HTTP action fixture.');
		action.config.outputPolicy = { mode: 'external', maxBytes: 10_485_761 };

		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-http-output', nodeId: 'forward' })
		);
	});

	it('compiles explicit true and false condition transitions', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'condition',
			name: 'is-large-payment',
			type: 'condition',
			position: { x: 280, y: 0 },
			config: { path: '$.amount', operator: 'greater-than', value: 100 }
		});
		definition.nodes.push({
			id: 'alternate-success',
			name: 'return-alternate',
			type: 'end-success',
			position: { x: 560, y: 180 },
			config: {}
		});
		definition.edges = [
			{ id: 'trigger-condition', source: 'trigger', target: 'condition' },
			{ id: 'condition-success', source: 'condition', target: 'success', when: true },
			{ id: 'condition-alternate', source: 'condition', target: 'alternate-success', when: false }
		];

		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toMatchObject({
			type: 'condition',
			whenTrue: 'success',
			whenFalse: 'alternate-success'
		});
	});

	it('validates and compiles typed switch cases with a default route', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'currency-switch',
			name: 'route-by-currency',
			type: 'switch',
			position: { x: 280, y: 0 },
			config: {
				path: '$.currency',
				cases: [
					{ id: 'uah', value: 'UAH' },
					{ id: 'usd', value: 'USD' }
				]
			}
		});
		definition.nodes.push(
			{
				id: 'usd-success',
				name: 'return-usd',
				type: 'end-success',
				position: { x: 560, y: 180 },
				config: {}
			},
			{
				id: 'default-success',
				name: 'return-default',
				type: 'end-success',
				position: { x: 560, y: 360 },
				config: {}
			}
		);
		definition.edges = [
			{ id: 'trigger-switch', source: 'trigger', target: 'currency-switch' },
			{ id: 'switch-uah', source: 'currency-switch', target: 'success', case: 'uah' },
			{ id: 'switch-usd', source: 'currency-switch', target: 'usd-success', case: 'usd' },
			{
				id: 'switch-default',
				source: 'currency-switch',
				target: 'default-success',
				case: 'default'
			}
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toMatchObject({
			type: 'switch',
			targets: { uah: 'success', usd: 'usd-success' },
			defaultTarget: 'default-success'
		});
	});

	it('validates and compiles a bounded structured loop with an explicit break', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'retry-loop',
				name: 'retry-payment',
				type: 'loop',
				position: { x: 240, y: 0 },
				config: { maxIterations: 3 }
			},
			{
				id: 'should-break',
				name: 'payment-complete',
				type: 'condition',
				position: { x: 460, y: -100 },
				config: { path: '$.complete', operator: 'equals', value: true }
			},
			{
				id: 'break-loop',
				name: 'leave-retry-loop',
				type: 'break',
				position: { x: 680, y: -180 },
				config: { loopId: 'retry-loop' }
			},
			{
				id: 'increment',
				name: 'increment-attempt',
				type: 'transform',
				position: { x: 680, y: 0 },
				config: { mode: 'merge', mappings: { attempt: '$.attempt' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-loop', source: 'trigger', target: 'retry-loop' },
			{ id: 'loop-body', source: 'retry-loop', target: 'should-break', loop: 'body' },
			{ id: 'loop-exit', source: 'retry-loop', target: 'success', loop: 'exit' },
			{ id: 'condition-break', source: 'should-break', target: 'break-loop', when: true },
			{ id: 'condition-increment', source: 'should-break', target: 'increment', when: false },
			{
				id: 'increment-loop',
				source: 'increment',
				target: 'retry-loop',
				loopBack: 'retry-loop'
			}
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toMatchObject({
			type: 'loop',
			config: { maxIterations: 3 },
			bodyTarget: 'should-break',
			exitTarget: 'success'
		});
		expect(result.plan.nodes[2]).toEqual({
			id: 'break-loop',
			name: 'leave-retry-loop',
			type: 'break',
			loopId: 'retry-loop',
			exitTarget: 'success'
		});
		const scenario = processDefinitionToFlowScenario(definition);
		expect(scenario.nodes.find((node) => node.id === 'retry-loop')).toMatchObject({
			kind: 'decision',
			meta: 'max 3 iterations',
			workflow: { type: 'loop', branches: ['body', 'exit'] }
		});
		expect(scenario.nodes.find((node) => node.id === 'break-loop')).toMatchObject({
			kind: 'terminal',
			meta: 'retry-loop',
			workflow: { type: 'break' }
		});
		expect(scenario.edges.find((edge) => edge.id === 'loop-body')).toMatchObject({
			label: 'body',
			tone: 'success'
		});
		expect(scenario.edges.find((edge) => edge.id === 'increment-loop')).toMatchObject({
			label: 'repeat'
		});
	});

	it('rejects a loop back edge whose source is outside the loop body', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 0, {
			id: 'retry-loop',
			name: 'retry-payment',
			type: 'loop',
			position: { x: 240, y: 0 },
			config: { maxIterations: 3 }
		});
		definition.edges = [
			{ id: 'trigger-loop', source: 'trigger', target: 'retry-loop' },
			{ id: 'loop-body', source: 'retry-loop', target: 'forward', loop: 'body' },
			{ id: 'loop-exit', source: 'retry-loop', target: 'success', loop: 'exit' },
			{ id: 'forward-success', source: 'forward', target: 'success' },
			{ id: 'trigger-back', source: 'trigger', target: 'retry-loop', loopBack: 'retry-loop' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-loop', nodeId: 'retry-loop' })
		);
	});

	it('validates and compiles deterministic parallel fork and join branches', () => {
		const definition = parallelDefinition();

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toEqual({
			id: 'parallel',
			name: 'prepare-payment',
			type: 'parallel',
			config: { branches: [{ id: 'risk' }, { id: 'receipt' }], resultKey: 'preparation' },
			branchTargets: { risk: 'risk', receipt: 'receipt' },
			joinTarget: 'join',
			continuationTarget: 'success'
		});
		expect(result.plan.nodes.some((node) => node.id === 'join')).toBe(false);
		const scenario = processDefinitionToFlowScenario(definition);
		expect(scenario.nodes.find((node) => node.id === 'parallel')).toMatchObject({
			kind: 'decision',
			output: 'preparation',
			workflow: { type: 'parallel', branches: ['risk', 'receipt'] }
		});
		expect(scenario.nodes.find((node) => node.id === 'join')).toMatchObject({
			eyebrow: 'Parallel join',
			workflow: { type: 'parallel' }
		});
		expect(scenario.edges.find((edge) => edge.id === 'parallel-risk')).toMatchObject({
			label: 'risk',
			tone: 'success'
		});
	});

	it('validates and compiles parallel execution inside a block body', () => {
		const definition = parallelDefinition();
		definition.nodes.push({
			id: 'block',
			name: 'prepare-in-parallel',
			type: 'block',
			position: { x: 40, y: 0 },
			config: {}
		});
		definition.edges = definition.edges
			.filter((edge) => edge.id !== 'trigger-parallel' && edge.id !== 'join-success')
			.concat(
				{ id: 'trigger-block', source: 'trigger', target: 'block' },
				{ id: 'block-body', source: 'block', target: 'parallel', block: 'body' },
				{ id: 'block-continuation', source: 'block', target: 'success', block: 'continuation' },
				{ id: 'join-success', source: 'join', target: 'success' }
			);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'block')).toMatchObject({
			bodyTarget: 'parallel',
			continuationTarget: 'success'
		});
		expect(result.plan.nodes.find((node) => node.id === 'parallel')).toMatchObject({
			joinTarget: 'join',
			continuationTarget: 'success'
		});
	});

	it('validates and compiles a serial block inside a parallel branch', () => {
		const definition = parallelDefinition();
		const riskIndex = definition.nodes.findIndex((node) => node.id === 'risk');
		definition.nodes.splice(
			riskIndex,
			1,
			{
				id: 'risk-block',
				name: 'prepare-risk',
				type: 'block',
				position: { x: 440, y: -120 },
				config: {}
			},
			{
				id: 'risk-body',
				name: 'calculate-risk',
				type: 'transform',
				position: { x: 560, y: -180 },
				config: { mode: 'replace', mappings: { score: '$.riskScore' } }
			},
			{
				id: 'risk-result',
				name: 'prepare-risk-result',
				type: 'transform',
				position: { x: 660, y: -120 },
				config: { mode: 'merge', mappings: { prepared: '$.score' } }
			}
		);
		definition.edges = definition.edges.filter(
			(edge) => edge.id !== 'parallel-risk' && edge.id !== 'risk-join'
		);
		definition.edges.push(
			{ id: 'parallel-risk', source: 'parallel', target: 'risk-block', parallel: 'risk' },
			{ id: 'risk-block-body', source: 'risk-block', target: 'risk-body', block: 'body' },
			{
				id: 'risk-block-continuation',
				source: 'risk-block',
				target: 'risk-result',
				block: 'continuation'
			},
			{ id: 'risk-body-result', source: 'risk-body', target: 'risk-result' },
			{ id: 'risk-result-join', source: 'risk-result', target: 'join' }
		);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk-block')).toEqual({
			id: 'risk-block',
			name: 'prepare-risk',
			type: 'block',
			config: {},
			bodyTarget: 'risk-body',
			continuationTarget: 'risk-result'
		});
	});

	it('validates and compiles nested parallel execution inside a parallel branch', () => {
		const definition = parallelDefinition();
		const riskIndex = definition.nodes.findIndex((node) => node.id === 'risk');
		definition.nodes.splice(
			riskIndex,
			1,
			{
				id: 'signals',
				name: 'collect-signals',
				type: 'parallel',
				position: { x: 440, y: -120 },
				config: { branches: [{ id: 'fraud' }, { id: 'credit' }], resultKey: 'signals' }
			},
			{
				id: 'fraud',
				name: 'load-fraud',
				type: 'transform',
				position: { x: 600, y: -180 },
				config: { mode: 'merge', mappings: { signal: '$.paymentId' } }
			},
			{
				id: 'credit',
				name: 'load-credit',
				type: 'transform',
				position: { x: 600, y: -60 },
				config: { mode: 'merge', mappings: { signal: '$.paymentId' } }
			},
			{
				id: 'signals-join',
				name: 'signals-collected',
				type: 'parallel-join',
				position: { x: 760, y: -120 },
				config: { parallelId: 'signals' }
			}
		);
		definition.edges = definition.edges.filter(
			(edge) => edge.id !== 'parallel-risk' && edge.id !== 'risk-join'
		);
		definition.edges.push(
			{ id: 'parallel-risk', source: 'parallel', target: 'signals', parallel: 'risk' },
			{ id: 'signals-fraud', source: 'signals', target: 'fraud', parallel: 'fraud' },
			{ id: 'signals-credit', source: 'signals', target: 'credit', parallel: 'credit' },
			{ id: 'fraud-signals-join', source: 'fraud', target: 'signals-join' },
			{ id: 'credit-signals-join', source: 'credit', target: 'signals-join' },
			{ id: 'signals-join-outer-join', source: 'signals-join', target: 'join' }
		);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'parallel')).toMatchObject({
			branchTargets: { risk: 'signals', receipt: 'receipt' },
			joinTarget: 'join',
			continuationTarget: 'success'
		});
		expect(result.plan.nodes.find((node) => node.id === 'signals')).toMatchObject({
			branchTargets: { fraud: 'fraud', credit: 'credit' },
			joinTarget: 'signals-join',
			continuationTarget: 'join'
		});
	});

	it('compiles transform compensation for an HTTP action inside a parallel branch', () => {
		const definition = parallelDefinition();
		const riskIndex = definition.nodes.findIndex((node) => node.id === 'risk');
		definition.nodes.splice(riskIndex, 1, {
			id: 'risk',
			name: 'calculate-risk',
			type: 'http-request',
			position: { x: 440, y: -120 },
			config: {
				method: 'POST',
				url: 'https://api.example.com/risk',
				timeoutMs: 10_000,
				retry: { limit: 2, backoff: 'constant' }
			}
		});
		definition.nodes.push({
			id: 'restore-risk-context',
			name: 'restore-risk-context',
			type: 'transform',
			position: { x: 440, y: -240 },
			config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
		});
		definition.edges.push({
			id: 'risk-restore-context',
			source: 'risk',
			target: 'restore-risk-context',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-risk-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toMatchObject({
			compensation: {
				id: 'restore-risk-context',
				name: 'restore-risk-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
			}
		});
	});

	it('compiles transform compensation for a transform action inside a parallel branch', () => {
		const definition = parallelDefinition();
		definition.nodes.push({
			id: 'restore-risk-context',
			name: 'restore-risk-context',
			type: 'transform',
			position: { x: 440, y: -240 },
			config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
		});
		definition.edges.push({
			id: 'risk-restore-context',
			source: 'risk',
			target: 'restore-risk-context',
			compensation: true
		});

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes).not.toContainEqual(
			expect.objectContaining({ id: 'restore-risk-context' })
		);
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toMatchObject({
			type: 'transform',
			compensation: {
				id: 'restore-risk-context',
				name: 'restore-risk-context',
				type: 'transform',
				config: { mode: 'replace', mappings: { paymentId: '$.input.paymentId' } }
			}
		});
	});

	it('validates and compiles explicit try, catch, finally, and continuation targets', () => {
		const definition = validDefinition();
		definition.nodes.splice(
			1,
			1,
			{
				id: 'try-payment',
				name: 'protect-payment',
				type: 'try',
				position: { x: 220, y: 0 },
				config: {}
			},
			{
				id: 'try-body-payment',
				name: 'attempt-payment',
				type: 'transform',
				position: { x: 440, y: -120 },
				config: { mode: 'merge', mappings: { paymentId: '$.paymentId' } }
			},
			{
				id: 'catch-payment',
				name: 'record-payment-error',
				type: 'transform',
				position: { x: 440, y: 120 },
				config: { mode: 'merge', mappings: { errorCode: '$.error.code' } }
			},
			{
				id: 'finally-payment',
				name: 'record-payment-finish',
				type: 'transform',
				position: { x: 660, y: 120 },
				config: { mode: 'merge', mappings: { finished: '$.finished' } }
			},
			{
				id: 'continue-payment',
				name: 'continue-payment',
				type: 'transform',
				position: { x: 880, y: 0 },
				config: { mode: 'merge', mappings: { continued: '$.continued' } }
			}
		);
		definition.edges = [
			{ id: 'trigger-try', source: 'trigger', target: 'try-payment' },
			{ id: 'try-body', source: 'try-payment', target: 'try-body-payment', try: 'body' },
			{ id: 'try-catch', source: 'try-payment', target: 'catch-payment', try: 'catch' },
			{ id: 'try-finally', source: 'try-payment', target: 'finally-payment', try: 'finally' },
			{
				id: 'try-continuation',
				source: 'try-payment',
				target: 'continue-payment',
				try: 'continuation'
			},
			{ id: 'body-finally', source: 'try-body-payment', target: 'finally-payment' },
			{ id: 'catch-finally', source: 'catch-payment', target: 'finally-payment' },
			{ id: 'finally-continuation', source: 'finally-payment', target: 'continue-payment' },
			{ id: 'continuation-success', source: 'continue-payment', target: 'success' }
		];

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes[0]).toEqual({
			id: 'try-payment',
			name: 'protect-payment',
			type: 'try',
			config: {},
			bodyTarget: 'try-body-payment',
			catchTarget: 'catch-payment',
			finallyTarget: 'finally-payment',
			continuationTarget: 'continue-payment'
		});
	});

	it('rejects a try block without catch or finally', () => {
		const definition = validDefinition();
		definition.nodes.splice(1, 1, {
			id: 'try-payment',
			name: 'protect-payment',
			type: 'try',
			position: { x: 220, y: 0 },
			config: {}
		});
		definition.edges = [
			{ id: 'trigger-try', source: 'trigger', target: 'try-payment' },
			{ id: 'try-body', source: 'try-payment', target: 'success', try: 'body' },
			{ id: 'try-continuation', source: 'try-payment', target: 'success', try: 'continuation' }
		];

		expect(validateProcessDefinition(definition).issues).toContainEqual({
			code: 'invalid-try',
			message:
				'Try block "protect-payment" requires distinct body and continuation branches plus catch or finally.',
			nodeId: 'try-payment'
		});
	});

	it.each([
		['a missing branch edge', (definition: ProcessDefinition) => definition.edges.splice(2, 1)],
		[
			'a branch escape path',
			(definition: ProcessDefinition) => {
				definition.edges.find((edge) => edge.id === 'risk-join')!.target = 'success';
			}
		],
		[
			'a shared branch region',
			(definition: ProcessDefinition) => {
				definition.edges.find((edge) => edge.id === 'parallel-receipt')!.target = 'risk';
			}
		],
		[
			'an external branch entry',
			(definition: ProcessDefinition) => {
				definition.edges.push({ id: 'trigger-risk', source: 'trigger', target: 'risk' });
			}
		],
		[
			'a join without one continuation',
			(definition: ProcessDefinition) => {
				definition.edges = definition.edges.filter((edge) => edge.id !== 'join-success');
			}
		]
	])('rejects parallel topology with %s', (_label, mutate) => {
		const definition = parallelDefinition();
		mutate(definition);
		expect(validateProcessDefinition(definition).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'invalid-parallel' })])
		);
	});

	it('validates and compiles relative waits inside parallel branches', () => {
		const definition = parallelDefinition();
		definition.nodes[2] = {
			id: 'risk',
			name: 'wait-for-risk',
			type: 'wait',
			position: { x: 440, y: -120 },
			config: { durationMs: 1_000 }
		};

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toEqual({
			id: 'risk',
			name: 'wait-for-risk',
			type: 'wait',
			config: { durationMs: 1_000 },
			next: 'join'
		});
	});

	it('validates and compiles absolute waits inside parallel branches', () => {
		const definition = parallelDefinition();
		definition.nodes[2] = {
			id: 'risk',
			name: 'wait-until-risk-window',
			type: 'wait-until',
			position: { x: 440, y: -120 },
			config: { timestamp: '2030-01-01T00:00:00.000Z' }
		};

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toEqual({
			id: 'risk',
			name: 'wait-until-risk-window',
			type: 'wait-until',
			config: { timestamp: '2030-01-01T00:00:00.000Z' },
			next: 'join'
		});
	});

	it('validates and compiles external event waits inside parallel branches', () => {
		const definition = parallelDefinition();
		definition.nodes[2] = {
			id: 'risk',
			name: 'wait-for-risk-review',
			type: 'wait-event',
			position: { x: 440, y: -120 },
			config: { eventType: 'risk_reviewed', timeoutMs: 86_400_000, resultKey: 'review' }
		};

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toEqual({
			id: 'risk',
			name: 'wait-for-risk-review',
			type: 'wait-event',
			config: { eventType: 'risk_reviewed', timeoutMs: 86_400_000, resultKey: 'review' },
			next: 'join'
		});
	});

	it('validates and compiles approvals inside parallel branches', () => {
		const definition = parallelDefinition();
		definition.nodes[2] = {
			id: 'risk',
			name: 'approve-risk',
			type: 'approval',
			position: { x: 440, y: -120 },
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'review'
			}
		};
		definition.edges = definition.edges.filter((edge) => edge.id !== 'risk-join');
		definition.edges.push(
			{ id: 'risk-approved', source: 'risk', target: 'join', when: true },
			{ id: 'risk-rejected', source: 'risk', target: 'join', when: false }
		);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toEqual({
			id: 'risk',
			name: 'approve-risk',
			type: 'approval',
			config: {
				assigneeUserId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				timeoutMs: 86_400_000,
				resultKey: 'review'
			},
			whenApproved: 'join',
			whenRejected: 'join'
		});
	});

	it('validates and compiles subprocess invocation inside parallel branches', () => {
		const definition = parallelDefinition();
		definition.nodes[2] = {
			id: 'risk',
			name: 'invoke-risk-process',
			type: 'invoke-process',
			position: { x: 440, y: -120 },
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'risk',
				timeoutMs: 86_400_000
			}
		};

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		const result = compileProcessDefinition(definition);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.plan.nodes.find((node) => node.id === 'risk')).toEqual({
			id: 'risk',
			name: 'invoke-risk-process',
			type: 'invoke-process',
			config: {
				processId: '018f47a2-8391-7b1c-8f7a-f1d27670f099',
				inputPath: '$',
				resultKey: 'risk',
				timeoutMs: 86_400_000
			},
			next: 'join'
		});
	});

	it('refuses ambiguous branches until the runtime has an explicit branch node', () => {
		const definition = validDefinition();
		definition.nodes.push({
			id: 'alternate-success',
			name: 'return-alternate-success',
			type: 'end-success',
			position: { x: 560, y: 180 },
			config: {}
		});
		definition.edges.push({
			id: 'forward-alternate',
			source: 'forward',
			target: 'alternate-success'
		});

		expect(compileProcessDefinition(definition)).toEqual({
			ok: false,
			errors: ['Step "forward-callback" must have exactly one outgoing connection.']
		});
	});

	it('accepts a failure-only process and projects its terminal contract', () => {
		const definition = validDefinition();
		definition.nodes[2] = {
			id: 'failure',
			name: 'reject-payment',
			type: 'end-failure',
			position: { x: 560, y: 0 },
			config: { code: 'payment_rejected', message: 'Payment policy rejected the request.' }
		};
		definition.edges[1] = { id: 'forward-failure', source: 'forward', target: 'failure' };

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(processDefinitionToFlowScenario(definition).nodes[2]).toMatchObject({
			eyebrow: 'Failure terminal',
			status: 'failed',
			meta: 'payment_rejected',
			detail: 'Payment policy rejected the request.',
			workflow: { type: 'end-failure', family: 'terminal' }
		});
	});

	it.each([
		[{ code: 'unsafe code', message: 'Rejected.' }],
		[{ code: 'payment_rejected', message: '   ' }],
		[{ code: 'payment_rejected', message: 'x'.repeat(201) }]
	])('rejects invalid failure terminal config %#', (config) => {
		const definition = validDefinition();
		definition.nodes[2] = {
			id: 'failure',
			name: 'reject-payment',
			type: 'end-failure',
			position: { x: 560, y: 0 },
			config
		};
		definition.edges[1] = { id: 'forward-failure', source: 'forward', target: 'failure' };

		expect(validateProcessDefinition(definition).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'invalid-failure', nodeId: 'failure' })
			])
		);
	});

	it('rejects outgoing edges from a failure terminal', () => {
		const definition = validDefinition();
		definition.nodes[2] = {
			id: 'failure',
			name: 'reject-payment',
			type: 'end-failure',
			position: { x: 560, y: 0 },
			config: { code: 'payment_rejected', message: 'Rejected.' }
		};
		definition.edges[1] = { id: 'forward-failure', source: 'forward', target: 'failure' };
		definition.edges.push({ id: 'failure-forward', source: 'failure', target: 'forward' });

		expect(validateProcessDefinition(definition).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'terminal-has-output', nodeId: 'failure' })
			])
		);
	});

	it('renders a starter definition through the existing canvas contract', () => {
		const definition = createStarterProcessDefinition();
		const scenario = processDefinitionToFlowScenario(definition);

		expect(validateProcessDefinition(definition)).toEqual({ valid: true, issues: [] });
		expect(scenario.entrypoint).toBe('POST /callbacks/payment');
		expect(scenario.nodes.map((node) => node.workflow?.type)).toEqual([
			'trigger-http',
			'http-request',
			'end-success'
		]);
		expect(scenario.edges).toEqual(definition.edges);
	});
});
