<script lang="ts">
	import {
		AlertCircle,
		CheckCircle2,
		ChevronLeft,
		ChevronRight,
		Clock,
		LoaderCircle,
		Play,
		Pause,
		RotateCcw,
		SkipBack
	} from '@lucide/svelte';
	import type { CorexLocale } from './i18n';

	let {
		totalSteps = 0,
		currentStepIndex = $bindable(0),
		isPlaying = $bindable(false),
		playbackSpeed = $bindable(1),
		isLive = $bindable(true),
		currentStepLabel = '',
		currentStepStatus = 'complete',
		locale = 'uk',
		canRetry = false,
		onRetry,
		onStepChange
	}: {
		totalSteps: number;
		currentStepIndex: number;
		isPlaying: boolean;
		playbackSpeed?: number;
		isLive: boolean;
		currentStepLabel?: string;
		currentStepStatus?: 'complete' | 'failed' | 'running' | 'waiting';
		locale?: CorexLocale;
		canRetry?: boolean;
		onRetry?: () => void;
		onStepChange?: (index: number) => void;
	} = $props();

	let playbackTimer: ReturnType<typeof setInterval> | null = null;

	function togglePlay() {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
	}

	function play() {
		if (totalSteps <= 1) return;
		isPlaying = true;
		isLive = false;
		if (currentStepIndex >= totalSteps - 1) {
			currentStepIndex = 0;
			onStepChange?.(0);
		}
		clearTimer();
		playbackTimer = setInterval(() => {
			if (currentStepIndex < totalSteps - 1) {
				currentStepIndex += 1;
				onStepChange?.(currentStepIndex);
			} else {
				pause();
			}
		}, 1200 / playbackSpeed);
	}

	function pause() {
		isPlaying = false;
		clearTimer();
	}

	function clearTimer() {
		if (playbackTimer) {
			clearInterval(playbackTimer);
			playbackTimer = null;
		}
	}

	function stepBack() {
		pause();
		isLive = false;
		if (currentStepIndex > 0) {
			currentStepIndex -= 1;
			onStepChange?.(currentStepIndex);
		}
	}

	function stepForward() {
		pause();
		if (currentStepIndex < totalSteps - 1) {
			currentStepIndex += 1;
			onStepChange?.(currentStepIndex);
			if (currentStepIndex === totalSteps - 1) {
				isLive = true;
			}
		}
	}

	function jumpToStart() {
		pause();
		isLive = false;
		currentStepIndex = 0;
		onStepChange?.(0);
	}

	function jumpToLive() {
		pause();
		isLive = true;
		currentStepIndex = Math.max(0, totalSteps - 1);
		onStepChange?.(currentStepIndex);
	}

	function handleSliderInput(event: Event) {
		pause();
		const target = event.target as HTMLInputElement;
		const val = Number(target.value);
		currentStepIndex = val;
		isLive = val === totalSteps - 1;
		onStepChange?.(val);
	}
</script>

{#if totalSteps > 0}
	<div class="time-travel-bar" role="region" aria-label={locale === 'uk' ? 'Часова шкала Time-Travel' : 'Time-Travel Playback'}>
		<div class="controls-left">
			<button
				type="button"
				class="btn-icon"
				disabled={currentStepIndex <= 0}
				onclick={jumpToStart}
				title={locale === 'uk' ? 'На початок' : 'Jump to start'}
				aria-label={locale === 'uk' ? 'На початок' : 'Jump to start'}
			>
				<SkipBack size={13} />
			</button>
			<button
				type="button"
				class="btn-icon"
				disabled={currentStepIndex <= 0}
				onclick={stepBack}
				title={locale === 'uk' ? 'Попередній крок' : 'Step backward'}
				aria-label={locale === 'uk' ? 'Попередній крок' : 'Step backward'}
			>
				<ChevronLeft size={15} />
			</button>
			<button
				type="button"
				class="btn-play"
				onclick={togglePlay}
				title={isPlaying ? (locale === 'uk' ? 'Пауза' : 'Pause') : (locale === 'uk' ? 'Відтворити' : 'Play')}
				aria-label={isPlaying ? (locale === 'uk' ? 'Пауза' : 'Pause') : (locale === 'uk' ? 'Відтворити' : 'Play')}
			>
				{#if isPlaying}
					<Pause size={14} />
				{:else}
					<Play size={14} fill="currentColor" />
				{/if}
			</button>
			<button
				type="button"
				class="btn-icon"
				disabled={currentStepIndex >= totalSteps - 1}
				onclick={stepForward}
				title={locale === 'uk' ? 'Наступний крок' : 'Step forward'}
				aria-label={locale === 'uk' ? 'Наступний крок' : 'Step forward'}
			>
				<ChevronRight size={15} />
			</button>
			<button
				type="button"
				class="btn-live"
				class:active={isLive}
				onclick={jumpToLive}
				title={locale === 'uk' ? 'Перейти до актуального стану (Live)' : 'Jump to live'}
			>
				<span class="live-dot"></span>
				<span>{locale === 'uk' ? 'Live' : 'Live'}</span>
			</button>
		</div>

		<div class="scrubber-center">
			<div class="scrubber-track">
				<input
					type="range"
					min="0"
					max={Math.max(0, totalSteps - 1)}
					value={currentStepIndex}
					oninput={handleSliderInput}
					aria-label={locale === 'uk' ? 'Перемотування кроків' : 'Step scrubber'}
				/>
			</div>
			<div class="step-info">
				<span class="step-badge">
					{currentStepIndex + 1} / {totalSteps}
				</span>
				{#if currentStepLabel}
					<span class="step-label" title={currentStepLabel}>{currentStepLabel}</span>
				{/if}
				<span class="step-status status-{currentStepStatus}">
					{#if currentStepStatus === 'complete'}
						<CheckCircle2 size={11} />
						<span>{locale === 'uk' ? 'Пройдено' : 'Passed'}</span>
					{:else if currentStepStatus === 'failed'}
						<AlertCircle size={11} />
						<span>{locale === 'uk' ? 'Збій' : 'Failed'}</span>
					{:else if currentStepStatus === 'running'}
						<LoaderCircle size={11} class="spin" />
						<span>{locale === 'uk' ? 'Виконується' : 'Running'}</span>
					{:else}
						<Clock size={11} />
						<span>{locale === 'uk' ? 'Очікує' : 'Waiting'}</span>
					{/if}
				</span>
			</div>
		</div>

		{#if canRetry && onRetry}
			<div class="controls-right">
				<button
					type="button"
					class="btn-retry"
					onclick={onRetry}
					title={locale === 'uk' ? 'Повторити з вузла збою' : 'Retry from failed node'}
				>
					<RotateCcw size={12} />
					<span>{locale === 'uk' ? 'Повторити крок' : 'Retry step'}</span>
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.time-travel-bar {
		position: absolute;
		bottom: 22px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 25;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 7px 14px;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(203, 213, 225, 0.8);
		border-radius: 9999px;
		box-shadow:
			0 12px 36px -4px rgba(15, 23, 42, 0.12),
			0 4px 12px rgba(15, 23, 42, 0.04),
			0 0 0 1px rgba(255, 255, 255, 0.8) inset;
		font-family: 'Manrope', sans-serif;
		color: #1e293b;
		max-width: 90vw;
		box-sizing: border-box;
	}

	.controls-left {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.btn-icon {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 9999px;
		background: transparent;
		color: #475569;
		cursor: pointer;
		transition: all 140ms ease;
	}
	.btn-icon:hover:not(:disabled) {
		background: #f1f5f9;
		color: #0f172a;
	}
	.btn-icon:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.btn-play {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 9999px;
		background: #1a73e8;
		color: #fff;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(26, 115, 232, 0.35);
		transition: all 140ms ease;
	}
	.btn-play:hover {
		background: #1557b0;
		transform: scale(1.05);
	}

	.btn-live {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 9999px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		font-size: 11px;
		font-weight: 700;
		color: #64748b;
		cursor: pointer;
		transition: all 140ms ease;
		margin-left: 4px;
	}
	.btn-live:hover {
		background: #f1f5f9;
		color: #334155;
	}
	.btn-live.active {
		background: #ecfdf5;
		border-color: #a7f3d0;
		color: #059669;
	}
	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #94a3b8;
	}
	.btn-live.active .live-dot {
		background: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
		animation: livePulse 1.8s infinite;
	}
	@keyframes livePulse {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		}
		70% {
			transform: scale(1);
			box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
		}
		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
		}
	}

	.scrubber-center {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 220px;
		max-width: 380px;
		flex: 1;
	}

	.scrubber-track {
		display: flex;
		align-items: center;
	}
	.scrubber-track input[type='range'] {
		width: 100%;
		height: 5px;
		accent-color: #1a73e8;
		cursor: pointer;
	}

	.step-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}
	.step-badge {
		font-weight: 700;
		color: #1e293b;
		background: #f1f5f9;
		padding: 1px 6px;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;
	}
	.step-label {
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #475569;
		font-weight: 600;
	}

	.step-status {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-left: auto;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 9999px;
	}
	.status-complete {
		background: #ecfdf5;
		color: #059669;
	}
	.status-failed {
		background: #fef2f2;
		color: #dc2626;
	}
	.status-running {
		background: #eff6ff;
		color: #1d4ed8;
	}
	.status-waiting {
		background: #f8fafc;
		color: #64748b;
	}

	.btn-retry {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: 9999px;
		border: 1px solid #fca5a5;
		background: #fef2f2;
		color: #dc2626;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(239, 68, 68, 0.15);
		transition: all 140ms ease;
	}
	.btn-retry:hover {
		background: #fee2e2;
		border-color: #f87171;
		transform: scale(1.03);
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
