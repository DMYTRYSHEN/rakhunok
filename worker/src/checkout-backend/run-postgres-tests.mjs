import pg from 'pg';
import { spawn } from 'node:child_process';
import { localDatabaseUrl, provision, fixture } from './local-fixture.mjs';

const connectionString = localDatabaseUrl(process.env.CHECKOUT_TEST_DATABASE_URL);
const db = new pg.Client({ connectionString });
await db.connect();
try {
  const contexts = await provision(db);
  const child = spawn(process.execPath, ['--test', new URL('./postgres-concurrency.test.mjs', import.meta.url).pathname.replace(/^\/(.:)/, '$1')], {
    stdio: 'inherit', env: { ...process.env, CHECKOUT_TEST_ORDER_ID: fixture.order,
      CHECKOUT_TEST_CAPABILITY_HASH: contexts[0].hash }
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
} finally { await db.end(); }