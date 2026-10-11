import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('Workers accepts authentication, directory and tracking transports without external requests', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'delivery-fetch-runtime-'));
	try {
		await writeFile(join(directory, 'auth.js'), stripTypeScriptTypes(await readFile(new URL('./src/lib/server/tracking/auth.ts', import.meta.url), 'utf8')));
    for (const name of ['np-api', 'carriers', 'np-details']) {
      const source = await readFile(new URL(`./src/lib/server/tracking/${name}.ts`, import.meta.url), 'utf8');
      const compiled = stripTypeScriptTypes(source).replaceAll(".ts'", ".js'");
      await writeFile(join(directory, `${name}.js`), compiled);
    }
		await writeFile(join(directory, 'probe.js'), `
import { signInWithGoogle } from './auth.js';
import { NovaPoshtaApi } from './np-api.js';
import { track } from './carriers.js';
export default {
  async test() {
    for (const carrier of ['nova_poshta', 'ukrposhta']) {
      const result = await track(carrier, '20400000000000', { UKRPOSHTA_TRACKING_TOKEN: 'mock-token' });
      if (result.trackingState !== 'rate_limited' || result.retryAfterSeconds !== 30) {
        throw new Error(carrier + ' transport failed: ' + result.trackingState);
      }
      const redirected = await track(carrier, '20400000000001', { UKRPOSHTA_TRACKING_TOKEN: 'mock-token' });
      if (redirected.trackingState !== 'provider_unavailable') throw new Error('Tracking followed redirect');
      const active = await track(carrier, '20400000000002', { UKRPOSHTA_TRACKING_TOKEN: 'mock-token' });
      if (active.trackingState !== 'active' || active.deliveryStatus !== 'ready_for_pickup') throw new Error(carrier + ' status lookup failed');
    }
    const session = await signInWithGoogle('mock.google.token', 'a'.repeat(43), {
      SUPABASE_URL:'https://provider.invalid', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock_key'
    });
    if (session.accessToken !== 'mock-access-token') throw new Error('Unexpected session');
    let rejected = false;
    try {
      await signInWithGoogle('mock.redirect.token', 'a'.repeat(43), {
        SUPABASE_URL:'https://provider.invalid', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock_key'
      });
    } catch (error) {
      if (error.code !== 'AUTH_UNAVAILABLE' || error.detail !== 'response_status') throw error;
      rejected = true;
    }
    if (!rejected) throw new Error('Redirect authorized a session');
    const client = new NovaPoshtaApi();
    const cities = await client.cities('Kyiv');
    if (cities.length !== 1 || cities[0].name !== 'Kyiv') throw new Error('City lookup failed');
    const warehouses = await client.warehouses(cities[0].ref);
    if (warehouses.length !== 1 || warehouses[0].name !== 'Warehouse 1') throw new Error('Warehouse lookup failed');
    let directoryRejected = false;
    try { await client.cities('Redirect'); } catch (error) {
      if (error.status !== 503) throw error;
      directoryRejected = true;
    }
    if (!directoryRejected) throw new Error('Directory followed redirect');
  }
};`);
		await writeFile(join(directory, 'provider.js'), `export default {async fetch(request) {
  if (request.url === 'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/with-not-found') {
    const numbers = await request.json();
    if (numbers[0] === '20400000000002') return Response.json({ found: { [numbers[0]]: [{ barcode: numbers[0], event: 21700, date: '2026-10-07T12:00:00', step: 1 }] }, notFound: [] });
    return numbers[0] === '20400000000001'
      ? new Response(null, {status:302,headers:{Location:'https://redirect.invalid'}})
      : new Response(null, {status:429,headers:{'Retry-After':'30'}});
  }
  if (request.url === 'https://api.novaposhta.ua/v2.0/json/') {
    const body = await request.json();
    if (body.modelName === 'TrackingDocumentGeneral') {
      if (body.methodProperties.Documents[0].DocumentNumber === '20400000000002') return Response.json({ success: true, data: [{ Number: '20400000000002', StatusCode: '7' }], errors: [], errorCodes: [] });
      return body.methodProperties.Documents[0].DocumentNumber === '20400000000001'
        ? new Response(null, {status:302,headers:{Location:'https://redirect.invalid'}})
        : new Response(null, {status:429,headers:{'Retry-After':'30'}});
    }
    if (body.apiKey || body.modelName !== 'Address') throw new Error('Unexpected directory request');
    if (body.methodProperties.FindByString === 'Redirect') return new Response(null, {status:302,headers:{Location:'https://redirect.invalid'}});
    const cityRef = '11111111-1111-1111-1111-111111111111';
    return Response.json({success:true,errors:[],data:body.calledMethod === 'getCities'
      ? [{Ref:cityRef,Description:'Kyiv'}]
      : [{Ref:'22222222-2222-2222-2222-222222222222',CityRef:cityRef,Description:'Warehouse 1'}]});
  }
  if (request.url !== 'https://provider.invalid/auth/v1/token?grant_type=id_token') throw new Error('Wrong endpoint');
  const body = await request.json();
  if (body.provider !== 'google' || body.nonce !== 'a'.repeat(43)) throw new Error('Wrong exchange');
  if (body.id_token === 'mock.redirect.token') return new Response(null, {status:302,headers:{Location:'https://redirect.invalid'}});
  return Response.json({access_token:'mock-access-token',token_type:'bearer',expires_in:3600,user:{id:'12345678-1234-4234-8234-123456789abc'}});
}};`);
		await writeFile(join(directory, 'config.capnp'), `
using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "probe", worker = (
      compatibilityDate = "2026-10-09",
      modules = [(name = "probe.js", esModule = embed "probe.js"), (name = "auth.js", esModule = embed "auth.js"),
        (name = "np-api.js", esModule = embed "np-api.js"), (name = "carriers.js", esModule = embed "carriers.js"),
        (name = "np-details.js", esModule = embed "np-details.js")],
      globalOutbound = "provider"
    )),
    (name = "provider", worker = (
      compatibilityDate = "2026-10-09",
      modules = [(name = "provider.js", esModule = embed "provider.js")]
    ))
  ]
);`);
		const result = spawnSync(process.execPath, [fileURLToPath(new URL('./node_modules/workerd/bin/workerd', import.meta.url)), 'test', join(directory, 'config.capnp'), 'probe'], { encoding: 'utf8' });
		assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});