import { describe, expect, it } from 'vitest';
import { createDac7Gateway } from './dac7-gateway';
import { demoSellers, demoPayouts, demoBatches } from './mockData';

describe('DAC7 & Law № 4903-IX Business Logic Tests', () => {
	const mockClient: any = {
		from: () => ({
			select: () => ({
				order: () => Promise.resolve({ data: [], error: null }),
				eq: () => ({
					maybeSingle: () => Promise.resolve({ data: null, error: null })
				})
			}),
			insert: (payload: any) => ({
				select: () => ({
					single: () => Promise.resolve({ data: payload, error: null }),
					maybeSingle: () => Promise.resolve({ data: payload, error: null })
				})
			})
		})
	};

	const gateway = createDac7Gateway(mockClient);

	it('should calculate 10% PIT for individual self-employed under Law № 4903-IX', async () => {
		const payout = await gateway.createPayout({
			sellerId: 'RHK-9E71AB3',
			sellerName: 'Олексій Ткаченко',
			gross: 1000,
			isFop: false,
			rail: 'Monobank A2C'
		});

		expect(payout.gross).toBe(1000);
		expect(payout.tax).toBe(100); // 10% of 1000
		expect(payout.net).toBe(900); // 90% net
	});

	it('should exempt FOP sellers from platform withholding (0% tax withheld)', async () => {
		const payoutFop = await gateway.createPayout({
			sellerId: 'RHK-4C20F91',
			sellerName: 'Марія Гнатюк (ФОП)',
			gross: 2500,
			isFop: true,
			rail: 'PrivatBank IBAN'
		});

		expect(payoutFop.gross).toBe(2500);
		expect(payoutFop.tax).toBe(0); // 0% tax withheld for FOP
		expect(payoutFop.net).toBe(2500); // 100% net
	});

	it('should generate a valid 5-digit pinPay code', async () => {
		const session = await gateway.generatePinPayCode('bolt_food', 500);

		expect(session.pinCode).toHaveLength(5);
		expect(Number(session.pinCode)).toBeGreaterThanOrEqual(10000);
		expect(Number(session.pinCode)).toBeLessThanOrEqual(99999);
		expect(session.status).toBe('active');
	});

	it('should provide demo datasets in demo mode', async () => {
		const sellers = await gateway.getSellers(true);
		expect(sellers.length).toBeGreaterThanOrEqual(3);
		expect(sellers[0].id).toBe('RHK-9E71AB3');

		const payouts = await gateway.getPayouts(true);
		expect(payouts.length).toBeGreaterThanOrEqual(3);
		expect(payouts[0].gross).toBe(700);
		expect(payouts[0].tax).toBe(70);
		expect(payouts[0].net).toBe(630);
	});

	it('should enforce role permissions structure', async () => {
		const permissions = await gateway.listPermissions();
		expect(permissions.length).toBeGreaterThanOrEqual(4);
		const roles = permissions.map((p) => p.role);
		expect(roles).toContain('admin');
		expect(roles).toContain('platform');
		expect(roles).toContain('seller');
		expect(roles).toContain('gov');
	});
});
