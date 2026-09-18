import { describe, it, expect } from 'vitest';
import {
	calculateCleaningOrderPrice,
	pruneCleaningSelections,
	type CleaningOrderSelections
} from './cleaning-pricing';
import type { CleaningFlowData } from './checkout-scenario-config';

describe('cleaning-pricing engine', () => {
	const mockFlowData: CleaningFlowData = {
		companyName: 'Чистий Дім Клінінг',
		packages: [
			{
				id: 'maintenance',
				name: 'Підтримувальне прибирання',
				description: 'Очищення поверхонь, пилосос, вологе прибирання підлоги',
				pricePerSqMeter: 35,
				minPrice: 1200,
				includedFeatures: ['Пилосос та миття підлоги', 'Протирання пилу']
			},
			{
				id: 'general',
				name: 'Генеральне прибирання',
				description: 'Глибоке очищення всіх зон, миття плинтусів, дверей, кахлю',
				pricePerSqMeter: 60,
				minPrice: 2400,
				includedFeatures: ['Видалення стійкого нальоту', 'Миття санвузлів на всю висоту']
			},
			{
				id: 'post_construction',
				name: 'Після ремонту',
				description: 'Видалення будівельного пилу, фарби, затирки',
				pricePerSqMeter: 85,
				minPrice: 3500,
				requiresInspection: true,
				includedFeatures: ['Професійні знепилювачі']
			}
		],
		addons: [
			{ id: 'addon_oven', name: 'Духовка всередині', price: 300, unitLabel: 'шт' },
			{ id: 'addon_window', name: 'Стандартна віконна стулка', price: 150, unitLabel: 'стулка' },
			{ id: 'addon_fridge', name: 'Холодильник всередині', price: 250, unitLabel: 'шт' },
			{ id: 'addon_sofa', name: 'Хімчистка прямого дивана', price: 600, unitLabel: 'посадкове місце' }
		],
		zones: [
			{ id: 'zone_a', name: 'Зона А (в межах міста)', extraFee: 0 },
			{ id: 'zone_b', name: 'Зона Б (передмістя)', extraFee: 200 }
		],
		propertyTypes: [
			{ id: 'apartment', label: 'Квартира', icon: '🏢' },
			{ id: 'house', label: 'Приватний будинок', icon: '🏡' },
			{ id: 'office', label: 'Офіс', icon: '💼' }
		],
		approval: {
			autoApprovalEnabled: true,
			requireManualForHeavyCondition: true,
			requireManualForPostConstruction: true,
			telegramChat: '@clean_orders_bot'
		},
		payment: {
			depositType: 'percent',
			depositValue: 30,
			allowPostPayRemaining: true
		},
		modes: {
			standardEnabled: true,
			customEstimateEnabled: true,
			finalPayEnabled: true
		}
	};

	it('Case 1 (Prompt Test): Генеральне, 50 м² + духовка + 4 стулки + зона Б = 4 100 грн; аванс 30% = 1 230 грн, залишок = 2 870 грн', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'general', // 60 ₴/м², 50 м² -> 3 000 ₴
			squareMeters: 50,
			condition: 'normal',
			addonQuantities: {
				addon_oven: 1,    // +300 ₴
				addon_window: 4   // 4 * 150 = +600 ₴
			},
			zoneId: 'zone_b'     // +200 ₴
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);

		expect(result.totalAmount).toBe(4100);
		expect(result.totalAmountCents).toBe(410000);
		expect(result.depositAmount).toBe(1230);
		expect(result.depositAmountCents).toBe(123000);
		expect(result.remainingAmount).toBe(2870);
		expect(result.remainingAmountCents).toBe(287000);
		expect(result.isEstimate).toBe(false);
		expect(result.canInstantPay).toBe(true);

		// Breakdown check
		expect(result.breakdown).toHaveLength(4);
		expect(result.breakdown[0].label).toContain('Генеральне прибирання (50 м² × 60 ₴)');
		expect(result.breakdown[0].amount).toBe(3000);
		expect(result.breakdown[1].label).toContain('Духовка');
		expect(result.breakdown[1].amount).toBe(300);
		expect(result.breakdown[2].label).toContain('4 стулка');
		expect(result.breakdown[2].amount).toBe(600);
		expect(result.breakdown[3].label).toContain('Зона Б');
		expect(result.breakdown[3].amount).toBe(200);
	});

	it('Case 2 (Prompt Test): Підтримувальне на 20 м² без додатків: мінімум 1 200 грн, а не 700 грн', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'maintenance', // 35 ₴/м² * 20 = 700 ₴ < 1 200 ₴
			squareMeters: 20,
			condition: 'normal',
			addonQuantities: {},
			zoneId: 'zone_a'
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);

		expect(result.totalAmount).toBe(1200);
		expect(result.totalAmountCents).toBe(120000);
		expect(result.breakdown[0].label).toContain('діє мінімальний тариф');
		expect(result.breakdown[0].amount).toBe(1200);
	});

	it('Case 3: Мінімальна вартість застосовується до базового прибирання, потім додаються роботи', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'maintenance', // 20 м² -> min 1 200 ₴
			squareMeters: 20,
			condition: 'normal',
			addonQuantities: {
				addon_oven: 1 // +300 ₴
			},
			zoneId: 'zone_a'
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);

		expect(result.totalAmount).toBe(1500); // 1200 + 300
		expect(result.breakdown[0].amount).toBe(1200);
		expect(result.breakdown[1].amount).toBe(300);
	});

	it('Case 4 (Prompt Test): Сильне забруднення при автопогодженні вимагає ручного погодження, без хибної остаточної ціни', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'general',
			squareMeters: 50,
			condition: 'heavy', // Severe contamination!
			addonQuantities: {},
			zoneId: 'zone_a'
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);

		expect(result.isEstimate).toBe(true);
		expect(result.requiresManualApproval).toBe(true);
		expect(result.canInstantPay).toBe(false);
		expect(result.estimateNotice).toContain('Сильне забруднення');
	});

	it('Case 5: Зміна зони або видалення додатків перераховує підсумок без залишкових доплат', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'general',
			squareMeters: 50,
			condition: 'normal',
			addonQuantities: {
				addon_oven: 1,
				addon_window: 0 // 0 should be pruned
			},
			zoneId: 'zone_a' // Changed from zone_b (200 ₴) to zone_a (0 ₴)
		};

		const pruned = pruneCleaningSelections(selections, mockFlowData);
		expect(pruned.addonQuantities?.['addon_window']).toBeUndefined();

		const result = calculateCleaningOrderPrice(mockFlowData, pruned);
		expect(result.totalAmount).toBe(3300); // 3000 + 300 + 0
	});

	it('Case 6: Нульова або від’ємна площа безпечно валідується та не ламає розрахунок', () => {
		const selections: CleaningOrderSelections = {
			mode: 'standard',
			packageId: 'maintenance',
			squareMeters: -10,
			condition: 'normal',
			addonQuantities: {},
			zoneId: 'zone_a'
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);
		expect(result.totalAmount).toBe(1200); // falls back to min price
	});

	it('Case 7: Оплата виконаної роботи (залишок 2 870 грн)', () => {
		const selections: CleaningOrderSelections = {
			mode: 'final',
			finalReceiptId: 'ACT-912',
			finalAmount: 2870
		};

		const result = calculateCleaningOrderPrice(mockFlowData, selections);
		expect(result.totalAmount).toBe(2870);
		expect(result.depositAmount).toBe(2870);
		expect(result.remainingAmount).toBe(0);
		expect(result.canInstantPay).toBe(true);
		expect(result.breakdown[0].label).toContain('ACT-912');
	});
});
