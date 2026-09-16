import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveScenario } from './scenarios.ts';

test('resolves the four built-in checkout scenarios', () => {
	assert.equal(resolveScenario({ type: 'fixed', total_amount: 44 }).screen, 'order');
	assert.equal(resolveScenario({ type: 'open_amount' }).screen, 'amount');
	assert.equal(resolveScenario({ type: 'delivery', total_amount: 940 }).screen, 'delivery');
	assert.equal(resolveScenario({ type: 'table', status: 'preparing' }).screen, 'waiting');
	assert.equal(
		resolveScenario({ type: 'table', status: 'pending', total_amount: 386 }).screen,
		'order'
	);
});

test('resolves aliases and JSON-compatible overrides', () => {
	const aliases = {
		fixed: ['fixed', 'invoice', '1'],
		open_amount: ['open_amount', 'amount', '2'],
		table: ['table', '3'],
		delivery: ['delivery', '4']
	};

	for (const [type, shortcuts] of Object.entries(aliases)) {
		for (const shortcut of shortcuts) {
			assert.equal(resolveScenario({ total_amount: 44 }, shortcut).type, type);
		}
	}

	assert.equal(resolveScenario({ total_amount: 44 }, 'unknown').type, 'fixed');
	assert.deepEqual(
		resolveScenario({ type: 'donation' }, '', {
			donation: { screen: 'amount', aliases: ['donate'], requiresAmount: false }
		}).type,
		'donation'
	);
});

test('merges backend order scenario_config dynamically', () => {
	const result = resolveScenario({
		type: 'open_amount',
		scenario_config: {
			hint: 'Спеціальний збір',
			quickAmounts: [100, 200, 1000]
		}
	});

	assert.equal(result.type, 'open_amount');
	assert.equal(result.config.hint, 'Спеціальний збір');
	assert.deepEqual(result.config.quickAmounts, [100, 200, 1000]);
});

test('uses versioned checkout flow identity independently of invoice type', () => {
	const result = resolveScenario({
		type: 'open_amount',
		scenario_config: {
			checkout_flow: { id: 'tips', version: 1 },
			cta_text: 'Подякувати'
		}
	});

	assert.equal(result.type, 'tips');
	assert.equal(result.screen, 'tips');
	assert.equal(result.config.cta_text, 'Подякувати');
});

test('falls back to invoice type when fuel station runtime data is incomplete', () => {
	const result = resolveScenario({
		type: 'open_amount',
		scenario_config: {
			checkout_flow: { id: 'fuel_station', version: 1 },
			flow_data: {
				dispensers: [{ id: 'pump_1', label: 'Колонка 1' }],
				fuel_grades: [{ id: 'a95', label: 'A-95' }],
				volume_mode: 'liters'
			}
		}
	});

	assert.equal(result.type, 'open_amount');
	assert.equal(result.screen, 'amount');
});

test('resolves fuel station only with a valid operational snapshot', () => {
	const result = resolveScenario({
		type: 'open_amount',
		scenario_config: {
			checkout_flow: { id: 'fuel_station', version: 1 },
			flow_data: {
				policy: {
					allowed_input_modes: ['liters', 'amount'],
					default_input_mode: 'liters',
					require_connected_nozzle: true,
					price_change_policy: 'lock_quote',
					quote_ttl_seconds: 60
				},
				snapshot: {
					snapshot_id: 'snapshot-1',
					revision: '1',
					observed_at: new Date().toISOString(),
					station: { id: 'station-1', label: 'АЗС 1' },
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
				}
			}
		}
	});

	assert.equal(result.type, 'fuel_station');
	assert.equal(result.screen, 'fuel_station');
});

test('ignores checkout flow metadata with an unsupported contract version', () => {
	const result = resolveScenario({
		type: 'fixed',
		scenario_config: { checkout_flow: { id: 'tips', version: 2 } }
	});

	assert.equal(result.type, 'fixed');
	assert.equal(result.screen, 'order');
});
