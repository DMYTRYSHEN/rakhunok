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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(
      `${apiBase}/api/v1/checkout/${encodeURIComponent(orderId)}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal
      }
    );
    if (response.status === 404) return { order: null, reason: 'not-found' };
    if (!response.ok) return { order: null, reason: 'server-error', status: response.status };
    try {
      const order = await response.json();
      return { order, reason: null };
    } catch (error) {
      if (controller.signal.aborted) return { order: null, reason: 'offline', error };
      return { order: null, reason: 'server-error', status: response.status, error };
    }
  } catch (error) {
    return { order: null, reason: 'offline', error };
  } finally {
    clearTimeout(timeoutId);
  }
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
        const apiBanks = list.filter((b: Bank) => b.active !== false && b.is_active !== false);
        const apiBanksByCode = new Map(
          apiBanks.map((bank: Bank) => [bank.code.toUpperCase(), bank])
        );
        const bundledCodes = new Set(banks.map((bank) => bank.code.toUpperCase()));

        banks = banks.map((bank) => {
          const apiBank = apiBanksByCode.get(bank.code.toUpperCase());
          return apiBank ? { ...bank, ...apiBank } : bank;
        });
        banks.push(
          ...apiBanks.filter((bank: Bank) => !bundledCodes.has(bank.code.toUpperCase()))
        );
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

function isSafeBankRedirect(value: unknown, secondary = false): value is string {
  if (typeof value !== 'string' || !value || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  if (!/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i.test(value)) return false;

  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password || /^[^:]+:\/\/[^/?#]*@/.test(value)) return false;
    if (url.protocol === 'https:') return true;
    const qrPath = /^\/qr\/[a-zA-Z0-9_-]+$/;
    if (url.protocol === 'mono:') {
      return secondary && url.hostname === 'bank.gov.ua' && qrPath.test(url.pathname) && !url.search && !url.hash;
    }
    if (['izibank:', 'novapay-mobile:'].includes(url.protocol)) {
      return url.hostname === 'bank.gov.ua' && qrPath.test(url.pathname) && !url.search && !url.hash;
    }
    if (url.protocol === 'intent:') {
      if (url.hostname !== 'bank.gov.ua' || !qrPath.test(url.pathname) || url.search) return false;
      const parts = url.hash.match(/^#Intent;(.+);end$/)?.[1].split(';');
      if (!parts) return false;
      const entries = parts.map((part): [string, string] => {
        const separator = part.indexOf('=');
        return [part.slice(0, separator), separator < 0 ? '' : part.slice(separator + 1)];
      });
      if (entries.some(([key, entry]) => !entry || !['scheme', 'package', 'S.browser_fallback_url'].includes(key))) return false;
      const params = new Map(entries);
      if (params.size !== entries.length || params.get('scheme') !== 'https') return false;
      const packageName = params.get('package');
      if (!['com.ftband.mono', 'ua.izibank.app', 'ua.novapay.novapaymobile'].includes(packageName || '')) return false;
      const fallback = params.get('S.browser_fallback_url');
      if (packageName === 'com.ftband.mono') {
        return Boolean(fallback && decodeURIComponent(fallback) === `https://mbnk.app${url.pathname}`);
      }
      return !fallback || isSafeBankRedirect(decodeURIComponent(fallback)) && new URL(decodeURIComponent(fallback)).protocol === 'https:';
    }
    return false;
  } catch {
    return false;
  }
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
    merchantName?: string;
    signal?: AbortSignal;
    merchantIban?: string;
    merchantTaxId?: string;
    purpose?: string;
    orderNumber?: string;
  } = {}
): Promise<BankPaymentInitiateResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const apiBase = options.apiBase ?? getApiBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();

  try {
    if (controller.signal.aborted) return { success: false, error: 'Payment initiation cancelled' };
    const res = await fetchImpl(`${apiBase}/api/v1/checkout/${encodeURIComponent(orderId)}/initiate`, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
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

    if (!res.ok) return { success: false, error: `Payment initiation failed (HTTP ${res.status})` };

    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { success: false, error: 'Invalid payment response' };
    }
    if (data.success === false) {
      return { success: false, error: typeof data.error === 'string' && data.error ? data.error : 'Payment initiation failed' };
    }
    if (!isSafeBankRedirect(data.redirect_url)) {
      return { success: false, error: 'Invalid payment redirect URL' };
    }
    if (data.fallback_url != null && !isSafeBankRedirect(data.fallback_url, true)) {
      return { success: false, error: 'Invalid payment fallback URL' };
    }
    if (typeof data.nbu_payload_base64 === 'string' && !data.nbu_raw_string) {
      try {
        const b64 = data.nbu_payload_base64.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        data.nbu_raw_string = new TextDecoder('utf-8').decode(bytes);
      } catch {
        // Optional server-provided QR metadata must not invalidate a valid redirect.
      }
    }
    return { ...data, success: true };
  } catch {
    return { success: false, error: controller.signal.aborted ? 'Payment initiation timed out' : 'Payment initiation request failed' };
  } finally {
    options.signal?.removeEventListener('abort', abort);
    clearTimeout(timeoutId);
  }
}
