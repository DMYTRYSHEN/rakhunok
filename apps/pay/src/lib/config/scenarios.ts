import type { Order } from '../types/order.js';
import type { ResolvedScenario, ScenarioDefinition } from '../types/scenario.js';
import { validateFuelStationFlowData } from '../../../../../src/lib/features/shared/fuel-station-flow.ts';
import defaultCatalog from './scenarios.json' with { type: 'json' };

export const DEFAULT_SCENARIOS: Record<string, ScenarioDefinition> = Object.freeze(
	defaultCatalog.scenarios
);

export function createScenarioRegistry(
	overrides: Record<string, Partial<ScenarioDefinition>> = {}
): Record<string, ScenarioDefinition> {
	const registry: Record<string, ScenarioDefinition> = {};
	const combined = { ...DEFAULT_SCENARIOS, ...overrides };

	for (const [key, definition] of Object.entries(combined)) {
		registry[key] = {
			id: key,
			name: definition.name || key,
			screen: definition.screen || 'order',
			aliases: definition.aliases || [key],
			requiresAmount: definition.requiresAmount ?? true,
			pendingScreen: definition.pendingScreen,
			config: definition.config || {}
		};
	}

	return registry;
}

export function resolveScenario(
	order: Partial<Order> | null | undefined,
	forcedType = '',
	overrides: Record<string, Partial<ScenarioDefinition>> = {}
): ResolvedScenario {
	const registry = createScenarioRegistry(overrides);
	const checkoutFlow = order?.scenario_config?.checkout_flow;
	const configuredFlow =
		checkoutFlow &&
		typeof checkoutFlow === 'object' &&
		'id' in checkoutFlow &&
		typeof checkoutFlow.id === 'string' &&
		'version' in checkoutFlow &&
		checkoutFlow.version === 1
			? checkoutFlow.id
			: '';
	const validatedFlow = (() => {
		if (configuredFlow !== 'fuel_station') return configuredFlow;
		try {
			validateFuelStationFlowData(order?.scenario_config?.flow_data, { requireSnapshot: true });
			return configuredFlow;
		} catch {
			return '';
		}
	})();
	const requestedTypes = [forcedType, validatedFlow, order?.scenario, order?.type, 'fixed']
		.filter((value): value is string => typeof value === 'string' && value.length > 0)
		.map((value) => value.toLowerCase());

	const entry = requestedTypes
		.map((requestedType) =>
			Object.entries(registry).find(
				([key, definition]) =>
					key === requestedType ||
					(definition.aliases && definition.aliases.includes(requestedType))
			)
		)
		.find(Boolean);

	const [type, definition] = entry || ['fixed', registry.fixed];
	const amount = Number(order?.total_amount ?? 0);
	const isPreparing = order?.status === 'preparing';
	const waiting =
		Boolean(definition.pendingScreen) &&
		(isPreparing || (definition.requiresAmount && amount <= 0));

	// Merge any dynamic order-specific scenario_config sent by the backend
	const mergedConfig = {
		...definition.config,
		...(order?.scenario_config || {})
	};

	const activeScreen =
		waiting && definition.pendingScreen ? definition.pendingScreen : definition.screen;

	return {
		...definition,
		type,
		activeScreen,
		// screen property keeps backwards-compatibility with apps/checkout/js/scenarios.js
		screen: activeScreen,
		config: mergedConfig
	};
}
