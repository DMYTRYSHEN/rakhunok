import type { InvoiceEvent } from '../types';

export const demoInvoiceEvents: InvoiceEvent[] = [
	{
		id: 'demo-event-1',
		type: 'order_created',
		actorName: 'Rahunok Coffee',
		bankCode: null,
		previousBankCode: null,
		createdAt: '2026-08-25T09:42:00.000Z'
	},
	{
		id: 'demo-event-2',
		type: 'checkout_opened',
		actorName: 'Клієнт',
		bankCode: null,
		previousBankCode: null,
		createdAt: '2026-08-25T09:43:12.000Z'
	},
	{
		id: 'demo-event-3',
		type: 'payment_succeeded',
		actorName: 'Система',
		bankCode: 'UNJS',
		previousBankCode: null,
		createdAt: '2026-08-25T09:44:08.000Z'
	}
];
