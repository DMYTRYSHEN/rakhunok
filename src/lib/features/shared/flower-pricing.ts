import type {
	FlowerShopFlowData,
	FlowerBouquet,
	FlowerBouquetSize,
	FlowerAddon,
	FlowerDeliveryZone,
	FlowerPickupPoint
} from './checkout-scenario-config';

export interface FlowerOrderSelections {
	mode: 'catalog' | 'custom' | 'instore';
	selectedBouquetId?: string;
	selectedSizeId?: string;
	selectedAddonIds?: string[];
	fulfillmentType?: 'pickup' | 'delivery';
	pickupPointId?: string;
	deliveryZoneId?: string;
	deliveryAddress?: string;
	customBudget?: number;
	customPaletteId?: string;
	customWishes?: string;
	hasGreetingPostcard?: boolean;
	greetingText?: string;
	isSurpriseGift?: boolean;
	senderName?: string;
	senderPhone?: string;
	recipientName?: string;
	recipientPhone?: string;
	deliveryDate?: string;
	deliveryTimeSlot?: string;
	inStoreReceiptId?: string;
	inStoreAmount?: number;
}

export interface FlowerPriceBreakdownItem {
	label: string;
	amount: number;
	amountCents: number;
	isFree?: boolean;
}

export interface FlowerPricingResult {
	totalAmount: number;
	totalAmountCents: number;
	depositAmount: number;
	depositAmountCents: number;
	breakdown: FlowerPriceBreakdownItem[];
	isEstimate: boolean;
	requiresManualApproval: boolean;
	estimateNotice?: string;
	canInstantPay: boolean;
	fulfillmentSummary: string;
}

/**
 * Calculates exact transparent breakdown for flower shop orders.
 * Follows core rules:
 * - Bouquet size REPLACES base price (e.g. standard 900 ₴, large 1 300 ₴ -> 1 300 ₴).
 * - Addons add fixed increments (e.g. postcard +50 ₴, vase +250 ₴).
 * - Delivery zone adds delivery fee (e.g. Zone A +150 ₴).
 * - Pickup is always 0 ₴ and does not ask for recipient address.
 * - Custom order treats budget as customer's wish/estimate, requiring florist approval.
 */
export function calculateFlowerOrderPrice(
	flowData: Partial<FlowerShopFlowData>,
	selections: FlowerOrderSelections
): FlowerPricingResult {
	const mode = selections.mode || 'catalog';
	const breakdown: FlowerPriceBreakdownItem[] = [];

	// 1. In-Store quick payment
	if (mode === 'instore') {
		const amount = Math.max(0, Number(selections.inStoreAmount || 0));
		const label = selections.inStoreReceiptId
			? `Касовий чек #${selections.inStoreReceiptId}`
			: 'Оплата в магазині';

		breakdown.push({
			label,
			amount,
			amountCents: Math.round(amount * 100)
		});

		return {
			totalAmount: amount,
			totalAmountCents: Math.round(amount * 100),
			depositAmount: amount,
			depositAmountCents: Math.round(amount * 100),
			breakdown,
			isEstimate: false,
			requiresManualApproval: false,
			canInstantPay: true,
			fulfillmentSummary: 'Оплата на касі в магазині'
		};
	}

	// 2. Custom Bouquet (Індивідуальний букет)
	if (mode === 'custom') {
		const minBudget = flowData.customOrder?.minBudget ?? 800;
		const rawBudget = Number(selections.customBudget ?? flowData.customOrder?.defaultBudget ?? 1500);
		const budget = Math.max(minBudget, rawBudget);

		breakdown.push({
			label: 'Орієнтовний бюджет букета (побажання)',
			amount: budget,
			amountCents: Math.round(budget * 100)
		});

		// Delivery fee if delivery chosen
		let deliveryFee = 0;
		let fulfillmentSummary = 'Самовивіз із салону';

		if (selections.fulfillmentType === 'delivery') {
			const zone = flowData.deliveryZones?.find((z) => z.id === selections.deliveryZoneId) ??
				flowData.deliveryZones?.[0];
			if (zone) {
				deliveryFee = zone.price;
				fulfillmentSummary = `Кур'єрська доставка (${zone.name})`;
				breakdown.push({
					label: `Доставка (${zone.name})`,
					amount: deliveryFee,
					amountCents: Math.round(deliveryFee * 100)
				});
			} else {
				fulfillmentSummary = "Кур'єрська доставка (ручний прорахунок)";
				breakdown.push({
					label: 'Доставка (ручний розрахунок флористом)',
					amount: 0,
					amountCents: 0,
					isFree: true
				});
			}
		}

		const totalAmount = budget + deliveryFee;
		const totalAmountCents = Math.round(totalAmount * 100);

		// Deposit calculation if configured
		const depositType = flowData.payment?.depositType || 'full';
		const depositVal = flowData.payment?.depositValue ?? 30;
		let depositAmount = totalAmount;

		if (depositType === 'percent') {
			depositAmount = Math.round((totalAmount * depositVal) / 100);
		} else if (depositType === 'fixed') {
			depositAmount = Math.min(totalAmount, depositVal);
		}

		return {
			totalAmount,
			totalAmountCents,
			depositAmount,
			depositAmountCents: Math.round(depositAmount * 100),
			breakdown,
			isEstimate: true,
			requiresManualApproval: true,
			estimateNotice: `Попередня оцінка — ${totalAmount.toLocaleString('uk-UA')} грн. Бюджет є орієнтовним; склад букета, наявність квітів та остаточну суму погодить флорист.`,
			canInstantPay: false,
			fulfillmentSummary
		};
	}

	// 3. Catalog (Готовий букет)
	const bouquets = flowData.bouquets ?? [];
	const bouquet = bouquets.find((b) => b.id === selections.selectedBouquetId) ?? bouquets[0];

	let bouquetPrice = 900;
	let sizeName = 'Стандартний';

	if (bouquet && bouquet.sizes && bouquet.sizes.length > 0) {
		const size = bouquet.sizes.find((s) => s.id === selections.selectedSizeId) ??
			bouquet.sizes.find((s) => s.isDefault) ??
			bouquet.sizes[0];
		bouquetPrice = size.price;
		sizeName = size.name;
	}

	const bouquetLabel = bouquet
		? `Букет «${bouquet.name}» (${sizeName})`
		: `Готовий букет (${sizeName})`;

	breakdown.push({
		label: bouquetLabel,
		amount: bouquetPrice,
		amountCents: Math.round(bouquetPrice * 100)
	});

	// Addons
	const allAddons = flowData.addons ?? [];
	const selectedAddonIds = selections.selectedAddonIds ?? [];
	let addonsTotal = 0;

	for (const addonId of selectedAddonIds) {
		const addon = allAddons.find((a) => a.id === addonId);
		if (addon) {
			addonsTotal += addon.price;
			const addonLabel = addon.isPostcard && selections.greetingText
				? `${addon.name} (з теплим підписом)`
				: addon.name;

			breakdown.push({
				label: addonLabel,
				amount: addon.price,
				amountCents: Math.round(addon.price * 100)
			});
		}
	}

	// Fulfillment
	let deliveryFee = 0;
	let fulfillmentSummary = 'Самовивіз із салону';
	let isOutOfZone = false;

	if (selections.fulfillmentType === 'delivery') {
		const zones = flowData.deliveryZones ?? [];
		if (selections.deliveryZoneId === 'out_of_zone') {
			isOutOfZone = true;
			fulfillmentSummary = "Доставка за межі зон (ручний прорахунок)";
			breakdown.push({
				label: 'Доставка за межі зон (погоджується флористом)',
				amount: 0,
				amountCents: 0,
				isFree: true
			});
		} else {
			const zone = zones.find((z) => z.id === selections.deliveryZoneId) ?? zones[0];
			if (zone) {
				deliveryFee = zone.price;
				fulfillmentSummary = `Кур'єрська доставка (${zone.name})`;
				breakdown.push({
					label: `Доставка (${zone.name})`,
					amount: deliveryFee,
					amountCents: Math.round(deliveryFee * 100)
				});
			}
		}
	} else {
		// Pickup
		const pickupPoint = flowData.pickupPoints?.find((p) => p.id === selections.pickupPointId) ??
			flowData.pickupPoints?.[0];
		fulfillmentSummary = pickupPoint
			? `Самовивіз: ${pickupPoint.address}`
			: 'Самовивіз із магазину';

		breakdown.push({
			label: 'Самовивіз з магазину',
			amount: 0,
			amountCents: 0,
			isFree: true
		});
	}

	const totalAmount = bouquetPrice + addonsTotal + deliveryFee;
	const totalAmountCents = Math.round(totalAmount * 100);

	// Approval logic:
	const autoApprovalEnabled = flowData.approval?.autoApprovalEnabled ?? false;
	const isBouquetAvailable = bouquet?.isAvailable ?? true;
	const requiresManualApproval = !autoApprovalEnabled || !isBouquetAvailable || isOutOfZone;

	// Deposit
	const depositType = flowData.payment?.depositType || 'full';
	const depositVal = flowData.payment?.depositValue ?? 30;
	let depositAmount = totalAmount;

	if (depositType === 'percent') {
		depositAmount = Math.round((totalAmount * depositVal) / 100);
	} else if (depositType === 'fixed') {
		depositAmount = Math.min(totalAmount, depositVal);
	}

	return {
		totalAmount,
		totalAmountCents,
		depositAmount,
		depositAmountCents: Math.round(depositAmount * 100),
		breakdown,
		isEstimate: false,
		requiresManualApproval,
		canInstantPay: !requiresManualApproval,
		fulfillmentSummary
	};
}

/**
 * Prunes non-applicable fields when customer switches paths or options:
 * - Switching from delivery to pickup resets address, recipient info, and delivery zone.
 * - Switching from custom to catalog resets custom budget/wishes.
 * - Unchecking postcard resets greeting text.
 */
export function pruneFlowerSelections(
	selections: FlowerOrderSelections,
	flowData: Partial<FlowerShopFlowData>
): FlowerOrderSelections {
	const cloned: FlowerOrderSelections = { ...selections };

	// 1. Fulfillment pruning
	if (cloned.fulfillmentType === 'pickup') {
		cloned.deliveryAddress = undefined;
		cloned.deliveryZoneId = undefined;
		cloned.isSurpriseGift = false;
		cloned.recipientName = undefined;
		cloned.recipientPhone = undefined;
	}

	// 2. Postcard greeting text pruning
	const postcardAddon = flowData.addons?.find((a) => a.isPostcard);
	const hasPostcard = postcardAddon && cloned.selectedAddonIds?.includes(postcardAddon.id);
	if (!hasPostcard) {
		cloned.greetingText = undefined;
		cloned.hasGreetingPostcard = false;
	} else {
		cloned.hasGreetingPostcard = true;
	}

	// 3. Mode pruning
	if (cloned.mode === 'catalog') {
		cloned.customBudget = undefined;
		cloned.customPaletteId = undefined;
		cloned.customWishes = undefined;
		cloned.inStoreReceiptId = undefined;
		cloned.inStoreAmount = undefined;
	} else if (cloned.mode === 'custom') {
		cloned.selectedBouquetId = undefined;
		cloned.selectedSizeId = undefined;
		cloned.inStoreReceiptId = undefined;
		cloned.inStoreAmount = undefined;
	} else if (cloned.mode === 'instore') {
		cloned.selectedBouquetId = undefined;
		cloned.selectedSizeId = undefined;
		cloned.selectedAddonIds = [];
		cloned.customBudget = undefined;
		cloned.customPaletteId = undefined;
		cloned.customWishes = undefined;
		cloned.fulfillmentType = 'pickup';
		cloned.deliveryAddress = undefined;
	}

	return cloned;
}
