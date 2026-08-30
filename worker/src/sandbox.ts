const encoder = new TextEncoder();

export interface SandboxEvent {
	deliveryId: string;
	eventType: 'payment.succeeded';
	createdAt: string;
	payment: {
		id: string;
		amountMinor: number;
		currency: 'UAH';
		status: 'succeeded';
		bankCode: 'UNJS';
	};
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalMessage(timestamp: string, body: string): string {
	return `${timestamp}.${body}`;
}

async function importHmacKey(secret: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
}

export async function signSandboxCallback(
	secret: Uint8Array,
	timestamp: string,
	body: string
): Promise<string> {
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(canonicalMessage(timestamp, body))
	);
	return bytesToHex(new Uint8Array(signature));
}

function hexToBytes(value: string): Uint8Array | null {
	if (!/^[a-f\d]{64}$/i.test(value)) return null;
	return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export async function verifySandboxCallback(
	secret: Uint8Array,
	timestamp: string,
	body: string,
	signature: string
): Promise<boolean> {
	const signatureBytes = hexToBytes(signature);
	if (!signatureBytes) return false;
	const key = await importHmacKey(secret);
	return crypto.subtle.verify(
		'HMAC',
		key,
		signatureBytes,
		encoder.encode(canonicalMessage(timestamp, body))
	);
}

export async function simulateSandboxPayment(): Promise<{
	event: SandboxEvent;
	headers: Record<string, string>;
	verified: boolean;
}> {
	const now = new Date();
	const event: SandboxEvent = {
		deliveryId: crypto.randomUUID(),
		eventType: 'payment.succeeded',
		createdAt: now.toISOString(),
		payment: {
			id: `pay_demo_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
			amountMinor: 12500,
			currency: 'UAH',
			status: 'succeeded',
			bankCode: 'UNJS'
		}
	};
	const body = JSON.stringify(event);
	const timestamp = Math.floor(now.getTime() / 1000).toString();
	const secret = crypto.getRandomValues(new Uint8Array(32));
	const signature = await signSandboxCallback(secret, timestamp, body);
	const verified = await verifySandboxCallback(secret, timestamp, body, signature);

	return {
		event,
		headers: {
			'Rahunok-Delivery-Id': event.deliveryId,
			'Rahunok-Signature': `v1=${signature}`,
			'Rahunok-Timestamp': timestamp
		},
		verified
	};
}
