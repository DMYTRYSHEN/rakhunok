import type { BankId } from '$lib/bank-connectors/types';
import type { MatchDecision } from '$lib/bank-connectors/matching-engine';

export interface DiscrepancyRecord {
	id: string;
	evidenceId: string;
	bankId: BankId;
	bankTxId: string;
	payerName: string;
	payerIban?: string;
	recipientIban: string;
	amountMinor: bigint;
	amountFormatted: string;
	currency: string;
	purpose: string;
	bookingDate: string;
	decision: MatchDecision;
	reasons: string[];
	suggestedInvoiceReference?: string;
	suggestedInvoiceId?: string;
	status: 'unresolved' | 'resolved' | 'ignored';
	resolvedInvoiceId?: string;
	resolvedAt?: string;
	resolvedBy?: string;
}

export const demoDiscrepancies: DiscrepancyRecord[] = [
	{
		id: 'disc-001',
		evidenceId: 'urn:bank:a-bank:UA173077700000026205061543958:AB_TX_984120',
		bankId: 'a-bank',
		bankTxId: 'AB_TX_984120',
		payerName: 'Мельник О. В.',
		payerIban: 'UA893052990000026201234567890',
		recipientIban: 'UA173077700000026205061543958',
		amountMinor: 86000n, // 860.00 UAH
		amountFormatted: '860,00 ₴',
		currency: 'UAH',
		purpose: 'Оплата за послуги харчування без номеру замовлення',
		bookingDate: '2026-08-25T12:45:10+03:00',
		decision: 'ambiguous',
		reasons: [
			'Сума 860.00 ₴ збігається з відкритим рахунком INV-1047, але в призначенні відсутній референс #INV-1047'
		],
		suggestedInvoiceReference: 'INV-1047',
		suggestedInvoiceId: 'demo-1047',
		status: 'unresolved'
	},
	{
		id: 'disc-002',
		evidenceId: 'urn:bank:privatbank:UA623077700000026001411123751:REF99281_REFN112',
		bankId: 'privatbank',
		bankTxId: 'REF99281_REFN112',
		payerName: 'ТОВ "Схід-Логістик"',
		payerIban: 'UA443052990000026009876543210',
		recipientIban: 'UA623077700000026001411123751',
		amountMinor: 120000n, // 1200.00 UAH
		amountFormatted: '1 200,00 ₴',
		currency: 'UAH',
		purpose: 'Доплата згідно договору поставки 12/08',
		bookingDate: '2026-08-25T11:15:00+03:00',
		decision: 'unmatched',
		reasons: [
			'Не знайдено жодного відкритого рахунку з сумою 1 200.00 ₴ або референсом договору'
		],
		status: 'unresolved'
	},
	{
		id: 'disc-003',
		evidenceId: 'urn:bank:monobank:UA323220010000026007000123456:MONO_TX_551402',
		bankId: 'monobank',
		bankTxId: 'MONO_TX_551402',
		payerName: 'Коваленко Сергій',
		payerIban: 'UA113220010000026207778889990',
		recipientIban: 'UA323220010000026007000123456',
		amountMinor: 140000n, // 1400.00 UAH
		amountFormatted: '1 400,00 ₴',
		currency: 'UAH',
		purpose: 'Оплата INV-1045 переплата',
		bookingDate: '2026-08-25T10:05:22+03:00',
		decision: 'overpaid',
		reasons: [
			'Переплата: рахунок INV-1045 виставлено на 1 315.00 ₴, отримано 1 400.00 ₴ (+85.00 ₴)'
		],
		suggestedInvoiceReference: 'INV-1045',
		suggestedInvoiceId: 'demo-1045',
		status: 'unresolved'
	}
];
