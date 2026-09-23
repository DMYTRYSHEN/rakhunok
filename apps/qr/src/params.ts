import type { QrParams, ValidationResult, QrEcc, QrFormat, QrStyle } from './types.js';

const MIN_SIZE = 128;
const MAX_SIZE = 2048;
const DEFAULT_SIZE = 240;
const MAX_DATA_BYTES = 4096;

export function parseQueryParams(url: URL): ValidationResult {
  // data is required
  const data = url.searchParams.get('data');
  if (data === null || data === '') {
    return {
      ok: false,
      status: 400,
      error: 'Missing required parameter: "data"'
    };
  }

  // UTF-8 payload length limit
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  if (dataBytes.length > MAX_DATA_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Payload too large: maximum is ${MAX_DATA_BYTES} bytes`
    };
  }

  // size parameter: "240x240" or single integer "240"
  let size = DEFAULT_SIZE;
  const sizeParam = url.searchParams.get('size');
  if (sizeParam !== null && sizeParam !== '') {
    const match = sizeParam.trim().toLowerCase().match(/^(\d+)(?:x(\d+))?$/);
    if (!match) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid size parameter format. Expected "NxN" (e.g. 240x240)'
      };
    }

    const width = parseInt(match[1], 10);
    const height = match[2] ? parseInt(match[2], 10) : width;

    if (width !== height) {
      return {
        ok: false,
        status: 400,
        error: `Square aspect ratio required: received ${width}x${height}`
      };
    }

    if (width < MIN_SIZE || width > MAX_SIZE) {
      return {
        ok: false,
        status: 400,
        error: `Size out of range: must be between ${MIN_SIZE} and ${MAX_SIZE}`
      };
    }

    size = width;
  }

  // format parameter: "png" | "svg"
  let format: QrFormat = 'png';
  const formatParam = url.searchParams.get('format');
  if (formatParam !== null && formatParam !== '') {
    const normalized = formatParam.trim().toLowerCase();
    if (normalized === 'png' || normalized === 'svg') {
      format = normalized;
    } else {
      return {
        ok: false,
        status: 400,
        error: `Unsupported format "${formatParam}". Supported formats: png, svg`
      };
    }
  }

  // style parameter: "a2"
  let style: QrStyle = 'a2';
  const styleParam = url.searchParams.get('style');
  if (styleParam !== null && styleParam !== '') {
    const normalized = styleParam.trim().toLowerCase();
    if (normalized === 'a2') {
      style = normalized;
    } else {
      return {
        ok: false,
        status: 400,
        error: `Unsupported style "${styleParam}". Supported style: a2`
      };
    }
  }

  // ecc parameter: "L" | "M" | "Q" | "H"
  let ecc: QrEcc = 'M';
  const eccParam = url.searchParams.get('ecc');
  if (eccParam !== null && eccParam !== '') {
    const normalized = eccParam.trim().toUpperCase();
    if (normalized === 'L' || normalized === 'M' || normalized === 'Q' || normalized === 'H') {
      ecc = normalized as QrEcc;
    } else {
      return {
        ok: false,
        status: 400,
        error: `Invalid ECC level "${eccParam}". Supported levels: L, M, Q, H`
      };
    }
  }

  const params: QrParams = {
    data,
    size,
    format,
    style,
    ecc
  };

  return {
    ok: true,
    params
  };
}
