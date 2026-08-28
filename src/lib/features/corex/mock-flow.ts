import type { FlowEdge, FlowNode } from './types';

export const mockFlowNodes: FlowNode[] = [
	{
		id: 'start',
		eyebrow: 'Trigger',
		title: 'Release requested',
		detail: 'A new release candidate enters the isolated preview pipeline.',
		status: 'complete',
		meta: 'mock-024',
		kind: 'trigger',
		position: { x: 40, y: 260 }
	},
	{
		id: 'build',
		eyebrow: 'Action',
		title: 'Build Svelte',
		detail: 'Compile the static application and create a versioned artifact.',
		status: 'complete',
		meta: 'commit 8f2c1a7',
		kind: 'action',
		position: { x: 340, y: 260 }
	},
	{
		id: 'checks',
		eyebrow: 'Action',
		title: 'Run checks',
		detail: 'Type safety, route contracts and smoke tests run against the artifact.',
		status: 'complete',
		meta: '12 / 12 passed',
		kind: 'action',
		position: { x: 640, y: 260 }
	},
	{
		id: 'checks-passed',
		eyebrow: 'Condition',
		title: 'Checks passed?',
		detail: 'Branch the process using the test and contract results.',
		status: 'complete',
		meta: 'result: true',
		kind: 'decision',
		position: { x: 940, y: 260 }
	},
	{
		id: 'preview',
		eyebrow: 'Action',
		title: 'Create preview',
		detail: 'Publish an isolated build with test data and no mutation credentials.',
		status: 'running',
		meta: 'preview active',
		kind: 'action',
		position: { x: 1240, y: 260 }
	},
	{
		id: 'approved',
		eyebrow: 'Human gate',
		title: 'Approved?',
		detail: 'A merchant explicitly approves promotion after visual review.',
		status: 'waiting',
		meta: 'manual decision',
		kind: 'decision',
		position: { x: 1540, y: 260 }
	},
	{
		id: 'publish',
		eyebrow: 'Protected action',
		title: 'Publish target',
		detail: 'Promote only to letsrealtalk.com after mutations are explicitly enabled.',
		status: 'blocked',
		meta: 'mutation locked',
		kind: 'action',
		position: { x: 1840, y: 260 }
	},
	{
		id: 'health',
		eyebrow: 'Condition',
		title: 'Healthy?',
		detail: 'Observe availability, route integrity and expected response checks.',
		status: 'blocked',
		meta: 'awaiting publish',
		kind: 'decision',
		position: { x: 2140, y: 260 }
	},
	{
		id: 'complete',
		eyebrow: 'Terminal',
		title: 'Release complete',
		detail: 'Close the run after every protected health assertion succeeds.',
		status: 'blocked',
		meta: 'not reached',
		kind: 'terminal',
		position: { x: 2440, y: 120 }
	},
	{
		id: 'rollback',
		eyebrow: 'Recovery',
		title: 'Rollback',
		detail: 'Return to the last healthy version. Simulation only in this workspace.',
		status: 'blocked',
		meta: 'mutation locked',
		kind: 'terminal',
		position: { x: 2440, y: 420 }
	},
	{
		id: 'stop',
		eyebrow: 'Terminal',
		title: 'Stop run',
		detail: 'Keep the rejected or failing candidate outside the approved target.',
		status: 'waiting',
		meta: 'preview retained',
		kind: 'terminal',
		position: { x: 1540, y: 560 }
	}
];

export const mockFlowEdges: FlowEdge[] = [
	{ id: 'start-build', source: 'start', target: 'build' },
	{ id: 'build-checks', source: 'build', target: 'checks' },
	{ id: 'checks-gate', source: 'checks', target: 'checks-passed' },
	{ id: 'checks-preview', source: 'checks-passed', target: 'preview', label: 'yes', tone: 'success' },
	{ id: 'checks-stop', source: 'checks-passed', target: 'stop', label: 'no', tone: 'danger' },
	{ id: 'preview-approval', source: 'preview', target: 'approved' },
	{ id: 'approval-publish', source: 'approved', target: 'publish', label: 'yes', tone: 'success' },
	{ id: 'approval-stop', source: 'approved', target: 'stop', label: 'no', tone: 'danger' },
	{ id: 'publish-health', source: 'publish', target: 'health' },
	{ id: 'health-complete', source: 'health', target: 'complete', label: 'yes', tone: 'success' },
	{ id: 'health-rollback', source: 'health', target: 'rollback', label: 'no', tone: 'danger' }
];