<script lang="ts">
	let { paused = false }: { paused?: boolean } = $props();
	function ambient(field: HTMLDivElement) {
		const motion = matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');
		let frame = 0;
		function visibility() {
			field.classList.toggle('page-hidden', document.hidden);
		}
		visibility();
		function move(event: PointerEvent) {
			if (motion.matches || paused || frame) return;
			frame = requestAnimationFrame(() => {
				field.style.setProperty('--pointer-x', `${(event.clientX / innerWidth - 0.5) * 100}px`);
				field.style.setProperty('--pointer-y', `${(event.clientY / innerHeight - 0.5) * 70}px`);
				frame = 0;
			});
		}
		window.addEventListener('pointermove', move, { passive: true });
		document.addEventListener('visibilitychange', visibility);
		return () => {
			window.removeEventListener('pointermove', move);
			document.removeEventListener('visibilitychange', visibility);
			cancelAnimationFrame(frame);
		};
	}
</script>

<div class="ambient-field" class:paused {@attach ambient} aria-hidden="true">
	<div class="ambient-orbit orbit-one"></div>
	<div class="ambient-orbit orbit-two"></div>
	<div class="ambient-orbit orbit-three"></div>
	<div class="ambient-grain"></div>
</div>
