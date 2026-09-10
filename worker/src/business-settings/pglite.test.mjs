import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { candidate, fixtureSql } from './fixtures.mjs';
import { contractSuite } from './contract-suite.mjs';

test('business settings SQL / PGlite isolated contract', { timeout: 120000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN;');
    await db.exec(fixtureSql);
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if (tables.rows.length !== 4) throw new Error('Unexpected synthetic fixture schema');
    await db.exec(candidate);
    await contractSuite(t, db);
  } finally { await db.close(); }
});