import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createLocalSupportModel } from './support-local-model.mjs';

export function createLocalSupportServer({ model = createLocalSupportModel(), host = '127.0.0.1', port = 5188 } = {}) {
  const browserToken = randomUUID();
  const csrf = randomUUID();
  let queue = Promise.resolve();
  const server = createServer((request, response) => {
    const origin = `http://${host}:${server.address().port}`;
    const reply = (status, body, type = 'application/json') => {
      response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      response.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (request.headers.host !== `${host}:${server.address().port}`) return reply(403, { error: 'LOCAL_HOST_ONLY' });
    const url = new URL(request.url, origin);
    if (request.method === 'GET' && url.pathname === '/') {
      response.setHeader('Set-Cookie', `support_local=${browserToken}; HttpOnly; SameSite=Strict; Path=/`);
      return reply(200, readFileSync(new URL('./support-local.html', import.meta.url)), 'text/html');
    }
    const assets = { '/support-local.js': ['./support-local.js', 'text/javascript'], '/support-local.css': ['./support-local.css', 'text/css'],
      '/business.webp': ['../static/images/landing/graded/editorial-repair.webp', 'image/webp'] };
    if (request.method === 'GET' && assets[url.pathname]) {
      const [path, type] = assets[url.pathname];
      return reply(200, readFileSync(new URL(path, import.meta.url)), type);
    }
    const cookies = request.headers.cookie?.split(';').map(value => value.trim()) ?? [];
    if (!cookies.includes(`support_local=${browserToken}`)) return reply(403, { error: 'LOCAL_BROWSER_REQUIRED' });
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') return reply(200, { csrf, ...model.snapshot() });
    if (request.method !== 'POST' || !url.pathname.startsWith('/api/')) return reply(404, { error: 'NOT_FOUND' });
    if (request.headers.origin !== origin || request.headers['x-support-csrf'] !== csrf ||
      !request.headers['content-type']?.startsWith('application/json')) return reply(403, { error: 'LOCAL_ORIGIN_REQUIRED' });
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 16384) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      queue = queue.then(async () => {
        try {
          const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          let result;
          switch (url.pathname) {
            case '/api/open': result = await model.open(input); break;
            case '/api/snapshot': result = model.snapshot(input.sessionId); break;
            case '/api/elevate': result = model.elevate(input.sessionId, input.acknowledged); break;
            case '/api/prepare': result = model.prepare(input.sessionId, input.operation); break;
            case '/api/commit': result = model.commit(input.sessionId, input.operationId, input.acknowledged); break;
            case '/api/cancel': result = model.cancel(input.sessionId, input.operationId); break;
            case '/api/end': result = await model.end(input.sessionId); break;
            default: return reply(404, { error: 'NOT_FOUND' });
          }
          reply(200, result);
        } catch (error) {
          reply(error.code === 'REVISION_CONFLICT' ? 409 : 400, { error: error.code ?? 'LOCAL_OPERATION_FAILED' });
        }
      }).catch(() => { if (!response.headersSent) reply(500, { error: 'LOCAL_OPERATION_FAILED' }); });
    });
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const directory = join(tmpdir(), 'corex-support-local');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'state.json');
  const initial = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
  const model = createLocalSupportModel({ initial, persist: candidate => {
    writeFileSync(`${path}.tmp`, JSON.stringify(candidate), { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  } });
  const port = Number(process.env.SUPPORT_LOCAL_PORT ?? 5188);
  const server = createLocalSupportServer({ model, port });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Local synthetic support: http://127.0.0.1:${port}\nState: ${path}\nNo Supabase connection. Demo identity only; never deploy this server.`));
}