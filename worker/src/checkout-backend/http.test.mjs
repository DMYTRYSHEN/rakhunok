import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handle } from './index.ts';
import { postgresAdapter } from './persistence.ts';
import { decodeAccepted, decodeOutboxEvent } from './validation.ts';
import { deliverEvent } from './outbox.ts';
import { decodeChange } from '../../../apps/pay/src/lib/services/checkout-contract.ts';

const id='30000000-0000-4000-8000-000000000001';
const url=`http://127.0.0.1/api/checkout/v1/invoice/${id}`;
const headers={Authorization:'Bearer '+'a'.repeat(43),'Content-Type':'application/json','Idempotency-Key':'attempt-http'};
const request=(body={orderId:id,orderRevision:1},extra={})=>new Request(url+'/attempts',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
const iban='UA'+String(98n-BigInt('1'.repeat(25)+'301000')%97n).padStart(2,'0')+'1'.repeat(25);
const accepted=()=>({kind:'accepted',attemptId:id,replayed:false,quote:{orderId:id,orderRevision:1,amountMinor:1,currency:'UAH',
  recipient:{iban,name:'Synthetic',taxId:'12345678'},purpose:'Synthetic',expiresAt:'2026-09-08T00:00:00Z'}});
test('full local entry point permits minimumRevision query before database access',async()=>{
  // Unauthorized request must reach routing and return 403, not query-guard 503.
  const res=await worker.fetch(new Request(url+'/snapshot?minimumRevision=5'),{
    CHECKOUT_MODE:'local',CHECKOUT_DATABASE_URL:'http://127.0.0.1:54321',CHECKOUT_DATABASE_SERVICE_KEY:'synthetic-local'});
  assert.equal(res.status,403);
});
test('strict accepted quote binding rejects malformed money, recipient and extra data',()=>{
  assert.equal(decodeAccepted(accepted(),id,1).quote.amountMinor,1);
  for(const mutate of [v=>v.quote.amountMinor=0,v=>v.quote.amountMinor=1.1,v=>v.quote.orderRevision=2,
    v=>v.quote.recipient.iban='UA'+'1'.repeat(27),v=>v.quote.recipient.taxId='123456789',
    v=>v.secret='leak',v=>v.quote.secret='leak',v=>v.replayed='true']) {
    const value=accepted(); mutate(value); assert.throws(()=>decodeAccepted(value,id,1));
  }
});
test('HTTP never passes through arbitrary accepted JSON or prototype error variants',async()=>{
  await assert.rejects(handle(request(),{initiate:async()=>({...accepted(),secret:'must-not-leak'})}),/invalid_attempt/);
  await assert.rejects(handle(request(),{initiate:async()=>({kind:'toString'})}),/invalid_persistence_result/);
  const response=await handle(request(),{initiate:async()=>accepted()});
  assert.equal(response.status,201); assert.deepEqual(await response.json(),accepted());
});
test('malformed bodies, media type, unsafe revisions and oversized streams fail before RPC',async()=>{
  const db={initiate:()=>{throw new Error('unexpected_rpc');}};
  for(const [body,status] of [[[],400],[null,400],[{orderId:id,orderRevision:0},400],
    [{orderId:id,orderRevision:9007199254740992},400],[{orderId:id,orderRevision:1,padding:'x'.repeat(3000)},413]]) {
    assert.equal((await handle(request(body),db)).status,status);
  }
  assert.equal((await handle(request(undefined,{'Content-Type':'application/jsonbad'}),db)).status,400);
});
test('minimum revision, resource and cache authority validated at HTTP boundary',async()=>{
  const snapshot={documentType:'snapshot',schemaVersion:1,resource:{kind:'invoice',id},revision:1,source:'authoritative',
    observedAt:'2026-09-08T00:00:00Z',state:'payable',order:{id,revision:1,amountMinor:1,currency:'UAH',expiresAt:null},canInitiate:true};
  const req=()=>new Request(url+'/snapshot?minimumRevision=2',{headers});
  await assert.rejects(handle(req(),{read:async()=>({kind:'snapshot',value:snapshot})}),/invalid_snapshot/);
  assert.equal((await handle(new Request(url+'/snapshot?minimumRevision=2&minimumRevision=3',{headers}),{})).status,400);
});
test('bounded adapter rejects oversized responses, invalid claims and nonboolean ACKs',async()=>{
  const adapter=value=>postgresAdapter('http://127.0.0.1:54321','synthetic',async()=>Response.json(value));
  await assert.rejects(adapter('x'.repeat(70000)).read({}),/too_large/);
  await assert.rejects(adapter([{id}]).claim(),/invalid_event/);
  await assert.rejects(adapter('true').finish(id,id,true),/invalid_ack/);
});
test('outbox producer matches exact Change contract including tombstone hints',async()=>{
  const event={id,kind:'invoice',resourceId:id,revision:2,aliases:['old'],deleted:true,claimToken:id};
  let change;
  await deliverEvent(event,{delete:async()=>{},put:async(_k,v)=>{change=decodeChange(JSON.parse(v));}});
  assert.equal(change.revision,2);
  assert.equal(Object.hasOwn(change,'deleted'),false);
  assert.throws(()=>decodeOutboxEvent({...event,claimToken:'bad'}));
  assert.throws(()=>decodeOutboxEvent({...event,aliases:[{}]}));
});