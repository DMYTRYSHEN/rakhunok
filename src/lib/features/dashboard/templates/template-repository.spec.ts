import { describe, expect, it, vi } from 'vitest';
import { getScenarioDefaults } from '$lib/features/shared/checkout-scenario-defaults';
import type { TemplateCreateInput } from '../types';
import { createTemplateRepository, validateTemplateInput } from './template-repository';

const context = { merchantId: 'merchant-a', demo: true };
const input = (name: string, isDefault = false) => ({
	name,
	scenario_type: 'fixed' as const,
	scenario_config: getScenarioDefaults('fixed'),
	is_default: isDefault
});

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value)
	};
}

describe('checkout template repository', () => {
	it('keeps demo CRUD merchant-scoped and makes zero Supabase calls', async () => {
		const storage = memoryStorage();
		const getClient = vi.fn();
		let sequence = 0;
		const repository = createTemplateRepository(
			getClient,
			() => storage,
			() => new Date('2026-09-16T12:00:00.000Z'),
			() => `id-${++sequence}`
		);
		const first = await repository.create(context, input('Перший', true));
		await repository.create(context, input('Другий', true));
		expect((await repository.list(context)).map((item) => [item.name, item.is_default])).toEqual([
			['Перший', false],
			['Другий', true]
		]);
		expect(await repository.list({ merchantId: 'merchant-b', demo: true })).toEqual([]);
		await repository.setDefault(context, first.id);
		expect(
			(await repository.list(context)).filter((item) => item.is_default).map((item) => item.id)
		).toEqual([first.id]);
		await repository.remove(context, first.id);
		expect((await repository.list(context)).map((item) => item.name)).toEqual(['Другий']);
		expect(getClient).not.toHaveBeenCalled();
	});

	it('uses one RPC for a production default mutation and propagates authorization failure', async () => {
		const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } });
		const repository = createTemplateRepository(() => ({ rpc }) as never);
		await expect(
			repository.setDefault({ merchantId: 'merchant-a', demo: false }, 'template-a')
		).rejects.toThrow('Немає доступу');
		expect(rpc).toHaveBeenCalledOnce();
		expect(rpc).toHaveBeenCalledWith('set_checkout_template_default', {
			p_merchant_id: 'merchant-a',
			p_template_id: 'template-a'
		});
	});

	it('rejects malformed input before storage or network access', () => {
		expect(() => validateTemplateInput({ ...input('  '), name: '  ' })).toThrow(/Назва/);
		expect(() =>
			validateTemplateInput({
				...input('Тест'),
				scenario_config: { ...getScenarioDefaults('fixed'), allow_tips: 'yes' } as never
			})
		).toThrow(/allow_tips/);
	});

	it('accepts a future flow payload while enforcing its version and identity', () => {
		const fuelStation: TemplateCreateInput = {
			...input('АЗС'),
			scenario_type: 'fuel_station',
			scenario_config: {
				...getScenarioDefaults('fixed'),
				checkout_flow: { id: 'fuel_station', version: 1, invoice_type: 'open_amount' },
				flow_data: {
					policy: {
						allowed_input_modes: ['liters', 'amount'],
						default_input_mode: 'liters',
						require_connected_nozzle: true,
						price_change_policy: 'lock_quote',
						quote_ttl_seconds: 60
					}
				}
			}
		};

		expect(validateTemplateInput(fuelStation).scenario_type).toBe('fuel_station');
		expect(() =>
			validateTemplateInput({
				...fuelStation,
				scenario_config: {
					...fuelStation.scenario_config,
					checkout_flow: undefined
				}
			})
		).toThrow(/потік чекауту/);
		expect(() =>
			validateTemplateInput({
				...fuelStation,
				scenario_config: {
					...fuelStation.scenario_config,
					checkout_flow: { id: 'fixed', version: 1 }
				}
			})
		).toThrow(/не відповідає/);
		expect(() =>
			validateTemplateInput({
				...fuelStation,
				scenario_config: {
					...fuelStation.scenario_config,
					checkout_flow: { id: 'fuel_station', version: 2 }
				}
			})
		).toThrow(/посилання/);
		expect(() => validateTemplateInput({ ...fuelStation, scenario_type: 'Fuel Station' })).toThrow(
			/Непідтримуваний/
		);
		expect(() =>
			validateTemplateInput({
				...fuelStation,
				scenario_config: {
					...fuelStation.scenario_config,
					flow_data: {
						policy: {
							allowed_input_modes: ['liters'],
							default_input_mode: 'amount',
							require_connected_nozzle: true,
							price_change_policy: 'lock_quote',
							quote_ttl_seconds: 60
						}
					}
				}
			})
		).toThrow(/режими введення/);
		expect(() =>
			validateTemplateInput({
				...fuelStation,
				scenario_config: {
					...fuelStation.scenario_config,
					flow_data: {
						...(fuelStation.scenario_config.flow_data as Record<string, unknown>),
						snapshot: { snapshot_id: 'live-data-must-not-be-persisted' }
					}
				}
			})
		).toThrow(/не може містити оперативні дані/);
	});
});
