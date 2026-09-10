import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env')) {
	process.loadEnvFile('.env');
}

const requiredPublicEnv = [
	'PUBLIC_SUPABASE_URL',
	'PUBLIC_SUPABASE_ANON_KEY',
	'PUBLIC_GOOGLE_CLIENT_ID'
];
const missing = requiredPublicEnv.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
	throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
}

const supabaseUrl = new URL(process.env.PUBLIC_SUPABASE_URL);
if (supabaseUrl.protocol !== 'https:') {
	throw new Error('PUBLIC_SUPABASE_URL must use HTTPS.');
}

function run(command, args, cwd = process.cwd()) {
	console.log(`\n> [rakhunok-deploy] ${command} ${args.join(' ')} (in ${cwd})`);
	const result = spawnSync(command, args, {
		cwd,
		env: process.env,
		stdio: 'inherit',
		shell: process.platform === 'win32'
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
	}
}

function runNpm(args, cwd = process.cwd()) {
	run('npm', args, cwd);
}

console.log(`\n=== Starting production deployment for https://rakhunok.com/ ===`);
console.log(`Target Supabase: ${supabaseUrl.hostname}`);

// 1. Build all frontend surfaces
console.log('\n--- Building Root & SvelteKit Assets ---');
runNpm(['run', 'check']);
runNpm(['run', 'build']);

const generatedEnv = readFileSync('build/_app/env.js', 'utf8');
for (const name of requiredPublicEnv) {
	if (!generatedEnv.includes(name)) {
		throw new Error(`Production build is missing ${name}.`);
	}
}

console.log('\n--- Building Sub-apps (merchant-app, pay, conf) ---');
runNpm(['--prefix', 'apps/merchant-app', 'run', 'build']);
runNpm(['--prefix', 'apps/pay', 'run', 'build']);
runNpm(['--prefix', 'apps/conf', 'run', 'build']);

// 2. Validate all 6 worker configurations (Dry-run)
console.log('\n--- Running Dry-Run Checks for rakhunok.com Workers ---');
runNpm(['--prefix', 'worker-rakhunok', 'run', 'check:all']);

// 3. Deploy all 6 workers sequentially
console.log('\n--- Deploying Workers to rakhunok.com ---');
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:web']);
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:dashboard']);
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:corex']);
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:app']);
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:checkout']);
runNpm(['--prefix', 'worker-rakhunok', 'run', 'deploy:conf']);

console.log('\n=== Deployment to https://rakhunok.com/ successfully completed! ===\n');
