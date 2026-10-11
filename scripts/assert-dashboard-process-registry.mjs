import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function assertDashboardProcessRegistry(source) {
	assert.ok(source.trim().startsWith('# Dashboard Process Registry'), 'Dashboard process registry is empty or invalid');
	for (const processId of ['DASH-AUTH-001', 'DASH-SHELL-001', 'DASH-STRUCTURE-001', 'CROSS-APP-INVOICE-SCENARIOS-001']) {
		assert.ok(source.includes(processId), `Dashboard process registry missing ${processId}`);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	assertDashboardProcessRegistry(await readFile(new URL('../docs/DASHBOARD_PROCESS_REGISTRY.md', import.meta.url), 'utf8'));
	console.log('Dashboard process registry guard passed');
}