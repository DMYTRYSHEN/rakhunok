import type { Order } from '../types/order.js';
import type { ResolvedScenario, ScenarioDefinition } from '../types/scenario.js';
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
  const requestedType = String(forcedType || order?.scenario || order?.type || 'fixed').toLowerCase();

  const entry = Object.entries(registry).find(([key, definition]) =>
    key === requestedType || (definition.aliases && definition.aliases.includes(requestedType))
  );

  const [type, definition] = entry || ['fixed', registry.fixed];
  const amount = Number(order?.total_amount ?? 0);
  const isPreparing = order?.status === 'preparing';
  const waiting = Boolean(definition.pendingScreen) && (isPreparing || (definition.requiresAmount && amount <= 0));

  // Merge any dynamic order-specific scenario_config sent by the backend
  const mergedConfig = {
    ...definition.config,
    ...(order?.scenario_config || {})
  };

  const activeScreen = waiting && definition.pendingScreen ? definition.pendingScreen : definition.screen;

  return {
    ...definition,
    type,
    activeScreen,
    // screen property keeps backwards-compatibility with apps/checkout/js/scenarios.js
    screen: activeScreen,
    config: mergedConfig
  };
}
