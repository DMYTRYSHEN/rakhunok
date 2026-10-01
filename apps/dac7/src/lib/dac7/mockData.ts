import type {
	Dac7Seller,
	SellerCategory,
	Dac7Payout,
	Dac7Batch,
	Dac7IncomeTransaction,
	Dac7GovPlatform,
	Dac7FraudAlert,
	Dac7DiiaSession,
	Dac7LoyaltyCard
} from './types';

export const fmt = (n: number) => n.toLocaleString('uk-UA');

export const CATEGORY_META: Record<
	SellerCategory,
	{
		label: string;
		shortLabel: string;
		color: string;
		taxDescription: string;
		taxRateDisplay: string;
		badgeClass: string;
	}
> = {
	platform_gig: {
		label: 'Платформний гіг-виконавець (ст. 178-1 ПКУ)',
		shortLabel: 'Гіг (10% ПДФО)',
		color: 'emerald',
		taxDescription:
			'10% ПДФО утримує платформа як податковий агент. Військовий збір 0.00 ₴. Ліміт 834 МЗП.',
		taxRateDisplay: '10% ПДФО',
		badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
	},
	fop: {
		label: 'Фізична особа – підприємець (ФОП)',
		shortLabel: 'ФОП (0% агента)',
		color: 'indigo',
		taxDescription:
			'Платформа не утримує податок (0%). ФОП сплачує ЄП самостійно. Звітність 4ДФ код 157.',
		taxRateDisplay: '0% платформи',
		badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
	},
	goods_casual: {
		label: 'Продавець особистих/вживаних речей',
		shortLabel: 'Товари (De Minimis)',
		color: 'amber',
		taxDescription:
			'Звільнення до 30 операцій та 2000 € (DAC7 De Minimis). При перевищенні — Reportable.',
		taxRateDisplay: 'De Minimis',
		badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
	},
	property_rental: {
		label: 'Орендодавець нерухомості',
		shortLabel: 'Оренда житла',
		color: 'violet',
		taxDescription: 'Звітність DAC7 за обʼєктами з кадастровими номерами та кількістю діб оренди.',
		taxRateDisplay: 'Кадастровий облік',
		badgeClass: 'bg-violet-50 text-violet-700 border-violet-200'
	},
	transport_rental: {
		label: 'Орендодавець транспорту / Каршеринг',
		shortLabel: 'Оренда авто',
		color: 'cyan',
		taxDescription:
			'Оренда рухомого майна. Звітність за VIN-кодами, держномерами та строками оренди.',
		taxRateDisplay: 'Транспортний облік',
		badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200'
	},
	independent_pro: {
		label: 'Незалежна професійна діяльність (ст. 178 ПКУ)',
		shortLabel: 'Незалежний профі',
		color: 'teal',
		taxDescription: 'Репетитори, юристи, консультанти. Облік за довідкою форми 20-ОПП та РНОКПП.',
		taxRateDisplay: 'Проф. діяльність',
		badgeClass: 'bg-teal-50 text-teal-700 border-teal-200'
	},
	corporate_entity: {
		label: 'Юридична особа / Корпоративний мерчант',
		shortLabel: 'Юрособа (VARUS)',
		color: 'blue',
		taxDescription:
			'ТОВ/ПрАТ. Розрахунки через комерційний рахунок. DAC7 Entity Reporting за ЄДРПОУ.',
		taxRateDisplay: 'Юридична особа',
		badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
	},
	excluded_seller: {
		label: 'Виключений продавець (Excluded Seller)',
		shortLabel: 'Виключений',
		color: 'stone',
		taxDescription:
			'Держоргани, публічні лістингові компанії, готелі >2000 оренд/рік (звільнені від DAC7 DPI).',
		taxRateDisplay: 'Звільнено від DPI',
		badgeClass: 'bg-stone-100 text-stone-700 border-stone-200'
	}
};

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
		role: "Кур'єр (Спецрежим)",
		category: 'platform_gig',
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
		rnokpp: '3091248192',
		thresholdDetails: {
			annualLimitUah: 7211598,
			currentEarnedUah: 136800,
			isExceeded: false,
			excessEarnedUah: 0,
			baseTaxRate: 0.1,
			excessTaxRate: 0.18
		}
	},
	{
		id: 'RHK-4C20F91',
		name: 'Марія Гнатюк',
		role: 'Водійка (ФОП 3 гр)',
		category: 'fop',
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
		fopGroup: 3,
		fopTaxRate: 5,
		address: 'просп. Перемоги, 45, Київ, 01135',
		dob: '08.11.1988',
		rnokpp: '2847192041'
	},
	{
		id: 'RHK-B33D002',
		name: 'Ігор Савченко',
		role: 'Продавець речей (Reportable)',
		category: 'goods_casual',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA71 3052 9900 0002 6000 0009 3321',
		bankName: 'ПриватБанк',
		score: 99,
		earned: 103500,
		city: 'Львів',
		since: '07.2024',
		last: 'вчора',
		mode: 'instant',
		isFop: false,
		isGoodsSeller: true,
		goodsSalesYtd: 2300,
		goodsSalesCount: 45,
		deMinimis: {
			salesCount: 45,
			maxSalesThreshold: 30,
			salesTotalEur: 2300,
			maxEurThreshold: 2000,
			isExempt: false
		},
		address: 'вул. Городоцька, 112, Львів, 79016',
		dob: '23.07.1995',
		rnokpp: '3482910482'
	},
	{
		id: 'RHK-C182A94',
		name: 'Олена Бойко',
		role: 'Продавчиня речей (De Minimis Exempt)',
		category: 'goods_casual',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA19 3223 1300 0002 6000 0019 4481',
		bankName: 'Універсал Банк',
		score: 96,
		earned: 27900,
		city: 'Полтава',
		since: '04.2025',
		last: '3 дні тому',
		mode: 'daily',
		isFop: false,
		isGoodsSeller: true,
		goodsSalesYtd: 620,
		goodsSalesCount: 14,
		deMinimis: {
			salesCount: 14,
			maxSalesThreshold: 30,
			salesTotalEur: 620,
			maxEurThreshold: 2000,
			isExempt: true
		},
		address: 'вул. Соборності, 34, Полтава, 36000',
		dob: '11.09.1997',
		rnokpp: '3210948571'
	},
	{
		id: 'RHK-P991K21',
		name: 'Андрій Шевченко',
		role: 'Орендодавець нерухомості',
		category: 'property_rental',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA84 3007 1100 0002 6000 0005 5109',
		bankName: 'Райффайзен Банк',
		score: 99,
		earned: 384000,
		city: 'Київ',
		since: '01.2024',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'вул. Хрещатик, 21, кв. 14, Київ, 01001',
		dob: '29.09.1981',
		rnokpp: '2718294018',
		propertyDetails: {
			address: 'вул. Хрещатик, 21, кв. 14, Київ, 01001',
			cadastralNumber: '8000000000:72:001:0014',
			rentalDays: 142,
			propertyType: 'residential',
			unitsCount: 2
		}
	},
	{
		id: 'RHK-T882M33',
		name: 'Сергій Бондар',
		role: 'Орендодавець авто / Каршеринг',
		category: 'transport_rental',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA44 3226 6900 0002 6000 0033 1120',
		bankName: 'Ощадбанк',
		score: 94,
		earned: 198000,
		city: 'Одеса',
		since: '06.2025',
		last: 'вчора',
		mode: 'daily',
		isFop: false,
		address: 'вул. Фонтанська дорога, 18, Одеса, 65016',
		dob: '04.05.1989',
		rnokpp: '2981029384',
		transportDetails: {
			vin: 'VF1234567890ABCDE',
			plateNumber: 'KA 1234 CB',
			model: 'Skoda Octavia 2.0 TDI',
			rentalDays: 95,
			vehicleType: 'car'
		}
	},
	{
		id: 'RHK-E551Q77',
		name: 'Оксана Мельник',
		role: 'Психологиня (ст. 178 ПКУ)',
		category: 'independent_pro',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA77 3253 6500 0002 6000 0077 8899',
		bankName: 'Кредобанк',
		score: 98,
		earned: 89000,
		city: 'Львів',
		since: '09.2024',
		last: 'сьогодні',
		mode: 'instant',
		isFop: false,
		address: 'вул. Личаківська, 55, Львів, 79010',
		dob: '18.12.1986',
		rnokpp: '3182940182',
		professionalDetails: {
			certNumber: '№ 4821-НП',
			activityType: 'Психологічне консультування та психотерапія',
			pkuArticle: '178',
			registeredTaxOffice: 'ГУ ДПС у Львівській області'
		}
	},
	{
		id: 'RHK-CORP-VARUS',
		name: 'ТОВ «ОМЕГА» (Мережа VARUS)',
		role: 'Корпоративний партнер (Супермаркет)',
		category: 'corporate_entity',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA82 3052 9900 0002 6000 0008 1900',
		bankName: 'ПриватБанк Корп',
		score: 100,
		earned: 14850000,
		city: 'Дніпро',
		since: '01.2023',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'просп. Дмитра Яворницького, 105, Дніпро, 49000',
		corporateDetails: {
			edrpou: '32615482',
			companyName: 'ТОВ "ОМЕГА" (Мережа VARUS)',
			isVatPayer: true,
			vatNumber: '326154804671'
		}
	},
	{
		id: 'RHK-EXCL-HOTEL',
		name: 'ПрАТ «Готельний комплекс Дніпро»',
		role: 'Великий готельний оператор',
		category: 'excluded_seller',
		kyc: 'tier2',
		iban: true,
		ibanFormatted: 'UA22 3003 3500 0002 6000 0012 3456',
		bankName: 'Укрексімбанк',
		score: 100,
		earned: 29400000,
		city: 'Київ',
		since: '03.2022',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'вул. Хрещатик, 1/2, Київ, 01001',
		corporateDetails: {
			edrpou: '14352819',
			companyName: 'ПрАТ "ГК Дніпро"',
			isVatPayer: true
		}
	},
	{
		id: 'RHK-77A1E45',
		name: 'Дмитро Коваль',
		role: "Кур'єр (Спецрежим)",
		category: 'platform_gig',
		kyc: 'tier1',
		iban: true,
		ibanFormatted: 'UA12 3077 7000 0002 6000 0009 1102',
		bankName: 'А-Банк',
		score: 84,
		earned: 41200,
		city: 'Харків',
		since: '05.2026',
		last: 'сьогодні',
		mode: 'daily',
		isFop: false,
		address: 'просп. Науки, 14, Харків, 61000',
		dob: '02.02.2001',
		rnokpp: '3104928172',
		thresholdDetails: {
			annualLimitUah: 7211598,
			currentEarnedUah: 41200,
			isExceeded: false,
			excessEarnedUah: 0,
			baseTaxRate: 0.1,
			excessTaxRate: 0.18
		}
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

export const demoPayments: import('./types').Dac7PaymentEvent[] = [
	{
		id: 'pay_9921',
		orderId: 'ord_884',
		customer: 'Іван',
		amount: 550,
		status: 'paid',
		date: '02.07 12:35'
	},
	{
		id: 'pay_9920',
		orderId: 'ord_871',
		customer: 'Анна',
		amount: 350,
		status: 'paid',
		date: '02.07 10:00'
	},
	{
		id: 'pay_9919',
		orderId: 'ord_863',
		customer: 'Олег',
		amount: 420,
		status: 'paid',
		date: '01.07 20:25'
	},
	{
		id: 'pay_9918',
		orderId: 'ord_850',
		customer: 'Марія',
		amount: 1450,
		status: 'paid',
		date: '01.07 14:15'
	},
	{
		id: 'pay_9917',
		orderId: 'ord_842',
		customer: 'Василь',
		amount: 950,
		status: 'paid',
		date: '30.06 17:50'
	}
];

export const demoIncome: Dac7IncomeTransaction[] = [
	{
		id: 'tx_884',
		orderId: 'ord_884',
		p: 'Bolt Food',
		d: 'Доставка · замовлення №884',
		gross: 245,
		tax: 24.5,
		net: 220.5,
		date: '02.07',
		time: '12:41',
		batch: 'bt_02070_9E71',
		deliveryStatus: 'DELIVERED'
	},
	{
		id: 'tx_871',
		orderId: 'ord_871',
		p: 'Uklon',
		d: 'Поїздка · Соборна → Перемога',
		gross: 312,
		tax: 31.2,
		net: 280.8,
		date: '02.07',
		time: '10:05',
		batch: 'bt_02070_9E71',
		deliveryStatus: 'DELIVERED'
	},
	{
		id: 'tx_863',
		orderId: 'ord_863',
		p: 'Bolt Food',
		d: 'Доставка · замовлення №863',
		gross: 198,
		tax: 19.8,
		net: 178.2,
		date: '01.07',
		time: '20:33',
		batch: 'bt_01070_9E71',
		deliveryStatus: 'DELIVERED'
	},
	{
		id: 'tx_850_adj',
		orderId: 'ord_850',
		p: 'OLX',
		d: 'Продаж · Коригування (повернення)',
		gross: -100,
		tax: -10,
		net: -90,
		date: '01.07',
		time: '15:20',
		batch: 'bt_01070_9E71',
		deliveryStatus: 'ADJUSTED'
	},
	{
		id: 'tx_850',
		orderId: 'ord_850',
		p: 'OLX',
		d: 'Продаж · велотримач',
		gross: 1450,
		tax: 145,
		net: 1305,
		date: '01.07',
		time: '14:19',
		batch: 'bt_01070_9E71',
		deliveryStatus: 'DELIVERED'
	},
	{
		id: 'tx_842',
		orderId: 'ord_842',
		p: 'Kabanchik',
		d: 'Послуга · збірка меблів',
		gross: 950,
		tax: 95,
		net: 855,
		date: '30.06',
		time: '18:02',
		batch: 'bt_30060_9E71',
		deliveryStatus: 'DELIVERED'
	},
	{
		id: 'tx_999',
		orderId: 'ord_999',
		p: 'Bolt Food',
		d: 'Доставка · замовлення №999',
		gross: 150,
		tax: 15,
		net: 135,
		date: 'сьогодні',
		time: 'в процесі',
		deliveryStatus: 'IN_DELIVERY'
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

export interface Dac7EscrowItem {
	id: string;
	seller: string;
	buyer: string;
	gross: number;
	tax: number;
	net: number;
	status: 'held' | 'released' | 'refunded' | 'disputed';
	date: string;
	reason?: string;
}

export const demoEscrows: Dac7EscrowItem[] = [
	{
		id: 'esc_01J8ZK4A',
		seller: 'Олексій Ткаченко',
		buyer: 'Марія Коваленко',
		gross: 1200,
		tax: 120,
		net: 1080,
		status: 'held',
		date: '2026-07-04'
	},
	{
		id: 'esc_01J8ZK4B',
		seller: 'Олексій Ткаченко',
		buyer: 'Дмитро Шевченко',
		gross: 3500,
		tax: 350,
		net: 3150,
		status: 'disputed',
		date: '2026-07-03'
	},
	{
		id: 'esc_01J8ZK4C',
		seller: 'Дмитро Кравченко',
		buyer: 'Ірина Петренко',
		gross: 2200,
		tax: 220,
		net: 1980,
		status: 'released',
		date: '2026-07-02'
	},
	{
		id: 'esc_01J8ZK4D',
		seller: 'Світлана Мороз',
		buyer: 'Олег Козак',
		gross: 800,
		tax: 80,
		net: 720,
		status: 'refunded',
		date: '2026-07-01',
		reason: 'Замовлення скасовано клієнтом'
	}
];

export const ESCROW_META: Record<
	string,
	{ l: string; t: 'ok' | 'blue' | 'warn' | 'bad' | 'neutral' }
> = {
	held: { l: 'В утриманні', t: 'warn' },
	released: { l: 'Випущено', t: 'ok' },
	refunded: { l: 'Повернено', t: 'neutral' },
	disputed: { l: 'Диспут', t: 'bad' }
};

export const demoRegions = [
	{ name: 'Київ та область', v: 92 },
	{ name: 'Дніпропетровська', v: 71 },
	{ name: 'Львівська', v: 64 },
	{ name: 'Одеська', v: 58 },
	{ name: 'Харківська', v: 46 },
	{ name: 'Вінницька', v: 31 },
	{ name: 'Полтавська', v: 27 },
	{ name: 'Інші області', v: 55 }
];

export const demoIndustries = [
	{ name: 'Доставка', v: 34, c: 'bg-emerald-500' },
	{ name: 'Таксі', v: 27, c: 'bg-stone-900' },
	{ name: 'Маркетплейси', v: 19, c: 'bg-stone-500' },
	{ name: 'Фриланс', v: 12, c: 'bg-stone-400' },
	{ name: 'Оренда', v: 8, c: 'bg-stone-300' }
];
