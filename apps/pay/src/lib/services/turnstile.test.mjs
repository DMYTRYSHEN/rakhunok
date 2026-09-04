import assert from 'node:assert/strict';
import test from 'node:test';
import { executeTurnstile, getCachedTurnstileToken } from './turnstile.ts';

test('executeTurnstile falls back gracefully in server/node environment without blocking', async () => {
  const token = await executeTurnstile('pay');
  assert.equal(typeof token, 'string');
  assert.equal(getCachedTurnstileToken(), '');
});
