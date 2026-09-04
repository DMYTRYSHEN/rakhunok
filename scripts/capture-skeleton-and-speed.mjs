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
  '.png': 'image/png'
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

  // 1. Capture HTML Skeleton directly from raw HTML (before JS executes)
  const pageNoJs = await browser.newPage();
  await pageNoJs.setViewportSize({ width: 393, height: 852 });
  const htmlContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
  // Remove script to see raw instant skeleton
  const skeletonOnlyHtml = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  await pageNoJs.setContent(skeletonOnlyHtml);
  await pageNoJs.screenshot({ path: path.join(artifactDir, 'speed_instant_skeleton.png') });
  await pageNoJs.close();

  // 2. Capture Clean Loaded Page
  const page = await context.newPage();
  await page.goto('http://localhost:5199/pay/?demo=1');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifactDir, 'speed_instant_loaded.png') });

  await browser.close();
  server.close();
  console.log('Skeleton and loaded screenshots captured successfully!');
  process.exit(0);
});
