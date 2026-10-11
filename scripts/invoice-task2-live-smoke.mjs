import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const origin = 'https://rhnk.to';
const buildRoot = path.resolve('build');
const browser = await chromium.launch();
try {
  const failedRoutes = [];
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  for (const routePath of ['/', '/dashboard', '/app', '/conf/', '/pay', '/pay/', '/corex']) {
    const response = await fetch(origin + routePath, { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    await page.setContent(html);
    const references = await page.evaluate(() => [...document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="modulepreload"]')].map(element => element.getAttribute('src') || element.getAttribute('href')));
    const imports = [...html.matchAll(/(?:import\s*\(|from\s*)["']([^"']+\.js)["']/g)].map(match => match[1]);
    const assets = [...new Set([...references, ...imports])].map(asset => new URL(asset, response.url).href);
    console.log(JSON.stringify({ path: routePath, status: response.status, finalUrl: response.url, assets: assets.length }));
    for (const asset of assets) {
      const assetResponse = await fetch(asset, { signal: AbortSignal.timeout(20000) });
      const contentType = assetResponse.headers.get('content-type') || '';
      assert.equal(assetResponse.status, 200, asset);
      assert.ok(/text\/css|javascript/.test(contentType), `${asset}: ${contentType}`);
    }
    if (response.status !== 200 || assets.length === 0) {
      failedRoutes.push({ path: routePath, status: response.status, assets: assets.length });
    }
  }
  const assetsRoot = path.join(buildRoot, '_app/immutable');
  const files = fs.readdirSync(assetsRoot, { recursive: true }).filter(file => file.endsWith('.js'));
  const focusFiles = files.filter(file => fs.readFileSync(path.join(assetsRoot, file), 'utf8').includes('invoice-goods-amount'));
  const readinessFiles = files.filter(file => {
    const content = fs.readFileSync(path.join(assetsRoot, file), 'utf8');
    return /(?:8000|8e3)/.test(content) && content.includes('advisory');
  });
  assert.ok(focusFiles.length, 'Compiled focus component missing');
  assert.ok(readinessFiles.length, 'Compiled readiness component missing');
  for (const file of new Set([...focusFiles, ...readinessFiles])) {
    const local = fs.readFileSync(path.join(assetsRoot, file));
    const asset = origin + '/dashboard/_app/immutable/' + file.replaceAll('\\', '/');
    const response = await fetch(asset, { signal: AbortSignal.timeout(20000) });
    const remote = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, asset);
    assert.ok(local.equals(remote), asset);
    console.log(JSON.stringify({ releaseAsset: asset, status: response.status, identical: true, sha256: crypto.createHash('sha256').update(remote).digest('hex') }));
  }
  assert.deepEqual(failedRoutes, [], 'Seven-route acceptance failed');
} finally {
  await browser.close();
}