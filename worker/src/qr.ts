import qrApi from '../../apps/qr/src/index.ts'

interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    }

    if (url.pathname === '/qr' || url.pathname.startsWith('/qr/')) {
      if (url.pathname === '/qr/v1/create-qr-code' || url.pathname === '/qr/v1/create-qr-code/') {
        url.pathname = url.pathname.slice('/qr'.length)
        return qrApi.fetch(new Request(url, request), {}, {} as ExecutionContext)
      }

      if (url.pathname === '/qr' || url.pathname === '/qr/') {
        url.pathname = '/qr-entry.txt'
        const response = await env.ASSETS.fetch(new Request(url, request))
        const headers = new Headers(response.headers)
        headers.set('Content-Type', 'text/html; charset=utf-8')
        return new Response(response.body, { status: response.status, headers })
      }

      url.pathname = url.pathname.slice('/qr'.length)
      return env.ASSETS.fetch(new Request(url, request))
    }

    return new Response('Not Found', { status: 404 })
  }
} satisfies ExportedHandler<Env>