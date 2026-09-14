import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { TelegramInvoiceError, TelegramInvoicePreviewError } from './telegram-invoice-client';

// Execute the actual narrowly scoped handlers, without mounting Dashboard/auth or using network.
const source = readFileSync(new URL('../DashboardPage.svelte', import.meta.url), 'utf8');
const script = source.split('<script lang="ts">')[1].split('</script>')[0];
const parsed = ts.createSourceFile('dashboard.ts', script, ts.ScriptTarget.Latest, true);
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
};

function harness(name: string) {
	const declaration = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
	if (!declaration) throw new Error(`Missing handler ${name}`);
	const code = ts.transpileModule(declaration.getText(parsed), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	}).outputText.replace(/import\(['"]\.\/public-page\/telegram-invoice-client['"]\)/g, 'loadClient()');
	const imported = deferred<void>();
	const token = deferred<{ accessToken: string }>();
	const response = deferred<void>();
	const previewTelegramInvoice = vi.fn().mockImplementation(() => response.promise);
	const sendTelegramInvoice = vi.fn().mockImplementation(() => response.promise);
	const gateway = { getDeveloperSession: vi.fn(() => token.promise) };
	const loadClient = () => imported.promise.then(() => ({
		previewTelegramInvoice, sendTelegramInvoice, TelegramInvoiceError, TelegramInvoicePreviewError
	}));
	const state = {
		sessionState: { status: 'ready', user: { id: 'actor-a' }, merchant: { id: 'merchant-a' } },
		gateway, destroyed: false
	};
	const factory = new Function('state', 'loadClient', `
		let { sessionState, gateway, destroyed } = state;
		const fetch = () => { throw new Error('Network forbidden'); };
		${code}
		return { run: ${name}, change(next) {
			if ('sessionState' in next) sessionState = next.sessionState;
			if ('gateway' in next) gateway = next.gateway;
			if ('destroyed' in next) destroyed = next.destroyed;
		} };
	`);
	return { ...factory(state, loadClient), imported, token, response, gateway, state,
		request: name.startsWith('preview') ? previewTelegramInvoice : sendTelegramInvoice };
}

describe.each(['previewTelegramInvoiceCard', 'sendTelegramInvoiceCard'])('%s request scope', (name) => {
	it.each(['session', 'gateway', 'teardown'])('rejects %s change while lazy import is pending', async (kind) => {
		const h = harness(name);
		const result = h.run('11111111-1111-4111-8111-111111111111');
		const rejected = expect(result).rejects.toMatchObject({ deliveryUncertain: false });
		h.change(kind === 'session' ? { sessionState: { ...h.state.sessionState, user: { id: 'actor-b' } } }
			: kind === 'gateway' ? { gateway: { getDeveloperSession: vi.fn() } } : { destroyed: true });
		h.imported.resolve();
		await rejected;
		expect(h.gateway.getDeveloperSession).not.toHaveBeenCalled();
		expect(h.request).not.toHaveBeenCalled();
	});
	it.each(['session', 'gateway', 'teardown'])('rejects %s change while SDK token is pending', async (kind) => {
		const h = harness(name);
		h.imported.resolve();
		const result = h.run('11111111-1111-4111-8111-111111111111');
		const rejected = expect(result).rejects.toMatchObject({ deliveryUncertain: false });
		await vi.waitFor(() => expect(h.gateway.getDeveloperSession).toHaveBeenCalledOnce());
		h.change(kind === 'session' ? { sessionState: { ...h.state.sessionState } }
			: kind === 'gateway' ? { gateway: {} } : { destroyed: true });
		h.token.resolve({ accessToken: 'synthetic-token' });
		await rejected;
		expect(h.request).not.toHaveBeenCalled();
	});
	it('rejects stale preview but preserves an already dispatched send outcome', async () => {
		const h = harness(name);
		h.imported.resolve();
		h.token.resolve({ accessToken: 'synthetic-token' });
		const result = h.run('11111111-1111-4111-8111-111111111111');
		const checked = name.startsWith('preview')
			? expect(result).rejects.toMatchObject({ deliveryUncertain: false })
			: expect(result).resolves.toBeUndefined();
		await vi.waitFor(() => expect(h.request).toHaveBeenCalledOnce());
		h.change({ destroyed: true });
		h.response.resolve();
		await checked;
	});
});