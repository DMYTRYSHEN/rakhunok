export type SuggestedCarrier = 'nova_poshta' | 'ukrposhta' | 'meest';

export function normalizeTrackingNumber(value: string): string {
	return value.replace(/\s+/g, '').toUpperCase();
}

export function suggestCarrier(value: string): SuggestedCarrier | null {
	const number = normalizeTrackingNumber(value);
	if (/^[25]\d{13}$/.test(number)) return 'nova_poshta';
	if (/^\d{13}$/.test(number) || /^[A-Z]{2}\d{9}UA$/.test(number)) return 'ukrposhta';
	return null;
}