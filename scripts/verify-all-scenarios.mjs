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
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
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
  console.log('Static server started at http://localhost:5199');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // 1. Clean Original Order (?demo=1)
  console.log('1. Checking ?demo=1 (Clean Original Order)...');
  await page.goto('http://localhost:5199/pay/?demo=1');
  await page.waitForTimeout(600);
  const orderItemsInDemo1 = await page.locator('.table-items-card').count();
  const upsellsInDemo1 = await page.locator('.upsell-section').count();
  const roundupInDemo1 = await page.locator('.roundup-card').count();
  const loyaltyInDemo1 = await page.locator('.loyalty-card').count();
  console.log(`Demo 1 counts -> items: ${orderItemsInDemo1}, upsells: ${upsellsInDemo1}, roundup: ${roundupInDemo1}, loyalty: ${loyaltyInDemo1}`);
  if (orderItemsInDemo1 !== 0 || upsellsInDemo1 !== 0 || roundupInDemo1 !== 0 || loyaltyInDemo1 !== 0) {
    throw new Error('demo=1 must be clean and minimal!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_1_classic.png') });

  // 2. Order with Items & Upsells (?demo=order_upsell)
  console.log('2. Checking ?demo=order_upsell...');
  await page.goto('http://localhost:5199/pay/?demo=order_upsell');
  await page.waitForTimeout(600);
  const itemsInUpsell = await page.locator('.table-items-card').count();
  const upsellsInUpsell = await page.locator('.upsell-section').count();
  console.log(`Demo order_upsell counts -> items: ${itemsInUpsell}, upsells: ${upsellsInUpsell}`);
  if (itemsInUpsell === 0 || upsellsInUpsell === 0) {
    throw new Error('demo=order_upsell must have items and upsells!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_order_upsell.png') });

  // 3. Clean Original Table (?demo=3)
  console.log('3. Checking ?demo=3 (Clean Original Table)...');
  await page.goto('http://localhost:5199/pay/?demo=3');
  await page.waitForTimeout(600);
  const tableItemsInDemo3 = await page.locator('.table-items-card').count();
  const tableUpsellsInDemo3 = await page.locator('.upsell-section').count();
  const complianceInDemo3 = await page.locator('.compliance-card').count();
  const splitInDemo3 = await page.locator('.table-split-card').count();
  const tipsInDemo3 = await page.locator('.table-tips-card').count();
  console.log(`Demo 3 counts -> items: ${tableItemsInDemo3}, upsells: ${tableUpsellsInDemo3}, compliance: ${complianceInDemo3}, split: ${splitInDemo3}, tips: ${tipsInDemo3}`);
  if (tableItemsInDemo3 !== 0 || tableUpsellsInDemo3 !== 0 || complianceInDemo3 !== 0) {
    throw new Error('demo=3 must be clean and minimal!');
  }
  if (splitInDemo3 === 0 || tipsInDemo3 === 0) {
    throw new Error('demo=3 must have split and tips!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_3_classic.png') });

  // 4. Full Flagship Table (?demo=table_full)
  console.log('4. Checking ?demo=table_full...');
  await page.goto('http://localhost:5199/pay/?demo=table_full');
  await page.waitForTimeout(600);
  const itemsInTableFull = await page.locator('.table-items-card').count();
  const complianceInTableFull = await page.locator('.compliance-card').count();
  console.log(`Demo table_full counts -> items: ${itemsInTableFull}, compliance: ${complianceInTableFull}`);
  if (itemsInTableFull === 0 || complianceInTableFull === 0) {
    throw new Error('demo=table_full must have items and compliance card!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_table_full.png') });

  // 5. Index Hub (?demo=all)
  console.log('5. Checking ?demo=all (Catalog Hub)...');
  await page.goto('http://localhost:5199/pay/?demo=all');
  await page.waitForTimeout(600);
  const cardsCount = await page.locator('.index-item-card').count();
  console.log(`Demo all cards count: ${cardsCount}`);
  if (cardsCount < 10) {
    throw new Error('demo=all must have catalog cards!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_all_index.png') });

  // 6. Timeout screen (?demo=timeout)
  console.log('6. Checking ?demo=timeout...');
  await page.goto('http://localhost:5199/pay/?demo=timeout');
  await page.waitForTimeout(600);
  const timeoutContent = await page.locator('.status-content.is-timeout').count();
  console.log(`Timeout is-timeout count: ${timeoutContent}`);
  if (timeoutContent === 0) {
    throw new Error('demo=timeout must have .status-content.is-timeout class!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_timeout.png') });

  // 7. Waiting Screen (?demo=waiting)
  console.log('7. Checking ?demo=waiting (Apple Sonar Radar)...');
  await page.goto('http://localhost:5199/pay/?demo=waiting');
  await page.waitForTimeout(600);
  const sonarStage = await page.locator('.sonar-stage').count();
  const liveCard = await page.locator('.waiting-live-card').count();
  console.log(`Waiting stage -> sonar: ${sonarStage}, liveCard: ${liveCard}`);
  if (sonarStage === 0 || liveCard === 0) {
    throw new Error('demo=waiting must have sonar-stage and waiting-live-card!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_waiting_radar.png') });

  // 8. Fiscal Receipt Screen (?demo=receipt)
  console.log('8. Checking ?demo=receipt (Apple Digital Receipt with Frosted Blur)...');
  await page.goto('http://localhost:5199/pay/?demo=receipt');
  await page.waitForTimeout(600);
  const receiptPaper = await page.locator('.fiscal-receipt-paper').count();
  const backdrop = await page.locator('.action-sheet-backdrop.visible').count();
  console.log(`Receipt modal -> paper: ${receiptPaper}, backdrop: ${backdrop}`);
  if (receiptPaper === 0 || backdrop === 0) {
    throw new Error('demo=receipt must have fiscal-receipt-paper and visible backdrop!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_receipt_apple.png') });

  // 9. Paid Status Screen (?demo=paid, verifying eco-badge is gone)
  console.log('9. Checking ?demo=paid (Verifying eco-badge is removed)...');
  await page.goto('http://localhost:5199/pay/?demo=paid');
  await page.waitForTimeout(600);
  const ecoBadgeCount = await page.locator('.eco-badge').count();
  console.log(`Paid screen eco-badge count: ${ecoBadgeCount}`);
  if (ecoBadgeCount !== 0) {
    throw new Error('eco-badge must be completely removed!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_paid_clean.png') });

  // 10. Invalid Order Screen (Рахунок не знайдено)
  console.log('10. Checking Invalid Order ID (Compact Apple Error Card)...');
  await page.goto('http://localhost:5199/pay/?id=invalid_order_id_9999');
  await page.waitForTimeout(600);
  const compactCard = await page.locator('.checkout-compact-card').count();
  console.log(`Compact error card count: ${compactCard}`);
  if (compactCard === 0) {
    throw new Error('Error screen must display compact Apple card!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_order_not_found.png') });

  // 11. Payment Sheet: Pay by Bank primary view & Other Methods sub-modal
  console.log('11. Checking Bank Sheet (Pay by Bank primary & Other Methods sub-modal)...');
  await page.goto('http://localhost:5199/pay/?demo=1');
  await page.waitForTimeout(600);
  await page.click('.order-cta');
  await page.waitForTimeout(500);

  // Verify primary view is Pay by Bank
  const payBtn = await page.locator('.pay-btn').count();
  const otherTrigger = await page.locator('.other-methods-trigger-btn').count();
  console.log(`Primary sheet elements -> payBtn: ${payBtn}, otherTrigger: ${otherTrigger}`);
  if (payBtn === 0 || otherTrigger === 0) {
    throw new Error('Bank sheet must have primary pay-btn and other-methods-trigger-btn!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_banksheet_primary.png') });

  // Open Other Methods sub-view
  await page.click('.other-methods-trigger-btn');
  await page.waitForTimeout(400);
  const couponInput = await page.locator('.coupon-input').count();
  const otherItems = await page.locator('.other-method-item').count();
  console.log(`Other methods sub-view -> couponInput: ${couponInput}, otherItems: ${otherItems}`);
  if (couponInput === 0 || otherItems < 2) {
    throw new Error('Other methods sub-view must have coupon input and alternative methods!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_banksheet_other_methods.png') });

  // 12. Loyalty Card Scanner Modal (?demo=loyalty)
  console.log('12. Checking Loyalty Card Scanner (?demo=loyalty)...');
  await page.goto('http://localhost:5199/pay/?demo=loyalty');
  await page.waitForTimeout(600);
  const loyaltyModal = await page.locator('.loyalty-modal-sheet').count();
  const scannerViewport = await page.locator('.scanner-viewport').count();
  const scannerLaser = await page.locator('.scanner-laser').count();
  const presetsCount = await page.locator('.preset-chip').count();
  console.log(`Loyalty scanner elements -> modal: ${loyaltyModal}, viewport: ${scannerViewport}, laser: ${scannerLaser}, presets: ${presetsCount}`);
  if (loyaltyModal === 0 || scannerViewport === 0 || presetsCount === 0) {
    throw new Error('Loyalty modal must have viewport and presets!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_loyalty_scanner.png') });

  // 13. Apply Loyalty Card & Apple Wallet Pass
  console.log('13. Applying Rozetka Club VIP loyalty card...');
  await page.click('.preset-chip.rozetka');
  await page.waitForTimeout(400);
  const passCard = await page.locator('.apple-pass-card').count();
  const balanceVal = await page.locator('.pass-balance-value').innerText();
  const bonusSwitch = await page.locator('.apple-switch').count();
  console.log(`Loyalty card applied -> pass: ${passCard}, balance: ${balanceVal}, switch: ${bonusSwitch}`);
  if (passCard === 0 || !balanceVal.includes('150')) {
    throw new Error('Loyalty card must display Apple Pass with 150 bonus balance!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_loyalty_applied.png') });

  // Close modal and verify updated total on order screen
  await page.click('.pass-done-btn');
  await page.waitForTimeout(400);
  const connectedBadge = await page.locator('.loyalty-connected-badge').count();
  console.log(`Connected badge count: ${connectedBadge}`);
  if (connectedBadge === 0) {
    throw new Error('Connected badge must be visible on order screen after loyalty applied!');
  }
  await page.screenshot({ path: path.join(artifactDir, 'demo_order_with_loyalty.png') });

  await browser.close();
  server.close();
  console.log('All 13 validations passed and screenshots captured successfully!');
  process.exit(0);
});

