import { describe, expect, it } from 'vitest';
import { telegramInAppEnvironment } from './telegram-environment';

describe('Telegram external-only environment policy', () => {
	it.each([
		{ TelegramWebviewProxy: {} },
		{ TelegramWebviewProxyProto: {} },
		{ Telegram: { WebApp: { initData: 'synthetic' } } },
		{ Telegram: { WebApp: { platform: 'ios' } } },
		{ navigator: { userAgent: 'Mozilla/5.0 Telegram-iOS' } },
		{ location: { hash: '#tgWebAppPlatform=ios' } },
		{ location: { search: '?tgWebAppVersion=9.0' } }
	])('blocks Telegram hosts without capability/private-field inspection: %j', (host) => {
		expect(telegramInAppEnvironment(host)).toBe(true);
	});
	it.each([
		{ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } },
		{ Telegram: { WebApp: { platform: 'unknown', initData: '' } } },
		{}
	])('allows external Safari/browser without Telegram host signals: %j', (host) => {
		expect(telegramInAppEnvironment(host)).toBe(false);
	});
});