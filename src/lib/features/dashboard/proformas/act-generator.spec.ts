import { describe, expect, it } from 'vitest';
import type { ProformaDraft } from './types';
import {
	computeActDigest,
	generateActCanonicalPayload,
	generateActFromProforma,
	getActTitle,
	getDefaultActStatement
} from './act-generator';
import { buildMockP7sContainer, signActWithDiia } from './diia-sign-service';

describe('act-generator & diia-sign-service', () => {
	const mockProforma: ProformaDraft = {
		id: 'prof-test-1',
		title: 'Рахунок-фактура',
		number: '01-555',
		issueDate: '2026-09-15',
		dueDate: '2026-09-29',
		currency: 'UAH',
		seller: {
			entityId: 'seller-1',
			name: 'ТОВ «Інноваційні Системи»',
			taxId: '40123456',
			iban: 'UA1130000000000000000000001',
			bankName: 'ПриватБанк',
			vatStatus: 'vat'
		},
		customer: {
			name: 'ТОВ «Партнер-Груп»',
			taxId: '38999888',
			email: 'partner@example.com',
			phone: '+380501112233'
		},
		items: [
			{
				id: 'item-1',
				type: 'item',
				name: 'Розробка програмного модуля',
				price: 15000,
				quantity: 1,
				unit: 'послуга',
				discountPercent: 0,
				total: 15000
			},
			{
				id: 'item-2',
				type: 'item',
				name: 'Технічна підтримка та налаштування',
				price: 5000,
				quantity: 2,
				unit: 'послуга',
				discountPercent: 10,
				total: 9000
			}
		],
		paymentMethod: {
			type: 'iban',
			name: 'Безготівковий розрахунок',
			details: 'UA1130000000000000000000001'
		},
		purpose: 'Оплата за послуги згідно рахунку',
		notes: '',
		taxRate: 20,
		appearanceTemplate: 'Шаблон №1',
		recurrence: 'none',
		projectGroup: 'Без групи',
		status: 'draft',
		createdAt: '2026-09-15T00:00:00.000Z'
	};

	it('returns correct Ukrainian legal titles for services and goods', () => {
		expect(getActTitle('services')).toBe('АКТ здачі-прийняття робіт (надання послуг)');
		expect(getActTitle('goods')).toBe('АКТ прийому-передачі товару');
	});

	it('returns compliant legal statements of non-claims for services and goods', () => {
		const servicesStatement = getDefaultActStatement('services');
		expect(servicesStatement).toContain('роботи виконані (послуги надані)');
		expect(servicesStatement.toLowerCase()).toContain('претензій');

		const goodsStatement = getDefaultActStatement('goods');
		expect(goodsStatement).toContain('товар переданий');
		expect(goodsStatement.toLowerCase()).toContain('претензій');
	});

	it('generates an Act structure populated from the proforma with 20% VAT', () => {
		const act = generateActFromProforma(mockProforma, 'services', 'м. Львів');

		expect(act.type).toBe('services');
		expect(act.number).toBe('АКТ-01-555');
		expect(act.city).toBe('м. Львів');
		expect(act.proformaNumber).toBe('01-555');
		expect(act.seller.name).toBe('ТОВ «Інноваційні Системи»');
		expect(act.customer.name).toBe('ТОВ «Партнер-Груп»');
		expect(act.status).toBe('draft');
		expect(act.totals.total).toBe(24000);
		expect(act.totals.taxAmount).toBe(4800); // 20% of 24000
	});

	it('generates canonical payload containing required primary accounting document fields', () => {
		const act = generateActFromProforma(mockProforma, 'services', 'м. Київ');
		const canonical = generateActCanonicalPayload(act);

		expect(canonical).toContain('АКТ здачі-прийняття робіт (надання послуг) № АКТ-01-555');
		expect(canonical).toContain('ПІДСТАВА: Рахунок-фактура № 01-555');
		expect(canonical).toContain('ТОВ «Інноваційні Системи»');
		expect(canonical).toContain('ТОВ «Партнер-Груп»');
		expect(canonical).toContain('Розробка програмного модуля');
		expect(canonical).toContain('24000.00 грн');
		expect(canonical).toContain('У Т.Ч. ПДВ (20%): 4800.00 грн');
	});

	it('computes a valid 64-char SHA-256 digest', async () => {
		const act = generateActFromProforma(mockProforma, 'services');
		const digest = await computeActDigest(act);

		expect(digest).toBeDefined();
		expect(digest).toHaveLength(64);
		expect(/^[0-9a-f]{64}$/.test(digest)).toBe(true);
	});

	it('signs act with Diia.Підпис and produces valid signer info and .p7s base64', async () => {
		const act = generateActFromProforma(mockProforma, 'services');
		const result = await signActWithDiia(act, {
			name: 'Іваненко Іван Іванович',
			taxId: '3123456789',
			issuer: 'КНЕДП «Дія»'
		});

		expect(result.success).toBe(true);
		expect(result.signerInfo?.name).toBe('Іваненко Іван Іванович');
		expect(result.signerInfo?.issuer).toBe('КНЕДП «Дія»');
		expect(result.signerInfo?.taxId).toBe('3123456789');
		expect(result.signatureP7s).toBeDefined();

		// Check decoding of p7s container with UTF-8
		const { base64ToUtf8 } = await import('./diia-sign-service');
		const decodedJson = base64ToUtf8(result.signatureP7s!);
		const envelope = JSON.parse(decodedJson);
		expect(envelope.format).toContain('PKCS#7');
		expect(envelope.signerCertificate.subject).toBe('Іваненко Іван Іванович');
		expect(envelope.documentNumber).toBe('АКТ-01-555');
	});
});
