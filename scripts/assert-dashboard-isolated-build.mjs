import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(import.meta.dirname, '..');
const prefix = '/dashboard/_app/';

function filesBelow(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = resolve(directory, entry.name);
		return entry.isDirectory() ? filesBelow(file) : [file];
	});
}

export function assertDashboardConfig(config) {
	assert.equal(config.name, 'letsrealtalk-dashboard');
	assert.equal(config.main, 'src/dashboard.ts');
	assert.equal(config.workers_dev, false);
	assert.equal(config.preview_urls, false);
	assert.deepEqual(config.routes, [
		{ pattern: 'letsrealtalk.com/dashboard*', zone_name: 'letsrealtalk.com' }
	]);
	assert.deepEqual(config.services, [{ binding: 'API', service: 'rahunok' }]);
	assert.deepEqual(config.assets, {
		directory: '../build-dashboard',
		binding: 'ASSETS',
		run_worker_first: true,
		not_found_handling: 'none'
	});
	assert.equal(config.env, undefined, 'Isolated config must not have environment overrides');
	assert.equal(config.route, undefined, 'Use only the explicit dashboard routes array');
	assert.equal(config.build, undefined, 'Wrangler must not rebuild the shared output');
}

export function assertDashboardArtifacts(buildDir, kitDir, routesDir) {
	assert.ok(!existsSync(resolve(buildDir, '_app')), 'Shared /_app output must not be present');
	const html = readFileSync(resolve(buildDir, '200.html'), 'utf8');
	const references = new Set([
		...[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]),
		...[...html.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
	]);
	assert.ok(references.size > 0, 'Fallback must reference generated assets');
	for (const reference of references) {
		assert.ok(reference.startsWith(prefix), `Fallback asset outside dashboard: ${reference}`);
		assert.ok(
			statSync(
				resolve(buildDir, `.${new URL(reference, 'https://local.invalid').pathname}`)
			).isFile(),
			`Missing fallback asset: ${reference}`
		);
	}
	for (const entry of ['start', 'app']) {
		assert.ok(
			[...references].some((ref) => ref.startsWith(`${prefix}immutable/entry/${entry}.`)),
			`Missing ${entry} entry reference`
		);
	}
	assert.ok(references.has(`${prefix}env.js`), 'Missing isolated public environment module');
	assert.match(html, /base:\s*["']["']/, 'The application base must remain empty');

	const generatedFiles = filesBelow(resolve(buildDir, 'dashboard/_app'));
	for (const file of [resolve(buildDir, '200.html'), ...generatedFiles]) {
		if (!/\.(?:html|js|css|json)$/.test(file)) continue;
		const text = readFileSync(file, 'utf8');
		// The full graph includes Corex's route catalog (literal '/_app/').
		// Reject concrete generated resources, not descriptive route prefixes.
		assert.ok(
			!/(?<!dashboard)\/_app\/(?:immutable\/|env\.js|version\.json)/.test(text),
			`Shared asset reference in ${file}`
		);
	}

	const manifest = JSON.parse(
		readFileSync(resolve(kitDir, 'output/client/.vite/manifest.json'), 'utf8')
	);
	for (const [key, entry] of Object.entries(manifest)) {
		for (const output of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
			assert.ok(output.startsWith(prefix.slice(1)), `Unscoped manifest output: ${output}`);
			assert.ok(statSync(resolve(buildDir, output)).isFile(), `Missing manifest output: ${output}`);
		}
		for (const dependency of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
			assert.ok(manifest[dependency], `Missing dependency ${dependency} of ${key}`);
		}
	}

	// Compare every source page, not just dashboard: no partial route-graph builds.
	const serverManifest = JSON.parse(
		readFileSync(resolve(kitDir, 'output/server/.vite/manifest.json'), 'utf8')
	);
	const routePages = filesBelow(routesDir).filter((file) => file.endsWith('+page.svelte'));
	assert.ok(routePages.length > 0, 'Source route graph is empty');
	for (const file of routePages) {
		const key = relative(dirname(dirname(routesDir)), file).replaceAll('\\', '/');
		assert.ok(serverManifest[key], `Full route graph is missing ${key}`);
	}
	return {
		entryAssets: references.size,
		generatedFiles: generatedFiles.length,
		routes: routePages.length
	};
}

export function assertDashboardIsolatedBuild(root = projectRoot) {
	const configPath = resolve(root, 'worker/wrangler.dashboard-isolated.jsonc');
	const parsed = ts.parseConfigFileTextToJson(configPath, readFileSync(configPath, 'utf8'));
	assert.ok(!parsed.error, 'Invalid isolated Wrangler JSONC');
	assertDashboardConfig(parsed.config);
	return assertDashboardArtifacts(
		resolve(root, 'build-dashboard'),
		resolve(root, '.svelte-kit-dashboard'),
		resolve(root, 'src/routes')
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	console.log('Dashboard isolated build guard passed:', assertDashboardIsolatedBuild());
}
