// Types for DAC7 / Digital Platforms Law № 4903-IX Ecosystem in corex

export type Dac7Role =
	| 'admin'     // Admin Rights & Permission Hub (Керування ролями та доступами)
	| 'platform'  // Bolt Food / Uklon фіндиректор (виплати, батчі, 10% ПДФО, DAC7 XML)
	| 'seller'    // Самозайнятий кур'єр (доходи, денні батчі, документи, реквізити)
	| 'gov'       // ДПС / Мінфін / НБУ (агрегована телеметрія, fraud-ризики)
	| 'dev'       // Інтеграція платформи (API ключі, webhooks, симулятор подій)
	| 'sso'       // Rahunok ID (Дія.Підпис верифікація та SSO провайдер)
	| 'passport'; // Rahunok Auth (Passkeys/FaceID, 5-значний pinPay, Retail Loyalty KCO)

export type KycStatus = 'pending' | 'tier1' | 'tier2' | 'blocked';
export type PayoutStatus = 'paid' | 'processing' | 'hold' | 'failed' | 'scheduled';
export type PayoutMode = 'daily' | 'instant';

export interface Dac7Seller {
	id: string;
	name: string;
	role: string;
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
	isGoodsSeller?: boolean;
	goodsSalesYtd?: number;
	goodsSalesCount?: number;
	address?: string;
	dob?: string;
	rnokpp?: string;
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

export interface Dac7IncomeTransaction {
	id: string;
	p: string;
	d: string;
	gross: number;
	tax: number;
	net: number;
	date: string;
	time: string;
	batch: string;
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
