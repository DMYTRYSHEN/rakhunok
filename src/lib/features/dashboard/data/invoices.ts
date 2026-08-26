import type { InvoiceRecord, InvoiceType } from '../types';
import { overviewSnapshot } from './overview';

const types: InvoiceType[] = ['fixed', 'table', 'delivery', 'open_amount'];

export const demoInvoices: InvoiceRecord[] = Array.from({ length: 24 }, (_, index) => {
	const source = overviewSnapshot.recentInvoices[index % overviewSnapshot.recentInvoices.length];
	const type = types[index % types.length];
	const createdAt = new Date(
		`2026-08-${String(25 - index).padStart(2, '0')}T12:42:00+03:00`
	).toISOString();

	return {
		...source,
		id: `demo-${1048 - index}`,
		reference: `INV-${1048 - index}`,
		title: index === 0 ? source.title : `${source.title} · ${index + 1}`,
		amount: source.amount + index * 25,
		createdAt,
		shortId: `r${1048 - index}`,
		type,
		lifecycleStatus: source.status,
		description: type === 'delivery' ? 'Доставка замовлення клієнту' : 'Оплата замовлення',
		baseAmount: source.amount + index * 25,
		discountAmount: 0,
		deliveryFee: type === 'delivery' ? 100 : 0,
		currency: 'UAH',
		tableNumber: type === 'table' ? (index % 12) + 1 : null,
		terminalId: type === 'table' ? `terminal-${(index % 4) + 1}` : null,
		paidAt: source.status === 'paid' ? createdAt : null,
		paidBankCode: source.status === 'paid' ? 'UNJS' : null,
		expiresAt: new Date(new Date(createdAt).getTime() + 7 * 86_400_000).toISOString()
	};
});
