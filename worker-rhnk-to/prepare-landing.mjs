import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(import.meta.dirname, '../build');
const destination = resolve(import.meta.dirname, '.landing-assets');
const html = await readFile(resolve(source, 'index.html'), 'utf8');
if (!html.includes('/_app/immutable/entry/')) throw new Error('Missing landing app entry');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const path of ['index.html', '__data.json', 'robots.txt', 'favicon.svg', '_app', 'images']) {
	await cp(resolve(source, path), resolve(destination, path), { recursive: true });
}
console.log('Prepared complete landing runtime and images');