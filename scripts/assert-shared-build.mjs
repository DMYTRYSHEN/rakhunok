import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildDir = process.env.SHARED_BUILD_DIR
	? resolve(process.env.SHARED_BUILD_DIR)
	: resolve(import.meta.dirname, '../build');
const fallbackPath = resolve(buildDir, '200.html');
const appDir = resolve(buildDir, '_app');

const missing = [];
if (!existsSync(fallbackPath)) missing.push('build/200.html');
if (!existsSync(appDir)) missing.push('build/_app');

if (missing.length > 0) {
	throw new Error(
		`Shared production build is incomplete (${missing.join(', ')} missing). Run "npm run build" before deploying the landing, dashboard, or Corex Worker.`
	);
}

const html = readFileSync(fallbackPath, 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)=["'](\/_app\/[^"']+)["']/g)].map(
	([, pathname]) => pathname
);

if (assetPaths.length === 0) {
	throw new Error('build/200.html does not reference any /_app assets. Refusing shared Worker deployment.');
}

const missingAssets = assetPaths.filter((pathname) => !existsSync(resolve(buildDir, `.${pathname}`)));
if (missingAssets.length > 0) {
	throw new Error(
		`Shared production build references missing assets: ${missingAssets.slice(0, 5).join(', ')}`
	);
}

console.log(`Shared build guard passed (${assetPaths.length} entry assets verified).`);