import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@libsql/client/web';

const config = JSON.parse(await readFile(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
const local = parseEnv(await readFile(new URL('./.env.local', import.meta.url), 'utf8'));
const url = config.vars.DELIVERY_TURSO_DATABASE_URL;
if (config.name !== 'rhnk-to-delivery' || url !== 'libsql://delivery-rhnk.aws-eu-west-1.turso.io') {
	throw new Error('Unexpected Delivery database target');
}
if (!local.DELIVERY_TURSO_AUTH_TOKEN) throw new Error('Missing Delivery database token');
if (process.argv.length !== 3 || !['--check', '--apply'].includes(process.argv[2])) {
	throw new Error('Choose --check or --apply');
}
const client = createClient({ url, authToken: local.DELIVERY_TURSO_AUTH_TOKEN });
try {
	const history = await client.execute('SELECT name FROM tracking_migrations ORDER BY name');
	console.log('Target: delivery-rhnk; migration history:', history.rows.map(row => row.name));
	for (const name of ['002_np_integration', '003_carrier_credentials', '004_multi_carrier_credentials', '005_meest_tracking', '006_np_documents', '007_np_sender_defaults', '008_customers']) {
		if (!history.rows.some(row => row.name === name)) throw new Error(`Missing prerequisite ${name}`);
	}
	const recorded = history.rows.some(row => row.name === '009_directory_points');
	const table = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='delivery_directory_points'");
	if (recorded !== Boolean(table.rows.length)) throw new Error('Directory migration schema drift');
	if (!recorded && process.argv[2] === '--apply') {
		const transaction = await client.transaction('write');
		try {
			await transaction.executeMultiple(await readFile(new URL('./migrations/009_directory_points.sql', import.meta.url), 'utf8'));
			await transaction.execute({ sql: 'INSERT INTO tracking_migrations(name) VALUES (?)', args: ['009_directory_points'] });
			await transaction.commit();
		} finally { transaction.close(); }
		console.log('009_directory_points applied; no local data copied.');
	} else console.log(recorded ? '009_directory_points already applied.' : '009_directory_points pending; no writes made.');
	if (recorded || process.argv[2] === '--apply') {
		const columns = await client.execute('PRAGMA table_info(delivery_directory_points)');
		const count = await client.execute('SELECT COUNT(*) AS count FROM delivery_directory_points');
		console.log('Verified columns:', columns.rows.map(row => row.name));
		console.log('Directory rows:', count.rows[0].count);
	}
} finally { client.close(); }