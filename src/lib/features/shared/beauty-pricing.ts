import type {
	BeautyStudioFlowData,
	BeautyQuestion,
	BeautyMaster,
	BeautyAddon
} from './checkout-scenario-config';

export interface BeautyPricingBreakdown {
	serviceId: string;
	serviceName: string;
	basePrice: number;
	modifiersPrice: number;
	activeModifiers: Array<{ questionId: string; optionId: string; title: string; extraPrice: number }>;
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

export interface BeautySelectionInput {
	serviceId: string;
	questionOptionMap?: Record<string, string>; // questionId -> optionId
	masterId?: string | null;
	addonIds?: string[];
}

/**
 * Очищує відповіді на запитання, які не застосовуються до обраної послуги.
 * Наприклад: довжина волосся активна тільки для жіночої стрижки; якщо обрано чоловічу — видаляється.
 */
export function pruneBeautySelections(
	flowData: Partial<BeautyStudioFlowData>,
	selectedServiceId: string,
	currentOptionMap: Record<string, string> = {}
): Record<string, string> {
	const questions = flowData.questions ?? [];
	const cleaned: Record<string, string> = {};

	for (const q of questions) {
		// Якщо запитання залежить від конкретної послуги і вона не збігається — пропускаємо (очищуємо)
		if (q.dependsOnServiceId && q.dependsOnServiceId !== selectedServiceId) {
			continue;
		}
		if (currentOptionMap[q.id]) {
			// Перевіряємо чи існує такий варіант у поточному питанні
			const optionExists = q.options?.some((opt) => opt.id === currentOptionMap[q.id]);
			if (optionExists) {
				cleaned[q.id] = currentOptionMap[q.id];
			}
		}
	}

	return cleaned;
}

/**
 * Розраховує повну ціну та розмір авансу згідно з правилами специфікації Салону Краси.
 * - Чоловіча стрижка 400 грн
 * - Жіноча стрижка 600 грн
 * - Довжина волосся: тільки для жіночої (+0, +150, +300 грн)
 * - Майстер: звичайний +0, провідний +200 грн
 * - Додаткова послуга: догляд +250 грн
 * - Аванс 30%: Жіноча (600) + довге (+300) + провідний (+200) + догляд (+250) = 1 350 грн; аванс = 405 грн.
 */
export function calculateBeautyPrice(
	flowData: Partial<BeautyStudioFlowData>,
	selection: BeautySelectionInput
): BeautyPricingBreakdown {
	const services = flowData.services ?? [];
	const questions = flowData.questions ?? [];
	const masters = flowData.masters ?? [];
	const addons = flowData.addons ?? [];
	const paymentModel = flowData.paymentModel ?? { type: 'percent', percentValue: 30 };

	const service = services.find((s) => s.id === selection.serviceId) ?? services[0];
	const basePrice = Number(service?.basePrice ?? 0);
	const serviceId = service?.id ?? '';
	const serviceName = service?.name ?? '';

	// Очищуємо та розраховуємо доплати за активні запитання
	const validOptionMap = pruneBeautySelections(flowData, serviceId, selection.questionOptionMap ?? {});
	let modifiersPrice = 0;
	const activeModifiers: BeautyPricingBreakdown['activeModifiers'] = [];

	for (const q of questions) {
		if (q.dependsOnServiceId && q.dependsOnServiceId !== serviceId) {
			continue;
		}
		const chosenOptionId = validOptionMap[q.id];
		if (chosenOptionId) {
			const option = q.options?.find((opt) => opt.id === chosenOptionId);
			if (option) {
				const extra = Number(option.extraPrice ?? 0);
				modifiersPrice += extra;
				activeModifiers.push({
					questionId: q.id,
					optionId: option.id,
					title: option.title,
					extraPrice: extra
				});
			}
		}
	}

	// Майстер
	let masterName: string | null = null;
	let masterExtra = 0;
	if (selection.masterId) {
		const master = masters.find((m) => m.id === selection.masterId);
		if (master) {
			masterName = master.name;
			masterExtra = Number(master.extraPrice ?? 0);
		}
	}

	// Додаткові послуги (Add-ons)
	let addonsPrice = 0;
	const activeAddons: BeautyPricingBreakdown['activeAddons'] = [];
	const selectedAddonSet = new Set(selection.addonIds ?? []);

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

	// Підсумкова сума
	const totalPrice = Math.max(0, basePrice + modifiersPrice + masterExtra + addonsPrice);

	// Розрахунок авансу
	let depositAmount = 0;
	const paymentType = paymentModel.type ?? 'percent';

	if (paymentType === 'none') {
		depositAmount = 0;
	} else if (paymentType === 'full') {
		depositAmount = totalPrice;
	} else if (paymentType === 'fixed') {
		const fixed = Number(paymentModel.fixedAmount ?? 200);
		depositAmount = Math.min(totalPrice, Math.max(0, fixed));
	} else {
		// percent (за замовчуванням 30%)
		const pct = Number(paymentModel.percentValue ?? 30);
		depositAmount = Math.round((totalPrice * pct) / 100);
	}

	return {
		serviceId,
		serviceName,
		basePrice,
		modifiersPrice,
		activeModifiers,
		masterId: selection.masterId ?? null,
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
