import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateLocal } from './migrate-local.mjs';
import { fileURLToPath } from 'node:url';

test('actual stdio process initializes and lists tools without leaking config', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-stdio-'));
	const url = `file:${join(directory, 'tracking.db')}`;
	await migrateLocal(url);
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: ['--experimental-strip-types', fileURLToPath(new URL('./mcp-local.mjs', import.meta.url))],
		env: { ...process.env, DELIVERY_MCP_READ_CONSENT: 'yes', DELIVERY_MCP_SESSION_TOKEN: 'TEST_ONLY_TOKEN',
			DELIVERY_TURSO_DATABASE_URL: url, DELIVERY_SUPABASE_URL: 'https://example.supabase.co',
			DELIVERY_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stderr: 'pipe'
	});
	let stderr = '';
	transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
	const client = new Client({ name: 'stdio-test', version: '1.0.0' });
	try {
		try { await client.connect(transport); }
		catch { throw new Error(`Stdio initialization failed: ${stderr}`); }
		assert.equal((await client.listTools()).tools.length, 4);
		assert.doesNotMatch(stderr, /TEST_ONLY_TOKEN|sb_publishable_test/);
	} finally {
		await client.close();
		global.gc?.();
		await rm(directory, { recursive: true, force: true, maxRetries: 5 });
	}
});