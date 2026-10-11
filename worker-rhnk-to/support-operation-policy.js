import { SupportError } from './support-core.js';

const SCENARIOS = new Set(['fixed', 'open_amount', 'table', 'delivery']);
const SETTINGS = new Set(['payment_requisites', 'invoice_numbering', 'invoice_lifetime']);
const HASH = /^[a-f0-9]{64}$/;
const CONFIRMATION_MS = 2 * 60 * 1000;

export function assertSupportOperation({ context, operation, confirmation, timestamp }) {
  const reject = () => { throw new SupportError('SUPPORT_OPERATION_FORBIDDEN'); };
  if (!context || !operation || !confirmation || !Number.isFinite(timestamp)) reject();
  if (!['sandbox', 'live'].includes(context.workspace) || context.active !== true ||
    context.aal !== 'aal2' || !Number.isFinite(context.stepUpAt) ||
    context.stepUpAt > timestamp || timestamp - context.stepUpAt >= 300000 ||
    !Number.isFinite(context.expiresAt) || context.expiresAt <= timestamp) reject();
  for (const field of ['sessionId', 'actorId', 'authSessionId', 'targetId', 'merchantId', 'projectId']) {
    if (typeof context[field] !== 'string' || !context[field] || confirmation[field] !== context[field]) reject();
  }
  if (!Array.isArray(context.capabilities) || !context.capabilities.includes(operation.action)) reject();
  if (operation.action === 'invoice.create') {
    if (!SCENARIOS.has(operation.scenario) || operation.settingGroups !== undefined) reject();
  } else if (operation.action === 'settings.update') {
    if (operation.scenario !== undefined || !Array.isArray(operation.settingGroups) ||
      operation.settingGroups.length === 0 ||
      operation.settingGroups.some(group => !SETTINGS.has(group)) ||
      new Set(operation.settingGroups).size !== operation.settingGroups.length ||
      !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0) reject();
  } else reject();
  if (typeof operation.id !== 'string' || !operation.id || !HASH.test(operation.payloadDigest) ||
    confirmation.operationId !== operation.id || confirmation.payloadDigest !== operation.payloadDigest ||
    confirmation.action !== operation.action || confirmation.workspace !== context.workspace ||
    confirmation.approved !== true || confirmation.consumed !== false ||
    !Number.isFinite(confirmation.confirmedAt) || confirmation.confirmedAt > timestamp ||
    timestamp - confirmation.confirmedAt >= CONFIRMATION_MS ||
    !Number.isFinite(confirmation.expiresAt) || confirmation.expiresAt <= timestamp ||
    confirmation.expiresAt > Math.min(context.expiresAt, confirmation.confirmedAt + CONFIRMATION_MS)) reject();
  if (context.workspace === 'live' && confirmation.liveAcknowledged !== true) reject();
}