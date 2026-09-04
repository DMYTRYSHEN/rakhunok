import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../apps/pay/dist');
const payTargetDir = resolve(distDir, 'pay');
const checkoutTargetDir = resolve(distDir, 'checkout');

if (existsSync(distDir)) {
  if (!existsSync(payTargetDir)) mkdirSync(payTargetDir, { recursive: true });
  if (!existsSync(checkoutTargetDir)) mkdirSync(checkoutTargetDir, { recursive: true });

  // Mirror assets, fonts, index.html into dist/pay/ and dist/checkout/
  const items = ['assets', 'fonts', 'index.html', 'logo.svg', 'banks.json', 'scenarios.json'];
  for (const item of items) {
    const src = resolve(distDir, item);
    if (existsSync(src)) {
      cpSync(src, resolve(payTargetDir, item), { recursive: true, force: true });
      cpSync(src, resolve(checkoutTargetDir, item), { recursive: true, force: true });
    }
  }
  console.log('✓ Successfully mirrored pay and checkout assets to dist for Edge CDN');
}
