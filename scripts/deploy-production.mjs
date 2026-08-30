import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

const requiredPublicEnv = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'];
const missing = requiredPublicEnv.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
	throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
}

const supabaseUrl = new URL(process.env.PUBLIC_SUPABASE_URL);
if (supabaseUrl.protocol !== 'https:') {
	throw new Error('PUBLIC_SUPABASE_URL must use HTTPS.');
}

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit',
		shell: process.platform === 'win32'
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
	}
}

function runNpmScript(script) {
	run('npm', ['run', script]);
}

console.log(`Building production assets for ${supabaseUrl.hostname}...`);
runNpmScript('check');
runNpmScript('build');

const generatedEnv = readFileSync('build/_app/env.js', 'utf8');
for (const name of requiredPublicEnv) {
	if (!generatedEnv.includes(name)) {
		throw new Error(`Production build is missing ${name}.`);
	}
}

runNpmScript('worker:check:production');
runNpmScript('worker:check:dashboard:production');
runNpmScript('worker:deploy:production');
runNpmScript('worker:deploy:dashboard:production');

console.log('Root and Dashboard Workers now serve the same production build.');
