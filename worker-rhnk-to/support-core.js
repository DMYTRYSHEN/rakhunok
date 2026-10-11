const SESSION_MS = 15 * 60 * 1000;
const STEP_UP_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupportError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SupportError';
    this.code = code;
  }
}

function deny() {
  throw new SupportError('SUPPORT_FORBIDDEN');
}

function identifier(value) {
  if (typeof value !== 'string' || !UUID.test(value)) deny();
  return value.toLowerCase();
}

export function createSupportCore({ auth, store, reads, now = Date.now, randomId = () => crypto.randomUUID() }) {
  async function actorFor(credential, fresh = false) {
    let actor;
    try {
      actor = await auth.authenticate(credential);
    } catch {
      deny();
    }
    const timestamp = now();
    if (!actor || actor.aal !== 'aal2' || actor.active !== true ||
      !Number.isFinite(actor.expiresAt) || actor.expiresAt <= timestamp) deny();
    const actorId = identifier(actor.userId);
    const authSessionId = identifier(actor.sessionId);
    if (fresh && (!Number.isFinite(actor.stepUpAt) || actor.stepUpAt > timestamp ||
      timestamp - actor.stepUpAt >= STEP_UP_MS)) deny();
    if (await store.hasRole(actorId) !== true) deny();
    return { actorId, authSessionId, expiresAt: actor.expiresAt };
  }

  async function sessionFor(credential, sessionId) {
    const actor = await actorFor(credential);
    const session = await store.getSession(identifier(sessionId));
    if (!session || session.actorId !== actor.actorId ||
      session.authSessionId !== actor.authSessionId || session.mode !== 'read_only' ||
      session.revokedAt !== null || !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= now()) deny();
    if (await store.ownsMerchant(session.targetId, session.merchantId) !== true) deny();
    return session;
  }

  function event(session, action, outcome, requestId = identifier(randomId())) {
    const eventId = identifier(randomId());
    return { eventId, sessionId: session.id, actorId: session.actorId,
      targetId: session.targetId, merchantId: session.merchantId,
      requestId, action, outcome, timestamp: now() };
  }

  async function audit(entry) {
    if (await store.appendAudit(entry) !== true) {
      throw new SupportError('SUPPORT_AUDIT_UNAVAILABLE');
    }
  }

  async function guarded(work) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof SupportError) throw error;
      throw new SupportError('SUPPORT_UNAVAILABLE');
    }
  }

  return Object.freeze({
    open: (credential, input) => guarded(async () => {
      const actor = await actorFor(credential, true);
      if (!input || Object.keys(input).some(key => !['targetId', 'merchantId', 'reason'].includes(key))) deny();
      const targetId = identifier(input.targetId);
      const merchantId = identifier(input.merchantId);
      if (typeof input.reason !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(input.reason)) deny();
      if (await store.ownsMerchant(targetId, merchantId) !== true) deny();
      const session = { id: identifier(randomId()), ...actor, targetId, merchantId,
        reason: input.reason, mode: 'read_only', createdAt: now(),
        expiresAt: Math.min(now() + SESSION_MS, actor.expiresAt), revokedAt: null };
      const committed = await store.openAudited(session, event(session, 'session.open', 'allowed'));
      if (committed !== true) throw new SupportError('SUPPORT_AUDIT_UNAVAILABLE');
      return { id: session.id, targetId, merchantId, mode: session.mode, expiresAt: session.expiresAt };
    }),

    overview: (credential, sessionId) => guarded(async () => {
      const session = await sessionFor(credential, sessionId);
      const requestId = identifier(randomId());
      await audit(event(session, 'overview.read', 'started', requestId));
      let snapshot;
      try {
        snapshot = await reads.overview({ sessionId: session.id, actorId: session.actorId,
          authSessionId: session.authSessionId, requestId,
          targetId: session.targetId, merchantId: session.merchantId });
      } catch {
        await audit(event(session, 'overview.read', 'failed', requestId));
        throw new SupportError('SUPPORT_READ_FAILED');
      }
      await sessionFor(credential, sessionId);
      if (!snapshot || typeof snapshot.onboardingComplete !== 'boolean' ||
        typeof snapshot.merchantActive !== 'boolean' ||
        !Number.isSafeInteger(snapshot.entityCount) || snapshot.entityCount < 0 ||
        !Number.isSafeInteger(snapshot.terminalCount) || snapshot.terminalCount < 0) {
        throw new SupportError('SUPPORT_READ_FAILED');
      }
      const result = { requestId, snapshotAt: now(), onboardingComplete: snapshot.onboardingComplete,
        merchantActive: snapshot.merchantActive, entityCount: snapshot.entityCount,
        terminalCount: snapshot.terminalCount };
      await audit(event(session, 'overview.read', 'completed', requestId));
      await sessionFor(credential, sessionId);
      return result;
    }),

    end: (credential, sessionId) => guarded(async () => {
      const actor = await actorFor(credential);
      const session = await store.getSession(identifier(sessionId));
      if (!session || session.actorId !== actor.actorId || session.authSessionId !== actor.authSessionId) deny();
      if (await store.revokeAudited(session.id, actor, event(session, 'session.end', 'allowed')) !== true) {
        throw new SupportError('SUPPORT_AUDIT_UNAVAILABLE');
      }
      return { ended: true };
    })
  });
}