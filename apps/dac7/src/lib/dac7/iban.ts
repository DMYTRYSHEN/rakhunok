/**
 * IBAN Parser and Validator for Ukraine
 * Implements ISO 13616 Modulo 97 verification.
 */

export function validateIban(iban: string): boolean {
	// Basic format check for UA IBAN
	const cleanIban = iban.replace(/\s/g, '').toUpperCase();
	if (cleanIban.length !== 29 || !cleanIban.startsWith('UA')) {
		return false;
	}

	// Rearrange for mod97 calculation: move first 4 chars to the end
	const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);

	// Convert letters to numbers (A=10, B=11, ..., Z=35)
	let numericIban = '';
	for (let i = 0; i < rearranged.length; i++) {
		const charCode = rearranged.charCodeAt(i);
		if (charCode >= 65 && charCode <= 90) {
			numericIban += (charCode - 55).toString();
		} else {
			numericIban += rearranged[i];
		}
	}

	// Perform Modulo 97 operation on large number
	let remainder = 0;
	for (let i = 0; i < numericIban.length; i++) {
		remainder = (remainder * 10 + parseInt(numericIban[i], 10)) % 97;
	}

	return remainder === 1;
}

export function parseIban(iban: string) {
	const cleanIban = iban.replace(/\s/g, '').toUpperCase();
	if (!validateIban(cleanIban)) {
		return { valid: false, error: 'Invalid IBAN checksum or format' };
	}

	const countryCode = cleanIban.substring(0, 2);
	const checksum = cleanIban.substring(2, 4);
	const mfo = cleanIban.substring(4, 10);
	const account = cleanIban.substring(10);

	return {
		valid: true,
		countryCode,
		checksum,
		mfo,
		account,
		formatted: `${countryCode}${checksum} ${mfo} ${account.substring(0, 4)} ${account.substring(4, 8)} ${account.substring(8, 12)} ${account.substring(12, 16)} ${account.substring(16)}`
	};
}
