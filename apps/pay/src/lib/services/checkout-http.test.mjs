import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedJson } from './checkout-http.ts';

const encode = value => new TextEncoder().encode(value);

function trackedResponse(t, chunks, { readError, cancelError, keepOpen = false } = {}) {
  let index = 0;
  const response = new Response(new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else if (readError) controller.error(readError);
      else if (!keepOpen) controller.close();
    },
    cancel() { if (cancelError) throw cancelError; }
  }, { highWaterMark: 0 }));
  const reader = response.body.getReader();
  t.mock.method(response.body, 'getReader', () => reader);
  const cancel = t.mock.method(reader, 'cancel');
  const release = t.mock.method(reader, 'releaseLock');
  return { response, reader, cancel, release };
}

function assertReleased(h, cancellations = 0) {
  assert.equal(h.response.body.locked, false);
  assert.equal(h.release.mock.callCount(), 1);
  assert.equal(h.cancel.mock.callCount(), cancellations);
}

test('boundedJson drains through EOF and releases without cancelling successful JSON', async t => {
  const bytes = encode('{"value":"€"}');
  const h = trackedResponse(t, [bytes.slice(0, 11), bytes.slice(11)]);
  const read = t.mock.method(h.reader, 'read');
  assert.deepEqual(await boundedJson(h.response), { value: '€' });
  assert.equal(read.mock.callCount(), 3);
  assert.equal(h.response.bodyUsed, true);
  assertReleased(h);
});

test('boundedJson accepts exactly 65536 bytes and releases without cancellation', async t => {
  const bytes = encode(`"${'a'.repeat(65534)}"`);
  assert.equal(bytes.length, 65536);
  const h = trackedResponse(t, [bytes.slice(0, 32768), bytes.slice(32768)]);
  assert.equal(await boundedJson(h.response), 'a'.repeat(65534));
  assertReleased(h);
});

for (const [name, chunks, errorType] of [
  ['invalid JSON', [encode('{')], SyntaxError],
  ['invalid UTF-8', [new Uint8Array([0xff])], TypeError],
  ['empty stream', [], SyntaxError]
]) test(`boundedJson releases without cancelling on ${name}`, async t => {
  const h = trackedResponse(t, chunks);
  await assert.rejects(boundedJson(h.response), errorType);
  assertReleased(h);
});

test('boundedJson releases after a read rejection and preserves the original error', async t => {
  const readError = new Error('synthetic_read_failure');
  const h = trackedResponse(t, [encode('{')], { readError });
  await assert.rejects(boundedJson(h.response), error => error === readError);
  assertReleased(h);
});

for (const [name, chunks] of [
  ['single chunk', [new Uint8Array(65537)]],
  ['cumulative chunks', [new Uint8Array(65536), new Uint8Array(1)]],
  ['UTF-8 byte count', [encode(`"${'€'.repeat(21845)}"`)]]
]) test(`boundedJson cancels oversize ${name} then releases`, async t => {
  const h = trackedResponse(t, chunks, { keepOpen: true });
  await assert.rejects(boundedJson(h.response), /response_too_large/);
  assertReleased(h, 1);
});

test('boundedJson releases even when oversize cancellation rejects', async t => {
  const cancelError = new Error('synthetic_cancel_failure');
  const h = trackedResponse(t, [new Uint8Array(65537)], { keepOpen: true, cancelError });
  await assert.rejects(boundedJson(h.response), error => error === cancelError);
  assertReleased(h, 1);
});

test('boundedJson rejects a missing body', async () => {
  await assert.rejects(boundedJson(new Response(null)), /empty_response/);
});