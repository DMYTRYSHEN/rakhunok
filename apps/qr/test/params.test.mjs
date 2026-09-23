import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueryParams } from '../src/params.ts';

test('parseQueryParams: valid default parameters', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=https%3A%2F%2Fexample.com');
  const res = parseQueryParams(url);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.params.data, 'https://example.com');
    assert.equal(res.params.size, 240);
    assert.equal(res.params.format, 'png');
    assert.equal(res.params.style, 'a2');
    assert.equal(res.params.ecc, 'M');
  }
});

test('parseQueryParams: custom size, format, style, ecc', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=hello&size=512x512&format=svg&style=a2&ecc=Q');
  const res = parseQueryParams(url);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.params.data, 'hello');
    assert.equal(res.params.size, 512);
    assert.equal(res.params.format, 'svg');
    assert.equal(res.params.style, 'a2');
    assert.equal(res.params.ecc, 'Q');
  }
});

test('parseQueryParams: handles single number size (e.g. 300)', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=hello&size=300');
  const res = parseQueryParams(url);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.params.size, 300);
  }
});

test('parseQueryParams: fails on missing data', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
  }
});

test('parseQueryParams: fails on empty data', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
  }
});

test('parseQueryParams: fails on non-square size', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=test&size=200x300');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
    assert.match(res.error, /square/i);
  }
});

test('parseQueryParams: fails on size out of bounds', () => {
  const tooSmall = new URL('http://localhost:8789/v1/create-qr-code/?data=test&size=64x64');
  const resSmall = parseQueryParams(tooSmall);
  assert.equal(resSmall.ok, false);
  if (!resSmall.ok) {
    assert.equal(resSmall.status, 400);
  }

  const tooBig = new URL('http://localhost:8789/v1/create-qr-code/?data=test&size=4096x4096');
  const resBig = parseQueryParams(tooBig);
  assert.equal(resBig.ok, false);
  if (!resBig.ok) {
    assert.equal(resBig.status, 400);
  }
});

test('parseQueryParams: fails on unsupported format', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=test&format=jpeg');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
  }
});

test('parseQueryParams: fails on unsupported style', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=test&style=a1');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
  }
});

test('parseQueryParams: fails on invalid ECC', () => {
  const url = new URL('http://localhost:8789/v1/create-qr-code/?data=test&ecc=X');
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 400);
  }
});

test('parseQueryParams: fails on payload exceeding 4096 bytes', () => {
  const hugeData = 'A'.repeat(4097);
  const url = new URL(`http://localhost:8789/v1/create-qr-code/?data=${hugeData}`);
  const res = parseQueryParams(url);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.status, 413);
  }
});

test('parseQueryParams: correctly handles Unicode, spaces, and special symbols', () => {
  const unicodeText = 'Рахунок #1234 — Сплата за послуги: 100 ₴ & кава + круасан';
  const url = new URL(`http://localhost:8789/v1/create-qr-code/?data=${encodeURIComponent(unicodeText)}`);
  const res = parseQueryParams(url);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.params.data, unicodeText);
  }
});
