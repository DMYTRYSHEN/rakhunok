import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryTransaction } from './retry.ts';
import { verifySettlement } from './settlement-auth.ts';

test('whole transaction retry is bounded and does not retry ambiguous network errors',async()=>{
  let count=0;
  assert.equal(await retryTransaction(async()=>{if(++count<3)throw {code:'55P03'};return 'ok';},async()=>{}),'ok');
  count=0; await assert.rejects(retryTransaction(async()=>{count++;throw new Error('network');},async()=>{}));assert.equal(count,1);
  count=0; await assert.rejects(retryTransaction(async()=>{count++;throw {code:'40001'};},async()=>{}));assert.equal(count,4);
});
test('settlement signature binds raw body, path and timestamp',async()=>{
  const key=crypto.getRandomValues(new Uint8Array(32));const now=Date.now();
  const body=JSON.stringify({eventId:'synthetic',attemptId:'40000000-0000-4000-8000-000000000005',amountMinor:1,currency:'UAH',iban:'UA'+'1'.repeat(27),reference:'ref',occurredAt:new Date(now).toISOString()});
  const cryptoKey=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=Buffer.from(await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(`POST\n/local/settlement\n${now}\n${body}`))).toString('hex');
  const request=(data=body,path='/local/settlement')=>new Request('http://127.0.0.1'+path,{method:'POST',headers:{'X-Settlement-Timestamp':String(now),'X-Settlement-Signature':sig},body:data});
  assert.equal((await verifySettlement(request(),key,now)).amountMinor,1);
  await assert.rejects(verifySettlement(request(body+' '),key,now),/invalid_signature/);
  await assert.rejects(verifySettlement(request(body,'/other'),key,now),/invalid_signature/);
  await assert.rejects(verifySettlement(request(),key,now+300001),/invalid_signature/);
});