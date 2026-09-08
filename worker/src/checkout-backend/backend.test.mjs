import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import worker, { handle } from './index.ts';
import { postgresAdapter } from './persistence.ts';
import { drainOutbox, deliverEvent } from './outbox.ts';

const db = new PGlite();
const merchant = '10000000-0000-4000-8000-000000000001';
const owner = '10000000-0000-4000-8000-000000000002';
const entity = '10000000-0000-4000-8000-000000000003';
const terminal = '10000000-0000-4000-8000-000000000004';
const order = '10000000-0000-4000-8000-000000000005';
const hash = 'a'.repeat(64);
// Synthetic checksum-valid Ukrainian IBAN; never used for a bank handoff.
const iban = digit => {
  const bban = digit.repeat(25);
  return 'UA' + String(98n - BigInt(bban + '301000') % 97n).padStart(2,'0') + bban;
};
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const read = (kind='invoice', id=order, min=0, token=hash) => scalar(
  'select public.checkout_read($1,$2,$3,$4)', [kind,id,token,min]);
const initiate = (revision, key='attempt-0001', id=order, kind='invoice', resource=order) => scalar(
  'select public.checkout_initiate($1,$2,$3,$4,$5,$6)', [kind,resource,hash,id,revision,key]);

before(async () => {
  // Actual canonical base DDL, not a hand-maintained substitute. Only auth roles
  // and uuid_generate_v4 are shimmed; no network or production credentials.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;`);
  const base = await readFile(new URL('../../../../core/db/schema.sql', import.meta.url), 'utf8');
  const start = base.indexOf('CREATE TABLE IF NOT EXISTS public.merchants');
  // Base source is checked below so schema drift fails loudly rather than skipping DDL.
  const ddlStart = start >= 0 ? start : base.search(/CREATE TABLE (?:IF NOT EXISTS )?merchants/i);
  assert.ok(ddlStart >= 0, 'canonical merchants DDL found');
  const end = base.search(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?promo_codes/i);
  assert.ok(end > ddlStart);
  await db.exec(base.slice(ddlStart,end));
  await db.exec(await readFile(new URL('../../../supabase/migrations/20260907222910_checkout_authority.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users values($1)',[owner]);
  await db.query(`insert into merchants(id,user_id,business_name,display_name,tax_id,iban) values($1,$2,'Local shop','Local shop','12345678',$3)`,
    [merchant,owner,iban('1')]);
  await db.query(`insert into projects(id,user_id,name) values($1,$2,'Local')`,[owner,owner]);
  await db.query(`insert into business_entities(id,project_id,user_id,business_type,business_name,display_name,bank_name,tax_id,iban)
    values($1,$2,$2,'fop','Local entity','Local entity','Local bank','12345678',$3)`,[entity,owner,iban('2')]);
  await db.query(`insert into terminals(id,project_id,entity_id,user_id,code,name,type)
    values($1,$2,$3,$2,'table-local','Local table','table')`,[terminal,owner,entity]);
  await db.query(`insert into orders(id,merchant_id,entity_id,terminal_id,type,order_number,title,total_amount,status,expires_at)
    values($1,$2,$3,$4,'table','LOCAL-1','Dinner',12.34,'ready',null)`,[order,merchant,entity,terminal]);
  await db.query(`insert into checkout_private.capabilities(token_hash,kind,resource_id,expires_at)
    values($1,'invoice',$2,now()+interval '1 hour')`,[hash,order]);
});
after(() => db.close());

test('database owns initial revision and no-op/tamper writes do not advance it', async () => {
  assert.equal((await read()).value.revision,1);
  await db.query('update orders set checkout_revision=900,updated_at=now() where id=$1',[order]);
  assert.equal((await read()).value.revision,1);
  await db.query('update orders set description=$2 where id=$1',[order,'Changed']);
  assert.equal((await read()).value.revision,2);
});
test('children and recipient changes advance order and current terminal revisions', async () => {
  const old = await scalar(`select revision from checkout_private.resources where kind='terminal' and id=$1`,[terminal]);
  await db.query(`insert into order_items(order_id,name,quantity,unit_price,total_price) values($1,'Item',1,12.34,12.34)`,[order]);
  assert.equal((await read()).value.revision,3);
  await db.query(`update business_entities set business_name='Changed entity' where id=$1`,[entity]);
  assert.equal((await read()).value.revision,4);
  assert.equal(Number(await scalar(`select revision from checkout_private.resources where kind='terminal' and id=$1`,[terminal])),Number(old)+2);
});
test('minimum revision and capability scope fail closed', async () => {
  assert.equal((await read('invoice',order,999)).kind,'lag');
  assert.equal((await read('terminal',terminal)).kind,'inaccessible');
  assert.equal((await read('invoice',order,0,'b'.repeat(64))).kind,'inaccessible');
});
test('payment quote is committed, immutable and idempotent', async () => {
  const first = await initiate(4);
  assert.equal(first.kind,'accepted');
  assert.equal(first.quote.amountMinor,1234);
  assert.equal(first.quote.recipient.name,'Changed entity');
  assert.equal((await initiate(4)).attemptId,first.attemptId);
  assert.equal((await initiate(3)).kind,'conflict');
  await db.query('update orders set total_amount=20 where id=$1',[order]);
  assert.equal((await initiate(4)).quote.amountMinor,1234);
  assert.equal((await initiate(4,'attempt-stale')).kind,'conflict');
});
test('preparing positive amounts cannot initiate', async () => {
  await db.query(`update orders set status='preparing' where id=$1`,[order]);
  const snapshot = (await read()).value;
  assert.equal(snapshot.state,'preparing');
  assert.equal(snapshot.canInitiate,false);
  assert.equal((await initiate(snapshot.revision,'attempt-preparing')).kind,'not-payable');
});
test('expiry is a persisted revision transition and terminal becomes idle', async () => {
  await db.query(`update orders set status='ready',expires_at=now()-interval '1 second' where id=$1`,[order]);
  const revision = Number(await scalar('select checkout_revision from orders where id=$1',[order]));
  const snapshot = (await read()).value;
  assert.equal(snapshot.state,'expired');
  assert.equal(snapshot.revision,revision+1);
  assert.equal((await read()).value.revision,snapshot.revision);
  assert.equal(await scalar(`select current_order_id from checkout_private.resources where kind='terminal' and id=$1`,[terminal]),null);
});
test('transaction rollback also rolls back revision and outbox', async () => {
  const before = await scalar('select count(*) from checkout_private.outbox');
  await db.exec('begin');
  await db.query(`update orders set title='Rolled back' where id=$1`,[order]);
  await db.exec('rollback');
  assert.equal(await scalar('select count(*) from checkout_private.outbox'),before);
});
test('outbox claim lease uses fenced acknowledgement and retry', async () => {
  const events = await scalar('select public.checkout_claim_outbox(1)');
  assert.equal(events.length,1);
  const e=events[0];
  assert.equal(await scalar('select public.checkout_finish_outbox($1,$2,true)',[e.id,order]),false);
  assert.equal(await scalar('select public.checkout_finish_outbox($1,$2,false)',[e.id,e.claimToken]),true);
  assert.equal(await scalar('select public.checkout_finish_outbox($1,$2,true)',[e.id,e.claimToken]),false);
});
test('new private tables and RPCs reject anonymous access', async () => {
  assert.equal(await scalar(`select has_function_privilege('anon','public.checkout_read(text,uuid,text,bigint)','EXECUTE')`),false);
  assert.equal(await scalar(`select has_schema_privilege('anon','checkout_private','USAGE')`),false);
});
test('deletion retains a tombstone and forbids identity reuse', async () => {
  await db.query('delete from orders where id=$1',[order]);
  assert.equal((await read()).kind,'inaccessible');
  assert.equal(await scalar(`select deleted from checkout_private.resources where kind='invoice' and id=$1`,[order]),true);
  await assert.rejects(db.query(`insert into orders(id,merchant_id,type,order_number,total_amount) values($1,$2,'fixed','REUSE',1)`,[order,merchant]),/identity_reuse/);
});

test('local Worker blocks production and remote database configuration', async () => {
  assert.throws(()=>postgresAdapter('https://example.supabase.co','secret'),/local_only/);
  const r=await worker.fetch(new Request('https://rakhunok.com/api/checkout/v1/invoice/'+order+'/snapshot'),{});
  assert.equal(r.status,503);
  assert.match(r.headers.get('Cache-Control'),/no-store/);
});
test('HTTP endpoint rejects recipient and amount overrides before persistence', async () => {
  const r=await handle(new Request('http://localhost/api/checkout/v1/invoice/'+order+'/attempts',{
    method:'POST',headers:{Authorization:'Bearer '+'a'.repeat(43),'Content-Type':'application/json','Idempotency-Key':'attempt-123'},
    body:JSON.stringify({orderId:order,orderRevision:1,amount:1})
  }),{initiate(){throw new Error('must not call');}});
  assert.equal(r.status,400);
});
test('adapter POST bypasses caches and does not follow redirects or fallback', async () => {
  let calls=0;
  const adapter=postgresAdapter('http://127.0.0.1:54321','local-key',async(url,init)=>{
    calls++; assert.equal(init.method,'POST'); assert.equal(init.cache,'no-store');
    assert.equal(init.redirect,'error'); return new Response('{}',{status:503});
  });
  await assert.rejects(adapter.read({}),/unavailable/);
  assert.equal(calls,1);
});
test('outbox cache failure retries; delayed revisions never overwrite latest', async () => {
  const e={id:order,kind:'invoice',resourceId:order,revision:3,aliases:['old','new'],deleted:false,claimToken:terminal};
  const keys=[];
  await deliverEvent(e,{delete:async k=>keys.push(k),put:async k=>keys.push(k)});
  assert.ok(keys.some(k=>k.endsWith('alias:old')));
  assert.ok(keys.some(k=>k.endsWith('revision:3')));
  assert.ok(!keys.some(k=>k.endsWith('latest')));
  let finished;
  const result=await drainOutbox({claim:async()=>[e],finish:async(_id,_token,ok)=>(finished=ok,true)},
    {delete:async()=>{throw new Error('cache down');},put:async()=>{}});
  assert.equal(finished,false); assert.equal(result.failed,1);
});