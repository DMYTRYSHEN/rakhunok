import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

function run(command, args) {
	console.log(\n>  );
	const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
	if (result.status !== 0) throw new Error('Failed with code ' + result.status);
}

const configs = [
    'worker-rhnk/wrangler.jsonc',
    'worker-rhnk/wrangler.landing.jsonc',
    'worker-rhnk/wrangler.dashboard.jsonc',
    'worker-rhnk/wrangler.corex.jsonc',
    'worker-rhnk/wrangler.app.jsonc',
    'worker-rhnk/wrangler.checkout.jsonc',
    'worker-rhnk/wrangler.conf.jsonc'
];

for (const conf of configs) {
    if (existsSync(conf)) {
        run('npx', ['wrangler', 'deploy', '--config', conf]);
    } else {
        console.log('Warning: ' + conf + ' not found.');
    }
}
console.log('All deployed successfully!');
