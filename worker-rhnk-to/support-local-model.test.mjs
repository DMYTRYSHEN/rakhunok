import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalSupportModel } from './support-local-model.mjs';

const invoice = { action: 'invoice.create', scenario: 'fixed', amount: 45, title: 'Local test' };
test('sandbox commit is idempotent, audited and isolated from live', async () => {
  const model = createLocalSupportModel();
  const sandbox = await model.open({ workspace: 'sandbox', reason: 'INVOICE_CREATION' });
  const operation = model.prepare(sandbox.session.id, invoice);
  const result = model.commit(sandbox.session.id, operation.id, true);
  assert.deepEqual(model.commit(sandbox.session.id, operation.id, true), result);
  assert.equal(model.snapshot(sandbox.session.id).business.invoices.length, 1);
  assert.equal(model.snapshot(sandbox.session.id).business.invoices[0].amountMinor, 4500);
  assert.ok(model.snapshot(sandbox.session.id).audit.some(entry => entry.operationId === operation.id && entry.outcome === 'committed'));
  await model.end(sandbox.session.id);
  assert.throws(() => model.commit(sandbox.session.id, operation.id, true), { code: 'SUPPORT_FORBIDDEN' });
  const live = await model.open({ workspace: 'live', reason: 'INVOICE_CONFIGURATION' });
  assert.equal(live.business.invoices.length, 0);
  assert.throws(() => model.prepare(live.session.id, invoice), { code: 'ELEVATION_REQUIRED' });
  model.elevate(live.session.id, true);
  const liveOperation = model.prepare(live.session.id, invoice);
  assert.throws(() => model.commit(live.session.id, liveOperation.id, false));
  assert.equal(model.snapshot(live.session.id).business.invoices.length, 0);
  model.commit(live.session.id, liveOperation.id, true);
});
test('revision conflicts, cancellation, invalid payloads and expired confirmations reject writes', async () => {
  let time = 1000000;
  const model = createLocalSupportModel({ now: () => time });
  const { session, business } = await model.open({ workspace: 'sandbox', reason: 'CLIENT_REPRODUCTION' });
  const settings = model.prepare(session.id, { action: 'settings.update', settings: { ...business.settings, lifetime: 90 }, expectedRevision: business.revision });
  const operation = model.prepare(session.id, invoice);
  model.commit(session.id, settings.id, true);
  assert.throws(() => model.commit(session.id, operation.id, true), { code: 'REVISION_CONFLICT' });
  assert.equal(model.snapshot(session.id).business.invoices.length, 0);
  const cancelled = model.prepare(session.id, invoice);
  model.cancel(session.id, cancelled.id);
  assert.throws(() => model.commit(session.id, cancelled.id, true));
  const expired = model.prepare(session.id, invoice);
  time += 120000;
  assert.throws(() => model.commit(session.id, expired.id, true), { code: 'CONFIRMATION_EXPIRED' });
  assert.throws(() => model.prepare(session.id, { ...invoice, amount: -1 }));
  assert.throws(() => model.prepare(session.id, { ...invoice, scenario: 'delivery', reference: '' }));
});
test('all four scenarios have independent stored values and settings snapshots', async () => {
  const model = createLocalSupportModel();
  const { session } = await model.open({ workspace: 'sandbox', reason: 'INVOICE_CREATION' });
  for (const scenario of ['fixed', 'open_amount', 'table', 'delivery']) {
    const operation = model.prepare(session.id, { ...invoice, scenario, reference: 'Demo reference' });
    model.commit(session.id, operation.id, true);
  }
  const invoices = model.snapshot(session.id).business.invoices;
  assert.equal(invoices.length, 4);
  assert.equal(invoices.find(entry => entry.scenario === 'open_amount').amountMinor, null);
  assert.equal(invoices.find(entry => entry.scenario === 'table').status, 'preparing');
  assert.ok(invoices.every(entry => entry.paymentRequisites && entry.expiresAt > entry.createdAt));
});
test('persistence failure rolls back mutation and operation consumption', async () => {
  let unavailable = false;
  const model = createLocalSupportModel({ persist: () => { if (unavailable) throw Error('disk unavailable'); } });
  const { session } = await model.open({ workspace: 'sandbox', reason: 'INVOICE_CREATION' });
  const operation = model.prepare(session.id, invoice);
  unavailable = true;
  assert.throws(() => model.commit(session.id, operation.id, true));
  assert.equal(model.snapshot(session.id).business.invoices.length, 0);
  unavailable = false;
  model.commit(session.id, operation.id, true);
  assert.equal(model.snapshot(session.id).business.invoices.length, 1);
});

test('restart preserves records and audit but revokes old sessions and prepared operations', async () => {
  let saved;
  const first = createLocalSupportModel({ persist: candidate => { saved = structuredClone(candidate); } });
  const { session } = await first.open({ workspace: 'sandbox', reason: 'INVOICE_CREATION' });
  const operation = first.prepare(session.id, { ...invoice, amount: 0.29 });
  first.commit(session.id, operation.id, true);
  assert.equal(first.snapshot().session.id, session.id);
  const restarted = createLocalSupportModel({ initial: saved });
  assert.equal(restarted.snapshot().session, null);
  assert.throws(() => restarted.commit(session.id, operation.id, true));
  const reopened = await restarted.open({ workspace: 'sandbox', reason: 'INVOICE_CONFIGURATION' });
  assert.equal(reopened.business.invoices[0].amountMinor, 29);
  assert.ok(reopened.audit.some(entry => entry.operationId === operation.id));
});