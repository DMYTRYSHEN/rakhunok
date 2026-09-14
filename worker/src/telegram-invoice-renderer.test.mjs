import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { renderInvoicePng, formatInvoiceDate, wrapInvoiceText, measureInvoiceText } from './telegram-invoice-renderer.ts';
import { TELEGRAM_LOGO_SVG, TELEGRAM_ART_SOURCE_HASHES, TELEGRAM_GLYPHS } from '../../src/lib/features/dashboard/public-page/telegram-invoice-art.ts';

const fixture = {
	amount: '12580.00', reference: 'RHK-2026-0914-0082',
	recipient: 'ФОП Коваленко Марія Сергіївна',
	issuedAt: '2026-09-14T08:15:00Z', displayExpiresAt: '2026-09-21T20:59:59Z',
	checkoutUrl: 'https://rakhunok.com/o/Ab3k9Q',
};
const root = new URL('../../', import.meta.url);
const decode = (bytes) => {
	const image = PNG.sync.read(bytes, { checkCRC: true });
	assert.equal(image.width, 1000); assert.equal(image.height, 600);
	const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
	assert.ok(decoded, 'Actual PNG QR must decode');
	return { image, decoded };
};

test('actual PNG: Ukrainian typography, exact URL, quiet zone and mobile-size QR', async () => {
	const oldFetch = globalThis.fetch;
	globalThis.fetch = () => { throw new Error('Renderer attempted network'); };
	let blob;
	try { blob = await renderInvoicePng(fixture); } finally { globalThis.fetch = oldFetch; }
	assert.equal(blob.type, 'image/png'); assert.ok(blob.size < 180000);
	const bytes = Buffer.from(await blob.arrayBuffer());
	const { image, decoded } = decode(bytes);
	assert.equal(decoded.data, fixture.checkoutUrl);
	const corner = decoded.location.topLeftCorner;
	const moduleSize = (decoded.location.topRightCorner.x - corner.x) / (decoded.version * 4 + 17);
	for (let y = Math.ceil(corner.y - 4 * moduleSize); y < corner.y; y++) {
		for (let x = Math.ceil(corner.x - 4 * moduleSize); x < decoded.location.topRightCorner.x + 4 * moduleSize; x++) {
			const offset = (y * 1000 + x) * 4;
			assert.deepEqual([...image.data.subarray(offset, offset + 3)], [255, 255, 255]);
		}
	}
	const resized = await sharp(bytes).resize(500, 300).ensureAlpha().raw().toBuffer();
	assert.equal(jsQR(new Uint8ClampedArray(resized), 500, 300)?.data, fixture.checkoutUrl);
	await mkdir(new URL('test-results/telegram-renderer/', root), { recursive: true });
	await writeFile(new URL('test-results/telegram-renderer/invoice.png', root), bytes);
});

test('Kyiv date formatting crosses UTC day boundaries and rejects invalid input', () => {
	assert.equal(formatInvoiceDate('2026-09-14T22:15:00Z'), '15.09.2026');
	assert.equal(formatInvoiceDate('2026-01-14T22:15:00Z'), '15.01.2026');
	assert.throws(() => formatInvoiceDate('not a date'));
	assert.throws(() => formatInvoiceDate('2026-02-30'));
	assert.throws(() => formatInvoiceDate('2026-09-14T22:15:00'));
});

test('all Ukrainian glyphs exist, bounded long text wraps and ellipsizes', () => {
	for (const char of 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя₴…') assert.ok(TELEGRAM_GLYPHS[char], char);
	for (const value of ['ТОВ «Українська фінансова компанія імені Ґалаґана» '.repeat(30), 'Ї'.repeat(1000), '👩‍💻 café 東京']) {
		const lines = wrapInvoiceText(value, 24, 530, 2);
		assert.ok(lines.length <= 2);
		for (const line of lines) assert.ok(measureInvoiceText(line, 24) <= 530);
	}
	assert.ok(wrapInvoiceText('Ї'.repeat(1000), 24, 530, 2).at(-1).endsWith('…'));
});

test('max amount, long legal name and a UUID checkout still produce a scannable PNG', async () => {
	const data = { ...fixture, amount: '99999999999999.99', reference: 'RHK-' + '9'.repeat(200),
		recipient: 'ТОВ «Європейська компанія Ґалаґана, Іваненко та партнери» '.repeat(30),
		checkoutUrl: 'https://rakhunok.com/pay/ef492ac1-1234-4567-8901-abcdefabcdef?source=invoice' };
	const bytes = Buffer.from(await (await renderInvoicePng(data)).arrayBuffer());
	assert.equal(decode(bytes).decoded.data, data.checkoutUrl);
	await mkdir(new URL('test-results/telegram-renderer/', root), { recursive: true });
	await writeFile(new URL('test-results/telegram-renderer/invoice-long.png', root), bytes);
	await renderInvoicePng({ ...fixture, recipient: 'ФОП Їжак 👩‍💻 東京 e\u0301\u202e' });
});

test('invalid or unbounded inputs fail before rendering', async () => {
	for (const amount of ['1e9', '-1.00', '1.001', '123', '0'.repeat(10000)]) await assert.rejects(renderInvoicePng({ ...fixture, amount }));
	for (const checkoutUrl of ['/o/abc', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/#x', 'https://example.com/' + 'x'.repeat(600)]) await assert.rejects(renderInvoicePng({ ...fixture, checkoutUrl }));
	await assert.rejects(renderInvoicePng({ ...fixture, recipient: '' }));
});

test('official logo geometry and local font source hashes are reproducible', async () => {
	const logo = await readFile(new URL('logo – копія.svg', root), 'utf8');
	assert.equal(TELEGRAM_LOGO_SVG, logo);
	assert.equal(createHash('sha256').update(logo).digest('hex'), TELEGRAM_ART_SOURCE_HASHES.logo);
	for (const [name, hash] of Object.entries(TELEGRAM_ART_SOURCE_HASHES)) {
		if (name === 'logo') continue;
		assert.equal(createHash('sha256').update(await readFile(new URL(`apps/pay/src/assets/fonts/${name}`, root))).digest('hex'), hash);
	}
});

test('real workerd: browser-only bundle renders concurrently without outbound requests', { timeout: 90000 }, async () => {
	const require = createRequire(new URL('../package.json', import.meta.url));
	const { build } = require('esbuild');
	const { Miniflare } = require('miniflare');
	const result = await build({
		stdin: { contents: `import { renderInvoicePng } from './worker/src/telegram-invoice-renderer.ts'; export default { async fetch(request) { return new Response(await renderInvoicePng(await request.json())); } };`,
			resolveDir: fileURLToPath(root), sourcefile: 'renderer-harness.ts', loader: 'ts' },
		bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', metafile: true,
	});
	assert.ok(!Object.keys(result.metafile.inputs).some((name) => /sharp|fontkit|node:|wasm/.test(name)));
	let outbound = 0;
	const mf = new Miniflare({ workers: [{ config: {
		name: 'telegram-renderer-local-test', type: 'worker', compatibilityDate: '2026-08-28',
		manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: result.outputFiles[0].text } } },
	}, dev: { outboundService: { type: 'fetcher', handler: () => { outbound++; throw new Error('Unexpected outbound fetch'); } } } }] });
	try {
		const responses = await Promise.all([fixture, { ...fixture, recipient: 'ТОВ «Ґанок України»', amount: '42.50' }].map((data) => mf.dispatchFetch('http://localhost/render', { method: 'POST', body: JSON.stringify(data) })));
		for (const response of responses) {
			assert.equal(response.status, 200);
			assert.equal(decode(Buffer.from(await response.arrayBuffer())).decoded.data, fixture.checkoutUrl);
		}
		assert.equal(outbound, 0);
		console.log(`Worker bundle: ${result.outputFiles[0].contents.length} bytes; zero native/WASM dependencies.`);
	} finally { await mf.dispose(); }
});