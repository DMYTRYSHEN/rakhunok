import assert from 'node:assert/strict';
import test from 'node:test';
import { launchDeepLink } from './deeplink.ts';

function installBrowserGlobals(t, values) {
	for (const [name, value] of Object.entries(values)) {
		Object.defineProperty(globalThis, name, { configurable: true, value });
	}
	t.after(() => {
		for (const name of Object.keys(values)) delete globalThis[name];
	});
}

test('Android launch tries the package-bound intent before the delayed HTTPS fallback', (t) => {
	const location = { href: '' };
	const redirects = [];
	const intent = 'intent://bank.gov.ua/qr/cGF5bG9hZA#Intent;scheme=https;package=com.ftband.mono;S.browser_fallback_url=https%3A%2F%2Fmbnk.app%2Fqr%2FcGF5bG9hZA;end';
	Object.defineProperty(location, 'href', {
		get: () => redirects.at(-1) || '',
		set: (value) => redirects.push(value)
	});

	t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
		assert.equal(delay, 3500);
		assert.deepEqual(redirects, [intent]);
		callback();
		return 1;
	});
	installBrowserGlobals(t, {
		window: { location, MSStream: undefined },
		navigator: { userAgent: 'Android' },
		document: { hasFocus: () => true, visibilityState: 'visible' }
	});

	launchDeepLink(intent, 'https://mbnk.app/qr/cGF5bG9hZA');

	assert.deepEqual(redirects, [
		intent,
		'https://mbnk.app/qr/cGF5bG9hZA'
	]);
});

test('iOS universal link is not replaced by the identical fallback', (t) => {
	const location = { href: '' };
	const redirects = [];
	Object.defineProperty(location, 'href', {
		get: () => redirects.at(-1) || '',
		set: (value) => redirects.push(value)
	});

	t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
		assert.equal(delay, 3500);
		callback();
		return 1;
	});
	installBrowserGlobals(t, {
		window: { location, MSStream: undefined },
		navigator: { userAgent: 'iPhone' },
		document: { hasFocus: () => true, visibilityState: 'visible' }
	});

	launchDeepLink('https://mbnk.app/qr/cGF5bG9hZA', 'https://mbnk.app/qr/cGF5bG9hZA');

	assert.deepEqual(redirects, ['https://mbnk.app/qr/cGF5bG9hZA']);
});

test('desktop opens the HTTPS universal link in a new tab', (t) => {
	const opened = [];
	installBrowserGlobals(t, {
		window: {
			location: { href: '' },
			open: (...args) => opened.push(args)
		},
		navigator: { userAgent: 'Desktop Browser' }
	});

	launchDeepLink('https://mbnk.app/qr/cGF5bG9hZA', 'https://mbnk.app/qr/cGF5bG9hZA');

	assert.deepEqual(opened, [['https://mbnk.app/qr/cGF5bG9hZA', '_blank']]);
});
