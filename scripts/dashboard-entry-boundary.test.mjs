import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresDashboardDocument } from '../src/routes/dashboard/entry-boundary.ts';

test('cross-app Dashboard entry reloads once, but direct and internal entry do not', () => {
	const origin = 'https://letsrealtalk.com';
	assert.equal(requiresDashboardDocument(`${origin}/`, `${origin}/dashboard`), true);
	assert.equal(requiresDashboardDocument(`${origin}/corex`, `${origin}/dashboard/structure`), true);
	assert.equal(requiresDashboardDocument(`${origin}/dashboard-other`, `${origin}/dashboard/`), true);
	assert.equal(requiresDashboardDocument(`${origin}/dashboard`, `${origin}/dashboard`), false);
	assert.equal(requiresDashboardDocument(`${origin}/dashboard/`, `${origin}/dashboard/structure`), false);
	assert.equal(requiresDashboardDocument(`${origin}/`, `${origin}/corex`), false);
});