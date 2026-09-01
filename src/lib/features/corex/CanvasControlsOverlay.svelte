<script lang="ts">
	import { onMount } from 'svelte';
	import { Maximize2, Minus, Plus, StickyNote } from '@lucide/svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import type { CorexLocale } from './i18n';

	let { locale = 'uk', onAddNote }: { locale?: CorexLocale; onAddNote?: () => void } = $props();

	const { fitView, zoomIn, zoomOut } = useSvelteFlow();

	function handleFitView() {
		fitView({ duration: 350, padding: 0.18 });
	}

	onMount(() => {
		function onKeyDown(e: KeyboardEvent) {
			const tag = (document.activeElement?.tagName || '').toLowerCase();
			if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

			if (e.shiftKey && (e.key === '!' || e.key === '1')) {
				e.preventDefault();
				handleFitView();
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<div class="canvas-custom-controls">
	<button
		type="button"
		class="ctrl-btn fit-btn"
		onclick={handleFitView}
		title={locale === 'uk' ? 'Масштабувати під екран (Shift + 1)' : 'Fit to screen (Shift + 1)'}
		aria-label="Fit View"
	>
		<Maximize2 size={13} />
		<span>{locale === 'uk' ? 'Fit View' : 'Fit'}</span>
	</button>

	<div class="divider"></div>

	<button
		type="button"
		class="ctrl-btn"
		onclick={() => zoomIn({ duration: 200 })}
		title={locale === 'uk' ? 'Збільшити масштаб' : 'Zoom in'}
		aria-label="Zoom in"
	>
		<Plus size={13} />
	</button>

	<button
		type="button"
		class="ctrl-btn"
		onclick={() => zoomOut({ duration: 200 })}
		title={locale === 'uk' ? 'Зменшити масштаб' : 'Zoom out'}
		aria-label="Zoom out"
	>
		<Minus size={13} />
	</button>

	{#if onAddNote}
		<div class="divider"></div>
		<button
			type="button"
			class="ctrl-btn note-btn"
			onclick={onAddNote}
			title={locale === 'uk' ? 'Додати архітектурну нотатку' : 'Add Sticky Note'}
			aria-label="Add Note"
		>
			<StickyNote size={13} />
			<span>{locale === 'uk' ? 'Нотатка' : 'Note'}</span>
		</button>
	{/if}
</div>

<style>
	.canvas-custom-controls {
		position: absolute;
		bottom: 18px;
		left: 18px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 4px 6px;
		border: 1px solid #e8ecf2;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
		font-family: 'Manrope', sans-serif;
	}
	.ctrl-btn {
		height: 28px;
		padding: 0 8px;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: #475569;
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		font-weight: 750;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.ctrl-btn:hover {
		background: #f1f4f8;
		color: #1a73e8;
	}
	.fit-btn {
		color: #1a73e8;
		background: #e8f0fe;
	}
	.fit-btn:hover {
		background: #d2e3fc;
		color: #174ea6;
	}
	.note-btn {
		color: #d97706;
		background: #fef9c3;
	}
	.note-btn:hover {
		background: #fef08a;
		color: #b45309;
	}
	.divider {
		width: 1px;
		height: 14px;
		background: #e2e8f0;
		margin: 0 2px;
	}
</style>
