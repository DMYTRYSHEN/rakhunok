import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDirectory = resolve(root, 'docs');
const outputDirectory = resolve(root, 'build', 'docs');
const files = ['index.html', 'openapi.yaml'];

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
	files.map((file) => copyFile(resolve(sourceDirectory, file), resolve(outputDirectory, file)))
);

console.log(`Copied API documentation to ${outputDirectory}.`);