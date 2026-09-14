/// <reference path="../telegram-bindings.d.ts" />
import { handleTelegramInvoice, handleTelegramInvoicePreview } from './telegram-invoice.ts';
import type { TelegramInvoiceEnv } from './telegram-invoice.ts';

/** Private service-binding entrypoint. No public routes, cron, or legacy API. */
export async function routeTelegramRequest(request: Request, env: TelegramInvoiceEnv): Promise<Response> {
	const url = new URL(request.url);
	if (url.origin !== 'https://letsrealtalk.com' ||
		!['/api/v1/telegram/invoices/preview', '/api/v1/telegram/invoices/send'].includes(url.pathname)) {
		return Response.json({ ok: false, error: 'not_found' }, {
			status: 404, headers: { 'Cache-Control': 'no-store' }
		});
	}
	if (env.TELEGRAM_INVOICE_PUBLIC_ORIGIN !== 'https://letsrealtalk.com') {
		return Response.json({ ok: false, error: 'self_test_unavailable' }, {
			status: 503, headers: { 'Cache-Control': 'no-store' }
		});
	}
	return url.pathname.endsWith('/preview')
		? handleTelegramInvoicePreview(request, env)
		: handleTelegramInvoice(request, env);
}

export default {
	fetch: routeTelegramRequest
} satisfies ExportedHandler<TelegramWorkerBindings>;