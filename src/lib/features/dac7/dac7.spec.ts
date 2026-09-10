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
		expect(payouts[0].gross).toBe(245);
		expect(payouts[0].tax).toBe(24.5);
		expect(payouts[0].net).toBe(220.5);
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

	it('should support ALL legal categories under Ukrainian Digital Platforms Law (№ 4903-IX / DAC7)', async () => {
		const sellers = await gateway.getSellers(true);
		const categories = sellers.map((s) => s.category);

		// Assert that all distinct categories are present in demo data
		expect(categories).toContain('platform_gig');
		expect(categories).toContain('fop');
		expect(categories).toContain('goods_casual');
		expect(categories).toContain('property_rental');
		expect(categories).toContain('transport_rental');
		expect(categories).toContain('independent_pro');
		expect(categories).toContain('corporate_entity');
		expect(categories).toContain('excluded_seller');
	});

	it('should correctly configure Property Rental with cadastral and rental day data', async () => {
		const sellers = await gateway.getSellers(true);
		const propertySeller = sellers.find((s) => s.category === 'property_rental');

		expect(propertySeller).toBeDefined();
		expect(propertySeller?.propertyDetails?.cadastralNumber).toBe('8000000000:72:001:0014');
		expect(propertySeller?.propertyDetails?.rentalDays).toBeGreaterThan(0);
		expect(propertySeller?.propertyDetails?.propertyType).toBe('residential');
	});

	it('should correctly configure Transport Rental with license plate and VIN', async () => {
		const sellers = await gateway.getSellers(true);
		const transportSeller = sellers.find((s) => s.category === 'transport_rental');

		expect(transportSeller).toBeDefined();
		expect(transportSeller?.transportDetails?.plateNumber).toBe('KA 1234 CB');
		expect(transportSeller?.transportDetails?.vin).toBe('VF1234567890ABCDE');
		expect(transportSeller?.transportDetails?.rentalDays).toBe(95);
	});

	it('should enforce De Minimis exemption rules (30 transactions / 2,000 EUR) for goods sellers', async () => {
		const sellers = await gateway.getSellers(true);
		const exemptSeller = sellers.find(
			(s) => s.category === 'goods_casual' && s.deMinimis?.isExempt
		);
		const reportableSeller = sellers.find(
			(s) => s.category === 'goods_casual' && !s.deMinimis?.isExempt
		);

		// Exempt seller: under 30 sales and under 2,000 EUR
		expect(exemptSeller).toBeDefined();
		expect(exemptSeller?.deMinimis?.salesCount).toBeLessThan(30);
		expect(exemptSeller?.deMinimis?.salesTotalEur).toBeLessThan(2000);
		expect(exemptSeller?.deMinimis?.isExempt).toBe(true);

		// Reportable seller: crossed 30 sales or 2,000 EUR
		expect(reportableSeller).toBeDefined();
		expect(reportableSeller?.deMinimis?.salesCount).toBeGreaterThanOrEqual(30);
		expect(reportableSeller?.deMinimis?.isExempt).toBe(false);
	});

	it('should verify that Military Tax is strictly 0 across all platform payout calculations', async () => {
		const payout = await gateway.createPayout({
			sellerId: 'RHK-9E71AB3',
			sellerName: 'Олексій Ткаченко',
			gross: 5000,
			isFop: false,
			rail: 'Monobank A2C'
		});

		// 10% PIT withheld, 0% Military Tax
		expect(payout.gross).toBe(5000);
		expect(payout.tax).toBe(500); // 10%
		expect(payout.net).toBe(4500); // 90%
	});
});
