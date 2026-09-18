import { describe, expect, it } from 'vitest';
import {
	calculateGroomingPrice,
	matchGroomingWeightTier,
	pruneGroomingSelections
} from './grooming-pricing';
import type { GroomingStudioFlowData } from './checkout-scenario-config';

const testGroomingData: GroomingStudioFlowData = {
	studioName: 'Happy Paws Grooming',
	modes: {
		bookingEnabled: true,
		inSalonPayEnabled: true,
		bookingButtonText: 'Записати улюбленця',
		inSalonButtonText: 'Оплатити в салоні'
	},
	supportedPets: ['dog', 'cat'],
	weightTiers: [
		{ id: 'under_5', label: 'до 5 кг включно', maxWeightKg: 5, basePrice: 700 },
		{ id: '5_to_10', label: 'понад 5 до 10 кг включно', maxWeightKg: 10, basePrice: 900 },
		{ id: '10_to_20', label: 'понад 10 до 20 кг включно', maxWeightKg: 20, basePrice: 1200 }
	],
	services: [
		{
			id: 'srv_complex',
			name: 'Комплексний грумінг',
			petTypes: ['dog', 'cat'],
			requiresCoatDetails: true,
			weightTierPrices: {
				under_5: 700,
				'5_to_10': 900,
				'10_to_20': 1200
			},
			durationMinutes: 90
		},
		{
			id: 'srv_bath',
			name: 'Купання та сушка',
			petTypes: ['dog', 'cat'],
			requiresCoatDetails: true,
			weightTierPrices: {
				under_5: 450,
				'5_to_10': 600,
				'10_to_20': 800
			},
			durationMinutes: 60
		},
		{
			id: 'srv_nails',
			name: 'Стрижка кігтів',
			petTypes: ['dog', 'cat'],
			requiresCoatDetails: false,
			weightTierPrices: {},
			fixedPrice: 150,
			durationMinutes: 15
		}
	],
	coatOptions: [
		{ id: 'short', label: 'Коротка шерсть', extraPrice: 0 },
		{ id: 'medium', label: 'Середня шерсть', extraPrice: 100 },
		{ id: 'long', label: 'Довга шерсть', extraPrice: 200 }
	],
	addons: [
		{ id: 'addon_care', name: 'Додаткова доглядова процедура', price: 150 }
	],
	masters: [
		{ id: 'm_master', name: 'Топ-грумер Наталія', role: 'Стиліст', extraPrice: 0, allowedPetTypes: ['dog', 'cat'] }
	],
	autoApproval: {
		enabled: true
	},
	paymentModel: {
		type: 'percent',
		percentValue: 30
	},
	approval: {
		channel: 'telegram',
		responseTimeNotice: 'до 15 хвилин'
	}
};

describe('Grooming Pricing and Logic Engine', () => {
	it('calculates the spec example correctly: Dog 8 kg + long coat + complex + care = 1250 UAH, 30% deposit = 375 UAH', () => {
		const result = calculateGroomingPrice(testGroomingData, {
			petType: 'dog',
			weightKg: 8,
			serviceId: 'srv_complex',
			coatLength: 'long',
			coatCondition: 'clean',
			addonIds: ['addon_care']
		});

		expect(result.basePrice).toBe(900);
		expect(result.coatExtra).toBe(200);
		expect(result.addonsPrice).toBe(150);
		expect(result.totalPrice).toBe(1250);
		expect(result.depositAmount).toBe(375);
		expect(result.isEstimate).toBe(false);
		expect(result.requiresApproval).toBe(false); // auto-approved since clean and autoApproval enabled
		expect(result.canPayFullNow).toBe(true);
		expect(result.totalPriceCents).toBe(125000);
		expect(result.depositAmountCents).toBe(37500);
	});

	it('tests strict non-overlapping weight tier boundaries: 5.0 kg gets 700 UAH, 5.1 kg gets 900 UAH', () => {
		const tier5 = matchGroomingWeightTier(5.0, testGroomingData.weightTiers);
		expect(tier5?.id).toBe('under_5');
		expect(tier5?.basePrice).toBe(700);

		const tier5_1 = matchGroomingWeightTier(5.1, testGroomingData.weightTiers);
		expect(tier5_1?.id).toBe('5_to_10');
		expect(tier5_1?.basePrice).toBe(900);

		const res5 = calculateGroomingPrice(testGroomingData, {
			petType: 'dog',
			weightKg: 5.0,
			serviceId: 'srv_complex',
			coatLength: 'short'
		});
		expect(res5.basePrice).toBe(700);

		const res5_1 = calculateGroomingPrice(testGroomingData, {
			petType: 'dog',
			weightKg: 5.1,
			serviceId: 'srv_complex',
			coatLength: 'short'
		});
		expect(res5_1.basePrice).toBe(900);
	});

	it('treats matting (matted / unsure) as an estimate, requiring manual approval and blocking full payment', () => {
		const resultMatted = calculateGroomingPrice(testGroomingData, {
			petType: 'dog',
			weightKg: 8,
			serviceId: 'srv_complex',
			coatLength: 'long',
			coatCondition: 'matted',
			addonIds: ['addon_care']
		});

		expect(resultMatted.totalPrice).toBe(1250);
		expect(resultMatted.isEstimate).toBe(true);
		expect(resultMatted.requiresApproval).toBe(true);
		expect(resultMatted.canPayFullNow).toBe(false);
		expect(resultMatted.estimateNotice).toContain('Попередня оцінка — 1250 грн');
		expect(resultMatted.estimateNotice).toContain('Остаточну вартість погодить майстер');
	});

	it('skips coat questions for nail trim (srv_nails) and uses fixed price', () => {
		const resultNails = calculateGroomingPrice(testGroomingData, {
			petType: 'dog',
			weightKg: 8,
			serviceId: 'srv_nails',
			coatLength: 'long',
			coatCondition: 'matted'
		});

		// Nail trim does not depend on coat or weight
		expect(resultNails.basePrice).toBe(150);
		expect(resultNails.coatExtra).toBe(0);
		expect(resultNails.coatLength).toBeNull();
		expect(resultNails.coatCondition).toBeNull();
		expect(resultNails.isEstimate).toBe(false); // clean service without matting risk
		expect(resultNails.totalPrice).toBe(150);
	});

	it('prunes incompatible selections cleanly', () => {
		const cleaned = pruneGroomingSelections(testGroomingData, {
			petType: 'cat',
			weightKg: 4,
			serviceId: 'srv_complex',
			coatLength: 'long',
			coatCondition: 'clean'
		});
		expect(cleaned.petType).toBe('cat');
		expect(cleaned.serviceId).toBe('srv_complex');
		expect(cleaned.coatLength).toBe('long');

		const cleanedNails = pruneGroomingSelections(testGroomingData, {
			petType: 'dog',
			serviceId: 'srv_nails',
			coatLength: 'long',
			coatCondition: 'matted'
		});
		expect(cleanedNails.coatLength).toBeUndefined();
		expect(cleanedNails.coatCondition).toBeUndefined();
	});
});
