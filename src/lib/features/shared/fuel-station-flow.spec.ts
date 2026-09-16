import { describe, expect, it } from 'vitest';
import { validateFuelStationFlowData } from './fuel-station-flow';

const now = Date.parse('2026-09-16T17:00:00.000Z');

function runtimeFlow() {
	return {
		policy: {
			allowed_input_modes: ['liters', 'amount'],
			default_input_mode: 'liters',
			require_connected_nozzle: true,
			price_change_policy: 'lock_quote',
			quote_ttl_seconds: 60
		},
		snapshot: {
			snapshot_id: 'snapshot-101',
			revision: '42',
			observed_at: '2026-09-16T16:59:55.000Z',
			station: { id: 'station-7', label: 'АЗС 7', address: 'Київ' },
			dispensers: [
				{
					id: 'pump-1',
					number: '1',
					label: 'Колонка 1',
					status: 'connected',
					product_ids: ['a95'],
					nozzles: [{ id: 'nozzle-1', product_id: 'a95', status: 'connected' }],
					active_nozzle_id: 'nozzle-1'
				}
			],
			products: [
				{
					id: 'a95',
					code: 'A95',
					label: 'A-95',
					unit: 'liter',
					price_per_unit: 59.5,
					currency: 'UAH',
					status: 'available'
				}
			],
			limits: [
				{ mode: 'liters', min: 2, max: 100, step: 1 },
				{ mode: 'amount', min: 100, max: 6000, step: 100 }
			]
		},
		selection: {
			dispenser_id: 'pump-1',
			product_id: 'a95',
			quantity: { mode: 'liters', value: 20 }
		},
		quote: {
			id: 'quote-1',
			snapshot_id: 'snapshot-101',
			revision: '42',
			dispenser_id: 'pump-1',
			product_id: 'a95',
			input_mode: 'liters',
			input_value: 20,
			created_at: '2026-09-16T17:00:00.000Z',
			expires_at: '2026-09-16T17:01:00.000Z',
			unit_price: 59.5,
			estimated_quantity: 20,
			estimated_amount: 1190,
			currency: 'UAH'
		}
	};
}

describe('fuel station runtime contract', () => {
	it('accepts a coherent station snapshot, selection, and quote', () => {
		expect(validateFuelStationFlowData(runtimeFlow(), { requireSnapshot: true, now })).toEqual(
			runtimeFlow()
		);
	});

	it('rejects missing currency and unknown product references', () => {
		const missingCurrency = runtimeFlow();
		delete (missingCurrency.snapshot.products[0] as { currency?: string }).currency;
		expect(() => validateFuelStationFlowData(missingCurrency, { now })).toThrow(/вид пального/);

		const unknownProduct = runtimeFlow();
		unknownProduct.snapshot.dispensers[0].product_ids = ['diesel'];
		expect(() => validateFuelStationFlowData(unknownProduct, { now })).toThrow(/асортимент/);
	});

	it('rejects invalid selection, stale quotes, and incomplete fulfillment', () => {
		const unavailable = runtimeFlow();
		unavailable.snapshot.dispensers[0].status = 'occupied';
		expect(() => validateFuelStationFlowData(unavailable, { now })).toThrow(/недоступний/);

		const expired = runtimeFlow();
		expect(() =>
			validateFuelStationFlowData(expired, { now: Date.parse('2026-09-16T17:02:00.000Z') })
		).toThrow(/прострочена/);

		const incomplete = runtimeFlow();
		Object.assign(incomplete, {
			fulfillment: { status: 'completed', transaction_id: 'transaction-1' }
		});
		expect(() => validateFuelStationFlowData(incomplete, { now })).toThrow(/фактичних показників/);
	});

	it('rejects a quote issued for another snapshot or selection', () => {
		const wrongSnapshot = runtimeFlow();
		wrongSnapshot.quote.snapshot_id = 'snapshot-previous';
		expect(() => validateFuelStationFlowData(wrongSnapshot, { now })).toThrow(/не відповідає/);

		const wrongDispenser = runtimeFlow();
		wrongDispenser.quote.dispenser_id = 'pump-2';
		expect(() => validateFuelStationFlowData(wrongDispenser, { now })).toThrow(/не відповідає/);
	});

	it('rejects a selection that does not match the connected nozzle product', () => {
		const wrongNozzleProduct = runtimeFlow();
		wrongNozzleProduct.snapshot.products.push({
			id: 'diesel',
			code: 'DIESEL',
			label: 'ДП',
			unit: 'liter',
			price_per_unit: 57.5,
			currency: 'UAH',
			status: 'available'
		});
		wrongNozzleProduct.snapshot.dispensers[0].product_ids.push('diesel');
		wrongNozzleProduct.snapshot.dispensers[0].nozzles[0].product_id = 'diesel';

		expect(() => validateFuelStationFlowData(wrongNozzleProduct, { now })).toThrow(
			/підключеному пістолету/
		);
	});
});
