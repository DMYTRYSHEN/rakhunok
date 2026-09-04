export type InvoiceStatus = 'paid' | 'pending' | 'failed' | 'cancelled';
export type InvoiceType = 'fixed' | 'open_amount' | 'table' | 'delivery' | 'recurring' | 'rtp';
export type PersistedInvoiceType = Exclude<InvoiceType, 'recurring' | 'rtp'>;
export type InvoiceLifecycleStatus =
	'draft' | 'pending' | 'preparing' | 'ready' | 'paid' | 'expired' | 'cancelled' | 'failed';

export type DashboardMerchant = {
	id: string;
	userId: string;
	businessName: string;
	displayName: string;
};

export type MerchantSettings = {
	tableOrderTtlSeconds: number;
};

export type DashboardUser = {
	id: string;
	email: string | null;
	fullName: string | null;
};

export type MerchantOnboardingInput = {
	businessName: string;
	businessType: 'fop' | 'tov';
	taxId: string;
	iban: string;
	displayName: string;
	bankName: string;
};

export type ScenarioConfig = {
	allow_loyalty?: boolean;
	allow_promo?: boolean;
	allow_tips?: boolean;
	allow_roundup?: boolean;
	allow_split?: boolean;
};

export type InvoiceCreateInput = {
	type: PersistedInvoiceType;
	reference: string;
	title: string;
	description?: string;
	amount: number;
	deliveryFee?: number;
	tableNumber?: number;
	terminalId?: string;
	scenario_config?: ScenarioConfig;
};

export type InvoiceSummary = {
	id: string;
	reference: string;
	title: string;
	amount: number;
	status: InvoiceStatus;
	createdAt: string;
	channel: 'QR' | 'Link' | 'POS';
};

export type InvoiceRecord = InvoiceSummary & {
	shortId: string | null;
	type: InvoiceType;
	lifecycleStatus: InvoiceLifecycleStatus;
	description: string | null;
	baseAmount: number;
	discountAmount: number;
	deliveryFee: number;
	currency: string;
	tableNumber: number | null;
	terminalId: string | null;
	paidAt: string | null;
	paidBankCode: string | null;
	expiresAt: string | null;
};

export type InvoiceEvent = {
	id: string;
	type: string;
	actorName: string | null;
	bankCode: string | null;
	previousBankCode: string | null;
	createdAt: string;
};

export type PosTerminal = {
	id: string;
	name: string;
	code: string;
	type: 'table' | 'kasa' | 'dynamic_qr' | 'nfc_tag' | 'courier';
	entityId: string;
	isActive: boolean;
};

export type PosActiveOrder = {
	id: string;
	terminalId: string;
	title: string;
	amount: number;
	status: 'pending' | 'paid';
	createdAt: string;
};

export type PosBoard = {
	terminals: PosTerminal[];
	activeOrders: PosActiveOrder[];
};

export type BusinessEntity = {
	id: string;
	businessType: 'fop' | 'tov' | 'self_employed' | 'ngo';
	businessName: string;
	displayName: string;
	taxId: string;
	bankName: string;
	iban: string;
	isActive: boolean;
};

export type BusinessEntityInput = Omit<BusinessEntity, 'id' | 'isActive'>;

export type TerminalInput = {
	entityId: string;
	name: string;
	code: string;
	type: PosTerminal['type'];
};

export type BusinessStructureData = {
	entities: BusinessEntity[];
	terminals: PosTerminal[];
};

export type OverviewMetric = {
	label: string;
	value: string;
	detail: string;
	tone: 'primary' | 'success' | 'neutral';
};

export type OverviewSnapshot = {
	merchantName: string;
	metrics: OverviewMetric[];
	recentInvoices: InvoiceSummary[];
};

export type DashboardSessionState =
	| { status: 'loading' }
	| { status: 'configuration-required' }
	| { status: 'guest' }
	| { status: 'onboarding'; user: DashboardUser }
	| {
			status: 'ready';
			user: DashboardUser;
			merchant: DashboardMerchant;
			snapshot: OverviewSnapshot;
	  }
	| { status: 'error'; message: string };
