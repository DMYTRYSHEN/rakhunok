import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { handleSupport } from './support.js';

export const SUPPORT_PROJECT_REF = 'mwaeazabpvbxqfrceogr';
const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const config = {
  SUPPORT_PROJECT_REF,
  SUPABASE_URL: `https://${SUPPORT_PROJECT_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk'
};

export function createSupportApiServer(transport = fetch) {
  const server = createServer(async (incoming, outgoing) => {
    const port = server.address()?.port;
    const host = incoming.headers.host;
    const respond = (status, body) => {
      outgoing.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify(body));
    };
    if (![ `127.0.0.1:${port}`, `localhost:${port}`, 'localhost:5173', '127.0.0.1:5173' ].includes(host)) {
      respond(403, { error: 'SUPPORT_FORBIDDEN' });
      return;
    }
    if (incoming.method === 'GET' && incoming.url === '/health') {
      respond(200, { backend: 'running', projectRef: SUPPORT_PROJECT_REF, databaseVerified: false });
      return;
    }
    const origin = incoming.headers.origin;
    if (!origins.has(origin) || !incoming.url?.startsWith('/dashboard/api/support/')) {
      respond(403, { error: 'SUPPORT_FORBIDDEN' });
      return;
    }
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const request = new Request(new URL(incoming.url, origin), {
        method: incoming.method, headers,
        ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : {
          body: Readable.toWeb(incoming), duplex: 'half'
        })
      });
      const response = await handleSupport(request, { ...config, SUPPORT_ORIGIN: origin }, transport);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    } catch {
      if (!outgoing.headersSent) respond(503, { error: 'SUPPORT_UNAVAILABLE' });
      else outgoing.destroy();
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createSupportApiServer();
  server.on('error', () => {
    console.error('Support API could not bind to 127.0.0.1:8791.');
    process.exitCode = 1;
  });
  server.listen(8791, '127.0.0.1', () => {
    console.log(`Support API: http://127.0.0.1:8791; Supabase: ${SUPPORT_PROJECT_REF}; schema and operator not verified.`);
  });
}