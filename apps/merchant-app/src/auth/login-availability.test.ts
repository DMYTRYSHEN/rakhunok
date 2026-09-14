import { describe, expect, it } from 'vitest';
import { googleEnvironmentMessage, telegramLocalMessage } from './login-availability';

describe('login availability', () => {
	it('allows existing Google nonce flow in a secure capable browser', () => {
		expect(googleEnvironmentMessage(true, true)).toBe('');
	});
	it.each([[false, false], [false, true], [true, false]])('explains unavailable secure crypto (%s, %s)', (secure, subtle) => {
		expect(googleEnvironmentMessage(secure, subtle)).toContain('HTTPS');
		expect(googleEnvironmentMessage(secure, subtle)).toContain('localhost');
	});
	it('does not promise a Telegram session or send', () => {
		expect(telegramLocalMessage).toContain('ще не активовано');
		expect(telegramLocalMessage).toContain('нічого не надсилає');
	});
});