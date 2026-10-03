# Snow Character Project

Snapshot saved before restoring the JPEG character on the active QR site.

## Contents

- `src/rahunok-morph.ts`: Snow renderer, camera and runtime gesture blending.
- `public/models/rahunok-snow.glb`: exported character with gesture morph targets.
- `scripts/export-rahunok-snow.py`: reproducible Blender export and arm-position checks.
- `scripts/rahunok-character.browser.test.mjs`: animation regression test snapshot.
- `blender-source/`: original Snow blend file and textures.
- The remaining files preserve the QR preview application and its dependencies.

## Preview

Run `npm ci`, then `npm run dev -- --port 4185` from this folder.
Open `http://127.0.0.1:4185/qr/`.

## Export

Run Blender with `--background --disable-autoexec blender-source/snow_v4.2.blend --python-exit-code 1 --python scripts/export-rahunok-snow.py -- --output public/models/rahunok-snow.glb`.
The original file reports a newer Blender version when opened with Blender 4.2 LTS.

## Status

The export and TypeScript build passed. The live-animation browser test was still timing out when this snapshot was saved; this is a preserved work-in-progress, not a fully validated release.

## Attribution

Snow Rig (CC) Blender Foundation | studio.blender.org

Source: https://studio.blender.org/characters/snow/
License: https://creativecommons.org/licenses/by/4.0/

Modifications: lighter skin materials, web-compatible materials, baked poses and gesture morphs, camera and runtime animation integration.