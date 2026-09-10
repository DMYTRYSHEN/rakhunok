import { activeLanes, LANES, TRAVEL_STEPS, type Game, type Lane } from './egg-game';
import { drawArtwork } from './egg-artwork';
import { drawWolf } from './egg-wolf';

export const DISPLAY_WIDTH = 640;
export const DISPLAY_HEIGHT = 380;
const ink = '#30372c';
const ghost = '#858970';

/** The final egg segment sits immediately above the basket mouth; next step catches. */
export function lanePoint(lane: Lane, position: number) {
	const left = lane === 'UL' || lane === 'LL';
	const upper = lane === 'UL' || lane === 'UR';
	const progress = position / (TRAVEL_STEPS - 1);
	return { x: left ? 100 + progress * 133 : 540 - progress * 133, y: (upper ? 119 : 224) + progress * 57 };
}

/** Layout and dynamic LCD state; characters and props live in artwork/*.svg. */
export function drawDisplay(ctx: CanvasRenderingContext2D, game: Game) {
	ctx.clearRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	function path(d: string, fill = true, width = 2) {
		const p = new Path2D(d);
		ctx.lineWidth = width;
		if (fill) ctx.fill(p); else ctx.stroke(p);
	}
	function color(value: string) { ctx.fillStyle = value; ctx.strokeStyle = value; }
	drawArtwork(ctx, 'window');
	drawArtwork(ctx, 'hare');
	// Four digits normally; retain the engine's full six-digit score without wrapping.
	const segments = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
	const bars = [
		'M6 0 H26 L30 4 L26 8 H6 L2 4 Z', 'M28 7 L32 4 V26 L28 30 L24 26 V11 Z',
		'M28 33 L32 37 V59 L28 63 L24 59 V37 Z', 'M6 60 H24 L28 64 L24 68 H6 L2 64 Z',
		'M0 37 L4 33 L8 37 V59 L4 63 L0 59 Z', 'M0 8 L4 4 L8 8 V26 L4 30 L0 26 Z',
		'M7 30 H25 L29 34 L25 38 H7 L3 34 Z'
	];
	const digits = String(game.score).padStart(4, '0');
	const digitScale = 4 / digits.length;
	for (let n = 0; n < digits.length; n++) {
		ctx.save(); ctx.translate(245 + n * 39 * digitScale, 15); ctx.scale(digitScale, 1); ctx.transform(1, 0, -.075, 1, 0, 0);
		bars.forEach((bar, index) => { color(segments[Number(digits[n])][index] === '1' ? ink : ghost); path(bar); });
		ctx.restore();
	}
	color(ink); ctx.font = '12px monospace'; ctx.fillText(`ГРА ${game.mode} НУ ПОСТРИВАЙ`, 430, 35);
	ctx.font = 'bold 11px monospace'; ctx.fillText('BOBR KURWA!', 449, 65);
	function chick(x: number, y: number, active: boolean) {
		ctx.save(); ctx.translate(x, y);
		drawArtwork(ctx, 'chick', !active);
		ctx.restore();
	}
	for (let i = 0; i < 3; i++) chick(454 + i * 29, 92, game.misses > i);
	function hen(lane: Lane) {
		const left = lane === 'UL' || lane === 'LL';
		const upper = lane === 'UL' || lane === 'UR';
		ctx.save(); ctx.translate(left ? 53 : 587, upper ? 116 : 221); ctx.scale(left ? 1 : -1, 1);
		drawArtwork(ctx, 'hen');
		ctx.restore();
	}
	for (const lane of LANES) {
		hen(lane);
		const first = lanePoint(lane, 0), end = lanePoint(lane, TRAVEL_STEPS - 1);
		color(ink);
		path(`M${first.x - (first.x < 320 ? 21 : -21)} ${first.y + 2} L${end.x} ${end.y + 15} M${first.x} ${first.y + 16} L${end.x} ${end.y + 25}`, false, 2.5);
		for (let i = 0; i < TRAVEL_STEPS; i++) {
			const p = lanePoint(lane, i);
			color(ink); path(`M${p.x} ${p.y + 12} v10`, false, 1.5);
			ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.x < 320 ? -.65 : .65);
			drawArtwork(ctx, 'egg', true); ctx.restore();
		}
		if (!activeLanes(game.mode).includes(lane)) {
			color(ghost); ctx.font = '10px monospace'; ctx.fillText('B', first.x, first.y + 40);
		}
	}
	// Each supplied SVG already includes the wolf, arms and basket.
	drawWolf(ctx, game.basket, lanePoint(game.basket, TRAVEL_STEPS - 1));
	for (const egg of game.eggs) {
		const p = lanePoint(egg.lane, egg.position);
		ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.x < 320 ? 1 : -1) * (egg.position * .65 - .65));
		drawArtwork(ctx, 'egg'); ctx.restore();
	}
	drawArtwork(ctx, 'grass');
	for (const x of [211, 429]) {
		ctx.save(); ctx.translate(x, 331);
		drawArtwork(ctx, 'shell', !game.misses); ctx.restore();
	}
	color(ink); ctx.font = '10px monospace'; ctx.textAlign = 'center';
	ctx.fillText(game.phase === 'paused' ? 'ПАУЗА' : game.phase === 'over' ? 'КОНЕЦ ИГРЫ' : 'ИМ–02', 320, 370);
	ctx.textAlign = 'start';
}