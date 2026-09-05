import type { Bank, BankPaymentInitiateResult } from '../types/bank.js';
import type { Order } from '../types/order.js';

export function getApiBase(location: { hostname?: string; port?: string } = (typeof window !== 'undefined' ? window.location : {})): string {
  return location.hostname === 'localhost' && location.port !== '8787'
    ? 'http://localhost:8787'
    : '';
}

export interface FetchOrderResult {
  order: Order | null;
  reason: 'missing-id' | 'not-found' | 'server-error' | 'offline' | null;
  status?: number;
  error?: unknown;
}

export async function fetchCheckoutOrder(
  orderId: string,
  options: {
    fetchImpl?: typeof fetch;
    apiBase?: string;
    location?: { hostname?: string; port?: string };
  } = {}
): Promise<FetchOrderResult> {
  if (!orderId) return { order: null, reason: 'missing-id' };

  const fetchImpl = options.fetchImpl || fetch;
  const apiBase = options.apiBase ?? getApiBase(options.location);

  // 1. Try local/configured API with a 1.2s timeout to avoid hanging LCP
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1200) : null;
    const response = await fetchImpl(
      `${apiBase}/api/v1/checkout/${encodeURIComponent(orderId)}`,
      {
        headers: { Accept: 'application/json' },
        ...(controller ? { signal: controller.signal } : {})
      }
    );
    if (timeoutId) clearTimeout(timeoutId);
    if (response.status === 404) return { order: null, reason: 'not-found' };
    if (response.ok) {
      const order = await response.json();
      return { order, reason: null };
    }
  } catch {}

  // 2. Direct fast Supabase fallback if local API is unreachable or times out
  try {
    const supabaseUrl = 'https://mwaeazabpvbxqfrceogr.supabase.co';
    const supabaseAnonKey = 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const query = isUuid
      ? `id=eq.${encodeURIComponent(orderId)}`
      : `or=(short_id.eq.${encodeURIComponent(orderId)},order_number.eq.${encodeURIComponent(orderId)})`;

    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/orders?${query}&select=*,merchants(*),business_entities(*)&limit=1`,
      { headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' } }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<Record<string, any>>;
      if (rows.length > 0) {
        const row = rows[0];
        const merchant = row.merchants;
        const be = row.business_entities;
        const merchantPayload = be
          ? {
              business_name: be.business_name || be.display_name || merchant?.business_name,
              display_name: be.display_name || be.business_name || merchant?.display_name || merchant?.business_name,
              iban: be.iban || merchant?.iban,
              tax_id: be.tax_id || merchant?.tax_id,
              bank_name: be.bank_name || merchant?.bank_name
            }
          : merchant
            ? {
                business_name: merchant.business_name,
                display_name: merchant.display_name || merchant.business_name,
                iban: merchant.iban,
                tax_id: merchant.tax_id,
                bank_name: merchant.bank_name
              }
            : undefined;
        return {
          order: {
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
            merchant: merchantPayload,
            created_at: row.created_at,
            expires_at: row.expires_at
          } as Order,
          reason: null
        };
      }
    }
  } catch (error) {
    return { order: null, reason: 'offline', error };
  }

  return { order: null, reason: 'not-found' };
}

export async function fetchBanksCatalog(
  options: {
    fetchImpl?: typeof fetch;
    apiBase?: string;
    bundledCatalogUrl?: string;
  } = {}
): Promise<Bank[]> {
  const fetchImpl = options.fetchImpl || fetch;
  const apiBase = options.apiBase ?? getApiBase();

  // 1. First try bundled banks.json
  let banks: Bank[] = [];
  try {
    const bundledUrl = options.bundledCatalogUrl || '/pay/banks.json';
    const bundledRes = await fetchImpl(bundledUrl);
    if (bundledRes.ok) {
      const list = await bundledRes.json();
      if (Array.isArray(list) && list.length > 0) {
        banks = list.filter((b) => b.active !== false);
      }
    }
  } catch {
    // ignore, continue to API
  }

  // 2. Fetch fresh bank list & logo overrides from API in parallel
  try {
    const [listRes, logosRes] = await Promise.all([
      fetchImpl(`${apiBase}/api/v1/banks`).catch(() => null),
      fetchImpl(`${apiBase}/api/v1/logos`).catch(() => null)
    ]);

    if (listRes && listRes.ok) {
      const list = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        banks = list.filter((b: Bank) => b.active !== false && b.is_active !== false);
      }
    }

    if (logosRes && logosRes.ok && banks.length > 0) {
      const logosMap: Record<string, { color?: string; logo?: string }> = await logosRes.json();
      banks.forEach((b) => {
        const logoData = logosMap[b.code.toUpperCase()];
        if (logoData) {
          if (logoData.color) b.color = logoData.color;
          if (logoData.logo) b.logo = logoData.logo;
        }
      });
    }
  } catch {
    // Keep fallback list
  }

  return banks;
}

export async function initiateBankPayment(
  orderId: string,
  bankCode: string,
  amount: number,
  options: {
    os?: string;
    recaptchaToken?: string;
    turnstileToken?: string;
    apiBase?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<BankPaymentInitiateResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const apiBase = options.apiBase ?? getApiBase();

  try {
    const res = await fetchImpl(`${apiBase}/api/v1/checkout/${encodeURIComponent(orderId)}/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank: bankCode,
        bank_code: bankCode,
        amount,
        os: options.os,
        recaptcha_token: options.recaptchaToken || options.turnstileToken,
        turnstile_token: options.turnstileToken || options.recaptchaToken
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
      if (data && data.redirect_url) {
        return { success: true, ...data };
      }
    }
  } catch (err) {
    console.warn('API initiate failed, using fallback deep link:', err);
  }

  // Fallback client-side scheme map
  const schemeMap: Record<string, string> = {
    TASB: 'izibank://bank.gov.ua/qr/',
    GLBU: 'globus://bank.gov.ua/qr/',
    UNJS: 'https://send.monobank.ua/',
    PBAN: 'https://next.privat24.ua/pay/',
    FUIB: 'pumb-online.app://',
    NOVA: 'novapay-mobile://'
  };

  return {
    success: true,
    redirect_url: schemeMap[bankCode] || 'https://qr.bank.gov.ua/',
    fallback_url: 'https://qr.bank.gov.ua/'
  };
}
