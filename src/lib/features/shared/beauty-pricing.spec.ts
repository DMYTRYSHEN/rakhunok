import { describe, expect, it } from 'vitest';
import {
	calculateBeautyPrice,
	pruneBeautySelections
} from './beauty-pricing';
import type { BeautyStudioFlowData } from './checkout-scenario-config';

const testFlowData: BeautyStudioFlowData = {
	studioName: 'Beauty Lab',
	modes: {
		bookingEnabled: true,
		inSalonPayEnabled: true,
		bookingButtonText: 'Записатися на візит',
		inSalonButtonText: 'Оплатити в салоні'
	},
	services: [
		{ id: 'male_haircut', name: 'Чоловіча стрижка', durationMinutes: 45, basePrice: 400 },
		{ id: 'female_haircut', name: 'Жіноча стрижка', durationMinutes: 60, basePrice: 600 },
		{ id: 'child_haircut', name: 'Дитяча стрижка', durationMinutes: 30, basePrice: 350 }
	],
	questions: [
		{
			id: 'hair_length',
			title: 'Довжина волосся',
			hint: 'Оберіть довжину волосся для розрахунку матеріалів',
			required: true,
			dependsOnServiceId: 'female_haircut',
			options: [
				{ id: 'short', title: 'Коротке волосся', extraPrice: 0 },
				{ id: 'medium', title: 'Середнє волосся', extraPrice: 150 },
				{ id: 'long', title: 'Довге волосся', extraPrice: 300 }
			]
		}
	],
	masters: [
		{ id: 'regular_master', name: 'Звичайний майстер', role: 'Стиліст', extraPrice: 0 },
		{ id: 'lead_master', name: 'Провідний майстер', role: 'Топ-стиліст', extraPrice: 200 }
	],
	addons: [
		{ id: 'hair_care', name: 'Догляд та маска для волосся', price: 250 }
	],
	paymentModel: {
		type: 'percent',
		percentValue: 30
	},
	approval: {
		channel: 'telegram',
		responseTimeNotice: 'до 15 хвилин'
	}
};

describe('Beauty Pricing and Branching Engine', () => {
	it('calculates the spec example correctly: Female + Long Hair + Lead Master + Care = 1350 UAH, 30% = 405 UAH', () => {
		const result = calculateBeautyPrice(testFlowData, {
			serviceId: 'female_haircut',
			questionOptionMap: { hair_length: 'long' },
			masterId: 'lead_master',
			addonIds: ['hair_care']
		});

		expect(result.basePrice).toBe(600);
		expect(result.modifiersPrice).toBe(300);
		expect(result.masterExtra).toBe(200);
		expect(result.addonsPrice).toBe(250);
		expect(result.totalPrice).toBe(1350);
		expect(result.depositAmount).toBe(405);
		expect(result.totalPriceCents).toBe(135000);
		expect(result.depositAmountCents).toBe(40500);
	});

	it('prunes dependent hair_length when switched to Male haircut: 400 + 200 + 250 = 850 UAH, 30% = 255 UAH', () => {
		// Клієнт мав відповідь hair_length: 'long', але перемикається на male_haircut
		const result = calculateBeautyPrice(testFlowData, {
			serviceId: 'male_haircut',
			questionOptionMap: { hair_length: 'long' }, // Має бути проігноровано/очищено
			masterId: 'lead_master',
			addonIds: ['hair_care']
		});

		expect(result.basePrice).toBe(400);
		expect(result.modifiersPrice).toBe(0);
		expect(result.activeModifiers).toHaveLength(0);
		expect(result.masterExtra).toBe(200);
		expect(result.addonsPrice).toBe(250);
		expect(result.totalPrice).toBe(850);
		expect(result.depositAmount).toBe(255);
	});

	it('supports pruneBeautySelections helper directly', () => {
		const cleanedMale = pruneBeautySelections(testFlowData, 'male_haircut', { hair_length: 'long' });
		expect(cleanedMale).toEqual({});

		const cleanedFemale = pruneBeautySelections(testFlowData, 'female_haircut', { hair_length: 'long' });
		expect(cleanedFemale).toEqual({ hair_length: 'long' });
	});

	it('handles payment models: none, fixed, and full', () => {
		// Без передоплати
		const noneResult = calculateBeautyPrice(
			{ ...testFlowData, paymentModel: { type: 'none' } },
			{ serviceId: 'male_haircut' }
		);
		expect(noneResult.totalPrice).toBe(400);
		expect(noneResult.depositAmount).toBe(0);

		// Фіксований аванс 200 грн
		const fixedResult = calculateBeautyPrice(
			{ ...testFlowData, paymentModel: { type: 'fixed', fixedAmount: 200 } },
			{ serviceId: 'male_haircut' }
		);
		expect(fixedResult.totalPrice).toBe(400);
		expect(fixedResult.depositAmount).toBe(200);

		// Повна сума
		const fullResult = calculateBeautyPrice(
			{ ...testFlowData, paymentModel: { type: 'full' } },
			{ serviceId: 'male_haircut' }
		);
		expect(fullResult.totalPrice).toBe(400);
		expect(fullResult.depositAmount).toBe(400);
	});
});
