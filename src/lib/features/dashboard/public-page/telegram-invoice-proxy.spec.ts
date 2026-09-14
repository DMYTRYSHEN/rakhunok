import { describe, expect, it, vi } from 'vitest';
import config, { isConnectionRefused } from '../../../../../vite.config';

const refused = () => Object.assign(new Error('connect'), { code: 'ECONNREFUSED' });
const reset = () => Object.assign(new Error('socket'), { code: 'ECONNRESET' });

describe('dashboard dev proxy failure boundary', () => {
	it.each([
		refused(),
		new AggregateError([refused(), refused()]),
		new AggregateError([new AggregateError([refused()]), refused()])
	])('recognizes only definite refusals: %s', (error) => {
		expect(isConnectionRefused(error)).toBe(true);
	});
	it.each([
		reset(), { code: 'ETIMEDOUT' }, { code: 'ENOTFOUND' }, new Error('ECONNREFUSED'),
		new AggregateError([]), new AggregateError([refused(), reset()]),
		Object.assign(new AggregateError([refused(), reset()]), { code: 'ECONNREFUSED' }),
		{ code: 'ECONNREFUSED', errors: [] }, { code: 'ECONNREFUSED', errors: null }, null
	])('keeps other transport failures unknown: %s', (error) => {
		expect(isConnectionRefused(error)).toBe(false);
	});
	it.each([
		[refused(), 'local_api_unavailable'],
		[new AggregateError([refused(), refused()]), 'local_api_unavailable'],
		[reset(), 'delivery_unknown'],
		[new AggregateError([refused(), reset()]), 'delivery_unknown']
	])('writes a non-cacheable response for %s', async (error, code) => {
		const resolved = await (config as (env: { mode: string; command: string }) => unknown)({ mode: 'test', command: 'serve' }) as {
			server: { proxy: Record<string, { configure?: (proxy: unknown) => void }> }
		};
		const on = vi.fn();
		resolved.server.proxy['/dashboard/api'].configure!({ on });
		const handler = on.mock.calls[0][1];
		const res = { headersSent: false, writableEnded: false, writeHead: vi.fn(), end: vi.fn() };
		handler(error, {}, res);
		expect(res.writeHead).toHaveBeenCalledWith(503, {
			'Content-Type': 'application/json', 'Cache-Control': 'no-store'
		});
		expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ ok: false, error: code });
		res.headersSent = true;
		handler(error, {}, res);
		expect(res.end).toHaveBeenCalledTimes(1);
	});
});