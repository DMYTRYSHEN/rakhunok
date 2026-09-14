import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// In-memory synthetic PostgreSQL only. No runtime imports, env, network, installs,
// persistent databases, or migration runners. Follow business-settings PGlite's
// SET ROLE pattern: every RPC below runs as a real non-bypass authenticated role.
const candidate = await readFile(
  new URL('../../supabase/candidates/dashboard-access-context.sql', import.meta.url), 'utf8'
);
const teamMigration = await readFile(
  new URL('../../supabase/migrations/20260910221500_merchant_team_and_invitations.sql', import.meta.url), 'utf8'
);
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const owner = uuid(1), otherOwner = uuid(2), actor = uuid(3), stranger = uuid(4);
const merchant = uuid(101), otherMerchant = uuid(102), sibling = uuid(103);
const terminal = uuid(201), secondTerminal = uuid(202), foreignTerminal = uuid(203);
const inactiveTerminal = uuid(204), membership = uuid(301);
const tables = ['merchants', 'terminals', 'merchant_memberships', 'users'];

// Relevant baseline columns/constraints. No invented terminals.merchant_id or
// membership revocation column. Extra irrelevant commercial columns are omitted.
// merchants.user_id uniqueness is deliberately relaxed to exercise all-owner
// determinism if multiple merchants are permitted; not a proposed schema change.
const fixture = `
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE context_definer NOLOGIN NOSUPERUSER BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  business_name varchar(200) NOT NULL, display_name varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false
);
CREATE TABLE public.terminals (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true
);
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, context_definer;
GRANT CREATE ON SCHEMA public TO context_definer;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, context_definer;
`;

async function identity(db, user = actor, role = 'authenticated') {
  assert.ok(['authenticated', 'anon'].includes(role));
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec(`SET ROLE ${role}`);
  assert.equal((await db.query('SELECT current_user AS role')).rows[0].role, role);
}

async function contexts(db, user = actor, role = 'authenticated') {
  await identity(db, user, role);
  return (await db.query('SELECT * FROM public.dashboard_access_contexts()')).rows;
}

async function admin(db, sql, params = []) {
  await db.exec('RESET ROLE');
  return db.query(sql, params);
}

async function member(db, {
  id = membership, user = actor, merchantId = merchant,
  role = 'manager', terminalId = null, status = 'active'
} = {}) {
  await admin(db, `INSERT INTO public.merchant_memberships
    (id, merchant_id, user_id, role, terminal_id, status) VALUES ($1,$2,$3,$4,$5,$6)`,
  [id, merchantId, user, role, terminalId, status]);
}

function expected({ user = actor, ownerId = owner, merchantId = merchant,
  name = 'First business', source = 'membership', role = 'manager',
  memberId = membership, terminals = [terminal, secondTerminal] } = {}) {
  return { actor_user_id: user, owner_user_id: ownerId, merchant_id: merchantId,
    merchant_name: name, access_source: source, role, membership_id: memberId,
    terminal_ids: terminals };
}

async function snapshot(db) {
  await db.exec('RESET ROLE');
  const result = {};
  for (const table of tables) {
    const schema = table === 'users' ? 'auth' : 'public';
    result[table] = (await db.query(
      `SELECT row_to_json(t) AS row, xmin::text FROM ${schema}.${table} t ORDER BY t.id`
    )).rows;
  }
  return result;
}

async function metadata(db) {
  await db.exec('RESET ROLE');
  return (await db.query(`SELECT c.relname, c.relowner::regrole::text AS owner,
    c.relacl::text AS acl, c.relrowsecurity, c.relforcerowsecurity,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname)
      FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`)).rows;
}

test('dashboard access contexts / isolated local PGlite contract', { timeout: 120000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    // Execute the CHECKED-IN team migration only in this disposable in-memory DB:
    // includes the actual enum, FK SET NULL, role helper and recursive RLS policies.
    await db.exec(teamMigration);
    await db.exec(`
      ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.merchants FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.terminals FORCE ROW LEVEL SECURITY;
      ALTER TABLE public.merchant_memberships FORCE ROW LEVEL SECURITY;
      CREATE POLICY fixture_deny_merchants ON public.merchants
        FOR SELECT TO authenticated USING (false);
      CREATE POLICY fixture_deny_terminals ON public.terminals
        FOR SELECT TO authenticated USING (false);
      GRANT SELECT ON public.merchants, public.terminals TO authenticated;
      GRANT SELECT ON public.merchants, public.terminals, public.merchant_memberships TO context_definer;
    `);
    const beforeInstall = await metadata(db);
    await db.exec('SET ROLE context_definer');
    await db.exec(candidate);
    await db.exec('RESET ROLE');
    const afterInstall = await metadata(db);

    // Future enum labels are test-only. Candidate must also work BEFORE they exist.
    await t.test('current enum without viewer installs and permits an empty authenticated read', async () => {
      assert.deepEqual((await db.query(`SELECT enumlabel FROM pg_enum
        WHERE enumtypid = 'public.merchant_member_role'::regtype ORDER BY enumsortorder`)).rows
        .map(row => row.enumlabel), ['owner', 'manager', 'cashier', 'kso']);
      assert.deepEqual(await contexts(db), []);
      await db.exec('RESET ROLE');
    });
    await db.exec(`ALTER TYPE public.merchant_member_role ADD VALUE 'viewer';
      ALTER TYPE public.merchant_member_role ADD VALUE 'unknown';`);
    await db.query('INSERT INTO auth.users VALUES ($1),($2),($3),($4)', [owner, otherOwner, actor, stranger]);
    await db.query(`INSERT INTO public.merchants (id,user_id,business_name,display_name)
      VALUES ($1,$2,'First business','First display'),($3,$4,'Second business','Second display')`,
    [merchant, owner, otherMerchant, otherOwner]);
    await db.query(`INSERT INTO public.terminals VALUES ($1,$2,true),($3,$2,true),($4,$5,true),($6,$2,false)`,
    [secondTerminal, owner, terminal, foreignTerminal, otherOwner, inactiveTerminal]);

    // Each case rolls back its synthetic modifications, including deliberate
    // schema damage used to check failure behavior. Never mutate repository SQL.
    async function check(name, run) {
      await t.test(name, async () => {
        await db.exec('RESET ROLE; BEGIN');
        try { await run(); }
        finally { await db.exec('ROLLBACK; RESET ROLE'); }
      });
    }

    await check('candidate changes no existing table ACL, owner, RLS or policy', async () => {
      assert.deepEqual(afterInstall, beforeInstall);
    });
    await check('function is zero-input STABLE SECURITY DEFINER with locked settings and trusted bypass owner', async () => {
      const { rows } = await db.query(`SELECT p.pronargs, p.prosecdef, p.provolatile, p.proconfig,
        r.rolname, r.rolsuper, r.rolbypassrls,
        pg_get_function_result(p.oid) AS result
        FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
        WHERE p.oid='public.dashboard_access_contexts()'::regprocedure`);
      assert.equal(rows[0].pronargs, 0);
      assert.equal(rows[0].prosecdef, true);
      assert.equal(rows[0].provolatile, 's');
      assert.deepEqual(rows[0].proconfig, ['search_path=""', 'row_security=off']);
      assert.equal(rows[0].rolname, 'context_definer');
      assert.equal(rows[0].rolsuper, false);
      assert.equal(rows[0].rolbypassrls, true);
      assert.match(rows[0].result, /terminal_ids uuid\[\]/);
    });
    await check('owner without membership gets canonical identity and ordered active terminals', async () => {
      assert.deepEqual(await contexts(db, owner), [expected({ user: owner, source: 'ownership', role: 'owner', memberId: null })]);
    });
    await check('no owner or membership gives no contexts and does not create onboarding data', async () => {
      const before = await snapshot(db);
      assert.deepEqual(await contexts(db), []);
      assert.deepEqual(await snapshot(db), before);
    });
    await check('incomplete onboarding and inactive merchant do not introduce an owner gate', async () => {
      await admin(db, 'UPDATE public.merchants SET is_active=false, onboarding_completed=false WHERE id=$1', [merchant]);
      assert.deepEqual(await contexts(db, owner), [expected({ user: owner, source: 'ownership', role: 'owner', memberId: null })]);
    });
    await check('all owned merchants return deterministically and suppress every membership', async () => {
      await admin(db, `INSERT INTO public.merchants (id,user_id,business_name,display_name)
        VALUES ($1,$2,'Sibling','Sibling')`, [sibling, owner]);
      await member(db, { user: owner, merchantId: otherMerchant });
      assert.deepEqual(await contexts(db, owner), [
        expected({ user: owner, source: 'ownership', role: 'owner', memberId: null }),
        expected({ user: owner, source: 'ownership', role: 'owner', memberId: null, merchantId: sibling, name: 'Sibling' })
      ]);
    });
    await check('canonical owner remains owner despite suspended membership owner metadata', async () => {
      await member(db, { user: owner, role: 'owner', status: 'suspended' });
      assert.equal((await contexts(db, owner))[0].access_source, 'ownership');
    });
    for (const role of ['manager', 'viewer']) {
      await check(`active unassigned ${role} returns explicit active owner-bound terminal list`, async () => {
        await member(db, { role });
        assert.deepEqual(await contexts(db), [expected({ role })]);
      });
      await check(`assigned ${role} retains one validated terminal, not full merchant scope`, async () => {
        await member(db, { role, terminalId: secondTerminal });
        assert.deepEqual(await contexts(db), [expected({ role, terminals: [secondTerminal] })]);
      });
      for (const [label, terminalId] of [['foreign', foreignTerminal], ['inactive', inactiveTerminal]]) {
        await check(`assigned ${role} with ${label} terminal is excluded, never widened`, async () => {
          await member(db, { role, terminalId });
          assert.deepEqual(await contexts(db), []);
        });
      }
      await check(`unassigned ${role} with no active terminals gets empty array, not wildcard`, async () => {
        await member(db, { role });
        await admin(db, 'UPDATE public.terminals SET is_active=false WHERE user_id=$1', [owner]);
        assert.deepEqual(await contexts(db), [expected({ role, terminals: [] })]);
      });
    }
    await check('active cashier has distinct actor and owner with exactly assigned terminal', async () => {
      await member(db, { role: 'cashier', terminalId: terminal });
      assert.deepEqual(await contexts(db), [expected({ role: 'cashier', terminals: [terminal] })]);
      assert.notEqual(actor, owner);
    });
    for (const [label, terminalId] of [['null', null], ['wrong tenant', foreignTerminal], ['inactive', inactiveTerminal]]) {
      await check(`cashier ${label} assignment is excluded`, async () => {
        await member(db, { role: 'cashier', terminalId });
        assert.deepEqual(await contexts(db), []);
      });
    }
    for (const role of ['owner', 'kso', 'unknown']) {
      await check(`membership role ${role} cannot grant dashboard access or canonical ownership`, async () => {
        await member(db, { role, terminalId: terminal });
        assert.deepEqual(await contexts(db), []);
      });
    }
    await check('multiple eligible memberships all return by merchant UUID, never insertion order or arbitrary first', async () => {
      await member(db, { id: uuid(302), merchantId: otherMerchant, role: 'viewer' });
      await member(db, { role: 'cashier', terminalId: terminal });
      const want = [expected({ role: 'cashier', terminals: [terminal] }), expected({
        merchantId: otherMerchant, ownerId: otherOwner, name: 'Second business',
        role: 'viewer', memberId: uuid(302), terminals: [foreignTerminal]
      })];
      assert.deepEqual(await contexts(db), want);
      assert.deepEqual(await contexts(db), want);
    });
    await check('other actors cannot see a member context and role changes do not leak cached identity', async () => {
      await member(db);
      assert.equal((await contexts(db)).length, 1);
      assert.deepEqual(await contexts(db, stranger), []);
      assert.deepEqual(await contexts(db, otherOwner), [expected({ user: otherOwner, ownerId: otherOwner,
        merchantId: otherMerchant, name: 'Second business', source: 'ownership', role: 'owner',
        memberId: null, terminals: [foreignTerminal] })]);
      assert.deepEqual(await contexts(db), [expected()]);
    });
    for (const [label, sql] of [
      ['suspension', "UPDATE public.merchant_memberships SET status='suspended' WHERE id=$1"],
      ['deletion', 'DELETE FROM public.merchant_memberships WHERE id=$1'],
      // Baseline status CHECK allows only active/suspended; role removal is another
      // real-schema revocation path. Do not invent status='revoked' in production.
      ['role revocation', "UPDATE public.merchant_memberships SET role='kso' WHERE id=$1"]
    ]) {
      await check(`${label} is observed by the next call, no stale membership cache`, async () => {
        await member(db);
        assert.equal((await contexts(db)).length, 1);
        await admin(db, sql, [membership]);
        assert.deepEqual(await contexts(db), []);
      });
    }
    await check('reactivation is read afresh', async () => {
      await member(db, { status: 'suspended' });
      assert.deepEqual(await contexts(db), []);
      await admin(db, "UPDATE public.merchant_memberships SET status='active' WHERE id=$1", [membership]);
      assert.deepEqual(await contexts(db), [expected()]);
    });
    for (const [label, sql] of [
      ['deactivated', 'UPDATE public.terminals SET is_active=false WHERE id=$1'],
      ['transferred', `UPDATE public.terminals SET user_id='${otherOwner}' WHERE id=$1`],
      ['deleted (existing FK SET NULL)', 'DELETE FROM public.terminals WHERE id=$1']
    ]) {
      await check(`cashier loses context immediately after terminal ${label}`, async () => {
        await member(db, { role: 'cashier', terminalId: terminal });
        assert.equal((await contexts(db)).length, 1);
        await admin(db, sql, [terminal]);
        assert.deepEqual(await contexts(db), []);
      });
    }
    await check('merchant ownership transfer removes old owner and invalidates old terminal assignment', async () => {
      await member(db, { role: 'cashier', terminalId: terminal });
      assert.equal((await contexts(db, owner)).length, 1);
      await admin(db, 'UPDATE public.merchants SET user_id=$1 WHERE id=$2', [otherOwner, merchant]);
      assert.deepEqual(await contexts(db, owner), []);
      assert.deepEqual(await contexts(db), []);
      assert.equal((await contexts(db, otherOwner)).length, 2);
    });
    await check('merchant deletion cascades membership and next read returns nothing', async () => {
      await member(db);
      assert.equal((await contexts(db)).length, 1);
      await admin(db, 'DELETE FROM public.merchants WHERE id=$1', [merchant]);
      assert.deepEqual(await contexts(db), []);
    });
    await check('owner without active terminals gets typed empty array', async () => {
      await admin(db, 'UPDATE public.terminals SET is_active=false WHERE user_id=$1', [owner]);
      assert.deepEqual(await contexts(db, owner), [expected({ user: owner, source: 'ownership',
        role: 'owner', memberId: null, terminals: [] })]);
    });
    await check('authenticated RPC works while actual restrictive RLS hides direct merchant and terminal reads', async () => {
      await member(db);
      await identity(db);
      assert.deepEqual((await db.query('SELECT * FROM public.merchants')).rows, []);
      assert.deepEqual((await db.query('SELECT * FROM public.terminals')).rows, []);
      const roles = (await db.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows;
      assert.deepEqual(roles, [{ rolsuper: false, rolbypassrls: false }]);
      assert.deepEqual(await contexts(db), [expected()]);
    });
    await check('actual recursive membership policies remain installed but their helper is never invoked', async () => {
      await member(db);
      const policies = (await db.query(`SELECT qual FROM pg_policies
        WHERE tablename='merchant_memberships' ORDER BY policyname`)).rows;
      assert.equal(policies.length, 2);
      assert.ok(policies.every(p => p.qual.includes('get_merchant_role')));
      // A tripwire avoids deliberately triggering uncontrolled recursive execution.
      // Installed policy expressions remain unchanged, but any invocation now fails.
      await db.exec(`CREATE OR REPLACE FUNCTION public.get_merchant_role(p_merchant_id uuid, p_user_id uuid)
        RETURNS public.merchant_member_role LANGUAGE plpgsql STABLE SECURITY INVOKER
        SET search_path = '' AS $$ BEGIN
          RAISE EXCEPTION 'recursive policy helper invoked' USING ERRCODE='P0001';
        END $$;
        GRANT SELECT ON public.merchant_memberships TO authenticated;`);
      assert.deepEqual(await contexts(db), [expected()]);
      assert.equal((await contexts(db, owner))[0].access_source, 'ownership');
    });
    await check('PUBLIC and anon lack execute while authenticated has execute', async () => {
      const { rows } = await db.query(`SELECT
        has_function_privilege('anon','public.dashboard_access_contexts()','EXECUTE') AS anon,
        has_function_privilege('authenticated','public.dashboard_access_contexts()','EXECUTE') AS authenticated,
        EXISTS (SELECT 1 FROM pg_proc p,
          LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE p.oid='public.dashboard_access_contexts()'::regprocedure
          AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute`);
      assert.deepEqual(rows, [{ anon: false, authenticated: true, public_execute: false }]);
    });
    await check('anon cannot execute even with a forged owner claim', async () => {
      await assert.rejects(contexts(db, owner, 'anon'), { code: '42501' });
    });
    await check('authenticated missing auth.uid fails 42501, not empty onboarding contexts', async () => {
      await assert.rejects(contexts(db, null), { code: '42501' });
    });
    await check('malformed actor metadata errors rather than falling back to another identity', async () => {
      await assert.rejects(contexts(db, 'not-a-uuid'), { code: '22P02' });
    });
    await check('no client actor argument or overload permits impersonation', async () => {
      await identity(db);
      await assert.rejects(db.query('SELECT * FROM public.dashboard_access_contexts($1::uuid)', [owner]), { code: '42883' });
    });
    await check('read-only transaction permits context lookup with zero row changes including xmin', async () => {
      await member(db);
      const before = await snapshot(db);
      await contexts(db);
      await contexts(db, owner);
      assert.deepEqual(await snapshot(db), before);
      // End this case's transaction to set READ ONLY before any data access.
      await db.exec('ROLLBACK; BEGIN READ ONLY');
      assert.equal((await contexts(db, owner)).length, 1);
    });
    await check('candidate adds no direct table read/write grants to authenticated or anon', async () => {
      const { rows } = await db.query(`SELECT role, table_name,
        has_table_privilege(role,'public.' || table_name,'INSERT,UPDATE,DELETE,TRUNCATE') AS writes,
        has_table_privilege(role,'public.' || table_name,'SELECT') AS reads
        FROM (VALUES ('authenticated'),('anon')) r(role)
        CROSS JOIN (VALUES ('merchants'),('terminals'),('merchant_memberships')) t(table_name)
        ORDER BY role,table_name`);
      assert.ok(rows.every(r => !r.writes));
      assert.ok(rows.filter(r => r.role === 'anon' || r.table_name === 'merchant_memberships').every(r => !r.reads));
      assert.deepEqual(afterInstall, beforeInstall);
    });
    await check('authenticated direct membership access remains denied', async () => {
      await identity(db);
      await assert.rejects(db.query('SELECT * FROM public.merchant_memberships'), { code: '42501' });
    });
    await check('definer losing BYPASSRLS fails closed instead of returning partial or onboarding contexts', async () => {
      await member(db);
      await admin(db, 'ALTER ROLE context_definer NOBYPASSRLS');
      // Re-plan after changing role attributes: a warmed backend can retain plans
      // built under BYPASSRLS. This models a fresh installation/session; it is NOT
      // evidence of immediate role-attribute revocation in every pooled backend.
      await db.exec('DISCARD PLANS');
      await assert.rejects(contexts(db), { code: '42501' });
    });
    await check('missing membership metadata fails whole RPC even for an owner', async () => {
      await admin(db, 'ALTER TABLE public.merchant_memberships RENAME TO hidden_memberships');
      await assert.rejects(contexts(db, owner), { code: '42P01' });
    });
    await check('missing terminal metadata fails whole RPC rather than widening scope', async () => {
      await member(db);
      await admin(db, 'ALTER TABLE public.terminals RENAME COLUMN is_active TO hidden_active');
      await assert.rejects(contexts(db), { code: '42703' });
    });
    await check('definer missing metadata SELECT privilege cannot synthesize successful empty contexts', async () => {
      await member(db);
      await admin(db, 'REVOKE SELECT ON public.merchant_memberships FROM context_definer');
      await assert.rejects(contexts(db), { code: '42501' });
    });
    await check('caller search_path and temporary table names cannot shadow qualified metadata', async () => {
      await member(db);
      await db.exec(`CREATE TEMP TABLE merchants (id uuid, user_id uuid, business_name text);
        CREATE TEMP TABLE merchant_memberships (id uuid);
        CREATE TEMP TABLE terminals (id uuid);
        SET LOCAL search_path = pg_temp, public;`);
      assert.deepEqual(await contexts(db), [expected()]);
    });
    await check('dangling terminal assignment excludes every supported role without widening', async () => {
      // Corrupt fixture only: the real FK normally prevents a dangling UUID.
      await admin(db, `ALTER TABLE public.merchant_memberships
        DROP CONSTRAINT merchant_memberships_terminal_id_fkey`);
      await member(db, { terminalId: uuid(999) });
      for (const role of ['manager', 'cashier', 'viewer']) {
        await admin(db, 'UPDATE public.merchant_memberships SET role=$1 WHERE id=$2', [role, membership]);
        assert.deepEqual(await contexts(db), []);
      }
    });
    await check('unexpected revoked status and null role/status fail closed under future or damaged metadata', async () => {
      await member(db);
      await admin(db, `ALTER TABLE public.merchant_memberships
        DROP CONSTRAINT merchant_memberships_status_check,
        ALTER COLUMN status DROP NOT NULL, ALTER COLUMN role DROP NOT NULL`);
      for (const [status, role] of [['revoked', 'manager'], [null, 'manager'], ['active', null]]) {
        await admin(db, 'UPDATE public.merchant_memberships SET status=$1, role=$2 WHERE id=$3',
          [status, role, membership]);
        assert.deepEqual(await contexts(db), []);
      }
    });
    await check('committed membership revocation is visible on the next READ COMMITTED request', async () => {
      await member(db);
      assert.deepEqual(await contexts(db), [expected()]);
      await db.exec('RESET ROLE; COMMIT');
      try {
        await admin(db, "UPDATE public.merchant_memberships SET status='suspended' WHERE id=$1", [membership]);
        assert.deepEqual(await contexts(db), []);
      } finally {
        await admin(db, 'DELETE FROM public.merchant_memberships WHERE id=$1', [membership]);
        await db.exec('BEGIN');
      }
    });
  } finally {
    await db.close();
  }
});