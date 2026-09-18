import { describe, it, expect } from 'vitest';
import {
	calculateFlowerOrderPrice,
	pruneFlowerSelections,
	type FlowerOrderSelections
} from './flower-pricing';
import type { FlowerShopFlowData } from './checkout-scenario-config';

describe('flower-pricing engine', () => {
	const mockFlowData: FlowerShopFlowData = {
		shopName: 'Floris Квіти',
		modes: {
			catalogEnabled: true,
			customOrderEnabled: true,
			inStorePayEnabled: true
		},
		bouquets: [
			{
				id: 'bq_tenderness',
				name: 'Ніжність',
				category: 'Авторські',
				description: 'Півонії, біла еустома, евкаліпт',
				isAvailable: true,
				sizes: [
					{ id: 'standard', name: 'Стандартний', price: 900, isDefault: true },
					{ id: 'large', name: 'Великий', price: 1300 },
					{ id: 'vip', name: 'VIP Преміум', price: 1900 }
				]
			},
			{
				id: 'bq_roses_25',
				name: '25 червоних троянд Grand Prix',
				category: 'Монобукети',
				description: 'Еквадорські троянди 60 см',
				isAvailable: false, // Out of stock
				sizes: [
					{ id: 'standard', name: 'Стандартний', price: 1250, isDefault: true }
				]
			}
		],
		addons: [
			{ id: 'addon_postcard', name: 'Фірмова листівка', price: 50, isPostcard: true },
			{ id: 'addon_vase', name: 'Скляна ваза', price: 250 },
			{ id: 'addon_box', name: 'Преміум пакування', price: 80 }
		],
		pickupPoints: [
			{ id: 'point_1', name: 'Салон Саксаганського', address: 'вул. Саксаганського, 42', workingHours: '08:00 - 21:00' }
		],
		deliveryZones: [
			{ id: 'zone_a', name: 'Зона А (Центр)', price: 150, eta: 'до 60 хв' },
			{ id: 'zone_b', name: 'Зона B (Околиці)', price: 250, eta: 'до 120 хв' }
		],
		customOrder: {
			minBudget: 800,
			defaultBudget: 1500,
			palettes: [
				{ id: 'pastel', name: 'Ніжна пастельна', colors: ['#fce7f3', '#fed7aa'] }
			],
			flowerOptions: ['Півонії', 'Гортензії', 'Троянди', 'Еустоми']
		},
		approval: {
			autoApprovalEnabled: true,
			requireManualForCustom: true,
			requireManualOutOfZone: true,
			replacementPolicy: 'same_palette',
			telegramChat: '@floris_orders'
		},
		payment: {
			depositType: 'percent',
			depositValue: 30,
			paymentTimeoutMinutes: 30
		}
	};

	it('Case 1 (Prompt Test): Великий букет + листівка + доставка в зоні А = 1 500 грн', () => {
		const selections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedSizeId: 'large', // 1 300 ₴
			selectedAddonIds: ['addon_postcard'], // +50 ₴
			fulfillmentType: 'delivery',
			deliveryZoneId: 'zone_a', // +150 ₴
			greetingText: 'З найкращими побажаннями!'
		};

		const result = calculateFlowerOrderPrice(mockFlowData, selections);

		expect(result.totalAmount).toBe(1500);
		expect(result.totalAmountCents).toBe(150000);
		expect(result.isEstimate).toBe(false);
		expect(result.canInstantPay).toBe(true);
		expect(result.breakdown).toHaveLength(3);
		expect(result.breakdown[0].label).toContain('Великий');
		expect(result.breakdown[0].amount).toBe(1300);
		expect(result.breakdown[1].amount).toBe(50);
		expect(result.breakdown[2].amount).toBe(150);
	});

	it('Case 2 (Prompt Test): Зміна доставки на самовивіз = 1 350 грн; адреса більше не потрібна', () => {
		const originalSelections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedSizeId: 'large', // 1 300 ₴
			selectedAddonIds: ['addon_postcard'], // +50 ₴
			fulfillmentType: 'delivery',
			deliveryZoneId: 'zone_a', // +150 ₴
			deliveryAddress: 'вул. Хрещатик, 15, кв. 10',
			recipientName: 'Олена',
			recipientPhone: '+380501112233',
			isSurpriseGift: true
		};

		// Customer switches to pickup
		const updatedSelections: FlowerOrderSelections = {
			...originalSelections,
			fulfillmentType: 'pickup',
			pickupPointId: 'point_1'
		};

		const pruned = pruneFlowerSelections(updatedSelections, mockFlowData);

		// Pruning checks: delivery address and recipient are cleared
		expect(pruned.deliveryAddress).toBeUndefined();
		expect(pruned.deliveryZoneId).toBeUndefined();
		expect(pruned.recipientName).toBeUndefined();
		expect(pruned.recipientPhone).toBeUndefined();
		expect(pruned.isSurpriseGift).toBe(false);

		const result = calculateFlowerOrderPrice(mockFlowData, pruned);
		expect(result.totalAmount).toBe(1350);
		expect(result.totalAmountCents).toBe(135000);
	});

	it('Case 3: Великий розмір замінює базову ціну, а не додає 1 300 грн до 900 грн', () => {
		const standardSelections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedSizeId: 'standard',
			fulfillmentType: 'pickup'
		};
		const standardResult = calculateFlowerOrderPrice(mockFlowData, standardSelections);
		expect(standardResult.totalAmount).toBe(900);

		const largeSelections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedSizeId: 'large',
			fulfillmentType: 'pickup'
		};
		const largeResult = calculateFlowerOrderPrice(mockFlowData, largeSelections);
		expect(largeResult.totalAmount).toBe(1300);
		expect(largeResult.totalAmount).not.toBe(2200);
	});

	it('Case 4: Ваза (+250 ₴) та листівка (+50 ₴) з великим букетом (1 300 ₴)', () => {
		const selections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedSizeId: 'large',
			selectedAddonIds: ['addon_postcard', 'addon_vase'],
			fulfillmentType: 'pickup'
		};

		const result = calculateFlowerOrderPrice(mockFlowData, selections);
		expect(result.totalAmount).toBe(1300 + 50 + 250); // 1600 ₴
	});

	it('Case 5 (Prompt Test): Індивідуальний букет: бюджет є побажанням, не автоціною, блокує пряму оплату', () => {
		const selections: FlowerOrderSelections = {
			mode: 'custom',
			customBudget: 2000,
			customPaletteId: 'pastel',
			customWishes: 'Побільше білих півоній та евкаліпту',
			fulfillmentType: 'delivery',
			deliveryZoneId: 'zone_a' // +150
		};

		const result = calculateFlowerOrderPrice(mockFlowData, selections);

		expect(result.totalAmount).toBe(2150);
		expect(result.isEstimate).toBe(true);
		expect(result.requiresManualApproval).toBe(true);
		expect(result.canInstantPay).toBe(false);
		expect(result.estimateNotice).toContain('Попередня оцінка');
		expect(result.estimateNotice).toContain('погодить флорист');
	});

	it('Case 6: Автопогодження блокується, якщо букета немає в наявності або зона поза межами', () => {
		// Out of stock bouquet
		const outOfStockSelections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_roses_25',
			fulfillmentType: 'pickup'
		};
		const outOfStockResult = calculateFlowerOrderPrice(mockFlowData, outOfStockSelections);
		expect(outOfStockResult.requiresManualApproval).toBe(true);
		expect(outOfStockResult.canInstantPay).toBe(false);

		// Out of zone delivery
		const outOfZoneSelections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			fulfillmentType: 'delivery',
			deliveryZoneId: 'out_of_zone'
		};
		const outOfZoneResult = calculateFlowerOrderPrice(mockFlowData, outOfZoneSelections);
		expect(outOfZoneResult.requiresManualApproval).toBe(true);
		expect(outOfZoneResult.canInstantPay).toBe(false);
	});

	it('Case 7: Зняття чекбокса листівки очищує greetingText через pruneFlowerSelections', () => {
		const selections: FlowerOrderSelections = {
			mode: 'catalog',
			selectedBouquetId: 'bq_tenderness',
			selectedAddonIds: ['addon_vase'], // No postcard!
			greetingText: 'Текст привітання'
		};

		const pruned = pruneFlowerSelections(selections, mockFlowData);
		expect(pruned.greetingText).toBeUndefined();
		expect(pruned.hasGreetingPostcard).toBe(false);
	});
});
