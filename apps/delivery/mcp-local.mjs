import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
import { parse } from 'dotenv';
import { createClient } from '@libsql/client';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { authenticate } from './src/lib/server/tracking/auth.ts';
import { NovaPoshtaApi } from './src/lib/server/tracking/np-api.ts';
import { createReadModel } from './src/lib/server/mcp/read-model.ts';
import { createDeliveryMcp } from './src/lib/server/mcp/server.ts';

async function start() {
	if (process.env.DELIVERY_MCP_READ_CONSENT !== 'yes') throw new Error('Consent required');
	const token = process.env.DELIVERY_MCP_SESSION_TOKEN;
	if (!token || token.length > 8192 || !/^[A-Za-z0-9._~+/-]+=*$/.test(token)) throw new Error('Session required');
	const directory = fileURLToPath(new URL('./', import.meta.url));
	let local = {};
	try { local = parse(await readFile(resolve(directory, '.env.local'), 'utf8')); }
	catch (caught) { if (caught.code !== 'ENOENT') throw caught; }
	const value = name => process.env[name] ?? local[name];
	const raw = value('DELIVERY_TURSO_DATABASE_URL');
	if (typeof raw !== 'string' || !raw.startsWith('file:')) throw new Error('Local database required');
	const url = new URL(raw);
	if (url.host || url.search || url.hash) throw new Error('Local database required');
	const path = isAbsolute(raw.slice(5)) ? raw.slice(5) : fileURLToPath(url);
	if (!isAbsolute(path) || !(await stat(path)).isFile()) throw new Error('Existing database required');
	const request = new Request('http://localhost/delivery-mcp', { headers: { Authorization: `Bearer ${token}` } });
	const authConfig = {
		SUPABASE_URL: value('DELIVERY_SUPABASE_URL'),
		SUPABASE_PUBLISHABLE_KEY: value('DELIVERY_SUPABASE_PUBLISHABLE_KEY')
	};
	const database = createClient({ url: raw });
	try {
		await database.execute('PRAGMA query_only = ON');
		await database.execute('SELECT id FROM delivery_shipments LIMIT 0');
		const server = createDeliveryMcp({
			authenticate: () => authenticate(request, authConfig),
			reads: createReadModel(database), points: new NovaPoshtaApi()
		});
		let closing = false;
		const close = async () => {
			if (closing) return;
			closing = true;
			await server.close();
			database.close();
		};
		server.server.onclose = () => { database.close(); };
		process.once('SIGINT', () => { void close(); });
		process.once('SIGTERM', () => { void close(); });
		process.stdin.once('end', () => { void close(); });
		await server.connect(new StdioServerTransport());
	} catch (caught) { database.close(); throw caught; }
}

start().catch(() => {
	process.stderr.write('Delivery MCP could not start. Check local consent, session and database configuration.\n');
	process.exitCode = 1;
});