/**
 * Checkout Scenario Configuration — shared contract between
 * Dashboard (merchant configuration) and apps/pay (payer checkout).
 *
 * Every boolean flag controls the visibility of a specific UI block
 * on the payer's checkout screen. The merchant sets these values
 * when creating an invoice in the Dashboard; the checkout reads them
 * from `order.scenario_config` and renders blocks accordingly.
 */

export interface CheckoutFlowReference {
	/** Renderer identifier registered by the checkout application. */
	id: string;
	/** Contract version for this flow's JSON payload. */
	version: number;
	/** Stable financial behavior used when the renderer ID is vertical-specific. */
	invoice_type?: CheckoutFlowInvoiceType;
}

export type CheckoutFlowId = string;
export type CheckoutFlowInvoiceType = 'fixed' | 'open_amount' | 'table' | 'delivery';
export const CHECKOUT_FLOW_CONTRACT_VERSION = 1;

export interface CheckoutScenarioConfig {
	/** Keeps UI flow identity separate from the persisted invoice/payment type. */
	checkout_flow?: CheckoutFlowReference;
	/** Renderer-owned versioned payload for vertical-specific fields. */
	flow_data?: Record<string, unknown>;

	// ── Loyalty & Discounts ──────────────────────────────────────
	/** Show loyalty card scanner (Apple Pass, barcode) */
	allow_loyalty: boolean;
	/** Show promo code / coupon input field */
	allow_promo: boolean;
	/** Promo discount amount in ₴ (used when allow_promo is true) */
	promo_discount?: number;

	// ── HoReCa ───────────────────────────────────────────────────
	/** Show tips selection (percentage or fixed presets) */
	allow_tips: boolean;
	/** Tip preset values (percentages like [5,10,15] or fixed ₴ like [20,50,100]) */
	tip_presets?: number[];
	/** Allow splitting the bill between guests */
	allow_split: boolean;

	// ── Charity & Social ─────────────────────────────────────────
	/** Show round-up donation for Ukrainian Armed Forces (ЗСУ) */
	allow_roundup: boolean;

	// ── Payment Options ──────────────────────────────────────────
	/** Show Buy Now Pay Later (BNPL / Оплата частинами) */
	allow_bnpl: boolean;
	/** Show other payment methods / banks in bottom sheet */
	show_other_banks: boolean;

	// ── Order Enhancements ───────────────────────────────────────
	/** Show upsell / order bump section before checkout */
	allow_upsell: boolean;
	/** Show delivery method selection (Nova Poshta / courier) */
	allow_delivery: boolean;

	// ── Compliance & Fiscal ──────────────────────────────────────
	/** Show DAC7 compliance card (Digital Platforms Law) */
	allow_compliance_card: boolean;

	// ── Post-Payment ─────────────────────────────────────────────
	/** Show NPS rating & review after successful payment */
	allow_nps_review: boolean;

	// ── UI Customization ─────────────────────────────────────────
	/** Quick amount buttons for keypad scenarios (e.g. [50, 100, 200, 500]) */
	quick_amounts?: number[];
	/** Custom CTA button text (e.g. "Оплатити", "Задонатити", "Підтвердити") */
	cta_text?: string;
	/** Checkout theme override */
	theme?: 'dark' | 'light';

	/** Allow future extensibility */
	[key: string]: unknown;
}

export const CHECKOUT_TEMPLATE_SCENARIOS = [
	// Legacy / Core
	'fixed',
	'table',
	'delivery',
	'tips',
	'open_amount',
	'fuel_station',

	// Standard Checkout Engines
	'engine_buy',
	'engine_order',
	'engine_book',
	'engine_quote',
	'engine_deliver',
	'engine_split',

	// Vertical Templates
	'vertical_food',
	'vertical_flowers',
	'vertical_auto',
	'vertical_beauty',
	'vertical_cleaning',
	'vertical_pets',
	'vertical_rental',
	'vertical_education',
	'vertical_services',
	'vertical_delivery',
	'vertical_print',
	'vertical_gifts'
] as const;
export type CheckoutTemplateScenario = (typeof CHECKOUT_TEMPLATE_SCENARIOS)[number];

export function isCheckoutFlowId(value: unknown): value is CheckoutFlowId {
	return typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

export function isCheckoutTemplateScenario(value: unknown): value is CheckoutTemplateScenario {
	return (
		typeof value === 'string' &&
		CHECKOUT_TEMPLATE_SCENARIOS.includes(value as CheckoutTemplateScenario)
	);
}

/** All boolean keys of CheckoutScenarioConfig for iteration */
export const CHECKOUT_CONFIG_BOOLEAN_KEYS = [
	'allow_loyalty',
	'allow_promo',
	'allow_roundup',
	'allow_tips',
	'allow_split',
	'allow_bnpl',
	'allow_upsell',
	'allow_delivery',
	'allow_compliance_card',
	'allow_nps_review',
	'show_other_banks'
] as const satisfies ReadonlyArray<keyof CheckoutScenarioConfig>;

export type CheckoutConfigBooleanKey = (typeof CHECKOUT_CONFIG_BOOLEAN_KEYS)[number];

// ── Beauty Studio Scenario Contract ───────────────────────────
export interface BeautyOption {
	id: string;
	title: string;
	subtitle?: string;
	extraPrice: number; // in UAH
}

export interface BeautyQuestion {
	id: string;
	title: string;
	hint?: string;
	required: boolean;
	dependsOnServiceId?: string; // e.g. 'female_haircut'
	options: BeautyOption[];
}

export interface BeautyMaster {
	id: string;
	name: string;
	role: string; // 'Стиліст', 'Провідний майстер', 'Топ-стиліст'
	extraPrice: number; // e.g. +200 UAH
	availableServiceIds?: string[];
}

export interface BeautyAddon {
	id: string;
	name: string;
	description?: string;
	price: number; // e.g. +250 UAH
}

export interface BeautyStudioFlowData {
	studioName?: string;
	title?: string;
	description?: string;
	contacts?: {
		phone?: string;
		instagram?: string;
		address?: string;
	};
	modes: {
		bookingEnabled: boolean; // Шлях "Записатися"
		inSalonPayEnabled: boolean; // Шлях "Оплатити в салоні"
		bookingButtonText?: string;
		inSalonButtonText?: string;
	};
	services: Array<{
		id: string;
		name: string;
		category?: string;
		durationMinutes: number;
		basePrice: number;
		description?: string;
	}>;
	questions: BeautyQuestion[];
	masters: BeautyMaster[];
	addons: BeautyAddon[];
	paymentModel: {
		type: 'none' | 'fixed' | 'percent' | 'full';
		percentValue?: number; // e.g. 30
		fixedAmount?: number;  // e.g. 200
	};
	approval: {
		channel: 'telegram' | 'dashboard';
		responseTimeNotice?: string;
	};
	[key: string]: unknown;
}

// ── Grooming Scenario Contract ─────────────────────────────────
export type GroomingPetType = 'dog' | 'cat';
export type GroomingCoatLength = 'short' | 'medium' | 'long';
export type GroomingCoatCondition = 'clean' | 'matted' | 'unsure';

export interface GroomingWeightTier {
	id: string;
	label: string; // "до 5 кг включно", "понад 5 до 10 кг включно", "понад 10 до 20 кг включно"
	maxWeightKg: number; // 5, 10, 20
	basePrice: number; // 700, 900, 1200
}

export interface GroomingService {
	id: string;
	name: string;
	petTypes: GroomingPetType[];
	requiresCoatDetails: boolean; // чи потрібні запитання про довжину шерсті та стан ковтунів
	weightTierPrices: Record<string, number>; // tierId -> price
	fixedPrice?: number; // для послуг без градації ваги (наприклад стрижка кігтів)
	durationMinutes: number;
}

export interface GroomingAddon {
	id: string;
	name: string;
	description?: string;
	price: number;
}

export interface GroomingMaster {
	id: string;
	name: string;
	role: string;
	extraPrice: number;
	allowedPetTypes: GroomingPetType[];
}

export interface GroomingStudioFlowData {
	studioName?: string;
	title?: string;
	description?: string;
	contacts?: {
		phone?: string;
		instagram?: string;
		address?: string;
	};
	modes: {
		bookingEnabled: boolean;
		inSalonPayEnabled: boolean;
		bookingButtonText?: string;
		inSalonButtonText?: string;
	};
	supportedPets: GroomingPetType[];
	weightTiers: GroomingWeightTier[];
	services: GroomingService[];
	coatOptions: Array<{ id: GroomingCoatLength; label: string; extraPrice: number }>;
	addons: GroomingAddon[];
	masters: GroomingMaster[];
	autoApproval: {
		enabled: boolean;
		noticeText?: string;
	};
	paymentModel: {
		type: 'none' | 'fixed' | 'percent' | 'full';
		percentValue?: number;
		fixedAmount?: number;
	};
	approval: {
		channel: 'telegram' | 'dashboard';
		responseTimeNotice?: string;
	};
	[key: string]: unknown;
}
