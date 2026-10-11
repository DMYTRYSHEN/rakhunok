import { simulateSandboxPayment } from './sandbox.ts';

interface Env {
	ASSETS: Fetcher;
	API?: Fetcher;
	TELEGRAM?: Fetcher;
	ONBOARDING?: Fetcher;
}

function isDashboardPath(pathname: string): boolean {
	return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isDashboardApiPath(pathname: string): boolean {
	return pathname === '/dashboard/api' || pathname.startsWith('/dashboard/api/');
}

function isDashboardAsset(pathname: string): boolean {
	return (
		pathname === '/dashboard/_app' ||
		pathname.startsWith('/dashboard/_app/') ||
		pathname.startsWith('/_app/') ||
		pathname === '/favicon.ico'
	);
}

function json(data: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set('Cache-Control', 'no-store');
	return Response.json(data, { ...init, headers });
}

async function routeSandboxRequest(request: Request, pathname: string): Promise<Response> {
	if (pathname !== '/dashboard/api/sandbox/simulate') {
		return json({ error: 'Sandbox endpoint not found.' }, { status: 404 });
	}
	if (request.method !== 'POST') {
		return json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
	}

	return json(await simulateSandboxPayment());
}

export async function routeDashboardRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (url.origin === 'https://letsrealtalk.com' && url.pathname === '/dashboard' &&
		(request.method === 'GET' || request.method === 'HEAD')) {
		url.pathname = '/dashboard/';
		return new Response(null, {
			status: 307,
			headers: { Location: url.href, 'Cache-Control': 'no-store' }
		});
	}

	if (url.pathname.startsWith('/dashboard/api/sandbox/')) {
		return routeSandboxRequest(request, url.pathname);
	}

	if (isDashboardApiPath(url.pathname)) {
		if (url.origin === 'https://letsrealtalk.com' &&
			url.pathname === '/dashboard/api/v1/merchant/onboarding') {
			if (request.method !== 'POST') {
				return json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
			}
			if (!env.ONBOARDING) {
				return json({ error: 'Onboarding unavailable.' }, { status: 503 });
			}
			url.pathname = '/api/v1/merchant/onboarding';
			try {
				return await env.ONBOARDING.fetch(new Request(url, request));
			} catch {
				return json({ error: 'Onboarding unavailable.' }, { status: 503 });
			}
		}
		if (url.origin === 'https://letsrealtalk.com' &&
			['/dashboard/api/v1/telegram/invoices/preview', '/dashboard/api/v1/telegram/invoices/send'].includes(url.pathname)) {
			if (!env.TELEGRAM) {
				return json({ ok: false, error: 'self_test_unavailable' }, { status: 503 });
			}
			url.pathname = url.pathname.slice('/dashboard'.length);
			try {
				return await env.TELEGRAM.fetch(new Request(url, request));
			} catch {
				// A dispatched send may have reached Telegram. Never retry or fall back.
				return json({ ok: false, error: url.pathname.endsWith('/send')
					? 'delivery_unknown' : 'verification_unavailable' }, { status: 503 });
			}
		}
		if (!env.API) {
			return Response.json({ error: 'Dashboard API is unavailable.' }, { status: 503 });
		}
		url.pathname = url.pathname.slice('/dashboard'.length);
		return env.API.fetch(new Request(url, request));
	}

	if (isDashboardAsset(url.pathname)) {
		if (url.pathname === '/dashboard/_app' || url.pathname.startsWith('/dashboard/_app/')) {
			url.pathname = url.pathname.slice('/dashboard'.length);
			return env.ASSETS.fetch(new Request(url, request));
		}
		return env.ASSETS.fetch(request);
	}

	if (isDashboardPath(url.pathname)) {
		url.pathname = '/200';
		const response = await env.ASSETS.fetch(new Request(url, request));
		if (request.method === 'HEAD' || !response.ok) return response;
		const html = (await response.text()).replaceAll('/_app/', '/dashboard/_app/');
		const headers = new Headers(response.headers);
		headers.delete('Content-Length');
		headers.delete('ETag');
		headers.set('Cache-Control', 'no-store');
		return new Response(html, { status: response.status, headers });
	}

	return new Response('Not Found', {
		status: 404,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex'
		}
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		return routeDashboardRequest(request, env);
	}
} satisfies ExportedHandler<Env>;
