import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = dirname(fileURLToPath(import.meta.url));
const configPath = join(directory, 'wrangler.jsonc');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const approvedRoutes = ['rhnk.to/delivery', 'rhnk.to/delivery/*'];
if (config.name !== 'rhnk-to-delivery' || config.account_id !== '753ff9292511c16a281c5cfa8e105c63' ||
	config.routes.length !== 2 || config.routes.some(route => !approvedRoutes.includes(route.pattern) || route.zone_name !== 'rhnk.to')) {
	throw new Error('Unexpected Delivery deployment target');
}
if (process.argv.slice(2).some(argument => argument !== '--dry-run')) throw new Error('Unsupported deployment argument');
const local = parseEnv(await readFile(join(directory, '.env.local'), 'utf8'));
const secrets = Object.fromEntries(['DELIVERY_TURSO_AUTH_TOKEN', 'DELIVERY_CREDENTIAL_ENCRYPTION_KEY'].map(name => {
	if (!local[name]) throw new Error(`Missing ${name}`);
	return [name, local[name]];
}));
const temporary = await mkdtemp(join(tmpdir(), 'delivery-release-'));
try {
	const secretsPath = join(temporary, 'secrets.json');
	await writeFile(secretsPath, JSON.stringify(secrets), { mode: 0o600 });
	const args = [join(directory, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--config', configPath,
		'--secrets-file', secretsPath, '--message', 'Isolated Delivery release with shared Dashboard Auth'];
	if (process.argv.includes('--dry-run')) args.push('--dry-run');
	const result = spawnSync(process.execPath, args, { cwd: directory, stdio: 'inherit' });
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
} finally {
	await rm(temporary, { recursive: true, force: true });
}