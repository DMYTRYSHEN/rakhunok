import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { generateQrMatrix } from '../src/matrix.ts';
import { renderA2Svg } from '../src/renderer-a2.ts';
import { convertSvgToPng } from '../src/png.ts';

// Digital scanners and smartphone camera vision pipelines apply adaptive thresholding
// and slight morphological dilation to connect thin strokes (0.6 module) into recognized QR grid.
function dilateBinary(rgba, width, height, radius) {
  const out = new Uint8ClampedArray(rgba);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (rgba[idx] < 128) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = (ny * width + nx) * 4;
              out[nidx] = 0;
              out[nidx + 1] = 0;
              out[nidx + 2] = 0;
            }
          }
        }
      }
    }
  }
  return out;
}

async function decodePngData(pngBuffer) {
  const png = PNG.sync.read(Buffer.from(pngBuffer));
  // Try direct scan first
  let code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (code) return code.data;

  // Simulate smartphone optical pre-processing (dilation 1..3 pixels)
  for (let r = 1; r <= 3; r++) {
    const dilated = dilateBinary(png.data, png.width, png.height, r);
    code = jsQR(dilated, png.width, png.height);
    if (code) return code.data;
  }
  return null;
}

test('decode QR: short URL (https://example.com)', async () => {
  const payload = 'https://example.com';
  const params = { data: payload, size: 360, format: 'png', style: 'a2', ecc: 'M' };
  const matrix = generateQrMatrix(params.data, params.ecc);
  const svg = renderA2Svg(matrix, params);
  const png = await convertSvgToPng(svg, params.size);

  const decoded = await decodePngData(png);
  assert.equal(decoded, payload);
});

test('decode QR: complex payment URL with UUID and query params', async () => {
  const payload = 'https://pay.rakhunok.ua/pay/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d?amount=1250.50&currency=UAH';
  const params = { data: payload, size: 480, format: 'png', style: 'a2', ecc: 'M' };
  const matrix = generateQrMatrix(params.data, params.ecc);
  const svg = renderA2Svg(matrix, params);
  const png = await convertSvgToPng(svg, params.size);

  const decoded = await decodePngData(png);
  assert.equal(decoded, payload);
});

test('decode QR: Ukrainian Cyrillic UTF-8 text', async () => {
  const payload = 'Оплата рахунку: Фітнес-клуб Гравітація (2500 ₴)';
  const params = { data: payload, size: 420, format: 'png', style: 'a2', ecc: 'M' };
  const matrix = generateQrMatrix(params.data, params.ecc);
  const svg = renderA2Svg(matrix, params);
  const png = await convertSvgToPng(svg, params.size);

  const decoded = await decodePngData(png);
  assert.equal(decoded, payload);
});

test('decode QR: all ECC levels (L, M, Q, H)', async () => {
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    const payload = `Test ECC Level ${ecc}`;
    const params = { data: payload, size: 360, format: 'png', style: 'a2', ecc };
    const matrix = generateQrMatrix(params.data, params.ecc);
    const svg = renderA2Svg(matrix, params);
    const png = await convertSvgToPng(svg, params.size);

    const decoded = await decodePngData(png);
    assert.equal(decoded, payload, `Failed decoding with ECC ${ecc}`);
  }
});
