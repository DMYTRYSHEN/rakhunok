const ACTIONS = new Set(['bootstrap', 'search', 'open', 'snapshot', 'elevate', 'prepare', 'commit', 'cancel', 'end', 'operation']);
const WRITE_ACTIONS = new Set(['settings.table_ttl', 'settings.business.save', 'structure.merchant.rename',
  'structure.entity.create', 'structure.entity.update', 'structure.entity.delete',
  'structure.terminal.create', 'structure.terminal.update', 'structure.terminal.delete', 'invoice.fixed.create', 'invoice.create',
  'templates.create', 'templates.update', 'templates.delete', 'templates.default']);
const MAX_BODY = 32768;
const MAX_RESPONSE = 4 * 1024 * 1024;

function json(value, status = 200) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  } });
}

async function readJson(request, limit = MAX_BODY) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('size');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body');
  return value;
}

export async function handleSupport(request, env, transport = fetch) {
  const url = new URL(request.url);
  const action = url.pathname.replace(/^\/dashboard\/api\/support\//, '');
  if (!ACTIONS.has(action) || url.search) return json({ error: 'SUPPORT_NOT_FOUND' }, 404);
  if (request.method !== 'POST') return json({ error: 'SUPPORT_METHOD' }, 405);
  if (url.origin !== env.SUPPORT_ORIGIN || request.headers.get('Origin') !== env.SUPPORT_ORIGIN ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'SUPPORT_FORBIDDEN' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    return json({ error: 'SUPPORT_CONTENT_TYPE' }, 415);
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 16384) {
    return json({ error: 'SUPPORT_AUTH_REQUIRED' }, 401);
  }
  if (!/^[a-z]{20}$/.test(env.SUPPORT_PROJECT_REF ?? '') ||
    env.SUPABASE_URL !== `https://${env.SUPPORT_PROJECT_REF}.supabase.co` ||
    !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
    return json({ error: 'SUPPORT_CONFIGURATION' }, 503);
  }
  let input;
  try { input = await readJson(request); }
  catch { return json({ error: 'SUPPORT_INVALID_INPUT' }, 400); }
  if (action === 'prepare' && !WRITE_ACTIONS.has(input.action)) {
    return json({ error: 'SUPPORT_FORBIDDEN' }, 403);
  }
  try {
    const response = await transport(`${env.SUPABASE_URL}/rest/v1/rpc/support_dispatch`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_action: action, p_input: input })
    });
    if (response.status === 401) return json({ error: 'SUPPORT_AUTH_REQUIRED' }, 401);
    if (response.status === 403) return json({ error: 'SUPPORT_FORBIDDEN' }, 403);
    if (response.status === 409) return json({ error: 'SUPPORT_CONFLICT' }, 409);
    if (response.status === 400) return json({ error: 'SUPPORT_INVALID_INPUT' }, 400);
    if (!response.ok) return json({ error: 'SUPPORT_UNAVAILABLE' }, 503);
    return json(await readJson(response, MAX_RESPONSE));
  } catch { return json({ error: 'SUPPORT_UNAVAILABLE' }, 503); }
}

export default { fetch: (request, env) => handleSupport(request, env) };