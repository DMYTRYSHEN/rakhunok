import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv from 'ajv';

// Documentation-only validator. Ajv 6 is currently installed through ESLint;
// declare a direct pinned dependency before adopting this in runtime or CI.
const readJson = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const schema = readJson('./schema.json');
const catalog = readJson('./catalog.example.json');
const examples = readJson('./protocol.examples.json');
const ajv = new Ajv({ allErrors: true, jsonPointers: true, schemaId: 'auto' });
const validateSchema = ajv.compile(schema);

function accepts(value) {
  if (!validateSchema(value)) return false;
  // Draft-07 cannot express uniqueness by property or cross-field equality.
  if (value.documentType === 'catalog') {
    const ids = value.scenarios.map((s) => s.id);
    return new Set(ids).size === ids.length &&
      value.sync.maxBackoffMs >= value.sync.pollIntervalMs &&
      value.sync.heartbeatMs < value.sync.maxStaleMs;
  }
  if (value.documentType === 'snapshot' && value.resource.kind === 'invoice') {
    return value.resource.id === value.order.id && value.revision === value.order.revision;
  }
  return true;
}

test('draft-07 schema and all proposed examples validate', () => {
  assert.equal(ajv.validateSchema(schema), true);
  for (const value of [catalog, ...examples]) {
    assert.equal(accepts(value), true, JSON.stringify(validateSchema.errors));
  }
});

const cases = [
  ['unknown schema version', () => ({ ...catalog, schemaVersion: 2 })],
  ['unknown configuration property', () => ({ ...catalog, recipientIban: 'not-allowed' })],
  ['disabled pre-payment reconciliation', () => ({ ...catalog, sync: { ...catalog.sync, revalidateBeforePayment: false } })],
  ['unbounded polling rate', () => ({ ...catalog, sync: { ...catalog.sync, pollIntervalMs: 1 } })],
  ['heartbeat exceeding freshness budget', () => ({ ...catalog, sync: { ...catalog.sync, heartbeatMs: 30000 } })],
  ['duplicate scenario IDs', () => ({ ...catalog, scenarios: [catalog.scenarios[0], catalog.scenarios[0]] })],
  ['arbitrary renderer', () => ({ ...catalog, scenarios: [{ ...catalog.scenarios[0], renderer: 'https://example.invalid/script' }] })],
  ['fixed receipt editable amount', () => ({ ...catalog, scenarios: [{ ...catalog.scenarios[0], amountMode: 'customer-input' }] })],
  ['nested recipient override', () => ({ ...catalog, scenarios: [{ ...catalog.scenarios[0], features: { ...catalog.scenarios[0].features, recipient: 'other' } }] })],
  ['cached payment permission', () => ({ ...examples[0], canInitiate: true })],
  ['paid payment permission', () => ({ ...examples[2], canInitiate: true })],
  ['idle invoice', () => ({ ...examples[3], resource: examples[0].resource })],
  ['idle terminal with old order', () => ({ ...examples[3], order: examples[0].order })],
  ['invoice identity mismatch', () => ({ ...examples[0], order: { ...examples[0].order, id: examples[4].order.id } })],
  ['invoice revision mismatch', () => ({ ...examples[0], revision: 99 })],
  ['fractional minor amount', () => ({ ...examples[0], order: { ...examples[0].order, amountMinor: 1.5 } })],
  ['invalid timestamp', () => ({ ...examples[0], observedAt: 'yesterday' })],
  ['negative revision', () => ({ ...examples[1], revision: -1 })],
  ['private raw event payload', () => ({ ...examples[1], payload: { customer: 'private' } })],
  ['unknown lifecycle', () => ({ ...examples[0], state: 'whatever' })]
];

for (const [name, makeValue] of cases) {
  test(`rejects ${name}`, () => assert.equal(accepts(makeValue()), false));
}

test('all non-payable lifecycle states prohibit initiation', () => {
  for (const state of ['preparing', 'paid', 'cancelled', 'expired', 'failed']) {
    const value = { ...examples[2], state };
    assert.equal(accepts(value), true);
    assert.equal(accepts({ ...value, canInitiate: true }), false);
  }
});

test('terminal revisions are independent from current invoice revisions', () => {
  assert.notEqual(examples[4].revision, examples[4].order.revision);
  assert.equal(accepts(examples[4]), true);
});

test('same-revision authoritative invoice confirmation can permit initiation', () => {
  const confirmed = {
    ...examples[0],
    source: 'authoritative',
    observedAt: '2026-09-08T00:00:01Z',
    canInitiate: true
  };
  assert.equal(accepts(confirmed), true);
  assert.equal(confirmed.revision, examples[0].revision);
  assert.deepEqual(confirmed.order, examples[0].order);
  // Shape check only; runtime acceptance/freshness requires a future reducer test.
});

test('terminal rollover examples retain terminal identity without changing invoice A', () => {
  const before = { ...examples[4], revision: 11, order: examples[0].order };
  for (const snapshot of [before, examples[3], examples[4]]) {
    assert.equal(accepts(snapshot), true);
    assert.deepEqual(snapshot.resource, before.resource);
  }
  assert.notEqual(before.order.id, examples[4].order.id);
  assert.equal(examples[0].resource.id, before.order.id);
});