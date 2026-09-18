import type {
	CleaningFlowData,
	CleaningObjectType,
	CleaningCondition,
	CleaningServicePackage,
	CleaningAddon,
	CleaningServiceZone
} from './checkout-scenario-config';

export interface CleaningOrderSelections {
	mode: 'standard' | 'custom' | 'final';
	propertyType?: CleaningObjectType;
	packageId?: string;
	squareMeters?: number;
	condition?: CleaningCondition;
	addonQuantities?: Record<string, number>;
	zoneId?: string;
	address?: string;
	desiredDate?: string;
	desiredTimeSlot?: string;
	contactName?: string;
	contactPhone?: string;
	customNotes?: string;
	finalReceiptId?: string;
	finalAmount?: number;
}

export interface CleaningPriceBreakdownItem {
	label: string;
	amount: number;
	amountCents: number;
	isFree?: boolean;
}

export interface CleaningPricingResult {
	totalAmount: number;
	totalAmountCents: number;
	depositAmount: number;
	depositAmountCents: number;
	remainingAmount: number;
	remainingAmountCents: number;
	breakdown: CleaningPriceBreakdownItem[];
	isEstimate: boolean;
	requiresManualApproval: boolean;
	estimateNotice?: string;
	canInstantPay: boolean;
	summaryLabel: string;
}

/**
 * Calculates exact transparent breakdown for cleaning orders.
 * Core rules:
 * - Base price: Math.max(squareMeters * pricePerSqMeter, minPrice).
 * - Minimum price applies to base cleaning FIRST, then addons and delivery zone fee are added.
 * - Addons: price * quantity (e.g. 4 window sashes * 150 ₴ = 600 ₴, oven = 300 ₴).
 * - Zone fee: added on top (e.g. Zone B = 200 ₴).
 * - Severe contamination, post-construction or unsure conditions require manual approval.
 * - Deposit: calculates 30% advance and remaining balance to pay after completion.
 */
export function calculateCleaningOrderPrice(
	flowData: Partial<CleaningFlowData>,
	selections: CleaningOrderSelections
): CleaningPricingResult {
	const mode = selections.mode || 'standard';
	const breakdown: CleaningPriceBreakdownItem[] = [];

	// 1. Final balance payment mode
	if (mode === 'final') {
		const amount = Math.max(0, Number(selections.finalAmount || 0));
		const label = selections.finalReceiptId
			? `Залишок за актом робіт #${selections.finalReceiptId}`
			: 'Оплата виконаного прибирання';

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
			remainingAmount: 0,
			remainingAmountCents: 0,
			breakdown,
			isEstimate: false,
			requiresManualApproval: false,
			canInstantPay: true,
			summaryLabel: 'Оплата виконаного прибирання'
		};
	}

	// 2. Custom heavy assessment mode
	if (mode === 'custom') {
		const baseEstimate = 3500;
		breakdown.push({
			label: 'Орієнтовна вартість складного клінінгу',
			amount: baseEstimate,
			amountCents: Math.round(baseEstimate * 100)
		});

		return {
			totalAmount: baseEstimate,
			totalAmountCents: Math.round(baseEstimate * 100),
			depositAmount: Math.round(baseEstimate * 0.3),
			depositAmountCents: Math.round(baseEstimate * 30),
			remainingAmount: Math.round(baseEstimate * 0.7),
			remainingAmountCents: Math.round(baseEstimate * 70),
			breakdown,
			isEstimate: true,
			requiresManualApproval: true,
			estimateNotice: 'Попередня оцінка. Точну вартість робіт та склад бригади погодить менеджер після огляду фото або об’єкта.',
			canInstantPay: false,
			summaryLabel: 'Індивідуальний розрахунок'
		};
	}

	// 3. Standard Cleaning Mode
	const packages = flowData.packages ?? [];
	const selectedPkg = packages.find((p) => p.id === selections.packageId) ?? packages[0] ?? {
		id: 'maintenance',
		name: 'Підтримувальне прибирання',
		pricePerSqMeter: 35,
		minPrice: 1200
	};

	const rawSqMeters = Number(selections.squareMeters ?? 50);
	const squareMeters = Math.max(1, Math.min(1000, Number.isFinite(rawSqMeters) ? rawSqMeters : 50));

	const calculatedBase = squareMeters * selectedPkg.pricePerSqMeter;
	const isMinApplied = calculatedBase < selectedPkg.minPrice;
	const basePrice = Math.max(calculatedBase, selectedPkg.minPrice);

	const baseLabel = isMinApplied
		? `${selectedPkg.name} (${squareMeters} м² · діє мінімальний тариф)`
		: `${selectedPkg.name} (${squareMeters} м² × ${selectedPkg.pricePerSqMeter} ₴)`;

	breakdown.push({
		label: baseLabel,
		amount: basePrice,
		amountCents: Math.round(basePrice * 100)
	});

	// Addons
	const allAddons = flowData.addons ?? [];
	const addonQuantities = selections.addonQuantities ?? {};
	let addonsTotal = 0;

	for (const addon of allAddons) {
		const qty = Number(addonQuantities[addon.id] || 0);
		if (qty > 0) {
			const itemCost = addon.price * qty;
			addonsTotal += itemCost;
			const addonLabel = qty > 1
				? `${addon.name} (${qty} ${addon.unitLabel})`
				: addon.name;

			breakdown.push({
				label: addonLabel,
				amount: itemCost,
				amountCents: Math.round(itemCost * 100)
			});
		}
	}

	// Delivery Zone Fee
	const zones = flowData.zones ?? [];
	const selectedZone = zones.find((z) => z.id === selections.zoneId) ?? zones[0];
	let zoneFee = 0;

	if (selectedZone) {
		zoneFee = selectedZone.extraFee;
		if (zoneFee > 0) {
			breakdown.push({
				label: `Виїзд (${selectedZone.name})`,
				amount: zoneFee,
				amountCents: Math.round(zoneFee * 100)
			});
		} else {
			breakdown.push({
				label: `Виїзд (${selectedZone.name})`,
				amount: 0,
				amountCents: 0,
				isFree: true
			});
		}
	}

	const totalAmount = basePrice + addonsTotal + zoneFee;
	const totalAmountCents = Math.round(totalAmount * 100);

	// Condition & Approval Checks
	const condition = selections.condition || 'normal';
	const autoApprovalSetting = flowData.approval?.autoApprovalEnabled ?? true;
	let isEstimate = false;
	let requiresManualApproval = false;
	let estimateNotice: string | undefined;

	if (condition === 'heavy') {
		isEstimate = true;
		requiresManualApproval = true;
		estimateNotice = 'Сильне забруднення потребує погодження менеджером. Сума є попередньою оцінкою.';
	} else if (condition === 'post_construction' || condition === 'unsure') {
		isEstimate = true;
		requiresManualApproval = true;
		estimateNotice = 'Стан приміщення потребує попереднього погодження менеджером.';
	} else if (selectedPkg.requiresInspection) {
		isEstimate = true;
		requiresManualApproval = true;
		estimateNotice = 'Обраний вид робіт потребує обов’язкового огляду об’єкта.';
	} else if (!autoApprovalSetting) {
		requiresManualApproval = true;
	}

	// Deposit Calculation (30% default)
	const depositPercent = flowData.payment?.depositValue ?? 30;
	const depositType = flowData.payment?.depositType || 'percent';
	let depositAmount = totalAmount;

	if (depositType === 'percent') {
		depositAmount = Math.round((totalAmount * depositPercent) / 100);
	} else if (depositType === 'fixed') {
		depositAmount = Math.min(totalAmount, flowData.payment?.depositValue ?? 500);
	}

	const remainingAmount = Math.max(0, totalAmount - depositAmount);

	return {
		totalAmount,
		totalAmountCents,
		depositAmount,
		depositAmountCents: Math.round(depositAmount * 100),
		remainingAmount,
		remainingAmountCents: Math.round(remainingAmount * 100),
		breakdown,
		isEstimate,
		requiresManualApproval,
		estimateNotice,
		canInstantPay: !requiresManualApproval && !isEstimate,
		summaryLabel: `${selectedPkg.name} · ${squareMeters} м²`
	};
}

/**
 * Cleans non-applicable selections when customer changes parameters.
 */
export function pruneCleaningSelections(
	selections: CleaningOrderSelections,
	flowData: Partial<CleaningFlowData>
): CleaningOrderSelections {
	const cloned: CleaningOrderSelections = { ...selections };

	// Clean 0-qty addons
	if (cloned.addonQuantities) {
		const cleanedAddons: Record<string, number> = {};
		for (const [id, qty] of Object.entries(cloned.addonQuantities)) {
			if (qty > 0) {
				cleanedAddons[id] = qty;
			}
		}
		cloned.addonQuantities = cleanedAddons;
	}

	// Mode-based pruning
	if (cloned.mode === 'final') {
		cloned.packageId = undefined;
		cloned.addonQuantities = {};
		cloned.squareMeters = undefined;
	} else if (cloned.mode === 'standard') {
		cloned.finalReceiptId = undefined;
		cloned.finalAmount = undefined;
	}

	return cloned;
}
