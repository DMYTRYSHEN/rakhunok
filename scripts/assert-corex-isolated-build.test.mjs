import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { assertCorexArtifacts, assertCorexConfig } from './assert-corex-isolated-build.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const config = read('../worker/wrangler.corex-isolated.jsonc');
const existing = read('../worker/wrangler.corex.jsonc');

test('isolated config preserves the existing live contract except assets', () => {
	assert.doesNotThrow(() => assertCorexConfig(config, existing));
	for (const patch of [
		{ name: 'rakhunok-corex' },
		{ routes: [{ pattern: 'letsrealtalk.com/*', zone_name: 'letsrealtalk.com' }] },
		{ routes: [{ pattern: 'rakhunok.com/corex/*', zone_name: 'rakhunok.com' }] },
		{ triggers: { crons: [] } },
		{ workflows: [{ ...config.workflows[0], name: 'corex-process-preview' }] },
		{ vars: {} },
		{ assets: { ...config.assets, directory: '../build' } },
		{ assets: { ...config.assets, not_found_handling: 'single-page-application' } },
		{ env: { production: {} } },
		{ build: { command: 'npm run build' } }
	]) assert.throws(() => assertCorexConfig({ ...config, ...patch }, existing));
});

function fixture(t) {
	const root = mkdtempSync(resolve(tmpdir(), 'corex-artifacts-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	function put(file, content) {
		const path = resolve(root, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}
	const outputs = ['immutable/entry/start.a.js', 'immutable/entry/app.b.js', 'env.js'];
	const html = `<script>base: ""; ${outputs.map((file) => `import("/corex/_app/${file}")`).join(';')}</script>`;
	put('build/200.html', html);
	for (const file of outputs) put(`build/corex/_app/${file}`, 'export {};');
	put('kit/output/client/.vite/manifest.json', JSON.stringify({
		start: { file: `corex/_app/${outputs[0]}`, imports: ['app'] },
		app: { file: `corex/_app/${outputs[1]}` }
	}));
	put('src/routes/+page.svelte', '');
	put('src/routes/corex/+page.svelte', '');
	put('kit/output/server/.vite/manifest.json', JSON.stringify({
		'src/routes/+page.svelte': {}, 'src/routes/corex/+page.svelte': {}
	}));
	return { put, html, check: () => assertCorexArtifacts(resolve(root, 'build'), resolve(root, 'kit'), resolve(root, 'src/routes')) };
}

test('accepts scoped full-graph build and descriptive shared route catalog', (t) => {
	const f = fixture(t);
	f.put('build/corex/_app/env.js', 'const route = "/_app/";');
	assert.deepEqual(f.check(), { entryAssets: 3, generatedFiles: 3, routes: 2 });
});

test('rejects shared, dashboard, relative, external, escaping and missing fallback assets', (t) => {
	const f = fixture(t);
	for (const ref of ['/_app/a.js', '/dashboard/_app/a.js', './corex/_app/a.js', 'https://example.com/a.js', '/corex/_app/../../a.js', '/corex/_app/missing.js']) {
		f.put('build/200.html', f.html + `<link href="${ref}">`);
		assert.throws(f.check);
	}
});

test('rejects unscoped concrete resources hidden in chunks', (t) => {
	const f = fixture(t);
	for (const ref of ['/_app/version.json', '/dashboard/_app/env.js', '/othercorex/_app/immutable/x.js']) {
		f.put('build/corex/_app/env.js', `fetch("${ref}")`);
		assert.throws(f.check, /Shared asset reference/);
	}
});

test('rejects broken lazy manifests, partial route graphs and shared output', (t) => {
	const f = fixture(t);
	for (const entry of [{ file: 'corex/_app/missing.js' }, { file: 'corex/_app/env.js', dynamicImports: ['missing'] }, { file: '_app/old.js' }]) {
		f.put('kit/output/client/.vite/manifest.json', JSON.stringify({ entry }));
		assert.throws(f.check);
	}
	f.put('kit/output/client/.vite/manifest.json', '{"entry":{"file":"corex/_app/env.js"}}');
	f.put('kit/output/server/.vite/manifest.json', '{"src/routes/corex/+page.svelte":{}}');
	assert.throws(f.check, /Full route graph/);
	f.put('build/_app/old.js', '');
	assert.throws(f.check, /Shared \/_app output/);
});