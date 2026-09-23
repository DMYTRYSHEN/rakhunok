import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

test('HTTP worker: GET /health', async () => {
  const req = new Request('http://localhost:8789/health');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(body, { status: 'ok' });
});

test('HTTP worker: HEAD /health', async () => {
  const req = new Request('http://localhost:8789/health', { method: 'HEAD' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, '');
});

test('HTTP worker: POST /health returns 405 Method Not Allowed', async () => {
  const req = new Request('http://localhost:8789/health', { method: 'POST' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
});

test('HTTP worker: GET /v1/create-qr-code/ with valid SVG request', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?data=https%3A%2F%2Fexample.com&format=svg&size=240x240');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const svg = await res.text();
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('width="240"'));
});

test('HTTP worker: HEAD /v1/create-qr-code/ with SVG request', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?data=https%3A%2F%2Fexample.com&format=svg&size=240x240', { method: 'HEAD' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  const body = await res.text();
  assert.equal(body, '');
});

test('HTTP worker: GET /v1/create-qr-code/ with default PNG request', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?data=https%3A%2F%2Fexample.com&size=240x240');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const buffer = await res.arrayBuffer();
  assert.ok(buffer.byteLength > 100);
});

test('HTTP worker: HEAD /v1/create-qr-code/ with PNG request returns headers without body', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?data=https%3A%2F%2Fexample.com&size=240x240', { method: 'HEAD' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.ok(parseInt(res.headers.get('content-length') || '0', 10) > 100);
  const text = await res.text();
  assert.equal(text, '');
});

test('HTTP worker: POST /v1/create-qr-code/ returns 405 Method Not Allowed', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?data=test', { method: 'POST' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
});

test('HTTP worker: invalid parameters return 400', async () => {
  const req = new Request('http://localhost:8789/v1/create-qr-code/?size=100x200');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('HTTP worker: unknown route returns 404', async () => {
  const req = new Request('http://localhost:8789/unknown-path');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 404);
});
