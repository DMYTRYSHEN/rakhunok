import { drawArtwork, type ArtworkName } from './egg-artwork';
import type { Lane } from './egg-game';

type Pose = {
	artwork: ArtworkName;
	/** Native SVG basket opening (not the top of its handle). */
	mouth: { x: number; y: number };
	/** Native body origin: left exports have different canvas padding. */
	body: { x: number; y: number };
};

export const WOLF_SCALE = 0.6;
export const WOLF_POSES: Readonly<Record<Lane, Pose>> = {
	UL: { artwork: 'wolfLeftUp', mouth: { x: 89, y: 73 }, body: { x: 105.45954, y: 6.91798 } },
	LL: { artwork: 'wolfLeftDown', mouth: { x: 117.085, y: 241.08202 }, body: { x: 133.54454, y: 0 } },
	UR: { artwork: 'wolfRightUp', mouth: { x: 314, y: 87 }, body: { x: 0, y: 0 } },
	LR: { artwork: 'wolfRightDown', mouth: { x: 314, y: 262 }, body: { x: 0, y: 0 } }
};

/** One complete supplied pose, uniformly scaled; never mirror or duplicate its basket. */
export function wolfPlacement(lane: Lane, egg: { x: number; y: number }) {
	const pose = WOLF_POSES[lane];
	return { x: egg.x - pose.mouth.x * WOLF_SCALE, y: egg.y + 10 - pose.mouth.y * WOLF_SCALE };
}

export function drawWolf(ctx: CanvasRenderingContext2D, lane: Lane, egg: { x: number; y: number }) {
	const placement = wolfPlacement(lane, egg);
	ctx.save();
	ctx.translate(placement.x, placement.y);
	ctx.scale(WOLF_SCALE, WOLF_SCALE);
	drawArtwork(ctx, WOLF_POSES[lane].artwork);
	ctx.restore();
}