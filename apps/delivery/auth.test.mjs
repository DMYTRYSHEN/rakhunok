import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate, authenticatedProfile, AuthError, signIn, signInWithGoogle, signOut, tokenFromRequest } from './src/lib/server/tracking/auth.ts';

const config = { SUPABASE_URL: 'https://delivery-project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_key' };
const user = { id: '12345678-1234-4234-8234-123456789abc', is_anonymous: false };
const request = (headers = { Authorization: 'Bearer opaque-token' }) => new Request('https://delivery.example/api', { headers });
const unexpected = async () => { assert.fail('Unexpected provider request'); };
const safeError = (status, code) => error => {
	assert.ok(error instanceof AuthError);
	assert.equal(error.status, status);
	assert.equal(error.code, code);
	assert.equal(error.cause, undefined);
	assert.doesNotMatch(error.message, /opaque-token|password-secret|provider-secret/);
	return true;
};

test('missing or unsafe configuration fails closed without requests for all helpers', async () => {
	for (const invalid of [ {}, { ...config, SUPABASE_URL: undefined }, { ...config, SUPABASE_PUBLISHABLE_KEY: undefined },
		...['http://project.supabase.co', 'https://user:pass@project.supabase.co', 'https://@project.supabase.co',
			'https://project.supabase.co/auth/v1', 'https://project.supabase.co/?', 'https://project.supabase.co/#',
			'https://project.supabase.co/../', 'https://project.supabase.co\\evil', ' https://project.supabase.co'].map(SUPABASE_URL => ({ ...config, SUPABASE_URL })),
		...['sb_secret_secret', 'legacy-jwt', 'sb_publishable_key\nsecret', ''].map(SUPABASE_PUBLISHABLE_KEY => ({ ...config, SUPABASE_PUBLISHABLE_KEY })) ]) {
		await assert.rejects(authenticate(request(), invalid, unexpected), safeError(503, 'AUTH_CONFIG'));
		await assert.rejects(signIn('a@example.com', 'password-secret', invalid, unexpected), safeError(503, 'AUTH_CONFIG'));
		await assert.rejects(signOut('opaque-token', invalid, unexpected), safeError(503, 'AUTH_CONFIG'));
	}
});

test('token extraction has strict bearer precedence and bounded cookie handling', () => {
	assert.equal(tokenFromRequest(request({})), null);
	assert.equal(tokenFromRequest(request({ Cookie: 'other=value' })), null);
	assert.equal(tokenFromRequest(request({ Cookie: 'other=value; delivery_session=opaque%2Dtoken' })), 'opaque-token');
	assert.equal(tokenFromRequest(request({ Authorization: 'bearer first', Cookie: 'delivery_session=second' })), 'first');
	for (const headers of [ { Authorization: 'Basic first', Cookie: 'delivery_session=second' },
		{ Authorization: 'Bearer first second' }, { Authorization: 'Bearer first,second' },
		{ Authorization: `Bearer ${'a'.repeat(8193)}` }, { Cookie: 'delivery_session=' },
		{ Cookie: 'delivery_session' }, { Cookie: 'delivery_session=%ZZ' }, { Cookie: 'delivery_session=%0Asecret' },
		{ Cookie: 'delivery_session=first; delivery_session=second' }, { Cookie: 'other=' + 'a'.repeat(16384) } ]) {
		assert.throws(() => tokenFromRequest(request(headers)), safeError(401, 'AUTH_INVALID'));
	}
});

test('missing authentication does not call the provider', async () => {
	await assert.rejects(authenticate(request({}), config, unexpected), safeError(401, 'AUTH_REQUIRED'));
});

test('official user request returns personal id only, ignores all metadata and never caches', async () => {
	let calls = 0;
	const transport = async (url, options) => {
		calls++;
		assert.equal(url, config.SUPABASE_URL + '/auth/v1/user');
		assert.equal(options.method, 'GET');
		assert.equal(options.headers.apikey, config.SUPABASE_PUBLISHABLE_KEY);
		assert.equal(options.headers.Authorization, 'Bearer opaque-token');
		assert.equal(options.redirect, 'manual');
		assert.equal(options.credentials, 'omit');
		assert.equal(options.cache, 'no-store');
		assert.ok(options.signal instanceof AbortSignal);
		assert.equal(options.signal.aborted, false);
		assert.equal(options.body, undefined);
		return Response.json({ ...user, user_metadata: { workspace_id: 'victim', role: 'admin', id: 'victim' }, app_metadata: { workspace_id: 'victim' } });
	};
	assert.deepEqual(await authenticate(request(), config, transport), { id: user.id });
	assert.deepEqual(await authenticate(request({ Cookie: 'delivery_session=opaque-token' }), config, transport), { id: user.id });
	assert.equal(calls, 2);
});

test('verified profile exposes only a bounded display name without trusting metadata identity', async () => {
	for (const [metadata, expected] of [
		[{ full_name: '  Jane Doe  ', id: 'victim', role: 'admin' }, 'Jane Doe'],
		[{ full_name: '', name: 'Jane' }, 'Jane'],
		[{ full_name: 'a'.repeat(201), name: 'Jane' }, 'Jane'],
		[{ full_name: 'Jane\nDoe' }, '\u041a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447'],
		[null, '\u041a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447']
	]) {
		let calls = 0;
		const profile = await authenticatedProfile(request(), config, async () => {
			calls++;
			return Response.json({ ...user, user_metadata: metadata });
		});
		assert.deepEqual(profile, { id: user.id, displayName: expected });
		assert.equal(calls, 1);
	}
	await assert.rejects(authenticatedProfile(request(), config, async () =>
		Response.json({ ...user, is_anonymous: true, user_metadata: { full_name: 'Jane' } })), safeError(401, 'AUTH_INVALID'));
});

test('only the configured project is contacted, never the request origin or a fallback', async () => {
	const configured = { ...config, SUPABASE_URL: 'https://another-project.supabase.co/' };
	await assert.rejects(authenticate(request(), configured, async url => {
		assert.equal(url, 'https://another-project.supabase.co/auth/v1/user');
		return Response.json({ msg: 'provider-secret: wrong project' }, { status: 401 });
	}), safeError(401, 'AUTH_INVALID'));
});

test('provider invalid, expired, revoked, or rejected credentials are safe 401 errors', async () => {
	for (const status of [400, 401, 403, 422]) {
		const transport = async () => Response.json({ error_code: 'session_not_found', msg: 'provider-secret opaque-token' }, { status });
		await assert.rejects(authenticate(request(), config, transport), safeError(401, 'AUTH_INVALID'));
		await assert.rejects(signIn('a@example.com', 'password-secret', config, transport), safeError(401, 'AUTH_INVALID'));
		await assert.rejects(signOut('opaque-token', config, transport), safeError(401, 'AUTH_INVALID'));
	}
});

test('anonymous accounts are refused and malformed identities cannot authorize', async () => {
	await assert.rejects(authenticate(request(), config, async () => Response.json({ ...user, is_anonymous: true })), safeError(401, 'AUTH_INVALID'));
	for (const value of [null, [], {}, { id: 'victim' }, { ...user, is_anonymous: 'false' }, { user }, { user_metadata: user }]) {
		await assert.rejects(authenticate(request(), config, async () => Response.json(value)), safeError(503, 'AUTH_UNAVAILABLE'));
	}
});

test('forged JWT claims cannot authorize without successful provider verification', async () => {
	const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
	const forged = `${encode({ alg: 'none' })}.${encode({ sub: user.id, exp: 9999999999, role: 'admin', user_metadata: { workspace_id: 'victim' } })}.forged`;
	let calls = 0;
	await assert.rejects(authenticate(request({ Authorization: `Bearer ${forged}` }), config, async (_url, options) => {
		calls++;
		assert.equal(options.headers.Authorization, `Bearer ${forged}`);
		return Response.json({ error_code: 'bad_jwt' }, { status: 401 });
	}), safeError(401, 'AUTH_INVALID'));
	assert.equal(calls, 1);
});

test('password login uses official endpoint and returns only validated access token and lifetime', async () => {
	const result = await signIn('a@example.com', 'password-secret', config, async (url, options) => {
		assert.equal(url, config.SUPABASE_URL + '/auth/v1/token?grant_type=password');
		assert.equal(options.method, 'POST');
		assert.equal(options.headers.apikey, config.SUPABASE_PUBLISHABLE_KEY);
		assert.equal(options.headers.Authorization, undefined);
		assert.equal(options.headers['Content-Type'], 'application/json');
		assert.deepEqual(JSON.parse(options.body), { email: 'a@example.com', password: 'password-secret' });
		assert.equal(options.redirect, 'manual');
		return Response.json({ access_token: 'opaque-token', expires_in: 3600, token_type: 'bearer', user, refresh_token: 'do-not-return' });
	});
	assert.deepEqual(result, { accessToken: 'opaque-token', expiresIn: 3600 });
});

test('login rejects malformed credentials, tokens, lifetime, type and anonymous identities', async () => {
	for (const [email, password] of [['invalid', 'password'], ['a@example.com', ''], ['a@example.com', 'a'.repeat(4097)]]) {
		await assert.rejects(signIn(email, password, config, unexpected), safeError(401, 'AUTH_INVALID'));
	}
	const session = { access_token: 'opaque-token', expires_in: 3600, token_type: 'bearer', user };
	for (const patch of [{ access_token: '' }, { access_token: 'a'.repeat(8193) }, { access_token: 'secret\n' },
		{ expires_in: '3600' }, { expires_in: 0 }, { expires_in: -1 }, { expires_in: 1.5 }, { expires_in: 604801 },
		{ token_type: 'other' }, { user: null }]) {
		await assert.rejects(signIn('a@example.com', 'password-secret', config, async () => Response.json({ ...session, ...patch })), safeError(503, 'AUTH_UNAVAILABLE'));
	}
	await assert.rejects(signIn('a@example.com', 'password-secret', config, async () => Response.json({ ...session, user: { ...user, is_anonymous: true } })), safeError(401, 'AUTH_INVALID'));
});

test('Google login exchanges the credential and raw nonce through the configured project', async () => {
	const nonce = 'a'.repeat(43);
	assert.deepEqual(await signInWithGoogle('google-credential', nonce, config, async (url, options) => {
		assert.equal(url, config.SUPABASE_URL + '/auth/v1/token?grant_type=id_token');
		assert.deepEqual(JSON.parse(options.body), { provider: 'google', id_token: 'google-credential', nonce });
		assert.equal(options.method, 'POST');
		assert.equal(options.redirect, 'manual');
		return Response.json({ access_token: 'opaque-token', expires_in: 3600, token_type: 'bearer', user });
	}), { accessToken: 'opaque-token', expiresIn: 3600 });
	for (const invalid of ['', 'short', 'a'.repeat(44)]) {
		await assert.rejects(signInWithGoogle('google-credential', invalid, config, unexpected), safeError(401, 'AUTH_INVALID'));
	}
	await assert.rejects(signInWithGoogle('', nonce, config, unexpected), safeError(401, 'AUTH_INVALID'));
	await assert.rejects(signInWithGoogle('google-credential', nonce, {}, unexpected), safeError(503, 'AUTH_CONFIG'));
	await assert.rejects(signInWithGoogle('google-credential', nonce, config, async () => Response.json({}, { status: 401 })), safeError(401, 'AUTH_INVALID'));
	await assert.rejects(signInWithGoogle('google-credential', nonce, config, async () => Response.json({ access_token: 'opaque-token', expires_in: 3600, token_type: 'bearer', user: { ...user, is_anonymous: true } })), safeError(401, 'AUTH_INVALID'));
});

test('Google failures expose only safe stage categories without provider secrets', async () => {
	const session = { access_token: 'opaque-token', expires_in: 3600, token_type: 'bearer', user };
	for (const [detail, transport] of [
		['transport', async () => { throw new Error('provider-secret'); }],
		['response_status', async () => Response.json({}, { status: 503 })],
		['response_json', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
		['session', async () => Response.json({ ...session, token_type: 'other' })],
		['identity', async () => Response.json({ ...session, user: {} })]
	]) {
		await assert.rejects(signInWithGoogle('google-credential', 'a'.repeat(43), config, transport), error => {
			assert.equal(error.detail, detail);
			return safeError(503, 'AUTH_UNAVAILABLE')(error);
		});
	}
});

test('logout revokes the current session only and creates no cookies', async () => {
	assert.equal(await signOut('opaque-token', config, async (url, options) => {
		assert.equal(url, config.SUPABASE_URL + '/auth/v1/logout?scope=local');
		assert.equal(options.method, 'POST');
		assert.equal(options.headers.Authorization, 'Bearer opaque-token');
		assert.equal(options.headers.apikey, config.SUPABASE_PUBLISHABLE_KEY);
		assert.equal(options.redirect, 'manual');
		assert.equal(options.body, undefined);
		return new Response(null, { status: 204 });
	}), undefined);
	await assert.rejects(signOut('', config, unexpected), safeError(401, 'AUTH_INVALID'));
});

test('malformed, non-JSON, redirected, oversized and failing provider responses fail closed', async () => {
	for (const transport of [async () => { throw new Error('provider-secret opaque-token'); },
		... [302, 429, 500, 503].map(status => async () => new Response('provider-secret', { status })),
		async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }),
		async () => new Response('{}'),
		async () => Response.json(user, { headers: { 'Content-Length': '65537' } }),
		async () => Response.json(user, { headers: { 'Content-Length': 'invalid' } }),
		async () => Response.json({ ...user, padding: 'a'.repeat(65536) }),
		async () => { const response = Response.json(user); Object.defineProperty(response, 'redirected', { value: true }); return response; },
		async () => { const response = Response.json(user); Object.defineProperty(response, 'url', { value: 'https://other.example/auth/v1/user' }); return response; }
	]) await assert.rejects(authenticate(request(), config, transport), safeError(503, 'AUTH_UNAVAILABLE'));
});

test('deadline covers hanging fetch and body reads, aborts transport, and cancels streams', async context => {
	context.mock.timers.enable({ apis: ['setTimeout'] });
	let signal;
	const hanging = authenticate(request(), config, async (_url, options) => {
		signal = options.signal;
		return new Promise(() => {});
	});
	const rejected = assert.rejects(hanging, safeError(503, 'AUTH_UNAVAILABLE'));
	context.mock.timers.tick(5000);
	await rejected;
	assert.equal(signal.aborted, true);
	let cancelled = false;
	const stream = new ReadableStream({ cancel() { cancelled = true; } });
	const reading = authenticate(request(), config, async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } }));
	const bodyRejected = assert.rejects(reading, safeError(503, 'AUTH_UNAVAILABLE'));
	await Promise.resolve();
	await Promise.resolve();
	context.mock.timers.tick(5000);
	await bodyRejected;
	assert.equal(cancelled, true);
});