import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = resolve(import.meta.dirname, '..');

function readConfig(path) {
	const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'));
	assert.ok(!parsed.error, `Invalid Wrangler JSONC: ${path}`);
	return parsed.config;
}

export function assertCorexConfig(config, existing) {
	const { env, ...base } = existing;
	assert.deepEqual(config, {
		...base,
		...env.production,
		assets: {
			directory: '../build-corex',
			binding: 'ASSETS',
			run_worker_first: true,
			not_found_handling: 'none'
		}
	});
	assert.equal(config.name, 'letsrealtalk-corex');
	assert.deepEqual(config.routes, [
		{ pattern: 'letsrealtalk.com/corex', zone_name: 'letsrealtalk.com' },
		{ pattern: 'letsrealtalk.com/corex/*', zone_name: 'letsrealtalk.com' }
	]);
	assert.deepEqual(config.triggers, { crons: ['* * * * *'] });
	assert.equal(config.workflows[0].name, 'corex-process-production');
}

export function assertCorexArtifacts(buildDir, kitDir, routesDir) {
	const prefix = '/corex/_app/';
	function filesBelow(directory) {
		return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const file = resolve(directory, entry.name);
			return entry.isDirectory() ? filesBelow(file) : [file];
		});
	}
	assert.ok(!existsSync(resolve(buildDir, '_app')), 'Shared /_app output must not be present');
	const html = readFileSync(resolve(buildDir, '200.html'), 'utf8');
	const references = new Set([
		...[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]),
		...[...html.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
	]);
	function checkAsset(reference) {
		assert.ok(reference.startsWith(prefix), `Unscoped asset: ${reference}`);
		const pathname = new URL(reference, 'https://local.invalid').pathname;
		assert.ok(pathname.startsWith(prefix), `Escaping asset: ${reference}`);
		assert.ok(statSync(resolve(buildDir, `.${pathname}`)).isFile(), `Missing asset: ${reference}`);
	}
	for (const reference of references) checkAsset(reference);
	for (const entry of ['start', 'app']) {
		assert.ok(
			[...references].some((ref) => ref.startsWith(`${prefix}immutable/entry/${entry}.`)),
			`Missing ${entry} entry reference`
		);
	}
	assert.ok(references.has(`${prefix}env.js`), 'Missing isolated public environment module');
	assert.match(html, /base:\s*["']["']/, 'The application base must remain empty');
	const generatedFiles = filesBelow(resolve(buildDir, 'corex/_app'));
	for (const file of [resolve(buildDir, '200.html'), ...generatedFiles]) {
		if (!/\.(?:html|js|css|json)$/.test(file)) continue;
		// Preserve descriptive route catalog prefixes, reject concrete unscoped resources.
		const text = readFileSync(file, 'utf8').replaceAll('/corex/_app/', '/isolated-assets/');
		assert.ok(
			!/\/_app\/(?:immutable\/|env\.js|version\.json)/.test(text),
			`Shared asset reference in ${file}`
		);
	}
	const manifest = JSON.parse(readFileSync(resolve(kitDir, 'output/client/.vite/manifest.json'), 'utf8'));
	assert.ok(Object.keys(manifest).length > 0, 'Client manifest is empty');
	for (const [key, entry] of Object.entries(manifest)) {
		for (const output of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
			checkAsset(`/${output}`);
		}
		for (const dependency of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) {
			assert.ok(manifest[dependency], `Missing dependency ${dependency} of ${key}`);
		}
	}
	const serverManifest = JSON.parse(readFileSync(resolve(kitDir, 'output/server/.vite/manifest.json'), 'utf8'));
	const routePages = filesBelow(routesDir).filter((file) => file.endsWith('+page.svelte'));
	assert.ok(routePages.length > 0, 'Source route graph is empty');
	for (const file of routePages) {
		const key = relative(dirname(dirname(routesDir)), file).replaceAll('\\', '/');
		assert.ok(serverManifest[key], `Full route graph is missing ${key}`);
	}
	return { entryAssets: references.size, generatedFiles: generatedFiles.length, routes: routePages.length };
}

export function assertCorexIsolatedBuild(root = projectRoot) {
	assertCorexConfig(
		readConfig(resolve(root, 'worker/wrangler.corex-isolated.jsonc')),
		readConfig(resolve(root, 'worker/wrangler.corex.jsonc'))
	);
	return assertCorexArtifacts(
		resolve(root, 'build-corex'),
		resolve(root, '.svelte-kit-corex'),
		resolve(root, 'src/routes')
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	console.log('Corex isolated build guard passed:', assertCorexIsolatedBuild());
}