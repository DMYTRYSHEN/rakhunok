import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('auth service-worker exclusions', () => {
	it.each(['/app/?code=synthetic', '/app/?error=access_denied', '/app/api/v1/orders', '/app/auth/callback', '/api/auth/telegram'])('never intercepts %s', (path) => {
		const handlers = new Map<string, (event: unknown) => void>();
		runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), {
			URL,
			self: { location: { origin: 'https://letsrealtalk.com' }, addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler) }
		});
		const respondWith = vi.fn();
		handlers.get('fetch')!({ request: { method: 'GET', url: `https://letsrealtalk.com${path}` }, respondWith });
		expect(respondWith).not.toHaveBeenCalled();
	});
});