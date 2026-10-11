interface Env {
	ASSETS: Fetcher;
	API: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (pathname === '/corex/api' || pathname.startsWith('/corex/api/')) {
			return env.API.fetch(request);
		}
		if (pathname === '/corex' || pathname.startsWith('/corex/')) {
			const response = await env.ASSETS.fetch(request);
			if (response.status === 404 && ['GET', 'HEAD'].includes(request.method) &&
				!pathname.startsWith('/corex/_app/') && !pathname.split('/').pop()?.includes('.')) {
				const entry = new URL(request.url);
				entry.pathname = '/200';
				return env.ASSETS.fetch(new Request(entry, request));
			}
			return response;
		}
		return new Response('Not Found', { status: 404 });
	}
} satisfies ExportedHandler<Env>;