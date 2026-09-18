import type {
	GiftsFlowData,
	GiftsProductBase,
	GiftsPersonalizationOption,
	GiftsPackagingOption,
	GiftsMockupConfig,
	GiftsDeliveryConfig
} from './checkout-scenario-config';

export type GiftsOrderMode = 'personalized' | 'ready' | 'custom_idea' | 'direct_invoice';

export interface GiftsOrderSelections {
	mode: GiftsOrderMode;
	productId?: string;
	colorId?: string;
	size?: string;
	quantity: number;

	// Personalization
	hasPersonalization?: boolean;
	personalizationId?: string;
	personalizationType?: 'text' | 'file';
	customText?: string;
	isMultiName?: boolean;
	multiNames?: string[];
	font?: string;
	placement?: string;
	uploadedFileName?: string;

	// Packaging
	packagingId?: string;

	// Mockup
	includeMockup?: boolean;
	mockupVersion?: string;
	mockupApproved?: boolean;

	// Delivery
	deliveryType?: 'pickup' | 'delivery';
	pickupPointId?: string;
	deliveryAddress?: string;
	isGiftForRecipient?: boolean;
	recipientName?: string;
	recipientPhone?: string;
	desiredDeliveryDate?: string;

	// Custom idea
	customIdeaDescription?: string;
	customIdeaBudget?: number;
	customIdeaDeadline?: string;

	// Direct invoice
	invoiceNumber?: string;
	invoiceAmount?: number;
}

export interface GiftsPriceBreakdownItem {
	label: string;
	unitAmount?: number;
	quantity?: number;
	amount: number;
	amountCents: number;
	isOneTimeFee?: boolean;
	isFree?: boolean;
}

export interface GiftsPricingResult {
	mode: GiftsOrderMode;
	totalAmount: number;
	totalAmountCents: number;
	depositAmount: number;
	depositAmountCents: number;
	remainingAmount: number;
	remainingAmountCents: number;
	depositPercent: number;
	unitRate: number;
	breakdown: GiftsPriceBreakdownItem[];
	isEstimate: boolean;
	requiresManualApproval: boolean;
	canInstantPay: boolean;
	estimateNotice?: string;
	summaryLabel: string;
	leadTimeNotice: string;
	isProductionAllowed: boolean;
	productionNotice: string;
}

/**
 * Calculates exact transparent pricing for Gifts & Custom Orders.
 * Core business rules:
 * - Items fee: (basePrice + personalizationFee + packagingFee) * quantity.
 * - One-time fees (разові доплати):
 *   - Mockup fee (розроблення одного спільного макета): flat per order (+300 грн), NOT multiplied by quantity.
 *   - Delivery fee: flat per order (+150 грн), NOT multiplied by quantity.
 * - 50% deposit (аванс) & 50% balance after completion.
 * - Multi-name: if distinct names are chosen, ensures valid list of names matching quantity.
 * - Custom idea: budget is advisory, requires manual estimate & blocks instant payment.
 * - Production rule: Payment alone does NOT allow production; customer approval of mockup version is strictly required.
 */
export function calculateGiftsOrderPrice(
	flowData: Partial<GiftsFlowData> | undefined,
	selections: GiftsOrderSelections
): GiftsPricingResult {
	const mode = selections.mode || 'personalized';
	const depositPercent = flowData?.payment?.depositValue ?? 50;
	const isFullDeposit = flowData?.payment?.depositType === 'full' || depositPercent >= 100;
	const leadTimeDays = flowData?.mockup?.leadTimeDays ?? 3;
	const leadTimeNotice = `Строк виготовлення: ${leadTimeDays} робочих днів`;

	// Mode 3: Custom Idea (Індивідуальне замовлення з нуля)
	if (mode === 'custom_idea') {
		const budget = Math.max(0, selections.customIdeaBudget || 0);
		const qty = Math.max(1, selections.quantity || 1);
		return {
			mode: 'custom_idea',
			totalAmount: budget,
			totalAmountCents: Math.round(budget * 100),
			depositAmount: 0,
			depositAmountCents: 0,
			remainingAmount: budget,
			remainingAmountCents: Math.round(budget * 100),
			depositPercent: 0,
			unitRate: qty > 0 ? Math.round(budget / qty) : budget,
			breakdown: [
				{
					label: `Орієнтовний бажаний бюджет (${qty} шт)`,
					amount: budget,
					amountCents: Math.round(budget * 100)
				}
			],
			isEstimate: true,
			requiresManualApproval: true,
			canInstantPay: false,
			estimateNotice:
				'Бюджет є орієнтовним побажанням. Майстер оцінить складність виконання та надішле остаточну комерційну пропозицію.',
			summaryLabel: 'Індивідуальне замовлення (на оцінці)',
			leadTimeNotice: 'Термін узгоджується індивідуально',
			isProductionAllowed: false,
			productionNotice: 'Виготовлення розпочнеться лише після погодження умов та затвердження макета'
		};
	}

	// Mode 4: Direct Invoice (Оплата за домовленістю)
	if (mode === 'direct_invoice') {
		const amount = Math.max(0, selections.invoiceAmount || 0);
		return {
			mode: 'direct_invoice',
			totalAmount: amount,
			totalAmountCents: Math.round(amount * 100),
			depositAmount: amount,
			depositAmountCents: Math.round(amount * 100),
			remainingAmount: 0,
			remainingAmountCents: 0,
			depositPercent: 100,
			unitRate: amount,
			breakdown: [
				{
					label: selections.invoiceNumber
						? `Оплата замовлення #${selections.invoiceNumber}`
						: 'Оплата за персональним рахунком',
					amount,
					amountCents: Math.round(amount * 100)
				}
			],
			isEstimate: false,
			requiresManualApproval: false,
			canInstantPay: amount > 0,
			summaryLabel: 'Оплата за рахунком',
			leadTimeNotice: 'Відправка після зарахування коштів',
			isProductionAllowed: true,
			productionNotice: 'Замовлення узгоджене та готове до видачі/відправлення'
		};
	}

	// Modes 1 & 2: Personalized product or Ready gift
	const products = flowData?.products || [];
	const product: GiftsProductBase | undefined =
		products.find((p) => p.id === selections.productId) || products[0];

	const qty = Math.max(1, selections.quantity || 1);
	const basePrice = product?.basePrice ?? 450;
	const productName = product?.name || 'Блокнот з еко-шкіри';

	// Personalization fee (only in personalized mode)
	const isPersonalizedMode = mode === 'personalized';
	const hasPers = isPersonalizedMode && (selections.hasPersonalization ?? true);
	const persOptions = flowData?.personalization || [];
	const persOption: GiftsPersonalizationOption | undefined =
		persOptions.find((o) => o.id === selections.personalizationId) || persOptions[0];
	const persFeePerItem = hasPers ? (persOption?.pricePerItem ?? 120) : 0;
	const persName = persOption?.name || 'Іменне нанесення';

	// Packaging fee
	const packagingOptions = flowData?.packaging || [];
	const packOption: GiftsPackagingOption | undefined =
		packagingOptions.find((p) => p.id === selections.packagingId) || packagingOptions[0];
	const packFeePerItem =
		packOption && packOption.id !== 'none' ? (packOption.pricePerItem ?? 80) : 0;
	const packName = packOption && packOption.id !== 'none' ? packOption.name : null;

	// Subtotal per item
	const unitRate = basePrice + persFeePerItem + packFeePerItem;
	const itemsSubtotal = unitRate * qty;

	const breakdown: GiftsPriceBreakdownItem[] = [];

	// Item base breakdown
	breakdown.push({
		label: `${productName} (${qty} шт × ${basePrice} ₴)`,
		unitAmount: basePrice,
		quantity: qty,
		amount: basePrice * qty,
		amountCents: Math.round(basePrice * qty * 100)
	});

	if (hasPers && persFeePerItem > 0) {
		breakdown.push({
			label: `${persName} (${qty} шт × ${persFeePerItem} ₴)`,
			unitAmount: persFeePerItem,
			quantity: qty,
			amount: persFeePerItem * qty,
			amountCents: Math.round(persFeePerItem * qty * 100)
		});
	}

	if (packFeePerItem > 0 && packName) {
		breakdown.push({
			label: `${packName} (${qty} шт × ${packFeePerItem} ₴)`,
			unitAmount: packFeePerItem,
			quantity: qty,
			amount: packFeePerItem * qty,
			amountCents: Math.round(packFeePerItem * qty * 100)
		});
	}

	// One-time Mockup fee (разова доплата за розроблення одного спільного макета)
	let mockupFee = 0;
	const mockupConfig: GiftsMockupConfig | undefined = flowData?.mockup;
	const requireMockup = isPersonalizedMode && (mockupConfig?.requireMockupForPersonalized ?? true);
	const includeMockup = isPersonalizedMode && (selections.includeMockup ?? requireMockup);

	if (includeMockup && (mockupConfig?.mockupFee ?? 300) > 0) {
		mockupFee = mockupConfig?.mockupFee ?? 300;
		breakdown.push({
			label: 'Розроблення одного спільного макета',
			amount: mockupFee,
			amountCents: Math.round(mockupFee * 100),
			isOneTimeFee: true
		});
	}

	// One-time Delivery fee
	let deliveryFee = 0;
	const isDelivery = selections.deliveryType === 'delivery';
	const deliveryConfig: GiftsDeliveryConfig | undefined = flowData?.delivery;
	if (isDelivery) {
		deliveryFee = deliveryConfig?.deliveryFee ?? 150;
		breakdown.push({
			label: 'Доставка замовлення (кур’єр / служба)',
			amount: deliveryFee,
			amountCents: Math.round(deliveryFee * 100),
			isOneTimeFee: true
		});
	} else {
		breakdown.push({
			label: 'Самовивіз з майстерні',
			amount: 0,
			amountCents: 0,
			isFree: true,
			isOneTimeFee: true
		});
	}

	const totalAmount = itemsSubtotal + mockupFee + deliveryFee;
	const totalAmountCents = Math.round(totalAmount * 100);

	// Deposit calculation
	let depositAmount: number;
	if (isFullDeposit) {
		depositAmount = totalAmount;
	} else {
		depositAmount = Math.round((totalAmount * depositPercent) / 100);
	}
	const depositAmountCents = Math.round(depositAmount * 100);
	const remainingAmount = Math.max(0, totalAmount - depositAmount);
	const remainingAmountCents = Math.round(remainingAmount * 100);

	// Check manual approval conditions
	let requiresManualApproval = false;
	let estimateNotice: string | undefined;

	// Different names on each product: if different designs are needed, rule of single mockup doesn't apply
	if (isPersonalizedMode && selections.isMultiName) {
		if (selections.multiNames && selections.multiNames.length !== qty) {
			requiresManualApproval = true;
			estimateNotice = `Вказано ${selections.multiNames.length} імен для ${qty} виробів. Потрібно вказати ім'я для кожного виробу.`;
		}
	}

	// Custom file uploaded: requires review
	if (isPersonalizedMode && selections.personalizationType === 'file' && selections.uploadedFileName) {
		if (flowData?.approval?.requireManualForCustomFiles ?? true) {
			requiresManualApproval = true;
			estimateNotice =
				'Завантажений векторний файл перевірить технічний дизайнер перед запуском у роботу.';
		}
	}

	// Summary label
	let summaryLabel = isPersonalizedMode
		? `Персоналізований подарунок: ${productName} (${qty} шт)`
		: `Готовий подарунок: ${productName} (${qty} шт)`;

	// Mockup approval status & Production authorization
	const isMockupApproved = !includeMockup || (selections.mockupApproved ?? false);
	const isProductionAllowed = isMockupApproved;
	const productionNotice = isProductionAllowed
		? '✅ Макет затверджено. Замовлення передається у виробництво після оплати авансу.'
		: '⚠️ Оплата авансу бронює виробничу чергу, але виготовлення починається виключно після вашого затвердження фінального макета v1.';

	return {
		mode,
		totalAmount,
		totalAmountCents,
		depositAmount,
		depositAmountCents,
		remainingAmount,
		remainingAmountCents,
		depositPercent: isFullDeposit ? 100 : depositPercent,
		unitRate,
		breakdown,
		isEstimate: false,
		requiresManualApproval,
		canInstantPay: !requiresManualApproval && totalAmount > 0,
		estimateNotice,
		summaryLabel,
		leadTimeNotice,
		isProductionAllowed,
		productionNotice
	};
}

/**
 * Prunes invalid or stale selections when switching base product or order mode.
 */
export function pruneGiftsSelections(
	flowData: Partial<GiftsFlowData> | undefined,
	selections: GiftsOrderSelections
): GiftsOrderSelections {
	const result = { ...selections };
	const products = flowData?.products || [];
	const currentProduct = products.find((p) => p.id === result.productId) || products[0];

	if (currentProduct) {
		result.productId = currentProduct.id;

		// Ensure color is valid for current product
		if (currentProduct.colors && currentProduct.colors.length > 0) {
			const colorValid = currentProduct.colors.some((c) => c.id === result.colorId);
			if (!colorValid) {
				result.colorId = currentProduct.colors[0].id;
			}
		}

		// Ensure size is valid
		if (currentProduct.sizes && currentProduct.sizes.length > 0) {
			const sizeValid = currentProduct.sizes.includes(result.size || '');
			if (!sizeValid) {
				result.size = currentProduct.sizes[0];
			}
		}

		// If product does not allow file upload, revert to text
		if (!currentProduct.allowFileUpload && result.personalizationType === 'file') {
			result.personalizationType = 'text';
			result.uploadedFileName = undefined;
		}
	}

	// Adjust multiNames array length to match quantity
	if (result.isMultiName) {
		const targetLength = Math.max(1, result.quantity || 1);
		const names = [...(result.multiNames || [])];
		if (names.length > targetLength) {
			result.multiNames = names.slice(0, targetLength);
		} else {
			while (names.length < targetLength) {
				names.push('');
			}
			result.multiNames = names;
		}
	}

	// Clear delivery address if pickup
	if (result.deliveryType === 'pickup') {
		result.deliveryAddress = undefined;
		result.recipientName = undefined;
		result.recipientPhone = undefined;
		result.isGiftForRecipient = false;
	}

	return result;
}
