import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { candidate, fixtureSql, ids, document, seller, identity, read, save, settingsSnapshot } from './fixtures.mjs';
import { contractSuite } from './contract-suite.mjs';

// Explicit opt-in; NO environment-derived URLs, passwords, host or database.
// Only the existing local administrator and allowlisted fixture port are selectable.
// Never imports checkout fixtures/migrations or remote invoice-db test code.
const enabled = process.env.BUSINESS_SETTINGS_LOCAL_PG === '1';
// Only the two designated local fixture ports; never accept a remote URL/host.
const port = Number(process.env.BUSINESS_SETTINGS_LOCAL_PG_PORT || 55439);
assert.ok([55439, 55440].includes(port), 'Only designated local test ports are allowed');
const config = { host: '127.0.0.1', port, user: process.env.BUSINESS_SETTINGS_LOCAL_PG_USER || 'postgres', password: '',
  ssl: false, connectionTimeoutMillis: 3000, statement_timeout: 15000 };

test('business settings SQL / disposable loopback PostgreSQL', { skip: !enabled, timeout: 180000 }, async t => {
  const name = `settings_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(name, /^settings_test_[a-f0-9]{32}$/);
  const admin = new pg.Client({ ...config, database: 'postgres' });
  const clients = [];
  let created = false;
  async function connect() {
    const db = new pg.Client({ ...config, database: name });
    await db.connect(); clients.push(db); return db;
  }
  await admin.connect();
  try {
    const server = (await admin.query('SELECT host(inet_server_addr()) AS host, inet_server_port() AS port')).rows[0];
    assert.deepEqual(server, { host: '127.0.0.1', port });
    // Roles are cluster-global: require existing harmless roles; NEVER create/alter them here.
    const roles = (await admin.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows;
    assert.equal(roles.length, 2, 'Local server must already have synthetic anon/authenticated roles');
    assert.ok(roles.every(role => !role.rolsuper && !role.rolbypassrls));
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);
    created = true;
    const db = await connect();
    await db.query(fixtureSql);
    assert.equal((await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 4);
    await db.query(candidate);
    await contractSuite(t, db);

    const first = await connect(), second = await connect();
    async function reset() {
      for (const c of [first, second]) { await c.query('ROLLBACK'); await identity(c); }
      await db.query('RESET ROLE');
      await db.query('DELETE FROM public.business_settings');
      await db.query(`INSERT INTO public.merchants(id,user_id) VALUES ($2,$1)
        ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id`, [ids.user, ids.merchant]);
      await db.query(`INSERT INTO public.business_entities(id,user_id) VALUES ($2,$1)
        ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id`, [ids.user, ids.seller]);
    }
    // Lock barrier checks actual pg_blocking_pids, not timing-dependent sleep assertions.
    async function blocked(client) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const row = (await db.query('SELECT cardinality(pg_blocking_pids($1)) AS n', [client.processID])).rows[0];
        if (row.n > 0) return;
        await new Promise(resolve => setImmediate(resolve));
      }
      assert.fail('Expected a real PostgreSQL lock wait');
    }
    const outcome = promise => promise.then(value => ({ value }), error => ({ error }));

    for (const initial of [0, 1]) {
      await t.test(`real CAS race at revision ${initial}: one winner, loser 40001`, async () => {
        await reset();
        if (initial) await save(first);
        await first.query('BEGIN');
        const winning = document({ financeName: 'winner', sellers: { [ids.second]: seller({ nextNumber: 42 }) } });
        await save(first, initial, winning);
        const waiting = outcome(save(second, initial, document({ financeName: 'loser' })));
        try { await blocked(second); } finally { await first.query('COMMIT'); }
        assert.equal((await waiting).error?.code, '40001');
        assert.deepEqual(await read(second), { revision: initial + 1, document: winning });
      });
    }

    await t.test('first writer rollback lets waiting first-save succeed', async () => {
      await reset(); await first.query('BEGIN'); await save(first);
      const waiting = outcome(save(second, 0, document({ financeName: 'survivor' })));
      try { await blocked(second); } finally { await first.query('ROLLBACK'); }
      assert.equal((await waiting).value?.revision, 1);
      assert.equal((await read(second)).document.financeName, 'survivor');
    });

    await t.test('read waits for aggregate commit; never sees mixed parent/sellers', async () => {
      await reset(); await save(first); await first.query('BEGIN');
      const value = document({ financeName: 'new', sellers: { [ids.second]: seller({ nextNumber: 99 }) } });
      await save(first, 1, value);
      const waiting = outcome(read(second));
      try { await blocked(second); } finally { await first.query('COMMIT'); }
      assert.deepEqual((await waiting).value, { revision: 2, document: value });
    });

    await t.test('reader SHARE lock blocks settings save until transaction completes', async () => {
      await reset(); await save(first); await first.query('BEGIN');
      assert.equal((await read(first)).revision, 1);
      const waiting = outcome(save(second, 1));
      try { await blocked(second); } finally { await first.query('COMMIT'); }
      assert.equal((await waiting).value?.revision, 2);
    });

    async function mutate(client, table, mutation) {
      const id = table === 'merchants' ? ids.merchant : ids.seller;
      return mutation === 'delete'
        ? client.query(`DELETE FROM public.${table} WHERE id=$1`, [id])
        : client.query(`UPDATE public.${table} SET user_id=$1 WHERE id=$2`, [ids.other, id]);
    }
    async function bounded(client) {
      await client.query("SET LOCAL lock_timeout='500ms'");
      await client.query("SET LOCAL statement_timeout='2s'");
    }
    async function unavailable(client, revision) {
      await assert.rejects(() => read(client), { code: '42501' });
      await assert.rejects(() => save(client, revision, document({ sellers: {} })), { code: '42501' });
    }

    for (const table of ['merchants', 'business_entities']) {
      for (const mutation of ['transfer', 'delete']) {
        for (const operation of ['read', 'save']) {
          await t.test(`${table} ${mutation} never waits for open settings ${operation}`, async () => {
            await reset(); await save(first); await first.query('BEGIN');
            await (operation === 'read' ? read(first) : save(first, 1));
            const locks = (await db.query(`SELECT mode FROM pg_locks WHERE pid=$1 AND granted
              AND relation IN ('public.merchants'::regclass,'public.business_entities'::regclass)`, [first.processID])).rows;
            assert.equal(locks.length, 2);
            assert.ok(locks.every(lock => lock.mode === 'AccessShareLock'), 'RPC must take no operative row-locking table mode');
            await second.query('RESET ROLE'); await second.query('BEGIN'); await bounded(second);
            try {
              assert.equal((await mutate(second, table, mutation)).rowCount, 1);
              await second.query('COMMIT');
            } finally { await second.query('ROLLBACK'); await first.query('COMMIT'); }
            const drafts = await settingsSnapshot(db);
            assert.equal(drafts.business_settings[0].row.revision, operation === 'read' ? 1 : 2);
            assert.equal(drafts.business_settings_sellers.length, 1);
            await identity(second);
            await unavailable(second, drafts.business_settings[0].row.revision);
            assert.deepEqual(await settingsSnapshot(db), drafts);
          });

          await t.test(`uncommitted ${table} ${mutation} does not block ${operation}; next snapshot fails closed`, async () => {
            await reset(); await save(second);
            await first.query('RESET ROLE'); await first.query('BEGIN');
            await mutate(first, table, mutation);
            await second.query('BEGIN'); await bounded(second);
            try {
              const result = await (operation === 'read' ? read(second) : save(second, 1));
              assert.equal(result.revision, operation === 'read' ? 1 : 2, 'previous committed owner snapshot is intentional');
              await second.query('COMMIT');
            } finally { await second.query('ROLLBACK'); await first.query('COMMIT'); }
            const drafts = await settingsSnapshot(db);
            await unavailable(second, operation === 'read' ? 1 : 2);
            assert.deepEqual(await settingsSnapshot(db), drafts);
          });

          await t.test(`${operation} rechecks ${table} ${mutation} committed during draft-parent wait`, async () => {
            await reset(); await save(first); await first.query('BEGIN'); await save(first, 1);
            const waiting = outcome(operation === 'read' ? read(second) : save(second, 2, document({ sellers: {} })));
            try {
              await blocked(second);
              await db.query('BEGIN'); await bounded(db);
              await mutate(db, table, mutation);
              await db.query('COMMIT');
            } finally { await db.query('ROLLBACK'); await first.query('COMMIT'); }
            assert.equal((await waiting).error?.code, '42501');
            const drafts = await settingsSnapshot(db);
            assert.equal(drafts.business_settings[0].row.revision, 2);
            assert.equal(drafts.business_settings_sellers.length, 1, 'omission cannot prune revoked old reference');
          });
        }

        await t.test(`first-save unique-index wait rechecks committed ${table} ${mutation}`, async () => {
          await reset(); await first.query('BEGIN'); await save(first);
          const waiting = outcome(save(second));
          try {
            await blocked(second);
            await db.query('BEGIN'); await bounded(db); await mutate(db, table, mutation); await db.query('COMMIT');
          } finally { await db.query('ROLLBACK'); await first.query('ROLLBACK'); }
          assert.equal((await waiting).error?.code, '42501');
          assert.deepEqual(await settingsSnapshot(db), { business_settings: [], business_settings_sellers: [] });
        });

        await t.test(`first save during uncommitted ${table} ${mutation} uses snapshot without operative locks`, async () => {
          await reset(); await first.query('RESET ROLE'); await first.query('BEGIN');
          await mutate(first, table, mutation);
          await second.query('BEGIN'); await bounded(second);
          try { assert.equal((await save(second)).revision, 1); await second.query('COMMIT'); }
          finally { await second.query('ROLLBACK'); await first.query('COMMIT'); }
          await unavailable(second, 1);
          assert.equal((await settingsSnapshot(db)).business_settings[0].row.revision, 1);
        });
      }
    }

    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE', 'READ UNCOMMITTED']) {
      for (const operation of ['read', 'save']) {
        await t.test(`${operation} rejects ${isolation} rather than authorizing a frozen snapshot`, async () => {
          await reset(); await first.query(`BEGIN ISOLATION LEVEL ${isolation}`);
          try { await assert.rejects(() => operation === 'read' ? read(first) : save(first), { code: '22023' }); }
          finally { await first.query('ROLLBACK'); }
          assert.deepEqual(await read(first), { revision: 0, document: null });
        });
      }
    }

    await t.test('independent merchants sharing an entity do not serialize first saves', async () => {
      await reset(); await first.query('BEGIN'); await save(first);
      await second.query('BEGIN'); await bounded(second);
      try { assert.equal((await save(second, 0, document(), ids.sibling)).revision, 1); await second.query('COMMIT'); }
      finally { await second.query('ROLLBACK'); await first.query('COMMIT'); }
    });

    await t.test('new merchant owner cannot inherit an in-flight first save after unique-index wait', async () => {
      await reset(); await first.query('BEGIN'); await save(first, 0, document({ sellers: {} }));
      await db.query('UPDATE public.merchants SET user_id=$1 WHERE id=$2', [ids.other, ids.merchant]);
      await identity(second, ids.other);
      const waiting = outcome(save(second, 0, document({ sellers: {} })));
      try { await blocked(second); } finally { await first.query('COMMIT'); }
      assert.equal((await waiting).error?.code, '42501');
      await unavailable(second, 1);
      assert.equal((await settingsSnapshot(db)).business_settings[0].row.owner_user_id, ids.user);
    });
  } finally {
    for (const db of clients) { await db.query('ROLLBACK').catch(() => {}); await db.end(); }
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
    t.diagnostic(`Disposable database ${name} ${created ? 'dropped' : 'not created'}; no remote access.`);
  }
});