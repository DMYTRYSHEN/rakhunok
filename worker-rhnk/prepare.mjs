import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(import.meta.dirname, '../build');

await cp(resolve(source, '200.html'), resolve(source, 'index.html'));