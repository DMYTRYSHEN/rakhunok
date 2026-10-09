import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { migrateLocal } from './migrate-local.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const source = parseEnv(readFileSync(new URL('../../.env', import.meta.url), 'utf8'));
const mapping = {
	DELIVERY_SUPABASE_URL: 'PUBLIC_SUPABASE_URL',
	DELIVERY_SUPABASE_PUBLISHABLE_KEY: 'PUBLIC_SUPABASE_ANON_KEY',
	DELIVERY_GOOGLE_CLIENT_ID: 'PUBLIC_GOOGLE_CLIENT_ID'
};
const environment = { ...process.env };
for (const [target, original] of Object.entries(mapping)) {
	if (!source[original]) throw new Error(`Missing local Dashboard setting: ${original}`);
	environment[target] = source[original];
}
if (!environment.DELIVERY_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
	throw new Error('Local Dashboard authentication requires a publishable key.');
}
if (process.argv.includes('--check')) {
	console.log('Local Dashboard authentication settings are available; no keys printed.');
} else {
	const localFile = new URL('./.env.local', import.meta.url);
	const local = existsSync(localFile) ? parseEnv(readFileSync(localFile, 'utf8')) : {};
	const databaseUrl = environment.DELIVERY_TURSO_DATABASE_URL ?? local.DELIVERY_TURSO_DATABASE_URL;
	if (!databaseUrl || databaseUrl.startsWith('file:')) {
		const file = databaseUrl?.slice(5) ?? 'tracking-local.db';
		const localUrl = `file:${resolve(directory, file).replaceAll('\\', '/')}`;
		await migrateLocal(localUrl);
		environment.DELIVERY_TURSO_DATABASE_URL = localUrl;
	}
	const require = createRequire(import.meta.url);
	const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
	const child = spawn(process.execPath, [vite, 'dev', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
		cwd: directory, env: environment, stdio: 'inherit'
	});
	child.on('error', () => { process.exitCode = 1; });
	child.on('exit', code => { process.exitCode = code ?? 1; });
}