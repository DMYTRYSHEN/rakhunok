<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { Volume2, VolumeX, RotateCcw, Footprints } from '@lucide/svelte';
	import logoUrl from '../../../../logo.svg?url';
	import '../../../../apps/pay/src/fonts.css';
	import { statusCopy } from './status-copy';
	import { createEggAudio } from './egg-audio';
	import { drawDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './egg-display';
	import {
		boundedScore, createGame, HIGH_SCORE_KEY, moveBasket,
		pauseGame, startGame, stepGame, STEP_MS, TRAVEL_STEPS,
		type Game, type Lane, type Mode
	} from './egg-game';

	let { status = 500 }: { status?: number } = $props();
	const copy = $derived(statusCopy(status));
	let game = $state<Game>(createGame());
	let manual = $state(true);
	let ready = $state(false);
	let high = $state(0);
	let sound = $state(true);
	let soundPending = $state(false);
	let audio: ReturnType<typeof createEggAudio> | undefined;
	let audioGeneration = 0;
	async function enableSound() {
		if (soundPending) return;
		const generation = ++audioGeneration;
		soundPending = true;
		const candidate = audio ??= createEggAudio();
		const enabled = await candidate.enable();
		if (generation !== audioGeneration) return;
		soundPending = false;
		sound = enabled;
		if (enabled) {
			if (!document.hidden && game.phase === 'running') candidate.play('tick');
		} else { candidate.destroy(); audio = undefined; }
	}
	function toggleSound() {
		if (sound || soundPending) {
			audioGeneration++;
			sound = false;
			soundPending = false;
			audio?.destroy();
			audio = undefined;
		} else {
			sound = true;
			void enableSound();
		}
	}
	const directions: { lane: Lane; key: string; name: string; arrow: string }[] = [
		{ lane: 'UL', key: 'Q', name: 'Ліворуч угорі', arrow: '↖' },
		{ lane: 'UR', key: 'E', name: 'Праворуч угорі', arrow: '↗' },
		{ lane: 'LL', key: 'A', name: 'Ліворуч унизу', arrow: '↙' },
		{ lane: 'LR', key: 'D', name: 'Праворуч унизу', arrow: '↘' }
	];
	const phaseText = $derived(
		game.phase === 'over' ? 'Гру завершено — три промахи.' :
		game.phase === 'paused' ? 'Пауза. Продовжіть, коли будете готові.' :
		game.phase === 'running' ? (manual ? 'Ваш хід. Оберіть кошик і натисніть «Крок».' : 'Ловіть яйця до падіння.') :
		'Готові? Почніть, коли забажаєте.'
	);
	const basketText = $derived(directions.find((direction) => direction.lane === game.basket)!.name);
	const eggText = $derived(game.eggs.map((egg) =>
		`${directions.find((direction) => direction.lane === egg.lane)!.name}: ${TRAVEL_STEPS - egg.position} кроків до кошика`
	).join('; ') || 'На доріжках немає яєць.');
	// Imperative scheduler is installed once, not restarted by score/basket/render effects.
	let syncClock = () => {};

	function advance() {
		const previous = game;
		game = stepGame(game);
		if (sound && game !== previous && !document.hidden) {
			audio?.play(game.phase === 'over' ? 'over' : game.misses > previous.misses ? 'miss' : game.score > previous.score ? 'catch' : 'tick');
		}
		if (game.score > high) {
			high = game.score;
			try { localStorage.setItem(HIGH_SCORE_KEY, String(high)); } catch { /* Storage is optional. */ }
		}
	}
	function togglePlay() {
		game = game.phase === 'running' ? pauseGame(game) : startGame(game);
		if (game.phase === 'running' && sound) void enableSound();
		if (game.phase !== 'running') audio?.silence();
		syncClock();
	}
	function restart(mode: Mode = game.mode) {
		audio?.silence();
		game = createGame(mode);
		syncClock();
	}
	function toggleManual() {
		audio?.silence();
		manual = !manual;
		game = pauseGame(game);
		syncClock();
	}
	function choose(lane: Lane) { game = moveBasket(game, lane); }

	function keyboardScope(node: HTMLElement) {
		function keydown(event: KeyboardEvent) {
			if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
			if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
			const direction = directions.find((item) => `Key${item.key}` === event.code);
			if (!direction) return;
			event.preventDefault();
			choose(direction.lane);
		}
		node.addEventListener('keydown', keydown);
		return () => node.removeEventListener('keydown', keydown);
	}

	onMount(() => {
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		manual = motion.matches;
		try { high = boundedScore(localStorage.getItem(HIGH_SCORE_KEY)); } catch { /* Private mode. */ }
		ready = true;
		let frame = 0;
		let last: number | undefined;
		let accumulator = 0;
		function stop() {
			cancelAnimationFrame(frame);
			frame = 0;
			last = undefined;
			accumulator = 0;
		}
		function tick(now: number) {
			frame = 0;
			if (document.hidden || manual || game.phase !== 'running') { stop(); return; }
			if (last !== undefined) accumulator += Math.min(now - last, 100);
			last = now;
			if (accumulator >= STEP_MS) { accumulator -= STEP_MS; advance(); }
			if (game.phase === 'running') frame = requestAnimationFrame(tick);
			else stop();
		}
		syncClock = () => {
			stop();
			if (!document.hidden && !manual && game.phase === 'running') frame = requestAnimationFrame(tick);
		};
		function visibility() {
			if (document.hidden) { game = pauseGame(game); audio?.silence(); }
			syncClock();
		}
		function preference() {
			if (motion.matches) { manual = true; game = pauseGame(game); audio?.silence(); syncClock(); }
		}
		document.addEventListener('visibilitychange', visibility);
		motion.addEventListener('change', preference);
		return () => {
			audioGeneration++;
			audio?.destroy();
			audio = undefined;
			stop();
			syncClock = () => {};
			document.removeEventListener('visibilitychange', visibility);
			motion.removeEventListener('change', preference);
		};
	});

	function board(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const context = ctx;
		function draw() {
			drawDisplay(context, game);
		}
		function resize() {
			const box = canvas.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.round(box.width * dpr));
			canvas.height = Math.max(1, Math.round(box.height * dpr));
			context.setTransform(canvas.width / DISPLAY_WIDTH, 0, 0, canvas.height / DISPLAY_HEIGHT, 0, 0);
			draw();
		}
		function pointer(event: PointerEvent) {
			const hover = event.type === 'pointermove';
			if (hover ? event.pointerType !== 'mouse' || event.buttons !== 0 : event.button !== 0) return;
			if (!ready || game.phase === 'over') return;
			if (!hover) event.preventDefault();
			const box = canvas.getBoundingClientRect();
			const left = event.clientX - box.left < box.width / 2;
			const top = event.clientY - box.top < box.height / 2;
			const lane: Lane = left ? (top ? 'UL' : 'LL') : (top ? 'UR' : 'LR');
			if (game.basket !== lane) choose(lane);
			if (!hover) canvas.closest('section')?.querySelector<HTMLButtonElement>(`[data-lane="${lane}"]`)?.focus({ preventScroll: true });
		}
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		canvas.addEventListener('pointerdown', pointer);
		canvas.addEventListener('pointermove', pointer);
		untrack(resize);
		// This effect only paints. It never starts or resets the animation clock.
		$effect(draw);
		return () => { observer.disconnect(); canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('pointermove', pointer); };
	}
</script>

<svelte:head>
	<title>{copy.status} — {copy.title} · Рахунок</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="fault" lang="uk">
	<header><a class="brand" href={resolve('/')} aria-label="Рахунок — головна" data-sveltekit-reload><img src={logoUrl} alt="Рахунок" width="42" height="45" /></a><span class="code">HTTP {copy.status}</span></header>
	<div class="content">
		<section class="message" aria-labelledby="fault-title">
			<p class="eyebrow">НЕ ТУДИ ЗВЕРНУЛИ</p>
			<p class="number" aria-hidden="true">{copy.status}<span>.</span></p>
			<h1 id="fault-title">{copy.title}</h1>
			<p class="description">{copy.description}</p>
			<nav aria-label="Дії зі сторінкою">
				<a class="home" href={resolve('/')} data-sveltekit-reload>На головну <span aria-hidden="true">↗</span></a>
				<button type="button" onclick={() => window.location.reload()}>Спробувати ще раз</button>
			</nav>
			<p class="manual-note">Повторна спроба — лише за вашим натисканням.</p>
		</section>
		<section class="game" aria-labelledby="game-title" aria-describedby="game-instructions" {@attach keyboardScope} data-ready={ready} data-phase={game.phase} data-tick={game.tick} data-basket={game.basket}>
			<div class="game-heading"><h2 id="game-title">Поки ви тут — ловіть яйця.</h2><span>01 / ПАУЗА</span></div>
			<div class="console">
				<div class="console-caption" lang="ru">ГРА НА ЕКРАНІ</div>
				<span class="model" aria-hidden="true">ИМ–02</span>
			<div class="screen">
				<canvas aria-hidden="true" {@attach board}></canvas>
			</div>
			<div class="console-brand" lang="ru"><span aria-hidden="true">⌁</span> ЕЛЕКТРОНІКА</div>
			<div class="hardware-controls">
			<fieldset class="modes" disabled={!ready || game.phase === 'running' || game.phase === 'paused'}>
				<legend class="visually-hidden">Режим гри</legend>
				<button type="button" aria-label="A · 3 доріжки" aria-pressed={game.mode === 'A'} onclick={() => restart('A')}>A</button>
				<button type="button" aria-label="B · 4 доріжки" aria-pressed={game.mode === 'B'} onclick={() => restart('B')}>B</button>
			</fieldset>
			<button type="button" class="hardware-pause" aria-label={game.phase === 'running' ? 'Пауза' : game.phase === 'paused' ? 'Продовжити' : 'Почати гру'} disabled={!ready || game.phase === 'over'} onclick={togglePlay}><span aria-hidden="true">Ⅱ</span></button>
			</div>
			<div class="directions" role="group" aria-label="Положення кошика">
				{#each directions as direction (direction.lane)}
					<button type="button" data-lane={direction.lane} aria-label={`${direction.name} · ${direction.key}`} aria-pressed={game.basket === direction.lane} disabled={!ready || game.phase === 'over'} onclick={() => choose(direction.lane)}><span aria-hidden="true">{direction.arrow}</span><kbd>{direction.key}</kbd></button>
				{/each}
			</div>
			</div>
			<div class="scoreboard">
				<span>РАХУНОК <strong data-testid="score">{game.score}</strong></span>
				<span>РЕКОРД <strong data-testid="high-score">{high}</strong></span>
				<span>ПРОМАХИ <strong data-testid="misses">{game.misses} / 3</strong></span>
			</div>
			<div class="play-controls">
				<button type="button" class="primary" aria-label={game.phase === 'running' ? 'Призупинити гру' : game.phase === 'paused' ? 'Відновити гру' : 'Запустити гру'} disabled={!ready || game.phase === 'over'} onclick={togglePlay}>{game.phase === 'running' ? 'Пауза' : game.phase === 'paused' ? 'Продовжити' : 'Почати гру'}</button>
				<button type="button" class="icon-control" aria-label="Почати заново" title="Почати заново" disabled={!ready} onclick={() => restart()}><RotateCcw size={19} aria-hidden="true" /></button>
				<button type="button" class="icon-control" aria-label="Покроково" title="Покроково" aria-pressed={manual} disabled={!ready} onclick={toggleManual}><Footprints size={19} aria-hidden="true" /></button>
				{#if manual}<button type="button" disabled={game.phase !== 'running'} onclick={advance}>Крок</button>{/if}
				<button type="button" class="icon-control sound-control" aria-label="Звук" title={soundPending ? 'Скасувати ввімкнення звуку' : sound ? 'Вимкнути звук' : 'Увімкнути звук'} aria-pressed={sound} aria-busy={soundPending} disabled={!ready} onclick={toggleSound}>{#if sound}<Volume2 size={20} aria-hidden="true" />{:else}<VolumeX size={20} aria-hidden="true" />{/if}</button>
			</div>
			<p class="game-status" role="status">{phaseText} Рахунок: {game.score}. Промахи: {game.misses} / 3.</p>
			<p class="sr-only" aria-live={manual ? 'polite' : 'off'}>Кошик: {basketText}. {eggText}</p>
			<p id="game-instructions" class="sr-only">Керуйте кошиком мишею, дотиком або клавішами Q, A, E, D у грі. Три промахи завершують гру. У покроковому режимі натискайте «Крок».</p>
		</section>
	</div>
	<footer><span>МОЖНА ТРОХИ ПЕРЕПОЧИТИ</span><span>Навігація доступна незалежно від гри.</span></footer>
</main>

<style>
	.fault { box-sizing: border-box; min-height: 100svh; padding: clamp(16px, 4vw, 56px); background: #f6f4ed; color: #292e25; font-family: 'Manrope', sans-serif; color-scheme: light; display: flex; flex-direction: column; }
	header, footer, .game-heading { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
	header { padding-bottom: 22px; border-bottom: 1px solid #d6d7c9; }
	.code, .eyebrow, footer, .scoreboard, .game-heading > span { font-family: 'Manrope', sans-serif; }
	.brand { color: inherit; text-decoration: none; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; }
	.brand img { display: block; object-fit: contain; }
	.code { font-size: 12px; white-space: nowrap; }
	.content { width: 100%; max-width: 1200px; margin: auto; padding: 48px 0; display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(28px, 5vw, 72px); align-items: center; }
	.message, .game { min-width: 0; }
	.eyebrow { color: #656e46; font-size: 11px; letter-spacing: 0.15em; }
	.number { margin: 20px 0; font-size: clamp(88px, 12vw, 160px); line-height: 0.95; font-weight: 700; letter-spacing: -0.08em; }
	.number span { color: #798454; }
	h1 { margin: 28px 0 16px; font-size: clamp(26px, 3vw, 40px); line-height: 1.12; letter-spacing: -0.03em; }
	.description { color: #5b6153; max-width: 42ch; font-size: 16px; line-height: 1.65; }
	nav, .play-controls, .modes { display: flex; flex-wrap: wrap; gap: 8px; }
	nav { margin-top: 28px; }
	button, .home { box-sizing: border-box; min-height: 44px; padding: 10px 12px; border: 1px solid #b2b7a0; border-radius: 6px; background: transparent; color: #292e25; font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; }
	.home, button.primary { background: #3d4931; color: #fffef6; border-color: #3d4931; }
	.home { display: inline-flex; gap: 20px; align-items: center; }
	button:hover:not(:disabled) { background: #e1e5d3; color: #292e25; }
	.home:hover { background: #52613f; }
	button[aria-pressed='true'] { background: #e1e5d3; border-color: #56613e; box-shadow: inset 0 0 0 1px #56613e; }
	.fault :is(a, button):focus-visible { outline: 3px solid #52613f; outline-offset: 3px; }
	button:disabled { opacity: 0.5; cursor: default; }
	.manual-note { font-size: 12px; color: #5b6153; line-height: 1.55; }
	.icon-control { display: inline-flex; align-items: center; justify-content: center; width: 44px; padding: 10px; flex-shrink: 0; }
	.sound-control { margin-left: auto; }
	.game-heading { margin-bottom: 16px; }
	h2 { margin: 0; font-size: 18px; font-weight: 500; letter-spacing: -0.03em; }
	.game-heading > span { font-size: 10px; white-space: nowrap; color: #646a58; }
	.console { position: relative; container-type: inline-size; isolation: isolate; padding: 9% 14% 10%; border: 1px solid #b7ad95; border-radius: 7% / 12%; background: linear-gradient(165deg, #f0e8d5, #dbcfb4 70%, #c8bba0); box-shadow: inset 0 2px 2px #fff9e9, inset 0 -5px 2px #b1a58d, 0 10px 0 -4px #a69c87, 0 16px 24px -10px #514a3f55; }
	.console::before { content: ''; position: absolute; inset: 5px; border: 1px solid #fff8df66; border-radius: inherit; pointer-events: none; }
	.console-caption, .console-brand { position: absolute; left: 14%; right: 14%; text-align: center; font-weight: 700; color: #34332e; }
	.console-caption { top: 6%; font-size: clamp(8px, 2.1cqi, 15px); letter-spacing: .19em; }
	.console-brand { bottom: 6%; font-size: clamp(10px, 3cqi, 21px); letter-spacing: .12em; }
	.console-brand span { font-size: 1.4em; vertical-align: -.06em; }
	.model { position: absolute; left: 3%; top: 8%; font: bold clamp(7px, 1.7cqi, 11px) monospace; color: #6d6556; }
	.screen { position: relative; background: linear-gradient(120deg, #aeb497, #a0a78a 65%, #959e80); border: clamp(3px, .9cqi, 7px) solid #292b26; border-radius: 5px; padding: 3px; outline: 2px solid #30312b; outline-offset: 4px; box-shadow: inset 2px 3px 8px #333c2866, 0 0 0 4px #d2c6aa, 0 4px 8px #3d352655; overflow: hidden; }
	.screen::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, #ffffe512, transparent 45%); }
	.scoreboard { display: flex; justify-content: space-between; gap: 8px; padding: 22px 0 14px; font-size: 10px; color: #51583c; }
	.scoreboard strong { margin-left: 4px; font-size: 15px; color: #343a27; }
	canvas { display: block; width: 100%; aspect-ratio: 640 / 380; touch-action: pan-y; }
	.hardware-controls { position: absolute; right: 1.8%; top: 6%; width: 9%; display: grid; }
	.modes { display: grid; gap: 0; border: 0; padding: 0; margin: 0; min-width: 0; }
	.hardware-controls button { position: relative; display: flex; align-items: center; justify-content: flex-end; padding: 0 3px; width: 100%; min-height: 24px; height: 5cqi; border: 0; border-radius: 0; background: transparent; box-shadow: none; font: bold clamp(8px, 2cqi, 13px) monospace; }
	.hardware-controls button::before { content: ''; position: absolute; left: 4%; width: 38%; height: 35%; border-radius: 50%; background: #494941; box-shadow: inset 0 1px 1px #77786a, 0 1px 2px #615943; }
	.hardware-controls button[aria-pressed='true']::before { background: #a83930; }
	.directions button { position: absolute; display: grid; place-items: center; padding: 0; width: 10%; aspect-ratio: 1; min-height: 0; border-radius: 50%; border: 2px solid #97382e; background: radial-gradient(circle at 35% 28%, #e76451, #c34233 65%, #a43028); color: #7f2822; box-shadow: 0 0 0 3px #b9ad9255, 0 3px 2px #8b392d, inset 0 2px 2px #ff9d7666; }
	.directions button:hover:not(:disabled) { background: radial-gradient(circle at 35% 28%, #f87861, #ca4837 70%); color: #65231e; }
	.directions button[aria-pressed='true'] { background: radial-gradient(circle at 60% 70%, #cc4938, #a83329); box-shadow: 0 0 0 3px #b9ad9255, inset 0 2px 4px #67241e; }
	.directions button:disabled { opacity: .7; }
	.directions [data-lane='UL'] { left: 1.6%; top: 36%; }
	.directions [data-lane='LL'] { left: 1.6%; top: 66%; }
	.directions [data-lane='UR'] { right: 1.6%; top: 36%; }
	.directions [data-lane='LR'] { right: 1.6%; top: 66%; }
	.directions button > span { font-size: clamp(11px, 3.2cqi, 23px); }
	kbd { position: absolute; bottom: -45%; color: #655c4d; font-family: monospace; font-size: clamp(8px, 1.8cqi, 12px); font-weight: 700; }
	.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.game-status { font-size: 13px; line-height: 1.5; min-height: 3em; margin-bottom: 8px; }
	footer { padding-top: 20px; border-top: 1px solid #d6d7c9; color: #646a58; font-size: 10px; line-height: 1.6; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	@media (max-width: 760px) {
		.content { grid-template-columns: 1fr; padding: 30px 0; gap: 32px; }
		.number { font-size: 88px; }
		h1 { margin-top: 20px; }
		footer { flex-wrap: wrap; }
	}
	@media (max-width: 360px) {
		.game-heading > span { display: none; }
		.scoreboard { font-size: 9px; }
		.scoreboard strong { font-size: 12px; }
		.hardware-controls { top: 2%; }
		.hardware-controls button { min-height: 18px; }
	}
	/* Phone landscape: fill the visible viewport without gesture-gated Fullscreen API. */
	@media (orientation: landscape) and (max-height: 600px) and (hover: none) and (pointer: coarse) {
		.fault { position: fixed; inset: 0; z-index: 100; height: 100dvh; min-height: 0; padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); overflow: hidden; background: #dbcfb4; }
		header, footer, .message, .game-heading, .scoreboard, .game-status { display: none; }
		.content { display: block; max-width: none; height: 100%; min-height: 0; margin: 0; padding: 0; }
		.game { height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) 44px; gap: 4px; }
		.console { min-height: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; background: transparent; display: flex; align-items: center; justify-content: center; }
		.console::before, .console-caption, .console-brand, .model { display: none; }
		.screen { box-sizing: border-box; height: calc(100% - 12px); width: auto; max-width: 72%; aspect-ratio: 640 / 380; padding: 0; border-width: 3px; outline-offset: 2px; }
		canvas { width: 100%; height: 100%; }
		.hardware-controls { top: 2%; right: 2%; width: 10%; }
		.hardware-controls button { min-height: 24px; height: 24px; }
		.directions button { width: clamp(44px, 8vw, 64px); }
		.directions [data-lane='UL'], .directions [data-lane='UR'] { top: 35%; }
		.directions [data-lane='LL'], .directions [data-lane='LR'] { top: 68%; }
		kbd { display: none; }
		.play-controls { flex-wrap: nowrap; justify-content: center; align-items: center; gap: 8px; padding: 0 12px; }
		.sound-control { margin-left: 12px; }
	}
</style>