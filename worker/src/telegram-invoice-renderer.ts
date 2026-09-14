import QRCode from 'qrcode/lib/core/qrcode.js';
import {
	TELEGRAM_FONT_SIZE, TELEGRAM_GLYPHS, TELEGRAM_GLYPH_ALPHA_DEFLATE,
	TELEGRAM_LOGO_ALPHA_DEFLATE,
} from '../../src/lib/features/dashboard/public-page/telegram-invoice-art.ts';

export interface TelegramInvoiceRenderData {
	/** Exact decimal UAH amount; no floating-point conversion. */
	amount: string;
	reference: string;
	recipient: string;
	issuedAt: string;
	displayExpiresAt: string;
	/** Caller supplies the shortest VERIFIED absolute checkout URL. Never guess aliases. */
	checkoutUrl: string;
}

const WIDTH = 1000, HEIGHT = 600;
type Color = readonly [number, number, number];
const WHITE: Color = [239, 249, 243], MINT: Color = [111, 235, 181];
const MUTED: Color = [139, 175, 158];

function clean(value: string, limit: number): string {
	if (typeof value !== 'string') throw new Error('Invalid invoice text');
	return value.slice(0, limit).normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ')
		.replace(/\s+/gu, ' ').trim();
}

function printable(value: string): string {
	return Array.from(value, (char) => TELEGRAM_GLYPHS[char] ? char : '?').join('');
}

export function measureInvoiceText(value: string, size: number): number {
	return Array.from(printable(value)).reduce((sum, char) => sum + TELEGRAM_GLYPHS[char][5] * size / TELEGRAM_FONT_SIZE, 0);
}

/** Bounded, word-aware layout; hard-breaks long identifiers and reserves ellipsis. */
export function wrapInvoiceText(value: string, size: number, width: number, maxLines = 2): string[] {
	let remaining = printable(clean(value, 512));
	const lines: string[] = [];
	while (remaining && lines.length < maxLines) {
		if (measureInvoiceText(remaining, size) <= width) { lines.push(remaining); break; }
		const last = lines.length === maxLines - 1;
		let count = 0, used = last ? measureInvoiceText('…', size) : 0;
		for (const char of remaining) {
			const advance = measureInvoiceText(char, size);
			if (used + advance > width) break;
			used += advance; count++;
		}
		if (!count) break;
		const space = remaining.lastIndexOf(' ', count);
		if (!last && space > 0) count = space;
		lines.push(remaining.slice(0, count).trimEnd() + (last ? '…' : ''));
		remaining = remaining.slice(count).trimStart();
	}
	return lines;
}

export function formatInvoiceDate(value: string): string {
	if (typeof value !== 'string' || value.length > 40 ||
		!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new Error('Invalid invoice date');
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) throw new Error('Invalid invoice date');
	const calendarDay = new Date(`${value.slice(0, 10)}T00:00:00Z`);
	if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error('Invalid invoice date');
	return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

async function inflate(encoded: string): Promise<Uint8Array> {
	const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
	return new Uint8Array(await new Response(new Blob([bytes]).stream()
		.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}

function chunk(name: string, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(bytes.length + 12);
	const view = new DataView(out.buffer);
	view.setUint32(0, bytes.length);
	out.set(new TextEncoder().encode(name), 4); out.set(bytes, 8);
	let crc = 0xffffffff;
	for (let i = 4; i < out.length - 4; i++) {
		crc ^= out[i];
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
	return out;
}

/** No fetch, DOM, native modules, WASM, fonts, or cross-request stream/promise caches. */
export async function renderInvoicePng(data: TelegramInvoiceRenderData): Promise<Blob> {
	if (!data || typeof data.amount !== 'string' || !/^(0|[1-9]\d{0,13})\.\d{2}$/.test(data.amount)) throw new Error('Invalid invoice amount');
	const reference = clean(data.reference, 128), recipient = clean(data.recipient, 512);
	if (!reference || !recipient) throw new Error('Missing invoice labels');
	const issued = formatInvoiceDate(data.issuedAt), expires = formatInvoiceDate(data.displayExpiresAt);
	if (typeof data.checkoutUrl !== 'string' || data.checkoutUrl.length > 512 || /[\s\p{Cc}]/u.test(data.checkoutUrl)) throw new Error('Invalid checkout URL');
	const url = new URL(data.checkoutUrl);
	if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash ||
		!/^https?:\/\//.test(data.checkoutUrl)) throw new Error('Invalid checkout URL');
	// Exact caller bytes preserve routing/query semantics. No shortening service.
	const qr = QRCode.create(data.checkoutUrl, { errorCorrectionLevel: 'M' });
	const qrScale = Math.floor(288 / (qr.modules.size + 8));
	if (qrScale < 3) throw new Error('Checkout URL too dense for invoice QR');
	const [atlas, logo] = await Promise.all([inflate(TELEGRAM_GLYPH_ALPHA_DEFLATE), inflate(TELEGRAM_LOGO_ALPHA_DEFLATE)]);
	const stride = WIDTH * 3 + 1, pixels = new Uint8Array(stride * HEIGHT);
	const blend = (x: number, y: number, color: Color, alpha = 1) => {
		if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || alpha <= 0) return;
		const offset = y * stride + 1 + x * 3;
		for (let c = 0; c < 3; c++) pixels[offset + c] = Math.round(pixels[offset + c] * (1 - alpha) + color[c] * alpha);
	};
	for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
		const glow = Math.max(0, 1 - ((x - 840) ** 2 / 900000 + (y - 70) ** 2 / 400000));
		const offset = y * stride + 1 + x * 3;
		pixels[offset] = 7 + 3 * glow; pixels[offset + 1] = 22 + 31 * glow; pixels[offset + 2] = 19 + 18 * glow;
	}
	const rect = (x: number, y: number, w: number, h: number, color: Color, radius = 0) => {
		for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
			const dx = Math.max(x + radius - px - 0.5, 0, px + 0.5 - (x + w - radius));
			const dy = Math.max(y + radius - py - 0.5, 0, py + 0.5 - (y + h - radius));
			blend(px, py, color, radius ? Math.min(1, Math.max(0, radius + 0.5 - Math.hypot(dx, dy))) : 1);
		}
	};
	// Area-sampled alpha outlines: true antialiasing when reducing the 96px atlas.
	const mask = (bytes: Uint8Array, offset: number, w: number, h: number, x: number, y: number, scale: number, color: Color) => {
		for (let py = Math.max(0, Math.floor(y)); py < Math.min(HEIGHT, Math.ceil(y + h * scale)); py++) {
			for (let px = Math.max(0, Math.floor(x)); px < Math.min(WIDTH, Math.ceil(x + w * scale)); px++) {
				const x0 = Math.max(0, (px - x) / scale), x1 = Math.min(w, (px + 1 - x) / scale);
				const y0 = Math.max(0, (py - y) / scale), y1 = Math.min(h, (py + 1 - y) / scale);
				let coverage = 0;
				for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
					coverage += bytes[offset + sy * w + sx] * (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0));
				}
				blend(px, py, color, coverage * scale * scale / 255);
			}
		}
	};
	const text = (value: string, x: number, baseline: number, size: number, color: Color) => {
		const scale = size / TELEGRAM_FONT_SIZE;
		for (const char of printable(value)) {
			const [offset, w, h, left, top, advance] = TELEGRAM_GLYPHS[char];
			mask(atlas, offset, w, h, x + left * scale, baseline + top * scale, scale, color);
			x += advance * scale;
		}
	};
	const right = (value: string, edge: number, baseline: number, size: number, color: Color) => text(value, edge - measureInvoiceText(value, size), baseline, size, color);
	// Restrained hairlines, open spacing and warm mint accents; no fake payment state.
	rect(32, 28, 936, 1, [42, 76, 59]);
	mask(logo, 0, 64, 68, 40, 38, 1, MINT);
	text('rakhunok', 113, 81, 30, WHITE);
	right('ДІЄ ДО', 946, 57, 13, MUTED);
	right(expires, 946, 86, 23, WHITE);
	rect(54, 124, 892, 1, [42, 76, 59]);
	text(wrapInvoiceText(reference, 18, 530, 1)[0] ?? '', 54, 178, 18, MINT);
	text('До сплати', 54, 224, 17, MUTED);
	const [whole, cents] = data.amount.split('.');
	const amount = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${cents}`;
	const amountSize = Math.min(76, 525 / measureInvoiceText(amount, 1));
	text(amount, 50, 312, amountSize, WHITE);
	text('гривень · UAH', 54, 348, 16, MINT);
	rect(54, 384, 530, 1, [42, 76, 59]);
	text('ОТРИМУВАЧ', 54, 417, 12, MUTED);
	wrapInvoiceText(recipient, 24, 530, 2).forEach((line, index) => text(line, 54, 451 + index * 32, 24, WHITE));
	text(`Дата виставлення  ·  ${issued}`, 54, 523, 14, MUTED);
	// White panel includes at least four full quiet modules on every edge.
	rect(626, 153, 320, 320, [255, 255, 255], 20);
	const side = qr.modules.size * qrScale;
	const qx = 626 + Math.floor((320 - side) / 2), qy = 153 + Math.floor((320 - side) / 2);
	for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++) {
		if (qr.modules.data[row * qr.modules.size + col]) rect(qx + col * qrScale, qy + row * qrScale, qrScale, qrScale, [9, 29, 23]);
	}
	const scan = 'Скануйте для оплати';
	text(scan, 786 - measureInvoiceText(scan, 17) / 2, 507, 17, WHITE);
	const host = wrapInvoiceText(url.host, 13, 290, 1)[0] ?? '';
	text(host, 786 - measureInvoiceText(host, 13) / 2, 531, 13, MUTED);
	rect(54, 555, 892, 1, [42, 76, 59]);
	text('Рахунок на оплату', 54, 578, 12, MUTED);
	right('RAKHUNOK', 946, 578, 12, MINT);
	const ihdr = new Uint8Array(13), header = new DataView(ihdr.buffer);
	header.setUint32(0, WIDTH); header.setUint32(4, HEIGHT); ihdr[8] = 8; ihdr[9] = 2;
	const compressed = new Uint8Array(await new Response(new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
	return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())], { type: 'image/png' });
}