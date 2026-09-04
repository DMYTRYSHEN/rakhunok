import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveScenario } from './scenarios.ts';

test('resolves the four built-in checkout scenarios', () => {
  assert.equal(resolveScenario({ type: 'fixed', total_amount: 44 }).screen, 'order');
  assert.equal(resolveScenario({ type: 'open_amount' }).screen, 'amount');
  assert.equal(resolveScenario({ type: 'delivery', total_amount: 940 }).screen, 'delivery');
  assert.equal(resolveScenario({ type: 'table', status: 'preparing' }).screen, 'waiting');
  assert.equal(resolveScenario({ type: 'table', status: 'pending', total_amount: 386 }).screen, 'order');
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
    resolveScenario(
      { type: 'donation' },
      '',
      { donation: { screen: 'amount', aliases: ['donate'], requiresAmount: false } }
    ).type,
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
