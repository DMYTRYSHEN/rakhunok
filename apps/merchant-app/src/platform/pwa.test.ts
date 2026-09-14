import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.resetModules();
});

async function setup(hasWaitingWorker = false) {
	vi.resetModules();
	vi.stubEnv('PROD', true);
	vi.stubEnv('BASE_URL', '/app/');
	const reload = vi.fn();
	const postMessage = vi.fn();
	const windowMock = Object.assign(new EventTarget(), {
		location: { href: 'https://example.test/app/?code=pending-oauth', reload }
	});
	const worker = Object.assign(new EventTarget(), { state: 'installing', postMessage });
	const registration = Object.assign(new EventTarget(), {
		waiting: hasWaitingWorker ? worker : null,
		installing: worker
	});
	const serviceWorker = Object.assign(new EventTarget(), {
		controller: null as object | null,
		register: vi.fn().mockResolvedValue(registration)
	});
	vi.stubGlobal('window', windowMock);
	vi.stubGlobal('navigator', { serviceWorker });
	const pwa = await import('./pwa');
	pwa.initializePwa();
	windowMock.dispatchEvent(new Event('load'));
	await Promise.resolve();
	return { ...pwa, windowMock, serviceWorker, registration, worker, reload, postMessage };
}

describe('PWA update reload consent', () => {
	it('does not reload a pending OAuth callback on first-install controller changes', async () => {
		const app = await setup();
		app.registration.dispatchEvent(new Event('updatefound'));
		app.worker.state = 'installed';
		app.worker.dispatchEvent(new Event('statechange'));
		app.serviceWorker.controller = app.worker;
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		expect(app.reload).not.toHaveBeenCalled();
		expect(app.windowMock.location.href).toContain('?code=pending-oauth');
	});

	it('does not reload when another tab activates an available update', async () => {
		const app = await setup(true);
		app.serviceWorker.controller = app.worker;
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		expect(app.postMessage).not.toHaveBeenCalled();
		expect(app.reload).not.toHaveBeenCalled();
	});

	it.each(['waiting', 'updatefound'] as const)('reloads once only after explicitly applying a %s update', async (source) => {
		const app = await setup(source === 'waiting');
		if (source === 'updatefound') {
			app.serviceWorker.controller = {};
			app.registration.dispatchEvent(new Event('updatefound'));
			app.worker.state = 'installed';
			app.worker.dispatchEvent(new Event('statechange'));
		}
		app.applyPwaUpdate();
		expect(app.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' });
		expect(app.reload).not.toHaveBeenCalled();
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		expect(app.reload).toHaveBeenCalledTimes(1);
	});

	it('does not arm reload if apply is called without a waiting worker', async () => {
		const app = await setup();
		app.applyPwaUpdate();
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		expect(app.reload).not.toHaveBeenCalled();
	});

	it('does not arm reload when sending the update request fails', async () => {
		const app = await setup(true);
		app.postMessage.mockImplementation(() => { throw new Error('worker unavailable'); });
		expect(() => app.applyPwaUpdate()).toThrow('worker unavailable');
		app.serviceWorker.dispatchEvent(new Event('controllerchange'));
		expect(app.reload).not.toHaveBeenCalled();
	});
});