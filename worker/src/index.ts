import { simulateSandboxPayment } from './sandbox.ts';
import { handleAiWorkerRequest } from './ai-worker-core.ts';

interface Env {
	ASSETS: Fetcher;
	BANKS_KV?: KVNamespace;
	PUBLIC_DOMAIN?: string;
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
	AZURE_AI_KEY?: string;
	AZURE_BEARER_TOKEN?: string;
	AZURE_HOST?: string;
	MODEL_NAME?: string;
}

const PUBLIC_FILES = new Set(['/favicon.ico', '/robots.txt']);
const DOCS_SPEC_PATH = '/docs/openapi.yaml';
const orderCache = new Map<string, { data: Record<string, unknown>; expires: number }>();

function isLandingAsset(pathname: string): boolean {
	return pathname.startsWith('/_app/') || PUBLIC_FILES.has(pathname);
}

function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
	return Response.json(data, {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
			...extraHeaders
		}
	});
}

export const DEFAULT_BANKS = [
	{
		id: 'monobank',
		code: 'UNJS',
		name: 'Monobank',
		active: true,
		is_active: true,
		routing_mode: 'universal_link',
		color: '#000000',
		bg: 'linear-gradient(135deg, #000000, #2c2c2e)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6b/f1/a2/6bf1a2b4-3a6f-c3c7-7beb-73d4e9ffe884/AppIcon-0-0-1x_U007emarketing-0-6-0-0-85-220.png/200x200ia-75.webp'
	},
	{
		id: 'privat24',
		code: 'PBAN',
		name: 'Приват24',
		active: true,
		is_active: true,
		routing_mode: 'universal_link',
		color: '#2e7d32',
		bg: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
		fee_pct: 0.5,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/39/28/e2/3928e2e6-1f69-235d-bb14-0b8b703ab54e/Placeholder.mill/200x200bb-75.webp'
	},
	{
		id: 'sense',
		code: 'SENS',
		name: 'Sense Bank',
		active: true,
		is_active: true,
		routing_mode: 'universal_link',
		color: '#0d3264',
		bg: 'linear-gradient(135deg, #0d3264, #1a4f94)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/24/5f/f3/245ff3b3-236b-21da-fcf1-90b30636e838/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg'
	},
	{
		id: 'abank',
		code: 'ABUA',
		name: 'Абанк',
		active: true,
		is_active: true,
		routing_mode: 'universal_link',
		color: '#9e9d24',
		bg: 'linear-gradient(135deg, #9e9d24, #827717)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/07/e8/2e/07e82efe-55a5-cd91-e59e-e422b599f7d8/Placeholder.mill/200x200bb-75.webp'
	},
	{
		id: 'pumb',
		code: 'FUIB',
		name: 'ПУМБ',
		active: true,
		is_active: true,
		routing_mode: 'deep_link',
		color: '#e53935',
		bg: 'linear-gradient(135deg, #e53935, #b71c1c)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f9/70/ea/f970eab9-348c-f0f9-a54a-b0d50cf7e835/Placeholder.mill/200x200bb-75.webp'
	},
	{
		id: 'raiffeisen',
		code: 'AVAL',
		name: 'Райффайзен Банк',
		active: true,
		is_active: true,
		routing_mode: 'deep_link',
		color: '#fbc02d',
		bg: 'linear-gradient(135deg, #fbc02d, #f57f17)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/cf/24/47/cf244747-62ff-6fd4-9352-b09e6e929998/Placeholder.mill/200x200bb-75.webp'
	},
	{
		id: 'novapay',
		code: 'NOVA',
		name: 'NovaPay',
		active: true,
		is_active: true,
		routing_mode: 'deep_link',
		color: '#f44336',
		bg: 'linear-gradient(135deg, #f44336, #c62828)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/24/5f/f3/245ff3b3-236b-21da-fcf1-90b30636e838/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg'
	},
	{
		id: 'izibank',
		code: 'TASB',
		name: 'izibank',
		active: true,
		is_active: true,
		routing_mode: 'deep_link',
		color: '#ff9800',
		bg: 'linear-gradient(135deg, #ff9800, #e65100)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/39/28/e2/3928e2e6-1f69-235d-bb14-0b8b703ab54e/Placeholder.mill/200x200bb-75.webp'
	},
	{
		id: 'globus',
		code: 'GLBU',
		name: 'Глобус Банк',
		active: true,
		is_active: true,
		routing_mode: 'deep_link',
		color: '#0288d1',
		bg: 'linear-gradient(135deg, #0288d1, #01579b)',
		fee_pct: 0,
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f9/70/ea/f970eab9-348c-f0f9-a54a-b0d50cf7e835/Placeholder.mill/200x200bb-75.webp'
	}
];

export const DEFAULT_LOGOS: Record<string, { color: string; logo: string; name: string }> = {
	MONO: {
		color: '#000000',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6b/f1/a2/6bf1a2b4-3a6f-c3c7-7beb-73d4e9ffe884/AppIcon-0-0-1x_U007emarketing-0-6-0-0-85-220.png/200x200ia-75.webp',
		name: 'Monobank'
	},
	PBAN: {
		color: '#2e7d32',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/39/28/e2/3928e2e6-1f69-235d-bb14-0b8b703ab54e/Placeholder.mill/200x200bb-75.webp',
		name: 'Приват24'
	},
	SENS: {
		color: '#0d3264',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/24/5f/f3/245ff3b3-236b-21da-fcf1-90b30636e838/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg',
		name: 'Sense Bank'
	},
	ABUA: {
		color: '#9e9d24',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/07/e8/2e/07e82efe-55a5-cd91-e59e-e422b599f7d8/Placeholder.mill/200x200bb-75.webp',
		name: 'Абанк'
	},
	FUIB: {
		color: '#e53935',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f9/70/ea/f970eab9-348c-f0f9-a54a-b0d50cf7e835/Placeholder.mill/200x200bb-75.webp',
		name: 'ПУМБ'
	},
	AVAL: {
		color: '#fbc02d',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/cf/24/47/cf244747-62ff-6fd4-9352-b09e6e929998/Placeholder.mill/200x200bb-75.webp',
		name: 'Райффайзен Банк'
	},
	NOVA: {
		color: '#f44336',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/24/5f/f3/245ff3b3-236b-21da-fcf1-90b30636e838/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg',
		name: 'NovaPay'
	},
	TASB: {
		color: '#ff9800',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/39/28/e2/3928e2e6-1f69-235d-bb14-0b8b703ab54e/Placeholder.mill/200x200bb-75.webp',
		name: 'izibank'
	},
	GLBU: {
		color: '#0288d1',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/f9/70/ea/f970eab9-348c-f0f9-a54a-b0d50cf7e835/Placeholder.mill/200x200bb-75.webp',
		name: 'Глобус Банк'
	}
};

export interface NbuQrInput {
	amount: number;
	recipientName: string;
	recipientIban: string;
	recipientTaxId: string;
	purpose: string;
	orderNumber?: string;
	encoding?: '1' | '2';
}

export interface NbuQrOutput {
	rawString: string;
	base64UrlPayload: string;
	standardQrUrl: string;
	previewText: string;
}

export function utf8ToBase64Url(str: string): string {
	const encoder = new TextEncoder();
	const bytes = encoder.encode(str);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function generateNbuQrPayload(input: NbuQrInput): NbuQrOutput {
	const cleanRecipient = (input.recipientName || 'ФОП ДМИТРИШЕН').trim().substring(0, 140);
	const cleanIban = (input.recipientIban || 'UA12345678987654321345562').replace(/\s+/g, '').toUpperCase();
	const cleanTaxId = (input.recipientTaxId || '11212121212').trim();
	const cleanPurpose = (input.purpose || 'Оплата замовлення').trim().substring(0, 420);
	const orderRef = input.orderNumber ? input.orderNumber.trim() : `RHK_${Date.now().toString(36).toUpperCase()}`;
	const formattedAmount = input.amount > 0 ? `UAH${input.amount.toFixed(2)}` : '';

	const now = new Date();
	const tsCreation =
		String(now.getFullYear()).slice(-2) +
		String(now.getMonth() + 1).padStart(2, '0') +
		String(now.getDate()).padStart(2, '0') +
		String(now.getHours()).padStart(2, '0') +
		String(now.getMinutes()).padStart(2, '0') +
		String(now.getSeconds()).padStart(2, '0');

	const expDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	const tsExpiry =
		String(expDate.getFullYear()).slice(-2) +
		String(expDate.getMonth() + 1).padStart(2, '0') +
		String(expDate.getDate()).padStart(2, '0') +
		'235959';

	const fields = [
		'BCD',
		'003',
		input.encoding || '1',
		'ICT',
		'',
		cleanRecipient,
		cleanIban,
		formattedAmount,
		cleanTaxId,
		'OTHR/GDDS',
		orderRef,
		cleanPurpose,
		'?<InstrForCdtrAgt><InstrInf>MerchID:01234-TermId:43210</InstrInf></InstrForCdtrAgt>',
		'FFFF',
		tsExpiry,
		tsCreation
	];

	const rawString = fields.join('\n') + '\n';
	const base64UrlPayload = utf8ToBase64Url(rawString);
	const standardQrUrl = `https://qr.bank.gov.ua/${base64UrlPayload}`;

	return {
		rawString,
		base64UrlPayload,
		standardQrUrl,
		previewText: `${cleanRecipient} | ${cleanIban} | ${formattedAmount}`
	};
}

export function buildBankRedirect(bankCode: string, payload: string, os = 'desktop'): { redirectUrl: string; fallbackUrl: string } {
	const code = (bankCode || '').toUpperCase();
	let redirectUrl = `https://qr.bank.gov.ua/${payload}`;
	let fallbackUrl = 'https://qr.bank.gov.ua/';

	switch (code) {
		case 'MONO':
		case 'UNJS':
			redirectUrl = `https://mbnk.app/qr/${payload}`;
			fallbackUrl = 'https://send.monobank.ua/';
			break;
		case 'PBAN':
			redirectUrl = `https://www.privat24.ua/rd/send_qr/nbu/${payload}`;
			fallbackUrl = 'https://next.privat24.ua/pay/';
			break;
		case 'TASB':
			redirectUrl =
				os === 'android'
					? `intent://bank.gov.ua/qr/${payload}#Intent;scheme=https;package=ua.izibank.app;end`
					: `izibank://bank.gov.ua/qr/${payload}`;
			fallbackUrl = 'https://apps.apple.com/ua/app/izibank/id1527341829';
			break;
		case 'SENS':
			redirectUrl = `https://app.sensebank.ua/gkR4?code=${payload}`;
			fallbackUrl = 'https://sensebank.ua';
			break;
		case 'ABUA':
			redirectUrl = `https://abank24.page.link/qr/${payload}`;
			fallbackUrl = 'https://a-bank.com.ua';
			break;
		case 'FUIB':
			redirectUrl = `https://mobile-app.pumb.ua/qr.bank.gov.ua/${payload}`;
			fallbackUrl = 'https://pumb.ua';
			break;
		case 'AVAL':
			redirectUrl = `https://my-raif.apps.raiffeisen.ua/qr?payload=${payload}`;
			fallbackUrl = 'https://raiffeisen.ua';
			break;
		case 'GLBU':
			redirectUrl = `https://gpls.app/qr/${payload}`;
			fallbackUrl = 'https://globusplus.com.ua';
			break;
		case 'NOVA':
			redirectUrl =
				os === 'android'
					? `intent://bank.gov.ua/qr/${payload}#Intent;scheme=https;package=ua.novapay.novapaymobile;end`
					: `novapay-mobile://bank.gov.ua/qr/${payload}`;
			fallbackUrl = 'https://novapay.ua';
			break;
		default:
			redirectUrl = `https://qr.bank.gov.ua/${payload}`;
			fallbackUrl = 'https://qr.bank.gov.ua/';
	}

	return { redirectUrl, fallbackUrl };
}

export function buildMerchantInfo(row: Record<string, any>) {
	const be = row.business_entities;
	const m = row.merchants;
	if (be) {
		return {
			business_name: be.business_name || be.display_name || m?.business_name || 'ФОП ДМИТРИШЕН',
			display_name: be.display_name || be.business_name || m?.display_name || m?.business_name || 'BARCODE',
			iban: be.iban || m?.iban || 'UA12345678987654321345562',
			tax_id: be.tax_id || m?.tax_id || '11212121212',
			bank_name: be.bank_name || m?.bank_name || 'А-Банк'
		};
	}
	if (m) {
		return {
			business_name: m.business_name || 'ФОП ДМИТРИШЕН',
			display_name: m.display_name || m.business_name || 'BARCODE',
			iban: m.iban || 'UA12345678987654321345562',
			tax_id: m.tax_id || '11212121212',
			bank_name: m.bank_name || 'А-Банк'
		};
	}
	return {
		business_name: 'ФОП ДМИТРИШЕН',
		display_name: 'BARCODE',
		iban: 'UA12345678987654321345562',
		tax_id: '11212121212',
		bank_name: 'А-Банк'
	};
}

export async function routeWebRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === '/') {
		url.pathname = '/200';
		return env.ASSETS.fetch(new Request(url, request));
	}

	if (url.pathname === '/docs') {
		url.pathname = '/docs/';
		return Response.redirect(url, 308);
	}

	if (url.pathname === '/docs/') {
		return env.ASSETS.fetch(request);
	}

	if (request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': '*'
			}
		});
	}

	// 1. Health check
	if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
		if (request.method === 'GET') {
			return jsonResponse({
				status: 'ok',
				service: 'Rahunok Edge API',
				version: '1.2.0',
				nbu_standard: 'v003_ICT_Sandbox',
				timestamp: new Date().toISOString()
			});
		}
	}

	// 2. Auth routes
	if (url.pathname === '/api/v1/auth/config') {
		if (request.method === 'GET') {
			return jsonResponse({
				supabaseUrl: 'https://mwaeazabpvbxqfrceogr.supabase.co',
				supabaseAnonKey: 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk',
				publicDomain: 'https://letsrealtalk.com',
				providers: ['google']
			});
		}
	}

	if (url.pathname === '/api/v1/auth/demo-session') {
		if (request.method === 'POST') {
			return jsonResponse({
				success: true,
				token: 'demo_merchant_token',
				user: {
					id: '00000000-0000-0000-0000-000000000001',
					email: 'demo@rahunok.com',
					role: 'merchant'
				},
				merchant: {
					id: '00000000-0000-0000-0000-000000000001',
					business_name: 'ФОП ДМИТРИШЕН',
					business_type: 'fop',
					tax_id: '11212121212',
					iban: 'UA12345678987654321345562',
					display_name: 'BARCODE',
					currency: 'UAH',
					onboarding_completed: true
				}
			});
		}
	}

	// 3. Merchant routes
	if (url.pathname === '/api/v1/merchant/me') {
		if (request.method === 'GET') {
			const authHeader = request.headers.get('Authorization') || '';
			if (authHeader.includes('demo_merchant_token') || !authHeader) {
				return jsonResponse({
					id: '00000000-0000-0000-0000-000000000001',
					user_id: '00000000-0000-0000-0000-000000000001',
					business_name: 'ФОП ДМИТРИШЕН',
					business_type: 'fop',
					tax_id: '11212121212',
					iban: 'UA12345678987654321345562',
					bank_name: 'А-Банк',
					display_name: 'BARCODE',
					currency: 'UAH',
					onboarding_completed: true,
					is_active: true
				});
			}
			const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
			const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
			try {
				const res = await fetch(`${supabaseUrl}/rest/v1/merchants?select=*&limit=1`, {
					headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
				});
				if (res.ok) {
					const rows = (await res.json()) as Array<Record<string, unknown>>;
					if (rows[0]) return jsonResponse(rows[0]);
				}
			} catch {}
			return jsonResponse({ onboarding_completed: false, display_name: 'Мерчант' });
		}

		if (request.method === 'PUT') {
			try {
				const body = (await request.json()) as Record<string, unknown>;
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
				const authHeader = request.headers.get('Authorization') || `Bearer ${supabaseAnonKey}`;
				const merchantPayload = {
					business_name: String(body.business_name || body.name || 'ФОП ДМИТРИШЕН').trim(),
					business_type: String(body.business_type || 'fop'),
					tax_id: String(body.tax_id || '11212121212').trim(),
					iban: String(body.iban || 'UA12345678987654321345562').replace(/\s+/g, '').toUpperCase(),
					display_name: String(body.display_name || body.business_name || 'BARCODE').trim(),
					bank_name: String(body.bank_name || 'А-Банк').trim(),
					onboarding_completed: true,
					updated_at: new Date().toISOString()
				};
				try {
					await fetch(`${supabaseUrl}/rest/v1/merchants`, {
						method: 'POST',
						headers: {
							apikey: supabaseAnonKey,
							Authorization: authHeader,
							'Content-Type': 'application/json',
							Prefer: 'resolution=merge-duplicates,return=representation'
						},
						body: JSON.stringify(merchantPayload)
					});
				} catch {}
				return jsonResponse({ success: true, merchant: merchantPayload });
			} catch {
				return jsonResponse({ error: 'Invalid JSON payload' }, 400);
			}
		}
	}

	if (url.pathname === '/api/v1/merchant/onboarding') {
		if (request.method === 'POST') {
			try {
				const body = (await request.json()) as Record<string, unknown>;
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
				const authHeader = request.headers.get('Authorization') || `Bearer ${supabaseAnonKey}`;
				const merchantPayload = {
					business_name: String(body.business_name || body.name || 'ФОП ДМИТРИШЕН').trim(),
					business_type: String(body.business_type || 'fop'),
					tax_id: String(body.tax_id || '11212121212').trim(),
					iban: String(body.iban || 'UA12345678987654321345562').replace(/\s+/g, '').toUpperCase(),
					display_name: String(body.display_name || body.business_name || 'BARCODE').trim(),
					bank_name: String(body.bank_name || 'А-Банк').trim(),
					onboarding_completed: true,
					updated_at: new Date().toISOString()
				};
				try {
					await fetch(`${supabaseUrl}/rest/v1/merchants`, {
						method: 'POST',
						headers: {
							apikey: supabaseAnonKey,
							Authorization: authHeader,
							'Content-Type': 'application/json',
							Prefer: 'resolution=merge-duplicates,return=representation'
						},
						body: JSON.stringify(merchantPayload)
					});
				} catch {}
				return jsonResponse({ success: true, merchant: merchantPayload });
			} catch {
				return jsonResponse({ error: 'Invalid JSON payload' }, 400);
			}
		}
	}

	// 3.1 Merchant Team Members & Invitations API
	if (url.pathname === '/api/v1/merchant/team' || url.pathname.startsWith('/api/v1/merchant/team/')) {
		const authHeader = request.headers.get('Authorization') || '';
		const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
		const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

		if (request.method === 'GET') {
			if (authHeader.includes('demo_merchant_token') || !authHeader) {
				return jsonResponse([
					{
						id: 'member-001',
						user_id: '00000000-0000-0000-0000-000000000001',
						email: 'dmytryshen@rahunok.app',
						role: 'owner',
						status: 'active',
						created_at: '2026-08-01T10:00:00Z'
					},
					{
						id: 'member-002',
						user_id: '00000000-0000-0000-0000-000000000002',
						email: 'manager.olena@rahunok.app',
						role: 'manager',
						status: 'active',
						created_at: '2026-08-15T14:30:00Z'
					},
					{
						id: 'member-003',
						user_id: '00000000-0000-0000-0000-000000000003',
						email: 'cashier.taras@rahunok.app',
						role: 'cashier',
						terminal_id: 'terminal-1',
						status: 'active',
						created_at: '2026-08-20T08:15:00Z'
					}
				]);
			}

			try {
				const res = await fetch(`${supabaseUrl}/rest/v1/merchant_memberships?select=*,terminals(name)&order=created_at.asc`, {
					headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
				});
				if (res.ok) {
					return jsonResponse(await res.json());
				}
			} catch {}
			return jsonResponse([]);
		}

		if (request.method === 'DELETE') {
			const memberIdMatch = url.pathname.match(/^\/api\/v1\/merchant\/team\/([a-zA-Z0-9_-]+)$/);
			const memberId = memberIdMatch ? memberIdMatch[1] : null;
			if (!memberId) return jsonResponse({ error: 'Member ID required' }, 400);

			try {
				await fetch(`${supabaseUrl}/rest/v1/merchant_memberships?id=eq.${encodeURIComponent(memberId)}`, {
					method: 'DELETE',
					headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
				});
			} catch {}
			return jsonResponse({ success: true });
		}
	}

	if (url.pathname === '/api/v1/merchant/invitations' || url.pathname.startsWith('/api/v1/merchant/invitations/')) {
		const authHeader = request.headers.get('Authorization') || '';
		const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
		const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

		if (request.method === 'GET') {
			if (authHeader.includes('demo_merchant_token') || !authHeader) {
				return jsonResponse([
					{
						id: 'inv-001',
						email: 'barista.andriy@gmail.com',
						role: 'cashier',
						token: 'inv_demo_tok_1',
						status: 'pending',
						created_at: '2026-09-08T09:30:00Z',
						expires_at: '2026-09-15T09:30:00Z'
					}
				]);
			}

			try {
				const res = await fetch(`${supabaseUrl}/rest/v1/merchant_invitations?select=*&order=created_at.desc`, {
					headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
				});
				if (res.ok) return jsonResponse(await res.json());
			} catch {}
			return jsonResponse([]);
		}

		if (request.method === 'POST') {
			try {
				const body = (await request.json()) as Record<string, unknown>;
				const randomBytes = crypto.getRandomValues(new Uint8Array(20));
				const token = `inv_${Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
				const invitation = {
					id: crypto.randomUUID(),
					email: String(body.email || '').trim().toLowerCase(),
					role: String(body.role || 'cashier'),
					terminal_id: body.terminal_id ? String(body.terminal_id) : null,
					token,
					status: 'pending',
					created_at: new Date().toISOString(),
					expires_at: new Date(Date.now() + 7 * 86400000).toISOString()
				};

				if (authHeader && !authHeader.includes('demo_merchant_token')) {
					try {
						await fetch(`${supabaseUrl}/rest/v1/merchant_invitations`, {
							method: 'POST',
							headers: {
								apikey: supabaseAnonKey,
								Authorization: authHeader,
								'Content-Type': 'application/json',
								Prefer: 'return=representation'
							},
							body: JSON.stringify(invitation)
						});
					} catch {}
				}

				return jsonResponse({ success: true, invitation }, 201);
			} catch {
				return jsonResponse({ error: 'Invalid invitation payload' }, 400);
			}
		}

		if (request.method === 'PATCH') {
			// Accept or revoke invitation
			const match = url.pathname.match(/^\/api\/v1\/merchant\/invitations\/([a-zA-Z0-9_-]+)\/(accept|revoke|resend)$/i);
			if (match) {
				const invitationTokenOrId = match[1];
				const action = match[2].toLowerCase();

				if (action === 'accept') {
					try {
						const res = await fetch(`${supabaseUrl}/rest/v1/rpc/accept_merchant_invitation`, {
							method: 'POST',
							headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' },
							body: JSON.stringify({ p_token: invitationTokenOrId })
						});
						if (res.ok) {
							return jsonResponse(await res.json());
						}
						const errData = await res.json();
						return jsonResponse({ error: errData.message || 'Invitation cannot be accepted' }, 400);
					} catch {
						return jsonResponse({ success: true, role: 'cashier' });
					}
				}

				return jsonResponse({ success: true, action });
			}
		}
	}

	// 4. Banks catalog & Logos
	if (
		url.pathname === '/api/v1/banks' ||
		url.pathname === '/banks' ||
		url.pathname.startsWith('/api/v1/banks/') ||
		url.pathname.startsWith('/banks/')
	) {
		if (request.method === 'GET') {
			const bankCodeMatch = url.pathname.match(/^\/(?:api\/v1\/)?banks\/([a-zA-Z0-9_-]+)$/i);
			if (bankCodeMatch) {
				const idOrCode = bankCodeMatch[1].toLowerCase();
				const bank = DEFAULT_BANKS.find(
					(b) => b.code.toLowerCase() === idOrCode || b.id.toLowerCase() === idOrCode
				);
				if (bank) {
					return jsonResponse(bank);
				}
				return jsonResponse({ error: `Bank ${idOrCode} not found` }, 404);
			}
			return jsonResponse(DEFAULT_BANKS);
		}
	}

	if (url.pathname === '/api/v1/logos' || url.pathname === '/logos') {
		if (request.method === 'GET') {
			return jsonResponse(DEFAULT_LOGOS);
		}
	}

	// 5. Sandbox simulation & Webhooks
	if (
		url.pathname === '/dashboard/api/sandbox/simulate' ||
		url.pathname === '/api/v1/webhooks/simulate' ||
		url.pathname === '/api/sandbox/simulate'
	) {
		if (request.method === 'POST') {
			return jsonResponse(await simulateSandboxPayment());
		}
		return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
	}

	if (url.pathname.startsWith('/api/v1/webhooks/')) {
		if (request.method === 'POST') {
			const bankCodeMatch = url.pathname.match(/^\/api\/v1\/webhooks\/([a-zA-Z0-9_-]+)$/i);
			const bankCode = bankCodeMatch ? bankCodeMatch[1] : 'UNKNOWN';
			let body: Record<string, unknown> = {};
			try {
				body = (await request.json()) as Record<string, unknown>;
			} catch {}
			return jsonResponse({
				success: true,
				bank_code: bankCode,
				received_at: new Date().toISOString(),
				payload: body
			});
		}
	}

	// 6. KSO self-checkout requests
	if (
		url.pathname === '/api/v1/kso/checkout-requests' ||
		url.pathname.startsWith('/api/v1/kso/checkout-requests/')
	) {
		if (request.method === 'POST') {
			let body: Record<string, unknown> = {};
			try {
				body = (await request.json()) as Record<string, unknown>;
			} catch {}
			const id = `kso_${crypto.randomUUID().slice(0, 12)}`;
			return jsonResponse(
				{
					id,
					status: 'initiated',
					amount: body.amount || 0,
					currency: 'UAH',
					created_at: new Date().toISOString()
				},
				201
			);
		}
		if (request.method === 'GET') {
			const ksoMatch = url.pathname.match(/^\/api\/v1\/kso\/checkout-requests\/([a-zA-Z0-9_-]+)$/i);
			const id = ksoMatch ? ksoMatch[1] : 'kso_demo';
			return jsonResponse({
				id,
				status: 'initiated',
				amount: 100,
				currency: 'UAH',
				created_at: new Date().toISOString()
			});
		}
	}

	// 7. Stats summary
	if (url.pathname === '/api/v1/stats/summary') {
		if (request.method === 'GET') {
			return jsonResponse({
				total_orders: 142,
				volume_uah: 58240,
				active_merchants: 12,
				uptime: '99.98%',
				timestamp: new Date().toISOString()
			});
		}
	}

	// 8. AI Copilot endpoint
	if (url.pathname === '/api/v1/copilot' || url.pathname === '/api/copilot') {
		return handleAiWorkerRequest(request, env as any);
	}

	const CHECKOUT_API_REGEX =
		/^\/api\/v1\/checkout\/([a-zA-Z0-9_-]+)(?:\/(initiate|pay|status|events|event|callback|webhook|apply-promo|delivery))?\/?$/i;
	const checkoutApiMatch = url.pathname.match(CHECKOUT_API_REGEX);
	if (checkoutApiMatch) {
		const orderId = checkoutApiMatch[1];
		const action = (checkoutApiMatch[2] || '').toLowerCase();

		if (action === 'events' || action === 'event') {
			if (request.method === 'POST') {
				let body: Record<string, any> = {};
				try {
					body = await request.json();
				} catch {}
				return jsonResponse({ success: true, order_id: orderId, event: body });
			}
			return jsonResponse({ order_id: orderId, events: [] });
		}

		let orderPayload: Record<string, any> | null = null;
		const cached = orderCache.get(orderId);
		if (cached && cached.expires > Date.now()) {
			orderPayload = cached.data;
		} else {
			const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
			const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

			try {
				const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
				const query = isUuid
					? `id=eq.${encodeURIComponent(orderId)}`
					: `or=(short_id.eq.${encodeURIComponent(orderId)},order_number.eq.${encodeURIComponent(orderId)})`;
				const res = await fetch(
					`${supabaseUrl}/rest/v1/orders?${query}&select=*,merchants(*),business_entities(*)&limit=1`,
					{
						headers: {
							apikey: supabaseAnonKey,
							'Content-Type': 'application/json'
						}
					}
				);
				if (res.ok) {
					const rows = (await res.json()) as Array<Record<string, any>>;
					if (rows.length > 0) {
						const row = rows[0];
						orderPayload = {
							id: row.id,
							merchant_id: row.merchant_id,
							type: row.type || 'fixed',
							order_number: row.order_number,
							title: row.title,
							description: row.description,
							amount: row.base_amount,
							base_amount: row.base_amount,
							discount_amount: row.discount_amount || 0,
							delivery_fee: row.delivery_fee || 0,
							total_amount: row.total_amount,
							currency: row.currency || 'UAH',
							status: row.status,
							table_number: row.table_number,
							terminal_id: row.terminal_id,
							scenario_config: row.scenario_config || {},
							share_url: row.share_url,
							merchant: buildMerchantInfo(row),
							created_at: row.created_at,
							expires_at: row.expires_at
						};
						orderCache.set(orderId, { data: orderPayload, expires: Date.now() + 60000 });
						if (row.short_id) {
							orderCache.set(row.short_id, { data: orderPayload, expires: Date.now() + 60000 });
						}
					}
				}
			} catch (e) {
				console.error('Supabase query error:', e);
			}
		}

		if (action === 'status') {
			if (!orderPayload) {
				return jsonResponse({ error: 'Order not found' }, 404);
			}
			return jsonResponse({
				id: orderId,
				order_id: orderId,
				status: orderPayload.status || 'open',
				paid: orderPayload.status === 'paid',
				paid_at: orderPayload.paid_at || null,
				paid_bank_code: orderPayload.paid_bank_code || null,
				paid_amount:
					orderPayload.paid_amount || (orderPayload.status === 'paid' ? orderPayload.total_amount : null)
			});
		}

		if (action === 'apply-promo') {
			if (request.method === 'POST') {
				let body: Record<string, any> = {};
				try {
					body = await request.json();
				} catch {}
				const promo = String(body.promo_code || body.code || '').toUpperCase();
				const discount = promo.includes('10')
					? 10
					: promo.includes('20')
						? 20
						: promo.includes('SAVE')
							? 50
							: 10;
				const base = Number(orderPayload?.base_amount || orderPayload?.amount || 0);
				const total = Math.max(0, base - discount + Number(orderPayload?.delivery_fee || 0));
				if (orderPayload) {
					orderPayload.discount_amount = discount;
					orderPayload.total_amount = total;
					orderCache.set(orderId, { data: orderPayload, expires: Date.now() + 60000 });
				}
				return jsonResponse({ success: true, discount_amount: discount, total_amount: total });
			}
		}

		if (action === 'delivery') {
			if (request.method === 'POST') {
				let body: Record<string, any> = {};
				try {
					body = await request.json();
				} catch {}
				const fee = Number(body.delivery_fee ?? 70);
				const base = Number(orderPayload?.base_amount || orderPayload?.amount || 0);
				const discount = Number(orderPayload?.discount_amount || 0);
				const total = base - discount + fee;
				if (orderPayload) {
					orderPayload.delivery_fee = fee;
					orderPayload.total_amount = total;
					orderCache.set(orderId, { data: orderPayload, expires: Date.now() + 60000 });
				}
				return jsonResponse({ success: true, delivery_fee: fee, total_amount: total, order: orderPayload });
			}
		}

		if (action === 'initiate' || action === 'pay') {
			let body: Record<string, any> = {};
			if (request.method === 'POST') {
				try {
					body = await request.json();
				} catch {}
			}

			const bankCode = (body.bank_code || 'UNJS').toUpperCase();
			const clientOS = body.os || 'desktop';
			const merchant = orderPayload?.merchant;
			const recipientName = body.merchantName || merchant?.business_name || 'ФОП ДМИТРИШЕН';
			const recipientIban = body.merchantIban || merchant?.iban || 'UA12345678987654321345562';
			const recipientTaxId = body.merchantTaxId || merchant?.tax_id || '11212121212';
			const purpose = body.purpose || orderPayload?.description || orderPayload?.title || `Оплата замовлення ${orderPayload?.order_number || orderId}`;
			const orderNum = body.orderNumber || orderPayload?.order_number || orderId;
			const amount = typeof body.amount === 'number' ? body.amount : (orderPayload?.total_amount || 0);

			const nbu = generateNbuQrPayload({
				amount,
				recipientName,
				recipientIban,
				recipientTaxId,
				purpose,
				orderNumber: orderNum
			});

			const { redirectUrl, fallbackUrl } = buildBankRedirect(bankCode, nbu.base64UrlPayload, clientOS);

			return Response.json({
				success: true,
				redirect_url: redirectUrl,
				fallback_url: fallbackUrl,
				nbu_raw_string: nbu.rawString,
				nbu_payload_base64: nbu.base64UrlPayload,
				nbu_qr_url: nbu.standardQrUrl
			}, {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		if (action === 'callback' || action === 'webhook') {
			let body: Record<string, any> = {};
			if (request.method === 'POST') {
				try {
					body = await request.json();
				} catch {}
			}

			const isSuccess =
				body.status === 'success' ||
				body.status === 'paid' ||
				body.state === 'success' ||
				body.err_code === '0' ||
				body.err_code === 0;
			const newStatus = isSuccess ? 'paid' : body.status || 'failed';

			if (orderPayload) {
				orderPayload.status = newStatus;
				orderCache.set(orderId, { data: orderPayload, expires: Date.now() + 60000 });
			}

			try {
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
				await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
					method: 'PATCH',
					headers: {
						apikey: supabaseAnonKey,
						'Content-Type': 'application/json',
						Prefer: 'return=minimal'
					},
					body: JSON.stringify({ status: newStatus, updated_at: new Date().toISOString() })
				});
			} catch (err) {
				console.error('Failed to update order status on webhook:', err);
			}

			return Response.json(
				{
					success: true,
					order_id: orderId,
					status: newStatus,
					received_at: new Date().toISOString()
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		if (orderPayload) {
			return Response.json(orderPayload, {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					...(cached && cached.expires > Date.now() ? { 'X-Edge-Cache': 'HIT' } : {})
				}
			});
		}

		return Response.json(
			{ error: 'Order not found' },
			{
				status: 404,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}

	const ALIAS_ROUTE = /^\/(?:o|t|tag|pos)\/([a-zA-Z0-9_-]+)\/?$/i;
	const aliasMatch = url.pathname.match(ALIAS_ROUTE);
	if (aliasMatch) {
		const identifier = aliasMatch[1];
		const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
		const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
		const query = isUuid
			? `id=eq.${encodeURIComponent(identifier)}`
			: `or=(short_id.eq.${encodeURIComponent(identifier)},order_number.eq.${encodeURIComponent(identifier)})`;
		try {
			const res = await fetch(
				`${supabaseUrl}/rest/v1/orders?${query}&select=id&limit=1`,
				{
					headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }
				}
			);
			if (res.ok) {
				const rows = (await res.json()) as Array<{ id: string }>;
				if (rows[0]?.id) {
					return Response.redirect(`${url.origin}/pay/${rows[0].id}`, 302);
				}
			}
		} catch {}
		return Response.redirect(`${url.origin}/pay/${identifier}`, 302);
	}

	if (
		url.pathname === '/pay' ||
		url.pathname.startsWith('/pay/') ||
		url.pathname.startsWith('/checkout')
	) {
		try {
			const targetUrl = new URL(request.url);
			targetUrl.protocol = 'http:';
			targetUrl.hostname = 'localhost';
			targetUrl.port = '5174';

			const reqHeaders = new Headers(request.headers);
			reqHeaders.delete('host');

			const orderIdMatch = url.pathname.match(/\/(?:pay|checkout)\/([a-zA-Z0-9-]{3,36})/i);
			const orderId = orderIdMatch ? orderIdMatch[1] : null;

			// Fetch shell from dev server and order from Supabase/cache in PARALLEL
			const shellPromise = fetch(targetUrl.toString(), {
				method: request.method,
				headers: reqHeaders,
				body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
				redirect: 'manual'
			});

			let orderPromise: Promise<Record<string, unknown> | null> = Promise.resolve(null);
			if (orderId && orderId !== 'index' && !orderId.startsWith('@')) {
				const cached = orderCache.get(orderId);
				if (cached && cached.expires > Date.now()) {
					orderPromise = Promise.resolve(cached.data);
				} else {
					const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
					const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
					const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
					const query = isUuid
						? `id=eq.${encodeURIComponent(orderId)}`
						: `or=(short_id.eq.${encodeURIComponent(orderId)},order_number.eq.${encodeURIComponent(orderId)})`;

					orderPromise = fetch(
						`${supabaseUrl}/rest/v1/orders?${query}&select=*,merchants(*),business_entities(*)&limit=1`,
						{ headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' } }
					)
						.then(async (res) => {
							if (!res.ok) return null;
							const rows = (await res.json()) as Array<Record<string, any>>;
							if (!rows.length) return null;
							const row = rows[0];
							const payload = {
								id: row.id,
								merchant_id: row.merchant_id,
								type: row.type || 'fixed',
								order_number: row.order_number,
								title: row.title,
								description: row.description,
								amount: row.base_amount,
								base_amount: row.base_amount,
								discount_amount: row.discount_amount || 0,
								delivery_fee: row.delivery_fee || 0,
								total_amount: row.total_amount,
								currency: row.currency || 'UAH',
								status: row.status,
								table_number: row.table_number,
								terminal_id: row.terminal_id,
								scenario_config: row.scenario_config || {},
								share_url: row.share_url,
								merchant: buildMerchantInfo(row),
								created_at: row.created_at,
								expires_at: row.expires_at
							};
							orderCache.set(orderId, { data: payload, expires: Date.now() + 60000 });
							if (row.short_id) {
								orderCache.set(row.short_id, { data: payload, expires: Date.now() + 60000 });
							}
							return payload;
						})
						.catch(() => null);
				}
			}

			const [payDevRes, order] = await Promise.all([shellPromise, orderPromise]);

			const contentType = payDevRes.headers.get('content-type') || '';
			if (payDevRes.ok && contentType.includes('text/html')) {
				let html = await payDevRes.text();
				if (order) {
					const serialized = JSON.stringify(order)
						.replace(/</g, '\\u003c')
						.replace(/>/g, '\\u003e')
						.replace(/&/g, '\\u0026');
					const injection = `<script>window.__INITIAL_ORDER__=${serialized};</script>`;
					html = html.replace('<head>', `<head>${injection}`);
				}

				const resHeaders = new Headers(payDevRes.headers);
				resHeaders.delete('content-length');
				resHeaders.set('content-type', 'text/html; charset=utf-8');
				resHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

				return new Response(html, {
					status: payDevRes.status,
					headers: resHeaders
				});
			}

			if (payDevRes.status !== 404 || contentType.includes('text/html')) {
				return payDevRes;
			}
		} catch {}
	}

	if (url.pathname === '/conf' || url.pathname.startsWith('/conf/')) {
		if (url.pathname === '/conf') {
			return Response.redirect(`${url.origin}/conf/`, 301);
		}
		try {
			const targetUrl = new URL(request.url);
			targetUrl.protocol = 'http:';
			targetUrl.hostname = 'localhost';
			targetUrl.port = '5176';

			const reqHeaders = new Headers(request.headers);
			reqHeaders.delete('host');

			const confDevRes = await fetch(targetUrl.toString(), {
				method: request.method,
				headers: reqHeaders,
				body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
				redirect: 'manual'
			});

			if (confDevRes.ok || confDevRes.status !== 404) {
				return confDevRes;
			}
		} catch {}

		return env.ASSETS.fetch(request);
	}

	if (url.pathname === '/api/v1/orders' || url.pathname.startsWith('/api/v1/orders')) {
		if (request.method === 'POST') {
			try {
				const body = (await request.json()) as Record<string, unknown>;
				const authHeader = request.headers.get('Authorization') || '';
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

				let merchantId = body.merchant_id as string | undefined;
				if (!merchantId && authHeader) {
					try {
						const merchantRes = await fetch(
							`${supabaseUrl}/rest/v1/merchants?select=id&limit=1`,
							{
								headers: {
									apikey: supabaseAnonKey,
									Authorization: authHeader,
									'Content-Type': 'application/json'
								}
							}
						);
						if (merchantRes.ok) {
							const merchants = (await merchantRes.json()) as Array<{ id: string }>;
							merchantId = merchants[0]?.id;
						}
					} catch {}
				}

				const baseAmount = Number(body.amount || body.base_amount || 0);
				const deliveryFee = Number(body.delivery_fee || 0);
				const totalAmount = baseAmount + deliveryFee;
				const orderNumber = String(body.order_number || `RHK-${Date.now().toString().slice(-6)}`);
				const title = String(body.title || `Рахунок ${orderNumber}`);
				const type = (body.type as string) || 'fixed';
				const newOrderId = crypto.randomUUID();

				if (merchantId && authHeader) {
					const insertPayload: Record<string, unknown> = {
						id: newOrderId,
						merchant_id: merchantId,
						entity_id: body.entity_id ? String(body.entity_id) : null,
						type,
						order_number: orderNumber,
						title,
						description: body.description ? String(body.description) : null,
						base_amount: baseAmount,
						delivery_fee: deliveryFee,
						total_amount: totalAmount,
						status: type === 'table' ? 'preparing' : 'pending',
						table_number: body.table_number ? parseInt(String(body.table_number), 10) : null,
						terminal_id: body.terminal_id ? String(body.terminal_id) : null,
						currency: 'UAH'
					};
					if (body.scenario_config) {
						insertPayload.scenario_config = body.scenario_config;
					}

					try {
						const insertRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
							method: 'POST',
							headers: {
								apikey: supabaseAnonKey,
								Authorization: authHeader,
								'Content-Type': 'application/json',
								Prefer: 'return=representation'
							},
							body: JSON.stringify(insertPayload)
						});

						if (insertRes.ok) {
							const [insertedOrder] = (await insertRes.json()) as Array<{ id: string }>;
							if (insertedOrder?.id) {
								return Response.json(
									{
										success: true,
										order: {
											...insertedOrder,
											share_url: `${url.origin}/pay/${insertedOrder.id}`
										}
									},
									{
										headers: {
											'Content-Type': 'application/json',
											'Access-Control-Allow-Origin': '*'
										}
									}
								);
							}
						}
					} catch {}
				}

				const shareUrl = `${url.origin}/pay/${newOrderId}`;
				return Response.json(
					{
						success: true,
						order: {
							id: newOrderId,
							...body,
							share_url: shareUrl,
							status: type === 'table' ? 'preparing' : 'pending',
							created_at: new Date().toISOString()
						}
					},
					{
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*'
						}
					}
				);
			} catch {
				return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
			}
		}

		if (request.method === 'PATCH') {
			try {
				const orderIdMatch = url.pathname.match(/^\/api\/v1\/orders\/([a-zA-Z0-9_-]+)$/);
				const orderId = orderIdMatch ? orderIdMatch[1] : null;
				if (!orderId) {
					return jsonResponse({ error: 'Missing order ID' }, 400);
				}
				const body = (await request.json()) as Record<string, unknown>;
				const status = body.status as string;
				const amount = body.amount !== undefined ? Number(body.amount) : undefined;
				const newUpdates: Record<string, unknown> = {
					updated_at: new Date().toISOString()
				};
				if (status) newUpdates.status = status;
				if (status === 'paid') {
					newUpdates.paid_at = body.paid_at ? String(body.paid_at) : new Date().toISOString();
					if (body.paid_bank_code) newUpdates.paid_bank_code = String(body.paid_bank_code);
					if (body.paid_amount !== undefined) newUpdates.paid_amount = Number(body.paid_amount);
				}
				if (amount !== undefined) {
					newUpdates.base_amount = amount;
					newUpdates.total_amount = amount;
				}

				const cached = orderCache.get(orderId);
				if (cached) {
					cached.data = { ...cached.data, ...newUpdates };
					orderCache.set(orderId, cached);
				}

				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
				const authHeader = request.headers.get('Authorization') || `Bearer ${supabaseAnonKey}`;

				try {
					const patchRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
						method: 'PATCH',
						headers: {
							apikey: supabaseAnonKey,
							Authorization: authHeader,
							'Content-Type': 'application/json',
							Prefer: 'return=representation'
						},
						body: JSON.stringify(newUpdates)
					});
					if (patchRes.ok) {
						const [updated] = (await patchRes.json()) as Array<Record<string, unknown>>;
						if (updated) {
							return jsonResponse({ success: true, order: updated });
						}
					}
				} catch {}

				return jsonResponse({ success: true, order: { id: orderId, ...newUpdates } });
			} catch {
				return jsonResponse({ error: 'Invalid JSON payload' }, 400);
			}
		}

		if (request.method === 'GET') {
			const orderIdMatch = url.pathname.match(/^\/api\/v1\/orders\/([a-zA-Z0-9_-]+)$/);
			const orderId = orderIdMatch ? orderIdMatch[1] : null;

			if (orderId) {
				const cached = orderCache.get(orderId);
				if (cached && cached.expires > Date.now()) {
					return jsonResponse(cached.data);
				}
				const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
				const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
				const authHeader = request.headers.get('Authorization') || `Bearer ${supabaseAnonKey}`;
				try {
					const res = await fetch(
						`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,merchants(*),business_entities(*)&limit=1`,
						{
							headers: {
								apikey: supabaseAnonKey,
								Authorization: authHeader,
								'Content-Type': 'application/json'
							}
						}
					);
					if (res.ok) {
						const rows = (await res.json()) as Array<Record<string, unknown>>;
						if (rows[0]) {
							return jsonResponse(rows[0]);
						}
					}
				} catch {}

				return jsonResponse({ error: 'Order not found' }, 404);
			}

			// List orders
			const status = url.searchParams.get('status');
			const limit = parseInt(url.searchParams.get('limit') || '50', 10);
			const offset = parseInt(url.searchParams.get('offset') || '0', 10);

			const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
			const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
			const authHeader = request.headers.get('Authorization') || `Bearer ${supabaseAnonKey}`;

			let query = `${supabaseUrl}/rest/v1/orders?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
			if (status) query += `&status=eq.${encodeURIComponent(status)}`;

			try {
				const res = await fetch(query, {
					headers: { apikey: supabaseAnonKey, Authorization: authHeader, 'Content-Type': 'application/json' }
				});
				if (res.ok) {
					const orders = (await res.json()) as Array<Record<string, unknown>>;
					return jsonResponse({ orders, total: orders.length, limit, offset });
				}
			} catch {}

			return jsonResponse({ orders: [], total: 0, limit, offset });
		}
	}

	if (url.pathname === DOCS_SPEC_PATH || isLandingAsset(url.pathname) || url.pathname.startsWith('/conf')) {
		return env.ASSETS.fetch(request);
	}

	if (request.method === 'GET') {
		const accept = request.headers.get('accept') || '';
		if (accept.includes('text/html') || !url.pathname.includes('.')) {
			url.pathname = '/200';
			return env.ASSETS.fetch(new Request(url, request));
		}
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
	fetch: routeWebRequest
} satisfies ExportedHandler<Env>;