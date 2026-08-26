import type { OverviewSnapshot } from '../types';
import { formatMoney } from '../utils/format';

const revenue = 128_420;
const paymentCount = 184;

export const overviewSnapshot: OverviewSnapshot = {
	merchantName: 'Rahunok Coffee',
	metrics: [
		{
			label: 'Виручка сьогодні',
			value: formatMoney(revenue),
			detail: '+12,4% до вчора',
			tone: 'success'
		},
		{
			label: 'Успішні оплати',
			value: String(paymentCount),
			detail: '96,8% конверсія',
			tone: 'primary'
		},
		{
			label: 'Середній чек',
			value: formatMoney(revenue / paymentCount),
			detail: '+₴48 за 7 днів',
			tone: 'neutral'
		},
		{
			label: 'Активні термінали',
			value: '6',
			detail: 'Усі працюють',
			tone: 'success'
		}
	],
	recentInvoices: [
		{
			id: 'demo-1048',
			reference: 'INV-1048',
			title: 'Замовлення #48',
			amount: 1240,
			status: 'paid',
			createdAt: '2026-08-25T12:42:00+03:00',
			channel: 'QR'
		},
		{
			id: 'demo-1047',
			reference: 'INV-1047',
			title: 'Стіл 7 · літня тераса',
			amount: 860,
			status: 'pending',
			createdAt: '2026-08-25T12:38:00+03:00',
			channel: 'POS'
		},
		{
			id: 'demo-1046',
			reference: 'INV-1046',
			title: 'Доставка · Поділ',
			amount: 2180,
			status: 'paid',
			createdAt: '2026-08-25T12:21:00+03:00',
			channel: 'Link'
		},
		{
			id: 'demo-1045',
			reference: 'INV-1045',
			title: 'Замовлення #45',
			amount: 540,
			status: 'failed',
			createdAt: '2026-08-25T12:06:00+03:00',
			channel: 'QR'
		},
		{
			id: 'demo-1044',
			reference: 'INV-1044',
			title: 'Стіл 3 · основна зала',
			amount: 1630,
			status: 'paid',
			createdAt: '2026-08-25T11:54:00+03:00',
			channel: 'POS'
		}
	]
};
