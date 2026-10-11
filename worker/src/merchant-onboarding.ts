import { ibanBank, normalizePhone, normalizeWebsite, validContactEmail } from '../../src/lib/features/dashboard/auth/onboarding.ts';

type OnboardingConfig = { url: string; publishableKey: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function reply(data: unknown, status = 200) {
	return Response.json(data, { status, headers: { 'Access-Control-Allow-Origin': '*' } });
}

function failure(status = 503) {
	const messages: Record<number, string> = {
		401: 'Unauthorized', 403: 'Forbidden', 409: 'Conflict', 422: 'Unprocessable entity'
	};
	return reply({ error: messages[status] ?? 'Service unavailable' }, messages[status] ? status : 503);
}

export async function handleMerchantOnboarding(
	request: Request,
	config: OnboardingConfig,
	fetcher: typeof fetch = fetch
): Promise<Response> {
	const authorization = request.headers.get('Authorization');
	if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return failure(401);
	let body: unknown;
	try { body = await request.json(); } catch { return reply({ error: 'Invalid JSON payload' }, 400); }
	if (!record(body)) return failure(422);
	const businessType = body.business_type;
	if (typeof businessType !== 'string' || !['fop', 'tov', 'self_employed', 'ngo'].includes(businessType)) return failure(422);
	const vatStatus = body.vat_status;
	if (vatStatus !== 'vat' && vatStatus !== 'no-vat') return failure(422);
	const businessName = typeof body.business_name === 'string' ? body.business_name.trim() : '';
	const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : businessName;
	const taxId = typeof body.tax_id === 'string' ? body.tax_id.trim() : '';
	const iban = typeof body.iban === 'string' ? body.iban.replace(/\s/g, '').toUpperCase() : '';
	const bank = ibanBank(iban);
	const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
	const email = typeof body.contact_email === 'string' ? body.contact_email.trim().toLowerCase() : '';
	const website = body.website === undefined ? '' : typeof body.website === 'string' ? normalizeWebsite(body.website) : null;
	const taxPattern = ['fop', 'self_employed'].includes(businessType) ? /^\d{10}$/ : /^\d{8}$/;
	if (!businessName || businessName.length > 200 || !displayName || displayName.length > 100 ||
		!taxPattern.test(taxId) || !bank || !phone || !validContactEmail(email) ||
		website === null || website.length > 2048) return failure(422);
	const baseUrl = config.url.replace(/\/+$/, '');
	const headers = { apikey: config.publishableKey, Authorization: authorization, 'Content-Type': 'application/json' };
	try {
		const auth = await fetcher(`${baseUrl}/auth/v1/user`, { headers });
		if (!auth.ok) return failure(auth.status === 401 || auth.status === 403 ? 401 : 503);
		const user: unknown = await auth.json();
		if (!record(user) || typeof user.id !== 'string' || !uuidPattern.test(user.id)) return failure(401);
		const response = await fetcher(`${baseUrl}/rest/v1/rpc/complete_merchant_onboarding`, {
			method: 'POST', headers,
			body: JSON.stringify({ p_input: {
				business_type: businessType, business_name: businessName, display_name: displayName,
				tax_id: taxId, iban, bank_name: bank.name ?? bank.code, phone,
				contact_email: email, website: website || null, vat_status: vatStatus
			} })
		});
		if (!response.ok) return failure(response.status);
		const result: unknown = await response.json();
		if (!record(result) || typeof result.created !== 'boolean' || !record(result.merchant) ||
			typeof result.merchant.id !== 'string' || !uuidPattern.test(result.merchant.id) ||
			result.merchant.user_id !== user.id) return failure();
		if ((result.created || result.entity != null) && (!record(result.entity) || typeof result.entity.id !== 'string' ||
			!uuidPattern.test(result.entity.id) || result.entity.user_id !== user.id)) return failure();
		return reply({ success: true, merchant: result.merchant, entity: result.entity ?? null, created: result.created });
	} catch { return failure(); }
}