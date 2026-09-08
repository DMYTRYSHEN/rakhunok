import { readJson, record } from './validation.ts';

/** Local adapter contract only; not a claim that any bank supports this protocol. */
export async function verifySettlement(request: Request, key: Uint8Array, now = Date.now()) {
  if (key.byteLength < 32 || request.method !== 'POST') throw new Error('invalid_webhook');
  const stamp = request.headers.get('X-Settlement-Timestamp') ?? '';
  const signature = request.headers.get('X-Settlement-Signature') ?? '';
  if (!/^\d{13}$/.test(stamp) || Math.abs(now - Number(stamp)) > 300000 || !/^[a-f0-9]{64}$/.test(signature)) throw new Error('invalid_signature');
  // Bounded raw bytes, canonical JSON is NOT substituted for the signed body.
  const reader = request.body?.getReader(); if (!reader) throw new Error('missing_body');
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break;
    length += value.length; if (length > 4096) { await reader.cancel(); throw new Error('too_large'); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const prefix = new TextEncoder().encode(`POST\n${new URL(request.url).pathname}\n${stamp}\n`);
  const signed = new Uint8Array(prefix.length + bytes.length); signed.set(prefix); signed.set(bytes, prefix.length);
  const cryptoKey = await crypto.subtle.importKey('raw', new Uint8Array(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signatureBytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  if (!await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, signed)) throw new Error('invalid_signature');
  const value = await readJson(new Response(bytes));
  if (!record(value) || Object.keys(value).sort().join(',') !== 'amountMinor,attemptId,currency,eventId,iban,occurredAt,reference' ||
      !Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) < 1 || value.currency !== 'UAH' ||
      typeof value.attemptId !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.attemptId) ||
      typeof value.eventId !== 'string' || value.eventId.length < 1 || value.eventId.length > 128 ||
      typeof value.iban !== 'string' || !/^UA[0-9]{27}$/.test(value.iban) ||
      typeof value.reference !== 'string' || value.reference.length < 1 || value.reference.length > 100 ||
      typeof value.occurredAt !== 'string' || !Number.isFinite(Date.parse(value.occurredAt))) throw new Error('invalid_event');
  return value;
}