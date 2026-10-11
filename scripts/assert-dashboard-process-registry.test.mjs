import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertDashboardProcessRegistry } from './assert-dashboard-process-registry.mjs';

test('registry guard accepts the recovered authority', async () => {
	assertDashboardProcessRegistry(await readFile(new URL('../docs/DASHBOARD_PROCESS_REGISTRY.md', import.meta.url), 'utf8'));
});

test('registry guard rejects empty and incomplete authority', () => {
	for (const source of ['', ' \r\n', '# Dashboard Process Registry\nDASH-AUTH-001']) {
		assert.throws(() => assertDashboardProcessRegistry(source));
	}
});