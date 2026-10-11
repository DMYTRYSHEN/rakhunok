import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { candidate, document, seller } from './fixtures.mjs';

const admin = '4917dc24-e6d9-4870-b40d-a504504d4a5b';
const customer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const merchant = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sql = await readFile(new URL('../../../supabase/migrations/20261005172522_support_customer_context.sql', import.meta.url), 'utf8');
const structureSql = await readFile(new URL('../../../supabase/migrations/20261005180732_support_cabinet_structure_snapshot.sql', import.meta.url), 'utf8');
const contactBoundarySql = await readFile(new URL('../../../supabase/migrations/20261005183402_support_snapshot_contact_boundary.sql', import.meta.url), 'utf8');
const operationsSql = await readFile(new URL('../../../supabase/migrations/20261005185746_support_structure_operations.sql', import.meta.url), 'utf8');
const detailSql = await readFile(new URL('../../../supabase/migrations/20261005215606_support_invoice_detail_snapshot.sql', import.meta.url), 'utf8');
const settingsSql = await readFile(new URL('../../../supabase/migrations/20261005222427_support_business_settings.sql', import.meta.url), 'utf8');

test('support database authorization, audited reads, isolation and revocation', { timeout: 120000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, deleted_at timestamptz, banned_until timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid, aal text, not_after timestamptz);
      create table auth.mfa_amr_claims(session_id uuid, authentication_method text, updated_at timestamptz);
      create function auth.jwt() returns jsonb language sql as $$ select current_setting('request.jwt.claims', true)::jsonb $$;
      create function auth.uid() returns uuid language sql as $$ select (auth.jwt()->>'sub')::uuid $$;
      create table public.merchants(id uuid primary key, user_id uuid, business_name text, is_active boolean, onboarding_completed boolean);
      create table public.business_settings(merchant_id uuid, owner_user_id uuid, revision integer, config jsonb);
      create table public.merchant_settings(merchant_id uuid primary key, table_order_ttl_seconds integer not null check (table_order_ttl_seconds > 0));
      create table public.business_settings_sellers(merchant_id uuid, owner_user_id uuid, entity_id uuid, seller_key text, config jsonb);
      create table public.business_entities(id uuid, user_id uuid, business_name text, iban text, tax_id text, is_active boolean);
      create table public.terminals(id uuid, user_id uuid, name text, entity_id uuid, is_active boolean);
      alter table public.business_entities add column business_type text, add column display_name text, add column bank_name text;
      alter table public.terminals add column code text, add column type text;
      create table public.business_entity_contacts(entity_id uuid primary key, user_id uuid not null,
        phone text, contact_email text, website text);
      create table public.orders(id uuid, merchant_id uuid, order_number text, type text, title text, status text,
        total_amount numeric, currency text, created_at timestamptz, expires_at timestamptz);
      alter table public.orders add column short_id text, add column description text,
        add column base_amount numeric, add column discount_amount numeric, add column delivery_fee numeric,
        add column table_number integer, add column terminal_id uuid, add column paid_at timestamptz,
        add column paid_bank_code text;
      insert into auth.users(id,email) values ('${admin}','admin@example.test'), ('${customer}','client@example.test');
      insert into auth.sessions values ('${session}','${admin}','aal2',null);
      insert into auth.mfa_amr_claims values ('${session}','totp',clock_timestamp());
      insert into public.merchants values ('${merchant}','${customer}','Client Business',true,true);
    `);
    await db.exec(sql);
    await db.exec(structureSql);
    await db.exec(contactBoundarySql);
    await db.exec(operationsSql);
    await db.exec(detailSql);
    const claims = { sub: admin, session_id: session, role: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 3600 };
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    const call = async (action, input = {}) => {
      await db.exec('set role authenticated');
      try { return (await db.query('select public.support_dispatch($1, $2::jsonb) result', [action, JSON.stringify(input)])).rows[0].result; }
      finally { await db.exec('reset role'); }
    };
    await assert.rejects(call('bootstrap'), /Support forbidden/);
    await db.exec(`insert into support_private.operators(user_id, enabled) values ('${admin}', true)`);
    assert.equal((await call('bootstrap')).actorId, admin);
    await assert.rejects(call(null), /operation unavailable/);
    for (const invalid of [{ ...claims, role: null }, { ...claims, aal: 'aal1' }, { ...claims, exp: 1 }, { ...claims, session_id: customer }]) {
      await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(invalid)]);
      await assert.rejects(call('bootstrap'), /Support forbidden/);
    }
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec(`alter table support_private.audit add constraint test_audit_unavailable check (action <> 'open')`);
    await assert.rejects(call('open', { targetId: customer, merchantId: merchant, workspace: 'sandbox', reason: 'Investigate settings' }), /test_audit_unavailable/);
    assert.equal((await db.query('select count(*)::integer count from support_private.contexts')).rows[0].count, 0);
    await db.exec('alter table support_private.audit drop constraint test_audit_unavailable');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from support_private.operators'), /permission denied/);
    await assert.rejects(db.query(`select support_private.snapshot('${customer}', '${merchant}')`), /permission denied/);
    await assert.rejects(db.query(`select support_private.snapshot_summary_v1('${customer}', '${merchant}')`), /permission denied/);
    await assert.rejects(db.query(`select support_private.dispatch_context_v1('bootstrap', '{}'::jsonb)`), /permission denied/);
    await db.exec('reset role');
    assert.equal((await call('search', { query: 'client@example.test' })).clients.length, 1);
    assert.equal((await call('search', { query: '%@example.test' })).clients.length, 0);
    for (const input of [{}, { query: null }, { query: 123 }, { query: {} }]) {
      await assert.rejects(call('search', input), /Invalid support input/);
    }
    await db.exec(`update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id='${customer}'`);
    assert.equal((await call('search', { query: 'client@example.test' })).clients.length, 0);
    await assert.rejects(call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Investigate settings' }), /Support forbidden/);
    await db.exec(`update auth.users set banned_until=null where id='${customer}'`);
    await assert.rejects(call('open', { targetId: admin, merchantId: merchant, workspace: 'live', reason: 'Investigate settings' }), /Support forbidden/);
    await db.exec(`insert into public.business_entities(id, user_id) values ('${session}', '${customer}');
      insert into public.terminals(id, user_id, entity_id) values ('${session}', '${customer}', '${session}')`);
    await db.exec(`update public.business_entities set business_type='fop', business_name='Customer entity',
      display_name='Shop', bank_name='Customer bank', iban='UA_TEST', tax_id='123', is_active=true;
      update public.terminals set name='Front desk', code='DESK', type='kasa', is_active=true;
      insert into public.business_entity_contacts values ('${session}','${customer}','+380501234567','client@example.test',null)`);
    await db.exec(`insert into public.orders(id, merchant_id, order_number, type, title, status,
      total_amount, currency, created_at, short_id, description, base_amount, discount_amount, delivery_fee, terminal_id)
      values ('${session}', '${merchant}', 'CLIENT-42', 'table', 'Customer goods', 'pending',
        120, 'UAH', clock_timestamp(), 'ABC123', 'Stored purpose', 120, 0, 0, '${session}'),
        ('${customer}', '${admin}', 'FOREIGN-42', 'fixed', 'Foreign goods', 'pending',
        999, 'UAH', clock_timestamp(), 'XYZ789', 'Foreign purpose', 999, 0, 0, null)`);
    const sandbox = await call('open', { targetId: customer, merchantId: merchant, workspace: 'sandbox', reason: 'Investigate settings' });
    const frozenInvoices = (await call('snapshot', { sessionId: sandbox.id })).data.invoices;
    assert.equal(frozenInvoices.length, 1);
    assert.equal(frozenInvoices[0].id, session);
    assert.deepEqual(frozenInvoices[0].detail, { shortId: 'ABC123', description: 'Stored purpose',
      baseAmount: 120, discountAmount: 0, deliveryFee: 0, tableNumber: null, terminalId: session,
      terminalCode: 'DESK', paidAt: null, paidBankCode: null });
    await db.exec(`update public.orders set description='Updated purpose' where id='${session}'`);
    assert.deepEqual((await call('snapshot', { sessionId: sandbox.id })).data.invoices, frozenInvoices);
    const structure = (await call('snapshot', { sessionId: sandbox.id })).data.structure;
    assert.deepEqual(structure, {
      entities: [{ id: session, businessType: 'fop', businessName: 'Customer entity', displayName: 'Shop',
        taxId: '123', bankName: 'Customer bank', iban: 'UA_TEST', isActive: true,
        phone: '+380501234567', contactEmail: 'client@example.test' }],
      terminals: [{ id: session, name: 'Front desk', code: 'DESK', type: 'kasa', entityId: session, isActive: true }]
    });
    await db.exec(`update public.terminals set name='New name'`);
    assert.deepEqual((await call('snapshot', { sessionId: sandbox.id })).data.structure, structure);
    await db.exec(`update public.business_entity_contacts set user_id='${admin}'`);
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    await assert.rejects(call('operation', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    await db.exec(`update public.business_entity_contacts set user_id='${customer}'`);
    await db.exec('delete from public.business_entity_contacts');
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    await db.exec('update support_private.operators set can_write=true');
    await assert.rejects(call('elevate', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    assert.equal((await db.query('select write_expires_at from support_private.contexts where id=$1', [sandbox.id])).rows[0].write_expires_at, null);
    await db.exec('update support_private.operators set can_write=false');
    await db.exec(`insert into public.business_entity_contacts values ('${session}','${customer}','+380501234567','client@example.test',null)`);
    assert.equal((await call('bootstrap')).context.id, sandbox.id);
    assert.ok(Date.parse(sandbox.expiresAt) <= claims.exp * 1000);
    await assert.rejects(call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Investigate settings' }), /Active support context/);
    await db.exec(`update public.merchants set business_name = 'Changed Business' where id = '${merchant}'`);
    assert.equal((await call('snapshot', { sessionId: sandbox.id })).data.merchant.name, 'Client Business');
    await db.exec(`update public.business_entities set user_id='${admin}'`);
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    await db.exec(`update public.business_entities set user_id='${customer}'; update public.terminals set user_id='${admin}'`);
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    await db.exec('delete from public.business_entities; delete from public.terminals');
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support snapshot unavailable/);
    assert.equal((await call('end', { sessionId: sandbox.id })).ended, true);
    const live = await call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Investigate settings' });
    const liveInvoices = (await call('snapshot', { sessionId: live.id })).data.invoices;
    assert.equal(liveInvoices.length, 1);
    assert.equal(liveInvoices[0].detail.description, 'Updated purpose');
    assert.equal(liveInvoices[0].detail.terminalCode, null);
    await db.exec(`alter table support_private.audit add constraint test_detail_audit check (action <> 'snapshot') not valid`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /test_detail_audit/);
    await db.exec('alter table support_private.audit drop constraint test_detail_audit');
    assert.equal((await call('snapshot', { sessionId: live.id })).data.merchant.name, 'Changed Business');
    await db.exec(`insert into public.business_entities(id,user_id) values ('${session}','${admin}');
      insert into public.terminals(id,user_id,entity_id) values ('${session}','${customer}','${session}')`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support structure unavailable/);
    await db.exec(`update public.terminals set entity_id=null`);
    const unassigned = (await call('snapshot', { sessionId: live.id })).data.structure;
    assert.equal(unassigned.entities.length, 0);
    assert.equal(unassigned.terminals[0].entityId, null);
    await db.exec(`update public.business_entities set user_id='${customer}';
      update public.business_entity_contacts set user_id='${admin}'`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support contacts unavailable/);
    await db.exec('delete from public.business_entity_contacts');
    await db.exec('delete from public.terminals; delete from public.business_entities');
    await db.exec(`insert into public.business_settings_sellers values ('${merchant}', '${customer}', '${session}', '${session}', '{}')`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support settings unavailable/);
    await db.exec(`insert into public.business_entities(id, user_id) values ('${session}', '${admin}')`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support settings unavailable/);
    await db.exec(`delete from public.business_settings_sellers; delete from public.business_entities`);
    await db.exec(`update auth.users set deleted_at=clock_timestamp() where id='${customer}'`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support forbidden/);
    await db.exec(`update auth.users set deleted_at=null, banned_until=clock_timestamp()+interval '1 hour' where id='${customer}'`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support forbidden/);
    await db.exec(`update auth.users set banned_until=null where id='${customer}'`);
    await assert.rejects(call('elevate', { sessionId: live.id }), /Support write forbidden/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from support_private.operations'), /permission denied/);
    await db.exec('reset role');
    await db.exec('update support_private.operators set can_write=true');
    const prepare = (context, nextSeconds = 3600) => call('prepare', {
      sessionId: context.id, action: 'settings.table_ttl', nextSeconds
    });
    const confirm = (context, prepared, acknowledgement = 'CHANGE_LIVE_BUSINESS') => ({
      sessionId: context.id, operationId: prepared.operationId, digest: prepared.digest, acknowledgement
    });
    const storedTtl = async () => (await db.query('select table_order_ttl_seconds from public.merchant_settings')).rows[0]?.table_order_ttl_seconds;
    await assert.rejects(prepare(live), /Support elevation required/);
    assert.deepEqual((await call('elevate', { sessionId: live.id })).capabilities, [
      'settings.table_ttl', 'structure.merchant.rename', 'structure.entity.create', 'structure.entity.update',
      'structure.entity.delete', 'structure.terminal.create', 'structure.terminal.update', 'structure.terminal.delete'
    ]);
    for (const action of ['payment.confirm', 'invoice.mark_paid', 'receipt.create', 'ledger.credit', 'webhook.replay', 'unknown.action']) {
      await assert.rejects(call(action, { sessionId: live.id }), /Support operation unavailable/);
      await assert.rejects(call('prepare', { sessionId: live.id, action, nextSeconds: 3600 }), /Invalid support operation/);
    }
    await assert.rejects(call('prepare', { sessionId: live.id, action: 'settings.table_ttl', nextSeconds: 3600, status: 'paid' }), /Invalid support input/);
    assert.equal((await db.query('select count(*)::integer count from support_private.operations')).rows[0].count, 0);
    const renamed = await call('prepare', { sessionId: live.id, action: 'structure.merchant.rename',
      fields: { businessName: 'Supported business' } });
    assert.equal(renamed.payload.targetId, customer);
    await call('commit', { sessionId: live.id, operationId: renamed.operationId, digest: renamed.digest,
      acknowledgement: 'CHANGE_LIVE_BUSINESS' });
    assert.equal((await call('snapshot', { sessionId: live.id })).data.merchant.name, 'Supported business');
    for (const invalid of [0, -1, 3600.1, '3600', null, 2147483648]) {
      await assert.rejects(prepare(live, invalid), /Invalid support/);
    }
    await assert.rejects(call('prepare', { sessionId: live.id, action: 'invoice.create', nextSeconds: 3600 }), /Invalid support operation/);
    assert.deepEqual((await call('snapshot', { sessionId: live.id })).data.tableTtl, { storedSeconds: null, effectiveSeconds: 1800 });
    const initial = await prepare(live);
    const status = (context, operationId) => call('operation', { sessionId: context.id, ...(operationId ? { operationId } : {}) });
    assert.equal((await status(live)).operation.operationId, initial.operationId);
    assert.equal((await status(live, initial.operationId)).operation.state, 'prepared');
    await assert.rejects(call('operation', { sessionId: live.id, operationId: null }), /Invalid support input/);
    await assert.rejects(call('operation', { sessionId: live.id, status: 'paid' }), /Invalid support input/);
    assert.match(initial.digest, /^[a-f0-9]{64}$/);
    assert.equal(initial.payload.previousSeconds, null);
    assert.equal(initial.payload.actorId, admin);
    assert.equal(initial.payload.targetId, customer);
    assert.ok(Date.parse(initial.expiresAt) <= Date.now() + 120000);
    await assert.rejects(call('commit', { ...confirm(live, initial), digest: '0'.repeat(64) }), /confirmation forbidden/);
    await assert.rejects(call('commit', confirm(live, initial, 'CHANGE_SANDBOX')), /confirmation forbidden/);
    await assert.rejects(call('commit', { ...confirm(live, initial), nextSeconds: 18000 }), /Invalid support input/);
    await db.exec('update support_private.operators set can_write=false');
    await assert.rejects(call('commit', confirm(live, initial)), /Support write forbidden/);
    await db.exec(`update support_private.operators set can_write=true;
      update auth.mfa_amr_claims set updated_at=clock_timestamp()-interval '6 minutes'`);
    await assert.rejects(call('commit', confirm(live, initial)), /Support write forbidden/);
    await db.exec('update auth.mfa_amr_claims set updated_at=clock_timestamp()');
    await db.exec(`alter table support_private.audit add constraint test_commit_audit check (action <> 'commit') not valid`);
    await assert.rejects(call('commit', confirm(live, initial)), /test_commit_audit/);
    assert.equal(await storedTtl(), undefined);
    assert.equal((await db.query('select state from support_private.operations where id=$1', [initial.operationId])).rows[0].state, 'prepared');
    await db.exec('alter table support_private.audit drop constraint test_commit_audit');
    const committed = await call('commit', confirm(live, initial));
    assert.equal(committed.committed, true);
    assert.equal(await storedTtl(), 3600);
    await db.exec('update public.merchant_settings set table_order_ttl_seconds=7200');
    assert.deepEqual(await call('commit', confirm(live, initial)), committed);
    assert.equal(await storedTtl(), 7200);
    await db.exec(`update support_private.operators set can_write=false;
      update auth.mfa_amr_claims set updated_at=clock_timestamp()-interval '6 minutes';
      update support_private.contexts set write_expires_at=clock_timestamp()-interval '1 second'`);
    assert.deepEqual((await status(live, initial.operationId)).operation.result, committed);
    assert.equal(await storedTtl(), 7200);
    assert.ok((await db.query("select count(*)::integer count from support_private.audit where action='operation' and operation_id=$1", [initial.operationId])).rows[0].count > 0);
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ ...claims, session_id: customer })]);
    await assert.rejects(status(live, initial.operationId), /Support forbidden/);
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.query("update support_private.contexts set expires_at=clock_timestamp()-interval '1 second' where id=$1", [live.id]);
    await assert.rejects(status(live, initial.operationId), /Support forbidden/);
    await db.query('update support_private.contexts set expires_at=$1 where id=$2', [live.expiresAt, live.id]);
    await db.exec(`update public.merchants set user_id='${admin}'`);
    await assert.rejects(status(live, initial.operationId), /Support forbidden/);
    await db.exec(`update public.merchants set user_id='${customer}'`);
    await assert.rejects(call('commit', confirm(live, initial)), /Support write forbidden/);
    await db.exec(`update support_private.operators set enabled=false`);
    await assert.rejects(status(live, initial.operationId), /Support forbidden/);
    await db.exec(`update support_private.operators set enabled=true, can_write=true;
      update auth.mfa_amr_claims set updated_at=clock_timestamp()`);
    await call('elevate', { sessionId: live.id });
    const structurePrepare = (context, action, fields) => call('prepare', { sessionId: context.id, action, fields });
    const structureCommit = async (context, action, fields) => {
      const prepared = await structurePrepare(context, action, fields);
      return call('commit', confirm(context, prepared, context.workspace === 'sandbox' ? 'CHANGE_SANDBOX' : 'CHANGE_LIVE_BUSINESS'));
    };
    const guardedName = await structurePrepare(live, 'structure.merchant.rename', { businessName: 'Must not persist' });
    await db.exec('update support_private.operators set can_write=false');
    await assert.rejects(call('commit', confirm(live, guardedName)), /Support write forbidden/);
    await db.exec(`update support_private.operators set can_write=true;
      update auth.mfa_amr_claims set updated_at=clock_timestamp()-interval '6 minutes'`);
    await assert.rejects(call('commit', confirm(live, guardedName)), /Support write forbidden/);
    await db.exec(`update auth.mfa_amr_claims set updated_at=clock_timestamp();
      update support_private.contexts set write_expires_at=clock_timestamp()-interval '1 second'`);
    await assert.rejects(call('commit', confirm(live, guardedName)), /Support elevation required/);
    await call('elevate', { sessionId: live.id });
    await call('cancel', { sessionId: live.id, operationId: guardedName.operationId });
    await assert.rejects(call('commit', confirm(live, guardedName)), /Support operation conflict/);
    const expiredName = await structurePrepare(live, 'structure.merchant.rename', { businessName: 'Expired change' });
    await db.query("update support_private.operations set expires_at=clock_timestamp()-interval '1 second' where id=$1", [expiredName.operationId]);
    await assert.rejects(call('commit', confirm(live, expiredName)), /Support operation conflict/);
    assert.equal((await db.query('select business_name from public.merchants')).rows[0].business_name, 'Supported business');
    assert.equal((await status(live, guardedName.operationId)).operation.state, 'cancelled');
    assert.equal((await status(live, expiredName.operationId)).operation.state, 'expired');
    const entityFields = { businessType: 'fop', businessName: 'Support entity', displayName: 'Store',
      taxId: '1234567890', bankName: 'Bank', iban: `UA${'1'.repeat(27)}`, phone: '+380501234567' };
    await assert.rejects(structurePrepare(live, 'structure.entity.create', { ...entityFields, user_id: admin }), /Invalid support fields/);
    await assert.rejects(structurePrepare(live, 'structure.entity.update', { ...entityFields, id: admin }), /Support item unavailable/);
    await assert.rejects(structurePrepare(live, 'structure.terminal.create', { entityId: admin, name: 'Bad', code: 'BAD', type: 'kasa' }), /Support entity unavailable/);
    await assert.rejects(structurePrepare(live, 'structure.entity.create', { ...entityFields, iban: 'invalid' }), /Invalid support entity/);
    const createdEntity = await structureCommit(live, 'structure.entity.create', entityFields);
    assert.equal((await db.query('select user_id from public.business_entities where id=$1', [createdEntity.itemId])).rows[0].user_id, customer);
    const terminalFields = { entityId: createdEntity.itemId, name: 'Support terminal', code: 'SUPPORT', type: 'kasa' };
    const createdTerminal = await structureCommit(live, 'structure.terminal.create', terminalFields);
    await assert.rejects(structurePrepare(live, 'structure.entity.delete', { id: createdEntity.itemId }), /Support entity is in use/);
    await structureCommit(live, 'structure.entity.update', { ...entityFields, id: createdEntity.itemId, displayName: 'Changed store' });
    await structureCommit(live, 'structure.terminal.update', { ...terminalFields, id: createdTerminal.itemId, name: 'Changed terminal' });
    const staleName = await structurePrepare(live, 'structure.merchant.rename', { businessName: 'Stale name' });
    await db.exec("update public.merchants set business_name='Owner change'");
    await assert.rejects(call('commit', confirm(live, staleName)), /Support operation conflict/);
    const auditedName = await structurePrepare(live, 'structure.merchant.rename', { businessName: 'Audited name' });
    await db.exec("alter table support_private.audit add constraint test_structure_audit check(action <> 'commit') not valid");
    await assert.rejects(call('commit', confirm(live, auditedName)), /test_structure_audit/);
    assert.equal((await db.query('select business_name from public.merchants')).rows[0].business_name, 'Owner change');
    await db.exec('alter table support_private.audit drop constraint test_structure_audit');
    const nameResult = await call('commit', confirm(live, auditedName));
    assert.deepEqual(await call('commit', confirm(live, auditedName)), nameResult);
    await structureCommit(live, 'structure.terminal.delete', { id: createdTerminal.itemId });
    await structureCommit(live, 'structure.entity.delete', { id: createdEntity.itemId });
    assert.equal((await db.query('select count(*)::integer count from public.business_entity_contacts')).rows[0].count, 0);
    const stale = await prepare(live, 18000);
    await db.exec('update public.merchant_settings set table_order_ttl_seconds=1800');
    await assert.rejects(call('commit', confirm(live, stale)), /Support settings conflict/);
    assert.equal(await storedTtl(), 1800);
    const cancelled = await prepare(live);
    assert.equal((await call('cancel', { sessionId: live.id, operationId: cancelled.operationId })).cancelled, true);
    await assert.rejects(call('commit', confirm(live, cancelled)), /Support operation conflict/);
    assert.equal((await status(live, cancelled.operationId)).operation.state, 'cancelled');
    const expired = await prepare(live);
    await db.query("update support_private.operations set expires_at=clock_timestamp()-interval '1 second' where id=$1", [expired.operationId]);
    await assert.rejects(call('commit', confirm(live, expired)), /Support operation conflict/);
    assert.equal((await status(live, expired.operationId)).operation.state, 'expired');
    const updated = await prepare(live, 7200);
    await call('commit', confirm(live, updated));
    assert.equal(await storedTtl(), 7200);
    await db.exec('delete from public.merchant_settings');
    const insertConflict = await prepare(live);
    await db.exec(`insert into public.merchant_settings values ('${merchant}',18000)`);
    await assert.rejects(call('commit', confirm(live, insertConflict)), /Support settings conflict/);
    const pendingOnExit = await prepare(live);
    await call('end', { sessionId: live.id });
    assert.equal((await db.query('select state from support_private.operations where id=$1', [pendingOnExit.operationId])).rows[0].state, 'cancelled');
    await assert.rejects(call('commit', confirm(live, pendingOnExit)), /Support forbidden/);
    await assert.rejects(status(live, initial.operationId), /Support forbidden/);
    const isolated = await call('open', { targetId: customer, merchantId: merchant, workspace: 'sandbox', reason: 'Investigate table lifetime' });
    assert.equal((await status(isolated)).operation, null);
    await assert.rejects(status(isolated, initial.operationId), /Support forbidden/);
    await call('elevate', { sessionId: isolated.id });
    const sandboxEntity = await structureCommit(isolated, 'structure.entity.create', entityFields);
    const sandboxTerminal = await structureCommit(isolated, 'structure.terminal.create', { ...terminalFields, entityId: sandboxEntity.itemId });
    await structureCommit(isolated, 'structure.entity.update', { ...entityFields, id: sandboxEntity.itemId, displayName: 'Sandbox store' });
    const sandboxData = (await call('snapshot', { sessionId: isolated.id })).data.structure;
    assert.equal(sandboxData.entities[0].displayName, 'Sandbox store');
    assert.equal(sandboxData.terminals[0].id, sandboxTerminal.itemId);
    assert.equal((await db.query('select count(*)::integer count from public.business_entities')).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::integer count from public.terminals')).rows[0].count, 0);
    await structureCommit(isolated, 'structure.terminal.delete', { id: sandboxTerminal.itemId });
    await structureCommit(isolated, 'structure.entity.delete', { id: sandboxEntity.itemId });
    assert.deepEqual((await call('snapshot', { sessionId: isolated.id })).data.structure, { entities: [], terminals: [] });
    const isolatedChange = await prepare(isolated, 3600);
    await assert.rejects(call('commit', confirm(isolated, initial, 'CHANGE_SANDBOX')), /Support forbidden/);
    await call('commit', confirm(isolated, isolatedChange, 'CHANGE_SANDBOX'));
    assert.equal((await call('snapshot', { sessionId: isolated.id })).data.tableTtl.effectiveSeconds, 3600);
    assert.equal(await storedTtl(), 18000);
    await call('end', { sessionId: isolated.id });
    assert.equal((await db.query('select structure_workspace from support_private.contexts where id=$1', [isolated.id])).rows[0].structure_workspace, null);
    await db.exec('drop table public.business_settings_sellers; drop table public.business_settings');
    await db.exec(candidate);
    await db.exec(settingsSql);
    await db.exec(`create table public.merchant_memberships(merchant_id uuid,user_id uuid,status text,role text);
      create function public.get_merchant_role(uuid,uuid) returns text language sql as $$ select 'owner'::text $$;`);
    for (const migration of ['20260916000000_checkout_templates.sql', '20260916170000_checkout_templates_integrity.sql',
      '20261005225205_support_checkout_templates.sql']) {
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const settingsContext = await call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Configure customer settings' });
    await db.exec(`insert into public.business_entities(id,user_id,business_type,business_name,iban,tax_id,is_active)
      values ('${session}','${customer}','fop','Customer Seller','UA123','123',true)`);
    const settingsDocument = document({ sellers: { [session]: seller() } });
    const prepareSettings = (scope, revision, value = settingsDocument) => call('prepare', {
      sessionId: scope.id, action: 'settings.business.save', fields: { revision, document: value }
    });
    await assert.rejects(prepareSettings(settingsContext, 0), /Support write forbidden/);
    await call('elevate', { sessionId: settingsContext.id });
    await assert.rejects(prepareSettings(settingsContext, 0, document({ sellers: { [admin]: seller() } })), /Support seller unavailable/);
    await assert.rejects(prepareSettings(settingsContext, 0, { ...settingsDocument, secret: 'forbidden' }), /Invalid support settings/);
    const firstSettings = await prepareSettings(settingsContext, 0);
    const firstSaved = await call('commit', confirm(settingsContext, firstSettings));
    assert.deepEqual(firstSaved.settings, { revision: 1, document: settingsDocument });
    assert.deepEqual(await call('commit', confirm(settingsContext, firstSettings)), firstSaved);
    assert.equal((await db.query('select owner_user_id from public.business_settings')).rows[0].owner_user_id, customer);
    assert.equal((await status(settingsContext, firstSettings.operationId)).operation.state, 'committed');
    await db.exec(`update public.business_entities set user_id='${admin}' where id='${session}'`);
    await assert.rejects(prepareSettings(settingsContext, 1, document({ sellers: {} })), /Support settings unavailable/);
    await db.exec(`update public.business_entities set user_id='${customer}' where id='${session}'`);
    const staleSettings = await prepareSettings(settingsContext, 1);
    await db.exec('update public.business_settings set revision=2');
    await assert.rejects(call('commit', confirm(settingsContext, staleSettings)), /revision conflict/);
    const auditSettings = await prepareSettings(settingsContext, 2);
    await db.exec("alter table support_private.audit add constraint test_settings_audit check(action<>'commit') not valid");
    await assert.rejects(call('commit', confirm(settingsContext, auditSettings)), /test_settings_audit/);
    assert.equal((await db.query('select revision from public.business_settings')).rows[0].revision, 2);
    await db.exec('alter table support_private.audit drop constraint test_settings_audit');
    await call('end', { sessionId: settingsContext.id });
    const settingsSandbox = await call('open', { targetId: customer, merchantId: merchant, workspace: 'sandbox', reason: 'Preview customer settings' });
    await call('elevate', { sessionId: settingsSandbox.id });
    const sandboxSettings = await prepareSettings(settingsSandbox, 2, { ...settingsDocument, mode: 'direct' });
    await call('commit', confirm(settingsSandbox, sandboxSettings, 'CHANGE_SANDBOX'));
    assert.equal((await call('snapshot', { sessionId: settingsSandbox.id })).data.settings.document.mode, 'direct');
    assert.equal((await db.query('select revision,config from public.business_settings')).rows[0].revision, 2);
    assert.equal((await db.query('select config from public.business_settings')).rows[0].config.mode, 'unconfigured');
    await call('end', { sessionId: settingsSandbox.id });
    assert.equal((await db.query('select settings_workspace from support_private.contexts where id=$1', [settingsSandbox.id])).rows[0].settings_workspace, null);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select support_private.dispatch_before_business_settings('bootstrap','{}')"), /permission denied/);
    await db.exec('reset role');
    let resumed = await call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Investigate settings' });
    const templateInput = { name: 'Customer template', scenario_type: 'fixed', is_default: true,
      scenario_config: Object.fromEntries(['allow_loyalty','allow_promo','allow_roundup','allow_tips',
        'allow_split','allow_bnpl','allow_upsell','allow_delivery','allow_compliance_card','allow_nps_review','show_other_banks'].map(key => [key, false])) };
    const templates = async scope => (await call('snapshot', { sessionId: scope.id })).data.templates;
    const prepareTemplate = async (scope, action, id = null, input = null) => call('prepare', {
      sessionId: scope.id, action, fields: { id, input, before: await templates(scope) }
    });
    await assert.rejects(prepareTemplate(resumed, 'templates.create', null, templateInput), /Support write forbidden/);
    await call('elevate', { sessionId: resumed.id });
    await assert.rejects(prepareTemplate(resumed, 'templates.create', null, { ...templateInput, scenario_config: {} }), /Invalid support template/);
    await assert.rejects(prepareTemplate(resumed, 'templates.create', null, { ...templateInput, merchant_id: admin }), /Invalid support template/);
    await assert.rejects(prepareTemplate(resumed, 'templates.update', admin, templateInput), /Support template unavailable/);
    const createTemplate = await prepareTemplate(resumed, 'templates.create', null, templateInput);
    const createdTemplate = await call('commit', confirm(resumed, createTemplate));
    assert.equal(createdTemplate.template.merchant_id, merchant);
    assert.equal(createdTemplate.template.name, templateInput.name);
    assert.deepEqual(await call('commit', confirm(resumed, createTemplate)), createdTemplate);
    assert.equal((await templates(resumed)).length, 1);
    const secondPrepare = await prepareTemplate(resumed, 'templates.create', null, { ...templateInput, name: 'Second', is_default: false });
    const secondTemplate = await call('commit', confirm(resumed, secondPrepare));
    const makeDefault = await prepareTemplate(resumed, 'templates.default', secondTemplate.template.id);
    await call('commit', confirm(resumed, makeDefault));
    assert.deepEqual((await templates(resumed)).filter(row => row.is_default).map(row => row.id), [secondTemplate.template.id]);
    const staleTemplate = await prepareTemplate(resumed, 'templates.update', createdTemplate.template.id, templateInput);
    await db.query('update public.checkout_templates set name=$1 where id=$2', ['Owner edit', createdTemplate.template.id]);
    await assert.rejects(call('commit', confirm(resumed, staleTemplate)), /Support templates conflict/);
    const auditTemplate = await prepareTemplate(resumed, 'templates.delete', createdTemplate.template.id);
    await db.exec("alter table support_private.audit add constraint test_template_audit check(action<>'commit') not valid");
    await assert.rejects(call('commit', confirm(resumed, auditTemplate)), /test_template_audit/);
    assert.equal((await templates(resumed)).length, 2);
    await db.exec('alter table support_private.audit drop constraint test_template_audit');
    await call('end', { sessionId: resumed.id });
    const templateSandbox = await call('open', { targetId: customer, merchantId: merchant, workspace: 'sandbox', reason: 'Preview customer templates' });
    const frozenTemplates = await templates(templateSandbox);
    await db.query('update public.checkout_templates set name=$1 where id=$2', ['Later owner edit', createdTemplate.template.id]);
    assert.deepEqual(await templates(templateSandbox), frozenTemplates);
    await call('elevate', { sessionId: templateSandbox.id });
    const sandboxTemplate = await prepareTemplate(templateSandbox, 'templates.create', null, templateInput);
    const sandboxCreated = await call('commit', confirm(templateSandbox, sandboxTemplate, 'CHANGE_SANDBOX'));
    assert.equal((await templates(templateSandbox)).length, 3);
    assert.equal((await db.query('select count(*)::integer count from public.checkout_templates')).rows[0].count, 2);
    const sandboxUpdate = await prepareTemplate(templateSandbox, 'templates.update', sandboxCreated.template.id, { ...templateInput, name: 'Sandbox update' });
    await call('commit', confirm(templateSandbox, sandboxUpdate, 'CHANGE_SANDBOX'));
    const sandboxDefault = await prepareTemplate(templateSandbox, 'templates.default', createdTemplate.template.id);
    await call('commit', confirm(templateSandbox, sandboxDefault, 'CHANGE_SANDBOX'));
    assert.deepEqual((await templates(templateSandbox)).filter(row => row.is_default).map(row => row.id), [createdTemplate.template.id]);
    const sandboxDelete = await prepareTemplate(templateSandbox, 'templates.delete', sandboxCreated.template.id);
    await call('commit', confirm(templateSandbox, sandboxDelete, 'CHANGE_SANDBOX'));
    assert.equal((await templates(templateSandbox)).length, 2);
    await call('end', { sessionId: templateSandbox.id });
    assert.equal((await db.query('select templates_workspace from support_private.contexts where id=$1', [templateSandbox.id])).rows[0].templates_workspace, null);
    resumed = await call('open', { targetId: customer, merchantId: merchant, workspace: 'live', reason: 'Continue customer templates' });
    await call('elevate', { sessionId: resumed.id });
    const liveDelete = await prepareTemplate(resumed, 'templates.delete', createdTemplate.template.id);
    await call('commit', confirm(resumed, liveDelete));
    const liveUpdate = await prepareTemplate(resumed, 'templates.update', secondTemplate.template.id, { ...templateInput, name: 'Live update' });
    await call('commit', confirm(resumed, liveUpdate));
    assert.equal((await templates(resumed))[0].name, 'Live update');
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select support_private.dispatch_before_templates('bootstrap','{}')"), /permission denied/);
    await assert.rejects(db.query(`select support_private.snapshot_before_templates('${customer}','${merchant}')`), /permission denied/);
    await db.exec('reset role');
    live.id = resumed.id;
    await assert.rejects(call('snapshot', { sessionId: live.id, targetId: admin }), /Invalid support input/);
    await db.exec(`update auth.mfa_amr_claims set updated_at = clock_timestamp() - interval '6 minutes'`);
    await assert.rejects(call('search', { query: customer }), /Fresh MFA required/);
    assert.equal((await call('end', { sessionId: sandbox.id })).ended, true);
    assert.equal((await call('end', { sessionId: sandbox.id })).ended, true);
    await assert.rejects(call('snapshot', { sessionId: sandbox.id }), /Support forbidden/);
    assert.equal((await db.query('select snapshot from support_private.contexts where id=$1', [sandbox.id])).rows[0].snapshot, null);
    await db.exec(`update public.merchants set user_id = '${admin}' where id = '${merchant}'`);
    await assert.rejects(call('snapshot', { sessionId: live.id }), /Support forbidden/);
    await db.exec(`update support_private.operators set enabled=false`);
    await assert.rejects(call('bootstrap'), /Support forbidden/);
    await db.exec(`update support_private.operators set enabled=true; update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id='${admin}'`);
    await assert.rejects(call('bootstrap'), /Support forbidden/);
    await db.exec(`update auth.users set banned_until=null; delete from auth.sessions`);
    await assert.rejects(call('bootstrap'), /Support forbidden/);
    assert.ok((await db.query('select count(*)::integer count from support_private.audit')).rows[0].count >= 8);
  } finally { await db.close(); }
});