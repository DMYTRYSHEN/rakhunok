import type {
	GroomingStudioFlowData,
	GroomingWeightTier,
	GroomingService,
	GroomingPetType,
	GroomingCoatLength,
	GroomingCoatCondition
} from './checkout-scenario-config';

export interface GroomingPricingBreakdown {
	petType: GroomingPetType;
	serviceId: string;
	serviceName: string;
	weightKg: number;
	matchedTier: GroomingWeightTier | null;
	basePrice: number;
	coatLength: GroomingCoatLength | null;
	coatExtra: number;
	coatCondition: GroomingCoatCondition | null;
	isEstimate: boolean; // Чи є ціна лише попередньою оцінкою (через ковтуни або невідому категорію)
	estimateNotice: string | null;
	requiresApproval: boolean;
	canPayFullNow: boolean;
	masterId: string | null;
	masterName: string | null;
	masterExtra: number;
	addonsPrice: number;
	activeAddons: Array<{ addonId: string; name: string; price: number }>;
	totalPrice: number;
	depositAmount: number;
	paymentType: 'none' | 'fixed' | 'percent' | 'full';
	totalPriceCents: number;
	depositAmountCents: number;
}

export interface GroomingSelectionInput {
	petType: GroomingPetType;
	weightKg?: number;
	serviceId: string;
	coatLength?: GroomingCoatLength;
	coatCondition?: GroomingCoatCondition;
	masterId?: string | null;
	addonIds?: string[];
}

/**
 * Знаходить тарифну категорію ваги тварини за неперекривними діапазонами:
 * - До 5 кг включно (<= 5)
 * - Понад 5 до 10 кг включно (> 5 && <= 10)
 * - Понад 10 до 20 кг включно (> 10 && <= 20)
 */
export function matchGroomingWeightTier(
	weightKg: number,
	tiers: GroomingWeightTier[] = []
): GroomingWeightTier | null {
	if (!tiers || tiers.length === 0) return null;
	const sorted = [...tiers].sort((a, b) => a.maxWeightKg - b.maxWeightKg);
	for (const tier of sorted) {
		if (weightKg <= tier.maxWeightKg) {
			return tier;
		}
	}
	// Якщо понад максимальну категорію — беремо останню категорію
	return sorted[sorted.length - 1];
}

/**
 * Очищує несумісні поля при зміні тварини або послуги:
 * - При зміні собаки на кота скидаються послуги, доступні лише для собак.
 * - При виборі послуги без шерсті (наприклад, стрижка кігтів) очищуються довжина шерсті та ковтуни.
 */
export function pruneGroomingSelections(
	flowData: Partial<GroomingStudioFlowData>,
	selection: GroomingSelectionInput
): GroomingSelectionInput {
	const services = flowData.services ?? [];
	let service = services.find((s) => s.id === selection.serviceId);

	// Якщо послуга не підходить під вид тварини — обираємо першу сумісну
	if (!service || !service.petTypes.includes(selection.petType)) {
		service = services.find((s) => s.petTypes.includes(selection.petType)) ?? services[0];
	}

	const cleaned: GroomingSelectionInput = {
		petType: selection.petType,
		serviceId: service?.id ?? selection.serviceId,
		weightKg: selection.weightKg ?? 5,
		masterId: selection.masterId ?? null,
		addonIds: selection.addonIds ?? []
	};

	// Якщо послуга вимагає шерсть — зберігаємо, інакше очищуємо
	if (service?.requiresCoatDetails) {
		cleaned.coatLength = selection.coatLength ?? 'short';
		cleaned.coatCondition = selection.coatCondition ?? 'clean';
	} else {
		cleaned.coatLength = undefined;
		cleaned.coatCondition = undefined;
	}

	return cleaned;
}

/**
 * Розраховує ціну грумінгу відповідно до тарифної таблиці та правил ковтунів:
 * - Комплекс для собаки до 5 кг включно: 700 грн
 * - Понад 5 до 10 кг включно: 900 грн
 * - Понад 10 до 20 кг включно: 1 200 грн
 * - Довга шерсть: +200 грн
 * - Додаткова доглядова процедура: +150 грн
 * - Приклад: собака 8 кг, довга шерсть, комплекс і додатковий догляд = 1 250 грн, аванс 30% = 375 грн.
 * - Якщо є ковтуни / не впевнений:
 *   "Попередня оцінка — 1 250 грн. Остаточну вартість погодить майстер", повна оплата заблокована.
 */
export function calculateGroomingPrice(
	flowData: Partial<GroomingStudioFlowData>,
	input: GroomingSelectionInput
): GroomingPricingBreakdown {
	const weightTiers = flowData.weightTiers ?? [];
	const services = flowData.services ?? [];
	const coatOptions = flowData.coatOptions ?? [];
	const addons = flowData.addons ?? [];
	const masters = flowData.masters ?? [];
	const paymentModel = flowData.paymentModel ?? { type: 'percent', percentValue: 30 };
	const autoApprovalEnabled = flowData.autoApproval?.enabled ?? false;

	const validSelection = pruneGroomingSelections(flowData, input);
	const service = services.find((s) => s.id === validSelection.serviceId) ?? services[0];
	const serviceId = service?.id ?? '';
	const serviceName = service?.name ?? '';

	// Базова ціна за вагою або фіксована
	let basePrice = 0;
	let matchedTier: GroomingWeightTier | null = null;
	const weightKg = Number(validSelection.weightKg ?? 5);

	if (service?.fixedPrice !== undefined && !service.requiresCoatDetails) {
		basePrice = Number(service.fixedPrice);
	} else if (service?.weightTierPrices) {
		matchedTier = matchGroomingWeightTier(weightKg, weightTiers);
		if (matchedTier && service.weightTierPrices[matchedTier.id] !== undefined) {
			basePrice = Number(service.weightTierPrices[matchedTier.id]);
		} else {
			basePrice = matchedTier?.basePrice ?? 700;
		}
	} else {
		matchedTier = matchGroomingWeightTier(weightKg, weightTiers);
		basePrice = matchedTier?.basePrice ?? 700;
	}

	// Доплата за шерсть
	let coatExtra = 0;
	if (service?.requiresCoatDetails && validSelection.coatLength) {
		const coatOpt = coatOptions.find((c) => c.id === validSelection.coatLength);
		if (coatOpt) {
			coatExtra = Number(coatOpt.extraPrice ?? 0);
		} else if (validSelection.coatLength === 'long') {
			coatExtra = 200;
		} else if (validSelection.coatLength === 'medium') {
			coatExtra = 100;
		}
	}

	// Майстер
	let masterName: string | null = null;
	let masterExtra = 0;
	if (validSelection.masterId) {
		const master = masters.find((m) => m.id === validSelection.masterId);
		if (master) {
			masterName = master.name;
			masterExtra = Number(master.extraPrice ?? 0);
		}
	}

	// Додаткові процедури (Add-ons)
	let addonsPrice = 0;
	const activeAddons: GroomingPricingBreakdown['activeAddons'] = [];
	const selectedAddonSet = new Set(validSelection.addonIds ?? []);

	for (const addon of addons) {
		if (selectedAddonSet.has(addon.id)) {
			const price = Number(addon.price ?? 0);
			addonsPrice += price;
			activeAddons.push({
				addonId: addon.id,
				name: addon.name,
				price
			});
		}
	}

	// Загальна вартість
	const totalPrice = Math.max(0, basePrice + coatExtra + masterExtra + addonsPrice);

	// Перевірка стану шерсті (наявність ковтунів)
	const hasMatting =
		service?.requiresCoatDetails &&
		(validSelection.coatCondition === 'matted' || validSelection.coatCondition === 'unsure');

	const isEstimate = Boolean(hasMatting);
	let estimateNotice: string | null = null;
	let requiresApproval = false;
	let canPayFullNow = true;

	if (isEstimate) {
		estimateNotice = `Попередня оцінка — ${totalPrice} грн. Остаточну вартість погодить майстер після огляду.`;
		requiresApproval = true;
		canPayFullNow = false; // Блокуємо оплату повної суми до погодження
	} else {
		// Якщо немає ковтунів — перевіряємо перемикач автопогодження
		requiresApproval = !autoApprovalEnabled;
		canPayFullNow = true;
	}

	// Розрахунок авансу
	let depositAmount = 0;
	const paymentType = paymentModel.type ?? 'percent';

	if (paymentType === 'none') {
		depositAmount = 0;
	} else if (paymentType === 'full') {
		// Якщо це попередня оцінка з ковтунами, повна оплата заборонена, підставляється фіксований або відсотковий аванс
		depositAmount = isEstimate ? Math.round((totalPrice * 30) / 100) : totalPrice;
	} else if (paymentType === 'fixed') {
		const fixed = Number(paymentModel.fixedAmount ?? 200);
		depositAmount = Math.min(totalPrice, Math.max(0, fixed));
	} else {
		// percent (30%)
		const pct = Number(paymentModel.percentValue ?? 30);
		depositAmount = Math.round((totalPrice * pct) / 100);
	}

	return {
		petType: validSelection.petType,
		serviceId,
		serviceName,
		weightKg,
		matchedTier,
		basePrice,
		coatLength: validSelection.coatLength ?? null,
		coatExtra,
		coatCondition: validSelection.coatCondition ?? null,
		isEstimate,
		estimateNotice,
		requiresApproval,
		canPayFullNow,
		masterId: validSelection.masterId ?? null,
		masterName,
		masterExtra,
		addonsPrice,
		activeAddons,
		totalPrice,
		depositAmount,
		paymentType,
		totalPriceCents: totalPrice * 100,
		depositAmountCents: depositAmount * 100
	};
}
