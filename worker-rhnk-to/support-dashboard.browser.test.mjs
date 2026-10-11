import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';

const origin = process.env.SUPPORT_TEST_ORIGIN ?? 'http://127.0.0.1:5190';
const actor = '4917dc24-e6d9-4870-b40d-a504504d4a5b';
const target = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const merchant = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const customerSettings = {
  revision: 2,
  document: {
    version: 2, mode: 'direct', financeName: '', financeIban: '', financeTaxId: '',
    financePurposeTemplate: '{business_purpose}',
    sellers: { 'entity-fixture': {
      vatStatus: 'no-vat', prefix: 'CLIENT', nextNumber: 42, padding: 5,
      purposeTemplate: 'Customer goods {number} dated {date}: {tax}',
      providerSellerId: '', providerCode: '', contractReference: '',
      qrCategory: 'OTHR/GDDS', qrFunction: 'UCT', allowAmountEdit: false
    } }
  }
};

for (const enrollment of ['pending', 'new', 'multiple']) test(`Support MFA lifecycle: ${enrollment}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const factorId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const factor = { id: factorId, factor_type: 'totp', status: 'unverified', friendly_name: 'Dashboard Support' };
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {}, factors: enrollment === 'new' ? [] : [factor] };
  if (enrollment === 'multiple') user.factors.unshift({ ...factor, id: '11111111-1111-4111-8111-111111111111', status: 'verified', friendly_name: 'Existing device' });
  const session = (aal) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, session_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'authenticated', aal, exp, amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: exp - 3600 }] })}.fixture`, refresh_token: 'mfa-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
  };
  let enrollments = 0;
  let verifications = 0;
  let bootstrapStatus = 503;
  const errors = [];
  const unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('https://**.supabase.co/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/auth/v1/user' && request.method() === 'GET') return route.fulfill({ json: user });
      if (path === '/auth/v1/factors' && request.method() === 'POST') {
        enrollments += 1;
        assert.equal(enrollment, 'new');
        user.factors = [factor];
        return route.fulfill({ json: { ...factor, type: 'totp', totp: { uri: 'otpauth://totp/Fixture?secret=JBSWY3DPEHPK3PXP&issuer=Fixture' } } });
      }
      if (path === `/auth/v1/factors/${factorId}/challenge`) return route.fulfill({ json: { id: 'challenge-fixture', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 60 } });
      if (path === `/auth/v1/factors/${factorId}/verify`) {
        verifications += 1;
        assert.equal(request.postDataJSON().challenge_id, 'challenge-fixture');
        if (verifications === 1) return route.fulfill({ status: 422, headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version' }, json: { code: 'mfa_verification_failed', message: 'Invalid code' } });
        factor.status = 'verified';
        return route.fulfill({ json: session('aal2') });
      }
      unexpected.push(`${request.method()} ${path}`);
      return route.abort();
    });
    await page.route('**/dashboard/api/support/*', route => {
      assert.equal(new URL(route.request().url()).pathname, '/dashboard/api/support/bootstrap');
      const payload = JSON.parse(Buffer.from(route.request().headers().authorization.split('.')[1], 'base64url').toString());
      assert.equal(payload.aal, 'aal2');
      return route.fulfill({ status: bootstrapStatus, json: bootstrapStatus === 200 ? { freshMfa: true, canWrite: false, context: null } : { error: 'SUPPORT_UNAVAILABLE' } });
    });
    await page.goto(`${origin}/dashboard/support`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async fixture => {
      const { getSupabaseBrowserClient } = await import('/src/lib/features/dashboard/api/supabase-browser.ts');
      const { error } = await getSupabaseBrowserClient().auth.setSession(fixture);
      if (error) throw error;
    }, session('aal1'));
    if (enrollment === 'new') await page.getByRole('button', { name: 'Підключити автентифікатор', exact: true }).click();
    else await page.reload({ waitUntil: 'domcontentloaded' });
    const input = page.getByLabel('Код автентифікатора', { exact: true });
    await input.waitFor();
    await expect(input).toHaveAttribute('pattern', '[0-9]{6}');
    if (enrollment === 'multiple') await page.locator('.verification select').selectOption(factorId);
    await input.fill('111111');
    const qrBefore = enrollment === 'new' ? await page.locator('.verification img').getAttribute('src') : null;
    await page.evaluate(async () => {
      const { getSupabaseBrowserClient } = await import('/src/lib/features/dashboard/api/supabase-browser.ts');
      const client = getSupabaseBrowserClient();
      const { data } = await client.auth.getSession();
      const { error } = await client.auth.setSession(data.session);
      if (error) throw error;
    });
    await expect(input).toHaveValue('111111');
    if (qrBefore) await expect(page.locator('.verification img')).toHaveAttribute('src', qrBefore);
    await page.getByRole('button', { name: 'Підтвердити', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Код не підтверджено');
    await expect(input).toHaveValue('');
    await input.fill('222222');
    await page.getByRole('button', { name: 'Підтвердити', exact: true }).click();
    await page.getByRole('heading', { name: 'Особу адміністратора підтверджено' }).waitFor();
    await expect(page.getByRole('alert')).toContainText('Сервер підтримки недоступний');
    assert.equal(await page.locator('input[maxlength="254"]').count(), 0);
    assert.equal(await page.locator('.verification img').count(), 0);
    bootstrapStatus = 403;
    await page.getByRole('button', { name: 'Повторити перевірку доступу' }).click();
    await expect(page.getByRole('alert')).toContainText('Доступ не підтверджено');
    assert.equal(await page.locator('input[maxlength="254"]').count(), 0);
    bootstrapStatus = 200;
    await page.getByRole('button', { name: 'Повторити перевірку доступу' }).click();
    await page.locator('input[maxlength="254"]').waitFor();
    assert.equal(enrollments, enrollment === 'new' ? 1 : 0);
    assert.equal(verifications, 2);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const recovery of ['check', 'reload', 'conflict', 'cabinet', 'invoice', 'open_amount', 'table', 'delivery', 'structure', 'settings', 'templates', 'revoked', 'expired']) test(`Dashboard support UI with mocked Auth and RPC: ${recovery}, MFA denial and exit`, { timeout: 90000 }, async () => {
  const invoiceScenario = recovery === 'invoice' ? 'fixed' : ['open_amount', 'table', 'delivery'].includes(recovery) ? recovery : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let context = null;
  let denySearch = false;
  let ttl = 1800;
  let businessName = 'Fixture Business';
  let settings = structuredClone(customerSettings);
  let templates = [];
  let prepared = null;
  let committed = null;
  let loseCommitResponse = true;
  let denySnapshot = false;
  let denyEnd = false;
  let cabinetEntered = false;
  let missingStructure = false;
  const ordinaryRequests = [];
  const actions = [];
  try {
    await page.route('**/dashboard/api/**', route => {
      if (!new URL(route.request().url()).pathname.startsWith('/dashboard/api/')) return route.fallback();
      ordinaryRequests.push(route.request().url());
      return route.abort();
    });
    await page.route('https://**.supabase.co/**', route => {
      if (new URL(route.request().url()).pathname === '/auth/v1/user' && route.request().method() === 'GET') {
        return route.fulfill({ json: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {}, factors: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', factor_type: 'totp', status: 'verified', friendly_name: 'Test' }] } });
      }
      if (cabinetEntered) ordinaryRequests.push(route.request().url());
      return route.abort();
    });
    await page.route('**/dashboard/api/support/*', async route => {
      assert.equal(route.request().method(), 'POST');
      assert.match(route.request().headers().authorization, /^Bearer /);
      const action = new URL(route.request().url()).pathname.split('/').at(-1);
      const input = route.request().postDataJSON();
      actions.push(action);
      let body;
      if (action === 'bootstrap') body = { actorId: actor, freshMfa: recovery === 'templates' || !committed, canWrite: recovery === 'templates' || !committed, context };
      else if (action === 'search') {
        if (denySearch) { await route.fulfill({ status: 403, json: { error: 'SUPPORT_FORBIDDEN' } }); return; }
        assert.equal(input.query, 'client@example.test');
        body = { clients: [{ targetId: target, merchantId: merchant, email: input.query, name: 'Fixture Business', active: true }] };
      } else if (action === 'open') {
        assert.equal(input.targetId, target);
        assert.equal(input.merchantId, merchant);
        context = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', targetId: target, merchantId: merchant, workspace: input.workspace, expiresAt: new Date(Date.now() + 900000).toISOString() };
        if (invoiceScenario) context.workspace = 'live';
        body = context;
      } else if (action === 'snapshot') {
        if (denySnapshot) { await route.fulfill({ status: 403, json: { error: 'SUPPORT_FORBIDDEN' } }); return; }
        assert.equal(input.sessionId, context.id);
        body = { context, data: { invoiceCreation: { fixed: recovery === 'invoice' }, merchant: { id: merchant, name: businessName, active: true, onboardingComplete: true }, settings, tableTtl: { storedSeconds: ttl, effectiveSeconds: ttl }, entities: [], terminals: [], invoices: [], structure: { entities: [{ id: 'entity-fixture', businessType: 'fop', businessName: 'Customer Legal Name', displayName: 'Customer Seller', taxId: '1234567890', bankName: 'Customer Bank', iban: `UA${'1'.repeat(27)}`, isActive: true }], terminals: [] } } };
        if (missingStructure) delete body.data.structure;
        if (recovery === 'templates') body.data.templates = structuredClone(templates);
        if (recovery === 'cabinet') body.data.invoices = [{ id: '12345678-1234-1234-1234-123456789012', number: 'CLIENT-0042',
          title: 'Customer saved invoice', status: 'pending', amount: 125, type: 'fixed', currency: 'UAH',
          createdAt: new Date().toISOString(), expiresAt: null,
          detail: { shortId: 'ABC123xyz789', description: 'Customer persisted purpose', baseAmount: 125,
            discountAmount: 0, deliveryFee: 0, tableNumber: null, terminalId: null, terminalCode: null,
            paidAt: null, paidBankCode: null } }];
        if (invoiceScenario) {
          body.data.invoiceCreation = { fixed: true, open_amount: true, table: true, delivery: true };
          body.data.structure.terminals = [{ id: 'terminal-fixture', name: 'Customer Table 7', code: 'table-7',
            type: 'table', entityId: 'entity-fixture', isActive: true }];
        }
      } else if (action === 'elevate') body = { capabilities: ['settings.table_ttl'] };
      else if (action === 'operation') {
        assert.equal(input.sessionId, context.id);
        if (input.operationId) assert.equal(input.operationId, prepared.operationId);
        body = { operation: prepared ? { ...prepared, state: committed ? 'committed' : 'prepared', result: committed } : null };
      }
      else if (action === 'prepare') {
        if (recovery === 'templates') {
          assert.ok(['templates.create', 'templates.update', 'templates.delete', 'templates.default'].includes(input.action));
          assert.deepEqual(input.fields.before, templates);
          assert.equal(input.fields.id, input.action === 'templates.create' ? null : 'template-fixture');
          committed = null;
          prepared = { operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', digest: 'a'.repeat(64), expiresAt: new Date(Date.now() + 120000).toISOString(), payload: { action: input.action, fields: input.fields, actorId: actor, targetId: target, merchantId: merchant, contextId: context.id, workspace: context.workspace } };
          return route.fulfill({ json: prepared });
        }
        if (recovery === 'settings') {
          assert.equal(input.action, 'settings.business.save');
          assert.equal(input.fields.revision, 2);
          assert.equal(input.fields.document.version, 2);
          assert.equal(input.fields.document.sellers['entity-fixture'].prefix, 'SUPPORT');
          assert.equal(Object.hasOwn(input.fields.document, 'selectedSellerId'), false);
          prepared = { operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', digest: 'a'.repeat(64), expiresAt: new Date(Date.now() + 120000).toISOString(), payload: { action: input.action, fields: input.fields, actorId: actor, targetId: target, merchantId: merchant, contextId: context.id, workspace: context.workspace } };
          return route.fulfill({ json: prepared });
        }
        if (invoiceScenario) {
          assert.equal(input.action, invoiceScenario === 'fixed' ? 'invoice.fixed.create' : 'invoice.create');
          assert.equal(input.fields.entityId, 'entity-fixture');
          assert.equal(input.fields.amount, invoiceScenario === 'open_amount' ? 0 : 100);
          if (invoiceScenario !== 'fixed') {
            assert.equal(input.fields.type, invoiceScenario);
            assert.equal(input.fields.deliveryFee, invoiceScenario === 'delivery' ? 20 : 0);
            assert.equal(input.fields.terminalId, invoiceScenario === 'table' ? 'terminal-fixture' : null);
            assert.equal(input.fields.tableNumber, invoiceScenario === 'table' ? 7 : null);
          }
          assert.match(input.fields.title, /^Customer goods CLIENT-00042 dated /);
          prepared = { operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', digest: 'a'.repeat(64), expiresAt: new Date(Date.now() + 120000).toISOString(), payload: { action: input.action, fields: input.fields, actorId: actor, targetId: target, merchantId: merchant, contextId: context.id, workspace: context.workspace } };
          return route.fulfill({ json: prepared });
        }
        if (recovery === 'structure') {
          assert.equal(input.action, 'structure.merchant.rename');
          assert.deepEqual(input.fields, { businessName: 'Customer Updated' });
          committed = null;
          prepared = { operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', digest: 'a'.repeat(64), expiresAt: new Date(Date.now() + 120000).toISOString(), payload: { action: input.action, fields: input.fields, actorId: actor, targetId: target, merchantId: merchant, contextId: context.id, workspace: context.workspace } };
          return route.fulfill({ json: prepared });
        }
        assert.equal(input.action, 'settings.table_ttl');
        assert.equal(input.nextSeconds, 3600);
        prepared = { operationId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', digest: 'a'.repeat(64), expiresAt: new Date(Date.now() + 120000).toISOString(), payload: { action: 'settings.table_ttl', actorId: actor, targetId: target, merchantId: merchant, contextId: context.id, workspace: context.workspace, previousSeconds: ttl, nextSeconds: input.nextSeconds } };
        body = prepared;
      } else if (action === 'commit') {
        assert.deepEqual(input, { sessionId: context.id, operationId: prepared.operationId, digest: prepared.digest, acknowledgement: invoiceScenario ? 'CHANGE_LIVE_BUSINESS' : 'CHANGE_SANDBOX' });
        if (recovery === 'templates') {
          const fields = prepared.payload.fields;
          if (prepared.payload.action === 'templates.delete') templates = [];
          else if (prepared.payload.action === 'templates.default') templates[0].is_default = true;
          else templates = [{ id: 'template-fixture', merchant_id: merchant, ...fields.input, created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z' }];
          committed = { committed: true, operationId: prepared.operationId, action: prepared.payload.action, template: templates[0] ?? null };
          return route.abort();
        }
        if (recovery === 'settings') {
          settings = { revision: 3, document: prepared.payload.fields.document };
          committed = { committed: true, operationId: prepared.operationId, action: prepared.payload.action, settings };
          return route.abort();
        }
        if (invoiceScenario) {
          committed = { committed: true, operationId: prepared.operationId, action: prepared.payload.action,
            invoice: { id: 'invoice-fixture', reference: 'INV-0007', amount: prepared.payload.fields.amount + (prepared.payload.fields.deliveryFee ?? 0), shortId: 'ABC123xyz789', recipientName: 'Customer Legal Name', recipientIban: `UA${'1'.repeat(27)}`, recipientTaxId: '1234567890', purpose: 'Customer authoritative purpose' } };
          return route.abort();
        }
        if (recovery === 'structure') {
          businessName = prepared.payload.fields.businessName;
          committed = { committed: true, operationId: prepared.operationId, action: prepared.payload.action };
          return route.fulfill({ json: committed });
        }
        if (recovery === 'conflict') {
          await route.fulfill({ status: 409, json: { error: 'SUPPORT_CONFLICT' } });
          return;
        }
        ttl = prepared.payload.nextSeconds;
        committed = { committed: true, operationId: prepared.operationId, tableOrderTtlSeconds: ttl };
        if (loseCommitResponse) { loseCommitResponse = false; await route.abort(); return; }
        body = { committed: true, operationId: prepared.operationId, tableOrderTtlSeconds: ttl };
      } else if (action === 'cancel') {
        assert.equal(input.operationId, prepared.operationId);
        prepared = null;
        body = { cancelled: true };
      } else if (action === 'end') {
        if (denyEnd) { await route.fulfill({ status: 503, json: { error: 'SUPPORT_UNAVAILABLE' } }); return; }
        context = null; prepared = null; committed = null; body = { ended: true };
      }
      else assert.fail(`Unexpected support operation: ${action}`);
      await route.fulfill({ status: 200, json: body });
    });
    await page.goto(`${origin}/dashboard/support`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ actor }) => {
      const { getSupabaseBrowserClient } = await import('/src/lib/features/dashboard/api/supabase-browser.ts');
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error('Missing test browser configuration');
      const projectRef = new URL(client.supabaseUrl).hostname.split('.')[0];
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, session_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'authenticated', aal: 'aal2', exp, amr: [{ method: 'totp', timestamp: exp - 3600 }] })}.fixture`;
      localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: {}, factors: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', factor_type: 'totp', status: 'verified', friendly_name: 'Test' }] } }));
    }, { actor });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const query = page.locator('input[maxlength="254"]');
    await query.waitFor();
    await query.fill('client@example.test');
    await page.locator('form').first().locator('button').click();
    await page.locator('select').selectOption(merchant);
    await page.locator('textarea').fill('Investigate payment configuration');
    await page.locator('.open-form button').click();
    await page.getByRole('heading', { name: 'Fixture Business' }).waitFor();
    if (invoiceScenario || ['cabinet', 'structure', 'settings', 'templates', 'revoked', 'expired'].includes(recovery)) {
      const authBefore = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('sb-')));
      cabinetEntered = true;
      await page.getByRole('button', { name: 'Відкрити кабінет клієнта', exact: true }).click();
      const banner = page.getByRole('region', { name: 'Кабінет клієнта', exact: true });
      await banner.getByText(/Fixture Business/).waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('rahunok_support_cabinet')), '1');
      for (const width of [1366, 375]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await banner.getByText(/Fixture Business/).waitFor();
      if (recovery === 'cabinet') {
        await page.setViewportSize({ width: 1366, height: 900 });
        const navigation = page.getByRole('navigation', { name: 'Основна навігація' });
        const expectedRoutes = [
          '/dashboard', '/dashboard/pos', '/dashboard/proformas', '/dashboard/invoices',
          ...['fixed', 'open_amount', 'table', 'delivery', 'recurring', 'rtp'].map((type) => `/dashboard/invoices/new?type=${type}`),
          '/dashboard/structure', '/dashboard/invoice-rules', '/dashboard/payment-methods',
          '/dashboard/checkout-templates', '/dashboard/public-page', '/dashboard/team',
          '/dashboard/developer-api', '/dashboard/sandbox', '/dac7', '/dashboard/settings'
        ];
        await expect(navigation.getByRole('link')).toHaveCount(expectedRoutes.length);
        for (const href of expectedRoutes) {
          await expect(navigation.locator(`a[href="${href}"]`)).toHaveCount(1);
        }
        await expect(navigation.getByRole('link', { name: /^Огляд/ })).toHaveAttribute('href', '/dashboard');
        await navigation.locator('a[href="/dashboard/invoices"]').click();
        const invoiceRegister = page.getByRole('region', { name: 'Реєстр рахунків' });
        await expect(invoiceRegister.locator('tbody')).toContainText('CLIENT-0042');
        await expect(invoiceRegister.locator('tbody')).toContainText('Customer saved invoice');
        await expect(page.getByRole('button', { name: 'Скасувати', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Диспетчер розбіжностей/ })).toHaveCount(0);
        await expect(invoiceRegister.locator('tbody a')).toHaveCount(1);
        await page.getByLabel('Пошук рахунків').fill('not-a-customer-invoice');
        await expect(invoiceRegister.locator('tbody')).toContainText('Рахунків не знайдено');
        await page.getByLabel('Пошук рахунків').fill('CLIENT-0042');
        await expect(invoiceRegister.locator('tbody')).toContainText('Customer saved invoice');
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('mobile-invoice-list')).toContainText('CLIENT-0042');
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(invoiceRegister.locator('tbody')).toContainText('CLIENT-0042');
        await invoiceRegister.locator('tbody a').click();
        await expect(page.getByRole('heading', { name: 'Customer saved invoice', exact: true })).toBeVisible();
        await expect(page.locator('main')).toContainText('Customer persisted purpose');
        await expect(page.getByRole('link', { name: 'Відкрити checkout' })).toHaveAttribute('href', '/pay/12345678-1234-1234-1234-123456789012');
        await expect(page.locator('a[href="/o/ABC123xyz789"]')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Скасувати', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Перевірити виписку банку зараз' })).toHaveCount(0);
        await expect(page.locator('#bank-proof-title')).toHaveCount(0);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Скопіювати: Коротке посилання на чек', exact: true }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/o/ABC123xyz789`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Customer saved invoice', exact: true })).toBeVisible();
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.getByRole('link', { name: 'До рахунків', exact: true }).click();
        await page.getByTestId('mobile-invoice-list').getByRole('link', { name: 'Customer saved invoice' }).click();
        await expect(page.getByRole('heading', { name: 'Customer saved invoice', exact: true })).toBeVisible();
        await page.setViewportSize({ width: 1366, height: 900 });
        assert.equal(actions.filter(action => ['elevate', 'prepare', 'commit'].includes(action)).length, 0);
        await navigation.getByRole('link', { name: 'Налаштування', exact: true }).click();
        await page.getByRole('heading', { name: 'Час активності столика', exact: true }).waitFor();
        await page.locator('label').filter({ has: page.getByRole('radio', { name: /1 година/ }) }).click();
        page.once('dialog', async dialog => {
          assert.match(dialog.message(), /Fixture Business/);
          assert.match(dialog.message(), /30 .*60/);
          await dialog.accept();
        });
        await page.getByRole('button', { name: /Зберегти/ }).click();
        await expect(page.getByRole('button', { name: /Збережено/ })).toBeVisible();
        assert.equal(ttl, 3600);
        assert.equal(actions.filter(action => action === 'commit').length, 1);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('radio', { name: /1 година/ })).toBeChecked();
        await navigation.getByRole('link', { name: /^Огляд/ }).click();
        for (const shortcut of ['Alt+2', 'Alt+3', 'Alt+n']) {
          await page.keyboard.press(shortcut);
          await expect(page).toHaveURL(`${origin}/dashboard`);
        }
        await expect(page.getByRole('link', { name: /Новий рахунок|Усі рахунки/ })).toHaveCount(0);
        await page.evaluate(() => localStorage.setItem('rahunok_default_entity_id', 'operator-selection'));
        await page.goto(`${origin}/dashboard/invoices/new?type=fixed&proformaId=foreign-proforma`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Бізнес-сценарій оплати', exact: true }).waitFor();
        await expect(page.getByLabel('Юридичний продавець · поточний отримувач')).toHaveValue('entity-fixture');
        await expect(page.getByRole('heading', { name: 'Розділ недоступний у режимі підтримки' })).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Бізнес-сценарій оплати' }).getByRole('button')).toHaveCount(0);
        await page.getByRole('button', { name: 'Переглянути рахунок', exact: true }).click();
        await expect(page.getByRole('dialog')).toContainText('Customer Legal Name');
        await expect(page.getByRole('button', { name: 'Створити рахунок і QR', exact: true })).toBeDisabled();
        await page.getByRole('button', { name: 'Закрити', exact: true }).click();
        assert.equal(await page.evaluate(() => localStorage.getItem('rahunok_default_entity_id')), 'operator-selection');
        missingStructure = true;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Бізнес-сценарій оплати', exact: true }).waitFor();
        await expect(page.locator('main')).not.toContainText('ФОП ДМИТРИШЕН');
        await expect(page.locator('main')).not.toContainText('Автоматично за профілем');
        await expect(page.locator('main')).toContainText('Реквізити клієнта недоступні');
        await expect(page.locator('#entity-select')).toHaveCount(0);
        missingStructure = false;
        await page.goto(`${origin}/dashboard/invoices/new`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Бізнес-сценарій оплати', exact: true }).waitFor();
        await expect(page.getByRole('heading', { name: 'Не вдалося відкрити dashboard' })).toHaveCount(0);
        await navigation.getByRole('link', { name: /^Огляд/ }).click();
        await expect(page.getByRole('heading', { name: 'Фінансовий огляд' })).toBeVisible();
        await banner.getByText(/Fixture Business/).waitFor();
        await page.goto(`${origin}/dashboard/pos?demo=1`, { waitUntil: 'domcontentloaded' });
        await banner.getByText(/Fixture Business/).waitFor();
        await page.getByText('Цей розділ ще не підключено до захищеного режиму підтримки. Дії клієнта заблоковано.', { exact: true }).waitFor();
        denyEnd = true;
        await banner.getByRole('button', { name: 'Вийти з кабінету клієнта' }).click();
        await page.getByText('Не вдалося підтвердити вихід на сервері. Дані очищено; повторіть вихід.', { exact: true }).waitFor();
        assert.equal(await page.getByText(/Fixture Business/).count(), 0);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('rahunok_support_cabinet')), '1');
        denyEnd = false;
      } else if (recovery === 'templates') {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(`${origin}/dashboard/checkout-templates`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Немає шаблонів' })).toBeVisible();
        page.on('dialog', async dialog => dialog.accept());
        await page.getByRole('button', { name: '+ Новий шаблон', exact: true }).click();
        const editor = page.getByRole('dialog');
        await editor.locator('input[type="text"]').first().fill('Customer checkout');
        await editor.getByRole('button', { name: 'Створити шаблон', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Customer checkout', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Змінити', exact: true }).click();
        await editor.locator('input[type="text"]').first().fill('Customer checkout updated');
        await editor.getByRole('button', { name: 'Зберегти зміни', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Customer checkout updated', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Зробити за замовчуванням', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Зробити за замовчуванням', exact: true })).toHaveCount(0);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Customer checkout updated', exact: true })).toBeVisible();
        for (const width of [1366, 390]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        await page.getByRole('button', { name: 'Видалити', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Немає шаблонів' })).toBeVisible();
        assert.equal(actions.filter(action => action === 'commit').length, 4);
        assert.deepEqual(templates, []);
      } else if (recovery === 'settings') {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(`${origin}/dashboard/invoice-rules`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByLabel('Префікс', { exact: true })).toHaveValue('CLIENT');
        await expect(page.getByLabel('Шаблон призначення', { exact: true })).toHaveValue(customerSettings.document.sellers['entity-fixture'].purposeTemplate);
        const operationChecksBeforeSave = actions.filter(action => action === 'operation').length;
        await page.getByLabel('Префікс', { exact: true }).fill('SUPPORT');
        page.once('dialog', async dialog => {
          assert.match(dialog.message(), /Fixture Business/);
          assert.match(dialog.message(), /"prefix": "SUPPORT"/);
          assert.doesNotMatch(dialog.message(), /\[object Object\]/);
          await dialog.accept();
        });
        await page.getByRole('button', { name: 'Зберегти всі чернетки', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('збережено лише в пісочниці');
        assert.equal(actions.filter(action => action === 'commit').length, 1);
        assert.equal(actions.filter(action => action === 'operation').length, operationChecksBeforeSave + 1);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByLabel('Префікс', { exact: true })).toHaveValue('SUPPORT');
        for (const width of [1366, 390]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        await page.goto(`${origin}/dashboard/payment-methods`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Customer Legal Name · Customer Bank', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Розділ недоступний у режимі підтримки' })).toHaveCount(0);
        await expect(page.locator('summary').filter({ hasText: 'Картки та гаманці' })).toHaveCount(0);
      } else if (invoiceScenario) {
        await page.evaluate(() => localStorage.setItem('rahunok_default_entity_id', 'operator-selection'));
        await page.goto(`${origin}/dashboard/invoices/new?type=${invoiceScenario}&proformaId=foreign`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByLabel('Юридичний продавець · поточний отримувач')).toHaveValue('entity-fixture');
        if (invoiceScenario !== 'open_amount') await page.getByRole('button', { name: '+100', exact: true }).click();
        if (invoiceScenario === 'delivery') await page.getByLabel(/^Вартість доставки/).fill('20');
        await page.getByRole('button', { name: 'Переглянути рахунок', exact: true }).click();
        page.once('dialog', async dialog => {
          assert.match(dialog.message(), /Fixture Business/);
          assert.match(dialog.message(), /entity-fixture/);
          await dialog.accept();
        });
        await page.getByRole('button', { name: 'Створити рахунок і QR', exact: true }).click();
        const receipt = page.getByRole('region', { name: 'Створений рахунок' });
        await expect(receipt).toContainText('INV-0007');
        await expect(receipt).toContainText('Customer Legal Name');
        await expect(receipt).toContainText(`UA${'1'.repeat(27)}`);
        await expect(receipt).toContainText('Customer authoritative purpose');
        await expect(receipt.getByRole('link')).toHaveAttribute('href', '/pay/ABC123xyz789');
        assert.equal(actions.filter(action => action === 'commit').length, 1);
        assert.equal(await page.evaluate(() => localStorage.getItem('rahunok_default_entity_id')), 'operator-selection');
      } else if (recovery === 'structure') {
        await page.evaluate(() => localStorage.setItem('rahunok_default_entity_id', 'operator-selection'));
        await page.goto(`${origin}/dashboard/structure`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Юридичні реквізити та робочі місця', exact: true }).waitFor();
        await expect(page.getByLabel('Продавець для робочих місць')).toHaveValue('entity-fixture');
        await expect(page.getByLabel('Публічна назва')).toHaveValue('Fixture Business');
        await page.getByLabel('Публічна назва').fill('Customer Updated');
        page.once('dialog', dialog => dialog.dismiss());
        await page.getByRole('button', { name: 'Зберегти назву', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Зміну скасовано.');
        assert.equal(actions.filter(action => action === 'commit').length, 0);
        page.once('dialog', async dialog => {
          assert.match(dialog.message(), /Customer Updated/);
          await dialog.accept();
        });
        await page.getByRole('button', { name: 'Зберегти назву', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Збережено', exact: true })).toBeVisible();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByLabel('Публічна назва')).toHaveValue('Customer Updated');
        for (const width of [1366, 375]) {
          await page.setViewportSize({ width, height: 900 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        assert.equal(await page.evaluate(() => localStorage.getItem('rahunok_default_entity_id')), 'operator-selection');
        assert.equal(actions.filter(action => action === 'commit').length, 1);
      } else if (recovery === 'revoked') {
        denySnapshot = true;
        await page.clock.install();
        await page.clock.fastForward(16000);
        await page.getByText('Доступ до клієнта не підтверджено або сервер підтримки недоступний.', { exact: true }).waitFor();
        assert.equal(await page.getByText(/Fixture Business/).count(), 0);
      } else {
        await page.clock.install();
        await page.clock.setSystemTime(new Date(Date.parse(context.expiresAt) + 1000));
        await page.clock.fastForward(1000);
        await page.getByText('Строк доступу до кабінету клієнта завершився.', { exact: true }).waitFor();
        assert.equal(await page.getByText(/Fixture Business/).count(), 0);
      }
      await banner.getByRole('button', { name: 'Вийти з кабінету клієнта' }).click();
      await query.waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard/support');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('rahunok_support_cabinet')), null);
      assert.deepEqual(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('sb-'))), authBefore);
      assert.deepEqual(ordinaryRequests, []);
      assert.deepEqual(errors, []);
      assert.equal(context, null);
      return;
    }
    await page.locator('select').selectOption('3600');
    await page.locator('form button').click();
    const review = page.locator('.ttl-review');
    await review.waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await review.waitFor();
    assert.equal(await review.locator('button').first().isEnabled(), false);
    await review.getByRole('checkbox').check();
    await review.locator('button').first().click();
    await page.getByRole('alert').waitFor();
    if (recovery === 'check') {
      await review.locator('button').first().click();
      await page.locator('.receipt').waitFor();
    } else if (recovery === 'conflict') {
      assert.equal(await review.locator('button').last().isEnabled(), true);
      assert.equal(await review.getByRole('checkbox').isChecked(), false);
      assert.equal(await review.locator('button').first().isEnabled(), false);
      assert.equal(committed, null);
      assert.equal(ttl, 1800);
    }
    assert.equal(actions.filter(action => action === 'prepare').length, 1);
    assert.equal(actions.filter(action => action === 'commit').length, 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (recovery !== 'conflict') {
      await page.locator('.receipt').waitFor();
      await page.locator('input[autocomplete="one-time-code"]').waitFor();
      assert.equal(actions.filter(action => action === 'commit').length, 1);
    } else await review.waitFor();
    await page.getByRole('heading', { name: 'Fixture Business' }).waitFor();
    context = null;
    prepared = null;
    committed = null;
    await page.evaluate(async () => {
      const { getSupabaseBrowserClient } = await import('/src/lib/features/dashboard/api/supabase-browser.ts');
      const client = getSupabaseBrowserClient();
      const { data } = await client.auth.getSession();
      const segments = data.session.access_token.split('.');
      const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
      payload.session_id = 'abababab-abab-4bab-8bab-abababababab';
      segments[1] = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const { error } = await client.auth.setSession({ access_token: segments.join('.'), refresh_token: 'second-fixture-session' });
      if (error) throw error;
    });
    await query.waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Fixture Business' }).count(), 0);
    await query.fill('client@example.test');
    await page.locator('form').first().locator('button').click();
    await page.locator('select').selectOption(merchant);
    await page.locator('textarea').fill('Investigate payment configuration');
    await page.locator('.open-form button').click();
    await page.getByRole('heading', { name: 'Fixture Business' }).waitFor();
    for (const width of [1366, 375]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.locator('.context button').click();
    await query.waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Fixture Business' }).count(), 0);
    denySearch = true;
    await query.fill('client@example.test');
    await page.locator('form').first().locator('button').click();
    await page.locator('input[autocomplete="one-time-code"]').waitFor();
    assert.equal(await page.locator('[role="alert"]').count(), 1);
    assert.ok(actions.includes('end'));
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error({ url: page.url(), errors, actions, ordinaryRequests, body: await page.locator('body').innerText() });
    throw error;
  } finally { await browser.close(); }
});