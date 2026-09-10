import { describe, expect, it } from 'vitest';
import {
	activeLanes, boundedScore, createGame, LANES, MAX_SCORE, moveBasket,
	pauseGame, SPAWN_INTERVAL, startGame, stepGame, TRAVEL_STEPS
} from './egg-game';

describe('deterministic egg game', () => {
	it('starts only explicitly; paused and finished games do not advance', () => {
		const ready = createGame();
		expect(stepGame(ready)).toBe(ready);
		const running = stepGame(startGame(ready));
		const paused = pauseGame(running);
		expect(stepGame(paused)).toBe(paused);
		expect(startGame(paused)).toEqual({ ...running, phase: 'running' });
	});
	it('catches at the endpoint only and never mutates its input', () => {
		let game = stepGame(startGame(createGame()));
		const first = game;
		game = moveBasket(game, game.eggs[0].lane);
		for (let i = 0; i < TRAVEL_STEPS - 1; i++) game = stepGame(game);
		expect(game.score).toBe(0);
		game = stepGame(game);
		expect(game.score).toBe(1);
		expect(game.misses).toBe(0);
		expect(first.eggs[0].position).toBe(0);
		expect(game.eggs.some((egg) => egg.id === first.eggs[0].id)).toBe(false);
	});
	it('counts exactly three misses, stops and restarts cleanly', () => {
		let game = startGame(createGame('B'));
		for (let i = 0; i < 100 && game.phase !== 'over'; i++) {
			const due = game.eggs.find((egg) => egg.position === TRAVEL_STEPS - 1);
			if (due) game = moveBasket(game, LANES.find((lane) => lane !== due.lane)!);
			game = stepGame(game);
		}
		expect(game.phase).toBe('over');
		expect(game.misses).toBe(3);
		expect(game.score).toBe(0);
		expect(game.eggs).toEqual([]);
		expect(stepGame(game)).toBe(game);
		expect(startGame(game)).toBe(game);
		expect(moveBasket(game, 'LR')).toBe(game);
		expect(createGame(game.mode)).toEqual(createGame('B'));
	});
	it.each(['A', 'B'] as const)('mode %s is reproducible, fair and indefinitely catchable', (mode) => {
		let game = startGame(createGame(mode));
		let replay = startGame(createGame(mode));
		let previousCatch = -SPAWN_INTERVAL;
		const seen = new Set<string>();
		for (let i = 0; i < 1500; i++) {
			const due = game.eggs.filter((egg) => egg.position === TRAVEL_STEPS - 1);
			expect(due.length).toBeLessThanOrEqual(1);
			if (due.length) {
				expect(i - previousCatch).toBeGreaterThanOrEqual(SPAWN_INTERVAL);
				previousCatch = i;
				game = moveBasket(game, due[0].lane);
				replay = moveBasket(replay, due[0].lane);
			}
			game = stepGame(game);
			replay = stepGame(replay);
			game.eggs.forEach((egg) => seen.add(egg.lane));
			expect(game).toEqual(replay);
		}
		expect([...seen].sort()).toEqual([...activeLanes(mode)].sort());
		expect(game.misses).toBe(0);
		expect(game.score).toBeGreaterThan(400);
	});
	it('allows all four basket positions and caps scores', () => {
		for (const lane of LANES) expect(moveBasket(createGame(), lane).basket).toBe(lane);
		const game = { ...startGame(createGame()), score: MAX_SCORE, eggs: [{ id: 0, lane: 'UL' as const, position: 5 }] };
		expect(stepGame(game).score).toBe(MAX_SCORE);
	});
	it.each([
		[null, 0], [undefined, 0], ['', 0], ['NaN', 0], ['Infinity', 0],
		[Infinity, 0], [-5, 0], ['42.9', 42], [1e20, MAX_SCORE], [{}, 0]
	])('bounds persisted high score %s to %s', (input, expected) => {
		expect(boundedScore(input)).toBe(expected);
	});
});