import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';

export const fixture = {
  owner: '40000000-0000-4000-8000-000000000001',
  merchant: '40000000-0000-4000-8000-000000000002',
  entity: '40000000-0000-4000-8000-000000000003',
  terminal: '40000000-0000-4000-8000-000000000004',
  order: '40000000-0000-4000-8000-000000000005'
};
export function localDatabaseUrl(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/checkout_test_[a-z0-9_]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('disposable_literal_loopback_database_required');
  }
  return value;
}
// Caller must supply a NEW disposable database. Existing schema fails closed.
export async function provision(db) {
  await db.query("do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if; end $$; create schema auth; create table auth.users(id uuid primary key)");
  const base = await readFile(new URL('../../../../core/db/schema.sql', import.meta.url), 'utf8');
  await db.query(base.slice(base.indexOf('CREATE TABLE IF NOT EXISTS merchants'), base.indexOf('CREATE TABLE IF NOT EXISTS promo_codes')));
  await db.query(await readFile(new URL('../../../supabase/migrations/20260907222910_checkout_authority.sql', import.meta.url), 'utf8'));
  // Reproduce legacy broad policies/grants before proving the hardening migration.
  await db.query("create function auth.uid() returns uuid language sql as $$ select null::uuid $$; grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on all tables in schema public to anon,authenticated");
  await db.query(base.slice(base.indexOf('-- Enable RLS'), base.indexOf('-- Seed Banks')).split('\n').filter(line => !/promo_codes|banks|webhook_logs|promo codes|active banks|webhook logs/.test(line)).join('\n'));
  await db.query(await readFile(new URL('../../../supabase/migrations/20260908010000_checkout_access_boundary.sql', import.meta.url), 'utf8'));
  await db.query(await readFile(new URL('../../../supabase/migrations/20260908020000_checkout_settlement_ledger.sql', import.meta.url), 'utf8'));
  const { owner, merchant, entity, terminal, order } = fixture;
  const iban = 'UA' + String(98n - BigInt('1'.repeat(25) + '301000') % 97n).padStart(2, '0') + '1'.repeat(25);
  await db.query('insert into auth.users values($1)', [owner]);
  await db.query("insert into merchants(id,user_id,business_name,display_name,tax_id,iban) values($1,$2,'LOCAL SYNTHETIC','LOCAL SYNTHETIC','12345678',$3)", [merchant, owner, iban]);
  await db.query("insert into business_entities(id,user_id,business_type,business_name,display_name,bank_name,tax_id,iban) values($1,$2,'fop','LOCAL SYNTHETIC','LOCAL SYNTHETIC','LOCAL','1234567890',$3)", [entity, owner, iban]);
  await db.query("insert into terminals(id,user_id,entity_id,code,name) values($1,$2,$3,'local-only','LOCAL SYNTHETIC')", [terminal, owner, entity]);
  await db.query("insert into orders(id,merchant_id,entity_id,terminal_id,order_number,total_amount,status,expires_at) values($1,$2,$3,$4,'LOCAL-ONLY',123.45,'ready',null)", [order, merchant, entity, terminal]);
  const contexts = [];
  for (const [kind, id] of [['invoice', order], ['terminal', terminal]]) {
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    await db.query("insert into checkout_private.capabilities(token_hash,kind,resource_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '1 hour')", [hash, kind, id]);
    contexts.push({ resource: { kind, id }, token, hash });
  }
  return contexts;
}