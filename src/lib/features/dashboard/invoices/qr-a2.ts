import qrcode from 'qrcode';

export interface QrA2Options {
  size?: number;
  ecc?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates an SVG string of a QR code in the A2 visual style.
 * Can be used in both client-side browser environments and server-side endpoints.
 */
export function generateA2Svg(data: string, options: QrA2Options = {}): string {
  const ecc = options.ecc || 'M';
  const size = options.size || 240;

  const qr = qrcode.create(data, {
    errorCorrectionLevel: ecc
  });

  const n = qr.modules.size;
  const dataArray = qr.modules.data;
  const marginModules = n / 5;
  const totalModules = n + 2 * marginModules;

  const isDark = (r: number, c: number): boolean => {
    if (r < 0 || r >= n || c < 0 || c >= n) return false;
    return dataArray[r * n + c] === 1;
  };

  const isFinder = (r: number, c: number): boolean => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= n - 8) return true;
    if (r >= n - 8 && c < 8) return true;
    return false;
  };

  const strokeWidth = 0.6;
  const radius = strokeWidth / 2;
  const visited = new Set<string>();
  const coordKey = (r: number, c: number) => `${r},${c}`;

  const svgElements: string[] = [];

  const center = (r: number, c: number) => ({
    x: marginModules + c + 0.5,
    y: marginModules + r + 0.5
  });

  // 1. Render Finder Patterns
  const finderOrigins = [
    { r: 0, c: 0 },
    { r: 0, c: n - 7 },
    { r: n - 7, c: 0 }
  ];

  for (const origin of finderOrigins) {
    const ox = marginModules + origin.c;
    const oy = marginModules + origin.r;

    // Outer frame of finder: 7x7 outer square, 1 module stroke width with rx=2, ry=2
    svgElements.push(
      `<rect x="${(ox + 0.5).toFixed(3)}" y="${(oy + 0.5).toFixed(3)}" width="6" height="6" rx="2" ry="2" fill="none" stroke="#000000" stroke-width="1"/>`
    );

    // Inner circle of finder: 3x3 circle (r=1.5)
    svgElements.push(
      `<circle cx="${(ox + 3.5).toFixed(3)}" cy="${(oy + 3.5).toFixed(3)}" r="1.5" fill="#000000"/>`
    );
  }

  // 2. Traverse matrix row-major to generate Interlock segments
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isFinder(r, c)) continue;
      if (!isDark(r, c)) continue;
      if (visited.has(coordKey(r, c))) continue;

      let vLen = 1;
      while (
        vLen < 4 &&
        r + vLen < n &&
        !isFinder(r + vLen, c) &&
        isDark(r + vLen, c) &&
        !visited.has(coordKey(r + vLen, c))
      ) {
        vLen++;
      }

      let hLen = 1;
      while (
        hLen < 4 &&
        c + hLen < n &&
        !isFinder(r, c + hLen) &&
        isDark(r, c + hLen) &&
        !visited.has(coordKey(r, c + hLen))
      ) {
        hLen++;
      }

      if (vLen > 1) {
        const start = center(r, c);
        const end = center(r + vLen - 1, c);
        svgElements.push(
          `<line x1="${start.x.toFixed(3)}" y1="${start.y.toFixed(3)}" x2="${end.x.toFixed(3)}" y2="${end.y.toFixed(3)}" stroke="#000000" stroke-width="${strokeWidth}" stroke-linecap="round"/>`
        );
        for (let k = 0; k < vLen; k++) {
          visited.add(coordKey(r + k, c));
        }
      } else if (hLen > 1) {
        const start = center(r, c);
        const end = center(r, c + hLen - 1);
        svgElements.push(
          `<line x1="${start.x.toFixed(3)}" y1="${start.y.toFixed(3)}" x2="${end.x.toFixed(3)}" y2="${end.y.toFixed(3)}" stroke="#000000" stroke-width="${strokeWidth}" stroke-linecap="round"/>`
        );
        for (let k = 0; k < hLen; k++) {
          visited.add(coordKey(r, c + k));
        }
      } else {
        const pt = center(r, c);
        svgElements.push(
          `<circle cx="${pt.x.toFixed(3)}" cy="${pt.y.toFixed(3)}" r="${radius.toFixed(3)}" fill="#000000"/>`
        );
        visited.add(coordKey(r, c));
      }
    }
  }

  const viewBoxSize = totalModules.toFixed(3);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}">`,
    `  <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>`,
    `  ${svgElements.join('\n  ')}`,
    `</svg>`
  ].join('\n');
}

/**
 * Returns a Data URI for direct use in <img src="..."> elements.
 */
export function generateA2DataUri(data: string, options: QrA2Options = {}): string {
  const svg = generateA2Svg(data, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
