// Types for DAC7 / Digital Platforms Law № 4903-IX Ecosystem in corex

export type Dac7Role =
	| 'admin' // Admin Rights & Permission Hub (Керування ролями та доступами)
	| 'platform' // Bolt Food / Uklon фіндиректор (виплати, батчі, 10% ПДФО, DAC7 XML)
	| 'seller' // Самозайнятий кур'єр (доходи, денні батчі, документи, реквізити)
	| 'gov' // ДПС / Мінфін / НБУ (агрегована телеметрія, fraud-ризики)
	| 'dev' // Інтеграція платформи (API ключі, webhooks, симулятор подій)
	| 'sso' // Rahunok ID (Дія.Підпис верифікація та SSO провайдер)
	| 'passport' // Rahunok Auth (Passkeys/FaceID, 5-значний pinPay, Retail Loyalty KCO)
	| 'business'; // Business merchant / FOP account

export type KycStatus = 'pending' | 'tier1' | 'tier2' | 'blocked';
export type PayoutStatus = 'paid' | 'processing' | 'hold' | 'failed' | 'scheduled';
export type PayoutMode = 'daily' | 'instant';

export type SellerCategory =
	| 'platform_gig' // Платформний виконавець (10% ПДФО, 0% ВЗ, спецрахунок, до 834 МЗП)
	| 'fop' // Зареєстрований ФОП (1, 2, 3 група; 0% утримання платформою, код 157)
	| 'goods_casual' // Продавець речей (De Minimis: 30 угод / 2 000 €)
	| 'property_rental' // Оренда нерухомості (житлова/комерційна, кадастровий номер, адреса, дні оренди)
	| 'transport_rental' // Оренда транспорту (авто, каршеринг, VIN, держномер, дні)
	| 'independent_pro' // Незалежна професійна діяльність (ст. 178 ПКУ: репетитори, психологи, юристи)
	| 'corporate_entity' // Корпоративний мерчант (ТОВ / VARUS, ЄДРПОУ, ПДВ)
	| 'excluded_seller'; // Виключений продавець (держоргани, великі готелі >2000 оренд)

export interface PropertyRentalDetails {
	address: string;
	cadastralNumber: string;
	rentalDays: number;
	propertyType: 'residential' | 'commercial' | 'parking';
	unitsCount: number;
}

export interface TransportRentalDetails {
	vin: string;
	plateNumber: string;
	model: string;
	rentalDays: number;
	vehicleType: 'car' | 'van' | 'scooter' | 'special';
}

export interface IndependentProDetails {
	certNumber: string;
	activityType: string;
	pkuArticle: '178';
	registeredTaxOffice: string;
}

export interface CorporateDetails {
	edrpou: string;
	companyName: string;
	isVatPayer: boolean;
	vatNumber?: string;
}

export interface DeMinimisDetails {
	salesCount: number;
	maxSalesThreshold: number; // 30 transactions
	salesTotalEur: number;
	maxEurThreshold: number; // 2,000 EUR
	isExempt: boolean;
}

export interface PlatformThresholdDetails {
	annualLimitUah: number; // 834 minimum wages = 7,211,598 UAH
	currentEarnedUah: number;
	isExceeded: boolean;
	excessEarnedUah: number;
	baseTaxRate: number; // 0.10 (10%)
	excessTaxRate: number; // 0.18 (18%)
}

export interface Dac7Seller {
	id: string;
	name: string;
	role: string;
	category: SellerCategory;
	kyc: KycStatus;
	iban: boolean;
	ibanFormatted?: string;
	bankName?: string;
	score: number;
	earned: number;
	city: string;
	since: string;
	last: string;
	mode: PayoutMode;
	isFop?: boolean;
	fopGroup?: 1 | 2 | 3 | 'general';
	fopTaxRate?: number;
	isGoodsSeller?: boolean;
	goodsSalesYtd?: number;
	goodsSalesCount?: number;
	address?: string;
	dob?: string;
	rnokpp?: string;
	propertyDetails?: PropertyRentalDetails;
	transportDetails?: TransportRentalDetails;
	professionalDetails?: IndependentProDetails;
	corporateDetails?: CorporateDetails;
	deMinimis?: DeMinimisDetails;
	thresholdDetails?: PlatformThresholdDetails;
}

export interface Dac7Payout {
	id: string;
	seller: string;
	sid: string;
	gross: number;
	tax: number;
	net: number;
	st: PayoutStatus;
	rail: string;
	date: string;
	type: string;
	tenantId?: string;
}

export interface Dac7Batch {
	id: string;
	seller: string;
	sid: string;
	date: string;
	txs: number;
	gross: number;
	tax: number;
	net: number;
	st: PayoutStatus;
	eta: string;
}

export interface Dac7PaymentEvent {
	id: string;
	orderId: string;
	customer: string;
	merchantId?: string;
	amount: number; // UAH
	amountMinor?: number; // kopecks
	feeMinor?: number; // platform/acquiring fee in kopecks
	status: 'paid' | 'refunded' | 'disputed';
	date: string;
}

export interface Dac7IncomeTransaction {
	id: string;
	orderId: string;
	p: string;
	d: string;
	courierRnokpp?: string;
	serviceFeeMinor?: number;
	bonusMinor?: number;
	tipsMinor?: number;
	gross: number; // Total gross in UAH
	tax: number; // 10% PIT (ПДФО) in UAH, NO military tax
	net: number; // 90% Net payout in UAH
	date: string;
	time: string;
	batch?: string;
	deliveryStatus: 'ASSIGNED' | 'ACCEPTED' | 'IN_DELIVERY' | 'DELIVERED' | 'ADJUSTED' | 'CANCELLED';
	deliveryCompletedAt?: string;
	adjustmentReason?: string;
	originalTxId?: string;
}

export type Dac7IncidentType =
	| 'UNDELIVERED_LOST' // Кур'єр не довіз вантаж
	| 'DAMAGED_COURIER_FAULT' // Пошкоджено товар з вини кур'єра
	| 'COURIER_REASSIGNED' // Поломка транспорту / перепризначення іншому кур'єру
	| 'CUSTOMER_REJECTED' // Відмова клієнта на порозі (послуга доставки виконана)
	| 'PARTIAL_REFUND_OUT_OF_STOCK' // Відсутній товар у чеку магазину
	| 'BANK_IBAN_REJECTED'; // Банк відхилив платіж у СЕП

export interface Dac7IncidentRecord {
	id: string;
	orderId: string;
	courierRnokpp: string;
	courierName: string;
	incidentType: Dac7IncidentType;
	description: string;
	customerAction: string; // Напр. 'Повне повернення 930 ₴'
	merchantAction: string; // Напр. 'Відшкодування втраченого товару 850 ₴'
	courierAction: string; // Напр. 'Винагорода 0 ₴ (сторнування доходу)'
	taxImpact: string; // 'ПДФО 0.00 ₴ (база 0 ₴)'
	status: 'resolved' | 'under_review';
	resolvedAt: string;
}

export interface Dac7QuarterlyAggregate {
	fiscalYear: number;
	quarter: 1 | 2 | 3 | 4;
	courierRnokpp: string;
	courierName: string;
	courierIban: string;
	totalGross: number;
	totalPitTax: number; // 10% PIT
	transactionsCount: number;
}

export interface Dac7TreasuryPaymentInstruction {
	docNumber: string;
	kbk: string; // 11010100
	recipientName: string; // ГУК у м.Києві/Печерський р-н/11010100
	recipientIban: string;
	recipientEdrpou: string;
	amount: number;
	purpose: string; // Structured NBU format
	payerEdrpou: string;
	date: string;
}

export interface Dac7GovPlatform {
	id: string;
	name: string;
	sellers: number;
	flow: number;
	volume: string;
	dac7: string;
	score: number;
	st: 'ok' | 'warn' | 'bad';
}

export interface Dac7FraudAlert {
	t: string;
	lvl: 'high' | 'mid' | 'low';
	ago: string;
}

export interface Dac7DiiaSession {
	id: string;
	sessionId: string;
	rnokpp: string;
	name: string;
	status: string;
	p7sHash: string;
	date: string;
	tenant: string;
}

export interface Dac7PinPaySession {
	pinCode: string;
	expiresAt: string;
	requestId: string;
	amount?: number;
	tenantId: string;
	status: 'active' | 'used' | 'expired';
}

export interface Dac7PasskeyCredential {
	id: string;
	deviceName: string;
	type: 'FaceID' | 'TouchID' | 'Windows Hello' | 'FIDO2';
	createdAt: string;
	lastUsedAt: string;
}

export interface Dac7LoyaltyCard {
	id: string;
	networkId: 'varus' | 'silpo' | 'atb' | 'epicentr';
	networkName: string;
	cardName: string;
	cardNumber: string;
	points: number;
	discountPct: number;
	logoBg: string;
	textColor: string;
	isLinked: boolean;
}

export interface Dac7RolePermission {
	userId: string;
	email: string;
	fullName: string;
	role: Dac7Role;
	assignedAt: string;
	assignedBy: string;
	isLiveAllowed: boolean;
}
