import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../apps/pay/dist');
const artifactDir = 'C:/Users/ТЕХНОРАЙ/.gemini/antigravity/brain/cb031fa6-965f-4b27-bdab-1f020aa1a915';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost:5199').pathname);
  let filePath = '';

  if (urlPath.startsWith('/pay/')) {
    filePath = path.join(distDir, urlPath.replace(/^\/pay\//, ''));
  } else if (urlPath === '/' || urlPath === '/pay') {
    filePath = path.join(distDir, 'index.html');
  } else {
    filePath = path.join(distDir, urlPath);
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(5199, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // 1. Table Scenario with Line Items, Upsells, Split & Compliance (?demo=3)
  console.log('1. Capturing Table with Items, Upsell, Split & Compliance...');
  await page.goto('http://localhost:5199/pay/?demo=3');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'demo_table_items.png') });

  // 2. Order Scenario with 1-Click Upsells & Round-Up (?demo=1)
  console.log('2. Capturing Order with 1-Click Upsells & Round-Up...');
  await page.goto('http://localhost:5199/pay/?demo=1');
  await page.waitForTimeout(600);
  try {
    const roundupBtn = page.locator('.roundup-btn');
    if (await roundupBtn.count() > 0) {
      await roundupBtn.click({ timeout: 2000 });
      await page.waitForTimeout(250);
    }
  } catch (e) {
    console.error('Failed to toggle roundup:', e.message);
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_order_upsell.png') });

  // 3. Paid Screen with Live Kitchen Tracker & Eco-Badge (?demo=paid_table)
  console.log('3. Capturing Paid Screen with Live Kitchen Tracker & Eco-Badge...');
  await page.goto('http://localhost:5199/pay/?demo=paid_table');
  await page.waitForTimeout(600);
  try {
    const stars = page.locator('.nps-star-btn');
    if (await stars.count() >= 5) {
      await stars.nth(4).click({ timeout: 2000 });
      await page.waitForTimeout(200);
    }
  } catch (e) {
    console.error('Failed to click star:', e.message);
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_live_tracker.png') });

  // 4. Electronic Fiscal Receipt with Digital Platforms Split
  console.log('4. Capturing Fiscal Receipt with Split on Table Order...');
  try {
    const receiptBtn = page.locator('.status-receipt-btn');
    if (await receiptBtn.count() > 0) {
      await receiptBtn.click({ timeout: 2000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(artifactDir, 'demo_fiscal_receipt.png') });
      const closeBtn = page.locator('.status-btn-secondary');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(200);
      }
    }
  } catch (e) {
    console.error('Failed to open fiscal receipt:', e.message);
  }

  // 5. Nova Poshta Tracking Button & Dedicated Modal Window (?demo=paid)
  console.log('5. Capturing Nova Poshta Tracking Window...');
  await page.goto('http://localhost:5199/pay/?demo=paid');
  await page.waitForTimeout(600);
  try {
    const npBtn = page.locator('.np-track-trigger-btn');
    if (await npBtn.count() > 0) {
      await npBtn.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(artifactDir, 'demo_np_tracking.png') });
    }
  } catch (e) {
    console.error('Failed to open NP tracking modal:', e.message);
  }

  // 6. Standalone Waiter Tips (?demo=tips)
  console.log('6. Capturing Tips Screen...');
  await page.goto('http://localhost:5199/pay/?demo=tips');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'demo_tips.png') });

  // 7. Volunteer Fundraiser / Donation "Banka" (?demo=donation)
  console.log('7. Capturing Donation Screen...');
  await page.goto('http://localhost:5199/pay/?demo=donation');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'demo_donation.png') });

  await browser.close();
  server.close();
  console.log('All flagship screenshots captured successfully!');
  process.exit(0);
});
