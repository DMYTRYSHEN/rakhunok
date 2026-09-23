export type QrFormat = 'png' | 'svg';
export type QrStyle = 'a2';
export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export interface QrParams {
  data: string;
  size: number;
  format: QrFormat;
  style: QrStyle;
  ecc: QrEcc;
}

export interface ValidationSuccess {
  ok: true;
  params: QrParams;
}

export interface ValidationError {
  ok: false;
  status: number;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export interface MatrixResult {
  size: number; // Dimension N of QR code matrix (e.g. 21, 25, 29...)
  isDark: (row: number, col: number) => boolean;
  isFinder: (row: number, col: number) => boolean;
}
