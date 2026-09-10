/** Fixed-step simulation: no clocks, browser APIs or random global state. */
export type Lane = 'UL' | 'LL' | 'UR' | 'LR';
export type Mode = 'A' | 'B';
export type Phase = 'ready' | 'running' | 'paused' | 'over';
export const LANES: readonly Lane[] = ['UL', 'LL', 'UR', 'LR'];
export const TRAVEL_STEPS = 6;
export const SPAWN_INTERVAL = 3;
export const STEP_MS = 400;
export const MAX_SCORE = 999999;
export const HIGH_SCORE_KEY = 'rakhunok:egg-game:high-score:v1';
export type Egg = Readonly<{ id: number; lane: Lane; position: number }>;
export type Game = Readonly<{
	mode: Mode;
	phase: Phase;
	basket: Lane;
	eggs: readonly Egg[];
	score: number;
	misses: number;
	tick: number;
	nextId: number;
	seed: number;
}>;

export function activeLanes(mode: Mode): readonly Lane[] {
	return mode === 'A' ? LANES.slice(0, 3) : LANES;
}

export function boundedScore(value: unknown): number {
	if (typeof value !== 'number' && typeof value !== 'string') return 0;
	const score = Number(value);
	return Number.isFinite(score) ? Math.min(MAX_SCORE, Math.max(0, Math.floor(score))) : 0;
}

export function createGame(mode: Mode = 'A', seed = 17): Game {
	return {
		mode, phase: 'ready', basket: 'UL', eggs: [], score: 0, misses: 0,
		tick: 0, nextId: 0, seed: seed >>> 0
	};
}

export function startGame(game: Game): Game {
	return game.phase === 'ready' || game.phase === 'paused'
		? { ...game, phase: 'running' } : game;
}

export function pauseGame(game: Game): Game {
	return game.phase === 'running' ? { ...game, phase: 'paused' } : game;
}

export function moveBasket(game: Game, basket: Lane): Game {
	return game.phase === 'over' ? game : { ...game, basket };
}

export function stepGame(game: Game): Game {
	if (game.phase !== 'running') return game;
	let score = game.score;
	let misses = game.misses;
	const eggs: Egg[] = [];
	for (const egg of game.eggs) {
		const position = egg.position + 1;
		if (position < TRAVEL_STEPS) eggs.push({ ...egg, position });
		else if (egg.lane === game.basket) score = Math.min(MAX_SCORE, score + 1);
		else misses++;
		if (misses >= 3) return { ...game, score, misses: 3, eggs: [], phase: 'over', tick: game.tick + 1 };
	}
	let seed = game.seed;
	let nextId = game.nextId;
	// One spawn every three steps, identical travel time: catch deadlines can never coincide.
	// Even at full speed every change of basket has at least 1.2 seconds of breathing room.
	if (game.tick % SPAWN_INTERVAL === 0) {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		const lanes = activeLanes(game.mode);
		eggs.push({ id: nextId++, lane: lanes[seed % lanes.length], position: 0 });
	}
	return { ...game, eggs, score, misses, seed, nextId, tick: game.tick + 1 };
}