import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { handle } from './index.ts';
import { deliverEvent } from './outbox.ts';
import { decodeChange } from '../../../apps/pay/src/lib/services/checkout-contract.ts';
import { createCheckoutSync } from '../../../apps/pay/src/lib/services/checkout-sync.ts';

const db = new PGlite();
const ids = Array.from({length:8},(_,i)=>`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [owner, merchant, entity, terminal, order, second, otherOwner, otherMerchant] = ids;
const token = 's'.repeat(43);
const hash = Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
const terminalHash = 'b'.repeat(64);
const iban = 'UA' + String(98n - BigInt('1'.repeat(25)+'301000')%97n).padStart(2,'0')+'1'.repeat(25);
const scalar = async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const read = (kind='invoice',id=order,h=hash,min=0)=>scalar('select checkout_read($1,$2,$3,$4)',[kind,id,h,min]);
const initiate = (revision,key='attempt-test',kind='invoice',id=order,h=hash,oid=order)=>scalar(
  'select checkout_initiate($1,$2,$3,$4,$5,$6)',[kind,id,h,oid,revision,key]);
const port = {
  read: p=>read(p.p_kind,p.p_id,p.p_token_hash,p.p_minimum_revision),
  initiate: p=>initiate(p.p_order_revision,p.p_idempotency_key,p.p_kind,p.p_id,p.p_token_hash,p.p_order_id)
};
before(async()=>{
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
  const base=await readFile(new URL('../../../../core/db/schema.sql',import.meta.url),'utf8');
  await db.exec(base.slice(base.indexOf('CREATE TABLE IF NOT EXISTS merchants'),base.indexOf('CREATE TABLE IF NOT EXISTS promo_codes')));
  await db.exec(await readFile(new URL('../../../supabase/migrations/20260907222910_checkout_authority.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[owner,otherOwner]);
  for(const [m,u] of [[merchant,owner],[otherMerchant,otherOwner]]) await db.query(
    `insert into merchants(id,user_id,business_name,display_name,tax_id,iban) values($1,$2,'Synthetic','Synthetic','12345678',$3)`,[m,u,iban]);
  await db.query(`insert into business_entities(id,user_id,business_type,business_name,display_name,bank_name,tax_id,iban)
    values($1,$2,'fop','Synthetic entity','Synthetic','Synthetic','1234567890',$3)`,[entity,owner,iban]);
  await db.query(`insert into terminals(id,user_id,entity_id,code,name) values($1,$2,$3,'local-table','Synthetic')`,[terminal,owner,entity]);
  await db.query(`insert into orders(id,merchant_id,entity_id,terminal_id,order_number,total_amount,status,expires_at)
    values($1,$2,$3,$4,'SYNTHETIC-1',0.01,'ready',null)`,[order,merchant,entity,terminal]);
  await db.query(`insert into checkout_private.capabilities(token_hash,kind,resource_id,expires_at)
    values($1,'invoice',$2,now()+interval '1 hour'),($3,'terminal',$4,now()+interval '1 hour')`,[hash,order,terminalHash,terminal]);
});
after(()=>db.close());
// Every case rolls back; test ordering cannot hide a failed mutation.
async function isolated(run) {
  await db.exec('begin');
  try { await run(); } finally { await db.exec('rollback'); }
}
test('money: one kopeck and maximum canonical amount stay exact',()=>isolated(async()=>{
  assert.equal((await initiate(1)).quote.amountMinor,1);
  await db.query('update orders set total_amount=99999999.99 where id=$1',[order]);
  assert.equal((await initiate(2,'maximum-money')).quote.amountMinor,9999999999);
}));
test('negative, NaN and unsupported currency never create a quote',()=>isolated(async()=>{
  for(const [amount,currency] of [['-1','UAH'],['NaN','UAH'],['1','USD']]) {
    await db.query('update orders set total_amount=$2,currency=$3 where id=$1',[order,amount,currency]);
    await db.exec('savepoint invalid_money');
    await assert.rejects(read(),/unsupported_money/);
    await db.exec('rollback to invalid_money');
  }
  assert.equal(Number(await scalar('select count(*) from checkout_private.attempts')),0);
}));
test('recipient checksum, whitespace, nine-digit tax ID, inactive entity all fail closed',()=>isolated(async()=>{
  for(const [column,value] of [['iban','UA'+'1'.repeat(27)],['business_name','   '],['tax_id','123456789'],['is_active',false]]) {
    await db.exec('savepoint bad_recipient');
    await db.query(`update business_entities set ${column}=$2 where id=$1`,[entity,value]);
    const s=(await read()).value;
    assert.equal(s.canInitiate,false);
    assert.equal((await initiate(s.revision)).kind,'not-payable');
    await db.exec('rollback to bad_recipient');
  }
}));
test('entity deletion cannot redirect a standalone invoice to merchant beneficiary',()=>isolated(async()=>{
  await db.query('update orders set terminal_id=null where id=$1',[order]);
  await db.query('delete from terminals where id=$1',[terminal]);
  await assert.rejects(db.query('delete from business_entities where id=$1',[entity]),/recipient_in_use/);
}));
test('cross-tenant order and terminal assignment is rejected',()=>isolated(async()=>{
  await assert.rejects(db.query('update orders set merchant_id=$2 where id=$1',[order,otherMerchant]),/ownership/);
}));
test('revoked and expired capabilities cannot replay receipts',()=>isolated(async()=>{
  const first=await initiate(1);
  assert.equal(first.kind,'accepted');
  await db.query('update checkout_private.capabilities set revoked_at=clock_timestamp() where token_hash=$1',[hash]);
  assert.equal((await initiate(1)).kind,'inaccessible');
  assert.equal((await read()).kind,'inaccessible');
  await db.query(`update checkout_private.capabilities set revoked_at=null,expires_at=now()-interval '1 second' where token_hash=$1`,[hash]);
  assert.equal((await initiate(1)).kind,'inaccessible');
}));
test('receipts cannot be mutated even through direct SQL',()=>isolated(async()=>{
  await initiate(1);
  await assert.rejects(db.exec(`update checkout_private.attempts set quote='{}'`),/attempt_immutable/);
}));
test('terminal A → idle → B rejects a payment binding for A',()=>isolated(async()=>{
  const a=(await read('terminal',terminal,terminalHash)).value;
  await db.query(`update orders set status='paid' where id=$1`,[order]);
  const idle=(await read('terminal',terminal,terminalHash)).value;
  assert.equal(idle.state,'idle'); assert.ok(idle.revision>a.revision);
  await db.query(`insert into orders(id,merchant_id,entity_id,terminal_id,order_number,total_amount,status,expires_at)
    values($1,$2,$3,$4,'SYNTHETIC-2',50,'ready',null)`,[second,merchant,entity,terminal]);
  const b=(await read('terminal',terminal,terminalHash)).value;
  assert.equal(b.order.id,second); assert.ok(b.revision>idle.revision);
  assert.equal((await initiate(a.order.revision,'old-binding','terminal',terminal,terminalHash,order)).kind,'conflict');
}));
test('item update/delete and delivery changes revise the owning invoice',()=>isolated(async()=>{
  await db.query(`insert into order_items(id,order_id,name) values($1,$2,'Synthetic')`,[second,order]);
  await db.query(`update order_items set quantity=2 where id=$1`,[second]);
  await db.query('delete from order_items where id=$1',[second]);
  await db.query(`insert into order_deliveries(order_id,recipient_name,recipient_phone,method,city,branch_info)
    values($1,'Synthetic','000','branch','Synthetic','Synthetic')`,[order]);
  assert.equal((await read()).value.revision,5);
}));
test('renaming terminal invalidates both aliases',()=>isolated(async()=>{
  await db.query(`update terminals set code='new-local-table' where id=$1`,[terminal]);
  const aliases=await scalar(`select aliases from checkout_private.outbox where kind='terminal' and resource_id=$1 order by revision desc limit 1`,[terminal]);
  assert.deepEqual(new Set(aliases),new Set(['local-table','new-local-table']));
}));
test('NULL ACK is rejected without releasing the valid lease',()=>isolated(async()=>{
  const [event]=await scalar('select checkout_claim_outbox(1)');
  await db.exec('savepoint invalid_ack');
  await assert.rejects(scalar('select checkout_finish_outbox($1,$2,null)',[event.id,event.claimToken]),/invalid_ack/);
  await db.exec('rollback to invalid_ack');
  assert.equal(await scalar('select checkout_finish_outbox($1,$2,true)',[event.id,event.claimToken]),true);
}));
test('expired lease cannot ACK; eighth exhausted attempt becomes dead letter',()=>isolated(async()=>{
  const [event]=await scalar('select checkout_claim_outbox(1)');
  await db.query(`update checkout_private.outbox set lease_until=now()-interval '1 second' where id=$1`,[event.id]);
  assert.equal(await scalar('select checkout_finish_outbox($1,$2,true)',[event.id,event.claimToken]),false);
  await db.query('update checkout_private.outbox set attempts=8,lease_until=null where id=$1',[event.id]);
  await scalar('select checkout_claim_outbox(1)');
  assert.ok(await scalar('select dead_at from checkout_private.outbox where id=$1',[event.id]));
}));
test('all public RPCs are denied to browser roles and granted to service role',()=>isolated(async()=>{
  for(const role of ['anon','authenticated','service_role']) for(const signature of [
    'checkout_read(text,uuid,text,bigint)','checkout_initiate(text,uuid,text,uuid,bigint,text)',
    'checkout_claim_outbox(integer)','checkout_finish_outbox(uuid,uuid,boolean)']) {
    assert.equal(await scalar('select has_function_privilege($1,$2,$3)',[role,'public.'+signature,'EXECUTE']),role==='service_role');
  }
  await db.exec('set local role anon');
  await assert.rejects(read(),/permission denied/);
}));
test('SQL rejects null kind, null order and unsafe revision bounds',()=>isolated(async()=>{
  for(const call of [()=>read(null),()=>read('invoice',order,hash,'9007199254740992'),
    ()=>initiate(1,'null-order','invoice',order,hash,null)]) {
    await db.exec('savepoint invalid_input');
    await assert.rejects(call(),/invalid_request/);
    await db.exec('rollback to invalid_input');
  }
}));
test('SQL → HTTP → sync consumes committed outbox hints and rejects stale payment binding',()=>isolated(async()=>{
  const reader={read:async({resource,minimumRevision,signal})=>{
    const res=await handle(new Request(`http://localhost/api/checkout/v1/${resource.kind}/${resource.id}/snapshot?minimumRevision=${minimumRevision}`,
      {signal,headers:{Authorization:'Bearer '+token}}),port);
    if(res.status===403) return {kind:'inaccessible'};
    if(!res.ok) throw new Error('read_unavailable');
    assert.match(res.headers.get('Cache-Control'),/no-store/);
    return {kind:'snapshot',value:await res.json()};
  }};
  const controller=createCheckoutSync({resource:{kind:'invoice',id:order},reader,clock:{now:()=>0,schedule:()=>()=>{}}});
  try {
    assert.equal(await controller.start(),true);
    assert.equal(controller.view().canInitiate,true);
    await db.query('update orders set total_amount=22 where id=$1',[order]);
    assert.equal(await controller.revalidateBeforePayment(),null);
    const event=(await db.query(`select id,kind,resource_id as "resourceId",revision::int,aliases,deleted,
      $2::text as "claimToken" from checkout_private.outbox where resource_id=$1 order by revision desc limit 1`,[order,terminal])).rows[0];
    let change;
    await deliverEvent(event,{delete:async()=>{},put:async(_key,value)=>{change=decodeChange(JSON.parse(value));}});
    // Another committed revision exercises immediate hint invalidation.
    await db.query('update orders set total_amount=23 where id=$1',[order]);
    controller.notify({...change,revision:change.revision+1});
    assert.equal(controller.view().canInitiate,false);
    await controller.refresh();
    assert.equal(controller.view().snapshot.order.amountMinor,2300);
    assert.equal(controller.view().canInitiate,true);
    await db.query('update checkout_private.capabilities set revoked_at=now() where token_hash=$1',[hash]);
    await controller.refresh();
    assert.equal(controller.view().transport,'inaccessible');
  } finally { controller.dispose(); }
}));