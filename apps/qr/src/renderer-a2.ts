import type { MatrixResult, QrParams } from './types.js';

/**
 * Renders an A2-style QR code SVG string from matrix and parameters.
 * Specification:
 * - Pure black (#000000) modules on opaque white (#FFFFFF) background
 * - Margin: N/5 modules per side, where N is matrix.size
 * - Stroke width: 0.6 modules, stroke-linecap="round"
 * - Priority: Vertical segments up to 4 modules, then horizontal segments up to 4 modules
 * - Single unconnected modules: circles with radius = 0.3 modules
 * - Three finder patterns:
 *   - Outer 7x7 module rounded square with rounded corners
 *   - Inner 3x3 module circular dot
 * - 100% deterministic (no Math.random(), stable row-major traversal)
 */
export function renderA2Svg(matrix: MatrixResult, params: QrParams): string {
  const n = matrix.size;
  const marginModules = n / 5;
  const totalModules = n + 2 * marginModules;

  // Let coordinate system be in module units:
  // (0, 0) to (totalModules, totalModules)
  // Top-left of the QR matrix begins at (marginModules, marginModules).
  const strokeWidth = 0.6;
  const radius = strokeWidth / 2; // 0.3 module

  // Track visited data modules to prevent overlapping line generation
  const visited = new Set<string>();
  const coordKey = (r: number, c: number) => `${r},${c}`;

  const svgElements: string[] = [];

  // Helper to convert matrix module coords (row, col) to center coordinates in SVG space
  const center = (r: number, c: number) => ({
    x: marginModules + c + 0.5,
    y: marginModules + r + 0.5
  });

  // 1. Render Finder Patterns
  // 3 locations for standard 7x7 finder patterns: (0, 0), (0, n-7), (n-7, 0)
  const finderOrigins = [
    { r: 0, c: 0 },
    { r: 0, c: n - 7 },
    { r: n - 7, c: 0 }
  ];

  for (const origin of finderOrigins) {
    const ox = marginModules + origin.c;
    const oy = marginModules + origin.r;

    // Outer frame of finder:
    // Outer square is 7x7 modules.
    // The black border is 1 module thick, centered from 0.5 to 6.5.
    // Dimensions of stroke center: x = ox + 0.5, y = oy + 0.5, width = 6, height = 6.
    // Stroke width = 1 module. Corner radius = 2.0 modules for classic A2 rounded look.
    svgElements.push(
      `<rect x="${(ox + 0.5).toFixed(3)}" y="${(oy + 0.5).toFixed(3)}" width="6" height="6" rx="2" ry="2" fill="none" stroke="#000000" stroke-width="1"/>`
    );

    // Inner circle of finder:
    // Centered at ox + 3.5, oy + 3.5.
    // Diameter is 3 modules (radius = 1.5 modules).
    svgElements.push(
      `<circle cx="${(ox + 3.5).toFixed(3)}" cy="${(oy + 3.5).toFixed(3)}" r="1.5" fill="#000000"/>`
    );
  }

  // 2. Traverse matrix row-major to generate Interlock segments
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix.isFinder(r, c)) continue;
      if (!matrix.isDark(r, c)) continue;
      if (visited.has(coordKey(r, c))) continue;

      // Check vertical chain length downward (up to 4 modules)
      let vLen = 1;
      while (
        vLen < 4 &&
        r + vLen < n &&
        !matrix.isFinder(r + vLen, c) &&
        matrix.isDark(r + vLen, c) &&
        !visited.has(coordKey(r + vLen, c))
      ) {
        vLen++;
      }

      // Check horizontal chain length rightward (up to 4 modules)
      let hLen = 1;
      while (
        hLen < 4 &&
        c + hLen < n &&
        !matrix.isFinder(r, c + hLen) &&
        matrix.isDark(r, c + hLen) &&
        !visited.has(coordKey(r, c + hLen))
      ) {
        hLen++;
      }

      // Priority rule: Vertical connections first if vLen > 1, then horizontal if hLen > 1
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
        // Single isolated module: rounded dot
        const pt = center(r, c);
        svgElements.push(
          `<circle cx="${pt.x.toFixed(3)}" cy="${pt.y.toFixed(3)}" r="${radius.toFixed(3)}" fill="#000000"/>`
        );
        visited.add(coordKey(r, c));
      }
    }
  }

  const dim = params.size;
  const viewBoxSize = totalModules.toFixed(3);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${dim}" height="${dim}">`,
    `  <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>`,
    `  ${svgElements.join('\n  ')}`,
    `</svg>`
  ].join('\n');
}
