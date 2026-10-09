import { readFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { parse } from 'dotenv';
import { migrateLocal } from './migrate-local.mjs';

const envFile = new URL('./.env.local', import.meta.url);
const content = await readFile(envFile, 'utf8').catch(error => {
	if (error.code === 'ENOENT') return '';
	throw error;
});
const config = parse(content);
const url = config.DELIVERY_TURSO_DATABASE_URL || `file:${fileURLToPath(new URL('./tracking-local.db', import.meta.url)).replaceAll('\\', '/')}`;
if (!/^file:(?!\/\/)[^?#]+$/.test(url)) throw new Error('Setup is restricted to a local file database');
await migrateLocal(url);
if (!config.DELIVERY_CREDENTIAL_ENCRYPTION_KEY) {
	const client = createClient({ url });
	try {
		const rows = await client.execute('SELECT COUNT(*) AS count FROM delivery_carrier_credentials');
		if (Number(rows.rows[0].count) > 0) throw new Error('Existing credentials require their original encryption key');
	} finally { client.close(); }
}
const additions = [];
if (!config.DELIVERY_TURSO_DATABASE_URL) additions.push(`DELIVERY_TURSO_DATABASE_URL=${JSON.stringify(url)}`);
if (!config.DELIVERY_CREDENTIAL_ENCRYPTION_KEY) additions.push(`DELIVERY_CREDENTIAL_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
if (additions.length) await appendFile(envFile, `\n${additions.join('\n')}\n`, { mode: 0o600 });
console.log('Local tracking database migrated; private configuration ready. Restart the local dev server to reload configuration.');