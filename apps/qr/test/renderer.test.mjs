import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrMatrix } from '../src/matrix.ts';
import { renderA2Svg } from '../src/renderer-a2.ts';

test('renderA2Svg: produces valid SVG structure', () => {
  const matrix = generateQrMatrix('https://example.com', 'M');
  const params = {
    data: 'https://example.com',
    size: 240,
    format: 'svg',
    style: 'a2',
    ecc: 'M'
  };

  const svg = renderA2Svg(matrix, params);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="240"'));
  assert.ok(svg.includes('height="240"'));
  assert.ok(svg.includes('<rect width='));
  assert.ok(svg.includes('fill="#FFFFFF"'));
  assert.ok(svg.includes('stroke="#000000"'));
  assert.ok(svg.endsWith('</svg>'));
});

test('renderA2Svg: determinism check (identical output for identical input)', () => {
  const params = {
    data: 'https://example.com/pay/abc-123',
    size: 240,
    format: 'svg',
    style: 'a2',
    ecc: 'M'
  };

  const matrix1 = generateQrMatrix(params.data, params.ecc);
  const svg1 = renderA2Svg(matrix1, params);

  const matrix2 = generateQrMatrix(params.data, params.ecc);
  const svg2 = renderA2Svg(matrix2, params);

  assert.equal(svg1, svg2);
});

test('renderA2Svg: includes 3 finder patterns with rounded corners and center dots', () => {
  const matrix = generateQrMatrix('test', 'M');
  const params = {
    data: 'test',
    size: 240,
    format: 'svg',
    style: 'a2',
    ecc: 'M'
  };

  const svg = renderA2Svg(matrix, params);
  // Matches outer finder frames (rx="2" ry="2")
  const finderFrames = svg.match(/rx="2" ry="2"/g);
  assert.equal(finderFrames?.length, 3);

  // Matches center dots (r="1.5")
  const centerDots = svg.match(/r="1.5"/g);
  assert.equal(centerDots?.length, 3);
});

test('renderA2Svg: margin calculation matches N/5 modules', () => {
  const matrix = generateQrMatrix('test', 'M');
  const n = matrix.size;
  const margin = n / 5;
  const total = (n + 2 * margin).toFixed(3);

  const params = {
    data: 'test',
    size: 300,
    format: 'svg',
    style: 'a2',
    ecc: 'M'
  };

  const svg = renderA2Svg(matrix, params);
  assert.ok(svg.includes(`viewBox="0 0 ${total} ${total}"`));
});
