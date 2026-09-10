import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
	assertDashboardArtifacts,
	assertDashboardConfig
} from './assert-dashboard-isolated-build.mjs';

const config = JSON.parse(
	readFileSync(new URL('../worker/wrangler.dashboard-isolated.jsonc', import.meta.url), 'utf8')
);

function fixture(t) {
	const root = mkdtempSync(resolve(tmpdir(), 'dashboard-artifacts-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	function put(file, content) {
		const path = resolve(root, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}
	const outputs = ['immutable/entry/start.a.js', 'immutable/entry/app.b.js', 'env.js'];
	const html = `<script>base: ""; ${outputs.map((file) => `import("/dashboard/_app/${file}")`).join(';')}</script>`;
	put('build/200.html', html);
	for (const file of outputs) put(`build/dashboard/_app/${file}`, 'export {};');
	put(
		'kit/output/client/.vite/manifest.json',
		JSON.stringify({
			start: { file: `dashboard/_app/${outputs[0]}`, imports: ['app'] },
			app: { file: `dashboard/_app/${outputs[1]}` }
		})
	);
	put('src/routes/+page.svelte', '');
	put('src/routes/dashboard/+page.svelte', '');
	put(
		'kit/output/server/.vite/manifest.json',
		JSON.stringify({
			'src/routes/+page.svelte': {},
			'src/routes/dashboard/+page.svelte': {}
		})
	);
	return {
		root,
		put,
		html,
		check: () =>
			assertDashboardArtifacts(
				resolve(root, 'build'),
				resolve(root, 'kit'),
				resolve(root, 'src/routes')
			)
	};
}

test('accepts only the explicit test-domain dashboard deployment contract', () => {
	assert.doesNotThrow(() => assertDashboardConfig(config));
	for (const patch of [
		{ name: 'rakhunok-dashboard' },
		{ routes: [{ pattern: 'rakhunok.com/dashboard*', zone_name: 'rakhunok.com' }] },
		{ routes: [...config.routes, { pattern: 'letsrealtalk.com/*' }] },
		{ services: [{ binding: 'API', service: 'other' }] },
		{ assets: { ...config.assets, directory: '../build' } },
		{ assets: { ...config.assets, not_found_handling: 'single-page-application' } },
		{ assets: { ...config.assets, run_worker_first: false } },
		{ env: { production: {} } },
		{ workers_dev: true },
		{ build: { command: 'npm run build' } }
	])
		assert.throws(() => assertDashboardConfig({ ...config, ...patch }));
});

test('accepts scoped assets and a complete route graph', (t) => {
	assert.deepEqual(fixture(t).check(), { entryAssets: 3, generatedFiles: 3, routes: 2 });
});

test('rejects shared, relative, external and missing fallback references', (t) => {
	const f = fixture(t);
	for (const reference of [
		'/_app/a.js',
		'./dashboard/_app/a.js',
		'https://example.com/a.js',
		'/dashboard/_app/missing.js'
	]) {
		f.put('build/200.html', f.html + `<link href="${reference}">`);
		assert.throws(f.check);
	}
});

test('rejects shared asset references hidden in generated chunks', (t) => {
	const f = fixture(t);
	f.put('build/dashboard/_app/immutable/entry/app.b.js', 'fetch("/_app/version.json")');
	assert.throws(f.check, /Shared asset reference/);
});

test('allows descriptive route catalog prefixes in the full graph', (t) => {
	const f = fixture(t);
	f.put('build/dashboard/_app/immutable/entry/app.b.js', 'const route = { path: `/_app/` };');
	assert.doesNotThrow(f.check);
});

test('rejects missing lazy assets and broken manifest dependencies', (t) => {
	const f = fixture(t);
	for (const entry of [
		{ file: 'dashboard/_app/missing.js' },
		{ file: 'dashboard/_app/env.js', imports: ['missing'] },
		{ file: '_app/old.js' }
	]) {
		f.put('kit/output/client/.vite/manifest.json', JSON.stringify({ entry }));
		assert.throws(f.check);
	}
});

test('rejects partial route graph and shared output directory', (t) => {
	const f = fixture(t);
	f.put('kit/output/server/.vite/manifest.json', '{"src/routes/dashboard/+page.svelte":{}}');
	assert.throws(f.check, /Full route graph/);
	f.put('build/_app/old.js', '');
	assert.throws(f.check, /Shared \/_app output/);
});
