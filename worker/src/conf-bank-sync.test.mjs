import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import conf from './conf.ts';

async function applyBankMigration(database) {
    const migration = await readFile(new URL('../migrations-conf/0002_conf_banks.sql', import.meta.url), 'utf8');
    await database.batch(migration.split(';').map((statement) => statement.trim()).filter(Boolean)
        .map((statement) => database.prepare(statement)));
}

test('workerd verifies sessions before reading bank data', async (context) => {
    const bundle = await build({
        entryPoints: [fileURLToPath(new URL('./conf.ts', import.meta.url))],
        bundle: true, write: false, format: 'esm', platform: 'browser'
    });
    let authCalls = 0;
    let sourceCalls = 0;
    let authStatus = 401;
    let sourceStatus = 200;
    const runtime = new Miniflare(convertV4MiniflareOptions({
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-08-28',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['BANK_CATALOG_DB'],
        bindings: {
            CONF_SUPABASE_URL: 'https://source.test',
            CONF_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
            CONF_BANK_SYNC_ADMIN_IDS: 'admin-id'
        },
        outboundService: async (request) => {
            assert.equal(new URL(request.url).origin, 'https://source.test');
            if (new URL(request.url).pathname === '/auth/v1/user') {
                authCalls++;
                return Response.json({ id: 'admin-id' }, {
                    status: authStatus, headers: { Location: 'https://redirect.test/' }
                });
            }
            assert.equal(new URL(request.url).pathname, '/rest/v1/banklink');
            sourceCalls++;
            return Response.json([{ id: 'bank', code: 'BANK', name: 'Bank' }], {
                status: sourceStatus,
                headers: { 'Content-Range': '0-0/1', Location: 'https://redirect.test/' }
            });
        }
    }));
    context.after(() => runtime.dispose());
    const database = await runtime.getD1Database('BANK_CATALOG_DB');
    await database.prepare(await readFile(new URL('../migrations-conf/0001_bank_snapshots.sql', import.meta.url), 'utf8')).run();
    await applyBankMigration(database);
    const sync = () => runtime.dispatchFetch('https://conf.test/conf/api/banks/sync', {
        method: 'POST',
        headers: { Origin: 'https://conf.test', Authorization: 'Bearer invalid-token' }
    });
    const response = await sync();
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'authentication_required');
    assert.equal(authCalls, 1);
    authStatus = 302;
    assert.equal((await sync()).status, 502);
    assert.equal(authCalls, 2);
    assert.equal(sourceCalls, 0);
    authStatus = 200;
    sourceStatus = 302;
    assert.equal((await (await sync()).json()).error, 'source_unavailable');
    assert.equal(sourceCalls, 1);
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_bank_snapshots').first()).total, 0);
    sourceStatus = 200;
    const imported = await sync();
    assert.equal(imported.status, 200);
    assert.equal((await imported.json()).status, 'imported');
    assert.equal((await (await sync()).json()).status, 'unchanged');
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_bank_snapshots').first()).total, 1);
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_banks').first()).total, 1);
});

test('D1 sync without configuration fails closed and never forwards to the payment API', async () => {
    const response = await conf.fetch(new Request('https://conf.test/conf/api/banks/sync', {
        method: 'POST',
        headers: { Origin: 'https://conf.test' }
    }), {
        API: { fetch() { assert.fail('Sync must not reach the payment API'); } },
        ASSETS: { fetch() { assert.fail('Sync must not return HTML'); } }
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).error, 'sync_not_configured');
});

test('authorized imports preserve source fields and deduplicate in local D1', async (context) => {
    const runtime = new Miniflare(convertV4MiniflareOptions({
        modules: true,
        script: 'export default { fetch() { return new Response("test"); } };',
        compatibilityDate: '2026-08-28',
        d1Databases: ['BANK_CATALOG_DB']
    }));
    context.after(() => runtime.dispose());
    const database = await runtime.getD1Database('BANK_CATALOG_DB');
    const migration = await readFile(new URL('../migrations-conf/0001_bank_snapshots.sql', import.meta.url), 'utf8');
    await database.prepare(migration).run();
    await applyBankMigration(database);
    const env = {
        BANK_CATALOG_DB: database,
        CONF_SUPABASE_URL: 'https://source.test',
        CONF_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        CONF_BANK_SYNC_ADMIN_IDS: 'admin-id',
        API: { fetch() { assert.fail('Sync must not reach payments'); } },
        ASSETS: { fetch() { assert.fail('Sync must not return HTML'); } }
    };
    let user = { id: 'admin-id' };
    let rows = [
        { id: 'second', code: 'TWO', name: 'Second', extra: { nested: [2, 1] } },
        { id: 'first', code: 'ONE', name: "Bank's name", logo: 'data:image/png;base64,AA==', android_intent: 'intent://example', active: false }
    ];
    let range = '0-1/2';
    let authStatus = 200;
    let sourceStatus = 200;
    let sourceCalls = 0;
    const fetchMock = context.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(options.method ?? 'GET', 'GET');
        assert.equal(options.headers.Authorization, 'Bearer test-token');
        assert.equal(options.headers.apikey, 'test-publishable-key');
        assert.equal(options.redirect, 'manual');
        if (url.pathname === '/auth/v1/user') return Response.json(user, { status: authStatus });
        assert.equal(url.origin, 'https://source.test');
        assert.equal(url.pathname, '/rest/v1/banklink');
        assert.equal(url.searchParams.get('select'), '*');
        assert.equal(options.headers.Prefer, 'count=exact');
        sourceCalls++;
        return Response.json(rows, { status: sourceStatus, headers: { 'Content-Range': range } });
    });
    const request = (options = {}) => new Request('https://conf.test/conf/api/banks/sync', {
        method: 'POST', headers: { Authorization: 'Bearer test-token', Origin: 'https://conf.test' }, ...options
    });
    const expectError = async (expectedStatus, error, options, bindings = env) => {
        const response = await conf.fetch(request(options), bindings);
        assert.equal(response.status, expectedStatus);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal((await response.json()).error, error);
    };
    await expectError(405, 'method_not_allowed', { method: 'GET' });
    await expectError(401, 'authentication_required', { headers: {} });
    await expectError(403, 'origin_not_allowed', { headers: { Origin: 'https://other.test', Authorization: 'Bearer test-token' } });
    assert.equal(fetchMock.mock.callCount(), 0);
    user = { id: 'other-id', user_metadata: { admin: true } };
    await expectError(403, 'sync_forbidden');
    user = { id: 'admin-id', is_anonymous: true };
    await expectError(403, 'sync_forbidden');
    user = { id: 'admin-id' };
    authStatus = 401;
    await expectError(401, 'authentication_required');
    authStatus = 503;
    await expectError(502, 'auth_unavailable');
    assert.equal(sourceCalls, 0);
    authStatus = 200;

    const firstResponse = await conf.fetch(request({ body: JSON.stringify([{ id: 'untrusted-browser-draft' }]) }), env);
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    assert.equal(first.status, 'imported');
    assert.equal(first.snapshot.bank_count, 2);
    const stored = await database.prepare('SELECT * FROM conf_bank_snapshots').first();
    assert.deepEqual(JSON.parse(stored.payload_json), [rows[1], rows[0]]);
    assert.equal(stored.imported_by, 'admin-id');
    assert.equal(stored.source_url, 'https://source.test/rest/v1/banklink');
    const bank = await database.prepare('SELECT * FROM conf_banks WHERE code = ? COLLATE NOCASE').bind('one').first();
    assert.equal(bank.id, 'first');
    assert.equal(bank.active, 0);
    assert.equal(bank.snapshot_hash, first.snapshot.content_hash);
    assert.deepEqual(JSON.parse(bank.payload_json), rows[1]);
    rows = rows.reverse().map((row) => Object.fromEntries(Object.entries(row).reverse()));
    const repeated = await (await conf.fetch(request(), env)).json();
    assert.equal(repeated.status, 'unchanged');
    assert.deepEqual(repeated.snapshot, first.snapshot);
    rows[0].name = 'Changed';
    const changed = await (await conf.fetch(request(), env)).json();
    assert.equal(changed.status, 'imported');
    assert.notEqual(changed.snapshot.content_hash, first.snapshot.content_hash);
    assert.equal((await database.prepare('SELECT name FROM conf_banks WHERE id = ?').bind(rows[0].id).first()).name, 'Changed');

    range = '0-1/3';
    await expectError(422, 'source_incomplete_or_empty');
    range = '0-1/2';
    rows = [rows[0], rows[0]];
    await expectError(422, 'source_invalid');
    rows = [];
    range = '*/0';
    await expectError(422, 'source_incomplete_or_empty');
    rows = [{ id: 'invalid', code: '', name: 'Invalid' }];
    range = '0-0/1';
    await expectError(422, 'source_invalid');
    rows = [{ id: 'large', code: 'BIG', name: 'Large', logo: 'x'.repeat(1_500_000) }];
    await expectError(502, 'source_unavailable');
    sourceStatus = 503;
    await expectError(502, 'source_unavailable');
    sourceStatus = 200;
    rows = [{ id: 'valid', code: 'OK', name: 'Valid' }];
    await expectError(503, 'snapshot_storage_unavailable', undefined, {
        ...env, BANK_CATALOG_DB: { prepare: database.prepare.bind(database), batch() { throw new Error('unavailable'); } }
    });
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_bank_snapshots').first()).total, 2);
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_banks').first()).total, 2);
    await database.prepare("CREATE TRIGGER reject_bank_insert BEFORE INSERT ON conf_banks BEGIN SELECT RAISE(ABORT, 'test_failure'); END").run();
    await expectError(503, 'snapshot_storage_unavailable');
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_bank_snapshots').first()).total, 2);
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_banks').first()).total, 2);
    await database.prepare('DROP TRIGGER reject_bank_insert').run();
    const replaced = await (await conf.fetch(request(), env)).json();
    assert.equal(replaced.status, 'imported');
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_banks').first()).total, 1);
    assert.equal((await database.prepare('SELECT id FROM conf_banks').first()).id, 'valid');
    await database.prepare('DROP TABLE conf_banks').run();
    await applyBankMigration(database);
    assert.equal((await database.prepare('SELECT id FROM conf_banks').first()).id, 'valid');
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM conf_bank_snapshots').first()).total, 3);
});