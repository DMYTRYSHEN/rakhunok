import { parseIban } from '../../../../../apps/dac7/src/lib/dac7/iban.ts';

const banks: Record<string, string> = {
	'322001': 'Універсал Банк',
	'305299': 'ПриватБанк',
	'380805': 'Райффайзен Банк',
	'334850': 'ПУМБ',
	'300346': 'Sense Bank'
};

export function ibanBank(value: string) {
	if (!/^UA\d{27}$/.test(value.replace(/\s/g, '').toUpperCase())) return null;
	const parsed = parseIban(value);
	if (!parsed.valid || !parsed.mfo) return null;
	return { code: parsed.mfo, name: banks[parsed.mfo] ?? null };
}

export function normalizePhone(value: string) {
	const compact = value.trim().replace(/[\s()-]/g, '');
	const international = /^0\d{9}$/.test(compact) ? `+38${compact}` : compact;
	return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export function normalizeWebsite(value: string): string | null {
	if (!value.trim()) return '';
	try {
		const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
		if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}

export function validContactEmail(value: string) {
	return value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}