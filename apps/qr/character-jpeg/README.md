# JPEG Character Preview

Independent snapshot of the QR site with the four-pose JPEG character, saved before restoring the base site.

- `site/src/rahunok-morph.ts`: canvas portrait blending, zoom and subtle motion.
- `site/src/rahunok-assistant.ts`: state selection and demo controls.
- `site/src/rahunok-assistant.css`: character layout.
- `img/`: four original JPEG portraits. Keep this directory next to `site`.

From `site`, run `npm ci` and `npm run dev -- --port 4186`.
Open `http://127.0.0.1:4186/qr/`.

This version uses crossfades between still portraits, not skeletal animation or generated intermediate facial poses. The build passed before archival; browser regression verification was not completed.

The separate Snow character and its animations are preserved in `../character-snow`.