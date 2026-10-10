import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

class AuthError extends Error {
	code = 'AUTH_INVALID';
}

async function route(file, resolvedRoot, signInWithGoogle = async () => {
	throw new AuthError('Rejected credential');
}) {
	const source = await readFile(new URL(file, import.meta.url), 'utf8');
	const compiled = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
	}).outputText;
	const module = new SourceTextModule(compiled);
	await module.link(async specifier => {
		const exports = specifier === 'node:crypto' ? await import('node:crypto') :
			specifier === '$app/env/private' ? {
				DELIVERY_GOOGLE_CLIENT_ID: 'client', DELIVERY_SUPABASE_URL: 'https://auth.example',
				DELIVERY_SUPABASE_PUBLISHABLE_KEY: 'public'
			} : specifier === '$app/paths' ? { resolve: () => resolvedRoot } :
			specifier === '@sveltejs/kit' ? { redirect: (status, location) => { throw { status, location }; } } :
			specifier.includes('/auth.ts') ? { AuthError, authenticate: async () => ({ id: 'user' }), signInWithGoogle } :
			specifier.includes('/config.ts') ? { authConfig: () => ({}) } : null;
		assert.ok(exports, specifier);
		return new SyntheticModule(Object.keys(exports), function () {
			for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
		});
	});
	await module.evaluate();
	return module.namespace;
}

function event(requestUrl, pageUrl = requestUrl, initial = {}) {
	const values = new Map(Object.entries(initial));
	const writes = [];
	const deletes = [];
	return {
		request: new Request(requestUrl), url: new URL(pageUrl), writes, deletes,
		cookies: {
			get: name => values.get(name),
			set: (name, value, options) => { values.set(name, value); writes.push({ name, value, options }); },
			delete: (name, options) => { values.delete(name); deletes.push({ name, options }); }
		}
	};
}

for (const [file, resolvedRoot, requestPath, pagePath] of [
	['./src/routes/login/+page.server.ts', './', '/delivery/login', '/delivery/login'],
	['./src/routes/login/+page.server.ts', '../', '/delivery/login/__data.json', '/delivery/login'],
	['./src/routes/login/+page.server.ts', '../', '/login/__data.json', '/login']
]) {
	test(`nonce cookie matches form target: ${requestPath}`, async () => {
		const handler = await route(file, resolvedRoot);
		const input = event('http://localhost:5173' + requestPath, 'http://localhost:5173' + pagePath);
		const data = await handler.load(input);
		const cookie = input.writes.find(write => write.name === 'delivery_google_nonce');
		assert.equal(cookie.options.path, requestPath.startsWith('/delivery/') ? '/delivery/' : '/');
		assert.equal(cookie.options.httpOnly, true);
		assert.equal(cookie.options.sameSite, 'strict');
		assert.equal(data.nonce, createHash('sha256').update(cookie.value).digest('hex'));
	});
}

test('repeated login loads preserve the nonce of an already rendered Google button', async () => {
	const handler = await route('./src/routes/login/+page.server.ts', './');
	const input = event('http://localhost:5173/delivery/login');
	const first = await handler.load(input);
	const second = await handler.load(input);
	assert.equal(second.nonce, first.nonce);
	assert.equal(input.writes[1].value, input.writes[0].value);
	const malformed = event(input.request.url, undefined, { delivery_google_nonce: 'invalid' });
	await handler.load(malformed);
	assert.match(malformed.writes[0].value, /^[A-Za-z0-9_-]{43}$/);
});

test('public page preloads preserve the login nonce through Google submission', async () => {
	const login = await route('./src/routes/login/+page.server.ts', './');
	const input = event('http://localhost:5173/delivery/login');
	const loginData = await login.load(input);
	const handler = await route('./src/routes/(public)/+page.server.ts', './', async (credential, rawNonce) => {
		assert.equal(credential, loginData.nonce);
		assert.equal(createHash('sha256').update(rawNonce).digest('hex'), loginData.nonce);
		return { accessToken: 'verified-session', expiresIn: 3600 };
	});
	for (const path of ['/delivery/', '/delivery/__data.json']) {
		input.request = new Request('http://localhost:5173' + path);
		input.url = new URL('http://localhost:5173/delivery/');
		assert.deepEqual(await handler.load(input), { guestHistoryEnabled: true });
	}
	assert.equal(input.writes.length, 1);
	input.request = new Request('http://localhost:5173/delivery/', {
		method: 'POST', body: new URLSearchParams({ credential: loginData.nonce })
	});
	await assert.rejects(handler.actions.default(input), failure => failure.status === 303 && failure.location === '/delivery/business');
	assert.equal(input.writes.at(-1).value, 'verified-session');
});

test('verified login consumes nonce, stores scoped session and opens business', async () => {
	const nonce = 'a'.repeat(43);
	const handler = await route('./src/routes/(public)/+page.server.ts', './', async (credential, rawNonce) => {
		assert.equal(credential, 'verified-google-token');
		assert.equal(rawNonce, nonce);
		return { accessToken: 'verified-session', expiresIn: 3600 };
	});
	const input = event('http://localhost:5173/delivery/', undefined, { delivery_google_nonce: nonce });
	input.request = new Request(input.request.url, { method: 'POST', body: new URLSearchParams({ credential: 'verified-google-token' }) });
	await assert.rejects(handler.actions.default(input), failure => failure.status === 303 && failure.location === '/delivery/business');
	assert.deepEqual(input.deletes, [{ name: 'delivery_google_nonce', options: { path: '/delivery/' } }]);
	assert.equal(input.writes[0].value, 'verified-session');
	assert.equal(input.writes[0].options.path, '/delivery/');
	assert.equal(input.writes[0].options.httpOnly, true);
});

test('missing nonce and rejected Google credentials never create a session', async () => {
	const handler = await route('./src/routes/(public)/+page.server.ts', './');
	for (const cookies of [{}, { delivery_google_nonce: 'a'.repeat(43) }]) {
		const input = event('http://localhost:5173/delivery/', undefined, cookies);
		input.request = new Request(input.request.url, { method: 'POST', body: new URLSearchParams({ credential: 'invalid' }) });
		const reason = cookies.delivery_google_nonce ? 'AUTH_INVALID' : 'nonce_missing';
		await assert.rejects(handler.actions.default(input), failure => failure.status === 303 && failure.location === `/delivery/login?auth=failed&reason=${reason}`);
		assert.equal(input.writes.length, 0);
	}
});