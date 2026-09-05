import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../apps/conf/dist');
const confTargetDir = resolve(distDir, 'conf');
const buildConfDir = resolve(__dirname, '../build/conf');
const sharedBuildFallback = resolve(__dirname, '../build/200.html');
const sharedBuildAppDir = resolve(__dirname, '../build/_app');

if (existsSync(distDir)) {
  if (!existsSync(confTargetDir)) mkdirSync(confTargetDir, { recursive: true });
  const hasSharedBuild = existsSync(sharedBuildFallback) && existsSync(sharedBuildAppDir);
  if (hasSharedBuild && !existsSync(buildConfDir)) mkdirSync(buildConfDir, { recursive: true });

  const items = ['assets', 'index.html'];
  for (const item of items) {
    const src = resolve(distDir, item);
    if (existsSync(src)) {
      cpSync(src, resolve(confTargetDir, item), { recursive: true, force: true });
      if (hasSharedBuild) {
        cpSync(src, resolve(buildConfDir, item), { recursive: true, force: true });
      }
    }
  }
  console.log(
    hasSharedBuild
      ? 'Successfully mirrored conf assets to dist/conf and build/conf.'
      : 'Successfully mirrored conf assets to dist/conf; skipped build/conf because no complete shared build exists.'
  );
}
