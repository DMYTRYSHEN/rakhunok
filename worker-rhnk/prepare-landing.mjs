import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

const source = resolve(import.meta.dirname, '../build');
const destination = resolve(import.meta.dirname, '.landing-assets');
const html = await readFile(resolve(source, 'index.html'), 'utf8');
const entry = html.match(/\/(_app\/immutable\/entry\/app\.[\w-]+\.js)/)?.[1];
if (!entry) throw new Error('Landing build is missing the SvelteKit app entry');

const manifest = await readFile(resolve(source, entry), 'utf8');
const nodeNames = [...manifest.matchAll(/\.\.\/nodes\/([\w.-]+\.js)/g)].map((match) => match[1]);
const homepage = nodeNames[2];
if (!homepage) throw new Error('Landing build is missing the homepage node');

const pending = [
	'index.html', '__data.json', 'robots.txt', '_app/env.js',
	html.match(/\/(_app\/immutable\/entry\/start\.[\w-]+\.js)/)?.[1], entry,
	`_app/immutable/nodes/${nodeNames[0]}`,
	`_app/immutable/nodes/${nodeNames[1]}`,
	`_app/immutable/nodes/${homepage}`
];

if (pending.some((path) => !path)) throw new Error('Landing build is missing the start entry');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const visited = new Set();
while (pending.length) {
	const path = pending.pop();
	if (visited.has(path)) continue;
	visited.add(path);
	const content = await readFile(resolve(source, path));
	await mkdir(dirname(resolve(destination, path)), { recursive: true });
	await cp(resolve(source, path), resolve(destination, path));
	if (extname(path) !== '.js' && extname(path) !== '.css') continue;
	const text = content.toString('utf8');
	for (const match of text.matchAll(/(?:\.\.\/)+(?:chunks|nodes|assets)\/[\w.-]+/g)) {
		if (path === entry && match[0].includes('../nodes/')) continue;
		const dependency = resolve(dirname(resolve(source, path)), match[0]).slice(source.length + 1).replaceAll('\\', '/');
		pending.push(dependency);
	}
}
await cp(resolve(source, 'images/landing'), resolve(destination, 'images/landing'), { recursive: true });
console.log(`Prepared ${visited.size} landing files plus landing images`);