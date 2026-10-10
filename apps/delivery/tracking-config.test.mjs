import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

test('tracking configuration reads Worker bindings after module initialization', async () => {
	const source = stripTypeScriptTypes(await readFile(new URL('./src/lib/server/tracking/config.ts', import.meta.url), 'utf8'))
		.replace("import * as env from '$app/env/private';", 'const env = {};')
		.replace("import { getRequestEvent } from '$app/server';", 'let event = {}; function getRequestEvent() { return event; } export function setEvent(value) { event = value; }');
	const config = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
	assert.equal(config.trackingConfig().url, undefined);
	config.setEvent({ platform: { env: {
		DELIVERY_TURSO_DATABASE_URL: 'libsql://database.invalid',
		DELIVERY_TURSO_AUTH_TOKEN: 'mock-token',
		DELIVERY_CREDENTIAL_ENCRYPTION_KEY: 'mock-key'
	} } });
	assert.deepEqual(config.trackingConfig(), {
		url: 'libsql://database.invalid', authToken: 'mock-token', encryptionKey: 'mock-key'
	});
});