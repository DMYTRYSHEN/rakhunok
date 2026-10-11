import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupportCore } from './support-core.js';

const actorId = '4917dc24-e6d9-4870-b40d-a504504d4a5b';
const targetId = 'e0ca2c0e-4261-4865-8483-544f7304df7d';
const merchantId = '9c595f51-663b-4aaa-8701-8332bb691915';
const authSessionId = '11111111-1111-4111-8111-111111111111';

function fixture() {
  let sequence = 0;
  const state = { time: 1000000, role: true, owner: true, audit: true, readCalls: 0,
    actor: { userId: actorId, sessionId: authSessionId, aal: 'aal2', active: true,
      stepUpAt: 1000000, expiresAt: 5000000 }, sessions: new Map(), events: [] };
  const auth = { authenticate: async credential => credential === 'verified' ? { ...state.actor } : null };
  const store = {
    hasRole: async () => state.role,
    ownsMerchant: async () => state.owner,
    getSession: async sessionId => structuredClone(state.sessions.get(sessionId)),
    openAudited: async (session, entry) => {
      if (!state.audit) return false;
      if ([...state.sessions.values()].some(current => current.actorId === session.actorId &&
        current.revokedAt === null && current.expiresAt > state.time)) return false;
      state.sessions.set(session.id, structuredClone(session));
      state.events.push(entry);
      return true;
    },
    appendAudit: async entry => {
      if (!state.audit) return false;
      state.events.push(entry);
      return true;
    },
    revokeAudited: async (sessionId, actor, entry) => {
      if (!state.audit) return false;
      state.sessions.get(sessionId).revokedAt ??= state.time;
      state.events.push(entry);
      return true;
    }
  };
  const reads = { overview: async scope => {
    assert.equal(scope.targetId, targetId);
    assert.equal(scope.merchantId, merchantId);
    assert.equal(scope.actorId, actorId);
    assert.equal(scope.authSessionId, authSessionId);
    assert.ok(state.sessions.has(scope.sessionId));
    assert.ok(state.events.some(entry => entry.requestId === scope.requestId && entry.outcome === 'started'));
    state.readCalls++;
    return { onboardingComplete: true, merchantActive: true, entityCount: 1,
      terminalCount: 2, secret: 'must not escape' };
  } };
  const core = createSupportCore({ auth, store, reads, now: () => state.time,
    randomId: () => `22222222-2222-4222-8222-${String(++sequence).padStart(12, '0')}` });
  return { core, state, reads, input: { targetId, merchantId, reason: 'INVOICE_CONFIGURATION' } };
}

async function rejectsCode(promise, code = 'SUPPORT_FORBIDDEN') {
  await assert.rejects(promise, error => error.code === code && error.message === code);
}

test('opens audited read-only context, bounds expiry and returns only allowlisted fields', async () => {
  const { core, state, input } = fixture();
  const session = await core.open('verified', input);
  assert.equal(session.expiresAt, state.time + 900000);
  assert.equal(session.mode, 'read_only');
  const result = await core.overview('verified', session.id);
  assert.deepEqual(Object.keys(result).sort(), ['entityCount', 'merchantActive', 'onboardingComplete',
    'requestId', 'snapshotAt', 'terminalCount'].sort());
  assert.equal(state.events[0].actorId, actorId);
  assert.equal(state.events[0].targetId, targetId);
  assert.deepEqual(state.events.map(entry => entry.outcome), ['allowed', 'started', 'completed']);
  assert.equal(state.events[1].requestId, result.requestId);
  assert.equal(state.events[2].requestId, result.requestId);
  assert.equal(new Set(state.events.map(entry => entry.eventId)).size, 3);
  assert.deepEqual(Object.keys(core).sort(), ['end', 'open', 'overview']);
});

test('session expiry never outlives verified actor token and concurrent opens require atomic storage', async () => {
  const { core, state, input } = fixture();
  state.actor.expiresAt = state.time + 60000;
  const results = await Promise.allSettled([core.open('verified', input), core.open('verified', input)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const session = results.find(result => result.status === 'fulfilled').value;
  assert.equal(session.expiresAt, state.actor.expiresAt);
  assert.equal(state.sessions.size, 1);
  state.time += 60000;
  await rejectsCode(core.overview('verified', session.id));
});

test('rejects invalid authentication, AAL1, stale/future MFA, inactive session and missing role', async () => {
  for (const change of [state => { state.role = false; }, state => { state.actor.aal = 'aal1'; },
    state => { state.actor.active = false; }, state => { state.actor.expiresAt = state.time; },
    state => { state.actor.stepUpAt = state.time - 300000; },
    state => { state.actor.stepUpAt = state.time + 1; }]) {
    const { core, state, input } = fixture();
    change(state);
    await rejectsCode(core.open('verified', input));
    assert.equal(state.sessions.size, 0);
  }
  const { core, input } = fixture();
  await rejectsCode(core.open('forged', input));
});

test('rejects injected actor, modes, credentials, arbitrary targets and free-text reasons', async () => {
  for (const extra of [{ actorId }, { mode: 'write' }, { token: 'secret' },
    { targetId: 'not-a-uuid' }, { reason: 'Bearer secret\n' }]) {
    const { core, state, input } = fixture();
    await rejectsCode(core.open('verified', { ...input, ...extra }));
    assert.equal(state.sessions.size, 0);
  }
  const { core, state, input } = fixture();
  state.owner = false;
  await rejectsCode(core.open('verified', input));
});

test('audit failure prevents session creation and prevents both initial and completed data release', async () => {
  const { core, state, input, reads } = fixture();
  state.audit = false;
  await rejectsCode(core.open('verified', input), 'SUPPORT_AUDIT_UNAVAILABLE');
  assert.equal(state.sessions.size, 0);
  state.audit = true;
  const session = await core.open('verified', input);
  state.audit = false;
  await rejectsCode(core.overview('verified', session.id), 'SUPPORT_AUDIT_UNAVAILABLE');
  assert.equal(state.readCalls, 0);
  state.audit = true;
  reads.overview = async () => {
    state.audit = false;
    return { onboardingComplete: true, merchantActive: true, entityCount: 1, terminalCount: 0 };
  };
  await rejectsCode(core.overview('verified', session.id), 'SUPPORT_AUDIT_UNAVAILABLE');
});

test('rechecks role, ownership, auth binding, expiry and revocation on every read', async () => {
  for (const change of [state => { state.role = false; }, state => { state.owner = false; },
    state => { state.actor.userId = targetId; }, state => { state.actor.sessionId = merchantId; },
    state => { state.time += 900000; },
    state => { [...state.sessions.values()][0].revokedAt = state.time; }]) {
    const { core, state, input } = fixture();
    const session = await core.open('verified', input);
    change(state);
    await rejectsCode(core.overview('verified', session.id));
    assert.equal(state.readCalls, 0);
  }
});

test('revocation during reads discards late customer data', async () => {
  const { core, state, reads, input } = fixture();
  const session = await core.open('verified', input);
  reads.overview = async () => {
    state.role = false;
    return { onboardingComplete: true, merchantActive: true, entityCount: 1, terminalCount: 0 };
  };
  await rejectsCode(core.overview('verified', session.id));
  assert.equal(state.events.at(-1).outcome, 'started');
});

test('end is audited and idempotent, denies session reuse and does not touch customer auth', async () => {
  const { core, state, input } = fixture();
  const session = await core.open('verified', input);
  await rejectsCode(core.open('verified', input), 'SUPPORT_AUDIT_UNAVAILABLE');
  state.actor.sessionId = merchantId;
  await rejectsCode(core.end('verified', session.id));
  state.actor.sessionId = authSessionId;
  assert.deepEqual(await core.end('verified', session.id), { ended: true });
  assert.deepEqual(await core.end('verified', session.id), { ended: true });
  await rejectsCode(core.overview('verified', session.id));
  assert.equal(state.actor.active, true);
});

test('read failures and invalid snapshots never leak adapter errors or raw data', async () => {
  for (const read of [async () => { throw new Error('JWT secret bank details'); },
    async () => ({ entityCount: -1 })]) {
    const { core, reads, input } = fixture();
    const session = await core.open('verified', input);
    reads.overview = read;
    await rejectsCode(core.overview('verified', session.id), 'SUPPORT_READ_FAILED');
  }
});