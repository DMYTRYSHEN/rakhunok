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

export const demoSellers: Dac7Seller[] = [
	{
		id: 'RHK-9E71AB3',
		name: 'Олексій Ткаченко',
		role: "Кур'єр",
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA51 3220 0100 0002 6000 0001 2384',
		bankName: 'Монобанк (Універсал Банк)',
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
		date: '10.09.2026',
		txs: 7,
		gross: 700,
		tax: 70,
		net: 630,
		st: 'paid',
		eta: '10.09 18:30'
	},
	{
		id: 'bt_02069_4C20',
		seller: 'Марія Гнатюк (ФОП)',
		sid: 'RHK-4C20F91',
		date: '10.09.2026',
		txs: 12,
		gross: 1850,
		tax: 0,
		net: 1850,
		st: 'paid',
		eta: '10.09 19:15'
	},
	{
		id: 'bt_02068_77A1',
		seller: 'Дмитро Коваль',
		sid: 'RHK-77A1E45',
		date: '09.09.2026',
		txs: 4,
		gross: 480,
		tax: 48,
		net: 432,
		st: 'paid',
		eta: '09.09 21:00'
	}
];

export const demoPayouts: Dac7Payout[] = [
	{
		id: 'po_9921_A',
		seller: 'Олексій Ткаченко',
		sid: 'RHK-9E71AB3',
		gross: 700,
		tax: 70,
		net: 630,
		st: 'paid',
		rail: 'monobank A2C (IBAN)',
		date: '10.09.2026 18:30',
		type: 'batch_daily'
	},
	{
		id: 'po_9920_B',
		seller: 'Марія Гнатюк (ФОП)',
		sid: 'RHK-4C20F91',
		gross: 1850,
		tax: 0,
		net: 1850,
		st: 'paid',
		rail: 'privatbank IBAN',
		date: '10.09.2026 19:15',
		type: 'batch_daily'
	},
	{
		id: 'po_9919_C',
		seller: 'Дмитро Коваль',
		sid: 'RHK-77A1E45',
		gross: 480,
		tax: 48,
		net: 432,
		st: 'paid',
		rail: 'abank P2P',
		date: '09.09.2026 21:00',
		type: 'instant'
	}
];

export const demoIncome: Dac7IncomeTransaction[] = [
	{
		id: 'inc_8841',
		p: 'BOLT-884192',
		d: 'Доставка замовлення (центр)',
		gross: 110,
		tax: 11,
		net: 99,
		date: '10.09.2026',
		time: '14:15',
		batch: 'bt_02070_9E71'
	},
	{
		id: 'inc_8842',
		p: 'BOLT-884201',
		d: 'Доставка замовлення (Набережна)',
		gross: 135,
		tax: 13.5,
		net: 121.5,
		date: '10.09.2026',
		time: '15:02',
		batch: 'bt_02070_9E71'
	},
	{
		id: 'inc_8843',
		p: 'BOLT-884230',
		d: 'Доставка замовлення (Перемога)',
		gross: 95,
		tax: 9.5,
		net: 85.5,
		date: '10.09.2026',
		time: '16:10',
		batch: 'bt_02070_9E71'
	}
];

export const demoGovPlatforms: Dac7GovPlatform[] = [
	{
		id: 'plt_bolt',
		name: 'Bolt Operations OÜ / ТОВ «Болт Оперейшнз Україна»',
		sellers: 14280,
		flow: 184500000,
		volume: '184.5 млн ₴',
		dac7: '2026-09-30',
		score: 99,
		st: 'ok'
	},
	{
		id: 'plt_uklon',
		name: 'ТОВ «Уклон Україна»',
		sellers: 21500,
		flow: 248000000,
		volume: '248.0 млн ₴',
		dac7: '2026-09-30',
		score: 98,
		st: 'ok'
	},
	{
		id: 'plt_glovo',
		name: 'ТОВ «Гловоапп Україна»',
		sellers: 9800,
		flow: 92300000,
		volume: '92.3 млн ₴',
		dac7: '2026-09-30',
		score: 99,
		st: 'ok'
	}
];

export const demoFraudAlerts: Dac7FraudAlert[] = [
	{
		t: 'Дохід Олексія Т. наблизився до річного ліміту 834 мін. зарплат (Закон № 4903-IX)',
		lvl: 'mid',
		ago: '15 хв тому'
	},
	{
		t: 'Підозрілий сплеск транзакцій (>15 на годину) на одному терміналі мерчанта',
		lvl: 'high',
		ago: '42 хв тому'
	},
	{
		t: 'Невідповідність IBAN отримувача податковому номеру РНОКПП у батчі виплат',
		lvl: 'high',
		ago: '1 год тому'
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
	},
	{
		id: 'diia_sess_1091',
		sessionId: 'sess_4c20_2026',
		rnokpp: '2847192041',
		name: 'Марія Гнатюк',
		status: 'Підтверджено',
		p7sHash: 'sha256_aa12bb34cc56...ef90',
		date: '10.09.2026 13:40',
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
	},
	{
		id: 'loy_atb',
		networkId: 'atb',
		networkName: 'АТБ',
		cardName: 'АТБ Card',
		cardNumber: '4111 •••• •••• 5521',
		points: 650,
		discountPct: 5,
		logoBg: 'bg-blue-600',
		textColor: 'text-white',
		isLinked: true
	}
];
