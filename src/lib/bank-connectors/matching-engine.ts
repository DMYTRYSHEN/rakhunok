/**
 * Payment Matching Engine
 * Reconciles incoming NormalizedBankEvidence against expected invoices / payment attempts
 */

import type { NormalizedBankEvidence } from './types.ts';

export type MatchDecision =
	| 'matched'
	| 'underpaid'
	| 'overpaid'
	| 'wrong_currency'
	| 'wrong_recipient'
	| 'ambiguous'
	| 'unmatched';

export interface ExpectedPaymentTarget {
	orderId: string;
	invoiceId?: string;
	referenceCode: string; // e.g. "RAH-4812" or "4812-A"
	recipientIban: string;
	amountMinor: bigint;
	currency: string;
	createdAt?: Date;
	expiresAt?: Date;
}

export interface MatchResult {
	decision: MatchDecision;
	target?: ExpectedPaymentTarget;
	evidence: NormalizedBankEvidence;
	differenceMinor: bigint; // 0 for exact match, negative for underpaid, positive for overpaid
	reasons: string[];
	confidenceScore: number; // 0.0 to 1.0 (1.0 = strict exact match)
}

/**
 * Normalizes payment reference text for fuzzy/tolerant comparison
 */
export function extractReferenceTokens(text: string): string[] {
	if (!text) return [];
	// Matches sequences like RAH-12345, #12345, INV-12345, 1234-A, etc.
	const tokens = text
		.toUpperCase()
		.replace(/[^\wА-ЯІЇЄҐ0-9\-#]/g, ' ')
		.split(/\s+/)
		.filter((t) => t.length >= 3);
	return Array.from(new Set(tokens));
}

/**
 * Checks if a candidate reference contains the target reference code
 */
export function referenceMatches(rawPurpose: string, targetCode: string): boolean {
	if (!rawPurpose || !targetCode) return false;
	const cleanPurpose = rawPurpose.toUpperCase().replace(/\s+/g, ' ');
	const cleanTarget = targetCode.toUpperCase().trim();

	// 1. Direct substring match (e.g. "Оплата рахунку RAH-4812 від 10.09")
	if (cleanPurpose.includes(cleanTarget)) {
		return true;
	}

	// 2. Strip leading # if present (e.g. target is "#RAH-4812" or "RAH-4812")
	const strippedTarget = cleanTarget.replace(/^#/, '');
	if (strippedTarget.length >= 3 && cleanPurpose.includes(strippedTarget)) {
		return true;
	}

	// 3. Digits-only match if code is predominantly digits (min 4 digits)
	const targetDigits = cleanTarget.replace(/\D/g, '');
	if (targetDigits.length >= 4) {
		const purposeTokens = extractReferenceTokens(cleanPurpose);
		if (purposeTokens.some((tok) => tok.replace(/\D/g, '') === targetDigits)) {
			return true;
		}
	}

	return false;
}

/**
 * Evaluates a single evidence against an expected payment target
 */
export function matchEvidenceAgainstTarget(
	evidence: NormalizedBankEvidence,
	target: ExpectedPaymentTarget
): MatchResult {
	const reasons: string[] = [];

	// 1. Direction check: only CREDIT (incoming) operations can satisfy an invoice
	if (evidence.direction !== 'credit') {
		return {
			decision: 'unmatched',
			target,
			evidence,
			differenceMinor: 0n,
			reasons: ['Транзакція є списанням (debit), а не зарахуванням (credit)'],
			confidenceScore: 0
		};
	}

	// 2. Recipient account validation
	const sanitizedRecipient = target.recipientIban.trim().replace(/\s+/g, '').toUpperCase();
	const sanitizedEvidenceAccount = evidence.accountId.trim().replace(/\s+/g, '').toUpperCase();

	if (sanitizedRecipient !== sanitizedEvidenceAccount) {
		return {
			decision: 'wrong_recipient',
			target,
			evidence,
			differenceMinor: 0n,
			reasons: [`IBAN отримувача (${sanitizedEvidenceAccount}) не збігається з очікуваним (${sanitizedRecipient})`],
			confidenceScore: 0
		};
	}

	// 3. Currency validation
	if (evidence.currency.toUpperCase() !== target.currency.toUpperCase()) {
		return {
			decision: 'wrong_currency',
			target,
			evidence,
			differenceMinor: 0n,
			reasons: [`Валюта ${evidence.currency} не відповідає очікуваній ${target.currency}`],
			confidenceScore: 0
		};
	}

	// 4. Reference match
	const hasReferenceMatch = referenceMatches(evidence.purpose, target.referenceCode);

	// 5. Amount comparison
	const diff = evidence.amountMinor - target.amountMinor;

	if (hasReferenceMatch) {
		if (diff === 0n) {
			return {
				decision: 'matched',
				target,
				evidence,
				differenceMinor: 0n,
				reasons: ['Точний збіг референсу та суми'],
				confidenceScore: 1.0
			};
		}
		if (diff < 0n) {
			return {
				decision: 'underpaid',
				target,
				evidence,
				differenceMinor: diff,
				reasons: [`Недоплата: отримано менше на ${-diff} копійок`],
				confidenceScore: 0.8
			};
		}
		return {
			decision: 'overpaid',
			target,
			evidence,
			differenceMinor: diff,
			reasons: [`Переплата: отримано більше на ${diff} копійок`],
			confidenceScore: 0.85
		};
	}

	// If no reference match, but exact amount and exact recipient:
	if (diff === 0n) {
		return {
			decision: 'ambiguous',
			target,
			evidence,
			differenceMinor: 0n,
			reasons: ['Сума збігається, але референс призначення не розпізнано. Потребує ручного підтвердження.'],
			confidenceScore: 0.4
		};
	}

	return {
		decision: 'unmatched',
		target,
		evidence,
		differenceMinor: diff,
		reasons: ['Призначення платежу не містить коду замовлення'],
		confidenceScore: 0.1
	};
}
