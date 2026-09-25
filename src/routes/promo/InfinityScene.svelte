<script lang="ts">
	import { onMount } from 'svelte';
	import { Pause, Play } from '@lucide/svelte';
	import fallback from '../../../2.jpg';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let ready = $state(false);
	let moving = $state(false);
	let blur = $state(0);

	onMount(() => {
		let disposed = false;
		let cleanup = () => {};
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		moving = !motion.matches;
		const updateMotion = () => {
			moving = !motion.matches;
		};
		motion.addEventListener('change', updateMotion);

		async function setup() {
			const THREE = await import('three');
			const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
			if (disposed) return;
			const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
			renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 1.25;
			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
			const environment = new RoomEnvironment();
			const generator = new THREE.PMREMGenerator(renderer);
			const texture = generator.fromScene(environment, 0.04);
			scene.environment = texture.texture;
			environment.dispose();
			generator.dispose();
			const points = Array.from({ length: 161 }, (_, index) => {
				const angle = (index / 160) * Math.PI * 2;
				return new THREE.Vector3(3.1 * Math.cos(angle), 1.15 * Math.sin(2 * angle), 0.55 * Math.sin(angle));
			});
			const curve = new THREE.CatmullRomCurve3(points, true);
			const geometry = new THREE.TubeGeometry(curve, 200, 0.28, 20, true);
			const metal = new THREE.MeshStandardMaterial({
				color: 0xc1cbd1,
				metalness: 1,
				roughness: 0.21
			});
			const sculpture = new THREE.Group();
			sculpture.add(new THREE.Mesh(geometry, metal));
			const filamentGeometry = new THREE.TubeGeometry(curve, 200, 0.025, 8, true);
			const filamentMaterial = new THREE.MeshStandardMaterial({
				color: 0x85e0d1,
				emissive: 0x087c72,
				emissiveIntensity: 0.6
			});
			const filament = new THREE.Mesh(filamentGeometry, filamentMaterial);
			filament.position.z = 0.3;
			sculpture.add(filament);
			scene.add(sculpture);
			const calendar = new THREE.Group();
			const wallet = new THREE.Group();
			const accent = new THREE.MeshStandardMaterial({ color: 0x9ee7d8, metalness: 0.8, roughness: 0.25 });
			const edges: import('three').BufferGeometry[] = [];
			const stroke = (parent: import('three').Group, path: import('three').Vector3[], radius = 0.065, material = metal) => {
				const shape = new THREE.CatmullRomCurve3(path);
				const tube = new THREE.TubeGeometry(shape, 48, radius, 10, false);
				edges.push(tube);
				parent.add(new THREE.Mesh(tube, material));
			};
			const calendarFrame = [
				[-0.94, 0.68], [0.94, 0.68], [0.94, -0.75], [-0.94, -0.75], [-0.94, 0.68]
			].map(([x, y]) => new THREE.Vector3(x, y, 0));
			stroke(calendar, calendarFrame, 0.09);
			stroke(calendar, [new THREE.Vector3(-0.94, 0.22, 0.04), new THREE.Vector3(0.94, 0.22, 0.04)], 0.055, accent);
			for (const x of [-0.52, 0.52]) {
				stroke(calendar, [new THREE.Vector3(x, 0.93, 0.1), new THREE.Vector3(x, 0.48, 0.1)], 0.095);
			}
			for (const x of [-0.53, 0, 0.53]) {
				for (const y of [-0.12, -0.48]) {
					stroke(calendar, [new THREE.Vector3(x - 0.07, y, 0.08), new THREE.Vector3(x + 0.07, y, 0.08)], 0.055, accent);
				}
			}
			stroke(wallet, [
				new THREE.Vector3(-1.05, 0.66, 0), new THREE.Vector3(0.97, 0.66, 0),
				new THREE.Vector3(1.08, 0.52, 0), new THREE.Vector3(1.08, -0.67, 0),
				new THREE.Vector3(0.93, -0.78, 0), new THREE.Vector3(-1.05, -0.78, 0),
				new THREE.Vector3(-1.16, -0.61, 0), new THREE.Vector3(-1.16, 0.47, 0),
				new THREE.Vector3(-1.05, 0.66, 0)
			], 0.11);
			stroke(wallet, [new THREE.Vector3(-1.06, 0.22, 0.08), new THREE.Vector3(1.04, 0.22, 0.08)], 0.065, accent);
			stroke(wallet, [
				new THREE.Vector3(0.24, 0.03, 0.15), new THREE.Vector3(1.2, 0.03, 0.15),
				new THREE.Vector3(1.2, -0.42, 0.15), new THREE.Vector3(0.24, -0.42, 0.15)
			], 0.085);
			calendar.position.set(0, 0.1, -1.3);
			wallet.position.set(0, -0.1, -1.3);
			calendar.scale.setScalar(1.38);
			wallet.scale.setScalar(1.38);
			scene.add(calendar, wallet);
			const light = new THREE.DirectionalLight(0xffffff, 4);
			light.position.set(2, 5, 7);
			scene.add(light);
			const resize = () => {
				const { width, height } = host.getBoundingClientRect();
				const artBounds = host.closest('.promo-hero-art')?.getBoundingClientRect();
				const canvasBounds = canvas.getBoundingClientRect();
				renderer.setSize(width, height);
				camera.aspect = width / Math.max(height, 1);
				camera.position.set(0, 0, camera.aspect < 1.4 ? 18 : 12.5);
				camera.updateProjectionMatrix();
				const unitsPerPixel = 2 * (camera.position.z + 1.3) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect / Math.max(canvasBounds.width, 1);
				const centerX = canvasBounds.left + canvasBounds.width / 2;
				calendar.position.x = ((artBounds?.left ?? canvasBounds.left) - centerX) * unitsPerPixel;
				wallet.position.x = ((artBounds?.right ?? canvasBounds.right) - centerX) * unitsPerPixel;
			};
			const observer = new ResizeObserver(resize);
			observer.observe(host);
			resize();
			let visible = true;
			const visibility = new IntersectionObserver(([entry]) => {
				visible = entry.isIntersecting;
			});
			visibility.observe(host);
			let pointerX = 0;
			let pointerY = 0;
			const pointerMove = (event: PointerEvent) => {
				const bounds = host.getBoundingClientRect();
				pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
				pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
			};
			const pointerLeave = () => {
				pointerX = 0;
				pointerY = 0;
			};
			host.addEventListener('pointermove', pointerMove);
			host.addEventListener('pointerleave', pointerLeave);
			let progress = 0;
			let previous = 0;
			let scrollProgress = 0;
			const updateScroll = () => {
				const bounds = host.getBoundingClientRect();
				scrollProgress = Math.max(-1, Math.min(1, (bounds.top + bounds.height / 2 - innerHeight / 2) / innerHeight));
				blur = moving ? Math.min(5, Math.abs(scrollProgress) * 5) : 0;
			};
			addEventListener('scroll', updateScroll, { passive: true });
			updateScroll();
			renderer.setAnimationLoop((time) => {
				const elapsed = Math.min((time - previous) / 1000, 0.05);
				previous = time;
				if (!visible || document.hidden) return;
				if (moving) progress += elapsed;
				sculpture.rotation.y = Math.sin(progress * 0.3) * 0.18 + (moving ? pointerX * 0.3 : 0);
				sculpture.rotation.x = -0.16 + (moving ? pointerY * 0.15 : 0);
				sculpture.rotation.z = -0.08;
				const shift = moving ? scrollProgress : 0;
				calendar.position.y = 0.1 + shift * 1.4;
				wallet.position.y = -0.1 - shift * 1.4;
				calendar.rotation.y = shift * 0.38;
				wallet.rotation.y = -shift * 0.38;
				renderer.render(scene, camera);
			});
			ready = true;
			cleanup = () => {
				renderer.setAnimationLoop(null);
				observer.disconnect();
				visibility.disconnect();
				host.removeEventListener('pointermove', pointerMove);
				host.removeEventListener('pointerleave', pointerLeave);
				removeEventListener('scroll', updateScroll);
				geometry.dispose();
				filamentGeometry.dispose();
				edges.forEach((edge) => edge.dispose());
				metal.dispose();
				filamentMaterial.dispose();
				accent.dispose();
				texture.dispose();
				renderer.dispose();
			};
		}
		void setup().catch(() => {
			ready = false;
		});
		return () => {
			disposed = true;
			motion.removeEventListener('change', updateMotion);
			cleanup();
		};
	});
</script>

<div class="infinity-art" class:ready style:--scroll-blur={`${blur}px`}>
	<img src={fallback} alt="" class="infinity-fallback" />
	<div
		class="infinity-canvas"
		bind:this={host}
		role="img"
		aria-label="Алюмінієвий знак нескінченності зі світловою лінією"
	><canvas bind:this={canvas} aria-hidden="true"></canvas></div>
	<div class="infinity-atmosphere" aria-hidden="true"></div>
	{#if ready}
		<button
			class="infinity-control"
			type="button"
			onclick={() => (moving = !moving)}
			aria-label={moving ? 'Призупинити анімацію' : 'Увімкнути анімацію'}
			title={moving ? 'Призупинити анімацію' : 'Увімкнути анімацію'}
		>
			{#if moving}<Pause size={16} />{:else}<Play size={16} />{/if}
		</button>
	{/if}
</div>

<style>
	.infinity-art {
		position: absolute;
		inset: 0;
	}
	.infinity-canvas {
		position: absolute;
		inset: 0;
		filter: blur(var(--scroll-blur));
	}
	.infinity-atmosphere {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(90deg, #f0f2f4a8, transparent 23%, transparent 77%, #edf0f2a8);
	}
	@media (prefers-reduced-motion: reduce) {
		.infinity-canvas { filter: none; }
	}
	.infinity-canvas :global(canvas) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.infinity-fallback {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.25;
	}
	.ready .infinity-fallback {
		opacity: 0;
	}
	.infinity-control {
		position: absolute;
		z-index: 1;
		right: 24px;
		bottom: 18px;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border: 1px solid #b5bcc2;
		border-radius: 50%;
		background: #ffffffc9;
		color: #252a30;
		cursor: pointer;
	}
	.infinity-control:focus-visible {
		outline: 3px solid #08786b;
		outline-offset: 4px;
	}
</style>
