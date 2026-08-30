<script lang="ts">
	import { onMount } from 'svelte';
	import WebGLFluid from 'webgl-fluid';

	let canvas = $state<HTMLCanvasElement>();

	onMount(() => {
		if (!canvas) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;

		let destroyed = false;

		// ── Initialize WebGL Fluid with performance-optimized settings ──
		// Matches the subtle, silky effect on groottechnologies.com
		// while keeping GPU/CPU load minimal.
		try {
			WebGLFluid(canvas, {
				IMMEDIATE: false, // No initial random splats on load
				TRIGGER: 'hover', // React to mouse movement (library handles this natively)
				AUTO: false, // No automatic periodic splats
				SIM_RESOLUTION: 64, // ← Low grid = dramatically lower GPU load
				DYE_RESOLUTION: 512, // ← Halved from 1024, still smooth visually
				CAPTURE_RESOLUTION: 256,
				DENSITY_DISSIPATION: 1.8, // Faster fade → lighter trails, less GPU persistence
				VELOCITY_DISSIPATION: 0.3, // Organic soft momentum
				PRESSURE: 0.7,
				PRESSURE_ITERATIONS: 12, // ← Reduced from 20 for significant GPU savings
				CURL: 22, // Gentle vortex curls
				SPLAT_RADIUS: 0.2, // Subtle, delicate brush size
				SPLAT_FORCE: 4000, // Moderate force for elegant fluid response
				SPLAT_COUNT: 1,
				SHADING: false, // ← Disable shading pass for performance
				COLORFUL: true,
				COLOR_UPDATE_SPEED: 8,
				PAUSED: false,
				TRANSPARENT: true,
				BACK_COLOR: { r: 0, g: 0, b: 0 },
				BLOOM: false, // ← Disabled: eliminates an expensive post-processing pass
				SUNRAYS: false // ← Disabled: eliminates another expensive post-processing pass
			});
		} catch (err) {
			console.warn('WebGL Fluid init error:', err);
			return;
		}

		// ── Event Forwarding ──
		// The library binds mousemove/mousedown/mouseup on the canvas itself,
		// but the canvas has `pointer-events: none`, so native events never reach it.
		// We forward events from the window → canvas with correct offsetX/offsetY.
		// We throttle mousemove with requestAnimationFrame to avoid flooding the GPU.

		let rafPending = false;
		let lastX = 0;
		let lastY = 0;

		function forwardMouse(type: string, clientX: number, clientY: number) {
			if (destroyed || !canvas) return;
			const rect = canvas.getBoundingClientRect();
			const evt = new MouseEvent(type, {
				clientX,
				clientY,
				bubbles: true,
				cancelable: true
			});
			// The library reads offsetX/offsetY from the event
			Object.defineProperty(evt, 'offsetX', { get: () => clientX - rect.left });
			Object.defineProperty(evt, 'offsetY', { get: () => clientY - rect.top });
			canvas.dispatchEvent(evt);
		}

		function onMove(e: MouseEvent | PointerEvent) {
			lastX = e.clientX;
			lastY = e.clientY;
			if (!rafPending) {
				rafPending = true;
				requestAnimationFrame(() => {
					rafPending = false;
					forwardMouse('mousemove', lastX, lastY);
				});
			}
		}

		function onDown(e: MouseEvent | PointerEvent) {
			forwardMouse('mousedown', e.clientX, e.clientY);
			// Small radial burst on click: 3 additional micro-splats
			for (let i = 0; i < 3; i++) {
				const angle = (Math.PI * 2 * i) / 3;
				const d = 14;
				forwardMouse('mousemove', e.clientX + Math.cos(angle) * d, e.clientY + Math.sin(angle) * d);
			}
		}

		function onUp() {
			if (destroyed || !canvas) return;
			// mouseup is listened on window by the library itself, so just dispatch
			window.dispatchEvent(new MouseEvent('mouseup'));
		}

		// Touch handling — forward as mouse events for simplicity (library uses pageX/pageY)
		function onTouchStart(e: TouchEvent) {
			if (destroyed || !canvas || !e.touches[0]) return;
			const t = e.touches[0];
			forwardMouse('mousedown', t.clientX, t.clientY);
		}

		function onTouchMove(e: TouchEvent) {
			if (destroyed || !canvas || !e.touches[0]) return;
			const t = e.touches[0];
			lastX = t.clientX;
			lastY = t.clientY;
			if (!rafPending) {
				rafPending = true;
				requestAnimationFrame(() => {
					rafPending = false;
					forwardMouse('mousemove', lastX, lastY);
				});
			}
		}

		function onTouchEnd() {
			if (destroyed || !canvas) return;
			window.dispatchEvent(new MouseEvent('mouseup'));
		}

		// Use passive listeners with capture to intercept across entire viewport
		const opts: AddEventListenerOptions = { passive: true, capture: true };
		window.addEventListener('pointermove', onMove, opts);
		window.addEventListener('pointerdown', onDown, opts);
		window.addEventListener('pointerup', onUp, opts);
		window.addEventListener('touchstart', onTouchStart, opts);
		window.addEventListener('touchmove', onTouchMove, opts);
		window.addEventListener('touchend', onTouchEnd, opts);

		return () => {
			destroyed = true;
			window.removeEventListener('pointermove', onMove, { capture: true });
			window.removeEventListener('pointerdown', onDown, { capture: true });
			window.removeEventListener('pointerup', onUp, { capture: true });
			window.removeEventListener('touchstart', onTouchStart, { capture: true });
			window.removeEventListener('touchmove', onTouchMove, { capture: true });
			window.removeEventListener('touchend', onTouchEnd, { capture: true });
		};
	});
</script>

<div class="webgl-fluid-canvas-container" aria-hidden="true">
	<canvas bind:this={canvas} class="webgl-fluid-canvas"></canvas>
</div>

<style>
	.webgl-fluid-canvas-container {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 0;
		overflow: hidden;
	}

	.webgl-fluid-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		opacity: 0.72;
		mix-blend-mode: multiply;
	}

	:global([data-money-vision='apple-dark']) .webgl-fluid-canvas {
		mix-blend-mode: screen;
		opacity: 0.8;
	}
</style>
