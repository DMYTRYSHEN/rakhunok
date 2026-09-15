import { describe, expect, it } from 'vitest';
import type { ProformaDraft } from './types';

describe('proforma-journal logic', () => {
	const mockProformas: ProformaDraft[] = [
		{
			id: 'prof-1',
			title: 'Рахунок-фактура',
			number: '01-001',
			issueDate: '2026-02-01',
			dueDate: '2026-02-15',
			currency: 'UAH',
			seller: {
				entityId: 'ent-1',
				name: 'ТОВ «Агротех»',
				taxId: '12345678',
				iban: 'UA1130000000000000000000001',
				bankName: 'ПриватБанк',
				vatStatus: 'vat'
			},
			customer: {
				name: 'ТОВ «Мрія-Трейд»',
				taxId: '87654321',
				email: 'mriya@test.ua'
			},
			items: [
				{
					id: 'item-1',
					type: 'item',
					name: 'Консультаційні послуги з агрономії',
					price: 15000,
					quantity: 1,
					unit: 'послуга',
					discountPercent: 0,
					total: 15000
				}
			],
			paymentMethod: {
				type: 'iban',
				name: 'Основний рахунок ФОП (Приват24)',
				details: 'IBAN: UA1130000000000000000000001 (ПриватБанк)'
			},
			purpose: 'Оплата за консультаційні послуги згідно рахунку №01-001',
			notes: '',
			taxRate: 20,
			appearanceTemplate: 'Класичний',
			recurrence: 'monthly',
			projectGroup: 'Агропроєкт 2026',
			status: 'draft',
			createdAt: '2026-02-01T10:00:00Z',
			totals: {
				subtotal: 15000,
				discountTotal: 0,
				taxAmount: 3000,
				adjustment: 0,
				total: 15000
			}
		},
		{
			id: 'prof-2',
			title: 'Рахунок-фактура',
			number: '01-002',
			issueDate: '2026-02-05',
			dueDate: '2026-02-19',
			currency: 'UAH',
			seller: {
				entityId: 'ent-2',
				name: 'ФОП Шевченко Т.Г.',
				taxId: '2912345678',
				iban: 'UA2230000000000000000000002',
				bankName: 'А-Банк',
				vatStatus: 'no-vat'
			},
			customer: {
				name: 'Іваненко Петро Сергійович',
				taxId: '3123456789',
				email: 'petro@test.ua'
			},
			items: [
				{
					id: 'item-2',
					type: 'item',
					name: 'Розробка веб-сервісу під ключ',
					price: 45000,
					quantity: 1,
					unit: 'послуга',
					discountPercent: 0,
					total: 45000
				}
			],
			paymentMethod: {
				type: 'iban',
				name: 'ТОВ Ромашка (аБізнес)',
				details: 'IBAN: UA2230000000000000000000002 (А-Банк)'
			},
			purpose: 'Оплата за розробку згідно рахунку №01-002',
			notes: '',
			taxRate: 0,
			appearanceTemplate: 'Класичний',
			recurrence: 'none',
			projectGroup: 'IT Розробка',
			status: 'invoice_created',
			invoiceId: 'inv-999',
			createdAt: '2026-02-05T12:00:00Z',
			totals: {
				subtotal: 45000,
				discountTotal: 0,
				taxAmount: 0,
				adjustment: 0,
				total: 45000
			}
		}
	];

	function filterProformas(
		list: ProformaDraft[],
		query: string,
		project: string,
		recurrenceOnly: boolean
	) {
		let res = list;
		const q = query.trim().toLowerCase();
		if (q) {
			res = res.filter((p) => {
				const num = (p.number || '').toLowerCase();
				const client = (p.customer?.name || '').toLowerCase();
				const taxId = (p.customer?.taxId || '').toLowerCase();
				const proj = (p.projectGroup || '').toLowerCase();
				const purpose = (p.purpose || '').toLowerCase();
				const items = p.items.map((i) => (i.name || '').toLowerCase()).join(' ');
				const total = p.totals?.total ? String(p.totals.total) : '';
				return (
					num.includes(q) ||
					client.includes(q) ||
					taxId.includes(q) ||
					proj.includes(q) ||
					purpose.includes(q) ||
					items.includes(q) ||
					total.includes(q)
				);
			});
		}

		if (project !== 'all') {
			res = res.filter((p) => (p.projectGroup?.trim() || 'Без проєкту') === project);
		}

		if (recurrenceOnly) {
			res = res.filter((p) => p.recurrence && p.recurrence !== 'none');
		}

		return res;
	}

	it('filters proformas by search query matching number, customer or service name', () => {
		expect(filterProformas(mockProformas, '01-001', 'all', false)).toHaveLength(1);
		expect(filterProformas(mockProformas, 'Мрія', 'all', false)).toHaveLength(1);
		expect(filterProformas(mockProformas, 'веб-сервісу', 'all', false)).toHaveLength(1);
		expect(filterProformas(mockProformas, 'неіснуюче', 'all', false)).toHaveLength(0);
	});

	it('filters proformas by project group', () => {
		const agro = filterProformas(mockProformas, '', 'Агропроєкт 2026', false);
		expect(agro).toHaveLength(1);
		expect(agro[0].number).toBe('01-001');

		const itProj = filterProformas(mockProformas, '', 'IT Розробка', false);
		expect(itProj).toHaveLength(1);
		expect(itProj[0].number).toBe('01-002');
	});

	it('filters proformas by recurring flag', () => {
		const recurring = filterProformas(mockProformas, '', 'all', true);
		expect(recurring).toHaveLength(1);
		expect(recurring[0].recurrence).toBe('monthly');
	});

	it('duplicates a proforma with fresh ID, reset invoice status and preserved line items', () => {
		const source = mockProformas[1];
		const clone: ProformaDraft = JSON.parse(JSON.stringify(source));
		clone.id = 'prof-new-123';
		clone.number = '01-003';
		clone.status = 'draft';
		delete clone.invoiceId;
		delete clone.act;

		expect(clone.id).not.toBe(source.id);
		expect(clone.status).toBe('draft');
		expect(clone.invoiceId).toBeUndefined();
		expect(clone.items).toHaveLength(1);
		expect(clone.items[0].price).toBe(45000);
		expect(clone.customer.name).toBe(source.customer.name);
		expect(clone.projectGroup).toBe('IT Розробка');
	});
});
