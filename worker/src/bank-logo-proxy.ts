interface BankLogoProxyEnv {
	BANK_LOGOS_BUCKET?: R2Bucket;
}

export async function handleBankLogoProxy(request: Request, env: BankLogoProxyEnv, ctx: ExecutionContext, code: string): Promise<Response> {
	if (!env.BANK_LOGOS_BUCKET) return new Response('R2 bucket not configured', { status: 503 });
	
	const url = new URL(request.url);
	const originalUrl = url.searchParams.get('url');

	const r2Key = `${code}.jpg`;
	const cached = await env.BANK_LOGOS_BUCKET.get(r2Key);
	
	if (cached) {
		const headers = new Headers();
		cached.writeHttpMetadata(headers);
		headers.set('Cache-Control', 'public, max-age=31536000');
		headers.set('etag', cached.httpEtag);
		headers.set('X-R2-Cache', 'HIT');
		return new Response(cached.body, { headers });
	}

	if (!originalUrl) return new Response('Logo not found and no source URL provided', { status: 404 });

	// Fetch original
	const res = await fetch(originalUrl, { cf: { cacheEverything: true, cacheTtl: 86400 } });
	if (!res.ok) return new Response('Original image fetch failed', { status: 502 });

	const contentType = res.headers.get('content-type') || 'image/jpeg';
	
	// Clone response and put to R2 in background
	const responseBody = res.clone().body;
	if (responseBody) {
		ctx.waitUntil(env.BANK_LOGOS_BUCKET.put(r2Key, responseBody, {
			httpMetadata: { contentType }
		}));
	}

	// Return to user
	const headers = new Headers(res.headers);
	headers.set('Cache-Control', 'public, max-age=31536000');
	headers.set('X-R2-Cache', 'MISS');
	return new Response(res.body, { status: 200, headers });
}
