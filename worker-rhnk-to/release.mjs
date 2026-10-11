import { existsSync, readFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const action = process.argv[2] || 'prepare';
const targets = ['web', 'corex-api', 'landing', 'dashboard', 'corex', 'app', 'pay', 'conf', 'platform', 'snapshot', 'legacy', 'qr', 'qr-api', 'main'];
if (!['prepare', 'dry-run', 'deploy'].includes(action)) throw new Error('Use prepare, dry-run or deploy.');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
if (new URL(process.env.PUBLIC_SUPABASE_URL || 'https://missing.invalid').hostname !== 'mwaeazabpvbxqfrceogr.supabase.co') {
	throw new Error('This release requires the explicitly approved old shared Supabase project.');
}
for (const name of ['PUBLIC_SUPABASE_ANON_KEY', 'PUBLIC_GOOGLE_CLIENT_ID']) {
	if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
}

const logs = resolve(import.meta.dirname, '.release-logs');
mkdirSync(logs, { recursive: true });
function run(label, args) {
	const output = openSync(resolve(logs, `${label}.log`), 'w');
	console.log(`Starting ${label}`);
	const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
		cwd: root, env: process.env, stdio: ['inherit', output, output], shell: process.platform === 'win32'
	});
	closeSync(output);
	if (result.status !== 0) {
		console.error(readFileSync(resolve(logs, `${label}.log`), 'utf8').split('\n').slice(-65).join('\n'));
		throw new Error(`${label} failed (${result.status}).`);
	}
	console.log(`Passed ${label}`);
}
function node(label, args) {
	const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
	if (result.status !== 0) throw new Error(`${label} failed.`);
}
if (action === 'prepare') {
	run('check', ['run', 'check']);
	run('build-root', ['run', 'build']);
	node('prepare-root', ['worker-rhnk/prepare.mjs']);
	node('prepare-landing', ['worker-rhnk-to/prepare-landing.mjs']);
	run('build-corex', ['exec', 'vite', '--', 'build', '--mode', 'corex-isolated']);
	for (const app of ['merchant-app', 'pay', 'conf', 'platform', 'dac7', 'checkout', 'qr/site', 'main']) {
		run(`build-${app.replaceAll('/', '-')}`, ['--prefix', resolve(root, 'apps', app), 'run', 'build']);
	}
}
node('routes', ['--experimental-strip-types', '--test', 'worker-rhnk-to/routes.test.mjs', 'worker-rhnk-to/config.test.mjs']);
for (const target of targets) {
	const config = resolve(import.meta.dirname, `wrangler.${target}.jsonc`);
	run(`dry-run-${target}`, ['--prefix', resolve(root, 'worker'), 'exec', 'wrangler', '--', 'deploy', '--dry-run', '--config', config]);
}
if (action === 'deploy') {
	for (const target of targets) {
		run(`deploy-${target}`, ['--prefix', resolve(root, 'worker'), 'exec', 'wrangler', '--', 'deploy', '--config', resolve(import.meta.dirname, `wrangler.${target}.jsonc`)]);
	}
}