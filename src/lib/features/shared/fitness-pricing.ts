import type {
	FitnessFlowData,
	FitnessTariff,
	FitnessClub,
	FitnessAddon,
	FitnessTariffPeriod
} from './checkout-scenario-config';

export type FitnessOrderMode = 'new_membership' | 'renewal' | 'addon_only' | 'reception_pay';

export interface FitnessOrderSelections {
	mode: FitnessOrderMode;
	clubId: string;
	tariffId: string;
	startDateType: 'today' | 'custom_date';
	customStartDate?: string;
	selectedAddonIds: string[];
	trainingCount: number; // e.g. 4
	towelCount: number;
	clientName: string;
	clientPhone: string;
	clientEmail?: string;
	memberCardId?: string;
	renewalTargetPeriod?: FitnessTariffPeriod;
	receptionReceiptId?: string;
	receptionAmount?: number;
}

export interface FitnessBreakdownItem {
	label: string;
	amount: number;
	amountCents: number;
	category: 'tariff' | 'access' | 'resource' | 'credits' | 'usage' | 'reception';
	details?: string;
}

export interface DigitalMembershipCard {
	cardCode: string;
	memberId: string;
	memberName: string;
	clubName: string;
	tariffName: string;
	period: FitnessTariffPeriod;
	startDateFormatted: string;
	endDateFormatted: string;
	status: 'active' | 'pending_start' | 'expired';
	statusLabel: string;
	allowedZones: string[];
	assignedLocker?: string;
	trainingCreditsTotal: number;
	trainingCreditsRemaining: number;
	towelIncluded: boolean;
	qrCodePayload: string;
}

export interface FitnessPricingResult {
	totalAmount: number;
	totalAmountCents: number;
	depositAmount: number;
	depositAmountCents: number;
	breakdown: FitnessBreakdownItem[];
	summaryLabel: string;
	canInstantPay: boolean;
	isEstimate: boolean;
	estimateNotice?: string;
	startDateFormatted: string;
	endDateFormatted: string;
	validityDaysNotice: string;
	issuedCard: DigitalMembershipCard;
}

/**
 * Calculates end date for a membership period starting on startDate.
 * - 'day': ends on the same date at the end of club working hours.
 * - 'week': exactly 7 calendar days inclusive (starts day 1, ends day 7).
 * - 'month': 1 calendar month (e.g. 19.09 -> 19.10, 31.01 -> 28.02).
 */
export function calculateMembershipEndDate(
	startDateStr: string,
	period: FitnessTariffPeriod
): { endDateStr: string; daysCount: number } {
	const start = new Date(startDateStr);
	if (isNaN(start.getTime())) {
		const now = new Date();
		return { endDateStr: now.toISOString().split('T')[0], daysCount: 1 };
	}

	if (period === 'day') {
		return { endDateStr: start.toISOString().split('T')[0], daysCount: 1 };
	}

	if (period === 'week') {
		const end = new Date(start);
		end.setDate(end.getDate() + 6);
		return { endDateStr: end.toISOString().split('T')[0], daysCount: 7 };
	}

	// Month: 1 calendar month
	const startYear = start.getFullYear();
	const startMonth = start.getMonth();
	const startDay = start.getDate();

	const targetMonth = startMonth + 1;
	const end = new Date(startYear, targetMonth, startDay);
	// Handle month overflow (e.g. Jan 31 -> Mar 2 or 3 in non-leap/leap year)
	if (end.getMonth() !== targetMonth % 12) {
		end.setDate(0); // Sets to the last day of target month (e.g. Feb 28 or 29)
	}

	const diffTime = Math.abs(end.getTime() - start.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

	return { endDateStr: end.toISOString().split('T')[0], daysCount: diffDays };
}

export function formatUkrainianDate(isoDateStr: string): string {
	try {
		const parts = isoDateStr.split('-');
		if (parts.length === 3) {
			return `${parts[2]}.${parts[1]}.${parts[0]}`;
		}
		const d = new Date(isoDateStr);
		return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
	} catch {
		return isoDateStr;
	}
}

/**
 * Calculates fitness center order pricing and membership rights.
 * Canonical prompt test case:
 * Month tariff (1 800 ₴) + Pool (600 ₴) + Locker (300 ₴) + 4 Trainings (2 000 ₴) = 4 700 ₴.
 */
export function calculateFitnessOrderPrice(
	flowData: Partial<FitnessFlowData>,
	selections: FitnessOrderSelections
): FitnessPricingResult {
	const clubs = flowData.clubs ?? [];
	const selectedClub = clubs.find((c) => c.id === selections.clubId) ?? clubs[0] ?? {
		id: 'club_podil',
		name: 'Фітнес-Клуб «Pulse Podil»',
		address: 'м. Київ, вул. Спаська, 22',
		workingHours: 'Пн-Пт: 07:00 – 23:00, Сб-Нд: 09:00 – 21:00',
		phone: '+380 44 333 22 11',
		amenities: ['Тренажерний зал', 'Басейн 25м', 'Фінська сауна', 'Зал єдиноборств'],
		availableTariffIds: ['day', 'week', 'month']
	};

	const tariffs = flowData.tariffs ?? [];
	const selectedTariff = tariffs.find((t) => t.id === selections.tariffId) ?? tariffs[2] ?? {
		id: 'tariff_month',
		name: 'Місячний безліміт',
		period: 'month' as FitnessTariffPeriod,
		price: 1800,
		description: 'Тренажерний зал, кардіо-зона, вступний інструктаж та сауна',
		includesGym: true,
		includesPool: false,
		includesSauna: true,
		durationDays: 30,
		allowedHoursNotice: 'Без обмежень у часі (07:00 – 23:00)'
	};

	// Start date resolution
	const todayIso = new Date().toISOString().split('T')[0];
	const rawStartDate = selections.startDateType === 'today'
		? todayIso
		: (selections.customStartDate || todayIso);

	const { endDateStr, daysCount } = calculateMembershipEndDate(rawStartDate, selectedTariff.period);

	// Date formatted strings
	const startFormatted = formatUkrainianDate(rawStartDate);
	const endFormatted = formatUkrainianDate(endDateStr);

	let totalAmount = 0;
	const breakdown: FitnessBreakdownItem[] = [];

	let includesPool = selectedTariff.includesPool;
	let assignedLocker: string | undefined = undefined;
	let trainingCredits = 0;
	let towelIncluded = false;
	let requiresManualApproval = false;
	let estimateNotice: string | undefined = undefined;

	// Mode 1: New Membership or Mode 2: Renewal
	if (selections.mode === 'new_membership' || selections.mode === 'renewal') {
		const tariffLabel = selections.mode === 'renewal'
			? `Продовження: ${selectedTariff.name} (${selectedTariff.period === 'day' ? '1 день' : selectedTariff.period === 'week' ? '7 днів' : '1 місяць'})`
			: `Абонемент: ${selectedTariff.name} (${selectedTariff.period === 'day' ? '1 день' : selectedTariff.period === 'week' ? '7 днів' : '1 місяць'})`;

		totalAmount += selectedTariff.price;
		breakdown.push({
			label: tariffLabel,
			amount: selectedTariff.price,
			amountCents: Math.round(selectedTariff.price * 100),
			category: 'tariff',
			details: `Діє з ${startFormatted} до ${endFormatted}`
		});

		// Process Addons
		const allAddons = flowData.addons ?? [];
		for (const addonId of selections.selectedAddonIds) {
			const addon = allAddons.find((a) => a.id === addonId);
			if (!addon) continue;

			if (addon.category === 'access') {
				// Pool access
				includesPool = true;
				totalAmount += addon.price;
				breakdown.push({
					label: `${addon.name} (на строк абонемента)`,
					amount: addon.price,
					amountCents: Math.round(addon.price * 100),
					category: 'access',
					details: `Безлімітний басейн до ${endFormatted}`
				});
			} else if (addon.category === 'resource') {
				// Locker
				assignedLocker = 'Шафка #142 (Чоловіча роздягальня)';
				totalAmount += addon.price;
				breakdown.push({
					label: `${addon.name} (на строк абонемента)`,
					amount: addon.price,
					amountCents: Math.round(addon.price * 100),
					category: 'resource',
					details: 'Закріплена персональна шафка'
				});
			} else if (addon.category === 'credits') {
				// Personal trainings package
				const count = addon.creditCount || selections.trainingCount || 4;
				trainingCredits = count;
				totalAmount += addon.price;
				breakdown.push({
					label: `${addon.name} (${count} тренування)`,
					amount: addon.price,
					amountCents: Math.round(addon.price * 100),
					category: 'credits',
					details: `${count} занять із сертифікованим тренером (без прив'язки до дати)`
				});
			} else if (addon.category === 'usage') {
				// Towel
				towelIncluded = true;
				totalAmount += addon.price;
				breakdown.push({
					label: `${addon.name} (1 шт)`,
					amount: addon.price,
					amountCents: Math.round(addon.price * 100),
					category: 'usage',
					details: 'Видача на рецепції при кожному відвідуванні'
				});
			}
		}
	} else if (selections.mode === 'addon_only') {
		// Buying addons for existing membership
		const allAddons = flowData.addons ?? [];
		for (const addonId of selections.selectedAddonIds) {
			const addon = allAddons.find((a) => a.id === addonId);
			if (!addon) continue;

			totalAmount += addon.price;
			breakdown.push({
				label: addon.name,
				amount: addon.price,
				amountCents: Math.round(addon.price * 100),
				category: addon.category,
				details: 'Додаткова послуга до чинного абонемента'
			});
			if (addon.category === 'credits') {
				trainingCredits += addon.creditCount || 4;
			}
			if (addon.category === 'access') {
				includesPool = true;
			}
			if (addon.category === 'resource') {
				assignedLocker = 'Шафка #142';
			}
		}
	} else if (selections.mode === 'reception_pay') {
		// Cashier mode on reception desk
		const amount = Math.max(0, selections.receptionAmount || 4700);
		totalAmount = amount;
		breakdown.push({
			label: `Рахунок рецепції ${selections.receptionReceiptId || 'REC-8291'}`,
			amount,
			amountCents: Math.round(amount * 100),
			category: 'reception',
			details: 'Розрахунок на рецепції клубу'
		});
		includesPool = true;
		assignedLocker = 'Шафка #142';
		trainingCredits = 4;
	}

	// Determine allowed zones
	const allowedZones: string[] = ['Тренажерний зал', 'Кардіо-зона'];
	if (selectedTariff.includesSauna) allowedZones.push('Фінська сауна');
	if (includesPool) allowedZones.push('Басейн 25м');

	// Determine card status
	const isFutureStart = rawStartDate > todayIso;
	const cardStatus: 'active' | 'pending_start' | 'expired' = isFutureStart ? 'pending_start' : 'active';
	const statusLabel = isFutureStart ? 'Оплачено (активується ' + startFormatted + ')' : 'Активний';

	// Digital Membership Pass
	const issuedCard: DigitalMembershipCard = {
		cardCode: selections.memberCardId || 'PULSE-84920',
		memberId: 'MEM-4829',
		memberName: selections.clientName || 'Олександр Коваленко',
		clubName: selectedClub.name,
		tariffName: selectedTariff.name,
		period: selectedTariff.period,
		startDateFormatted: startFormatted,
		endDateFormatted: endFormatted,
		status: cardStatus,
		statusLabel,
		allowedZones,
		assignedLocker,
		trainingCreditsTotal: trainingCredits,
		trainingCreditsRemaining: trainingCredits,
		towelIncluded,
		qrCodePayload: `FITNESS-PASS:${selectedClub.id}:${selections.tariffId}:${rawStartDate}:${endDateStr}:${trainingCredits}`
	};

	let validityNotice = '';
	if (selectedTariff.period === 'day') {
		validityNotice = `Діє 1 день (${startFormatted}) у робочі години клубу`;
	} else if (selectedTariff.period === 'week') {
		validityNotice = `Діє 7 календарних днів (з ${startFormatted} до ${endFormatted})`;
	} else {
		validityNotice = `Діє 1 календарний місяць (з ${startFormatted} до ${endFormatted})`;
	}

	return {
		totalAmount,
		totalAmountCents: Math.round(totalAmount * 100),
		depositAmount: totalAmount,
		depositAmountCents: Math.round(totalAmount * 100),
		breakdown,
		summaryLabel: `${selectedTariff.name} · ${selectedClub.name}`,
		canInstantPay: !requiresManualApproval,
		isEstimate: false,
		estimateNotice,
		startDateFormatted: startFormatted,
		endDateFormatted: endFormatted,
		validityDaysNotice: validityNotice,
		issuedCard
	};
}

/**
 * Prunes invalid or unselected fields when user switches modes or tariffs.
 */
export function pruneFitnessSelections(
	flowData: Partial<FitnessFlowData>,
	selections: FitnessOrderSelections
): FitnessOrderSelections {
	const cloned: FitnessOrderSelections = { ...selections };

	// Verify club exists
	const clubs = flowData.clubs ?? [];
	if (!clubs.some((c) => c.id === cloned.clubId) && clubs.length > 0) {
		cloned.clubId = clubs[0].id;
	}

	// Verify tariff exists
	const tariffs = flowData.tariffs ?? [];
	if (!tariffs.some((t) => t.id === cloned.tariffId) && tariffs.length > 0) {
		cloned.tariffId = tariffs[0].id;
	}

	// In addon_only mode, don't charge tariff
	if (cloned.mode === 'addon_only') {
		// Keep addons
	}

	return cloned;
}
