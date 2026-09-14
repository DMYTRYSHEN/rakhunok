import { readFileSync } from 'node:fs';
import type { User } from '@supabase/supabase-js';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import AccountIdentityGuidance from './AccountIdentityGuidance.svelte';
import LoginOptions from './LoginOptions.svelte';

function user(providers: string[], extra: Partial<User> = {}): User {
	return { id: 'test-user', identities: providers.map((provider) => ({ provider })), ...extra } as User;
}

function html(context: 'guest' | 'profile' | 'onboarding', account?: User) {
	return render(AccountIdentityGuidance, { props: { context, user: account } }).body;
}

describe('account identity guidance (SSR, no auth operations)', () => {
	it('keeps the guest warning outside the closed native dialog', () => {
		const output = html('guest');
		expect(output.split('<dialog')[0]).toContain('Окремі входи можуть створити окремі акаунти.');
		expect(output.match(/<dialog\b/g)).toHaveLength(1);
		expect(output).not.toMatch(/<dialog[^>]*\sopen(?:\s|=|>)/);
		expect(output).not.toContain('<details');
		expect(output).toContain('aria-haspopup="dialog"');
		expect(output).toContain('aria-label="Google і Telegram: один профіль"');
	});

	it.each([true, false])('shows guest warning before sign-in with Telegram enabled=%s', (enabled) => {
		// The snippet is unused in SSR; a no-op supplies the required children prop.
		const output = render(LoginOptions, { props: { enabled, children: (() => {}) as never } }).body;
		expect(output.indexOf('Окремі входи')).toBeLessThan(output.indexOf('<button'));
		expect(output).not.toContain('Маєте бізнес? Спочатку увійдіть через Google');
	});

	it.each(['guest', 'profile', 'onboarding'] as const)('renders the initial three-step wizard with four choices in %s', (context) => {
		const output = html(context);
		expect(output).toContain('aria-valuenow="1"');
		expect(output).toContain('aria-valuemax="3"');
		expect(output.match(/type="radio"/g)).toHaveLength(4);
		for (const value of ['new', 'google', 'telegram', 'separate']) expect(output).toContain(`value="${value}"`);
		expect(output).toContain('Я тут уперше');
		expect(output).toContain('не запускає вхід і не змінює акаунти');
		expect(output).toMatch(/<button[^>]*disabled[^>]*>Далі/);
		expect(output).not.toMatch(/<(?:a|form)\b/);
		expect(output).not.toContain('wizard-instructions');
	});

	it('reports Telegram-only accurately, even with email or Google metadata', () => {
		const output = html('profile', user(['custom:telegram'], {
			email: 'synthetic@example.test', app_metadata: { provider: 'google', providers: ['google'] }
		})).split('<dialog')[0];
		expect(output).toContain('є Telegram; Google не підтверджено');
		expect(output).toContain('Додавання Google до Telegram-профілю ще недоступне');
		expect(output).not.toContain('підтверджено Google і Telegram');
	});

	it('reports Google-only without claiming Telegram is linked', () => {
		const output = html('profile', user(['google'])).split('<dialog')[0];
		expect(output).toContain('є Google; Telegram ще не прив’язано');
	});

	it.each(['profile', 'onboarding'] as const)('keeps %s compact without repeating the guest warning', (context) => {
		const output = html(context, user(['google'])).split('<dialog')[0];
		expect(output).not.toContain('Окремі входи можуть створити окремі акаунти');
		expect(output).toContain('є Google; Telegram ще не прив’язано');
		expect(output).toContain('Як зберегти один профіль');
	});

	it('connects the entry control and accessible title to the rendered dialog', () => {
		const first = html('guest');
		const second = html('guest');
		for (const output of [first, second]) {
			const target = output.match(/aria-controls="([^"]+)"/)?.[1];
			expect(target).toBeTruthy();
			expect(output).toContain(`id="${target}"`);
			expect(output).toMatch(/aria-labelledby="[^"]+-title"/);
		}
	});

	it('confirms both only from the actual identities, including custom Telegram namespace', () => {
		const output = html('profile', user(['google', 'custom:telegram']));
		expect(output).toContain('підтверджено Google і Telegram');
		expect(output).toContain('у той самий профіль');
		expect(output).toContain('Два входи. Один профіль.');
		expect(output).not.toContain('type="radio"');
		expect(output).not.toContain('role="progressbar"');
	});

	it.each([undefined, user([]), user(['email']), user(['telegram'])])('does not infer providers from absent or unrelated identities', (account) => {
		expect(html('profile', account).split('<dialog')[0]).toContain('Google і Telegram у цьому профілі не підтверджено');
	});

	it('warns existing-business users before the onboarding dialog', () => {
		const output = html('onboarding', user(['custom:telegram'])).split('<dialog')[0];
		expect(output).toContain('Бізнес уже існує?');
		expect(output).toContain('початковим способом у той самий акаунт');
		expect(output).toContain('не означає, що потрібно створювати його знову');
	});

	it('integrates profile guidance independently of Telegram availability and checks before creation', () => {
		const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
		expect(app).toMatch(/<AccountIdentityGuidance context="profile" user=\{authState.user\} \/>\s*\{#if telegramEnabled\}/);
		expect(app.indexOf('context="onboarding"')).toBeLessThan(app.indexOf('Лише якщо ви ще не створювали бізнес'));
		expect(app).not.toContain('Telegram прив’язано до цього акаунта</p>');
	});
});