// Scenario definitions are plain JSON-compatible data. The edge may extend or
// override them through window.__CHECKOUT_SCENARIOS__ without changing runtime code.
export const DEFAULT_SCENARIOS = Object.freeze({
  fixed: {
    screen: 'order',
    aliases: ['fixed', 'invoice', '1'],
    requiresAmount: true
  },
  open_amount: {
    screen: 'amount',
    aliases: ['open_amount', 'amount', '2'],
    requiresAmount: false
  },
  table: {
    screen: 'order',
    pendingScreen: 'waiting',
    aliases: ['table', '3'],
    requiresAmount: true
  },
  delivery: {
    screen: 'delivery',
    aliases: ['delivery', '4'],
    requiresAmount: true
  }
});

export function createScenarioRegistry(overrides = {}) {
  const registry = {};
  for (const [key, definition] of Object.entries({ ...DEFAULT_SCENARIOS, ...overrides })) {
    registry[key] = {
      screen: 'order',
      aliases: [key],
      requiresAmount: true,
      ...definition
    };
  }
  return registry;
}

export function resolveScenario(order, forcedType = '', overrides = {}) {
  const registry = createScenarioRegistry(overrides);
  const requestedType = String(forcedType || order?.type || 'fixed').toLowerCase();
  const entry = Object.entries(registry).find(([key, definition]) =>
    key === requestedType || definition.aliases.includes(requestedType)
  );
  const [type, definition] = entry || ['fixed', registry.fixed];
  const amount = Number(order?.total_amount || 0);
  const waiting = Boolean(definition.pendingScreen) &&
    (order?.status === 'preparing' || (definition.requiresAmount && amount <= 0));

  return {
    type,
    ...definition,
    screen: waiting ? definition.pendingScreen : definition.screen
  };
}

export function setupScenarioView(order, options = {}) {
  const scenario = resolveScenario(order, options.forcedType, options.overrides);
  const screens = options.screens || {
    order: document.getElementById('screenOrder'),
    delivery: document.getElementById('screenDelivery'),
    amount: document.getElementById('screenAmount'),
    waiting: document.getElementById('screenWaiting')
  };
  Object.values(screens).forEach((screen) => screen?.classList.remove('active'));
  screens[scenario.screen]?.classList.add('active');
  return scenario;
}
