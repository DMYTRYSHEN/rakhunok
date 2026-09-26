import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.MERCHANT_APP_URL || 'http://127.0.0.1:5174';
const fixture = `
const user = { id: 'synthetic-user', email: 'cashier@example.test', identities: [] };
const merchant = { id: 'synthetic-merchant', name: 'Studio Market' };
const entities = [{ id: 'entity', name: 'Studio Market long company name for responsive verification' }, { id: 'second-entity', name: 'Second Company' }];
const terminals = [{ id: 'terminal', name: 'Terrace long terminal name', code: 'T01', type: 'table', entityId: 'entity' }];
if (new URL(location.href).searchParams.has('creation-check')) terminals.push({ id: 'numeric-terminal', name: 'Numeric terminal', code: '7', type: 'table', entityId: 'entity' });
const orders = [{ id: 'fixture-order', amount: 1234.56, status: 'paid', createdAt: new Date().toISOString(), orderNumber: 'TEST-001', type: 'fixed', shareUrl: '/pay/fixture-order' }];
if (new URL(location.href).searchParams.has('invoice-dialogs')) orders.push(...[
  { id: 'fixture-table', type: 'table', status: 'paid', terminalId: 'terminal' },
  { id: 'fixture-open', type: 'open_amount', status: 'pending' },
  { id: 'fixture-closed', type: 'fixed', status: 'cancelled' }
].map(order => ({ amount: 1250, createdAt: new Date().toISOString(), orderNumber: order.id, shareUrl: '/pay/' + order.id, ...order })));
export async function getAuthGateway() { return {
  restore: async () => ({status: 'ready', user, merchant}), subscribe: () => () => {},
  createTelegramLogin: () => ({ subscribe: () => () => {}, prepare: async () => {}, destroy: () => {} })
}; }
export async function getMerchantDataGateway() { return {
  getStructure: async () => ({entities, terminals}), listOrders: async () => orders,
  subscribeOrders: () => () => {}, createOrder: async input => {
    (window.__createdOrders ??= []).push(input);
    if (!window.__allowSyntheticCreation) throw new Error('Synthetic preview: creation disabled');
    return { ...input, id: 'synthetic-created', status: 'pending', createdAt: new Date().toISOString(), shareUrl: '/pay/synthetic-created' };
  }
}; }
`;

test('Merchant App creation preserves scenario payloads and displays failures', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/auth/supabase-browser.ts')) return route.fulfill({ contentType: 'application/javascript', body: fixture });
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) return route.abort();
    return route.continue();
  });
  try {
    await page.goto(`${origin}/app/?creation-check`);
    await page.getByRole('combobox', {name:'Компанія',exact:true}).selectOption('second-entity');
    for (const [scenario, type, terminalId, tableNumber] of [
      ['Стіл', 'table', 'terminal', 30],
      ['Стіл', 'table', 'numeric-terminal', 7],
      ['Фіксована', 'fixed', undefined, undefined],
      ['Вільна сума', 'open_amount', undefined, undefined]
    ]) {
      await page.getByRole('radio', {name:scenario,exact:true}).click();
      if (terminalId) {
        await page.locator('.table-select select').selectOption(terminalId);
        if (terminalId === 'terminal') {
          const input = page.getByRole('textbox', {name:'Номер столу',exact:true});
          for (const invalid of ['', '30chairs', '1.5', '-1', '2147483648']) {
            await input.fill(invalid);
            assert.equal(await page.locator('.dock-pay-btn').isDisabled(), true);
          }
          await input.fill('30');
        } else assert.equal(await page.locator('.table-number-field').count(), 0);
      }
      if (type !== 'open_amount') {
        await page.getByRole('button', {name:'Очистити суму',exact:true}).click();
        for (const digit of ['1', '2', ',', '5']) await page.getByRole('button', {name:digit,exact:true}).click();
      }
      await page.getByRole('button', {name:'Створити рахунок',exact:true}).click();
      await page.locator('.creation-submit-btn').click();
      await page.getByRole('alert').filter({hasText:'Synthetic preview: creation disabled'}).waitFor();
      const payload = await page.evaluate(() => window.__createdOrders.at(-1));
      assert.equal(payload.type, type);
      assert.equal(payload.amount, type === 'open_amount' ? 0 : 12.5);
      assert.equal(payload.entityId, terminalId ? 'entity' : 'second-entity');
      assert.equal(payload.terminalId, terminalId);
      assert.equal(payload.tableNumber, tableNumber);
      assert.equal(payload.merchantId, 'synthetic-merchant');
      await page.keyboard.press('Escape');
      await page.locator('.liquid-card').waitFor({state:'detached'});
    }
    await page.evaluate(() => window.__allowSyntheticCreation = true);
    await page.getByRole('button', {name:'Створити рахунок',exact:true}).click();
    await page.locator('.creation-submit-btn').click();
    await page.locator('.invoice-actions').waitFor();
    assert.equal(await page.locator('.creation-error').count(), 0);
    assert.equal(await page.evaluate(() => window.__createdOrders.length), 5);
  } finally {
    await browser.close();
  }
});

test('Merchant App responsive navigation, themes, amounts and payment preview', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/auth/supabase-browser.ts')) {
      return route.fulfill({ contentType: 'application/javascript', body: fixture });
    }
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) return route.abort();
    return route.continue();
  });
  try {
    await mkdir(new URL('../test-results/merchant-design/', import.meta.url), {recursive:true});
    await page.goto(`${origin}/app/`);
    await page.getByRole('button', { name: 'Профіль', exact: true }).waitFor();
    await page.getByRole('combobox', {name:'Компанія',exact:true}).selectOption('second-entity');
    assert.equal(await page.locator('.header-company strong').textContent(), 'Second Company');
    assert.equal(await page.locator('.kasa select').count(), 0);
    await page.getByRole('radio', {name:'Стіл',exact:true}).click();
    assert.equal(await page.locator('.header-company select').count(), 0);
    assert.match(await page.locator('.header-company strong').textContent(), /^Studio Market/);
    await page.getByRole('button', {name:'1',exact:true}).click();
    assert.equal(await page.locator('.dock-pay-btn').isDisabled(), true);
    const tableNumberInput = page.getByRole('textbox', {name:'Номер столу',exact:true});
    assert.equal(await tableNumberInput.inputValue(), '');
    await tableNumberInput.fill('30chairs');
    assert.equal(await tableNumberInput.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('.dock-pay-btn').isDisabled(), true);
    await tableNumberInput.fill('30');
    assert.equal(await page.getByRole('button', {name:'Створити рахунок',exact:true}).isEnabled(), true);
    await page.getByRole('radio', {name:'Фіксована',exact:true}).click();
    assert.equal(await tableNumberInput.count(), 0);
    assert.equal(await page.getByRole('combobox', {name:'Компанія',exact:true}).inputValue(), 'second-entity');
    await page.getByRole('combobox', {name:'Компанія',exact:true}).selectOption('entity');
    await context.setOffline(true);
    await page.getByRole('status', {name:'Офлайн',exact:true}).waitFor();
    assert.equal(await page.locator('.connection-status .offline').count(), 1);
    await context.setOffline(false);
    await page.getByRole('status', {name:'Онлайн',exact:true}).waitFor();
    assert.equal(await page.locator('.connection-status .offline').count(), 0);
    for (const scenario of ['Фіксована', 'Стіл']) {
      await page.getByRole('radio', {name:scenario,exact:true}).click();
      await page.getByRole('button', {name:'Очистити суму',exact:true}).click();
      for (const key of ['1','2',',','3','4','5','6']) await page.getByRole('button', {name:key,exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '12.34');
      await page.getByRole('button', {name:'Видалити цифру',exact:true}).click();
      await page.getByRole('button', {name:'9',exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '12.39');
      await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
      for (const key of ['+','0',',','1','2','3']) await page.getByRole('button', {name:key,exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '12.39+0.12');
      await page.getByRole('button', {name:'=',exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '12.51');
      await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
    }
    for (const viewport of [{width:320,height:568},{width:375,height:560},{width:375,height:667},{width:390,height:844},{width:768,height:1024},{width:900,height:900},{width:1440,height:900}]) {
      await page.setViewportSize(viewport);
      await page.getByRole('button', { name: 'Каса', exact: true }).click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.header-logo')).backgroundColor !== 'rgba(0, 0, 0, 0)');
      const headerGeometry = await page.locator('.header-logo').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const siblings = [...element.parentElement.children].filter(sibling => sibling !== element);
        return { width: bounds.width, height: bounds.height, right: bounds.right, background: getComputedStyle(element).backgroundColor, siblings: siblings.map(sibling => ({ name: sibling.className, left: sibling.getBoundingClientRect().left, width: sibling.getBoundingClientRect().width })) };
      });
      assert.equal(headerGeometry.width >= 44 && headerGeometry.height >= 44 && headerGeometry.siblings.every(sibling => headerGeometry.right <= sibling.left + 1) && headerGeometry.background !== 'rgba(0, 0, 0, 0)', true, JSON.stringify({viewport, headerGeometry}));
      await page.getByRole('button', { name: 'Каса', exact: true }).click();
      await page.getByRole('radio', { name: 'Фіксована', exact: true }).click();
      if (viewport.height <= 667) {
        for (const scenario of ['Фіксована', 'Стіл']) {
          await page.getByRole('radio', {name:scenario,exact:true}).click();
          for (const expanded of [false, true]) {
            if (expanded) await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
            await page.locator('.kasa').evaluate(element => element.scrollTop = 0);
            const clipped = await page.locator('.kasa button').evaluateAll(buttons => buttons.filter(button => {
              const bounds = button.getBoundingClientRect();
              const workspace = button.closest('.kasa').getBoundingClientRect();
              return bounds.top < workspace.top - 1 || bounds.bottom > workspace.bottom + 1 || bounds.width < 44 || bounds.height < 44;
            }).map(button => button.getAttribute('aria-label') || button.textContent));
            assert.deepEqual(clipped, [], `${JSON.stringify(viewport)} ${scenario} calculator=${expanded}`);
          }
          await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
        }
        assert.equal(await page.locator('.header-logo').evaluate(element => {
          const style = getComputedStyle(element);
          return element.parentElement.firstElementChild === element && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && element.clientWidth >= 44;
        }), true, 'Neutral logo tile must be first in header');
        await page.getByRole('radio', {name:'Фіксована',exact:true}).click();
      }
      await page.getByRole('button', { name: 'Очистити суму', exact: true }).click();
      for (let digit = 0; digit < 9; digit++) await page.getByRole('button', {name:'9',exact:true}).click();
      await page.locator('.keypad button').last().scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const keypad = document.querySelector('.keypad').getBoundingClientRect();
        const dock = document.querySelector('.dock-container').getBoundingClientRect();
        const amount = document.querySelector('.amount-window').getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth > innerWidth, overlap:innerWidth < 900 && keypad.bottom > dock.top + 1, amountFits:amount.width <= document.querySelector('.amount-block').clientWidth};
      });
      assert.deepEqual(geometry, {overflow:false, overlap:false, amountFits:true}, JSON.stringify(viewport));
      assert.equal(await page.locator('.amount-reel').evaluate(element => element.scrollWidth <= element.parentElement.clientWidth + 1), true, 'Amount digits must not be clipped');
      assert.equal(await page.locator('.dock-pay-btn').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'Payment action must fit');
      await page.getByRole('radio', { name: 'Вільна сума', exact: true }).click();
      assert.equal(await page.locator('.keypad').count(), 0);
      assert.equal(await page.locator('.open-amount-state').isVisible(), true);
      assert.equal(await page.locator('.amount-window').count(), 0);
      await page.getByRole('radio', { name: 'Стіл', exact: true }).click();
      await page.getByRole('button', {name:'Очистити суму',exact:true}).click();
      await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
      assert.equal(await page.getByRole('button', {name:'Калькулятор',exact:true}).getAttribute('aria-expanded'), 'true');
      for (const key of ['1','2','+','3','=']) await page.getByRole('button', {name:key,exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '15');
      await page.getByRole('button', {name:'Видалити цифру',exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), '1');
      await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
      assert.equal(await page.locator('.arithmetic').count(), 0);
      await page.getByRole('button', { name: 'Профіль', exact: true }).click();
      for (const [label, theme] of [['Світла','light'],['Темна','dark']]) {
        await page.getByRole('button', {name:label,exact:true}).click();
        await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
        assert.equal(await page.evaluate(() => localStorage.getItem('rahunok:theme')), theme);
        await page.getByRole('button', {name:'Каса',exact:true}).click();
        await page.getByRole('radio', {name:'Фіксована',exact:true}).click();
        await page.getByRole('button', {name:'Очистити суму',exact:true}).click();
        for (const digit of ['1','2','5','0']) await page.getByRole('button', {name:digit,exact:true}).click();
        await page.locator('.kasa').evaluate(element => element.scrollTop = 0);
        const brand = await page.locator('.kasa').evaluate(async element => {
          const fonts = await document.fonts.load('600 16px Manrope', '1250 \u041a\u0430\u0441\u0430');
          const action = getComputedStyle(document.querySelector('.payment-toolbar .dock-pay-btn'));
          return { font: getComputedStyle(element).fontFamily, loaded: fonts.length > 0 && fonts.every(font => font.status === 'loaded'), background: action.backgroundColor, color: action.color };
        });
        assert.match(brand.font, /Manrope/);
        assert.equal(brand.loaded, true, 'Local Latin and Cyrillic Manrope subsets load');
        assert.equal(brand.background, 'rgb(197, 65, 50)');
        assert.equal(brand.color, 'rgb(255, 255, 255)');
        if (viewport.width === 390 || viewport.width === 768) {
          assert.equal(await page.locator('.kasa').evaluate(element => element.scrollHeight <= element.clientHeight + 1), true, 'Primary entry should fit a standard mobile/tablet viewport');
        }
        if (viewport.width >= 900) {
          assert.equal(await page.evaluate(() => {
            const entry = document.querySelector('.entry-workspace').getBoundingClientRect();
            const action = document.querySelector('.payment-toolbar').getBoundingClientRect();
            return Math.abs(entry.left - action.left) < 2 && Math.abs(entry.right - action.right) < 2;
          }), true, 'Desktop payment action aligns with amount entry');
        }
        await page.screenshot({path:new URL(`../test-results/merchant-design/${viewport.width}-${theme}.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
        await page.getByRole('button', {name:'Профіль',exact:true}).click();
      }
      await page.getByRole('button', {name:'Історія',exact:true}).click();
      await page.locator('.history-row').first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    for (const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:1440,height:900}]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({reducedMotion:'no-preference'});
      for (const [label, kind, part, animation] of [['Каса','kasa','.bag','settle-bag'],['Історія','history','.invoice','unfold-invoice'],['Профіль','profile','.avatar','reveal-avatar']]) {
        await page.getByRole('button', {name:label,exact:true}).click();
        const icon = page.locator(`[data-liquid-icon="${kind}"]`);
        assert.equal(await icon.locator('linearGradient').count(), 0);
        assert.equal(await icon.locator('filter').count(), 0);
        assert.equal(await icon.locator('svg').getAttribute('stroke'), 'currentColor');
        assert.equal(await icon.locator('svg').getAttribute('stroke-width'), '1.65');
        if (kind === 'history') assert.equal(await icon.locator('.invoice-currency').textContent(), '₴');
        assert.match(await icon.locator(part).evaluate(element => getComputedStyle(element).animationName), new RegExp(animation));
        const frames = await icon.locator(part).evaluate(element => {
          const animation = element.getAnimations()[0];
          animation.pause();
          animation.currentTime = 100;
          const start = getComputedStyle(element).transform;
          animation.currentTime = 800;
          return [start, getComputedStyle(element).transform];
        });
        assert.notEqual(frames[0], frames[1], `${kind} must move`);
        await page.screenshot({path:new URL(`../test-results/merchant-design/${viewport.width}-${kind}-motion.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.liquid-icon .motion, .bag path:last-child, .avatar circle').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')), true);
      await page.getByRole('button', {name:'Каса',exact:true}).click();
      const manualAmount = await page.locator('.amount-window').getAttribute('aria-label');
      await page.getByRole('button', {name:'Товари',exact:true}).click();
      assert.equal(await page.locator('.order-composer').isVisible(), false, 'Empty inactive cart is hidden');
      assert.equal(await page.locator('.cart-toggle').isVisible(), false, 'Empty cart toggle is hidden');
      assert.equal(await page.locator('.payment-toolbar').evaluate(element => element.classList.contains('visible')), false);
      for (const image of await page.locator('.product-photo img').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(image => image.decode());
        assert.equal(await image.evaluate(image => image.naturalWidth > 0), true);
      }
      await page.getByRole('button', {name:'Додати Еспресо',exact:true}).click();
      await page.getByRole('button', {name:'Додати Еспресо',exact:true}).click();
      await page.getByRole('button', {name:'Додати Круасан',exact:true}).click();
      if (viewport.width < 640) {
        await page.locator('.products-workspace').evaluate(element => element.scrollTop = element.scrollHeight);
        assert.equal(await page.locator('.cart-toggle').evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const workspace = element.closest('.products-workspace').getBoundingClientRect();
          return bounds.top >= workspace.top && bounds.bottom <= workspace.bottom;
        }), true, 'Cart access stays visible at the end of the catalog');
        await page.locator('.cart-toggle').click();
        assert.equal(await page.locator('.order-heading h2').evaluate(element => element === document.activeElement), true);
      }
      assert.match(await page.getByLabel('Сума демонстраційного замовлення').textContent(), /225/);
      assert.equal(await page.getByRole('button', {name:'Сформувати демо',exact:true}).isDisabled(), true);
      await page.getByRole('button', {name:'Зменшити Еспресо',exact:true}).click();
      assert.match(await page.getByLabel('Сума демонстраційного замовлення').textContent(), /160/);
      await page.getByLabel('Стіл демонстраційного замовлення').selectOption('3');
      await page.getByRole('button', {name:'Сформувати демо',exact:true}).click();
      await page.getByText('Демо-замовлення сформовано', {exact:true}).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({path:new URL(`../test-results/merchant-design/${viewport.width}-products.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
      await page.getByRole('button', {name:'Нове замовлення',exact:true}).click();
      if (viewport.width < 640) {
        await page.locator('.cart-toggle').click();
        assert.equal(await page.locator('.menu-heading h1').evaluate(element => element === document.activeElement), true);
      }
      await page.getByRole('button', {name:'Сума',exact:true}).click();
      assert.equal(await page.locator('.amount-window').getAttribute('aria-label'), manualAmount);
    }
    await page.setViewportSize({width:375,height:667});
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await page.getByRole('radio', {name:'Стіл',exact:true}).click();
    await page.getByRole('button', {name:'Калькулятор',exact:true}).click();
    for (const control of await page.locator('.kasa button').all()) {
      await control.scrollIntoViewIfNeeded();
      const enlarged = await control.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const workspace = element.closest('.kasa').getBoundingClientRect();
        return {label:element.textContent, top:bounds.top, bottom:bounds.bottom, workspaceTop:workspace.top, workspaceBottom:workspace.bottom, width:element.clientWidth, scrollWidth:element.scrollWidth};
      });
      assert.equal(enlarged.top >= enlarged.workspaceTop - 1 && enlarged.bottom <= enlarged.workspaceBottom + 1 && enlarged.scrollWidth <= enlarged.width + 1, true, JSON.stringify(enlarged));
    }
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    await page.getByRole('button', {name:'Профіль',exact:true}).click();
    await page.getByRole('button', {name:'Системна',exact:true}).click();
    await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.getByRole('button', {name:'1',exact:true}).click();
    await page.getByRole('button', {name:'Створити рахунок',exact:true}).click();
    await page.locator('.liquid-card').waitFor({state:'visible'});
    assert.equal(await page.locator('.liquid-card').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)');
    await page.keyboard.press('Escape');
    await page.locator('.liquid-card').waitFor({state:'detached'});
    async function verifyInvoiceDialog(viewport, title) {
      const dialog = page.getByRole('dialog', {name:title,exact:true});
      await page.locator('.liquid-card.expanded').waitFor();
      for (const scrollEnd of [false, true]) {
        await dialog.locator('.invoice-details').evaluateAll((elements, end) => elements.forEach(element => element.scrollTop = end ? element.scrollHeight : 0), scrollEnd);
        assert.equal(await dialog.locator('.invoice-actions button').evaluateAll(elements => elements.every(element => {
          const rect = element.getBoundingClientRect();
          const panel = element.closest('[role="dialog"]').getBoundingClientRect();
          return rect.top >= panel.top && rect.bottom <= panel.bottom && rect.width >= 44 && rect.height >= 44;
        })), true, 'All invoice actions remain visible without scrolling');
      }
      assert.equal(await dialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight &&
          (innerWidth >= 768 ? Math.abs(center - innerHeight / 2) < 1 : Math.abs(rect.bottom - (innerHeight - 8)) < 1) &&
          element.scrollWidth <= element.clientWidth + 1 && getComputedStyle(element).backdropFilter === 'none';
      }), true, `${JSON.stringify(viewport)} ${title} geometry`);
      await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('button', {name:'Закрити',exact:true}).evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
      await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('button', {name:'Закрити',exact:true}).evaluate(element => element === document.activeElement), true);
      for (const control of await dialog.locator('button:enabled').all()) {
        await control.scrollIntoViewIfNeeded();
        assert.equal(await control.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const panel = element.closest('[role="dialog"]');
          const header = panel.querySelector('.invoice-dialog-header').getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 && rect.bottom <= panel.getBoundingClientRect().bottom + 1 &&
            (element.closest('header') || rect.top >= header.bottom - 1) && element.scrollWidth <= element.clientWidth + 1 ? true : false;
        }), true, `Dialog control must fit: ${await control.getAttribute('class')}`);
      }
      await dialog.locator('.layer-creation-content').evaluate(element => element.scrollTop = 0);
      return dialog;
    }
    await page.goto(`${origin}/app/?invoice-dialogs`);
    await page.getByRole('button', {name:'1',exact:true}).click();
    for (const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:1440,height:900}]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light','dark']) {
        await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
        await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
        for (const scenario of ['Фіксована','Стіл','Вільна сума']) {
          await page.getByRole('button', {name:'Каса',exact:true}).click();
          await page.getByRole('radio', {name:scenario,exact:true}).click();
          if (scenario === 'Стіл') await page.getByRole('textbox', {name:'Номер столу',exact:true}).fill('30');
          if (scenario !== 'Вільна сума') {
            await page.getByRole('button', {name:'Очистити суму',exact:true}).click();
            for (const digit of ['1','2','5','0']) await page.getByRole('button', {name:digit,exact:true}).click();
          }
          await page.getByRole('button', {name:'Створити рахунок',exact:true}).click();
          const dialog = await verifyInvoiceDialog(viewport, 'Новий рахунок');
          if (scenario === 'Стіл') assert.match(await dialog.locator('.terminal-summary').textContent(), /Terrace/);
          await page.screenshot({path:new URL(`../test-results/merchant-design/${viewport.width}-${theme}-invoice-${scenario === 'Стіл' ? 'table' : scenario === 'Фіксована' ? 'fixed' : 'open'}.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
          await page.keyboard.press('Escape');
          await page.locator('.liquid-card').waitFor({state:'detached'});
          assert.equal(await page.locator('.dock-pay-btn').evaluate(element => element === document.activeElement), true);
        }
        await page.getByRole('button', {name:'Історія',exact:true}).click();
        const rows = page.locator('.history-row');
        for (let orderIndex = 0; orderIndex < 4; orderIndex++) {
          await rows.nth(orderIndex).click();
          const dialog = await verifyInvoiceDialog(viewport, 'Рахунок');
          const qr = dialog.locator('.qr-wrapper');
          if (await qr.count()) {
            await qr.scrollIntoViewIfNeeded();
            assert.equal(await qr.evaluate(element => {
              const rect = element.getBoundingClientRect();
              const panel = element.closest('[role="dialog"]');
              return rect.width >= 150 && rect.top >= panel.querySelector('header').getBoundingClientRect().bottom && rect.bottom <= panel.getBoundingClientRect().bottom;
            }), true, 'QR fits inside content viewport');
            const before = await qr.getAttribute('data-payment-url');
            const nextQr = dialog.getByRole('button', {name:'Наступний QR',exact:true});
            await (await nextQr.isEnabled() ? nextQr : dialog.getByRole('button', {name:'Попередній QR',exact:true})).click();
            assert.notEqual(await qr.getAttribute('data-payment-url'), before);
          }
          await page.screenshot({path:new URL(`../test-results/merchant-design/${viewport.width}-${theme}-order-${orderIndex}.png`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
          await page.keyboard.press('Escape');
          await page.locator('.liquid-card').waitFor({state:'detached'});
          assert.equal(await rows.nth(orderIndex).evaluate(element => element === document.activeElement), true);
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});