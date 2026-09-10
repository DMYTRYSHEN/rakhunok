// Synthetic local integration server only. Never imports the legacy Worker.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import { createServer as createViteServer } from 'vite';
import { handle } from './index.ts';
import { retryTransaction } from './retry.ts';
import { provision, localDatabaseUrl, fixture } from './local-fixture.mjs';
import { createLocalBank, rawRequest } from './local-bank.mjs';
import { createLocalPreview } from './local-preview.mjs';

const connectionString = localDatabaseUrl(process.env.CHECKOUT_TEST_DATABASE_URL);
const pool = new pg.Pool({ connectionString, max: 5, statement_timeout: 5000, lock_timeout: 2000 });
const contexts = await provision(pool);
const bootstrap = randomBytes(32).toString('base64url');
const origin = 'http://127.0.0.1:8792';
process.env.CHECKOUT_LOCAL_HARNESS = '1';
// Attach Vite's development socket to this exact loopback HTTP server, never
// its default localhost:5174 fallback. Checkout authority still uses polling.
const server = createServer();
const vite = await createViteServer({ root: new URL('../../../apps/pay/', import.meta.url).pathname.replace(/^\/(.:)/, '$1'),
  base: '/', server: { middlewareMode: true, ws: { server, host: '127.0.0.1', clientPort: 8792 } }, appType: 'spa' });
const rpc = (name, values) => retryTransaction(async () => (await pool.query(`select ${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as value`,values)).rows[0].value);
const db = {
  read: p=>rpc('checkout_read',[p.p_kind,p.p_id,p.p_token_hash,p.p_minimum_revision]),
  initiate: p=>rpc('checkout_initiate',[p.p_kind,p.p_id,p.p_token_hash,p.p_order_id,p.p_order_revision,p.p_idempotency_key])
};
const bank = createLocalBank({ pool, contexts, db, origin, key: randomBytes(32),
  enabled: process.env.CHECKOUT_LOCAL_BANK_SIMULATOR === '1' });
const preview = createLocalPreview({ pool, db, contexts });
const streams = new Map();
const listener = new pg.Client({ connectionString });
await listener.connect();
await listener.query("create function checkout_private.local_notify() returns trigger language plpgsql as $$ begin perform pg_notify('checkout_local',json_build_object('documentType','change','schemaVersion',1,'eventId',new.id,'resource',json_build_object('kind',new.kind,'id',new.resource_id),'revision',new.revision)::text); return new; end $$; create trigger checkout_local_push after insert on checkout_private.outbox for each row execute function checkout_private.local_notify(); listen checkout_local");
listener.on('notification', async ({ payload }) => {
  try {
    const event = JSON.parse(payload);
    for (const [res, context] of streams) if (context.resource.kind===event.resource.kind && context.resource.id===event.resource.id) {
      const access = await db.read({p_kind:context.resource.kind,p_id:context.resource.id,p_token_hash:context.hash,p_minimum_revision:0});
      if (access.kind !== 'snapshot') { res.end(); continue; }
      if (res.destroyed || res.writableEnded) continue;
      if (!res.write(`data: ${JSON.stringify(event)}\n\n`)) res.destroy();
    }
  } catch { /* Invalid hints are not authority; polling recovers. */ }
});
function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });
  res.end(JSON.stringify(value));
}
function bootstrapValid(req) {
  const value = req.headers['x-local-bootstrap'];
  return typeof value==='string' && value.length===bootstrap.length && timingSafeEqual(Buffer.from(value),Buffer.from(bootstrap));
}
server.on('request', async (req,res)=>{
  try {
    // Local UI must never contact legacy APIs, remote images, frames or bank apps.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    if(req.headers.host!=='127.0.0.1:8792' || (req.headers.origin && req.headers.origin!==origin)) return reply(res,403,{error:'local_only'});
    const url=new URL(req.url,origin);
    if(url.pathname==='/__local/preview') {
      res.setHeader('Cache-Control','no-store, private, max-age=0');
      res.setHeader('Vary','Authorization');
      if(!bootstrapValid(req)) return reply(res,403,{error:'inaccessible'});
      const result=await preview.handle(rawRequest(req,url));
      res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
    }
    if(url.pathname.startsWith('/__local/bank/')) {
      if(url.pathname==='/__local/bank/deliver' && !bootstrapValid(req)) return reply(res,403,{error:'inaccessible'});
      const result=await bank.handle(rawRequest(req,url));
      res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
    }
    if(url.pathname==='/__local/session') {
      if(req.method!=='POST' || !bootstrapValid(req)) return reply(res,403,{error:'inaccessible'});
      return reply(res,200,contexts.map(({resource,token})=>({resource,token})));
    }
    if(url.pathname==='/__local/amount') {
      if(req.method!=='POST' || !bootstrapValid(req)) return reply(res,403,{error:'inaccessible'});
      const revision=req.headers['if-match'];
      if(typeof revision!=='string' || !/^[1-9][0-9]{0,15}$/.test(revision) || !Number.isSafeInteger(Number(revision))) return reply(res,400,{error:'revision_required'});
      const updated=await retryTransaction(()=>pool.query("update orders set total_amount=total_amount+1 where id=$1 and checkout_revision=$2 and status in ('pending','ready')",[fixture.order,revision]));
      return reply(res,updated.rowCount===1?200:409,{synthetic:true});
    }
    if(url.pathname==='/__local/events') {
      const bearer=req.headers.authorization?.replace(/^Bearer /,'');
      const context=contexts.find(c=>c.token===bearer);
      if(req.method!=='GET' || !context) return reply(res,403,{error:'inaccessible'});
      const access=await db.read({p_kind:context.resource.kind,p_id:context.resource.id,p_token_hash:context.hash,p_minimum_revision:0});
      if(access.kind!=='snapshot') return reply(res,403,{error:'inaccessible'});
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});
      res.write(': connected\n\n'); streams.set(res,context);
      // Short bounded subscriptions re-authorize; polling remains the recovery path.
      const timer=setTimeout(()=>res.end(),10000);
      res.on('close',()=>{clearTimeout(timer);streams.delete(res);});
      return;
    }
    if(url.pathname.startsWith('/api/')) {
      const chunks=[];let size=0;
      for await(const chunk of req) { size+=chunk.length; if(size>2048) return reply(res,413,{error:'too_large'}); chunks.push(chunk); }
      const result=await handle(new Request(url,{method:req.method,headers:req.headers,
        body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),db);
      res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
    }
    vite.middlewares(req,res,()=>reply(res,404,{error:'not_found'}));
  } catch { reply(res,503,{error:'checkout_unavailable'}); }
});
// Deliberately prints no bearer/service credentials. Bootstrap is entered through
// a local browser fragment by the operator, never query, referrer or server log.
server.listen(8792,'127.0.0.1',()=>console.log('Synthetic checkout: http://127.0.0.1:8792/ (local bootstrap available through terminal command interface)'));
// Local operator command only; not an HTTP minting endpoint.
process.stdin.setEncoding('utf8');
process.stdin.on('data', value=>{ if(value.trim()==='open') console.log(`${origin}/#local=${bootstrap}`); });
async function close() { for(const res of streams.keys()) res.end(); server.close(); await vite.close(); await listener.end(); await pool.end(); }
process.once('SIGINT',()=>{void close();});