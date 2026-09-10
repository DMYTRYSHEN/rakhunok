import type {
	Dac7Seller,
	Dac7Payout,
	Dac7Batch,
	Dac7IncomeTransaction,
	Dac7GovPlatform,
	Dac7FraudAlert,
	Dac7DiiaSession,
	Dac7LoyaltyCard
} from './types';

export const fmt = (n: number) => n.toLocaleString('uk-UA');

export const KYC_META: Record<string, { l: string; t: 'ok' | 'blue' | 'warn' | 'bad' }> = {
	tier2: { l: 'Tier-2 · Дія', t: 'ok' },
	tier1: { l: 'Tier-1 · 1 грн СЕП', t: 'blue' },
	pending: { l: 'Очікує KYC', t: 'warn' },
	blocked: { l: 'Заблоковано', t: 'bad' }
};

export const PO_META: Record<string, { l: string; t: 'ok' | 'blue' | 'warn' | 'bad' }> = {
	paid: { l: 'виплачено', t: 'ok' },
	processing: { l: 'в обробці', t: 'blue' },
	hold: { l: 'hold · AML', t: 'warn' },
	failed: { l: 'помилка', t: 'bad' },
	scheduled: { l: 'заплановано', t: 'blue' }
};

export const revenueSeries = [
	{ m: 'Лип', payouts: 41.2, tax: 4.1 },
	{ m: 'Сер', payouts: 47.8, tax: 4.8 },
	{ m: 'Вер', payouts: 52.3, tax: 5.2 },
	{ m: 'Жов', payouts: 58.9, tax: 5.9 },
	{ m: 'Лис', payouts: 64.1, tax: 6.4 },
	{ m: 'Гру', payouts: 79.6, tax: 8.0 },
	{ m: 'Січ', payouts: 61.4, tax: 6.1 },
	{ m: 'Лют', payouts: 66.8, tax: 6.7 },
	{ m: 'Бер', payouts: 72.5, tax: 7.3 },
	{ m: 'Кві', payouts: 78.2, tax: 7.8 },
	{ m: 'Тра', payouts: 84.9, tax: 8.5 },
	{ m: 'Чер', payouts: 91.3, tax: 9.1 }
];

export interface TenantStats {
	paidToday: string;
	payoutsCount: string;
	scheduled: string;
	pendingKyc: string;
	complianceScore: number;
	unresolvedCount: { kyc: number; iban: number; name: number; sanctions: number };
	pdxo: string;
	payoutPrefix: string;
	totalSellers: number;
	verifiedSellers: number;
	needTin: number;
	needAddress: number;
	blockedSellers: number;
	underReview: number;
}

export const TENANT_DATA: Record<string, TenantStats> = {
	bolt_food: {
		paidToday: '1 284 500 ₴',
		payoutsCount: '3 412 виплат · медіана 245 ₴',
		scheduled: '418 900 ₴',
		pendingKyc: '1 306',
		complianceScore: 97,
		unresolvedCount: { kyc: 23, iban: 15, name: 8, sanctions: 2 },
		pdxo: '9 130 000 ₴',
		payoutPrefix: 'po_01J8',
		totalSellers: 128412,
		verifiedSellers: 119540,
		needTin: 4103,
		needAddress: 812,
		blockedSellers: 96,
		underReview: 14
	},
	uklon: {
		paidToday: '956 000 ₴',
		payoutsCount: '2 109 виплат · медіана 310 ₴',
		scheduled: '312 000 ₴',
		pendingKyc: '412',
		complianceScore: 99,
		unresolvedCount: { kyc: 5, iban: 3, name: 2, sanctions: 0 },
		pdxo: '6 240 000 ₴',
		payoutPrefix: 'po_01U9',
		totalSellers: 95400,
		verifiedSellers: 91200,
		needTin: 3205,
		needAddress: 640,
		blockedSellers: 32,
		underReview: 8
	},
	glovo: {
		paidToday: '512 800 ₴',
		payoutsCount: '1,245 виплат · медіана 195 ₴',
		scheduled: '184 300 ₴',
		pendingKyc: '205',
		complianceScore: 95,
		unresolvedCount: { kyc: 18, iban: 11, name: 6, sanctions: 1 },
		pdxo: '3 890 000 ₴',
		payoutPrefix: 'po_01G3',
		totalSellers: 64200,
		verifiedSellers: 59300,
		needTin: 3900,
		needAddress: 820,
		blockedSellers: 78,
		underReview: 12
	}
};

export const demoSellers: Dac7Seller[] = [
	{
		id: 'RHK-9E71AB3',
		name: 'Олексій Ткаченко',
		role: "Кур'єр",
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA51 3220 0100 0002 6000 0001 2384',
		bankName: 'Монобанк',
		score: 98,
		earned: 136800,
		city: 'Дніпро',
		since: '03.2025',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'вул. Січових Стрільців, 12, Дніпро, 49000',
		dob: '15.04.1992',
		rnokpp: '3091248192'
	},
	{
		id: 'RHK-4C20F91',
		name: 'Марія Гнатюк',
		role: 'Водійка',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA68 3052 9900 0002 6000 0004 8912',
		bankName: 'ПриватБанк',
		score: 97,
		earned: 212400,
		city: 'Київ',
		since: '11.2024',
		last: 'сьогодні',
		mode: 'daily',
		isFop: true,
		address: 'просп. Перемоги, 45, Київ, 01135',
		dob: '08.11.1988',
		rnokpp: '2847192041'
	},
	{
		id: 'RHK-B33D002',
		name: 'Ігор Савченко',
		role: 'Продавець',
		kyc: 'tier2',
		iban: true,
		score: 99,
		earned: 486200,
		city: 'Львів',
		since: '07.2024',
		last: 'вчора',
		mode: 'instant',
		isFop: false,
		isGoodsSeller: true,
		goodsSalesYtd: 2300,
		goodsSalesCount: 45,
		address: 'вул. Городоцька, 112, Львів, 79016',
		dob: '23.07.1995'
	},
	{
		id: 'RHK-77A1E45',
		name: 'Дмитро Коваль',
		role: "Кур'єр",
		kyc: 'tier1',
		iban: true,
		ibanFormatted: 'UA12 3077 7000 0002 6000 0009 1102',
		bankName: 'А-Банк',
		score: 84,
		earned: 41200,
		city: 'Одеса',
		since: '05.2026',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'вул. Дерибасівська, 1, Одеса, 65000',
		dob: '02.02.2001',
		rnokpp: '3104928172'
	}
];

export const demoBatches: Dac7Batch[] = [
	{
		id: 'bt_02070_9E71',
		seller: 'Олексій Ткаченко',
		sid: 'RHK-9E71AB3',
		date: '02.07',
		txs: 2,
		gross: 557,
		tax: 55.7,
		net: 501.3,
		st: 'scheduled',
		eta: 'сьогодні · 21:00'
	},
	{
		id: 'bt_01070_9E71',
		seller: 'Олексій Ткаченко',
		sid: 'RHK-9E71AB3',
		date: '01.07',
		txs: 2,
		gross: 1648,
		tax: 164.8,
		net: 1483.2,
		st: 'paid',
		eta: '01.07 · 21:00'
	},
	{
		id: 'bt_30060_9E71',
		seller: 'Олексій Ткаченко',
		sid: 'RHK-9E71AB3',
		date: '30.06',
		txs: 2,
		gross: 1436,
		tax: 143.6,
		net: 1292.4,
		st: 'paid',
		eta: '30.06 · 21:00'
	}
];

export const demoPayouts: Dac7Payout[] = [
	{
		id: 'po_01J8ZKR2',
		seller: 'Олексій Ткаченко',
		sid: 'RHK-9E71AB3',
		gross: 245,
		tax: 24.5,
		net: 220.5,
		st: 'paid',
		rail: 'СЕП · A2A',
		date: '02.07 · 12:41',
		type: 'instant'
	},
	{
		id: 'po_01J8ZJH8',
		seller: 'Марія Гнатюк',
		sid: 'RHK-4C20F91',
		gross: 512,
		tax: 0,
		net: 512,
		st: 'paid',
		rail: 'СЕП · A2A',
		date: '02.07 · 11:07',
		type: 'instant'
	},
	{
		id: 'po_01J8ZH2M',
		seller: 'Ігор Савченко',
		sid: 'RHK-B33D002',
		gross: 1890,
		tax: 189,
		net: 1701,
		st: 'paid',
		rail: 'СЕП · A2A',
		date: '02.07 · 10:22',
		type: 'instant'
	},
	{
		id: 'po_01J8ZFQ1',
		seller: 'Дмитро Коваль',
		sid: 'RHK-77A1E45',
		gross: 180,
		tax: 18,
		net: 162,
		st: 'hold',
		rail: '—',
		date: '02.07 · 09:58',
		type: 'instant'
	}
];

export const demoIncome: Dac7IncomeTransaction[] = [
	{
		id: 'tx_884',
		p: 'Bolt Food',
		d: 'Доставка · замовлення №884',
		gross: 245,
		tax: 24.5,
		net: 220.5,
		date: '02.07',
		time: '12:41',
		batch: 'bt_02070_9E71'
	},
	{
		id: 'tx_871',
		p: 'Uklon',
		d: 'Поїздка · Соборна → Перемога',
		gross: 312,
		tax: 31.2,
		net: 280.8,
		date: '02.07',
		time: '10:05',
		batch: 'bt_02070_9E71'
	},
	{
		id: 'tx_863',
		p: 'Bolt Food',
		d: 'Доставка · замовлення №863',
		gross: 198,
		tax: 19.8,
		net: 178.2,
		date: '01.07',
		time: '20:33',
		batch: 'bt_01070_9E71'
	},
	{
		id: 'tx_850',
		p: 'OLX',
		d: 'Продаж · велотримач',
		gross: 1450,
		tax: 145,
		net: 1305,
		date: '01.07',
		time: '14:19',
		batch: 'bt_01070_9E71'
	},
	{
		id: 'tx_842',
		p: 'Kabanchik',
		d: 'Послуга · збірка меблів',
		gross: 950,
		tax: 95,
		net: 855,
		date: '30.06',
		time: '18:02',
		batch: 'bt_30060_9E71'
	},
	{
		id: 'tx_831',
		p: 'Uklon',
		d: 'Поїздка · вокзал → аеропорт',
		gross: 486,
		tax: 48.6,
		net: 437.4,
		date: '30.06',
		time: '11:47',
		batch: 'bt_30060_9E71'
	}
];

export const demoGovPlatforms: Dac7GovPlatform[] = [
	{
		id: 'plt_bolt',
		name: 'Bolt Food',
		sellers: 12450,
		flow: 142500000,
		volume: '142.5M ₴',
		dac7: '2026-06-30',
		score: 98,
		st: 'ok'
	},
	{
		id: 'plt_uklon',
		name: 'Uklon',
		sellers: 45200,
		flow: 310200000,
		volume: '310.2M ₴',
		dac7: '2026-06-30',
		score: 95,
		st: 'ok'
	},
	{
		id: 'plt_glovo',
		name: 'Glovo',
		sellers: 18300,
		flow: 185000000,
		volume: '185.0M ₴',
		dac7: '2026-06-30',
		score: 96,
		st: 'ok'
	}
];

export const demoFraudAlerts: Dac7FraudAlert[] = [
	{
		t: 'Один IBAN у 11 профілів на 3 платформах',
		lvl: 'high',
		ago: '4 хв'
	},
	{
		t: 'Платформа зменшила відрахування −38% при стабільній базі продавців',
		lvl: 'high',
		ago: '26 хв'
	},
	{
		t: 'Сплеск реєстрацій з одного пристрою · 14 акаунтів',
		lvl: 'mid',
		ago: '1 год'
	}
];

export const demoDiiaLogs: Dac7DiiaSession[] = [
	{
		id: 'diia_sess_1092',
		sessionId: 'sess_9e71_2026',
		rnokpp: '3091248192',
		name: 'Олексій Ткаченко',
		status: 'Підтверджено',
		p7sHash: 'sha256_9f81a2e9b0c4d1...987a',
		date: '10.09.2026 14:15',
		tenant: 'Bolt Food'
	}
];

export const demoLoyaltyCards: Dac7LoyaltyCard[] = [
	{
		id: 'loy_varus',
		networkId: 'varus',
		networkName: 'VARUS',
		cardName: "Кур'єрський Бонус",
		cardNumber: '9840 •••• •••• 1029',
		points: 1840,
		discountPct: 5,
		logoBg: 'bg-orange-600',
		textColor: 'text-white',
		isLinked: true
	},
	{
		id: 'loy_silpo',
		networkId: 'silpo',
		networkName: 'Сільпо',
		cardName: 'Власний Рахунок',
		cardNumber: '9900 •••• •••• 8831',
		points: 3420,
		discountPct: 7,
		logoBg: 'bg-amber-500',
		textColor: 'text-stone-900',
		isLinked: true
	}
];
