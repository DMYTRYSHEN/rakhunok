import { describe, expect, it } from 'vitest';
import { createSessionFence } from './session-fence';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

describe('App session generation fence', () => {
	it('invalidates all old captures, including A → B → A and disposal', () => {
		const fence = createSessionFence();
		const firstA = fence.capture();
		expect(fence.isCurrent(firstA)).toBe(true);
		const b = fence.advance();
		const secondA = fence.advance();
		expect(fence.isCurrent(firstA)).toBe(false);
		expect(fence.isCurrent(b)).toBe(false);
		expect(fence.isCurrent(secondA)).toBe(true);
		fence.advance();
		expect(fence.isCurrent(secondA)).toBe(false);
	});

	it('allows only the latest overlapping restore to publish', async () => {
		const fence = createSessionFence();
		const a = deferred<string>();
		const b = deferred<string>();
		let state = 'loading';
		async function restore(pending: Promise<string>) {
			const request = fence.advance();
			const value = await pending;
			if (fence.isCurrent(request)) state = value;
		}
		const old = restore(a.promise);
		const latest = restore(b.promise);
		b.resolve('B');
		await latest;
		a.resolve('A');
		await old;
		expect(state).toBe('B');
	});

	it.each(['success', 'error'] as const)('blocks stale data, %s and finally writes after logout', async (outcome) => {
		const fence = createSessionFence();
		const pending = deferred<string>();
		const generation = fence.capture();
		let data = 'B';
		let error = '';
		let busy = true;
		const task = (async () => {
			try {
				const value = await pending.promise;
				if (fence.isCurrent(generation)) data = value;
			} catch {
				if (fence.isCurrent(generation)) error = 'A failed';
			} finally {
				if (fence.isCurrent(generation)) busy = false;
			}
		})();
		fence.advance();
		if (outcome === 'success') pending.resolve('A');
		else pending.reject(new Error('A failed'));
		await task;
		expect({ data, error, busy }).toEqual({ data: 'B', error: '', busy: true });
	});

	it('combines session and request fences for same-account read ordering', () => {
		const session = createSessionFence();
		const reads = createSessionFence();
		const generation = session.capture();
		const old = reads.advance();
		const latest = reads.advance();
		const current = (request: number) => session.isCurrent(generation) && reads.isCurrent(request);
		expect(current(old)).toBe(false);
		expect(current(latest)).toBe(true);
		session.advance();
		expect(current(latest)).toBe(false);
	});

	it('does not cancel, retry or relabel an already-dispatched successful order', async () => {
		const fence = createSessionFence();
		const sent = deferred<string>();
		const generation = fence.capture();
		let selectedOrder: string | null = null;
		let dispatches = 0;
		const task = (async () => {
			dispatches++;
			const order = await sent.promise;
			if (fence.isCurrent(generation)) selectedOrder = order;
			return true;
		})();
		fence.advance();
		sent.resolve('accepted-A');
		expect(await task).toBe(true);
		expect(dispatches).toBe(1);
		expect(selectedOrder).toBeNull();
	});
});