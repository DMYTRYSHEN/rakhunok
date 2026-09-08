import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { retryTransaction } from './retry.ts';

// Opt-in only. Requires a disposable local DB prepared with canonical DDL +
// checkout migration and synthetic fixtures. Never applies DDL or seeds data.
const connectionString=process.env.CHECKOUT_TEST_DATABASE_URL;
const skip=!connectionString ? 'No disposable local PostgreSQL configured: concurrency NOT verified' : false;
function config() {
  const url=new URL(connectionString);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1','[::1]'].includes(url.hostname),'literal loopback only');
  assert.match(url.pathname,/^\/checkout_test_[a-z0-9_]+$/,'dedicated disposable database required');
  assert.equal(url.search,'','connection overrides forbidden');
  const orderId=process.env.CHECKOUT_TEST_ORDER_ID;
  const hash=process.env.CHECKOUT_TEST_CAPABILITY_HASH;
  assert.match(orderId??'',/^[a-f0-9-]{36}$/);
  assert.match(hash??'',/^[a-f0-9]{64}$/);
  return {orderId,hash};
}
async function clients(run) {
  const values=config();
  const a=new pg.Client({connectionString,connectionTimeoutMillis:3000});
  const b=new pg.Client({connectionString,connectionTimeoutMillis:3000});
  const observer=new pg.Client({connectionString,connectionTimeoutMillis:3000});
  try {
    await Promise.all([a.connect(),b.connect(),observer.connect()]);
    for(const client of [a,b,observer]) await client.query("set statement_timeout='5s'; set lock_timeout='3s'");
    await run(a,b,observer,values);
  } finally {
    await Promise.allSettled([a.query('rollback'),b.query('rollback')]);
    await Promise.allSettled([a.end(),b.end(),observer.end()]);
  }
}
test('real PostgreSQL: checkout gate excludes a second transaction', {skip},()=>clients(async(a,b,observer)=>{
  await a.query('begin'); await a.query('select checkout_private.gate()');
  await b.query('begin');
  const {rows:[{pid}]}=await b.query('select pg_backend_pid() as pid');
  // pg_try_advisory_xact_lock proves cross-session exclusion without timing guesses.
  assert.equal((await b.query('select pg_try_advisory_xact_lock(742901,1) as acquired')).rows[0].acquired,false);
  assert.ok((await observer.query('select pid from pg_stat_activity where pid=$1',[pid])).rowCount);
  await a.query('commit');
  assert.equal((await b.query('select pg_try_advisory_xact_lock(742901,1) as acquired')).rows[0].acquired,true);
}));
test('real PostgreSQL: concurrent same-key initiation persists exactly one quote', {skip},()=>clients(async(a,b,_observer,{orderId,hash})=>{
  const {rows:[{value}]}=await a.query('select checkout_read($1,$2,$3,0) as value',['invoice',orderId,hash]);
  assert.equal(value.kind,'snapshot'); assert.equal(value.value.canInitiate,true,'synthetic payable fixture required');
  const key='concurrency-'+crypto.randomUUID();
  const args=['invoice',orderId,hash,orderId,value.value.order.revision,key];
  const query='select checkout_initiate($1,$2,$3,$4,$5,$6) as value';
  const results=await Promise.all([retryTransaction(()=>a.query(query,args)),retryTransaction(()=>b.query(query,args))]);
  const [first,second]=results.map(r=>r.rows[0].value);
  assert.equal(first.kind,'accepted'); assert.equal(second.kind,'accepted');
  assert.equal(first.attemptId,second.attemptId); assert.deepEqual(first.quote,second.quote);
  assert.notEqual(first.replayed,second.replayed);
  assert.equal(Number((await a.query('select count(*) from checkout_private.attempts where token_hash=$1 and idempotency_key=$2',[hash,key])).rows[0].count),1);
  // Receipt deliberately retained: immutable audit data, disposable database only.
}));
test('real PostgreSQL: competing outbox consumers cannot claim the same event', {skip},()=>clients(async(a,b)=>{
  await a.query('begin'); await b.query('begin');
  const results=await Promise.all([a.query('select checkout_claim_outbox(1) as events'),b.query('select checkout_claim_outbox(1) as events')]);
  const [left,right]=results.map(r=>r.rows[0].events);
  assert.equal(left.length,1,'at least two eligible synthetic outbox events required');
  assert.equal(right.length,1,'at least two eligible synthetic outbox events required');
  assert.notEqual(left[0].id,right[0].id);
}));

test('real PostgreSQL: legacy row-first writer aborts instead of gate deadlock', {skip},()=>clients(async(a,b,_observer,{orderId})=>{
  await a.query('begin');
  await a.query('select id from orders where id=$1 for update',[orderId]);
  await b.query('begin');
  await b.query('select checkout_private.gate()');
  const waiting=b.query('select id from orders where id=$1 for update',[orderId]);
  // Attach rejection handler before the next await; no unhandled rejection on failure.
  const completed=waiting.then(()=>true,error=>error);
  await assert.rejects(a.query('update orders set total_amount=total_amount where id=$1',[orderId]),{code:'55P03'});
  await a.query('rollback');
  assert.equal(await completed,true);
}));

test('real PostgreSQL: concurrent capability revocation cannot bypass the gate', {skip},()=>clients(async(a,b,_observer,{hash})=>{
  await a.query('begin'); await a.query('select checkout_private.gate()');
  await assert.rejects(b.query('update checkout_private.capabilities set revoked_at=clock_timestamp() where token_hash=$1',[hash]),{code:'55P03'});
  await a.query('rollback');
  await b.query('begin');
  await b.query('update checkout_private.capabilities set revoked_at=clock_timestamp() where token_hash=$1',[hash]);
  assert.equal((await b.query("select checkout_read('invoice',$1,$2,0) as value",[config().orderId,hash])).rows[0].value.kind,'inaccessible');
}));

test('real PostgreSQL: legacy public table grants are closed for both browser roles', {skip},()=>clients(async(a)=>{
  for(const role of ['anon','authenticated']) {
    await a.query('begin'); await a.query(`set local role ${role}`);
    await assert.rejects(a.query('select * from public.orders'),{code:'42501'});
    await a.query('rollback');
    for(const table of ['projects','merchants','business_entities','terminals','order_items','order_deliveries'])
      assert.equal((await a.query('select has_table_privilege($1,$2,$3) as allowed',[role,table,'SELECT'])).rows[0].allowed,false);
    assert.equal((await a.query("select has_table_privilege($1,'projects','DELETE') as allowed",[role])).rows[0].allowed,false);
  }
}));

test('real PostgreSQL: atomic items update is exact and malformed batch rolls back', {skip},()=>clients(async(a,_b,_o,{orderId})=>{
  const {rows:[{user_id,checkout_revision}]}=await a.query('select m.user_id,o.checkout_revision from orders o join merchants m on m.id=o.merchant_id where o.id=$1',[orderId]);
  await a.query('begin');
  await a.query('select checkout_replace_items($1,$2,$3,$4)',[user_id,orderId,checkout_revision,JSON.stringify([{name:'Synthetic',quantity:3,unitAmountMinor:101}])]);
  assert.equal((await a.query('select total_amount::text from orders where id=$1',[orderId])).rows[0].total_amount,'3.03');
  await a.query('rollback');
  await assert.rejects(a.query('select checkout_replace_items($1,$2,$3,$4)',[user_id,orderId,checkout_revision,JSON.stringify([{name:'Synthetic',quantity:1,unitAmountMinor:1},{name:'bad',quantity:-1,unitAmountMinor:1}])]),/invalid_item/);
  assert.equal((await a.query('select checkout_revision from orders where id=$1',[orderId])).rows[0].checkout_revision,checkout_revision);
}));

test('real PostgreSQL: attempt-bound settlement is atomic, idempotent and conflict-safe', {skip},()=>clients(async(a,_b,_o,{orderId,hash})=>{
  await a.query('begin');
  const snapshot=(await a.query("select checkout_read('invoice',$1,$2,0) as value",[orderId,hash])).rows[0].value.value;
  const attempt=(await a.query("select checkout_initiate('invoice',$1,$2,$1,$3,$4) as value",[orderId,hash,snapshot.order.revision,'settle-'+crypto.randomUUID()])).rows[0].value;
  const stamp=(await a.query('select clock_timestamp()::text as value')).rows[0].value;
  const args=['synthetic','event-1',attempt.attemptId,attempt.quote.amountMinor,'UAH',attempt.quote.recipient.iban,'reference-1',stamp];
  const sql='select checkout_record_settlement($1,$2,$3,$4,$5,$6,$7,$8) as value';
  assert.deepEqual((await a.query(sql,args)).rows[0].value,{outcome:'paid',replayed:false});
  assert.deepEqual((await a.query(sql,args)).rows[0].value,{outcome:'paid',replayed:true});
  await a.query('savepoint duplicate');
  await assert.rejects(a.query(sql,args.map((v,i)=>i===3?v+1:v)),/identity_conflict/);
  await a.query('rollback to duplicate');
  assert.equal((await a.query(sql,args.map((v,i)=>i===1?'event-2':v))).rows[0].value.outcome,'review');
  assert.equal((await a.query('select status from orders where id=$1',[orderId])).rows[0].status,'paid');
}));

test('real PostgreSQL: changed invoice settlement goes to review without marking paid', {skip},()=>clients(async(a,_b,_o,{orderId,hash})=>{
  await a.query('begin');
  const rev=(await a.query('select checkout_revision from orders where id=$1',[orderId])).rows[0].checkout_revision;
  const attempt=(await a.query("select checkout_initiate('invoice',$1,$2,$1,$3,$4) as value",[orderId,hash,rev,'review-'+crypto.randomUUID()])).rows[0].value;
  await a.query('update orders set total_amount=total_amount+1 where id=$1',[orderId]);
  const result=await a.query("select checkout_record_settlement('synthetic','changed',$1,$2,'UAH',$3,'ref',clock_timestamp()) as value",[attempt.attemptId,attempt.quote.amountMinor,attempt.quote.recipient.iban]);
  assert.equal(result.rows[0].value.outcome,'review');
  assert.equal((await a.query('select status from orders where id=$1',[orderId])).rows[0].status,'ready');
}));

test('real PostgreSQL: incomplete stored quote cannot authorize settlement', {skip},()=>clients(async(a,_b,_o,{orderId,hash})=>{
  await a.query('begin');
  const rev=(await a.query('select checkout_revision from orders where id=$1',[orderId])).rows[0].checkout_revision;
  const attempt=(await a.query("select checkout_initiate('invoice',$1,$2,$1,$3,$4) as value",[orderId,hash,rev,'malformed-source-'+crypto.randomUUID()])).rows[0].value;
  const broken=structuredClone(attempt.quote); delete broken.recipient.iban;
  const id=crypto.randomUUID();
  await a.query('insert into checkout_private.attempts(id,token_hash,idempotency_key,request,quote) values($1,$2,$3,$4,$5)',[id,hash,'malformed-'+id,JSON.stringify({}),JSON.stringify(broken)]);
  await a.query('savepoint reject_quote');
  await assert.rejects(a.query("select checkout_record_settlement('synthetic','missing-iban',$1,$2,'UAH',$3,'ref',clock_timestamp())",[id,attempt.quote.amountMinor,attempt.quote.recipient.iban]),/quote_mismatch/);
  await a.query('rollback to reject_quote');
  assert.equal((await a.query('select status from orders where id=$1',[orderId])).rows[0].status,'ready');
  assert.equal((await a.query('select count(*)::int as count from checkout_private.settlements where attempt_id=$1',[id])).rows[0].count,0);
}));

const settlementSql='select checkout_record_settlement($1,$2,$3,$4,$5,$6,$7,$8) as value';
async function settlementAttempt(client,{orderId,hash}) {
  const revision=(await client.query('select checkout_revision from orders where id=$1',[orderId])).rows[0].checkout_revision;
  const attempt=(await client.query("select checkout_initiate('invoice',$1,$2,$1,$3,$4) as value",
    [orderId,hash,revision,'regression-'+crypto.randomUUID()])).rows[0].value;
  assert.equal(attempt.kind,'accepted');
  assert.equal(attempt.replayed,false);
  return attempt;
}
async function settlementArgs(client,attempt) {
  // Keep PostgreSQL microseconds: JS Date truncation can move occurredAt before created_at.
  const stamp=(await client.query('select clock_timestamp()::text as value')).rows[0].value;
  return ['synthetic','regression-'+crypto.randomUUID(),attempt.attemptId,attempt.quote.amountMinor,
    attempt.quote.currency,attempt.quote.recipient.iban,'regression-'+crypto.randomUUID(),stamp];
}
async function settlementState(client,orderId) {
  return (await client.query(`select
    (select to_jsonb(o) from public.orders o where id=$1) as invoice,
    (select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.id),'[]'::jsonb)
      from checkout_private.resources r) as resources,
    (select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)
      from checkout_private.outbox e) as outbox`,[orderId])).rows[0];
}
async function settlementLedger(client,attemptId) {
  return (await client.query(`select provider,event_id,attempt_id,event,outcome,received_at::text
    from checkout_private.settlements where attempt_id=$1 order by provider,event_id`,[attemptId])).rows;
}
async function assertReview(client,orderId,attempt,args) {
  const before=await settlementState(client,orderId);
  assert.deepEqual(await settlementLedger(client,attempt.attemptId),[]);
  assert.deepEqual((await client.query(settlementSql,args)).rows[0].value,{outcome:'review',replayed:false});
  const ledger=await settlementLedger(client,attempt.attemptId);
  assert.equal(ledger.length,1);
  assert.equal(ledger[0].provider,args[0]);
  assert.equal(ledger[0].event_id,args[1]);
  assert.equal(ledger[0].attempt_id,attempt.attemptId);
  assert.equal(ledger[0].outcome,'review');
  assert.deepEqual((await client.query(settlementSql,args)).rows[0].value,{outcome:'review',replayed:true});
  assert.deepEqual(await settlementLedger(client,attempt.attemptId),ledger,'review replay must not rewrite audit data');
  assert.deepEqual(await settlementState(client,orderId),before,'review must not mutate invoice, revisions or outbox');
}

// Time fixtures are INSERT-only copies of a real quote; immutable receipts are never
// updated and no sleeps/short deadlines are needed. All these cases roll back.
for(const scenario of ['late-delivery','after-deadline','before-attempt']) {
  test(`real PostgreSQL: settlement ${scenario} enters immutable review`,{skip},()=>clients(async(a,_b,_o,values)=>{
    await a.query('begin');
    const original=await settlementAttempt(a,values);
    const attemptId=crypto.randomUUID();
    const {rows:[times]}=await a.query(`select
      (clock_timestamp()-interval '20 minutes')::text as created,
      (clock_timestamp()-interval '15 minutes')::text as expired,
      (clock_timestamp()-interval '16 minutes')::text as on_time,
      (clock_timestamp()-interval '14 minutes')::text as late,
      (clock_timestamp()-interval '21 minutes')::text as early`);
    const quote={...original.quote};
    if(scenario!=='before-attempt') quote.expiresAt=times.expired;
    await a.query(`insert into checkout_private.attempts(id,token_hash,idempotency_key,request,quote,created_at)
      select $1,token_hash,$2,request,$3::jsonb,$4::timestamptz from checkout_private.attempts where id=$5`,
    [attemptId,'temporal-'+attemptId,JSON.stringify(quote),times.created,original.attemptId]);
    const attempt={attemptId,quote};
    const args=await settlementArgs(a,attempt);
    args[7]=scenario==='late-delivery'?times.on_time:scenario==='after-deadline'?times.late:times.early;
    const {rows:[bounds]}=await a.query(`select $2::timestamptz>=created_at as after_creation,
      $2::timestamptz<=(quote->>'expiresAt')::timestamptz as within_deadline,
      clock_timestamp()>(quote->>'expiresAt')::timestamptz as expired
      from checkout_private.attempts where id=$1`,[attemptId,args[7]]);
    assert.deepEqual(bounds,{after_creation:scenario!=='before-attempt',within_deadline:scenario!=='after-deadline',expired:scenario!=='before-attempt'});
    await assertReview(a,values.orderId,attempt,args);
  }));
}

for(const status of ['expired','cancelled']) {
  test(`real PostgreSQL: settlement for ${status} invoice preserves financial state`,{skip},()=>clients(async(a,_b,_o,values)=>{
    await a.query('begin');
    const attempt=await settlementAttempt(a,values);
    const args=await settlementArgs(a,attempt);
    await a.query('update orders set status=$2 where id=$1',[values.orderId,status]);
    assert.equal((await a.query('select status from orders where id=$1',[values.orderId])).rows[0].status,status);
    await assertReview(a,values.orderId,attempt,args);
  }));
}

for(const mismatch of ['amount','currency','recipient']) {
  test(`real PostgreSQL: settlement ${mismatch} mismatch rejects atomically and permits corrected event`,{skip},()=>clients(async(a,_b,_o,values)=>{
    await a.query('begin');
    const attempt=await settlementAttempt(a,values);
    const args=await settlementArgs(a,attempt);
    const invalid=[...args];
    if(mismatch==='amount') invalid[3]++;
    if(mismatch==='currency') invalid[4]='USD';
    if(mismatch==='recipient') {
      const body='2'.repeat(25);
      invalid[5]='UA'+String(98n-BigInt(body+'301000')%97n).padStart(2,'0')+body;
      assert.notEqual(invalid[5],args[5],'different checksum-valid beneficiary required');
    }
    const before=await settlementState(a,values.orderId);
    await a.query('savepoint invalid_settlement');
    await assert.rejects(a.query(settlementSql,invalid),{
      code:'P0001',message:mismatch==='currency'?'checkout_invalid_settlement':'checkout_settlement_quote_mismatch'
    });
    await a.query('rollback to invalid_settlement');
    assert.deepEqual(await settlementLedger(a,attempt.attemptId),[],'rejection must not consume event identity');
    assert.deepEqual(await settlementState(a,values.orderId),before);
    assert.deepEqual((await a.query(settlementSql,args)).rows[0].value,{outcome:'paid',replayed:false});
    assert.equal((await settlementLedger(a,attempt.attemptId)).length,1);
    const {rows:[paid]}=await a.query(`select status,paid_amount*100=$2::bigint as exact_amount,
      payment_reference=$3 as exact_reference,paid_at=$4::timestamptz as exact_timestamp
      from orders where id=$1`,[values.orderId,args[3],args[6],args[7]]);
    assert.deepEqual(paid,{status:'paid',exact_amount:true,exact_reference:true,exact_timestamp:true});
  }));
}

// Independent committed invoices isolate cross-session tests from the shared
// fixture. Audit receipts intentionally remain in this disposable database.
async function committedSettlementFixture(client,values) {
  const orderId=crypto.randomUUID();
  const hash=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  await client.query('begin');
  await client.query(`insert into orders(id,merchant_id,entity_id,order_number,total_amount,status,expires_at)
    select $1,merchant_id,entity_id,$2,total_amount,'ready',null from orders where id=$3`,
  [orderId,'REG-'+orderId,values.orderId]);
  await client.query(`insert into checkout_private.capabilities(token_hash,kind,resource_id,expires_at)
    values($1,'invoice',$2,clock_timestamp()+interval '1 hour')`,[hash,orderId]);
  const attempt=await settlementAttempt(client,{orderId,hash});
  const args=await settlementArgs(client,attempt);
  await client.query('commit');
  return {orderId,attempt,args};
}

for(const scenario of ['same-event','conflicting-event','distinct-events']) {
  test(`real PostgreSQL: concurrent settlement ${scenario} records exactly one payment`,{skip},()=>clients(async(a,b,observer,values)=>{
    const {orderId,attempt,args}=await committedSettlementFixture(a,values);
    const second=[...args];
    if(scenario==='conflicting-event') second[6]='conflicting-'+crypto.randomUUID();
    if(scenario==='distinct-events') second[1]='distinct-'+crypto.randomUUID();
    const before=await settlementState(observer,orderId);
    const sessions=await Promise.all([a.query('select pg_backend_pid() as pid'),b.query('select pg_backend_pid() as pid')]);
    assert.notEqual(sessions[0].rows[0].pid,sessions[1].rows[0].pid);
    await a.query('begin');
    assert.deepEqual((await a.query(settlementSql,args)).rows[0].value,{outcome:'paid',replayed:false});
    // Deliberately overlap transactions: prove contention rather than depending
    // on Promise.all scheduling. The rejected autocommit call leaves no ledger row.
    await assert.rejects(b.query(settlementSql,second),{code:'55P03',message:'checkout_busy'});
    assert.deepEqual(await settlementLedger(observer,attempt.attemptId),[]);
    assert.deepEqual(await settlementState(observer,orderId),before,'uncommitted financial writes must remain invisible');
    await a.query('commit');
    const committed=await settlementState(observer,orderId);
    const originalLedger=await settlementLedger(observer,attempt.attemptId);
    assert.equal(originalLedger.length,1);
    assert.equal(originalLedger[0].event_id,args[1]);
    assert.equal(originalLedger[0].outcome,'paid');
    assert.equal(committed.invoice.status,'paid');
    assert.equal(committed.invoice.checkout_revision,before.invoice.checkout_revision+1);
    const {rows:[paid]}=await observer.query(`select paid_amount*100=$2::bigint as exact_amount,
      payment_reference=$3 as exact_reference,paid_at=$4::timestamptz as exact_timestamp
      from orders where id=$1`,[orderId,args[3],args[6],args[7]]);
    assert.deepEqual(paid,{exact_amount:true,exact_reference:true,exact_timestamp:true});
    const resource=committed.resources.find(r=>r.kind==='invoice' && r.id===orderId);
    assert.equal(resource.revision,committed.invoice.checkout_revision);
    const events=committed.outbox.filter(e=>e.kind==='invoice' && e.resource_id===orderId);
    assert.equal(events.length,2,'one creation and one paid notification only');
    assert.deepEqual(events.map(e=>e.revision).sort((x,y)=>x-y),[1,2]);

    const results=await Promise.allSettled([
      retryTransaction(()=>a.query(settlementSql,args)),
      retryTransaction(()=>b.query(settlementSql,second))
    ]);
    assert.equal(results[0].status,'fulfilled');
    assert.deepEqual(results[0].value.rows[0].value,{outcome:'paid',replayed:true});
    if(scenario==='conflicting-event') {
      assert.equal(results[1].status,'rejected');
      assert.equal(results[1].reason.code,'P0001');
      assert.equal(results[1].reason.message,'checkout_settlement_identity_conflict');
    } else {
      assert.equal(results[1].status,'fulfilled');
      assert.deepEqual(results[1].value.rows[0].value,
        scenario==='same-event'?{outcome:'paid',replayed:true}:{outcome:'review',replayed:false});
    }
    const ledger=await settlementLedger(observer,attempt.attemptId);
    assert.equal(ledger.length,scenario==='distinct-events'?2:1);
    assert.equal(ledger.filter(row=>row.outcome==='paid').length,1);
    assert.deepEqual(ledger.find(row=>row.event_id===args[1]),originalLedger[0],'paid audit receipt remains immutable');
    if(scenario==='distinct-events') {
      assert.equal(ledger.find(row=>row.event_id===second[1]).outcome,'review');
      assert.deepEqual((await b.query(settlementSql,second)).rows[0].value,{outcome:'review',replayed:true});
      assert.deepEqual(await settlementLedger(observer,attempt.attemptId),ledger);
    }
    assert.deepEqual(await settlementState(observer,orderId),committed,'duplicate events must not change financial state or emit again');
  }));
}