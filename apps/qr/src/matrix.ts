import qrcode from 'qrcode';
import type { MatrixResult, QrEcc } from './types.js';

export function generateQrMatrix(data: string, ecc: QrEcc): MatrixResult {
  const qr = qrcode.create(data, {
    errorCorrectionLevel: ecc
  });

  const matrixSize = qr.modules.size;
  const dataArray = qr.modules.data; // Uint8Array of length matrixSize * matrixSize

  const isDark = (row: number, col: number): boolean => {
    if (row < 0 || row >= matrixSize || col < 0 || col >= matrixSize) return false;
    return dataArray[row * matrixSize + col] === 1;
  };

  // Standard QR Finder patterns are located at:
  // Top-left: rows [0..6], cols [0..6] (with separator border extending to [0..7], [0..7])
  // Top-right: rows [0..6], cols [matrixSize-7..matrixSize-1] (separator border extending to [0..7], [matrixSize-8..matrixSize-1])
  // Bottom-left: rows [matrixSize-7..matrixSize-1], cols [0..6] (separator border extending to [matrixSize-8..matrixSize-1], [0..7])
  // We classify the 7x7 core + 1 module separator zone (8x8) as the reserved finder area
  const isFinder = (row: number, col: number): boolean => {
    // Top-Left (including separator 8x8)
    if (row < 8 && col < 8) return true;
    // Top-Right (including separator 8x8)
    if (row < 8 && col >= matrixSize - 8) return true;
    // Bottom-Left (including separator 8x8)
    if (row >= matrixSize - 8 && col < 8) return true;
    return false;
  };

  return {
    size: matrixSize,
    isDark,
    isFinder
  };
}
