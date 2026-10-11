const PATH = /^\/(?:app\/)?api\/v1\/checkout\/terminal\/([a-z0-9-]{3,36})\/?$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function selectTerminal(request, env, fetcher = fetch, now = Date.now()) {
  const url = new URL(request.url);
  const match = url.pathname.match(PATH);
  if (url.hostname !== 'rhnk.to' || !match) return json({ error: 'Not found' }, 404);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
  try {
    if (new URL(env.SUPABASE_URL).hostname !== 'mwaeazabpvbxqfrceogr.supabase.co') throw new Error('Invalid database target');
    const read = async (table, parameters) => {
      const target = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
      target.search = new URLSearchParams(parameters).toString();
      const response = await fetcher(target, {
        headers: { apikey: env.SUPABASE_ANON_KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000)
      });
      if (!response.ok) throw new Error('Persistence unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid persistence response');
      return rows;
    };
    const terminals = await read('terminals', {
      select: 'id,code,name', code: `eq.${match[1]}`, is_active: 'eq.true', limit: '2'
    });
    if (terminals.length === 0) return json({ error: 'Terminal not found' }, 404);
    if (terminals.length !== 1 || !UUID.test(terminals[0].id) || terminals[0].code !== match[1]) throw new Error('Ambiguous terminal');
    const terminal = { code: terminals[0].code, name: terminals[0].name || terminals[0].code };
    const orders = await read('orders', {
      select: 'id,status,total_amount,currency,expires_at', terminal_id: `eq.${terminals[0].id}`,
      status: 'in.(pending,preparing)', or: `(expires_at.is.null,expires_at.gt.${new Date(now).toISOString()})`,
      order: 'created_at.desc,id.desc', limit: '1'
    });
    let result;
    if (orders.length === 0) result = { kind: 'idle', terminal, order: null };
    else {
      const order = orders[0];
      if (!UUID.test(order.id) || !['pending', 'preparing'].includes(order.status) ||
        !Number.isFinite(order.total_amount) || order.total_amount < 0 ||
        typeof order.currency !== 'string' ||
        !(order.expires_at === null || Date.parse(order.expires_at) > now)) throw new Error('Invalid active order');
      result = { kind: 'active', terminal, order: {
        id: order.id, status: order.status, total_amount: order.total_amount,
        currency: order.currency, expires_at: order.expires_at
      } };
    }
    return request.method === 'HEAD'
      ? new Response(null, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
      : json(result);
  } catch {
    return json({ error: 'Terminal selection unavailable' }, 503);
  }
}

export default {
  fetch(request, env) {
    return selectTerminal(request, env);
  }
};