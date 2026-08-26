import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist', 'checkout');

await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['index.html', 'logo.svg', 'banks.json', 'css', 'js']) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

console.log(`Checkout built at ${output}`);