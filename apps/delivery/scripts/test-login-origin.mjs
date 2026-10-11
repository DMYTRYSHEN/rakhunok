import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { is_csrf_forbidden } from '../node_modules/@sveltejs/kit/src/runtime/server/csrf.js';

const origin = 'http://localhost:5173';
const browser = await chromium.launch();
try {
 const context = await browser.newContext();
 await context.route('**/*', async route => {
  const request = route.request();
  if (new URL(request.url()).origin !== origin) return route.abort();
  if (request.isNavigationRequest() && request.method() === 'GET' && new URL(request.url()).pathname === '/login') {
   const response = await route.fetch();
   return route.fulfill({ response, headers: { ...response.headers(), 'referrer-policy': 'no-referrer' } });
  }
  return route.continue();
 });
 const page = await context.newPage();
 await page.goto(`${origin}/login`);
 assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'same-origin');
 await context.clearCookies();
 const submitted = page.waitForResponse(response => response.request().method() === 'POST');
 await page.locator('form').evaluate(form => HTMLFormElement.prototype.submit.call(form));
 const response = await submitted;
 assert.equal(response.status(), 303, 'same-origin login must reach the action, not the CSRF rejection');
 assert.equal(await response.request().headerValue('origin'), origin);
 assert.match(response.headers().location, /login\?auth=failed&reason=nonce_missing$/);
 for (const requestOrigin of [origin, 'null', 'https://untrusted.example', null]) {
  assert.equal(is_csrf_forbidden({
   request: new Request(`${origin}/`, { method: 'POST', body: new URLSearchParams({ credential: 'local-test-only' }) }),
   request_origin: requestOrigin, self_origin: origin, trusted_origins: []
  }), requestOrigin !== origin);
 }
 console.log('PASS: native login POST retains same-origin under no-referrer; SvelteKit production predicate rejects null/missing/foreign origins; no external auth requests');
} finally {
 await browser.close();
}