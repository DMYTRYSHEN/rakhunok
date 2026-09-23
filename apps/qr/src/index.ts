import { parseQueryParams } from './params.ts';
import { generateQrMatrix } from './matrix.ts';
import { renderA2Svg } from './renderer-a2.ts';
import { convertSvgToPng } from './png.ts';

export interface Env {}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store'
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/health/') {
      if (request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }
      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: {
          ...SECURITY_HEADERS,
          'Allow': 'GET, HEAD',
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    // Main QR endpoint: /v1/create-qr-code/ or /v1/create-qr-code
    const isQrEndpoint = url.pathname === '/v1/create-qr-code' || url.pathname === '/v1/create-qr-code/';

    if (isQrEndpoint) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: {
            ...SECURITY_HEADERS,
            'Allow': 'GET, HEAD',
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }

      // Validate parameters
      const validation = parseQueryParams(url);
      if (!validation.ok) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: validation.status,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }

      const params = validation.params;

      try {
        // Step 1: Generate QR Matrix
        const matrix = generateQrMatrix(params.data, params.ecc);

        // Step 2: Render A2 SVG
        const svgString = renderA2Svg(matrix, params);

        if (params.format === 'svg') {
          if (request.method === 'HEAD') {
            return new Response(null, {
              status: 200,
              headers: {
                ...SECURITY_HEADERS,
                'Content-Type': 'image/svg+xml; charset=utf-8'
              }
            });
          }

          return new Response(svgString, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'image/svg+xml; charset=utf-8'
            }
          });
        }

        // Step 3: Render PNG via WASM
        const pngBytes = await convertSvgToPng(svgString, params.size);

        if (request.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'image/png',
              'Content-Length': pngBytes.byteLength.toString()
            }
          });
        }

        return new Response(pngBytes.buffer as ArrayBuffer, {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'image/png',
            'Content-Length': pngBytes.byteLength.toString()
          }
        });
      } catch (err: unknown) {
        // Handle capacity or encoding errors
        const errMsg = err instanceof Error ? err.message : '';
        if (errMsg.toLowerCase().includes('too big') || errMsg.toLowerCase().includes('overflow') || errMsg.toLowerCase().includes('amount of data')) {
          return new Response(JSON.stringify({ error: 'Cannot encode data into QR with chosen ECC level: payload exceeds capacity' }), {
            status: 422,
            headers: {
              ...SECURITY_HEADERS,
              'Content-Type': 'application/json; charset=utf-8'
            }
          });
        }

        // Generic 500 error without exposing stack or data
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }
    }

    // Default 404 for unknown paths
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
};
