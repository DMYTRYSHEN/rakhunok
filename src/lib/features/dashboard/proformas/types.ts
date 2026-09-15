export type ProformaCurrency = 'UAH' | 'USD' | 'EUR';

export type ProformaItem = {
	id: string;
	type: 'item' | 'heading';
	name: string;
	description?: string;
	price: number;
	quantity: number;
	unit: string;
	discountPercent: number;
	total: number;
};

export type ProformaSeller = {
	entityId: string;
	name: string;
	taxId: string; // ЄДРПОУ або РНОКПП
	iban: string;
	bankName: string;
	vatStatus: 'vat' | 'no-vat';
	legalAddress?: string;
};

export type ProformaCustomer = {
	id?: string;
	name: string;
	taxId?: string;
	email?: string;
	phone?: string;
	address?: string;
};

export type ProformaPaymentMethod = {
	type: 'iban' | 'card' | 'cash';
	name: string;
	details: string;
};

export type ActType = 'services' | 'goods';
export type ActStatus = 'draft' | 'signed';

export type ActSignerInfo = {
	name: string;
	taxId: string;
	issuer: string;
	serialNumber: string;
	timestamp: string;
	signatureAlgorithm?: string;
};

export type ProformaAct = {
	id: string;
	type: ActType;
	number: string;
	date: string;
	city: string;
	proformaId: string;
	proformaNumber: string;
	proformaDate: string;
	seller: ProformaSeller;
	customer: ProformaCustomer;
	items: ProformaItem[];
	totals: ProformaTotals;
	taxRate: number;
	currency: ProformaCurrency;
	statement: string;
	status: ActStatus;
	signerInfo?: ActSignerInfo;
	signatureP7s?: string;
	signedAt?: string;
	createdAt: string;
};

export type ProformaDraft = {
	id: string;
	title: string; // 'Рахунок-фактура'
	number: string; // '01-123'
	issueDate: string; // '2026-01-01'
	dueDate: string; // '2026-01-14'
	currency: ProformaCurrency;
	seller: ProformaSeller;
	customer: ProformaCustomer;
	items: ProformaItem[];
	paymentMethod: ProformaPaymentMethod;
	purpose: string;
	notes: string;
	taxRate: number; // 20 або 0
	adjustment?: number;
	appearanceTemplate: string;
	recurrence: 'none' | 'monthly' | 'weekly' | 'quarterly';
	projectGroup: string;
	status: 'draft' | 'invoice_created' | 'cancelled';
	invoiceId?: string;
	totals?: ProformaTotals;
	act?: ProformaAct;
	createdAt: string;
};

export type ProformaTotals = {
	subtotal: number;
	discountTotal: number;
	taxAmount: number;
	adjustment: number;
	total: number;
};

