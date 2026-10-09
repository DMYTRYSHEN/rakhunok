import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function migrateLocal(url = 'file:./tracking-local.db') {
	if (typeof url !== 'string' || !/^file:(?!\/\/)[^?#]+$/.test(url)) {
		throw new Error('Local migration requires a file: URL without host, query or fragment');
	}
	const file = url.slice(5);
	if (file === ':memory:' || /(?:^|[\\/])local\.db$/i.test(file)) {
		throw new Error('Use a separate tracking database, not local.db or an in-memory database');
	}
	const sql = await readFile(new URL('./migrations/001_tracking.sql', import.meta.url), 'utf8');
	const client = createClient({ url });
	try {
		await client.executeMultiple(sql);
		await client.execute('CREATE TABLE IF NOT EXISTS tracking_migrations (name TEXT PRIMARY KEY)');
		const transaction = await client.transaction('write');
		try {
			const applied = await transaction.execute("SELECT name FROM tracking_migrations WHERE name = '002_np_integration'");
			if (!applied.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/002_np_integration.sql', import.meta.url), 'utf8'));
				await transaction.execute("INSERT INTO tracking_migrations VALUES ('002_np_integration')");
			}
			const credentials = await transaction.execute({
				sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['003_carrier_credentials']
			});
			if (!credentials.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/003_carrier_credentials.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['003_carrier_credentials'] });
			}
			const multiCarrier = await transaction.execute({
				sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['004_multi_carrier_credentials']
			});
			if (!multiCarrier.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/004_multi_carrier_credentials.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['004_multi_carrier_credentials'] });
			}
			const meestTracking = await transaction.execute({
				sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['005_meest_tracking']
			});
			if (!meestTracking.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/005_meest_tracking.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['005_meest_tracking'] });
			}
			const documents = await transaction.execute({
				sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['006_np_documents']
			});
			if (!documents.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/006_np_documents.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['006_np_documents'] });
			}
			const senderDefaults = await transaction.execute({
				sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['007_np_sender_defaults']
			});
			if (!senderDefaults.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/007_np_sender_defaults.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['007_np_sender_defaults'] });
			}
			const customers = await transaction.execute({ sql: 'SELECT name FROM tracking_migrations WHERE name = ?', args: ['008_customers'] });
			if (!customers.rows.length) {
				await transaction.executeMultiple(await readFile(new URL('./migrations/008_customers.sql', import.meta.url), 'utf8'));
				await transaction.execute({ sql: 'INSERT INTO tracking_migrations VALUES (?)', args: ['008_customers'] });
			}
			await transaction.commit();
		} finally { transaction.close(); }
	} finally {
		client.close();
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	try {
		await migrateLocal(process.argv[2]);
		console.log('Local tracking migration applied');
	} catch (error) {
		console.error(error instanceof Error ? error.message : 'Local migration failed');
		process.exitCode = 1;
	}
}