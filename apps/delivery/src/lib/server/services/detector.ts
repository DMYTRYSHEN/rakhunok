import { normalizeTrackingNumber, suggestCarrier } from '../../carrier-detection.ts';

export type CarrierCode = 'nova_poshta' | 'ukrposhta' | 'meest' | 'sat' | 'delivery' | 'justin';

export interface DetectionResult {
	carrierCode: CarrierCode | null;
	state: 'confirmed' | 'ambiguous' | 'unresolved' | 'unsupported';
	confidence: 'high' | 'medium' | 'low';
	reason?: string;
}

export class CarrierDetector {
	/**
	 * Detect carrier based on rules and hint.
	 */
	static detect(trackingNumber: string, hint?: string): DetectionResult {
		const cleanNumber = normalizeTrackingNumber(trackingNumber);
		const supportedHints: CarrierCode[] = ['nova_poshta', 'ukrposhta', 'meest', 'sat', 'delivery', 'justin'];
		if (hint && !supportedHints.includes(hint as CarrierCode)) {
			return { carrierCode: null, state: 'unsupported', confidence: 'low', reason: 'Unknown carrier hint' };
		}
		
		// 1. Validation
		if (!cleanNumber || cleanNumber.length < 8) {
			return { carrierCode: null, state: 'unsupported', confidence: 'low', reason: 'Invalid format' };
		}

		// 2. Generation of candidates
		const candidates: { code: CarrierCode; score: number }[] = [];

		const suggested = suggestCarrier(cleanNumber);
		if (suggested) candidates.push({ code: suggested, score: suggested === 'ukrposhta' && /^\d+$/.test(cleanNumber) ? 80 : 90 });

		// Apply hint bonus
		if (hint) {
			const candidate = candidates.find(c => c.code === hint);
			if (candidate) {
				candidate.score += 20;
			} else {
				// Add hint as a low probability fallback
				candidates.push({ code: hint as CarrierCode, score: 30 });
			}
		}

		candidates.sort((a, b) => b.score - a.score);

		if (candidates.length === 0) {
			return { carrierCode: null, state: 'unresolved', confidence: 'low' };
		}

		const top = candidates[0];

		if (top.score > 80) {
			return { carrierCode: top.code, state: 'unresolved', confidence: 'high' };
		} else if (candidates.length > 1 && top.score === candidates[1].score) {
			return { carrierCode: null, state: 'ambiguous', confidence: 'low', reason: 'Multiple candidates' };
		}

		return { carrierCode: top.code, state: 'unresolved', confidence: 'medium' };
	}
}
