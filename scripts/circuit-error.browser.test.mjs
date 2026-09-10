import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

// Explicitly opt in to an existing LOOPBACK server. Never builds or contacts production.
const configured = process.env.CIRCUIT_ERROR_BASE_URL;
const missing = '/__missing_circuit_error_local_test__';
const key = 'rakhunok:egg-game:high-score:v1';

test('editable SVG artwork renders every asset, all basket poses and readable canvas', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup();
	try {
		const result = await page.evaluate(async () => {
			const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
			const artworkUrl = resources.find((url) => new URL(url).pathname.endsWith('/egg-artwork.ts'));
			const displayUrl = resources.find((url) => new URL(url).pathname.endsWith('/egg-display.ts'));
			const wolfUrl = resources.find((url) => new URL(url).pathname.endsWith('/egg-wolf.ts'));
			const { drawArtwork } = await import(artworkUrl);
			const { drawDisplay, lanePoint } = await import(displayUrl);
			const { drawWolf, wolfPlacement, WOLF_POSES, WOLF_SCALE } = await import(wolfUrl);
			const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 380;
			const ctx = canvas.getContext('2d');
			const assets = {};
			for (const name of ['wolfLeftUp', 'wolfLeftDown', 'wolfRightUp', 'wolfRightDown', 'hare', 'window', 'hen', 'chick', 'egg', 'shell', 'grass']) {
				ctx.clearRect(0, 0, 640, 380);
				ctx.save();
				if (name.startsWith('wolf')) ctx.scale(0.6, 0.6);
				else if (!['hare', 'window', 'grass'].includes(name)) ctx.translate(320, 190);
				drawArtwork(ctx, name);
				ctx.restore();
				const data = ctx.getImageData(0, 0, 640, 380).data;
				assets[name] = data.filter((value, index) => index % 4 === 3 && value > 0).length;
			}
			const poses = ['UL', 'UR', 'LL', 'LR'].map((basket) => {
				drawDisplay(ctx, { mode: 'B', phase: 'ready', basket, eggs: [], score: 0, misses: 0, tick: 0, nextId: 0, seed: 17 });
				return canvas.toDataURL();
			});
			const geometry = ['UL', 'UR', 'LL', 'LR'].map((lane) => {
				const egg = lanePoint(lane, 5);
				const pose = WOLF_POSES[lane];
				const placement = wolfPlacement(lane, egg);
				ctx.clearRect(0, 0, 640, 380);
				drawWolf(ctx, lane, egg);
				const actual = canvas.toDataURL();
				const pixels = ctx.getImageData(0, 0, 640, 380).data;
				const bounds = { left: 640, top: 380, right: 0, bottom: 0 };
				for (let y = 0; y < 380; y++) for (let x = 0; x < 640; x++) {
					if (!pixels[(y * 640 + x) * 4 + 3]) continue;
					bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
					bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
				}
				ctx.clearRect(0, 0, 640, 380); ctx.save();
				ctx.translate(placement.x, placement.y); ctx.scale(WOLF_SCALE, WOLF_SCALE);
				drawArtwork(ctx, pose.artwork); ctx.restore();
				return {
					lane, artwork: pose.artwork, bounds, exactPose: actual === canvas.toDataURL(),
					mouth: { x: placement.x + pose.mouth.x * WOLF_SCALE, y: placement.y + pose.mouth.y * WOLF_SCALE },
					body: { x: placement.x + pose.body.x * WOLF_SCALE, y: placement.y + pose.body.y * WOLF_SCALE }
				};
			});
			ctx.clearRect(0, 0, 640, 380); ctx.save(); ctx.translate(320, 190);
			drawArtwork(ctx, 'egg', true); ctx.restore();
			return { assets, geometry, poses: new Set(poses).size, ghost: [...ctx.getImageData(320, 190, 1, 1).data], endpoints: ['UL', 'UR', 'LL', 'LR'].map((lane) => lanePoint(lane, 5)) };
		});
		// The user intentionally cleared the decorative window SVG.
		for (const [name, pixels] of Object.entries(result.assets)) {
			if (name !== 'window') assert.ok(pixels > 30, `${name} should paint visible pixels`);
		}
		assert.equal(result.poses, 4);
		assert.deepEqual(result.ghost, [133, 137, 112, 255]);
		assert.deepEqual(result.endpoints, [{ x: 233, y: 176 }, { x: 407, y: 176 }, { x: 233, y: 281 }, { x: 407, y: 281 }]);
		assert.deepEqual(result.geometry.map((pose) => pose.artwork), ['wolfLeftUp', 'wolfRightUp', 'wolfLeftDown', 'wolfRightDown']);
		for (const [index, pose] of result.geometry.entries()) {
			assert.equal(pose.exactPose, true, `${pose.lane}: exactly one supplied pose, without additional parts`);
			assert.ok(Math.abs(pose.mouth.x - result.endpoints[index].x) < 0.001);
			assert.ok(Math.abs(pose.mouth.y - result.endpoints[index].y - 10) < 0.001);
			assert.ok(pose.bounds.left > 150 && pose.bounds.right < 460, `${pose.lane}: stays between hens`);
			assert.ok(pose.bounds.top > 100 && pose.bounds.bottom < 375, `${pose.lane}: no score/footer clipping`);
		}
		for (const [upper, lower] of [[0, 2], [1, 3]]) {
			assert.ok(Math.abs(result.geometry[upper].body.x - result.geometry[lower].body.x) < 0.001, 'body must not jump horizontally');
			assert.ok(Math.abs(result.geometry[upper].body.y - result.geometry[lower].body.y) < 0.001, 'body must not jump vertically');
		}
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

test('phone landscape fills viewport and portrait restores page without resetting game', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
	try {
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await page.getByRole('button', { name: 'Крок', exact: true }).click();
		for (const [width, height] of [[844, 390], [667, 375], [568, 320], [915, 412]]) {
			await page.setViewportSize({ width, height });
			await expect(page.locator('.message')).toBeHidden();
			await expect(page.locator('.fault > header')).toBeHidden();
			const bounds = await page.locator('.fault').boundingBox();
			assert.equal(bounds.x, 0); assert.equal(bounds.y, 0);
			assert.equal(bounds.width, width); assert.equal(bounds.height, height);
			for (const selector of ['canvas', '.play-controls', '[data-lane="UL"]', '[data-lane="LL"]', '[data-lane="UR"]', '[data-lane="LR"]']) {
				const box = await page.locator(selector).boundingBox();
				assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${selector} fits ${width}x${height}`);
			}
			await page.locator('[data-lane="LR"]').tap();
			await expect(page.locator('.game')).toHaveAttribute('data-basket', 'LR');
			await expect(page.locator('.game')).toHaveAttribute('data-tick', '1');
		}
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.locator('.message')).toBeVisible();
		await expect(page.locator('.fault > header')).toBeVisible();
		await expect(page.locator('.game')).toHaveAttribute('data-tick', '1');
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

async function setup(options = {}, init) {
	const base = new URL(configured);
	assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
	assert.ok(['http:', 'https:'].includes(base.protocol));
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce', ...options });
		await context.route('**/*', (route) => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
		if (init) await context.addInitScript(init);
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const response = await page.goto(new URL(missing, base).href);
		assert.equal(response.status(), 404);
		await expect(page.locator('.game')).toHaveAttribute('data-ready', 'true');
		return { browser, context, page, errors };
	} catch (error) { await browser.close(); throw error; }
}

test('manual game: catch, three misses, restart, keyboard scope, touch, retry and 320px', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({ hasTouch: true });
	try {
		const game = page.locator('.game');
		const step = page.getByRole('button', { name: 'Крок', exact: true });
		let loads = 0;
		page.on('load', () => loads++);
		await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
		const logo = page.getByRole('link', { name: 'Рахунок — головна' }).locator('img');
		await expect(logo).toBeVisible();
		assert.equal(await logo.evaluate((image) => image.complete && image.naturalWidth > 0), true);
		await page.evaluate(() => document.fonts.ready);
		assert.equal(await page.locator('.fault').evaluate((element) => getComputedStyle(element).fontFamily.includes('Manrope')), true);
		assert.equal(await page.evaluate(() => document.fonts.check('400 16px Manrope', 'Рахунок Game')), true);
		for (const name of ['Почати заново', 'Покроково', 'Звук']) {
			const control = page.getByRole('button', { name, exact: true });
			assert.equal(await control.innerText(), '');
			await expect(control.locator('svg')).toBeVisible();
		}
		assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
		await expect(page.getByRole('button', { name: 'Покроково', exact: true })).toHaveAttribute('aria-pressed', 'true');
		assert.equal(await page.locator('canvas').getAttribute('aria-hidden'), 'true');
		await expect(game).toHaveAttribute('data-tick', '0');
		for (const [code, lane] of [['q', 'UL'], ['a', 'LL'], ['e', 'UR'], ['d', 'LR']]) {
			await page.locator('[data-lane="UL"]').focus();
			await page.keyboard.press(code);
			await expect(game).toHaveAttribute('data-basket', lane);
		}
		await page.getByRole('link', { name: 'На головну' }).focus();
		await page.keyboard.press('q');
		await expect(game).toHaveAttribute('data-basket', 'LR');
		await page.locator('[data-lane="LR"]').focus();
		await page.keyboard.press('Control+q');
		await expect(game).toHaveAttribute('data-basket', 'LR');
		const canvas = page.locator('canvas');
		await canvas.tap({ position: { x: 20, y: 20 } });
		await expect(game).toHaveAttribute('data-basket', 'UL');
		await expect(page.locator('[data-lane="UL"]')).toBeFocused();
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await step.click();
		// Seed 17, mode A: first egg is upper right, reaches basket on step seven.
		await expect(page.locator('.sr-only[aria-live]')).toContainText('Праворуч угорі: 6');
		await page.locator('[data-lane="UR"]').click();
		for (let i = 0; i < 5; i++) await step.click();
		await expect(page.getByTestId('score')).toHaveText('0');
		await step.click();
		await expect(page.getByTestId('score')).toHaveText('1');
		await expect(page.getByTestId('misses')).toHaveText('0 / 3');
		await expect(page.getByTestId('high-score')).toHaveText('1');
		assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), '1');
		await page.getByRole('button', { name: 'Пауза', exact: true }).click();
		await expect(step).toBeDisabled();
		await expect(game).toHaveAttribute('data-tick', '7');
		await page.getByRole('button', { name: 'Продовжити', exact: true }).click();
		// Mode A never spawns lower-right eggs: stay here to guarantee three misses.
		await page.locator('[data-lane="LR"]').click();
		for (let i = 0; i < 9; i++) await step.click();
		await expect(game).toHaveAttribute('data-phase', 'over');
		await expect(page.getByTestId('misses')).toHaveText('3 / 3');
		await expect(page.getByTestId('score')).toHaveText('1');
		await expect(step).toBeDisabled();
		await expect(page.getByRole('status')).toContainText('Гру завершено');
		assert.equal(await page.locator('.disclaimer, .note').count(), 0);
		assert.equal(loads, 0, 'Playing and finishing must not reload or recover the page');
		await page.getByRole('button', { name: 'Почати заново', exact: true }).click();
		await expect(game).toHaveAttribute('data-phase', 'ready');
		await expect(game).toHaveAttribute('data-tick', '0');
		await expect(page.getByTestId('score')).toHaveText('0');
		await expect(page.getByTestId('misses')).toHaveText('0 / 3');
		await expect(page.getByTestId('high-score')).toHaveText('1');
		await page.getByRole('button', { name: 'B · 4 доріжки' }).click();
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		for (let i = 0; i < 4; i++) await step.click();
		await expect(page.locator('.sr-only[aria-live]')).toContainText('Праворуч унизу');
		for (const width of [320, 390, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}px`);
		}
		await expect(page.getByRole('link', { name: 'На головну' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Спробувати ще раз' })).toBeEnabled();
		assert.equal(loads, 0);
		await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Спробувати ще раз' }).click()]);
		await expect(game).toHaveAttribute('data-ready', 'true');
		await expect(game).toHaveAttribute('data-phase', 'ready');
		await expect(page.getByTestId('high-score')).toHaveText('1');
		assert.equal(loads, 1, 'Only explicit retry reloads');
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

test('RAF advances despite basket changes, manual mode has no RAF, hidden tabs pause and cleanup cancels RAF', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } }, () => {
		// Controlled RAF clock, not fake game state: exercises the real component scheduler.
		let next = 1;
		const callbacks = new Map();
		window.requestAnimationFrame = (callback) => { const id = next++; callbacks.set(id, callback); return id; };
		window.cancelAnimationFrame = (id) => callbacks.delete(id);
		window.eggClock = {
			pending: () => callbacks.size,
			frame: (now) => { const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach((callback) => callback(now)); }
		};
	});
	try {
		const game = page.locator('.game');
		const frame = async (now) => page.evaluate((now) => window.eggClock.frame(now), now);
		// Native DOM activation avoids Playwright actionability's own RAF dependency.
		const activate = async (name) => page.getByRole('button', { name, exact: true }).evaluate((button) => button.click());
		await activate('Почати гру');
		await frame(0);
		for (let i = 1; i <= 8; i++) {
			await page.locator(`[data-lane="${i % 2 ? 'UR' : 'UL'}"]`).evaluate((button) => button.click());
			await frame(i * 100);
		}
		await expect(game).toHaveAttribute('data-tick', '2');
		await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
		await expect(game).toHaveAttribute('data-phase', 'paused');
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 0);
		await frame(50000);
		await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
		await expect(game).toHaveAttribute('data-phase', 'paused');
		await activate('Продовжити');
		await frame(60000);
		await frame(60100);
		await expect(game).toHaveAttribute('data-tick', '2');
		await activate('Покроково');
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 0);
		await activate('Продовжити');
		await frame(90000);
		await expect(game).toHaveAttribute('data-tick', '2');
		await activate('Крок');
		await expect(game).toHaveAttribute('data-tick', '3');
		await activate('Покроково');
		await activate('Продовжити');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(game).toHaveAttribute('data-phase', 'paused');
		await expect(page.getByRole('button', { name: 'Покроково', exact: true })).toHaveAttribute('aria-pressed', 'true');
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 0);
		await activate('Покроково');
		await activate('Продовжити');
		await expect.poll(() => page.evaluate(() => window.eggClock.pending())).toBe(1);
		// Mount/unmount the actual component in this document, without relying on
		// SvelteKit's hard reload fallback when navigating between unknown routes.
		await page.evaluate(async () => {
			const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
			const runtime = resources.find((url) => new URL(url).pathname.endsWith('/.vite/deps/svelte.js'));
			const component = resources.find((url) => new URL(url).pathname.endsWith('/CircuitError.svelte') && !url.includes('type=style'));
			if (!runtime || !component) throw new Error('Expected loaded Vite Svelte runtime and game component');
			// Reuse the optimized runtime: a raw source import creates a second lifecycle registry.
			const { mount, unmount, flushSync } = await import(runtime);
			const { default: Component } = await import(component);
			const host = document.createElement('div');
			document.body.append(host);
			const instance = mount(Component, { target: host, props: { status: 500 } });
			flushSync();
			window.eggMounted = { host, instance, unmount };
		});
		await page.evaluate(() => {
			const { host } = window.eggMounted;
			const buttons = [...host.querySelectorAll('button')];
			buttons.find((button) => button.getAttribute('aria-label') === 'Покроково').click();
			buttons.find((button) => button.getAttribute('aria-label') === 'Почати гру').click();
		});
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 2);
		await page.evaluate(async () => { await window.eggMounted.unmount(window.eggMounted.instance); window.eggMounted.host.remove(); });
		// Svelte queues a RAF to finish deferred DOM teardown even without transitions.
		await frame(100000);
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 1);
		await activate('Пауза');
		assert.equal(await page.evaluate(() => window.eggClock.pending()), 0);
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

test('blocked storage and invalid persisted high score do not break gameplay', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({}, () => {
		// Keep Vite's own unrelated storage access available during bootstrap.
		const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
		Storage.prototype.getItem = function (key) { if (key.startsWith('rakhunok:egg-game:')) throw new DOMException('blocked', 'SecurityError'); return get.call(this, key); };
		Storage.prototype.setItem = function (key, value) { if (key.startsWith('rakhunok:egg-game:')) throw new DOMException('blocked', 'SecurityError'); return set.call(this, key, value); };
	});
	try {
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await page.locator('[data-lane="UR"]').click();
		for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Крок', exact: true }).click();
		await expect(page.getByTestId('high-score')).toHaveText('1');
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
	const second = await setup({}, () => localStorage.setItem('rakhunok:egg-game:high-score:v1', 'Infinity'));
	try { await expect(second.page.getByTestId('high-score')).toHaveText('0'); assert.deepEqual(second.errors, []); }
	finally { await second.browser.close(); }
});

test('mouse hover selects every quadrant without activation, focus theft, scrolling or touch-move selection', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({ viewport: { width: 1280, height: 900 } });
	try {
		const canvas = page.locator('canvas');
		await canvas.scrollIntoViewIfNeeded();
		await page.getByRole('link', { name: 'На головну' }).focus();
		const before = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
		const box = await canvas.boundingBox();
		for (const [x, y, lane] of [[.2, .2, 'UL'], [.8, .2, 'UR'], [.2, .8, 'LL'], [.8, .8, 'LR']]) {
			await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
			await expect(page.locator('.game')).toHaveAttribute('data-basket', lane);
			await expect(page.getByRole('link', { name: 'На головну' })).toBeFocused();
			await expect(page.locator('.game')).toHaveAttribute('data-tick', '0');
			await expect(page.locator('.game')).toHaveAttribute('data-phase', 'ready');
		}
		assert.deepEqual(await page.evaluate(() => ({ x: scrollX, y: scrollY })), before);
		await canvas.dispatchEvent('pointermove', { pointerType: 'touch', clientX: box.x + 10, clientY: box.y + 10 });
		await expect(page.locator('.game')).toHaveAttribute('data-basket', 'LR');
		await canvas.dispatchEvent('pointermove', { pointerType: 'mouse', buttons: 1, clientX: box.x + 10, clientY: box.y + 10 });
		await expect(page.locator('.game')).toHaveAttribute('data-basket', 'LR');
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

// Device-independent WebAudio instrumentation: observes real component calls and
// deliberately holds resume promises so teardown races are reproducible.
function instrumentAudio() {
	const state = window.eggAudio = { contexts: [], frequencies: [], defer: false, reject: false };
	class Node {
		constructor(context) { this.context = context; this.connected = false; }
		connect() { this.connected = true; }
		disconnect() { this.connected = false; }
	}
	window.AudioContext = class {
		constructor() {
			this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.nodes = []; this.closed = 0;
			state.contexts.push(this);
		}
		resume() {
			if (state.reject) return Promise.reject(new Error('Audio unavailable'));
			if (state.defer) return new Promise((resolve) => { this.finish = () => { if (this.state !== 'closed') this.state = 'running'; resolve(); }; });
			this.state = 'running'; return Promise.resolve();
		}
		close() { this.closed++; this.state = 'closed'; return Promise.resolve(); }
		createOscillator() {
			const node = new Node(this);
			node.frequency = { setValueAtTime(value) { state.frequencies.push(value); } };
			node.start = () => { node.started = true; };
			node.stop = (at = this.currentTime) => { node.stopped = true; node.stopAt = at; };
			this.nodes.push(node); return node;
		}
		createGain() {
			const node = new Node(this);
			node.gain = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
			this.nodes.push(node); return node;
		}
	};
}

async function mountExtra(page) {
	await page.evaluate(async () => {
		const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
		const runtime = resources.find((url) => new URL(url).pathname.endsWith('/.vite/deps/svelte.js'));
		const component = resources.find((url) => new URL(url).pathname.endsWith('/CircuitError.svelte') && !url.includes('type=style'));
		const { mount, unmount, flushSync } = await import(runtime);
		const { default: Component } = await import(component);
		const host = document.createElement('div'); host.id = 'audio-fixture'; document.body.append(host);
		const instance = mount(Component, { target: host, props: { status: 500 } }); flushSync();
		window.audioMounted = { host, instance, unmount };
	});
	await expect(page.locator('#audio-fixture .game')).toHaveAttribute('data-ready', 'true');
}

test('audio defaults on but starts only on play; finite cues, mute, hidden and unmount cleanup', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({}, instrumentAudio);
	try {
		const sound = page.getByRole('button', { name: 'Звук', exact: true });
		await expect(sound).toHaveAttribute('aria-pressed', 'true');
		await page.locator('canvas').hover();
		assert.equal(await page.evaluate(() => window.eggAudio.contexts.length), 0);
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await page.locator('[data-lane="UR"]').click();
		await page.keyboard.press('e');
		const step = page.getByRole('button', { name: 'Крок', exact: true });
		await step.click();
		assert.equal(await page.evaluate(() => window.eggAudio.contexts.length), 1);
		await expect(sound).toHaveAttribute('aria-pressed', 'true');
		for (let i = 0; i < 6; i++) await step.click();
		await expect(page.getByTestId('score')).toHaveText('1');
		assert.deepEqual(await page.evaluate(() => window.eggAudio.frequencies.slice(-2)), [880, 1320]);
		await page.locator('[data-lane="LR"]').click();
		for (let i = 0; i < 9; i++) await step.click();
		await expect(page.locator('.game')).toHaveAttribute('data-phase', 'over');
		const notes = await page.evaluate(() => window.eggAudio.frequencies);
		assert.ok(notes.includes(640) && notes.includes(220) && notes.includes(150));
		assert.deepEqual(notes.slice(-4), [330, 247, 165, 110]);
		assert.equal(await page.evaluate(() => window.eggAudio.contexts[0].nodes.filter((node) => node.started).every((node) => node.stopped && Number.isFinite(node.stopAt))), true);
		await page.evaluate(() => { for (const node of window.eggAudio.contexts[0].nodes) node.onended?.(); });
		assert.equal(await page.evaluate(() => window.eggAudio.contexts[0].nodes.some((node) => node.connected)), false);
		await page.getByRole('button', { name: 'Почати заново', exact: true }).click();
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await step.click();
		await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
		assert.equal(await page.evaluate(() => window.eggAudio.contexts[0].nodes.some((node) => node.connected)), false);
		await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
		await sound.click();
		await expect(sound).toHaveAttribute('aria-pressed', 'false');
		assert.equal(await page.evaluate(() => window.eggAudio.contexts[0].closed), 1);
		await mountExtra(page);
		await page.locator('#audio-fixture').getByRole('button', { name: 'Почати гру', exact: true }).click();
		await page.evaluate(async () => { const { host, instance, unmount } = window.audioMounted; await unmount(instance); host.remove(); });
		assert.equal(await page.evaluate(() => window.eggAudio.contexts.every((context) => context.closed === 1 && context.nodes.every((node) => !node.connected))), true);
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});

test('pending/rejected audio activation cannot resurrect sound after cancel or unmount', { skip: !configured }, async () => {
	const { browser, page, errors } = await setup({}, instrumentAudio);
	try {
		await page.evaluate(() => { window.eggAudio.defer = true; });
		const sound = page.getByRole('button', { name: 'Звук', exact: true });
		await page.getByRole('button', { name: 'Почати гру', exact: true }).click();
		await expect(sound).toHaveAttribute('aria-busy', 'true');
		await sound.click();
		await page.evaluate(() => window.eggAudio.contexts[0].finish());
		await expect(sound).toHaveAttribute('aria-pressed', 'false');
		await mountExtra(page);
		await page.locator('#audio-fixture').getByRole('button', { name: 'Почати гру', exact: true }).click();
		await page.evaluate(async () => { const { host, instance, unmount } = window.audioMounted; await unmount(instance); host.remove(); window.eggAudio.contexts[1].finish(); });
		assert.equal(await page.evaluate(() => window.eggAudio.contexts.every((context) => context.closed === 1 && context.nodes.length === 0)), true);
		await page.evaluate(() => { window.eggAudio.defer = false; window.eggAudio.reject = true; });
		await sound.click();
		await expect(sound).toHaveAttribute('aria-pressed', 'false');
		assert.equal(await page.evaluate(() => window.eggAudio.contexts[2].closed), 1);
		await page.evaluate(() => { window.AudioContext = undefined; });
		await sound.click();
		await expect(sound).toHaveAttribute('aria-pressed', 'false');
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
});