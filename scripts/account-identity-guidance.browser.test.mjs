import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createHarness } from './account-identity-guidance.harness.mjs';

let browser, harness;
const origin = 'http://guidance.test';
const screenshots = fileURLToPath(new URL('../test-results/account-identity-guidance/', import.meta.url));
before(async () => { harness = await createHarness(); browser = await chromium.launch(); await mkdir(screenshots, { recursive: true }); });
after(async () => { await browser?.close(); });

async function fixture(t, { width = 390, height = 844, theme = 'dark', motion = 'reduce', fallback = false } = {}) {
	const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: motion, serviceWorkers: 'block' });
	const page = await context.newPage();
	const unexpected = [], errors = [];
	page.on('pageerror', error => errors.push(error.message));
	// Fulfill every request from in-memory compiled assets. Never contact any server.
	await context.route('**/*', async route => {
		const url = new URL(route.request().url());
		const resource = url.origin === origin && route.request().method() === 'GET' && harness.resources.get(url.pathname);
		if (!resource) { unexpected.push(route.request().url()); await route.abort(); return; }
		await route.fulfill({ contentType: resource[0], body: fallback && url.pathname === '/app.css' ? '' : resource[1] });
	});
	await context.routeWebSocket('**/*', socket => { unexpected.push(socket.url()); socket.close(); });
	await page.goto(origin);
	await expect(page.locator('.identity-open')).toBeVisible();
	if (theme === 'light') await page.locator('main').evaluate(node => node.classList.add('light-theme'));
	t.after(async () => {
		assert.deepEqual(unexpected, [], 'No network/auth requests');
		assert.deepEqual(errors, [], 'No browser runtime errors');
		assert.equal(await page.evaluate(() => globalThis.authCalls), 0, 'No indirect login callbacks');
		assert.equal(context.pages().length, 1, 'No login popups');
		await context.close();
	});
	return page;
}
const dialog = page => page.getByRole('dialog');
const next = page => page.getByRole('button', { name: 'Далі', exact: true });
const back = page => page.getByRole('button', { name: 'Назад', exact: true });
async function open(page) {
	await page.locator('.identity-open').click();
	await expect(dialog(page)).toBeVisible();
	assert.equal(await dialog(page).evaluate(node => node.matches(':modal')), true);
	await expect(dialog(page).locator('h2')).toBeFocused();
}
async function closed(page) {
	await expect(dialog(page)).toHaveCount(0);
	await expect(page.locator('.identity-open')).toBeFocused();
	assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
}
async function step(page, value) {
	await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(value));
	await expect(dialog(page).locator('h2')).toBeFocused();
	assert.equal(await page.locator('.wizard-content').evaluate(node => node.scrollTop), 0);
}
const branches = [
	['new', 'Почніть із Google', 'Ця підказка не реєструє вас.', 'Тут нічого не створено'],
	['google', 'Спочатку той самий Google', 'Не виходячи з акаунта', 'лише після успішного прив’язування'],
	['telegram', 'Залишайтеся з Telegram', 'Додавання Google до Telegram-профілю ще недоступне.', 'Не використовуйте окремий вхід через Google'],
	['separate', 'Поверніться до свого бізнесу', 'Окремі акаунти не об’єднуються автоматично.', 'Не видаляйте їх і не створюйте бізнес повторно.']
];
for (const [choice, heading, instruction, summary] of branches) test(`branch ${choice}: next/back/selection/finish/reopen`, async t => {
	const page = await fixture(t);
	await open(page);
	await expect(next(page)).toBeDisabled();
	await page.locator(`input[value="${choice}"]`).check();
	await next(page).click(); await step(page, 2);
	await expect(dialog(page).locator('h2')).toHaveText(heading);
	await expect(dialog(page)).toContainText(instruction);
	if (choice === 'separate') await expect(dialog(page)).toContainText('Прив’язування Telegram у профілі не переносить бізнес з іншого акаунта.');
	await next(page).click(); await step(page, 3);
	await expect(dialog(page)).toContainText(summary);
	await back(page).click(); await step(page, 2);
	await back(page).click(); await step(page, 1);
	await expect(page.locator(`input[value="${choice}"]`)).toBeChecked();
	await next(page).click(); await next(page).click();
	await page.getByRole('button', { name: 'Зрозуміло' }).click(); await closed(page);
	await open(page); await step(page, 1);
	await expect(next(page)).toBeDisabled();
	assert.equal(await page.locator('input:checked').count(), 0);
});

test('native dialog: keyboard trap, radio arrows, Escape, backdrop, inside drag, close and rapid reopen', async t => {
	const page = await fixture(t);
	await open(page);
	await page.keyboard.press('Shift+Tab');
	await expect(page.locator('input[value="new"]')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('input[value="google"]')).toBeChecked();
	await next(page).focus(); await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: 'Закрити підказку' })).toBeFocused();
	await page.keyboard.press('Shift+Tab'); await expect(next(page)).toBeFocused();
	await page.locator('#outside').evaluate(node => node.focus());
	await expect(next(page)).toBeFocused();
	await page.keyboard.press('Escape'); await closed(page);
	await open(page);
	await page.locator('.wizard-label').click(); await expect(dialog(page)).toBeVisible();
	const header = await page.locator('.wizard-label').boundingBox();
	await page.mouse.move(header.x + 4, header.y + 4); await page.mouse.down();
	await page.mouse.move(2, 2); await page.mouse.up(); await expect(dialog(page)).toBeVisible();
	await page.mouse.click(2, 2); await closed(page);
	await open(page);
	await page.getByRole('button', { name: 'Закрити підказку' }).click(); await closed(page);
	await open(page);
	await page.evaluate(() => { document.querySelector('.wizard-close').click(); document.querySelector('.identity-open').click(); });
	await expect(dialog(page)).toBeVisible(); await expect(next(page)).toBeDisabled();
	await expect(dialog(page).locator('h2')).toBeFocused();
});

const account = (id, providers, suffix = '1') => ({ id, identities: providers.map(provider => ({ provider, id: `${provider}-${suffix}`, identity_id: `${provider}-${suffix}` })) });
test('scope changes: user, same-provider identity replacement, linking, context, logout and unmount', async t => {
	const page = await fixture(t);
	const set = patch => page.evaluate(patch => globalThis.guidanceFixture(patch), patch);
	await set({ context: 'profile', user: account('a', ['google']) });
	await open(page); await page.locator('input[value="google"]').check(); await next(page).click();
	await set({ user: account('b', ['google']) }); await closed(page);
	await open(page); await expect(next(page)).toBeDisabled();
	await set({ user: account('b', ['google'], '2') }); await closed(page);
	await open(page);
	await set({ user: account('b', ['google', 'custom:telegram'], '2') }); await closed(page);
	await open(page);
	await expect(dialog(page).locator('h2')).toHaveText('Два входи. Один профіль.');
	await expect(page.getByRole('radio')).toHaveCount(0);
	await expect(page.getByRole('progressbar')).toHaveCount(0);
	await page.getByRole('button', { name: 'Зрозуміло' }).click(); await closed(page);
	await open(page); await set({ context: 'onboarding' }); await closed(page);
	await open(page); await set({ context: 'guest', user: null }); await closed(page);
	await open(page); await expect(next(page)).toBeDisabled();
	await set({ visible: false }); await expect(page.locator('dialog')).toHaveCount(0);
	assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
	await set({ visible: true }); await open(page); await step(page, 1);
});

test('equivalent identity refresh keeps the step; closed guidance never auto-opens', async t => {
	const page = await fixture(t);
	await page.evaluate(user => globalThis.guidanceFixture({ context: 'profile', user }), account('a', ['google']));
	await expect(dialog(page)).toHaveCount(0);
	await open(page); await page.locator('input[value="google"]').check(); await next(page).click();
	await page.evaluate(user => globalThis.guidanceFixture({ user }), account('a', ['google']));
	await step(page, 2);
	await page.keyboard.press('Escape'); await closed(page);
	await page.evaluate(user => globalThis.guidanceFixture({ user }), account('b', ['custom:telegram']));
	await expect(dialog(page)).toHaveCount(0);
	await expect(page.getByRole('status')).toContainText('Google не підтверджено');
});

for (const enabled of [true, false]) test(`LoginOptions integration enabled=${enabled}: wizard never calls login`, async t => {
	const page = await fixture(t);
	await page.evaluate(enabled => globalThis.guidanceFixture({ login: true, enabled }), enabled);
	await open(page); await page.locator('input[value="new"]').check();
	await next(page).click(); await next(page).click();
	await page.getByRole('button', { name: 'Зрозуміло' }).click(); await closed(page);
	assert.equal(await page.evaluate(() => globalThis.authCalls), 0);
});

for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) for (const motion of ['reduce', 'no-preference']) {
	test(`layout ${width}px ${theme} ${motion}: scrolling, footer, themes and screenshot`, async t => {
		const page = await fixture(t, { width, height: width === 320 ? 568 : 844, theme, motion });
		await open(page);
		// Finish real animations without a timing sleep before measuring/screenshotting.
		await dialog(page).evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
		const legendLayout = await page.locator('legend').evaluate(node => {
			const rect = node.getBoundingClientRect();
			const style = getComputedStyle(node);
			return { width: rect.width, height: rect.height, lineHeight: parseFloat(style.lineHeight), writingMode: style.writingMode, groupWidth: node.parentElement.clientWidth, bottom: rect.bottom, firstOptionTop: node.parentElement.querySelector('label').getBoundingClientRect().top };
		});
		assert.equal(legendLayout.writingMode, 'horizontal-tb');
		assert.ok(legendLayout.width >= legendLayout.groupWidth - 1, 'Legend spans the group instead of shrinking into a vertical column');
		assert.ok(legendLayout.height <= legendLayout.lineHeight + 1, 'Situation heading stays on one line at supported viewport widths');
		assert.ok(legendLayout.bottom <= legendLayout.firstOptionTop, 'Situation heading remains above the options');
		const layout = await page.evaluate(() => {
			const sheet = document.querySelector('dialog'), content = document.querySelector('.wizard-content'), footer = document.querySelector('.wizard-footer');
			return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, sheet: sheet.getBoundingClientRect().toJSON(), footer: footer.getBoundingClientRect().toJSON(), contentWidth: content.clientWidth, scrollWidth: content.scrollWidth, bg: getComputedStyle(sheet).backgroundColor, ink: getComputedStyle(sheet).color, animation: getComputedStyle(sheet).animationName, padding: parseFloat(getComputedStyle(footer).paddingBottom) };
		});
		assert.ok(layout.pageWidth <= width && layout.sheet.width <= width && layout.scrollWidth <= layout.contentWidth);
		assert.ok(layout.sheet.y >= 0 && layout.footer.bottom <= layout.height + 1);
		if (width === 1280) {
			assert.equal(layout.sheet.width, 480);
			assert.equal(layout.sheet.x, (width - 480) / 2);
			assert.ok(Math.abs(layout.sheet.bottom - (layout.height - 20)) <= 1);
		}
		assert.ok(layout.padding >= 20);
		assert.equal(layout.bg, theme === 'light' ? 'rgb(242, 242, 247)' : 'rgb(34, 34, 34)');
		assert.notEqual(layout.bg, layout.ink);
		if (motion === 'reduce') assert.equal(layout.animation, 'none');
		await page.screenshot({ path: `${screenshots}/${width}-${theme}-${motion}-choices.png` });
		await page.locator('input[value="google"]').check(); await next(page).click(); await step(page, 2);
		await page.locator('.wizard-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
		const footer = await page.locator('.wizard-footer').boundingBox();
		assert.ok(footer.y + footer.height <= layout.height + 1);
		if (width === 320) assert.ok(await page.locator('.wizard-content').evaluate(node => node.scrollTop > 0));
		await next(page).click(); await step(page, 3);
		await page.screenshot({ path: `${screenshots}/${width}-${theme}-${motion}-summary.png` });
	});
}

test('standalone without global CSS: fallback tokens, sizing and prior scroll style restoration', async t => {
	const page = await fixture(t, { width: 320, height: 568, fallback: true });
	await page.evaluate(() => document.documentElement.style.setProperty('overflow', 'scroll', 'important'));
	await open(page);
	assert.equal(await page.locator('dialog').evaluate(node => getComputedStyle(node).boxSizing), 'border-box');
	assert.equal(await page.locator('dialog').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(34, 34, 34)');
	assert.ok(await page.locator('dialog').evaluate(node => node.getBoundingClientRect().width <= innerWidth));
	await page.keyboard.press('Escape');
	await expect(page.locator('.identity-open')).toBeFocused();
	assert.deepEqual(await page.evaluate(() => [document.documentElement.style.overflow, document.documentElement.style.getPropertyPriority('overflow')]), ['scroll', 'important']);
});

test('backdrop ignores secondary clicks, mismatched pointers and cancelled gestures', async t => {
	const page = await fixture(t);
	await open(page);
	await page.mouse.click(2, 2, { button: 'right' });
	await expect(dialog(page)).toBeVisible();
	await dialog(page).evaluate(node => {
		const send = (type, pointerId) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, isPrimary: true, button: 0, clientX: 2, clientY: 2 }));
		send('pointerdown', 7); send('pointerup', 8);
		send('pointerdown', 7); send('pointercancel', 7); send('pointerup', 7);
	});
	await expect(dialog(page)).toBeVisible();
	await page.mouse.click(2, 2); await closed(page);
});

test('desktop keyboard-only choice, steps, reverse restriction and Escape reset', async t => {
	const page = await fixture(t, { width: 1280, height: 800, theme: 'light' });
	await page.locator('.identity-open').focus(); await page.keyboard.press('Enter');
	await expect(dialog(page).locator('h2')).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
	await expect(page.locator('input[value="telegram"]')).toBeChecked();
	await page.keyboard.press('Tab'); await expect(next(page)).toBeFocused();
	await page.keyboard.press('Enter'); await step(page, 2);
	await expect(dialog(page)).toContainText('Додавання Google до Telegram-профілю ще недоступне.');
	await next(page).focus(); await page.keyboard.press('Enter'); await step(page, 3);
	await back(page).focus(); await page.keyboard.press('Enter'); await step(page, 2);
	await page.keyboard.press('Escape'); await closed(page);
	await page.keyboard.press('Enter'); await step(page, 1);
	await expect(next(page)).toBeDisabled();
});