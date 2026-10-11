import { createHash, randomUUID } from 'node:crypto';
import { createSupportCore, SupportError } from './support-core.js';
import { assertSupportOperation } from './support-operation-policy.js';

const ACTOR = '4917dc24-e6d9-4870-b40d-a504504d4a5b';
const TARGET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MERCHANT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SCENARIOS = ['fixed', 'open_amount', 'table', 'delivery'];

export function initialLocalState() {
  const business = () => ({ name: 'Demo Atelier', owner: 'Demo Merchant', revision: 1,
    settings: { paymentRequisites: 'UA000000000000000000000000000', prefix: 'DEMO', nextNumber: 1, lifetime: 60 },
    invoices: [] });
  return { version: 1, businesses: { sandbox: business(), live: business() }, sessions: {},
    operations: {}, audit: [] };
}

export function createLocalSupportModel({ initial = initialLocalState(), persist = () => {}, now = Date.now } = {}) {
  let state = structuredClone(initial);
  state.sessions = {};
  state.operations = {};
  const authSessionId = randomUUID();
  let stepUpAt = now();
  const credential = randomUUID();
  const fail = code => { throw new SupportError(code); };
  function transaction(work) {
    const candidate = structuredClone(state);
    const result = work(candidate);
    persist(candidate);
    state = candidate;
    return result;
  }
  function record(candidate, session, action, details = {}) {
    candidate.audit.push({ eventId: randomUUID(), timestamp: now(), actorId: ACTOR,
      sessionId: session?.id ?? null, workspace: session?.workspace ?? null,
      targetId: session?.targetId ?? null, merchantId: session?.merchantId ?? null,
      action, ...details });
  }
  const core = createSupportCore({ now,
    auth: { authenticate: async token => token === credential ? { userId: ACTOR, sessionId: authSessionId,
      aal: 'aal2', active: true, stepUpAt, expiresAt: now() + 3600000 } : null },
    store: {
      hasRole: async actor => actor === ACTOR,
      ownsMerchant: async (target, merchant) => target === TARGET && merchant === MERCHANT,
      getSession: async id => structuredClone(state.sessions[id]),
      openAudited: async (session, entry) => transaction(candidate => {
        if (Object.values(candidate.sessions).some(current => current.revokedAt === null && current.expiresAt > now())) return false;
        candidate.sessions[session.id] = session;
        candidate.audit.push(entry);
        return true;
      }),
      appendAudit: async entry => transaction(candidate => { candidate.audit.push(entry); return true; }),
      revokeAudited: async (id, actor, entry) => transaction(candidate => {
        candidate.sessions[id].revokedAt ??= now();
        candidate.sessions[id].capabilities = [];
        candidate.audit.push(entry);
        return true;
      })
    },
    reads: { overview: async () => ({ onboardingComplete: true, merchantActive: true, entityCount: 1, terminalCount: 1 }) }
  });
  function active(id) {
    const session = state.sessions[id];
    if (!session || session.revokedAt !== null || session.expiresAt <= now() || session.authSessionId !== authSessionId) fail('SUPPORT_FORBIDDEN');
    return session;
  }
  function snapshot(id) {
    const session = id ? active(id) : Object.values(state.sessions).find(current =>
      current.revokedAt === null && current.expiresAt > now()) ?? null;
    id = session?.id;
    return structuredClone({ localOnly: true, actorId: ACTOR, session,
      business: session ? state.businesses[session.workspace] : null,
      audit: state.audit.slice(-100).reverse(),
      operations: session ? Object.values(state.operations).filter(operation => operation.sessionId === id)
        .map(({ id: operationId, action, status, result }) => ({ id: operationId, action, status, result })) : [] });
  }
  function normalize(input, business) {
    if (input.action === 'invoice.create') {
      if (!SCENARIOS.includes(input.scenario)) fail('INVALID_SCENARIO');
      const amount = Number(input.amount);
      if (input.scenario !== 'open_amount' && (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001)) fail('INVALID_AMOUNT');
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      if (!title || title.length > 120) fail('INVALID_TITLE');
      const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
      if (['table', 'delivery'].includes(input.scenario) && (!reference || reference.length > 120)) fail('REFERENCE_REQUIRED');
      return { action: input.action, scenario: input.scenario, title,
        amountMinor: input.scenario === 'open_amount' ? null : Math.round(amount * 100),
        reference: ['table', 'delivery'].includes(input.scenario) ? reference : '', expectedRevision: business.revision };
    }
    if (input.action !== 'settings.update') fail('SUPPORT_OPERATION_FORBIDDEN');
    const settings = input.settings;
    if (!settings || !/^UA\d{27}$/.test(settings.paymentRequisites) || !/^[A-Z0-9-]{1,12}$/.test(settings.prefix) ||
      !Number.isSafeInteger(settings.nextNumber) || settings.nextNumber < business.settings.nextNumber || settings.nextNumber > 999999999 ||
      !Number.isSafeInteger(settings.lifetime) || settings.lifetime < 1 || settings.lifetime > 10080 ||
      !Number.isSafeInteger(input.expectedRevision)) fail('INVALID_SETTINGS');
    return { action: input.action, expectedRevision: input.expectedRevision,
      settingGroups: ['payment_requisites', 'invoice_numbering', 'invoice_lifetime'],
      settings: { paymentRequisites: settings.paymentRequisites, prefix: settings.prefix,
        nextNumber: settings.nextNumber, lifetime: settings.lifetime } };
  }
  return {
    snapshot,
    async open({ workspace, reason }) {
      if (!['sandbox', 'live'].includes(workspace) || !['INVOICE_CONFIGURATION', 'INVOICE_CREATION', 'CLIENT_REPRODUCTION'].includes(reason)) fail('INVALID_CONTEXT');
      stepUpAt = now();
      const opened = await core.open(credential, { targetId: TARGET, merchantId: MERCHANT, reason });
      transaction(candidate => {
        Object.assign(candidate.sessions[opened.id], { workspace, projectId: `local-${workspace}`,
          capabilities: workspace === 'sandbox' ? ['invoice.create', 'settings.update'] : [] });
        record(candidate, candidate.sessions[opened.id], 'workspace.enter');
      });
      await core.overview(credential, opened.id);
      return snapshot(opened.id);
    },
    elevate(id, acknowledged) {
      const session = active(id);
      if (acknowledged !== true) fail('ACKNOWLEDGEMENT_REQUIRED');
      stepUpAt = now();
      transaction(candidate => {
        candidate.sessions[id].capabilities = ['invoice.create', 'settings.update'];
        record(candidate, session, 'demo.elevation');
      });
      return snapshot(id);
    },
    prepare(id, input) {
      const session = active(id);
      if (!session.capabilities.includes(input.action) || now() - stepUpAt >= 300000) fail('ELEVATION_REQUIRED');
      const payload = normalize(input, state.businesses[session.workspace]);
      const operation = { ...payload, id: randomUUID(), sessionId: id,
        payloadDigest: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
        status: 'prepared', expiresAt: Math.min(now() + 120000, session.expiresAt) };
      transaction(candidate => {
        candidate.operations[operation.id] = operation;
        record(candidate, session, 'operation.prepare', { operationId: operation.id, digest: operation.payloadDigest });
      });
      return structuredClone(operation);
    },
    commit(id, operationId, acknowledged) {
      const session = active(id);
      const operation = state.operations[operationId];
      if (!operation || operation.sessionId !== id || acknowledged !== true) fail('SUPPORT_OPERATION_FORBIDDEN');
      if (operation.status === 'committed') return structuredClone(operation.result);
      if (operation.status !== 'prepared' || operation.expiresAt <= now()) fail('CONFIRMATION_EXPIRED');
      const context = { sessionId: id, actorId: ACTOR, authSessionId, targetId: TARGET, merchantId: MERCHANT,
        projectId: session.projectId, workspace: session.workspace, active: true, aal: 'aal2', stepUpAt,
        expiresAt: session.expiresAt, capabilities: session.capabilities };
      const confirmation = { ...context, operationId, payloadDigest: operation.payloadDigest, action: operation.action,
        approved: true, consumed: false, confirmedAt: now(), expiresAt: operation.expiresAt,
        liveAcknowledged: acknowledged };
      assertSupportOperation({ context, operation, confirmation, timestamp: now() });
      try {
        return transaction(candidate => {
          const business = candidate.businesses[session.workspace];
          if (business.revision !== operation.expectedRevision) fail('REVISION_CONFLICT');
          let result;
          if (operation.action === 'invoice.create') {
            const invoice = { id: randomUUID(), number: `${business.settings.prefix}-${business.settings.nextNumber}`,
              scenario: operation.scenario, title: operation.title, amountMinor: operation.amountMinor,
              reference: operation.reference, status: operation.scenario === 'table' ? 'preparing' : 'pending',
              createdAt: now(), expiresAt: now() + business.settings.lifetime * 60000,
              paymentRequisites: business.settings.paymentRequisites, operationId };
            business.invoices.unshift(invoice);
            business.settings.nextNumber++;
            result = { invoiceId: invoice.id, number: invoice.number, operationId };
          } else {
            business.settings = operation.settings;
            result = { operationId, revision: business.revision + 1 };
          }
          business.revision++;
          Object.assign(candidate.operations[operationId], { status: 'committed', result });
          record(candidate, session, operation.action, { operationId, outcome: 'committed', digest: operation.payloadDigest });
          return structuredClone(result);
        });
      } catch (error) {
        if (error.code === 'REVISION_CONFLICT') transaction(candidate => {
          candidate.operations[operationId].status = 'conflict';
          record(candidate, session, operation.action, { operationId, outcome: 'conflict' });
        });
        throw error;
      }
    },
    cancel(id, operationId) {
      const session = active(id);
      if (state.operations[operationId]?.sessionId !== id || state.operations[operationId].status !== 'prepared') fail('SUPPORT_OPERATION_FORBIDDEN');
      transaction(candidate => {
        candidate.operations[operationId].status = 'cancelled';
        record(candidate, session, 'operation.cancel', { operationId });
      });
      return snapshot(id);
    },
    async end(id) {
      await core.end(credential, id);
      return snapshot();
    }
  };
}