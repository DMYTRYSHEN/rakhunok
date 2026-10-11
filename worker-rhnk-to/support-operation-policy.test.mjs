import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSupportOperation } from './support-operation-policy.js';

function fixture(workspace = 'live') {
  const context = { workspace, active: true, aal: 'aal2', stepUpAt: 1000000,
    expiresAt: 1900000, sessionId: 'session', actorId: 'actor', authSessionId: 'auth',
    targetId: 'target', merchantId: 'merchant', projectId: 'project',
    capabilities: ['invoice.create', 'settings.update'] };
  const operation = { id: 'operation', action: 'invoice.create', scenario: 'fixed', payloadDigest: 'a'.repeat(64) };
  const confirmation = { ...context, operationId: operation.id, action: operation.action,
    payloadDigest: operation.payloadDigest, approved: true, consumed: false,
    confirmedAt: 1000000, expiresAt: 1120000, liveAcknowledged: true };
  return { context, operation, confirmation, timestamp: 1000001 };
}

test('permits each approved invoice scenario in sandbox and explicitly confirmed live workspace', () => {
  for (const workspace of ['sandbox', 'live']) {
    for (const scenario of ['fixed', 'open_amount', 'table', 'delivery']) {
      const input = fixture(workspace);
      input.operation.scenario = scenario;
      assert.doesNotThrow(() => assertSupportOperation(input));
    }
  }
});

test('permits only approved settings groups with expected revision', () => {
  const input = fixture();
  input.operation = { id: 'operation', action: 'settings.update', payloadDigest: 'a'.repeat(64),
    settingGroups: ['payment_requisites', 'invoice_numbering', 'invoice_lifetime'], expectedRevision: 2 };
  input.confirmation.action = 'settings.update';
  assert.doesNotThrow(() => assertSupportOperation(input));
  for (const groups of [[], ['api_keys'], ['invoice_numbering', 'invoice_numbering']]) {
    input.operation.settingGroups = groups;
    assert.throws(() => assertSupportOperation(input), { code: 'SUPPORT_OPERATION_FORBIDDEN' });
  }
});

test('rejects cross-session, actor, customer, merchant, project and workspace replay', () => {
  for (const field of ['sessionId', 'actorId', 'authSessionId', 'targetId', 'merchantId', 'projectId', 'workspace']) {
    const input = fixture();
    input.confirmation[field] = 'other';
    assert.throws(() => assertSupportOperation(input), { code: 'SUPPORT_OPERATION_FORBIDDEN' });
  }
});

test('rejects tampering, missing privilege, expired or consumed confirmation and revoked session', () => {
  const changes = [input => { input.operation.payloadDigest = 'b'.repeat(64); },
    input => { input.operation.id = 'other'; }, input => { input.context.capabilities = []; },
    input => { input.confirmation.consumed = true; }, input => { input.confirmation.approved = false; },
    input => { input.confirmation.liveAcknowledged = false; }, input => { input.timestamp = 1120000; },
    input => { input.context.active = false; }, input => { input.context.aal = 'aal1'; },
    input => { input.context.stepUpAt = 1; }, input => { input.confirmation.confirmedAt = 1000002; },
    input => { input.confirmation.expiresAt = 1900000; }, input => { input.operation.action = 'order.mark_paid'; }];
  for (const change of changes) {
    const input = fixture();
    change(input);
    assert.throws(() => assertSupportOperation(input), { code: 'SUPPORT_OPERATION_FORBIDDEN' });
  }
});