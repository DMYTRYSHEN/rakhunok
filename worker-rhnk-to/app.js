import app from '../worker/src/app.ts';

function failure(message, status = 503) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function routeApp(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.hostname !== 'rhnk.to') return failure('Not found', 404);
  const create = request.method === 'POST' && /^\/app\/api\/v1\/orders\/?$/.test(url.pathname);
  const update = request.method === 'PATCH' && /^\/app\/api\/v1\/orders\/[^/]+$/.test(url.pathname);
  const body = create || update ? await request.clone().json().catch(() => null) : null;
  if (update && body?.status === 'cancelled') return failure('Cancel invoices through Dashboard POS.', 403);
  const response = await app.fetch(request, env);
  if (!create || !response.ok) return response;
  const payload = await response.clone().json().catch(() => null);
  const original = payload?.order;
  if (original?.type !== 'table' || !original.terminal_id || !(Number(original.total_amount) > 0)) return response;
  if (original?.status === 'pending') return response;
  if (original?.status !== 'preparing' ||
    !(original.expires_at === null || Date.parse(original.expires_at) > Date.now())) {
    return failure('Created invoice is not eligible for payment.');
  }
  if (env.SUPABASE_URL !== 'https://mwaeazabpvbxqfrceogr.supabase.co' || !env.SUPABASE_ANON_KEY) {
    return failure('Invoice readiness database is not configured.');
  }
  const target = new URL('/rest/v1/orders', env.SUPABASE_URL);
  target.search = new URLSearchParams({
    id: `eq.${original.id}`, status: 'eq.preparing',
    merchant_id: `eq.${original.merchant_id}`, terminal_id: `eq.${original.terminal_id}`,
    or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`
  }).toString();
  const updatedResponse = await fetcher(new Request(target, {
    method: 'PATCH', headers: {
      apikey: env.SUPABASE_ANON_KEY, Authorization: request.headers.get('Authorization') || '',
      'Content-Type': 'application/json', Prefer: 'return=representation'
    }, body: JSON.stringify({ status: 'pending' }), signal: AbortSignal.timeout(6000)
  })).catch(() => null);
  if (!updatedResponse?.ok) return failure('Invoice created but payment readiness could not be confirmed.');
  const rows = await updatedResponse.json().catch(() => null);
  const updated = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  const invariantFields = ['id', 'merchant_id', 'entity_id', 'terminal_id', 'total_amount', 'expires_at'];
  if (updated?.status !== 'pending' || invariantFields.some(field => updated[field] !== original[field])) {
    return failure('Invoice payment readiness mismatch.');
  }
  return Response.json({ ...payload, order: updated }, {
    status: response.status, headers: { 'Cache-Control': 'no-store' }
  });
}

export default { fetch(request, env) { return routeApp(request, env); } };